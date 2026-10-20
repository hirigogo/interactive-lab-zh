"""Shared classification of "this key is code, not prose".

Both the extractor (so these never enter the job) and the validator (so they are
exempt if they do) import this. Keeping one definition avoids the situation
where a translator is forced to alter code to satisfy a checker.

A key is CODE when it is any of:
  - an attribute/CSS selector:      [data-view], tr[data-idx], section[id]
  - a CSS class or BEM name:        ledger-row--header, module-list__item,
                                    patch-detail patch-detail-empty
  - a DOM element id used in JS:    pe-T-val, rollout-L, sin-D-val, pp-flipH
  - a CSS function / font string:   repeat(..., 1fr), 11px Manrope, sans-serif
  - a file name:                    app.js, meta.json
  - a dotted API name:              nn.Linear, svg.tsa-graph
  - a code block:                   from peft import LoraConfig, with model:
  - a LaTeX-only string (no words): \\[ ... \\], $1 \\times 4$
  - a bare acronym / short symbol:  RBF, GRU, LSTM, Adam, Stan, PyMC
"""
import re

# --- selectors and attributes ---
ATTR_SEL = re.compile(r"^[\w-]*\[[\w-]+\]")            # [data-x], tr[data-idx]
DOTTED_SEL = re.compile(r"^[a-z][\w-]*\.[\w-]+$")      # svg.tsa-graph

# --- BEM / CSS class shapes (never prose) ---
BEM = re.compile(r"[\w-]+(__|--)[\w-]+")               # x__item, x--mod
CLASS_RUN = re.compile(r"^[a-z][\w-]*(\s+[a-z][\w-]*)+$")  # "a-b c-d"

# --- CSS values / fonts ---
CSS_FUNC = re.compile(r"(^|\s)(repeat|minmax|calc|var|rgba?|hsla?)\(|^\s*auto\s+repeat\(")
FONTISH = re.compile(r"\d+px|\d+\s+px|sans-serif|monospace|\bserif\b")

# --- files, ids, api names ---
FILENAME = re.compile(r"^[\w.-]+\.(js|css|json|html|svg|png|txt|csv)$")
# short kebab id ending in a known suffix used for DOM nodes
DOM_ID = re.compile(
    r"^[a-z]{1,5}-[A-Za-z][\w-]*$"          # pe-T-val, mh-heatA
    r"|^[a-z][\w-]*-\[\[\[\d+\]\]\]$"       # hm-multi-[[[0]]]
    r"|^[a-z]{1,6}-[a-z]{1,3}$"             # rollout-L, sin-D
)
APIISH = re.compile(r"^[A-Za-z_]\w*\.[A-Za-z_]\w*$")  # nn.Linear

# --- code blocks ---
CODE_BLOCK = re.compile(
    r"^\s*(from\s+\w+\s+import|import\s+\w|def\s|class\s|with\s+\w|"
    r"for\s+\w+\s+in\s|if\s+__name__|print\(|return\s|@\w+\()"
)

# --- LaTeX / maths with no English word ---
LATEX_BLOCK = re.compile(r"^\s*(\\\[|\\\(|\$\$)")
# a display-math block delimited by \[ ... \] anywhere in the key
LATEX_DISPLAY = re.compile(r"\\\[.*\\\]", re.S)
LATEX_CMD = re.compile(r"\\[a-zA-Z]{2,}")

# a proper noun of the form Word or Word2 / Word3 joined by slash, no
# lowercase English word (PyTensor / JAX, Edward2 / TFP)
PROPER_PAIR = re.compile(r"^[\w.]+(\s*/\s*[\w.]+)+$")

# --- bare acronyms / short proper nouns kept in English ---
# A single capitalized or all-caps token with no lowercase run of 3+ letters
# and no spaces. Catches RBF, GRU, LSTM, JAX, Stan, PyMC, PyTorch, TensorFlow.
BRAND = re.compile(r"^[A-Za-z][A-Za-z0-9.+]*$")

# Common short English words that look like acronyms but are real UI labels.
SHORT_WORDS = {
    "run", "step", "next", "back", "play", "stop", "start", "reset", "top",
    "orbit", "edge", "full", "new", "lost", "yes", "no", "more", "less",
    "hide", "show", "open", "close", "save", "load", "prev", "none", "all",
    "word", "words", "image", "images", "text", "label", "labels", "score",
    "layer", "layers", "input", "output", "model", "models", "data", "true",
    "false", "null", "none", "one", "two", "three", "four", "five", "still",
    "wait", "done", "ready", "live", "click", "drag", "zoom", "note", "note",
}

