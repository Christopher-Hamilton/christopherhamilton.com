#!/usr/bin/env python3
"""Check the website, the public CV and the master Word CV against the verified records.

The verified records are exported by the Lab Atlas project (Rumil-checked DOI registrar records for
published works, NASA ADS records for conference abstracts):
    ~/Projects/lab-atlas-private/exports/published-works.json
    ~/Projects/lab-atlas-private/exports/conference-abstracts.json
(refresh with ~/Projects/lab-atlas/scripts/export_verified.sh; override the folder with HAMILTON_RECORDS_DIR).

Owner's rule: titles verbatim from the record, never paraphrased. Capitalisation, dash and quote styles are
ignored (the site and CVs use sentence case). This script REPORTS differences; it never edits anything.

Usage:
    python3 cv/tools/verify_records.py [--master path/to/master.docx] [--quiet]

Checks
  1. js/data.js  (pubs, datasets, whitepapers): title, year, journal, volume, pages/article number,
     first author and number of authors, by DOI.
  2. cv/cv.html: each DOI's entry contains the record title.
  3. Master Word CV: each DOI's entry contains the record title; conference abstracts with an ADS record
     appear with the ADS title.
Exit status 1 when something differs, 0 when everything matches. Stdlib only.
"""
import argparse, difflib, html, json, os, re, sys, unicodedata, zipfile
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
REC = Path(os.environ.get('HAMILTON_RECORDS_DIR', Path.home() / 'Projects/lab-atlas-private/exports'))
NOTES = r'\s*\((AGU Research Spotlight|Nature Geoscience Highlight)\)'   # editorial notes kept in data.js titles


