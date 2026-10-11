"""Batch-import public social customer voice (Reddit, YouTube comments) without API keys.

    uv run python scripts/import_social_batch.py fetch            # network: writes data/social/<date>/*.json
    uv run python scripts/import_social_batch.py import --api-url http://127.0.0.1:8000 [--snapshot DIR]

`fetch` reads Reddit's public RSS search and comment feeds (paced and backing off on HTTP 429) and the top
comments of selected YouTube reviews through yt-dlp (`uvx yt-dlp`), and stores a normalised snapshot under the
git-ignored data/ folder. `import` sends the snapshot through the ordinary POST /imports/records, one source per
platform, so records are archived, located, deduplicated and analysed like every other source. Usernames and
author ids are dropped; each record keeps its permalink, publication date and engagement counts.

This is a batch, not a live integration: the official Reddit and YouTube Data APIs need credentials.
Only public search terms (model names, topics) leave the system.
"""

import argparse
import html
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date, datetime, timezone
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SNAPSHOTS = ROOT / "data" / "social"
USER_AGENT = "bmw-product-evidence/0.2 (hackathon research prototype; public RSS only)"
ATOM = {"a": "http://www.w3.org/2005/Atom"}
print = partial(print, flush=True)  # noqa: A001  progress shows while piped
PACE_SECONDS = 12
ACTOR = "system:social-batch"

# G60 / US: owner subreddits and US-market review videos of the 5 Series / i5.
REDDIT_SEARCHES = [
    ("BMWi5", "charging", "charging"), ("BMWi5", "range", "range"),
    ("BMWi5", "seats OR comfort OR ride", "comfort"), ("BMWi5", "iDrive OR screen OR app", "controls"),
    ("BMWi5", "noise OR quiet OR rattle", "quietness"), ("BMWi5", "assist OR lane OR parking", "driver-assistance"),
    ("BMW", "G60 OR \"530i\" OR \"540i\"", None), ("BMW", "i5", None),
]
COMMENT_THREADS = 6
YOUTUBE_VIDEOS = ["z07PTQn360o", "eDtJdW4zsxQ", "ESOyLl7utms", "QEghwHrlEGE"]
YOUTUBE_COMMENTS = 80
TOPIC_LABELS = {"charging": "Charging experience", "range": "Driving range", "comfort": "Cabin comfort",
                "controls": "Intuitive vehicle controls", "quietness": "Cabin quietness",
                "driver-assistance": "Driver assistance experience"}


# Reddit -----------------------------------------------------------------------------------------------

def _get(url: str, attempts: int = 4) -> bytes:
    for attempt in range(attempts):
        request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
        try:
            with urllib.request.urlopen(request, timeout=30) as response:
                return response.read(5_000_000)
        except urllib.error.HTTPError as exc:
            if exc.code != 429 or attempt == attempts - 1:
                raise
            wait = int(exc.headers.get("Retry-After") or 0) or 45 * (attempt + 1)
            print(f"  Reddit rate limit; waiting {wait} s", file=sys.stderr)
            time.sleep(wait)
    raise RuntimeError("unreachable")


def _text(fragment: str | None) -> str:
    text = html.unescape(fragment or "")
    text = re.sub(r"<br\s*/?>|</p>", "\n", text)
    text = re.sub(r"<[^>]+>", " ", text)
    text = html.unescape(text)
    text = re.sub(r"submitted by\s+/u/\S+.*$", "", text, flags=re.S)  # RSS footer with the username
    text = re.sub(r"\[link\]|\[comments\]", "", text)
    return "\n".join(" ".join(line.split()) for line in text.splitlines() if line.strip()).strip()


def _entries(xml: bytes) -> list[dict]:
    entries = []
    for entry in ET.fromstring(xml).findall("a:entry", ATOM):
        link = entry.find("a:link", ATOM)
        published = entry.find("a:published", ATOM)
        updated = entry.find("a:updated", ATOM)
        entries.append({"id": (entry.findtext("a:id", "", ATOM) or "").strip(),
                        "url": link.get("href") if link is not None else None,
                        "title": html.unescape(entry.findtext("a:title", "", ATOM) or "").strip(),
                        "published": (published if published is not None else updated).text,
                        "text": _text(entry.findtext("a:content", "", ATOM))})
    return entries


