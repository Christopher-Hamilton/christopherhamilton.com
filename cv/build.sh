#!/usr/bin/env bash
# Render cv/cv.html to cv/Hamilton_CV.pdf with headless Chrome and print the page count.
# Usage: cv/build.sh            (from anywhere)
# Needs Google Chrome 131+ (for @page margin boxes, which draw the footer page numbers).
set -euo pipefail

CV_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SRC="$CV_DIR/cv.html"
OUT="$CV_DIR/Hamilton_CV.pdf"

CHROME="${CHROME:-}"
if [[ -z "$CHROME" ]]; then
  for c in \
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "$HOME/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
    "$(command -v google-chrome 2>/dev/null || true)" \
    "$(command -v chromium 2>/dev/null || true)"; do
    if [[ -n "$c" && -x "$c" ]]; then CHROME="$c"; break; fi
  done
fi
[[ -n "$CHROME" ]] || { echo "build.sh: Google Chrome not found (set CHROME=/path/to/chrome)" >&2; exit 1; }

# A throwaway profile keeps the run independent of the user's Chrome session.
PROFILE="$(mktemp -d "${TMPDIR:-/tmp}/cv-chrome.XXXXXX")"
# Print copy with no-break spans (see tools/typeset.py). It sits next to cv.html so cv.css resolves.
PRINT="$CV_DIR/.cv.print.html"
trap 'rm -rf "$PROFILE" "$PRINT"' EXIT
python3 "$CV_DIR/tools/typeset.py" "$SRC" > "$PRINT"

# --virtual-time-budget gives the Google Fonts stylesheet time to load before printing.
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --no-first-run \
  --no-default-browser-check \
  --user-data-dir="$PROFILE" \
  --run-all-compositor-stages-before-draw \
  --virtual-time-budget=20000 \
  --no-pdf-header-footer \
  --print-to-pdf="$OUT" \
  "file://$PRINT" 2>/dev/null

[[ -s "$OUT" ]] || { echo "build.sh: PDF was not written" >&2; exit 1; }

# Page count: PDFKit on macOS; otherwise count page objects in the file.
pages=""
if command -v osascript >/dev/null 2>&1; then
  pages="$(osascript -l JavaScript -e "ObjC.import('PDFKit'); \$.PDFDocument.alloc.initWithURL(\$.NSURL.fileURLWithPath('$OUT')).pageCount" 2>/dev/null || true)"
fi
if [[ -z "$pages" ]]; then
  pages="$(python3 -c "import re,sys; print(len(re.findall(rb'/Type\s*/Page(?![a-z])', open(sys.argv[1],'rb').read())))" "$OUT")"
fi

echo "Wrote $OUT ($pages pages, $(du -h "$OUT" | cut -f1 | tr -d ' '))"
