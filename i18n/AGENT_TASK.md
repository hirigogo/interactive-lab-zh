# 翻译任务（学术中文）

你在为一个静态站点 `Interactive Lab` 做中文本地化。站点是 102 篇交互式机器学习 / 概率统计教学文章。
工作目录：`C:\Users\15505\.zcode\workspace\default`（下称根目录，Git Bash 路径 `/c/Users/15505/.zcode/workspace/default`）。

**先完整读一遍 `i18n/TRANSLATION_GUIDE.md`**，那是术语与格式的硬性规范。以下是流程。

## 环境

Python 需用全路径（PATH 里没有）：

```bash
export PATH="/c/Users/15505/AppData/Local/Programs/Python/Python312:/c/Program Files/nodejs:$PATH"
```

## 每篇文章的流程

假设 slug 是 `attention`：

**第 1 步，查看待翻译内容：**

```bash
python i18n/show_job.py attention
```

输出里每行以 `U|`（HTML 正文）或 `J|`（JS 界面文案）开头，后接 JSON 字符串 —— 那就是英文原文。
`@@T0@@` 代表 HTML 标签，`[[[0]]]` 代表代码插值，**两者都必须原样保留、数量编号不变**。

**第 2 步，写一个翻译映射文件。** 用 Write 工具创建 `i18n/tmp/<slug>.json`：

```json
{
  "units": { "<U| 后面的英文原文>": "<中文>", "...": "..." },
  "js":    { "<J| 后面的英文原文>": "<中文>", "...": "..." },
  "meta":  {
    "title": "...", "tagline": "...", "summary": "...",
    "difficulty": "...", "collection": "...",
    "highlights": ["...", "..."], "tags": ["..."]
  }
}
```

注意：JSON 里的 key 必须与 `show_job.py` 输出的字符串**完全逐字一致**（含空格、换行 `\n`、特殊字符）。
翻译值里的 `@@Tn@@` / `[[[n]]]` 必须与 key 中出现的一一对应。

**第 3 步，合并进 job：**

```bash
python i18n/fill_job.py attention i18n/tmp/attention.json
```

会打印 `applied=N missing=M`。`missing` 非 0 说明有 key 拼错或漏写，回去修正后重跑。

**第 4 步，校验：**

```bash
python i18n/check_job.py i18n/jobs/attention.json
```

必须输出 `OK`（退出码 0）。若报错，逐条修正后回到第 3、4 步，直到通过。

**第 5 步，确认无遗漏：**

```bash
python i18n/show_job.py attention
```

若 `待翻译 0`（units 与 js 都是 0），这篇就完成了。

## 硬性要求

1. **`@@Tn@@` 和 `[[[n]]]` 一个都不能丢、不能改、不能重排编号。**
2. 翻译成**学术书面中文**：严谨、教学化，不用口语，不用「咱们」。
3. 术语严格按 `i18n/TRANSLATION_GUIDE.md` 的对照表。
4. 数学符号、变量名、公式（`ln 2`、`z = 0`、`x₁`、`σ`、`φ`、`$\sqrt{d_k}$`）原样保留。
5. 专有名词保持英文：XOR、ReLU、softmax、logit、Transformer、KaTeX、PyTorch、JAX。
6. 代码标识符、CSS 类名、URL、`data-*` 值不翻译。
7. `meta.collection` 必须用固定译名（见 guide），`meta.difficulty` 同理。
8. 短 UI 标签按界面习惯精简：`Run`→`运行`、`Reset`→`重置`、`Step`→`步数`、`Prelude`→`前言`。

## 重要：不要做的事

- **不要**修改 `ia_src/` 下的任何原始文件。
- **不要**运行 `inject.py`、`build_site.py`、`build_jobs.py` —— 那是主控流程的事，你只负责填 job 文件。
- **不要**自己写 Python 脚本去批量替换，逐条翻译才能保证质量。
- 有些条目本身是代码（如 `[data-view]`、`use strict`），若发现明显不该翻译的，**跳过它**（保持 `zh` 为空），并在最终报告中列出。这类条目很少。

## 最终报告

所有分配的文章都通过 `check_job.py` 后，报告：
- 完成的 slug 列表
- 每篇 `applied` 条数
- 你跳过的任何条目及原因
