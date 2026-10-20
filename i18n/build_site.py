"""Build the Chinese site into site/ from the translated article tree.

Differs from upstream build.js in that:
  - it reads i18n/build/articles/ (translated) instead of src/articles/
  - the homepage shell, tagline and footer are in Chinese
  - collection ordering keeps the upstream "pinned" groups but by Chinese name

Usage:  python build_site.py
"""
import json
import re
import shutil
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
SRC = HERE / "build" / "articles"
OUT = ROOT / "site"
KATEX = ROOT / "ia_src" / "node_modules" / "katex" / "dist"
SHARED = ROOT / "ia_src" / "src" / "shared"

SITE_TITLE = "交互式实验室"
SITE_DESC = (
    "面向机器学习、概率统计及其底层系统的讲解式交互文章。"
    "以具体例子入手，辅以可实时操作的图表，形式化数学只在必要时才出现。"
)
FOOTER = "这些交互式讲解是为「动手操作」而设计，而非供静态浏览的笔记。"

PINNED = ["深度学习", "计算机视觉", "多模态", "概率与统计推断", "时间序列"]

ROW = """
      <li class="ix-row">
        <a class="ix-row-link" href="{url}">
          <span class="ix-row-title">{title}</span>
          <span class="ix-row-tag">{tag}</span>
          <span class="ix-row-meta">
            {time}{date}
          </span>
        </a>
      </li>"""


def esc(t: str) -> str:
    return (
        str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
        .replace('"', "&quot;").replace("'", "&#39;")
    )


def load_articles():
    arts = []
    for d in sorted(SRC.iterdir()):
        if not d.is_dir():
            continue
        mf = d / "meta.json"
        if not mf.exists():
            continue
        m = json.loads(mf.read_text(encoding="utf-8"))
        m["slug"] = d.name
        m["url"] = f"{d.name}/"
        arts.append(m)
    arts.sort(key=lambda a: a.get("order", 999))
    return arts


def render_list(articles):
    groups = {}
    for a in articles:
        groups.setdefault(a.get("collection") or "其他", []).append(a)

    names = sorted(
        groups,
        key=lambda c: (PINNED.index(c) if c in PINNED else 99, c),
    )

    out = []
    for col in names:
        items = sorted(
            groups[col],
            key=lambda a: a.get("date") or "",
            reverse=True,
        )
        rows = []
        for a in items:
            tag = (a.get("tagline") or a.get("summary") or "")[:110]
            time_txt = (
                f'<span>{esc(a["readingTime"])}</span>'
                if a.get("readingTime") else ""
            )
            date_txt = (
                f'<span class="ix-row-date">{esc(a["date"])}</span>'
                if a.get("date") else ""
            )
            rows.append(ROW.format(
                url=esc(a["url"]), title=esc(a["title"]), tag=esc(tag),
                time=time_txt, date=date_txt,
            ))
        out.append(
            f'\n      <section class="ix-collection">\n'
            f'        <h2 class="ix-collection-title">{esc(col)} '
            f'<span class="ix-collection-count">{len(items)}</span></h2>\n'
            f'        <ul class="ix-list">{"".join(rows)}\n        </ul>\n'
            f'      </section>'
        )
    return "\n".join(out)


