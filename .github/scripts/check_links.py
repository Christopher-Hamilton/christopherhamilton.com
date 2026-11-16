"""Monthly check: find broken links on the site.

Collects every http(s) URL in index.html and js/data.js, plus every DOI in js/data.js and in the
Home research highlights. DOIs are checked against the DOI registry (doi.org handle API), so a
publisher that blocks robots cannot raise a false alarm. Other URLs get a HEAD request, then a GET
if HEAD fails. Publisher and news sites that refuse automated requests (401, 403, 429, 999) count
as working. Output is a Markdown "Broken links" section for the weekly issue, written to the path
given as the first argument; nothing is written when every link works.
"""
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES = [ROOT / "index.html", ROOT / "js" / "data.js"]
UA = "Mozilla/5.0 (compatible; christopherhamilton.com-link-check)"

# Not pages: identifiers, analytics endpoints and links built in JavaScript
SKIP = ("https://schema.org", "https://christopherhamilton.goatcounter.com", "https://gc.zgo.at")
# Sites that block automated requests; 401/403/429/999 from them means "probably fine"
BLOCKERS = (
    "sciencedirect.com", "elsevier.com", "wiley.com", "agupubs", "springer.com", "nature.com",
    "science.org", "tandfonline.com", "cambridge.org", "iop.org", "ieee.org", "jstor.org",
    "geoscienceworld.org", "pnas.org", "sagepub.com", "acs.org", "mdpi.com", "frontiersin.org",
    "researchgate.net", "scholar.google.com", "academic.oup.com", "annualreviews.org",
    "cnn.com", "bbc.co.uk", "bbc.com", "netflix.com", "nytimes.com", "washingtonpost.com",
    "theatlantic.com", "popularmechanics.com", "atlasobscura.com", "mbl.is", "icelandmonitor",
    "cbsnews.com", "channel4.com", "sciencenews.org", "universetoday.com", "space.com",
    "nationalgeographic.com", "smithsonianmag.com", "newscientist.com", "theguardian.com",
    "linkedin.com", "twitter.com", "x.com", "facebook.com", "instagram.com", "youtube.com",
)
OK_BLOCKED = {401, 403, 429, 999}


def collect():
    """Return {url: [where, ...]} for every link to check."""
    found = {}
    for path in FILES:
        rel = path.relative_to(ROOT).as_posix()
        for n, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for url in re.findall(r"https?://[^\s\"'<>()\\]+", line):
                url = url.rstrip(".,;")
                if url.startswith(SKIP) or url.endswith(("/", "=")) and "doi.org/" in url:
                    continue
                found.setdefault(url, []).append(f"{rel}:{n}")
            for doi in re.findall(r'\bd:"(10\.\d{4,9}/[^"]+)"', line):
                found.setdefault("https://doi.org/" + doi, []).append(f"{rel}:{n}")
    return found


def request(url, method):
    req = urllib.request.Request(url, method=method, headers={"User-Agent": UA, "Accept": "*/*"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, r.geturl()
    except urllib.error.HTTPError as e:
        return e.code, e.geturl() or url


def check_doi(doi):
    api = "https://doi.org/api/handles/" + urllib.parse.quote(doi, safe="/")
    try:
        with urllib.request.urlopen(urllib.request.Request(api, headers={"User-Agent": UA}), timeout=30) as r:
            code = json.load(r).get("responseCode")
    except urllib.error.HTTPError as e:
        code = 100 if e.code == 404 else None
        if code is None:
            return f"DOI registry error {e.code}"
    return None if code == 1 else "DOI not registered"


def check(url):
    """Return None when the link works, or a short reason."""
    if "doi.org/" in url:
        return check_doi(urllib.parse.unquote(url.split("doi.org/", 1)[1]))
    last = None
    for attempt in range(2):
        try:
            status, final = request(url, "HEAD")
            if status >= 400:
                status, final = request(url, "GET")
            if status < 400:
                return None
            host = urllib.parse.urlsplit(final).hostname or ""
            if status in OK_BLOCKED and any(b in host or b in url for b in BLOCKERS):
                return None
            last = f"HTTP {status}"
            if status not in (429, 500, 502, 503, 504):
                break
        except Exception as e:  # timeouts, DNS, TLS
            last = type(e).__name__ + (f": {e.reason}" if hasattr(e, "reason") else "")
        time.sleep(5)
    return last


def main(out_path):
    links = collect()
    with ThreadPoolExecutor(max_workers=8) as pool:
        results = dict(zip(links, pool.map(check, links)))
    broken = {u: r for u, r in results.items() if r}
    print(f"Checked {len(links)} links; {len(broken)} broken.")
    if not broken:
        return
    lines = ["<!-- broken-links -->", "## Broken links", "",
             f"Monthly link check ({time.strftime('%Y-%m-%d')}): **{len(broken)}** of {len(links)} links failed.", ""]
    for url, reason in sorted(broken.items()):
        lines.append(f"- {url} ({reason}), in {', '.join(links[url])}")
    lines += ["", "Check each by hand before changing it: some sites are only briefly down."]
    Path(out_path).write_text("\n".join(lines) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "broken-links.md")
