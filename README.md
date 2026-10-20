# 交互式实验室 · 中文版

这是 [nipunbatra/interactive-articles](https://github.com/nipunbatra/interactive-articles)
（站点名 *Interactive Lab*）的完整中文本地化版本。原站是 102 篇交互式机器学习 /
概率统计 / 计算机科学教学文章，每篇都是一个可拖动滑块、点击按钮、实时看到数字变化的
单页实验。本项目把全部 102 篇的正文、界面文案和元数据翻译为学术中文，并修好了两处
原站自带的 bug。

## 怎么打开

**双击 `启动.cmd`** 即可。它会启动本地服务器并自动打开浏览器（默认
<http://localhost:4173>），关闭弹出的黑色命令行窗口即可停止。

或者手动启动：

```bash
python -m http.server 4173 --directory site
```

然后浏览器访问 <http://localhost:4173>。

> 为什么必须用服务器、不能直接双击 HTML？因为页面之间用相对路径互相引用
> （`href="attention/"`、`../vendor/katex/...`）。`file://` 方式打开时浏览器
> 无法正确解析这些路径，会导致样式丢失、公式渲染失败。

## 目录结构

```
site/               生成好的中文站点（可直接用浏览器打开，这就是成品）
启动.cmd            一键启动脚本
ia_src/             上游英文原仓库（未改动，作为参照与构建依赖）
i18n/               本地化流水线
  jobs/             每篇文章的翻译任务文件（英文 key → 中文 zh）
  tmp/              各篇文章的翻译映射中间产物
  build/            注入译文后的文章源码树（site/ 由此构建）
  codekeys.py       「哪些是代码、不应翻译」的统一判定
  extract.py        从 HTML/JS 抽取可翻译文本
  build_jobs.py     生成翻译任务（extract 的封装）
  segment.py        HTML 分句与标签加锁
  inject.py         把译文写回源码树
  build_site.py     构建 site/
  patch_src.py      修复上游 bug
  check_job.py      校验单篇翻译
  check_math.py     校验公式块内是否混入中文
  verify_all.py     全站校验
  rebuild.py        一键：注入 → 打补丁 → 构建 → 校验
```

## 重新构建

改动 `i18n/jobs/*.json` 里的译文后，运行：

```bash
python i18n/rebuild.py
```

它会依次执行注入译文、应用源码补丁、构建站点、全站校验四步。
注意：构建前需先停掉正在运行的服务器（Windows 会锁定 `site/` 目录）。

## 翻译是怎么做的

原站正文 2.18 MB，且文案与 JavaScript 代码混杂。做法是：

1. **抽取**：用 HTML 解析把句子按块级元素切分，行内标签（`<sub>`、`<strong>` 等）
   替换为 `@@T0@@` 占位符；JS 模板串里的代码插值（`${...}`）替换为 `[[[0]]]`。
   这样译者只看到自然语言，代码不会被误改。
2. **翻译**：逐条译为学术中文，标记原样保留。
3. **注入**：按原文精确匹配替换，还原标签与插值。
4. **校验**：比对标记集合、检查 JS 语法、检查公式块、整站浏览器加载。

判定「哪些不该翻译」的逻辑集中在 `i18n/codekeys.py`，覆盖 CSS 类名、DOM id、
选择器、代码块、纯公式、专有名词等。

## 与原站的差异

除翻译外，修了两处**原站自带**的 bug（见 `i18n/patch_src.py`）：

- **`in-context-learning` 页面无法打开**：`makePrompt(k, V)` 从 `V` 个值里取 `k` 个
  互不相同的键，但精度曲线会把 `k` 扫到 12，而默认词表 `V = 6`，于是
  `do { … } while (used.has(kIdx))` 永远无法退出，页面加载时死循环。
  已加入 `k = Math.min(k, V)` 钳制。
- **`equivariant-networks` 公式渲染报错**：源码里写成 `T_g^'`，KaTeX 无法解析
  （`Expected group after '^'`）。已改为 `T_g'`。

原仓库 `ia_src/` 未做任何修改，两处修复都只作用于构建产物。

## 已知限制

- 4 篇原本标记为 `draft` 的文章也一并翻译并发布了。
- 极少数纯截图/外部模型页面（依赖 TensorFlow.js 在线加载的视觉识别类文章）
  需要联网才能显示模型推理结果，其余交互全部离线可用。
