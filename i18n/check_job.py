"""Validate a filled translation job.

Checks, for every entry:
  - zh is non-empty and differs from the English
  - the set of @@Tn@@ markers in zh matches the key exactly
  - the set of [[[n]]] markers in zh matches the key exactly
  - meta fields are filled and collection/difficulty use the agreed glossary

Usage:  python check_job.py <job.json> [<job.json> ...]
Exit code 0 = all good.
"""
import json
import re
import sys
from pathlib import Path

TAG_RE = re.compile(r"@@T\d+@@")
EXPR_RE = re.compile(r"\[\[\[\d+\]\]\]")

COLLECTIONS = {
    "深度学习", "计算机视觉", "概率与统计推断", "经典机器学习", "数据结构",
    "时间序列", "多模态", "分布式机器学习", "天文",
}
DIFFICULTY = {"入门", "中级", "进阶", "导论", "6 岁以上"}

# Keys that are code, not prose, and must NOT be translated. Detection lives in
# codekeys.py so the extractor, validator and repair pass all agree.
sys.path.insert(0, str(Path(__file__).resolve().parent))
from codekeys import is_code_key as _shared_is_code_key  # noqa: E402
from codekeys import keep_english as _keep_english  # noqa: E402

# Class-name lists that are indistinguishable from prose by shape alone.
CODE_KEYS_EXACT = {
    "patch-detail patch-detail-empty",
    "seq-token pos",
    "readout readout--reduction",
}


def is_code_key(key: str) -> bool:
    key = key.strip()
    # Markers mean prose-with-interpolation usually, but a tagged key can also
    # be a pure formula or proper noun ("@@T0@@Stan@@T1@@"). So strip the
    # markers and classify both the raw and stripped forms; the classifier only
    # fires on code/notation shapes, so ordinary prose is not affected.
    stripped = TAG_RE.sub(" ", EXPR_RE.sub(" ", key)).strip()
    return (
        _shared_is_code_key(key)
        or _shared_is_code_key(stripped)
        or key in CODE_KEYS_EXACT
    )


def may_stay_english(key: str) -> bool:
    """Keys that are correct as English: code, terms, or sample inputs.

    These are exempt from "must be translated". The value may be empty (inject
    skips it) or identical to the key.
    """
    key = key.strip()
    stripped = TAG_RE.sub(" ", EXPR_RE.sub(" ", key)).strip()
    return (
        is_code_key(key)
        or _keep_english(key)
        or _keep_english(stripped)
    )


def markers(text: str, pat):
    return sorted(set(pat.findall(text)))


def check(path: Path):
    job = json.loads(path.read_text(encoding="utf-8"))
    errs = []
    for section in ("units", "js"):
        for key, meta in job.get(section, {}).items():
            if not isinstance(meta, dict):
                errs.append(f"{section}: 旧格式条目 {key[:40]!r}")
                continue
            zh = meta.get("zh", "")
            # Code keys and English-kept terms are exempt: leaving them
            # untranslated (empty) or identical to the source is correct.
            if may_stay_english(key):
                continue
            if not zh.strip():
                errs.append(f"{section}: 未翻译 {key[:50]!r}")
                continue
            if zh.strip() == key.strip():
                errs.append(f"{section}: 与原文相同 {key[:50]!r}")
            if markers(zh, TAG_RE) != markers(key, TAG_RE):
                errs.append(
                    f"{section}: 标签标记不匹配 {key[:40]!r} "
                    f"key={markers(key, TAG_RE)} zh={markers(zh, TAG_RE)}"
                )
            if markers(zh, EXPR_RE) != markers(key, EXPR_RE):
                errs.append(
                    f"{section}: 插值标记不匹配 {key[:40]!r} "
                    f"key={markers(key, EXPR_RE)} zh={markers(zh, EXPR_RE)}"
                )

    meta = job.get("meta", {})
    for key in ("title", "tagline", "summary"):
        if not meta.get(key):
            errs.append(f"meta: 缺少 {key}")
    if meta.get("collection") and meta["collection"] not in COLLECTIONS:
        errs.append(f"meta: collection 不符合术语表 {meta['collection']!r}")
    if meta.get("difficulty") and meta["difficulty"] not in DIFFICULTY:
        errs.append(f"meta: difficulty 不符合术语表 {meta['difficulty']!r}")
    for i, h in enumerate(meta.get("highlights", []) or []):
        if not h or re.search(r"[a-zA-Z]{4,} [a-zA-Z]{3,} [a-zA-Z]{3,}", h):
            errs.append(f"meta: highlights[{i}] 疑似未翻译")

    return errs


def main():
    total_errs = 0
    for arg in sys.argv[1:]:
        p = Path(arg)
        errs = check(p)
        total_errs += len(errs)
        status = "OK" if not errs else f"{len(errs)} 个问题"
        print(f"{p.stem:>34}  {status}")
        for e in errs[:8]:
            print(f"     - {e}")
        if len(errs) > 8:
            print(f"     ... 另有 {len(errs) - 8} 个")
    sys.exit(1 if total_errs else 0)


if __name__ == "__main__":
    main()