HOME_CSS = """
      .simple-shell { max-width: 920px; margin: 0 auto; padding: 3rem 1.5rem 5rem; }
      .simple-header { margin-bottom: 3rem; text-align: center; }
      .simple-header h1 { font-family: var(--font-serif); font-size: clamp(2.2rem, 4.5vw, 3rem);
        margin: 0 0 0.6rem; color: var(--ink); letter-spacing: -0.02em; line-height: 1.1; }
      .simple-header p { font-size: 1.05rem; color: var(--muted); max-width: 640px;
        margin: 0 auto; line-height: 1.7; }
      .ix-collection { margin: 2.4rem 0; }
      .ix-collection-title { font-family: var(--font-serif); font-size: 1.05rem; margin: 0 0 0.7rem;
        font-weight: 600; letter-spacing: 0.02em; color: var(--ink); display: flex;
        align-items: center; gap: 0.6rem; border-bottom: 1px solid var(--border); padding-bottom: 0.45rem; }
      .ix-collection-count { font-family: var(--font-mono, 'IBM Plex Mono', monospace); font-size: 0.78rem;
        color: var(--muted); background: var(--panel-soft); border: 1px solid var(--border);
        padding: 0.05rem 0.5rem; border-radius: 999px; font-weight: 500; }
      .ix-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 0; }
      .ix-row { margin: 0; }
      .ix-row-link { display: grid; grid-template-columns: 1.4fr 2.2fr auto; gap: 1rem;
        align-items: baseline; padding: 0.7rem 0.6rem; border-radius: 6px; text-decoration: none;
        color: var(--ink); transition: background 120ms ease; border-bottom: 1px solid rgba(0,0,0,0.04); }
      .ix-row-link:hover { background: rgba(44, 111, 183, 0.05); }
      .ix-row-title { font-family: var(--font-serif); font-weight: 600; font-size: 1rem; color: var(--ink); }
      .ix-row-tag { font-size: 0.92rem; color: var(--muted); line-height: 1.5; font-family: var(--font-serif); }
      .ix-row-meta { display: flex; gap: 0.7rem; font-family: var(--font-mono, 'IBM Plex Mono', monospace);
        font-size: 0.74rem; color: var(--muted); white-space: nowrap; text-align: right; justify-content: flex-end; }
      .ix-row-date { opacity: 0.7; }
      @media (max-width: 720px) {
        .ix-row-link { grid-template-columns: 1fr; gap: 0.25rem; }
        .ix-row-meta { justify-content: flex-start; }
      }
      .simple-footer { margin-top: 4rem; text-align: center; color: var(--muted); font-size: 0.9rem;
        border-top: 1px solid var(--border); padding-top: 1.5rem; }
"""


def render_home(articles):
    return f"""<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{esc(SITE_TITLE)}</title>
    <meta name="description" content="{esc(SITE_DESC)}" />
    <link rel="stylesheet" href="assets/site.css" />
    <style>{HOME_CSS}    </style>
  </head>
  <body>
    <main class="simple-shell">
      <header class="simple-header">
        <h1>{esc(SITE_TITLE)}</h1>
        <p>{esc(SITE_DESC)}</p>
      </header>
{render_list(articles)}
      <footer class="simple-footer">
        <p>{esc(FOOTER)}</p>
      </footer>
    </main>
  </body>
</html>"""


KATEX_SNIPPET = """
    <!-- katex-auto-render -->
    <script defer src="../vendor/katex/contrib/auto-render.min.js"></script>
    <script>
      document.addEventListener('DOMContentLoaded', function () {
        var go = function () {
          if (!window.renderMathInElement) { setTimeout(go, 50); return; }
          renderMathInElement(document.body, {
            delimiters: [
              { left: '$$', right: '$$', display: true },
              { left: '\\\\[', right: '\\\\]', display: true },
              { left: '$', right: '$', display: false },
              { left: '\\\\(', right: '\\\\)', display: false }
            ],
            throwOnError: false,
            ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code', 'option']
          });
        };
        go();
      });
    </script>
  </body>"""


def main():
    if OUT.exists():
        shutil.rmtree(OUT)
    OUT.mkdir(parents=True)
    (OUT / "assets").mkdir()
    (OUT / "vendor").mkdir()

    shutil.copy2(SHARED / "site.css", OUT / "assets" / "site.css")
    if KATEX.exists():
        shutil.copytree(KATEX, OUT / "vendor" / "katex")
    else:
        print("警告: 未找到 KaTeX，公式将无法渲染")

    articles = load_articles()
    for a in articles:
        dst = OUT / a["slug"]
        shutil.copytree(SRC / a["slug"], dst)
        idx = dst / "index.html"
        if idx.exists():
            html = idx.read_text(encoding="utf-8")
            html = html.replace('<html lang="en"', '<html lang="zh-CN"')
            if "<!-- katex-auto-render -->" not in html and "</body>" in html:
                html = html.replace("</body>", KATEX_SNIPPET)
            idx.write_text(html, encoding="utf-8")

    (OUT / ".nojekyll").write_text("")
    (OUT / "index.html").write_text(render_home(articles), encoding="utf-8")
    print(f"构建完成: {len(articles)} 篇文章 -> {OUT}")


if __name__ == "__main__":
    main()