def fetch_reddit() -> dict:
    posts, comments, queries = {}, [], []
    for subreddit, query, topic in REDDIT_SEARCHES:
        url = (f"https://www.reddit.com/r/{subreddit}/search.rss?" + urllib.parse.urlencode(
            {"q": query, "restrict_sr": "on", "sort": "top", "t": "all", "limit": 25}))
        try:
            found = _entries(_get(url))
        except (OSError, ET.ParseError) as exc:
            print(f"  r/{subreddit} '{query}' skipped: {exc}", file=sys.stderr)
            found = []
        queries.append({"subreddit": subreddit, "query": query, "topic": topic, "url": url, "results": len(found)})
        for entry in found:
            if entry["id"].startswith("t3_") and entry["id"] not in posts:
                posts[entry["id"]] = {**entry, "subreddit": subreddit, "topic": topic, "kind": "post"}
        print(f"  r/{subreddit} '{query}': {len(found)} posts")
        time.sleep(PACE_SECONDS)
    picked, seen_topics = [], set()
    for post in posts.values():  # first (top) thread per topic, then the r/BMW top threads
        key = post["topic"] or post["subreddit"]
        if key not in seen_topics and post["url"]:
            seen_topics.add(key)
            picked.append(post)
    for post in picked[:COMMENT_THREADS]:
        try:
            found = _entries(_get(post["url"].rstrip("/") + "/.rss?limit=100"))
        except (OSError, ET.ParseError) as exc:  # one unreachable thread must not discard the batch
            print(f"  thread '{post['title'][:60]}' skipped: {exc}", file=sys.stderr)
            time.sleep(PACE_SECONDS)
            continue
        thread = [e for e in found if e["id"].startswith("t1_")]
        comments += [{**e, "subreddit": post["subreddit"], "topic": post["topic"], "kind": "comment",
                      "thread_id": post["id"], "thread_title": post["title"]} for e in thread]
        print(f"  thread '{post['title'][:60]}': {len(thread)} comments")
        time.sleep(PACE_SECONDS)
    return {"platform": "reddit", "retrieved_at": datetime.now(timezone.utc).isoformat(), "queries": queries,
            "items": list(posts.values()) + comments}


# YouTube ----------------------------------------------------------------------------------------------

def fetch_youtube() -> dict:
    command = ["yt-dlp"] if shutil.which("yt-dlp") else ["uvx", "--quiet", "yt-dlp"]
    videos = []
    with tempfile.TemporaryDirectory() as directory:
        subprocess.run([*command, "--skip-download", "--write-comments", "--no-write-playlist-metafiles", "--quiet",
                        "--extractor-args", f"youtube:max_comments={YOUTUBE_COMMENTS},all,0,0;comment_sort=top",
                        "-o", f"{directory}/%(id)s.%(ext)s",
                        *[f"https://www.youtube.com/watch?v={video}" for video in YOUTUBE_VIDEOS]], check=True)
        for video in YOUTUBE_VIDEOS:
            path = Path(directory) / f"{video}.info.json"
            if not path.exists():
                print(f"  {video}: no metadata", file=sys.stderr)
                continue
            info = json.loads(path.read_text())
            comments = [{"id": c["id"], "text": c["text"], "like_count": c.get("like_count") or 0,
                         "timestamp": c.get("timestamp"), "time_text": c.get("_time_text"), "is_reply": c.get("parent") != "root"}
                        for c in info.get("comments") or [] if not c.get("author_is_uploader")]
            upload = info.get("upload_date")
            videos.append({"id": video, "url": f"https://www.youtube.com/watch?v={video}", "title": info.get("title"),
                           "channel": info.get("channel"), "views": info.get("view_count"),
                           "published": f"{upload[:4]}-{upload[4:6]}-{upload[6:]}" if upload else None,
                           "thumbnail": f"https://i.ytimg.com/vi/{video}/mqdefault.jpg",
                           "comment_count": info.get("comment_count"), "comments": comments})
            print(f"  {info.get('channel')}: '{info.get('title', '')[:60]}' {len(comments)} comments")
    return {"platform": "youtube", "retrieved_at": datetime.now(timezone.utc).isoformat(), "videos": videos}


# Import -----------------------------------------------------------------------------------------------

