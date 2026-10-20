"""Extract every article's translatable units into per-article job files.

Output layout:
  i18n/jobs/<slug>.json   -> { "units": {...}, "meta": {...}, "js": {...} }

Each unit maps  masked_english -> "" (to be filled with Chinese).
Run this, then fill the files, then run inject.py.

Usage:  python build_jobs.py
"""
import json
import re
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from segment import (  # noqa: E402
    html_to_units, lock_tags, is_translatable, UNIT_TAG_RE,
)
from extract import (  # noqa: E402
    strip_js_noise, template_to_placeholder, BLOCK_RE, BT,
)

ROOT = Path(__file__).resolve().parent.parent / "ia_src"
ART = ROOT / "src" / "articles"
OUT = Path(__file__).resolve().parent / "jobs"


def read(p: Path) -> str:
    return p.read_text(encoding="utf-8")


# Strings that look like code/config rather than prose, even when they contain
# several words. Deliberately narrow: math prose is full of `=`, `(`, `)` and
# `<`, so only unambiguous CSS/font/value shapes are treated as code.
CODE_LIKE = re.compile(
    r"^\s*\d+(\.\d+)?px\b"                      # 11px ...
    r"|^\s*\d+\s+\d+px\b"                       # 700 12px ...
    r"|\b(sans-serif|monospace)\b"              # font stacks
    r"|\b\d+(\.\d+)?(px|rem|em|vh|vw)\b"        # any measurement
    r"|rgba?\(|hsla?\(|url\("                   # css functions
    r"|#[0-9a-fA-F]{3,8}\b"                     # hex colours
)


def looks_like_code(text: str) -> bool:
    return bool(CODE_LIKE.search(text))


# Strip everything that is not natural language, then check whether real
# English words remain. Used to drop pure-math units like "$$E = mc^2$$".
_STRIP_FOR_WORDS = [
    (re.compile(r"@@T\d+@@"), " "),
    (re.compile(r"\$\$?.+?\$\$?", re.S), " "),
    (re.compile(r"\\[a-zA-Z]+"), " "),
    (re.compile(r"&[a-zA-Z]+;|&#\d+;"), " "),
    (re.compile(r"<[^>]+>"), " "),
    (re.compile(r"\[\[\[\d+\]\]\]"), " "),
]


def english_word_count(text: str) -> int:
    t = text
    for pat, rep in _STRIP_FOR_WORDS:
        t = pat.sub(rep, t)
    return len(re.findall(r"[A-Za-z]{3,}", t))


