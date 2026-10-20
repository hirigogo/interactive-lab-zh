"""Inject translated Chinese back into the article sources.

Reads i18n/jobs/<slug>.json, and for each filled entry rewrites:
  - src/articles/<slug>/index.html   (text units + attributes)
  - src/articles/<slug>/meta.json    (title, tagline, summary, highlights, ...)
  - src/articles/<slug>/main.js / app.js  (template literals + strings)

Everything is matched on the ORIGINAL english form, so re-running is
idempotent and a partial translation file only rewrites what it has.

Writes into a PARALLEL tree (i18n/build/) by default so the originals stay
pristine; pass --in-place to overwrite src/ instead.

Usage:
  python inject.py [--in-place]
"""
import json
import re
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from segment import unlock_tags, UNIT_TAG_RE  # noqa: E402
from extract import BT, PH_OPEN, PH_CLOSE  # noqa: E402

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent / "ia_src"
ART = ROOT / "src" / "articles"
JOBS = HERE / "jobs"


def apply_units(raw: str, units: dict) -> tuple[str, int]:
    """Replace each english HTML slice with its Chinese counterpart.

    Units are matched on their original HTML text (stored as `src`). We go
    longest-first so a shorter unit can never clobber part of a longer one.
    """
    pairs = []
    for eng, meta in units.items():
        if isinstance(meta, dict):
            zh = meta.get("zh")
            original = meta.get("src", eng)
            tags = meta.get("tags", [])
        else:  # tolerate the older flat format
            zh, original, tags = meta, eng, []
        if zh and zh != eng:
            # put the real tags back before writing
            pairs.append((original, unlock_tags(zh, tags)))

    applied = 0
    for original, zh in sorted(pairs, key=lambda p: -len(p[0])):
        if original in raw:
            raw = raw.replace(original, zh)
            applied += 1
    return raw, applied


def restore_exprs(text: str, exprs) -> str:
    for i, e in enumerate(exprs):
        text = text.replace(f"{PH_OPEN}{i}{PH_CLOSE}", e)
    return text


def js_escape(text: str, quote: str) -> str:
    """Escape a translated string so it stays a valid JS literal.

    The original literal's delimiter is known (``'`` or ``"``), so we escape
    that character (and backslashes/newlines) rather than changing quotes.
    Chinese text rarely contains these, but apostrophes do appear.
    """
    text = text.replace("\\", "\\\\")
    text = text.replace("\n", "\\n").replace("\r", "\\r")
    if quote == "'":
        text = text.replace("'", "\\'")
    else:
        text = text.replace('"', '\\"')
    return text


def detect_quote(src: str, needle: str):
    """Find which quote character delimits `needle` in `src`."""
    for q in ("'", '"'):
        if f"{q}{needle}{q}" in src:
            return q
    return None


def main():
    in_place = "--in-place" in sys.argv
    dest = ART if in_place else (HERE / "build" / "articles")
    if not in_place:
        if (HERE / "build").exists():
            shutil.rmtree(HERE / "build")
        (HERE / "build").mkdir(parents=True)
        shutil.copytree(ROOT / "src" / "shared", HERE / "build" / "shared")
        dest.mkdir(parents=True, exist_ok=True)

    stats = {"html": 0, "meta": 0, "js": 0, "articles": 0}
    for job_file in sorted(JOBS.glob("*.json")):
        job = json.loads(job_file.read_text(encoding="utf-8"))
        slug = job["slug"]
        src_dir = ART / slug
        dst_dir = dest / slug
        if not in_place:
            shutil.copytree(src_dir, dst_dir)

        # ---- HTML ----
        n_html = 0
        hf = dst_dir / "index.html"
        if hf.exists() and job["units"]:
            raw = hf.read_text(encoding="utf-8")
            new, applied = apply_units(raw, job["units"])
            hf.write_text(new, encoding="utf-8")
            n_html = applied
            stats["html"] += applied

        # ---- meta.json ----
        n_meta = 0
        mf = dst_dir / "meta.json"
        if mf.exists() and job.get("meta"):
            meta = json.loads(mf.read_text(encoding="utf-8"))
            t = job["meta"]
            for key in ("title", "tagline", "summary",
                        "difficulty", "collection"):
                if t.get(key):
                    if t[key] != meta.get(key):
                        n_meta += 1
                    meta[key] = t[key]
            for listkey in ("highlights", "tags"):
                src_list = t.get(listkey)
                if isinstance(src_list, list) and any(src_list):
                    merged = [
                        (zh if zh else en)
                        for en, zh in zip(meta.get(listkey, []), src_list)
                    ]
                    # lengths should match; if not, take non-empty entries
                    if len(merged) == len(meta.get(listkey, [])):
                        meta[listkey] = merged
                        n_meta += sum(1 for z in src_list if z)
            mf.write_text(
                json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            stats["meta"] += n_meta

        # ---- JS ----
        n_js = 0
        for name in ("main.js", "app.js"):
            jf = dst_dir / name
            if not jf.exists() or not job.get("js"):
                continue
            src = jf.read_text(encoding="utf-8")
            for eng, meta in sorted(job["js"].items(), key=lambda kv: -len(kv[0])):
                if not isinstance(meta, dict):
                    continue
                zh = meta.get("zh")
                original = meta.get("src", eng)
                if not zh or zh == eng:
                    continue
                if original not in src:
                    continue
                # rebuild the translated body: restore tags, then ${...}
                zh_full = unlock_tags(zh, meta.get("tags", []))
                zh_full = restore_exprs(zh_full, meta.get("exprs", []))
                # For plain string literals (no interpolation), keep the JS
                # valid by escaping according to the original delimiter.
                if not meta.get("exprs"):
                    q = detect_quote(src, original)
                    if q:
                        zh_full = js_escape(zh_full, q)
                src = src.replace(original, zh_full)
                n_js += 1
            jf.write_text(src, encoding="utf-8")
            stats["js"] += n_js

        stats["articles"] += 1
        if n_html or n_meta or n_js:
            print(f"{slug:>32}  html={n_html:<4} meta={n_meta:<3} js={n_js}")

    print(f"\n完成: {stats}")
    if not in_place:
        print(f"输出目录: {dest.parent}")


if __name__ == "__main__":
    main()
