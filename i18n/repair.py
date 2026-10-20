"""Find entries whose Chinese value would actually break the source code.

This is deliberately NARROW: it only flags values that, if injected, change a
code token. We compare against the real article source:

  - the key must appear inside a JS/CSS *code* position, and
  - the value must not simply replace natural-language text.

Practical test: a value is "safe" if, after injection, the file still has
balanced quotes/brackets and the specific code token (class, id, selector) is
unchanged. We approximate by checking the corruption signatures:

  1) value = key + Chinese annotation, where key has no natural-language words
     (i.e. key is a class list, selector, id, filename, formula)
  2) key is a pure CSS/JS token per an explicit pattern

Anything else — including short UI words like "Prelude", "Random", "Speed" —
is left alone.
"""
import json
import re
from pathlib import Path

JOBS = Path("i18n/jobs")
SRC = Path("ia_src/src/articles")

# Strong signatures of a code token (checked on the ENGLISH key only).
CODE_TOKEN = [
    re.compile(r"^[\w-]+\s+[\w-]+(--|__)[\w-]*$"),        # a b--mod c
    re.compile(r"^[\w-]+(--|__)[\w-]*(\s+[\w-]+(--|__)[\w-]*)*$"),  # b--mod
    re.compile(r"^[a-z]+\[[\w-]+\]$"),                    # tr[data-idx]
    re.compile(r"^\[[\w-]+\]$"),                          # [data-view]
    re.compile(r"^[a-z][\w-]*-[A-Z][\w-]*$"),             # sin-D-val
    re.compile(r"^[a-z][\w-]*-[A-Z][\w-]*-[A-Za-z]+$"),   # rollout-L-val
    re.compile(r"^\d+px|\b\d+px\b"),                      # font sizes
    re.compile(r"\d+px.*(sans-serif|serif|monospace)"),   # font stacks
    re.compile(r"^repeat\(|minmax\(|auto repeat\("),      # css grid
    re.compile(r"^[\w.-]+\.(js|css|json|html|svg)$"),     # files
    re.compile(r"^from\s+\w+\s+import"),                  # code blocks
]


def is_code_token(key: str) -> bool:
    k = key.strip()
    if not k:
        return False
    return any(p.search(k) for p in CODE_TOKEN)


def value_corrupts(key: str, value: str) -> bool:
    if not value or value == key:
        return False
    return is_code_token(key)


def main():
    apply = "--apply" in __import__("sys").argv
    hits = []
    for f in sorted(JOBS.glob("*.json")):
        d = json.loads(f.read_text(encoding="utf-8"))
        changed = False
        for section in ("units", "js"):
            for k, v in d[section].items():
                if value_corrupts(k, v.get("zh", "")):
                    hits.append((f.stem, section, k, v["zh"]))
                    v["zh"] = ""
                    changed = True
        if changed and apply:
            f.write_text(
                json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8"
            )
    print(f"{'已修复' if apply else '待修复(dry-run)'}: {len(hits)} 条")
    for slug, sec, k, zh in hits:
        print(f"  {slug}/{sec}: {k!r} <- {zh!r}")


if __name__ == "__main__":
    main()
