"""Segment HTML into translatable units, correctly handling inline markup.

The naive ">text<" regex splits a sentence at every <sub>/<strong>/<a>. That
produces untranslatable fragments such as:

    "XOR labels: blue where x"  +  " and x"  +  " share a sign, ..."

This module instead groups runs of text and *inline* elements into a single
unit, so the translator sees one complete sentence:

    "XOR labels: blue where x<sub>1</sub> and x<sub>2</sub> share a sign, ..."

Block-level elements (div, section, p, li, h1..h6, button, ...) start a new
unit. Inline tags (sub, sup, strong, em, code, span, a, i, b, br, ...) are kept
inside the unit so their HTML survives translation.

The unit text keeps HTML tags intact. Translators are instructed to preserve
every tag verbatim and only translate the words between them.
"""
import re

# Tags that break a sentence: their children/text form a new unit.
BLOCK_TAGS = {
    "html", "head", "body", "div", "section", "article", "aside", "main",
    "header", "footer", "nav", "p", "li", "ul", "ol", "dl", "dt", "dd",
    "h1", "h2", "h3", "h4", "h5", "h6", "button", "label", "table", "tr",
    "td", "th", "thead", "tbody", "figure", "figcaption", "details",
    "summary", "blockquote", "pre", "form", "select", "option", "textarea",
    "video", "audio", "canvas", "iframe", "hr", "meta", "link", "title",
    "style", "script", "template",
}

# Tags kept inside a sentence.
INLINE_TAGS = {
    "sub", "sup", "strong", "em", "code", "span", "a", "i", "b", "u", "s",
    "small", "mark", "abbr", "cite", "q", "kbd", "samp", "var", "br", "wbr",
    "time", "bdi", "bdo", "dfn", "ins", "del", "ruby", "rt",
}

TAG_RE = re.compile(r"<(/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s[^<>]*?)?)(/?)>")
VOID_TAGS = {
    "br", "hr", "img", "input", "meta", "link", "source", "track", "wbr",
    "area", "base", "col", "embed", "param",
}


def html_to_units(html_text: str):
    """Split an HTML document into translatable units.

    Returns a list of unit strings, each a self-contained run of text plus
    inline markup. Code blocks are removed beforehand by the caller.
    """
    # Declarations, comments and CDATA are never prose: drop them so they
    # cannot become a "unit".
    html_text = re.sub(r"<!--.*?-->", " ", html_text, flags=re.DOTALL)
    html_text = re.sub(r"<![^>]*>", " ", html_text)

    units = []
    buf = []          # current unit accumulating inline content
    inline_depth = 0  # are we inside an inline element?

    def flush():
        if buf:
            text = "".join(buf).strip()
            if text:
                units.append(text)
            buf.clear()

    pos = 0
    for m in TAG_RE.finditer(html_text):
        text_before = html_text[pos : m.start()]
        if text_before:
            buf.append(text_before)
        pos = m.end()

        closing, name, _attrs, selfclose = m.groups()
        name = name.lower()

        # A doctype or a bare declaration is never translatable.
        if name in ("doctype", "!doctype"):
            flush()
            continue

        if name in VOID_TAGS or selfclose:
            if name in INLINE_TAGS:
                buf.append(m.group(0))
            else:
                flush()
            continue

        if name in BLOCK_TAGS:
            flush()
            continue

        # inline tag: keep it inside the unit
        buf.append(m.group(0))

    tail = html_text[pos:]
    if tail:
        buf.append(tail)
    flush()
    return units


UNIT_TAG_RE = re.compile(r"</?[a-zA-Z][^<>]*?/?>")


def lock_tags(unit: str):
    """Replace every tag in a unit with a numbered token, returning
    (masked_text, tags). The masked text is pure prose a translator can work
    on, and each token is restored verbatim on injection."""
    tags = []

    def _sub(m):
        tags.append(m.group(0))
        return f"@@T{len(tags) - 1}@@"

    return UNIT_TAG_RE.sub(_sub, unit), tags


def unlock_tags(masked: str, tags) -> str:
    for i, tag in enumerate(tags):
        masked = masked.replace(f"@@T{i}@@", tag)
    return masked


def is_translatable(unit: str) -> bool:
    """True if a unit has real prose after tags are removed."""
    text = UNIT_TAG_RE.sub(" ", unit)
    text = re.sub(r"&[a-zA-Z]+;|&#\d+;", " ", text)
    if len(re.sub(r"[^A-Za-z]", "", text)) < 2:
        return False
    if not re.search(r"[A-Za-z]{2}", text):
        return False
    # Require at least one alphabetic WORD of two or more letters. This keeps
    # ALL-CAPS eyebrows ("INPUT SPACE") while still dropping pure math lines
    # that only contain single-letter variables (e.g. "z = b + w x").
    if not re.search(r"[A-Za-z]{2,}", text):
        return False
    return True