def norm(t):
    """Compare words, not typography: case, dashes, quotes, HTML and spacing are ignored."""
    t = html.unescape(re.sub(r'<[^>]+>', '', t or ''))
    for a, b in (('‐', '-'), ('‑', '-'), ('‒', '-'), ('–', '-'), ('—', '-'), ('−', '-'),
                 ('‘', "'"), ('’', "'"), ('“', '"'), ('”', '"'), (' ', ' ')):
        t = t.replace(a, b)
    t = unicodedata.normalize('NFKC', t).casefold()
    t = re.sub(r'\s*-\s*', '-', t)
    t = re.sub(r'[^\w\-\' ]+', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def ascii_fold(t):
    return unicodedata.normalize('NFKD', t or '').encode('ascii', 'ignore').decode().casefold()


def title_of(r):
    t = r.get('title')
    return t if isinstance(t, str) else (t or [''])[0]


def load_records():
    works = json.load(open(REC / 'published-works.json'))
    abstracts = json.load(open(REC / 'conference-abstracts.json')) if (REC / 'conference-abstracts.json').exists() else []
    return {(w.get('DOI') or '').lower(): w for w in works if w.get('DOI')}, abstracts


def parse_data_js():
    """Entries of pubs / datasets / whitepapers in js/data.js (one object literal per line)."""
    src = (REPO / 'js/data.js').read_text()
    out = []
    for arr in ('pubs', 'datasets', 'whitepapers'):
        m = re.search(r'const ' + arr + r' = \[(.*?)\n\];', src, re.S)
        if not m:
            continue
        for line in m.group(1).splitlines():
            f = dict(re.findall(r'(\w+):"((?:[^"\\]|\\.)*)"', line))
            if f.get('d', '').startswith('10.'):
                f['arr'] = arr
                out.append(f)
    return out


def surnames(a):
    """'Hadland, N., C.W. Hamilton, and S. Duhamel' -> ['hadland', 'hamilton', 'duhamel'] (et al. lists stop early)."""
    a = re.sub(r'\bet al\.?.*$', '', a or '')
    a = re.sub(r',?\s+and\s+', ', ', a)
    parts = [p.strip() for p in a.split(',') if p.strip()]
    names, i = [], 0
    while i < len(parts):
        p = parts[i]
        if i == 0 and i + 1 < len(parts) and re.fullmatch(r'(?:[A-ZÀ-Þ][a-zà-ÿ]?\.-?\s?)+', parts[i + 1]):
            names.append(p); i += 2; continue        # "Surname, I.J." (first author)
        names.append(p.split()[-1] if p.split() else p); i += 1
    return [ascii_fold(n).replace('°', '').strip() for n in names]


def check_data_js(recs, problems):
    for e in parse_data_js():
        d = e['d'].lower()
        r = recs.get(d) or recs.get(re.sub(r'\.v\d+$', '', d))
        where = f"js/data.js {e['arr']} {e['d']}"
        if not r:
            problems.append((where, 'no verified record for this DOI')); continue
        site_t = re.sub(NOTES, '', e.get('t', '')).rstrip('.')
        if norm(site_t) != norm(title_of(r)):
            problems.append((where, f"title\n      site:   {site_t}\n      record: {title_of(r)}"))
        yr = ((r.get('issued') or r.get('published-print') or r.get('published-online') or {}).get('date-parts') or [[None]])[0][0]
        if yr and e.get('y') and str(yr) != e['y'] and e['arr'] == 'pubs':
            problems.append((where, f"year: site {e['y']}, record {yr}"))
        j = norm(e.get('j', ''))
        ct = title_of({'title': r.get('container-title')})
        proc = r.get('type') == 'paper-conference'          # proceedings: the volume title and page counts differ by design
        if e['arr'] == 'pubs' and not proc and ct and norm(ct).replace('the ', '') not in j.replace('the ', ''):
            problems.append((where, f"journal: site \"{e.get('j')}\", record \"{ct}\""))
        if e['arr'] == 'pubs' and not proc:
            for fld in ('volume', 'article-number', 'page'):
                v = r.get(fld)
                if fld == 'article-number' and v and v.lower() in d:   # old AGU citation IDs repeat the DOI; the site uses the paper number
                    continue
                if fld == 'page' and v and re.fullmatch(r'1-1', str(v)):    # placeholder pages in early-access records
                    continue
                if v and fld != 'page' and norm(str(v)) not in j:
                    problems.append((where, f"{fld}: record {v} not in \"{e.get('j')}\""))
                if v and fld == 'page':
                    first = re.split(r'[-–]', str(v))[0]
                    if first and first not in e.get('j', '') and not r.get('article-number'):
                        problems.append((where, f"pages: record {v}, site \"{e.get('j')}\""))
        if e['arr'] == 'pubs' and r.get('author'):
            rs = [ascii_fold(a.get('family') or a.get('literal') or '') for a in r['author']]
            ss = surnames(e.get('a', ''))
            full = 'et al' not in (e.get('a') or '')
            if ss and rs and ss[0].split()[-1] != rs[0].split()[-1]:
                problems.append((where, f"first author: site {ss[0]}, record {rs[0]}"))
            elif full and len(ss) != len(rs):
                problems.append((where, f"author count: site {len(ss)}, record {len(rs)} ({', '.join(rs)})"))


def entries_with_doi(text_blocks, recs, label, problems):
    for block in text_blocks:
        for d in set(m.lower().rstrip('.') for m in re.findall(r'(?:doi\.org/|doi:)\s*(10\.[^\s<>"]+)', block, re.I)):
            d = re.sub(r'[).,;]+$', '', d)
            r = recs.get(d) or recs.get(re.sub(r'\.v\d+$', '', d))
            if r and norm(re.sub(NOTES, '', title_of(r))) not in norm(re.sub(NOTES, '', block)):
                problems.append((f'{label} {d}', f"title not verbatim\n      record: {title_of(r)}\n      entry:  {re.sub(r'<[^>]+>', '', block).strip()[:240]}"))


def check_cv_html(recs, problems):
    src = (REPO / 'cv/cv.html').read_text()
    blocks = re.findall(r'<li\b.*?</li>|<div class="entry".*?</div>\s*</div>', src, re.S)
    entries_with_doi([html.unescape(b) for b in blocks], recs, 'cv/cv.html', problems)


def master_paragraphs(path):
    x = zipfile.ZipFile(path).read('word/document.xml').decode()
    paras = re.findall(r'<w:p\b[^>]*/>|<w:p(?:\s[^>]*[^/>])?>.*?</w:p>', x, re.S)
    return [html.unescape(''.join(re.findall(r'<w:t(?:\s[^>]*)?>(.*?)</w:t>', p))) for p in paras]


def check_master(path, recs, abstracts, problems):
    paras = master_paragraphs(path)
    entries_with_doi(paras, recs, 'master CV', problems)
    # conference abstracts: every ADS-recorded title should appear verbatim in the master's abstracts section
    try:
        start = next(i for i, p in enumerate(paras) if p.strip().lower().startswith('conference abstracts and proceedings'))
    except StopIteration:
        return
    sec = [p for p in paras[start + 1:] if re.match(r'^\d+\.', p.strip())]
    normed = [norm(p) for p in sec]
    for a in abstracts:
        t = title_of(a)
        if not t:
            continue
        nt = norm(t)
        if any(nt in p for p in normed):
            continue
        best = max(sec, key=lambda p: difflib.SequenceMatcher(None, nt, norm(p)[:len(nt) + 80]).ratio(), default='')
        problems.append(('master CV conference abstract', f"ADS title not found verbatim\n      ADS:    {t}\n      closest: {best[:240]}"))


def latest_master():
    pat = re.compile(r'^Hamilton_CV_([A-Z][a-z]+)_(\d{1,2})_(\d{4})\.docx$')
    import datetime as dt
    best = None
    for d in [Path.home() / 'Documents/CVs', Path.home() / 'Documents/CV', Path.home() / 'Documents', Path.home() / 'Desktop', Path.home() / 'Downloads']:
        try:
            files = list(d.iterdir())
        except OSError:              # a folder we may not list
            continue
        for f in files:
            m = pat.match(f.name)
            if m:
                try:
                    when = dt.datetime.strptime(' '.join(m.groups()), '%B %d %Y')
                except ValueError:
                    continue
                if not best or when > best[0]:
                    best = (when, f.resolve())
    return best[1] if best else None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--master', help='master Word CV (default: the newest dated one)')
    ap.add_argument('--quiet', action='store_true', help='print only the summary line')
    args = ap.parse_args()
    if not (REC / 'published-works.json').exists():
        print(f'No verified records at {REC}; skipping.'); return 0
    recs, abstracts = load_records()
    problems = []
    check_data_js(recs, problems)
    check_cv_html(recs, problems)
    master = Path(args.master) if args.master else latest_master()
    if master and master.exists():
        check_master(master, recs, abstracts, problems)
    if not args.quiet:
        for where, what in problems:
            print(f'- {where}: {what}')
    print(f'\n{len(problems)} difference(s) from the verified records ({len(recs)} works, {len(abstracts)} ADS abstracts; '
          f'master: {master.name if master else "not found"}).')
    return 1 if problems else 0


if __name__ == '__main__':
    sys.exit(main())
