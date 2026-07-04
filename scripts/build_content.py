"""Build content/articles.json from articles/*.html for the mobile app content pipeline.

Default mode only includes articles present in the committed (git HEAD) sitemap.xml,
so locally drafted but unpublished articles never leak into the public JSON.
Use --all to include every article HTML file (e.g. for local app testing).

Usage:
    python scripts/build_content.py          # published-only (safe default)
    python scripts/build_content.py --all    # include local drafts too
"""

import json
import re
import subprocess
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

SITE_NAME = "稅務 x 美股 x AI"
BASE_URL = "https://taxcodeusstocks.com"
CHARS_PER_MINUTE = 260  # 中文閱讀速度估值，校準對象 = 站上「約 N 分鐘」標示（2026-07-04 以 6 篇實測校準）

ROOT = Path(__file__).resolve().parent.parent
ARTICLES_DIR = ROOT / "articles"
OUTPUT_PATH = ROOT / "content" / "articles.json"

TAIPEI_TZ = timezone(timedelta(hours=8))


def published_slugs_from_head_sitemap() -> set[str] | None:
    """Slugs listed in the committed sitemap.xml (git HEAD). None if git unavailable."""
    try:
        result = subprocess.run(
            ["git", "show", "HEAD:sitemap.xml"],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            check=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
    return set(re.findall(r"articles/([a-z0-9-]+)\.html", result.stdout))


def strip_tags(html: str) -> str:
    text = re.sub(r"<[^>]+>", "", html)
    return re.sub(r"\s+", "", text)


def parse_post_meta(meta_text: str) -> dict:
    """Parse '傑夫哥 · 2026-07-04 · 分類：跨境稅務 · 法規基準日：2026-07-04'."""
    parts = [p.strip() for p in meta_text.split("·")]
    parsed = {"author": parts[0] if parts else "", "date": "", "category": "", "extra": []}
    for part in parts[1:]:
        if re.fullmatch(r"\d{4}-\d{2}-\d{2}", part):
            parsed["date"] = part
        elif part.startswith("分類："):
            parsed["category"] = part.removeprefix("分類：")
        elif part.startswith("法規基準日："):
            parsed["law_reference_date"] = part.removeprefix("法規基準日：")
        else:
            parsed["extra"].append(part)
    return parsed


def parse_article(path: Path) -> dict:
    html = path.read_text(encoding="utf-8")

    article_match = re.search(r'<article class="post">(.*?)</article>', html, re.S)
    if not article_match:
        raise ValueError(f'{path.name}: <article class="post"> block not found')
    article_html = article_match.group(1)

    h1_match = re.search(r"<h1>(.*?)</h1>", article_html, re.S)
    meta_match = re.search(r'<div class="post-meta">(.*?)</div>', article_html, re.S)
    desc_match = re.search(r'<meta name="description" content="([^"]*)"', html)
    if not h1_match or not meta_match:
        raise ValueError(f"{path.name}: missing <h1> or post-meta")

    body_html = article_html
    body_html = body_html.replace(h1_match.group(0), "", 1)
    body_html = body_html.replace(meta_match.group(0), "", 1)
    body_html = body_html.strip()

    meta = parse_post_meta(re.sub(r"<[^>]+>", "", meta_match.group(1)).strip())
    char_count = len(strip_tags(body_html))

    record = {
        "slug": path.stem,
        "url": f"{BASE_URL}/articles/{path.name}",
        "title": h1_match.group(1).strip(),
        "date": meta["date"],
        "category": meta["category"],
        "description": desc_match.group(1) if desc_match else "",
        "reading_minutes": max(3, round(char_count / CHARS_PER_MINUTE)),
        "char_count": char_count,
        "body_html": body_html,
    }
    if "law_reference_date" in meta:
        record["law_reference_date"] = meta["law_reference_date"]
    if meta["extra"]:
        record["meta_notes"] = meta["extra"]
    return record


def main() -> int:
    include_all = "--all" in sys.argv

    published = None
    if not include_all:
        published = published_slugs_from_head_sitemap()
        if published is None:
            print("WARNING: git unavailable, falling back to --all (drafts may be included)")

    articles = []
    skipped = []
    for path in sorted(ARTICLES_DIR.glob("*.html")):
        if published is not None and path.stem not in published:
            skipped.append(path.stem)
            continue
        articles.append(parse_article(path))

    articles.sort(key=lambda a: (a["date"], a["slug"]), reverse=True)

    output = {
        "site": SITE_NAME,
        "base_url": BASE_URL,
        "generated_at": datetime.now(TAIPEI_TZ).isoformat(timespec="seconds"),
        "count": len(articles),
        "articles": articles,
    }
    OUTPUT_PATH.parent.mkdir(exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps(output, ensure_ascii=False, indent=1) + "\n", encoding="utf-8"
    )

    print(f"Wrote {OUTPUT_PATH.relative_to(ROOT)} with {len(articles)} articles")
    if skipped:
        print(f"Skipped (not in HEAD sitemap, unpublished): {', '.join(skipped)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