def _day(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return datetime.fromtimestamp(value, timezone.utc).date().isoformat()
    try:
        return datetime.fromisoformat(str(value).replace("Z", "+00:00")).date().isoformat()
    except ValueError:
        return None


def reddit_records(snapshot: dict) -> list[dict]:
    records = []
    for item in snapshot["items"]:
        text = item["text"] if item["kind"] == "comment" else "\n\n".join(filter(None, [item["title"], item["text"]]))
        if len(text) < 20:
            continue
        metadata = {"connector": "reddit", "source_type": f"reddit_{item['kind']}", "provenance": f"reddit.com/r/{item['subreddit']}",
                    "subreddit": item["subreddit"], "origin": "public_social"}
        if item.get("topic"):
            metadata["topic"] = TOPIC_LABELS[item["topic"]]
        records.append({"content": text[:4000], "observed_at": _day(item["published"]),
                        "location": {"platform": "reddit", "url": item["url"], "reddit_id": item["id"],
                                     "kind": item["kind"], **({"thread": item["thread_title"]} if item.get("thread_title") else {})},
                        "metadata": metadata})
    return records


def youtube_records(snapshot: dict) -> list[dict]:
    records = []
    for video in snapshot["videos"]:
        for comment in video["comments"]:
            if len(comment["text"].strip()) < 20:
                continue
            records.append({"content": comment["text"].strip()[:4000], "observed_at": _day(comment["timestamp"]),
                            "location": {"platform": "youtube", "url": f"{video['url']}&lc={comment['id']}",
                                         "video_id": video["id"], "video_title": video["title"], "comment_id": comment["id"]},
                            "metadata": {"connector": "youtube", "source_type": "youtube_comment", "origin": "public_social",
                                         "provenance": f"youtube.com/{video['channel']}", "channel": video["channel"],
                                         "like_count": comment["like_count"], "is_reply": comment["is_reply"],
                                         "date_basis": "relative time shown by YouTube (approximate)"}})
    return records


def post(api: str, payload: dict) -> dict:
    request = urllib.request.Request(api.rstrip("/") + "/imports/records", data=json.dumps(payload).encode(),
                                     method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        sys.exit(f"Import failed: HTTP {exc.code}: {exc.read().decode()[:500]}")


def import_snapshot(api: str, folder: Path, vehicle: str, market: str) -> None:
    batch = folder.name
    reddit = json.loads((folder / "reddit.json").read_text()) if (folder / "reddit.json").exists() else None
    youtube = json.loads((folder / "youtube.json").read_text()) if (folder / "youtube.json").exists() else None
    if reddit:
        records = reddit_records(reddit)
        subreddits = sorted({item["subreddit"] for item in reddit["items"]})
        result = post(api, {"vehicle": vehicle, "market": market, "kind": "web", "actor": ACTOR,
                            "title": f"Reddit · {' & '.join('r/' + s for s in subreddits)} (batch {batch})",
                            "reference": f"https://www.reddit.com/r/{'+'.join(subreddits)}#batch-{batch}",
                            "records": records,
                            "metadata": {"connector": "reddit", "origin": "public_social", "publisher": "Reddit (public RSS)",
                                         "batch": batch, "retrieved_at": reddit["retrieved_at"], "queries": reddit["queries"],
                                         "posts": sum(i["kind"] == "post" for i in reddit["items"]),
                                         "comments": sum(i["kind"] == "comment" for i in reddit["items"]),
                                         "note": "Batch snapshot of public posts and comments; usernames removed."}})
        print(f"Reddit: {result['record_count']} records, source {result['source_id']}"
              f"{' (already imported)' if result['deduplicated'] else ''}")
    if youtube:
        records = youtube_records(youtube)
        result = post(api, {"vehicle": vehicle, "market": market, "kind": "web", "actor": ACTOR,
                            "title": f"YouTube comments · {len(youtube['videos'])} US review videos (batch {batch})",
                            "reference": f"https://www.youtube.com/#batch-{batch}", "records": records,
                            "metadata": {"connector": "youtube", "origin": "public_social",
                                         "publisher": "YouTube (public comments via yt-dlp)", "batch": batch,
                                         "retrieved_at": youtube["retrieved_at"],
                                         "videos": [{k: v for k, v in video.items() if k != "comments"}
                                                    for video in youtube["videos"]],
                                         "note": "Top comments per video; usernames removed; dates approximate."}})
        print(f"YouTube: {result['record_count']} records, source {result['source_id']}"
              f"{' (already imported)' if result['deduplicated'] else ''}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = parser.add_subparsers(dest="command", required=True)
    fetch = sub.add_parser("fetch", help="Download a new snapshot (network)")
    fetch.add_argument("--only", choices=("reddit", "youtube"))
    fetch.add_argument("--dir", type=Path, default=SNAPSHOTS, help="Snapshot root (default: data/social)")
    load = sub.add_parser("import", help="Import a snapshot through the API")
    load.add_argument("--api-url", default="http://127.0.0.1:8000")
    load.add_argument("--snapshot", help="Snapshot folder (default: newest under --dir)")
    load.add_argument("--dir", type=Path, default=SNAPSHOTS, help="Snapshot root (default: data/social)")
    load.add_argument("--vehicle", default="G60")
    load.add_argument("--market", default="US")
    args = parser.parse_args()
    if args.command == "fetch":
        folder = args.dir / date.today().isoformat()
        folder.mkdir(parents=True, exist_ok=True)
        for platform, fetcher in (("youtube", fetch_youtube), ("reddit", fetch_reddit)):
            if args.only in (None, platform):
                print(f"Fetching {platform}…")
                (folder / f"{platform}.json").write_text(json.dumps(fetcher(), ensure_ascii=False, indent=1))
        print(f"Snapshot: {folder}")
        return
    folders = sorted(p for p in args.dir.glob("*") if p.is_dir())
    folder = Path(args.snapshot) if args.snapshot else (folders[-1] if folders else None)
    if folder is None or not folder.is_dir():
        sys.exit("No snapshot found; run the fetch command first")
    import_snapshot(args.api_url, folder, args.vehicle.upper(), args.market.upper())


if __name__ == "__main__":
    main()
