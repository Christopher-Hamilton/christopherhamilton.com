#!/usr/bin/env python3
"""Extract plain text from a Word .docx file (stdlib only: zipfile + xml).

Keeps one output line per Word paragraph, real tab characters for <w:tab/>,
line breaks for <w:br/>, and table cells separated by tabs. Footnotes,
comments and headers/footers are ignored (the CV body is what matters).

Usage:
    python3 cv/tools/docx_text.py path/to/file.docx            # print to stdout
    python3 cv/tools/docx_text.py path/to/file.docx -o out.txt # write a file

Also importable: from docx_text import docx_to_text
"""
import argparse
import sys
import zipfile
import xml.etree.ElementTree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"


def _para_text(p) -> str:
    out = []
    for el in p.iter():
        tag = el.tag
        if tag == W + "t":
            out.append(el.text or "")
        elif tag == W + "tab":
            # <w:tab/> inside a run is a tab character; inside <w:tabs> it is a tab-stop definition.
            out.append("\t")
        elif tag in (W + "br", W + "cr"):
            out.append("\n")
        elif tag == W + "noBreakHyphen":
            out.append("‑")
        elif tag == W + "softHyphen":
            pass
        elif tag == W + "sym":
            ch = el.get(W + "char")
            if ch:
                try:
                    out.append(chr(int(ch, 16)))
                except ValueError:
                    pass
    return "".join(out)


def _block_lines(parent):
    """Yield text lines for paragraphs and tables in document order."""
    for child in parent:
        if child.tag == W + "p":
            # Skip tab-stop definitions so they are not mistaken for tabs.
            ppr = child.find(W + "pPr")
            if ppr is not None:
                tabs = ppr.find(W + "tabs")
                if tabs is not None:
                    ppr.remove(tabs)
            yield _para_text(child)
        elif child.tag == W + "tbl":
            for tr in child.iter(W + "tr"):
                cells = []
                for tc in tr.findall(W + "tc"):
                    cells.append(" ".join(_para_text(p) for p in tc.findall(W + "p")).strip())
                yield "\t".join(cells)
        elif child.tag == W + "sdt":
            content = child.find(W + "sdtContent")
            if content is not None:
                yield from _block_lines(content)


def docx_to_text(path: str) -> str:
    with zipfile.ZipFile(path) as z:
        xml = z.read("word/document.xml")
    root = ET.fromstring(xml)
    body = root.find(W + "body")
    if body is None:
        return ""
    return "\n".join(_block_lines(body)) + "\n"


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("docx")
    ap.add_argument("-o", "--output", help="write text here instead of stdout")
    args = ap.parse_args(argv)
    text = docx_to_text(args.docx)
    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            fh.write(text)
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    sys.exit(main())
