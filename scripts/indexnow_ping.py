"""Submit URLs to IndexNow (Bing ecosystem) after a push.

Usage:
    python scripts/indexnow_ping.py https://taxcodeusstocks.com/articles/foo.html [...]
    python scripts/indexnow_ping.py --all    # submit every URL in sitemap.xml

Run AFTER the pages are live (IndexNow validates the key file on the domain).
Google does not use IndexNow; this covers Bing / Copilot / DuckDuckGo.
"""

import json
import re
import sys
import urllib.request
from pathlib import Path

HOST = "taxcodeusstocks.com"
KEY = "82c8c0ded4f9433abff7ba827753ef37"
API = "https://api.indexnow.org/indexnow"
SITEMAP = Path(__file__).resolve().parent.parent / "sitemap.xml"


def sitemap_urls() -> list[str]:
    return re.findall(r"<loc>(.*?)</loc>", SITEMAP.read_text(encoding="utf-8"))


def main() -> None:
    args = sys.argv[1:]
    if not args:
        sys.exit(__doc__)
    urls = sitemap_urls() if args == ["--all"] else args
    bad = [u for u in urls if HOST not in u]
    if bad:
        sys.exit(f"non-{HOST} URLs rejected: {bad}")
    payload = {
        "host": HOST,
        "key": KEY,
        "keyLocation": f"https://{HOST}/{KEY}.txt",
        "urlList": urls,
    }
    req = urllib.request.Request(
        API,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json; charset=utf-8"},
    )
    with urllib.request.urlopen(req) as resp:
        print(f"HTTP {resp.status} — submitted {len(urls)} URL(s)")


if __name__ == "__main__":
    main()
