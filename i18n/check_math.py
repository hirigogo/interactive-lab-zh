"""Find Chinese glosses placed inside elements that KaTeX renders wholesale.

Some articles wrap display math in a container (class containing "math-block",
or with data-katex-display) and hand its full textContent to KaTeX. Any CJK
inside that container breaks rendering. This reports those cases so the gloss
can be moved out.
"""
import re
from pathlib import Path

BUILD = Path("i18n/build/articles")
CJK = re.compile(r"[\u4e00-\u9fff]")

# containers whose text content is fed to KaTeX
CONTAINER = re.compile(
    r'<div[^>]*class="[^"]*math[^"]*"[^>]*>(.*?)</div>',
    re.S,
)
CONTAINER2 = re.compile(
    r'<div[^>]*data-katex-display[^>]*>(.*?)</div>',
    re.S,
)


def main():
    hits = []
    for f in sorted(BUILD.glob("*/index.html")):
        slug = f.parent.name
        html = f.read_text(encoding="utf-8")
        for pat, name in ((CONTAINER, "class"), (CONTAINER2, "data-attr")):
            for m in pat.finditer(html):
                body = m.group(1)
                # maths delimiters only: if CJK appears outside \text{}, broken
                stripped = re.sub(
                    r"\\(text|mathrm|mathbf|operatorname|texttt)\{[^{}]*\}",
                    " ", body, flags=re.S,
                )
                if CJK.search(stripped):
                    hits.append((slug, name, body.strip()[:150]))

    print(f"数学容器内混入中文: {len(hits)} 处")
    for slug, name, text in hits:
        print(f"  [{name}] {slug}: {text!r}")


if __name__ == "__main__":
    main()
