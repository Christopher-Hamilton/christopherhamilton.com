"""Weekly check: find papers and datasets linked to Hamilton's ORCID that are not yet on the site.

Sources: the ORCID public record and OpenAlex (which links far more works to the ORCID than the
ORCID record itself lists). A work counts as already on the site if its DOI, or its normalized
title, appears anywhere in js/data.js. Output is Markdown for a GitHub issue body, written to the
path given as the first argument; nothing is written when nothing new is found.
"""
import json
import re
import sys
import unicodedata
import urllib.request
from pathlib import Path

ORCID = "0000-0001-9731-517X"
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "js" / "data.js"
IGNORE = ROOT / ".github" / "pub-check-ignore.txt"
SINCE = "2024-01-01"  # OpenAlex window; older gaps are a one-off cleanup, not a weekly alert

# Kinds of work the site lists. Conference abstracts and preprints are skipped.
OPENALEX_TYPES = {"article", "review", "letter", "book", "book-chapter", "dataset", "report", "editorial"}
ORCID_TYPES = {"journal-article", "book", "book-chapter", "data-set", "report", "review", "edited-book"}


def get(url):
    req = urllib.request.Request(url, headers={"Accept": "application/json", "User-Agent": "christopherhamilton.com-pub-check"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return json.load(r)


def norm_title(t):
    t = unicodedata.normalize("NFKD", t or "").encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", t).strip()


def site_index():
    text = DATA.read_text(encoding="utf-8")
    dois = {d.lower().rstrip(".") for d in re.findall(r"10\.\d{4,9}/[^\"\s,]+", text)}
    titles = {norm_title(t)[:60] for t in re.findall(r'\bt:"([^"]+)"', text)}
    return dois, titles


def ignored():
    if not IGNORE.exists():
        return set()
    return {l.split("#")[0].strip().lower() for l in IGNORE.read_text().splitlines() if l.split("#")[0].strip()}


def site_author(name):
    """'Christopher W. Hamilton' -> ('Hamilton, C.W.', 'C.W. Hamilton')."""
    parts = name.replace(".", ". ").split()
    if len(parts) < 2:
        return name, name
    family = parts[-1]
    initials = "".join(p[0].upper() + "." for p in parts[:-1] if p[0].isalpha())
    return f"{family}, {initials}", f"{initials} {family}"


def draft_entry(w):
    names = [a["author"]["display_name"] for a in w.get("authorships", [])]
    truncated = any(re.search(r"\bet\.? al\b", n, re.I) for n in names)
    names = [n for n in names if not re.search(r"\bet\.? al\b", n, re.I)]
    if names:
        first = site_author(names[0])[0]
        rest = [site_author(n)[1] for n in names[1:]]
        if not rest:
            authors = first
        elif len(rest) == 1:
            authors = f"{first} and {rest[0]}"
        else:
            authors = f"{first}, {', '.join(rest[:-1])}, and {rest[-1]}"
    else:
        authors = "TODO"
    if truncated:
        authors += ", et al. (TODO: full author list)"
    b = w.get("biblio") or {}
    src = ((w.get("primary_location") or {}).get("source") or {}).get("display_name") or "TODO venue"
    venue = src
    if b.get("volume"):
        venue += f", {b['volume']}" + (f"({b['issue']})" if b.get("issue") else "")
    if b.get("first_page") and b.get("last_page") and b["last_page"] != b["first_page"]:
        venue += f", pp. {b['first_page']}–{b['last_page']}"
    title = (w.get("title") or "TODO").rstrip(".") + "."
    doi = (w.get("doi") or "").replace("https://doi.org/", "")
    js = lambda s: s.replace("\\", "\\\\").replace('"', '\\"')
    return f'{{y:{w.get("publication_year")},a:"{js(authors)}",t:"{js(title)}",j:"{js(venue)}",d:"{doi}"}},'


def main(out_path):
    dois, titles = site_index()
    skip = ignored()
    found = {}

    def on_site(doi, title):
        return (doi and (doi in dois or doi in skip)) or norm_title(title)[:60] in titles

    url = (f"https://api.openalex.org/works?filter=author.orcid:{ORCID},from_publication_date:{SINCE}"
           "&per_page=100&select=doi,title,publication_year,type,authorships,biblio,primary_location")
    for w in get(url)["results"]:
        doi = (w.get("doi") or "").replace("https://doi.org/", "").lower()
        if w.get("type") in OPENALEX_TYPES and not on_site(doi, w.get("title")):
            found[doi or norm_title(w.get("title"))] = {"src": "OpenAlex", "w": w, "doi": doi}

    for g in get(f"https://pub.orcid.org/v3.0/{ORCID}/works").get("group", []):
        s = g["work-summary"][0]
        if s.get("type") not in ORCID_TYPES:
            continue
        title = s["title"]["title"]["value"]
        ids = [e["external-id-value"].lower() for e in (g.get("external-ids") or {}).get("external-id", []) if e["external-id-type"] == "doi"]
        doi = ids[0] if ids else ""
        key = doi or norm_title(title)
        if not on_site(doi, title):
            if key in found:
                found[key]["src"] = "OpenAlex + ORCID"
            else:
                year = ((s.get("publication-date") or {}).get("year") or {}).get("value")
                found[key] = {"src": "ORCID", "doi": doi,
                              "w": {"title": title, "publication_year": year, "type": s["type"], "doi": doi}}

    if not found:
        print("No new works.")
        return

    items = sorted(found.values(), key=lambda f: str(f["w"].get("publication_year")), reverse=True)
    lines = [f"Weekly check found **{len(items)}** work(s) linked to [ORCID {ORCID}](https://orcid.org/{ORCID}) "
             "that are not in `js/data.js`.", ""]
    for f in items:
        w = f["w"]
        link = f"https://doi.org/{f['doi']}" if f["doi"] else ""
        lines += [f"### {w.get('title')}",
                  f"- {w.get('publication_year')} · {w.get('type')} · found in {f['src']}" + (f" · {link}" if link else ""),
                  "- Draft entry (check authors, venue and pages before adding; datasets go in `datasets`):",
                  "```js", draft_entry(w), "```", ""]
    lines += ["---",
              "To add: put each entry in `js/data.js` (`pubs` or `datasets`), and consider a card in the Home "
              "\"Recent Publications and News\" list. Team publication dropdowns update automatically.",
              "To silence an item that should never be listed, add its DOI to `.github/pub-check-ignore.txt`."]
    Path(out_path).write_text("\n".join(lines), encoding="utf-8")
    print(f"{len(items)} new work(s).")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "new-pubs.md")