# Directives that are code.
DIRECTIVE = {"use strict", "use asm"}

# Notation characters that signal maths/notation rather than prose.
MATH_CHARS = re.compile(r"[=+*/^_{}\\|<>≤≥−·×√∫∑∏∂∇]|\)\s*$|^\s*\(")

# Words that are clearly CSS/HTML vocabulary, so a hyphen/kebab string made of
# them is a class name, not prose.
CSS_WORDS = {
    "node", "sub", "batch", "axis", "label", "chart", "title", "note", "cell",
    "mask", "pad", "char", "question", "sep", "answer", "row", "header",
    "item", "list", "module", "detail", "patch", "empty", "token", "pos",
    "graph", "chip", "wrap", "grid", "panel", "bar", "dot", "line", "val",
    "btn", "icon", "card", "head", "body", "main", "left", "right", "top",
    "bottom", "small", "large", "full", "half", "active", "hidden", "focus",
}


def _english_words(text: str) -> int:
    """Count English words after stripping maths, tags and interpolations."""
    t = re.sub(r"@@T\d+@@|\[\[\[\d+\]\]\]", " ", text)
    t = re.sub(r"\$\$?.+?\$\$?", " ", t, flags=re.S)
    # \text{...} / \mathrm{...} inside maths: the words there are part of the
    # formula, not prose to translate independently.
    t = re.sub(r"\\(text|mathrm|mathbf|operatorname)\{[^}]*\}", " ", t)
    t = re.sub(r"\\[a-zA-Z]+", " ", t)
    t = re.sub(r"&[a-zA-Z]+;|&#\d+;", " ", t)
    t = re.sub(r"<[^>]+>", " ", t)
    return len(re.findall(r"[A-Za-z]{3,}", t))


def is_code_key(key: str) -> bool:
    """True when this key is code and must be left untranslated."""
    k = key.strip()
    if not k:
        return False

    # unambiguous syntax markers
    if ATTR_SEL.match(k) or DOTTED_SEL.match(k):
        return True
    if FILENAME.match(k):
        return True
    if CSS_FUNC.search(k) or FONTISH.search(k):
        return True
    if BEM.search(k):
        return True
    if CODE_BLOCK.match(k):
        return True
    if LATEX_BLOCK.match(k) and _english_words(k) == 0:
        return True
    # a display-math block anywhere: the whole key is a formula
    if LATEX_DISPLAY.search(k):
        return True
    if LATEX_CMD.search(k) and _english_words(k) == 0:
        return True
    if DOM_ID.match(k):
        return True
    if APIISH.match(k) and len(k) <= 40:
        return True

    # a bare class-name run ("patch-detail patch-detail-empty"): all tokens
    # lowercase kebab made of CSS vocabulary
    if CLASS_RUN.match(k):
        toks = k.split()
        if all(tok in CSS_WORDS or "-" in tok for tok in toks):
            return True
        if any("--" in tok or "__" in tok for tok in toks):
            return True

    # a lone brand/acronym/short token: no spaces, single alphabetic word
    if BRAND.match(k) and " " not in k:
        # all-caps acronym of 2+ letters (RBF, GRU, LSTM, JAX, HLS)
        if len(k) >= 2 and k.isupper():
            return True
        # CamelCase brand (PyTorch, TensorFlow, NumPyro, FedAvg)
        if re.match(r"^[A-Z][a-z]+[A-Z]", k):
            return True
        # a single Capitalised word with no lowercase tail that is a technical
        # proper noun (Stan, Pyro, Julia, Numpyro). Common UI words are listed
        # in SHORT_WORDS and excluded, so "Run"/"Step"/"Full" stay translatable.
        if len(k) >= 3 and k[0].isupper() and k.lower() not in SHORT_WORDS:
            return True

    # a slash-joined pair of proper nouns (PyTensor / JAX, Edward2 / TFP)
    if PROPER_PAIR.match(k):
        # every slash-separated part must be a single Capitalised token
        parts = [p.strip() for p in re.split(r"/", k)]
        if all(re.fullmatch(r"[A-Z][\w.+-]*", p) for p in parts) and len(parts) >= 2:
            return True

    # a proper noun with inline maths, e.g. "Matérn-$\nu$" (no lowercase word)
    if not re.search(r"[a-z]{3,}\s+[a-z]{3,}", k) and re.search(r"\$[^$]*\\", k):
        return True

    # a metrics readout: several short symbol groups joined by markers/lines,
    # e.g. "k / n @@T0@@0/0@@ ... r-hat ... ESS ...". Treated as data, not prose.
    groups = [g for g in re.split(r"@@T\d+@@|\[\[\[\d+\]\]\]|\n", k) if g.strip()]
    if len(groups) >= 3 and all(len(g.split()) <= 3 for g in groups):
        if _english_words(k) <= 3:
            return True

    # dotted API / model id (Xenova/clip-vit-base-patch32 handled below)
    if re.match(r"^[\w.-]+/[\w.-]+$", k) and "." in k.split("/")[0]:
        return True

    # pure maths / notation with no English words at all
    if _english_words(k) == 0 and MATH_CHARS.search(k):
        return True

    # strings with operators/parens and no real alphabetic word
    if MATH_CHARS.search(k) and not re.search(r"[A-Za-z]{2,}", k):
        return True

    # math-function notation: a short identifier immediately followed by "("
    # and closing ")", e.g. "exp(score)", "softmax(z)", possibly with trailing
    # interpolation markers like "softmax(z)@@T0@@i@@"
    stripped = re.sub(r"(@@T\d+@@|\[\[\[\d+\]\]\]|\s)+$", "", k)
    if re.match(r"^[A-Za-z_][\w.]*\([^)]*\)$", stripped):
        return True
    # an equation: contains "=" and has no sentence-like English
    if "=" in k and not re.search(r"[a-z]{3,}\s+[a-z]{3,}", k):
        return True

    # a lone token ending in -val / -id (kebab DOM id) e.g. rollout-L-val
    if re.match(r"^[a-z][\w-]*-[A-Za-z]\w*$", k) and "-" in k:
        return True

    # format/template strings: a short sentence built around interpolations,
    # e.g. "a photo of a [[[0]]]" — these are sent to a model or parsed.
    if re.search(r"\[\[\[\d+\]\]\]", k):
        rest = re.sub(r"\[\[\[\d+\]\]\]", "", k).strip()
        if len(re.findall(r"[A-Za-z]{2,}", rest)) <= 4:
            return True

    # slash-joined ids and dotted file names without spaces
    if re.match(r"^[\w.-]+/[\w.-]+$", k):
        return True
    if re.match(r"^[\w-][\w.-]*\.[a-z]{2,5}$", k) and " " not in k:
        return True

    # symbol-ish identifiers with an underscore run: log_softmax, max_depth
    if re.match(r"^[A-Za-z][A-Za-z0-9]*_[A-Za-z0-9_]+$", k):
        return True

    # JS/Python literals
    if k in ("true", "false", "null", "undefined", "none", "nan"):
        return True
    if k in DIRECTIVE:
        return True

    return False


