"""Rebuild review/article-voice-review.html data from _review/drafts + originals.

Usage: python _review/assemble.py
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HTML_PATH = ROOT / "review" / "article-voice-review.html"
ORIGINALS = ROOT / "_review" / "originals.json"
DRAFTS = ROOT / "_review" / "drafts"

ORDER = [
    "ai-workflow-case",
    "us-estate-tax-60k",
    "foreigner-taiwan-tax-resident",
    "sk-hynix-adr-tax",
    "overseas-income-750-myth",
    "irish-etf-pillar-two",
    "apple-etr",
    "tsm-adr-tax",
    "treasury-etf-estate-tax",
    "diy-13f-tracker",
    "ai-research-workflow",
]


def main() -> None:
    originals = {a["slug"]: a for a in json.loads(ORIGINALS.read_text(encoding="utf-8"))}
    articles = []
    for slug in ORDER:
        o = originals[slug]
        d = json.loads((DRAFTS / f"{slug}.json").read_text(encoding="utf-8"))
        articles.append({
            "slug": slug,
            "path": o["path"],
            "category": o["category"],
            "title_original": o["title"],
            "title_suggested": d["title_suggested"],
            "description_original": o["description"],
            "description_suggested": d["description_suggested"],
            "issues": d["issues"],
            "body_original": o["body_html"],
            "body_suggested": d["body_html_suggested"].strip(),
        })
    payload = {
        "generated_at": datetime.now(timezone(timedelta(hours=8))).strftime("%Y-%m-%d %H:%M +08:00"),
        "count": len(articles),
        "howto": "逐篇對照原文與建議稿，在第三欄貼上或改出你的定稿，再複製交接包貼回 Cursor。",
        "articles": articles,
    }
    js = "window.REVIEW_DATA = " + json.dumps(payload, ensure_ascii=False, indent=2) + ";\n"
    html = HTML_PATH.read_text(encoding="utf-8")
    html = re.sub(
        r"<script>\s*window\.REVIEW_DATA = .*?</script>",
        "<script>\n" + js + "</script>",
        html,
        count=1,
        flags=re.S,
    )
    HTML_PATH.write_text(html, encoding="utf-8")
    print("updated", HTML_PATH, "articles", len(articles))


if __name__ == "__main__":
    main()
