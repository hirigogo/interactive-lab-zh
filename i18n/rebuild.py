"""Rebuild the whole Chinese site: inject -> build -> verify.

Usage:  python rebuild.py
"""
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
PY = sys.executable


def run(script, label):
    print(f"\n=== {label} ===")
    r = subprocess.run(
        [PY, str(HERE / script)],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
    )
    out = (r.stdout or "") + (r.stderr or "")
    tail = [l for l in out.splitlines() if l.strip()][-6:]
    for l in tail:
        print("  " + l)
    if r.returncode != 0:
        print(f"  [失败] {script} 退出码 {r.returncode}")
        return False
    return True


def main():
    ok = run("inject.py", "1/4 注入译文")
    ok = run("patch_src.py", "2/4 应用源码补丁") and ok
    ok = run("build_site.py", "3/4 构建站点") and ok
    ok = run("verify_all.py", "4/4 校验") and ok
    print("\n完成。" if ok else "\n有失败项，请检查上面的输出。")


if __name__ == "__main__":
    main()