# --- Terms kept in English on purpose -------------------------------------
# Technical names and sample inputs that stay English by editorial choice, not
# because they are code. The validator accepts them unchanged, so a translator
# is never pushed to alter them to satisfy the check.

# hyphenated acronym names: L-BFGS, K-FAC, CMA-ES, SPSA
HYPHEN_ACRONYM = re.compile(r"^[A-Z][\w]*(-[A-Z][\w]*)+$")

# short all-lowercase technical terms with no spaces
LOWER_TERM = re.compile(r"^[a-z][a-z0-9]{2,11}$")
LOWER_TERMS_OK = {
    "softmax", "logit", "logits", "relu", "sigmoid", "tanh", "adam", "adamw",
    "sgd", "rmsprop", "adagrad", "momentum", "dropout", "batchnorm",
    "layernorm", "perceptron", "gini", "entropy", "kl", "jsd", "stan", "pyro",
    "numpyro", "julia", "pymc", "jax", "tfp",
}

# English sample inputs / prompts handed to a model, e.g. "the cat", "a dog"
SAMPLE_INPUT = re.compile(r"^(the|a|an)\s+[a-z]+(\s+[a-z]+)*$")
SAMPLE_EXTRA = {"then the", "the cat sat", "the cat sat on", "the quick brown"}


def keep_english(key: str) -> bool:
    """True when the key should simply stay as written (English is correct)."""
    k = key.strip()
    if not k:
        return True
    if HYPHEN_ACRONYM.match(k):
        return True
    if k.lower() in LOWER_TERMS_OK and LOWER_TERM.match(k):
        return True
    if k in SAMPLE_EXTRA or SAMPLE_INPUT.match(k):
        return True
    # slash/comma separated list of method or tool names (K-FAC / Shampoo,
    # Adam / AdamW): every part is a Capitalised or hyphenated-acronym token.
    parts = [p.strip() for p in re.split(r"[/,]", k)]
    if len(parts) >= 2 and all(
        re.fullmatch(r"[A-Z][\w.-]*(-[A-Z][\w]*)*", p) for p in parts
    ):
        return True
    return False