def extract_article(d: Path):
    job = {"slug": d.name, "units": {}, "meta": {}, "js": {}}

    # ---- HTML units ----
    hf = d / "index.html"
    raw = read(hf)
    # remember code blocks so they are never segmented
    masked = BLOCK_RE.sub("", raw)
    for unit in html_to_units(masked):
        if not is_translatable(unit):
            continue
        locked, tags = lock_tags(unit)
        # skip if nothing left to translate
        if len(re.sub(r"[^A-Za-z]", "", locked)) < 2:
            continue
        if looks_like_code(UNIT_TAG_RE.sub(" ", locked)):
            continue
        # drop pure notation: no real English word survives stripping maths
        if english_word_count(locked) < 1:
            continue
        # `unit` is the exact original HTML slice; `locked` is what the
        # translator edits. Keep both so injection can find the source, and
        # keep the tag table so the translated text can be unlocked.
        job["units"][locked] = {"zh": "", "src": unit, "tags": tags}

    # ---- HTML attributes ----
    for attr in ("aria-label", "title", "placeholder", "alt"):
        for m in re.finditer(rf'{attr}="([^"]*)"', masked):
            val = m.group(1)
            if not (re.search(r"[a-zA-Z]{2}", val) and re.search(r"[A-Za-z]{2,}", val)):
                continue
            if looks_like_code(val):
                continue
            job["units"].setdefault(val, {"zh": "", "src": val, "tags": []})

    # ---- meta.json ----
    mf = d / "meta.json"
    if mf.exists():
        meta = json.loads(read(mf))
        # NOTE: readingTime is deliberately left alone ("24 min" stays as is).
        for key in ("title", "tagline", "summary",
                    "difficulty", "collection"):
            if isinstance(meta.get(key), str):
                job["meta"][key] = meta[key]
        if isinstance(meta.get("highlights"), list):
            job["meta"]["highlights"] = meta["highlights"]
        if isinstance(meta.get("tags"), list):
            job["meta"]["tags"] = meta["tags"]

    # ---- JS ----
    for name in ("main.js", "app.js"):
        jf = d / name
        if not jf.exists():
            continue
        src = strip_js_noise(read(jf))
        tpl_re = re.compile(BT + r"((?:\\.|[^" + BT + r"\\])*)" + BT, re.S)
        for m in tpl_re.finditer(src):
            body = m.group(1)
            visible = re.sub(r"\$\{[^}]*\}", " X ", body)
            visible = re.sub(r"<[^>]+>", " ", visible)
            # needs at least two real words; a single word after stripping
            # interpolations is usually a code fragment
            if len(re.findall(r"[A-Za-z]{2,}", visible)) < 2:
                continue
            if not re.search(r"\s", visible.strip()):
                continue
            key_masked, exprs = template_to_placeholder(body)
            locked, tags = lock_tags(key_masked)
            # `src` is the exact original slice to find in the file;
            # `locked` is the prose the translator edits.
            job["js"][locked] = {
                "zh": "", "exprs": exprs, "tags": tags, "src": body,
            }
        # Plain quoted prose: both ' and " (JS data objects are usually
        # single-quoted, template output usually double-quoted).
        for m in re.finditer(
            r'"((?:[^"\\\n]|\\.)*)"' r"|'((?:[^'\\\n]|\\.)*)'", src
        ):
            v = m.group(1) if m.group(1) is not None else m.group(2)
            if not v or len(v) < 8:
                continue
            # needs a real multi-letter word, and not be pure punctuation
            if not re.search(r"[A-Za-z]{2,}", v):
                continue
            if re.search(r"[{};=()]", v):
                continue
            # skip selectors, css values, identifiers
            if re.fullmatch(r"[a-z0-9-]+", v) or v.startswith((".", "#", "http", "data:")):
                continue
            # skip attribute selectors, directives, and file-ish strings
            if re.match(r"^\[[^\]]*\]$", v.strip()):
                continue
            if v.strip() in ("use strict", "use asm"):
                continue
            if re.fullmatch(r"[\w./-]+\.(js|css|json|html|png|svg|txt)", v.strip()):
                continue
            # a comma/pipe separated list of bare lowercase identifiers
            tokens = re.split(r"\s*[|,]\s*", v.strip())
            if len(tokens) > 1 and all(re.fullmatch(r"[a-z][a-z0-9-]*", t) for t in tokens):
                continue
            if looks_like_code(v):
                continue
            if english_word_count(v) < 1:
                continue
            # skip camelCase / snake_case identifiers and math-only strings
            if re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", v):
                continue
            if not re.search(r"\s", v) and not re.search(r"[A-Za-z]{3,}", v):
                continue
            job["js"].setdefault(
                v, {"zh": "", "exprs": [], "tags": [], "src": v}
            )

    return job


def main():
    OUT.mkdir(exist_ok=True)
    total_units = 0
    for d in sorted(ART.iterdir()):
        if not d.is_dir() or not (d / "index.html").exists():
            continue
        job = extract_article(d)
        (OUT / f"{d.name}.json").write_text(
            json.dumps(job, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        n = len(job["units"]) + len(job["js"])
        total_units += n
        print(f"{n:>5}  {d.name}")

    print(f"\n写入了 {len(list(OUT.glob('*.json')))} 个 job 文件，共 {total_units} 条待翻译条目")


if __name__ == "__main__":
    main()
