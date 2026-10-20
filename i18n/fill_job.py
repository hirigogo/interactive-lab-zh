"""Merge a plain translation map into a job file.

Subagents write a small JSON of {english: chinese} pairs; this script applies
them to jobs/<slug>.json (units and js), and the meta block, so the agent never
has to hand-edit the large job file.

Usage:
  python fill_job.py <slug> <translations.json>

translations.json shape:
  {
    "units": { "<english>": "<chinese>", ... },
    "js":    { "<english>": "<chinese>", ... },
    "meta":  { "title": "...", "tagline": "...", "summary": "...",
               "difficulty": "...", "collection": "...",
               "highlights": ["..."], "tags": ["..."] }
  }

Only non-empty values are applied. Unknown keys are reported, not fatal.
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent


def main():
    slug, trans_path = sys.argv[1], sys.argv[2]
    job_path = HERE / "jobs" / f"{slug}.json"
    job = json.loads(job_path.read_text(encoding="utf-8"))
    tr = json.loads(Path(trans_path).read_text(encoding="utf-8"))

    applied = miss = 0
    for eng, zh in (tr.get("units") or {}).items():
        if eng in job["units"] and zh:
            job["units"][eng]["zh"] = zh
            applied += 1
        else:
            miss += 1
            print("UNIT MISS:", repr(eng[:70]))

    for eng, zh in (tr.get("js") or {}).items():
        if eng in job["js"] and zh:
            job["js"][eng]["zh"] = zh
            applied += 1
        else:
            miss += 1
            print("JS MISS:", repr(eng[:70]))

    for key, val in (tr.get("meta") or {}).items():
        if val:
            job["meta"][key] = val
            applied += 1

    job_path.write_text(
        json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8"
    )
    print(f"applied={applied} missing={miss}")


if __name__ == "__main__":
    main()
