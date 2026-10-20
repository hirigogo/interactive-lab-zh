"""Full verification after translation: check JS syntax on every article.

Pipeline stages that matter for correctness:
  1. every job passes check_job.py (markers intact)
  2. inject.py rebuilds i18n/build/
  3. node --check on every translated .js  (catches broken string literals)
  4. build_site.py produces site/

Usage:  python verify_all.py
"""
import json
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
NODE = r"C:\Program Files\nodejs\node.exe"


def js_syntax_errors(dirpath: Path):
    errs = []
    for js in sorted(dirpath.rglob("*.js")):
        r = subprocess.run(
            [NODE, "--check", str(js)],
            capture_output=True, text=True, encoding="utf-8", errors="replace",
        )
        if r.returncode != 0:
            errs.append((js, (r.stderr or "").strip()[:400]))
    return errs


def main():
    jobs = sorted((HERE / "jobs").glob("*.json"))
    print(f"1) 检查 {len(jobs)} 个 job ...")
    sys.path.insert(0, str(HERE))
    from check_job import may_stay_english  # noqa: E402

    incomplete = []
    for f in jobs:
        d = json.loads(f.read_text(encoding="utf-8"))
        miss = 0
        for section in ("units", "js"):
            for k, v in d[section].items():
                if not v["zh"] and not may_stay_english(k):
                    miss += 1
        if miss:
            incomplete.append((f.stem, miss))
    if incomplete:
        print(f"   未完成 {len(incomplete)} 篇:")
        for slug, n in incomplete[:20]:
            print(f"     {slug}: 缺 {n}")
    else:
        print("   全部完成 ✓（代码键按设计留空，不计入）")

    print("2) 校验标记完整性 ...")
    r = subprocess.run(
        [sys.executable, str(HERE / "check_job.py"), *[str(j) for j in jobs]],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    bad = [l for l in r.stdout.splitlines() if "OK" not in l and l.strip()]
    print(f"   check_job 退出码 {r.returncode}")
    for l in bad[:30]:
        print("   " + l)

    print("3) 检查已翻译 JS 语法 ...")
    errs = js_syntax_errors(HERE / "build" / "articles")
    if errs:
        print(f"   语法错误 {len(errs)} 个:")
        for js, e in errs[:15]:
            print(f"     {js.relative_to(ROOT)}: {e.splitlines()[0][:120]}")
    else:
        print("   全部通过 ✓")

    print("4) 检查生成站点 ...")
    site = ROOT / "docs"
    if site.exists():
        n = len([d for d in site.iterdir() if d.is_dir()])
        print(f"   docs/ 存在，{n} 个目录")
    else:
        print("   docs/ 尚未生成")


if __name__ == "__main__":
    main()
