"""Show the unfinished entries of a job, compactly, for translation.

Usage:  python show_job.py <slug> [--limit N]
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from check_job import is_code_key

slug = sys.argv[1]
limit = 400
if "--limit" in sys.argv:
    limit = int(sys.argv[sys.argv.index("--limit") + 1])

job = json.loads(
    (Path(__file__).parent / "jobs" / f"{slug}.json").read_text(encoding="utf-8")
)

print(f"### {slug}")
print(f"units: {len(job['units'])}  js: {len(job['js'])}\n")

pending_units = [
    (k, v) for k, v in job["units"].items() if not v["zh"] and not is_code_key(k)
]
pending_js = [
    (k, v) for k, v in job["js"].items() if not v["zh"] and not is_code_key(k)
]

print(f"--- UNITS 待翻译 {len(pending_units)} ---")
for k, v in pending_units[:limit]:
    print("U|" + json.dumps(k, ensure_ascii=False))

print(f"\n--- JS 待翻译 {len(pending_js)} ---")
for k, v in pending_js[:limit]:
    print("J|" + json.dumps(k, ensure_ascii=False))

m = job.get("meta", {})
print("\n--- META ---")
for key in ("title", "tagline", "summary", "difficulty", "collection"):
    print(f"{key}: " + json.dumps(m.get(key, ""), ensure_ascii=False))
if m.get("highlights"):
    print("highlights:")
    for h in m["highlights"]:
        print("  " + json.dumps(h, ensure_ascii=False))
if m.get("tags"):
    print("tags: " + json.dumps(m["tags"], ensure_ascii=False))
