"""Extract translatable strings from one article into a JSON map.

Handles three sources:
  1. HTML text nodes and a whitelist of attributes (code blocks skipped).
  2. Plain single/double-quoted prose strings inside JS.
  3. Prose inside JS template literals, with `${...}` interpolations
     replaced by numbered placeholders so the translator never sees code.

Keys are the ORIGINAL English text (stable + idempotent). Values are empty
until filled by the translation step.

Usage:
  python extract.py <article-dir> > strings.json
"""
import json
import re
import sys
from pathlib import Path

TEXT_ATTRS = ("aria-label", "title", "placeholder", "alt")
BLOCK_RE = re.compile(r"<(script|style|svg)\b.*?</\1>", re.IGNORECASE | re.DOTALL)
BT = chr(96)  # backtick

# placeholders for interpolations inside template literals. Kept to plain
# printable ASCII so the text survives JSON round-trips and translation.
PH_OPEN, PH_CLOSE = "[[[", "]]]"


def has_words(text: str, minimum: int = 2) -> bool:
    stripped = text.strip()
    if len(stripped) < minimum:
        return False
    if len(re.sub(r"[^A-Za-z]", "", stripped)) < 2:
        return False
    if stripped.startswith(("http://", "https://", "//", "data:")):
        return False
    return bool(re.search(r"[A-Za-z]{2}", stripped))


def mask_blocks(html_text: str):
    store = []

    def _sub(m):
        store.append(m.group(0))
        return f"@@BLOCK{len(store) - 1}@@"

    return BLOCK_RE.sub(_sub, html_text), store


def extract_html(path: Path):
    masked, _ = mask_blocks(path.read_text(encoding="utf-8"))
    out = []
    for m in re.finditer(r">([^<>]+)<", masked):
        if has_words(m.group(1)):
            out.append(m.group(1))
    for attr in TEXT_ATTRS:
        for m in re.finditer(rf'{attr}="([^"]*)"', masked):
            if has_words(m.group(1)):
                out.append(m.group(1))
    return out


def strip_js_noise(src: str) -> str:
    src = re.sub(r"/\*.*?\*/", "", src, flags=re.DOTALL)
    src = re.sub(r"(?<!:)//[^\n]*", "", src)
    return src


def template_to_placeholder(tpl_body: str):
    """Replace ${...} with placeholders; return (masked, [exprs])."""
    exprs = []
    out = []
    i = 0
    while i < len(tpl_body):
        ch = tpl_body[i]
        if ch == "\\":
            out.append(tpl_body[i : i + 2])
            i += 2
            continue
        if ch == "$" and i + 1 < len(tpl_body) and tpl_body[i + 1] == "{":
            depth = 0
            j = i + 1
            while j < len(tpl_body):
                if tpl_body[j] == "{":
                    depth += 1
                elif tpl_body[j] == "}":
                    depth -= 1
                    if depth == 0:
                        break
                j += 1
            exprs.append(tpl_body[i : j + 1])
            out.append(f"{PH_OPEN}{len(exprs) - 1}{PH_CLOSE}")
            i = j + 1
            continue
        out.append(ch)
        i += 1
    return "".join(out), exprs


def extract_js(path: Path):
    """Return dict of english -> metadata describing where it came from."""
    src = strip_js_noise(path.read_text(encoding="utf-8"))
    found = {}

    # 1) template literals that read as prose
    tpl_re = re.compile(BT + r"((?:\\.|[^" + BT + r"\\])*)" + BT, re.S)
    for m in tpl_re.finditer(src):
        body = m.group(1)
        visible = re.sub(r"\$\{[^}]*\}", " X ", body)
        visible = re.sub(r"<[^>]+>", " ", visible)
        words = re.findall(r"[A-Za-z]{2,}", visible)
        if len(words) < 3:
            continue
        masked, exprs = template_to_placeholder(body)
        found[masked] = {"kind": "template", "exprs": exprs}

    # 2) plain quoted prose
    for m in re.finditer(r'"((?:[^"\\\n]|\\.)*)"', src):
        v = m.group(1)
        if len(v) < 12 or len(re.findall(r"[A-Za-z]{2,}", v)) < 3:
            continue
        if re.search(r"[{};=()]", v):
            continue
        if v.strip() != v and " " not in v.strip():
            continue
        found.setdefault(v, {"kind": "string", "exprs": []})

    return found


def main():
    d = Path(sys.argv[1])
    result = {}
    hf = d / "index.html"
    if hf.exists():
        for t in extract_html(hf):
            result.setdefault(t, {"kind": "html", "exprs": []})
    for name in ("main.js", "app.js"):
        jf = d / name
        if jf.exists():
            for k, meta in extract_js(jf).items():
                result.setdefault(k, meta)
    json.dump(result, sys.stdout, ensure_ascii=False, indent=1)
    print(f"EXTRACTED {len(result)}", file=sys.stderr)


if __name__ == "__main__":
    main()
