#!/usr/bin/env python3
"""Print-time typographic clean-up for cv/cv.html (stdlib only).

Called by cv/build.sh. Reads cv.html, writes a print copy to stdout. The source
file stays easy to edit; this step only prevents ugly line breaks in the PDF:
  * each author name in a citation list is kept on one line
    ("CW Hamilton", "Romero-Wolf", "Kristinsson ÞH"), and
  * page ranges ("pp. 1–17") never split.

Usage: python3 cv/tools/typeset.py cv/cv.html > cv/.cv.print.html
"""
import re
import sys

NOWRAP = '<span class="nw">{}</span>'
YEAR = re.compile(r"\s\((?:19|20)\d\d[a-z]?\)")
SEP = re.compile(r"(, and |, | and )")


def keep_authors(li_inner: str) -> str:
    m = YEAR.search(li_inner)
    if not m:
        return li_inner
    authors, rest = li_inner[: m.start()], li_inner[m.start():]
    parts = SEP.split(authors)
    out = []
    for i, part in enumerate(parts):
        if i % 2 == 1 or " " not in part.strip() and "-" not in part:
            out.append(part)
            continue
        lead = part[: len(part) - len(part.lstrip())]
        out.append(lead + NOWRAP.format(part.strip()))
    return "".join(out) + rest


def keep_pages(html: str) -> str:
    return re.sub(r"pp\. (\d+[–-]\d+|\d+)", lambda m: NOWRAP.format("pp. " + m.group(1)), html)


def typeset(html: str) -> str:
    def fix_list(m):
        body = re.sub(r"(<li>)(.*?)(</li>)", lambda li: li.group(1) + keep_authors(li.group(2)) + li.group(3), m.group(2), flags=re.S)
        return m.group(1) + body + m.group(3)

    html = re.sub(r'(<ol class="cites">)(.*?)(</ol>)', fix_list, html, flags=re.S)
    html = keep_pages(html)
    style = "<style>.nw{white-space:nowrap}</style>\n</head>"
    return html.replace("</head>", style, 1)


if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else "cv/cv.html"
    with open(src, encoding="utf-8") as fh:
        sys.stdout.write(typeset(fh.read()))
