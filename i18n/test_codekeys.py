import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from codekeys import is_code_key

# Every real case reported across the 10 batches.
CODE = [
    "tr[data-idx]", "[data-view]", "section[id]", "use strict", "app.js",
    "ledger-row ledger-row--header", "module-list__item",
    "node-sub batch-axis-label", "node-sub batch-chart-note",
    "svg.tsa-graph", "patch-detail patch-detail-empty",
    "char-cell--mask/pad/char/question/sep/answer",
    "vector-cell vector-cell--pos", "vector-cell vector-cell--neg",
    " is-active",
    "pe-T-val", "mh-heatA", "mh-heatB", "hm-multi-[[[0]]]",
    "rollout-L", "rollout-L-val", "sin-L-val", "sin-D-val", "ali-L-val",
    "kd-T-val", "scan-N-val", "ppl-flipH", "ppl-flipT", "ppl-runHMC",
    "act-L-val", "train-L-val", "dd-N-val", "sw-P-val",
    "sim-viewA", "sim-viewB",
    "repeat([[[0]]], minmax(0, 1fr))", "repeat([[[0]]], auto)",
    "auto repeat([[[0]]], minmax(0, 1fr))",
    "11px Manrope, sans-serif", "700 12px Avenir Next, Segoe UI, sans-serif",
    "nn.Linear", "from peft import LoraConfig, get_peft_model",
    "Xenova/clip-vit-base-patch32", "application/json",
    "autograd-stage-[[[0]]].json",
    "a photo of a [[[0]]]", "a picture of a [[[0]]]", "an image of a [[[0]]]",
    "RBF", "GRU", "LSTM", "Adam", "Stan", "PyMC", "NumPyro", "JAX",
    "PyTorch", "TensorFlow", "Turing.jl", "FedAvg", "FedProx", "SCAFFOLD",
    "PagedAttention", "SatMAE", "HLS", "max_depth", "Adam / AdamW",
    "L-BFGS", "K-FAC / Shampoo", "CMA-ES", "SPSA",
    "exp(score)", "log_softmax", "softmax", "BCE",
    "L = max(z, 0) - z·y + log(1 + exp(-|z|))",
    "log p_k = z_k - log Σⱼ exp(zⱼ) = z_k - LSE(z)",
    "h = (1−z)·h_prev + z·h̃", "c = f·c_prev + i·g;  h = o·tanh(c)",
    "ε_CFG = ε_θ(x_t, ∅) + w · (ε_θ(x_t, c) − ε_θ(x_t, ∅))",
    "Logit $z$ = -30", "true", "false", "none",
    "the quick brown fox jumps over the lazy dog",
]

PROSE = [
    "active strategy", "water-side bank", "best so far", "Step 1", "Prelude",
    "Run", "Reset", "Next question", "Can one straight line separate XOR?",
    "Branch and bound", "the cat sat on", "What the pictures prove",
    "Two-mode Gaussian", "Hidden function", "Sample size n", "the cat",
    "Full Moon", "Waxing Crescent", "Ordinary phase", "Lunar eclipse",
    "Score: 0", "Seven of nine", "A decoy feature", "one hidden neuron",
    "Before any attention runs", "Read it like a table", "Quick proof",
]

bad = []
for t in CODE:
    if not is_code_key(t):
        bad.append(("应判为代码但未识别", t))
for t in PROSE:
    if is_code_key(t):
        bad.append(("应判为文案但被误判", t))

print(f"代码样本 {len(CODE)}，文案样本 {len(PROSE)}")
print(f"不符预期: {len(bad)}\n")
for kind, t in bad:
    print(f"  [{kind}] {t!r}")
