"""Post-injection source patches.

Some upstream articles contain latent bugs unrelated to translation. They are
fixed here, after inject.py writes the translated tree, so the fixes survive a
rebuild and are recorded in one place.

Patch 1 — in-context-learning:
    makePrompt(k, V) draws k DISTINCT keys from V possible values using

        do { kIdx = Math.floor(Math.random() * V); } while (used.has(kIdx));

    but computeAccuracyAcrossK sweeps k = 1..12 while the default vocabulary is
    V = 6. For k > V the loop can never succeed and the page hangs forever on
    load. We clamp k to V, which preserves the intended behaviour wherever the
    loop can terminate and unblocks the page otherwise.

Usage:  python patch_src.py
"""
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
BUILD = HERE / "build" / "articles"

ORIGINAL = (
    "  const keys = [], vals = [], seq = [];\n"
    "  const used = new Set();\n"
    "  for (let i = 0; i < k; i++) {\n"
)
PATCHED = (
    "  const keys = [], vals = [], seq = [];\n"
    "  const used = new Set();\n"
    "  // Cannot draw more distinct keys than the vocabulary holds; without\n"
    "  // this clamp the do/while below never terminates when k > V.\n"
    "  k = Math.min(k, V);\n"
    "  for (let i = 0; i < k; i++) {\n"
)


def patch_in_context(build_root: Path) -> bool:
    f = build_root / "in-context-learning" / "main.js"
    if not f.exists():
        print(f"  跳过（文件不存在）: {f}")
        return False
    src = f.read_text(encoding="utf-8")
    if "k = Math.min(k, V);" in src:
        print("  已修复，无需重复")
        return False
    if ORIGINAL not in src:
        print("  未找到预期片段，跳过（源文件可能已变动）")
        return False
    f.write_text(src.replace(ORIGINAL, PATCHED, 1), encoding="utf-8")
    print("  已修复死循环: in-context-learning/main.js")
    return True


# Patch 2 — equivariant-networks:
#   The renderMath block builds LaTeX "T_g^'", which KaTeX rejects
#   ("Expected group after '^'"). The prime belongs directly on the symbol.
#   Upstream bug, present verbatim in the original source.
# In the file the fragment is:
#     T_g^\'\\, f(x)
# KaTeX sees T_g^' and errors ("Expected group after '^'"). The prime must sit
# on the token instead: T_g\'\\, f(x) — the backslash before the apostrophe is
# required because the surrounding JS string is single-quoted.
EQ_BAD = "T_g^\\'\\\\, f(x)"
EQ_FIXED = "T_g\\'\\\\, f(x)"


def patch_equivariant(build_root: Path) -> bool:
    f = build_root / "equivariant-networks" / "main.js"
    if not f.exists():
        print(f"  跳过（文件不存在）: {f}")
        return False
    src = f.read_text(encoding="utf-8")
    if EQ_BAD not in src:
        print("  已修复或片段不存在，跳过")
        return False
    f.write_text(src.replace(EQ_BAD, EQ_FIXED, 1), encoding="utf-8")
    print("  已修复非法 LaTeX: equivariant-networks/main.js")
    return True


def main():
    if not BUILD.exists():
        print(f"构建目录不存在: {BUILD}")
        sys.exit(1)
    print("应用源码补丁 ...")
    patch_in_context(BUILD)
    patch_equivariant(BUILD)
    print("完成")


if __name__ == "__main__":
    main()
