# 翻译规范（学术中文）

你要把 job JSON 里的英文文案翻译成**学术中文**。这是机器学习 / 概率统计 / 计算机科学的教学材料。

## 输入格式

`i18n/jobs/<slug>.json`，结构：

```json
{
 "units": { "<英文原文(含标记)>": {"zh": "", "src": "<原始HTML>", "tags": [...]} },
 "js":    { "<英文原文(含标记)>": {"zh": "", "exprs": [...], "tags": [...]} },
 "meta":  { "title": "...", "tagline": "...", "summary": "...",
            "difficulty": "...", "collection": "...",
            "highlights": [...], "tags": [...] }
}
```

## 你的任务

**只填 `zh` 字段和 `meta` 里的中文字段。不要改任何 key，不要改 `src`/`exprs`/`tags`。**

### 1. `units[*].zh` —— HTML 正文
英文原文里会出现 `@@T0@@`、`@@T1@@` … 这类标记，它们代表 HTML 标签（如 `<sub>`、`<strong>`）。
**必须原样保留每一个 `@@Tn@@`，位置可以按中文语序调整，但一个都不能少、不能改。**

例：
- 输入：`Train a logistic regression on XOR and watch the best possible line fail.`
- 输出：`在 XOR 上训练逻辑回归，观察最优直线如何失效。`
- 输入：`XOR labels: blue where x@@T0@@1@@T1@@ and x@@T2@@2@@T3@@ share a sign, orange where the signs differ.`
- 输出：`XOR 标签：当 x@@T0@@1@@T1@@ 与 x@@T2@@2@@T3@@ 同号时为蓝色，异号时为橙色。`

### 2. `js[*].zh` —— JS 中的界面文案与叙述
英文原文里会出现 `[[[0]]]`、`[[[1]]]` … 标记，代表代码插值（如 `${formatNumber(x)}`）。
**必须原样保留每一个 `[[[n]]]`，数量与编号都不能变。**
可能还含 `@@Tn@@`（HTML 标签），同样原样保留。

例：
- 输入：`plane: [[[0]]][[[1]]][[[2]]] + 0.00u₃ = 0   ·   u₃ has weight 0, so the plane stands vertical`
- 输出：`平面：[[[0]]][[[1]]][[[2]]] + 0.00u₃ = 0   ·   u₃ 权重为 0，故该平面竖直`

### 3. `meta`
- `title` / `tagline` / `summary` / `highlights`：翻成学术中文。
- `collection`：用这些固定的中文名（务必统一）：
  `Deep learning`→`深度学习`，`Computer Vision`/`Computer vision`→`计算机视觉`，
  `Probability & inference`/`Probability and statistics`→`概率与统计推断`，
  `Classical ML`→`经典机器学习`，`Data structures`→`数据结构`，
  `Time series`→`时间序列`，`Multimodal`→`多模态`，
  `Distributed ML`→`分布式机器学习`，`Astronomy`→`天文`。
- `difficulty`：`Beginner`→`入门`，`Intermediate`→`中级`，`Advanced`→`进阶`，
  `Introductory`→`导论`，`Ages 6+`→`6 岁以上`。
- `tags`：术语数组，翻成中文术语（如 `Transformers`→`Transformer`，`Attention`→`注意力机制`）。

## 术语约定（必须遵守）

| 英文 | 中文 |
|---|---|
| gradient descent | 梯度下降 |
| loss function | 损失函数 |
| learning rate | 学习率 |
| decision boundary | 决策边界 |
| logistic regression | 逻辑回归 |
| hidden layer | 隐藏层 |
| activation | 激活 / 激活函数 |
| attention | 注意力机制 |
| embedding | 嵌入 |
| token | 词元 |
| overfitting / underfitting | 过拟合 / 欠拟合 |
| regularization | 正则化 |
| prior / posterior | 先验 / 后验 |
| likelihood | 似然 |
| covariance | 协方差 |
| marginal / conditional | 边缘分布 / 条件分布 |
| eigenvector / eigenvalue | 特征向量 / 特征值 |
| softmax | softmax（不译） |
| logit | logit（不译） |
| bias | 偏置（参数语境）/ 偏差（统计语境） |
| we/you (叙述) | 我们 / 你 |
| canvas / slider / button | 画布 / 滑块 / 按钮 |

## 硬性要求

1. **`@@Tn@@` 和 `[[[n]]]` 一个都不能丢、不能改、不能合并。**
2. 保留数学符号、变量名、公式（如 `ln 2`、`z = 0`、`x₁`、`σ`、`φ` 原样）。
3. 专有名词（XOR、ReLU、softmax、Transformer、KaTeX）保持英文。
4. 代码标识符、CSS 类名、URL 不要翻译。
5. 短标签按 UI 习惯精简（如 `Run`→`运行`，`Reset`→`重置`，`Step`→`步数`）。
6. 语气：严谨、书面、教学化，避免口语。
7. 不要输出任何解释，只改写 JSON 文件本身。

## 自检（必须做）

写完后运行，确认输出为空：

```bash
python i18n/check_job.py i18n/jobs/<slug>.json
```

检查项：所有 `zh` 非空；每个 `zh` 中的 `@@Tn@@` 集合与 key 完全一致；`[[[n]]]` 集合与 key 完全一致。
