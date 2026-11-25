// Research map (Publications page) and Research worlds (Research page).
// Loaded on the first visit to either page (see navigate() in index.html).
// The map's data is generated into js/topic-map-data.js by .claude/tools/topic_map.py.
(function () {
'use strict';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

/* =====================================================================
   RESEARCH MAP: papers (coloured) and conference abstracts (grey)
   ===================================================================== */
function initTopicMap(root) {
  if (root.dataset.ready) return;
  root.dataset.ready = '1';
  const go = () => buildTopicMap(root);
  if (window.topicMap) { go(); return; }
  const s = document.createElement('script');
  s.src = 'js/topic-map-data.js';
  s.onload = go;
  document.head.appendChild(s);
}

function buildTopicMap(root) {
  const NS = 'http://www.w3.org/2000/svg', TM = window.topicMap, IT = TM.items, N = IT.length;
  const C = TM.clusters.slice().sort((a, b) => (a.o ?? a.id) - (b.o ?? b.id)), byId = Object.fromEntries(C.map(c => [c.id, c]));
  C.forEach((c, i) => { c.num = i + 1; });
  const $ = s => root.querySelector(s);
  const stage = $('.tm-stage'), tip = $('.tm-tip'), legend = $('.tm-legend'), panel = $('.tm-panel'), back = $('.tm-back');
  const qIn = $('.tm-q'), qOut = $('.tm-qcount'), yr = $('.tm-year'), yrOut = $('.tm-yr'), play = $('.tm-play'), viewTabs = $('.tm-views');
  const el = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; };
  const isP = i => IT[i].t === 'p', isD = i => IT[i].t === 'd';   // paper, dataset (anything else is a conference abstract)
  const TYPE_NAME = {p: 'Paper', a: 'Conference abstract', d: 'Dataset'};
  const state = {active: null, q: '', year: 9999, abs: true, ds: true, labels: false, view: 'map', focus: null};   // theme labels off by default (owner)
  root.classList.add('tm-nolabels');
  let labelsChosen = false;
  const unesc = t => t && t.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>');   // some venues arrive HTML-escaped
  IT.forEach(it => { it.ti = unesc(it.ti); it.v = unesc(it.v); it.lc = (it.ti + ' ' + (it.v || '')).toLowerCase(); });
  const nbr = IT.map(() => []);
  TM.links.forEach(([a, b]) => { nbr[a].push(b); nbr[b].push(a); });
  const wrap = (s, n) => { const w = s.split(' '), out = ['']; w.forEach(x => { const l = out.length - 1; if ((out[l] + ' ' + x).trim().length > n && out[l]) out.push(x); else out[l] = (out[l] + ' ' + x).trim(); }); return out; };

  // ---- one state for every view: 0 hidden (later year / abstracts off), 1 dimmed, 2 normal, 3 search hit
  let words = [];
  function vis(i) {
    const it = IT[i];
    if (it.y > state.year || (!state.abs && it.t === 'a') || (!state.ds && it.t === 'd')) return 0;
    const match = !words.length || words.every(w => it.lc.includes(w));
    if ((state.active !== null && it.c !== state.active) || !match) return 1;
    if (state.focus !== null && i !== state.focus && !nbr[state.focus].includes(i)) return 1;
    return words.length ? 3 : 2;
  }

  // themes with at least one paper on screen: their labels show (owner: labels arrive with a theme's first paper)
  const litThemes = () => { const f = state.focus; state.focus = null;          // hovering one dot should not hide labels
    const r = new Set(IT.filter((it, i) => it.t === 'p' && vis(i) >= 2).map(it => it.c)); state.focus = f; return r; };

  // ---- tooltip
  function showTip(x, y, i) {
    const it = IT[i];
    tip.innerHTML = '<b></b><span></span>';
    tip.firstChild.textContent = it.ti;
    tip.lastChild.textContent = TYPE_NAME[it.t] + ' · ' + (it.v ? it.v + ', ' : '') + it.y + ' · ' + byId[it.c].name;
    const r = stage.getBoundingClientRect(), w = Math.min(330, r.width - 20);
    let tx = x - r.left + 14; if (tx > r.width - w) tx = Math.max(6, x - r.left - w - 14);
    let ty = y - r.top + 14; if (ty > r.height - 100) ty = Math.max(6, y - r.top - 110);
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px'; tip.style.opacity = 1;
  }
  const hideTip = () => { tip.style.opacity = 0; };
  const open = i => { if (IT[i].u) window.open(IT[i].u, '_blank', 'noopener'); };

  /* ================= 2D MAP: points, labels in the margins with leader lines ================= */
  const MW = 1240, MH = 640, DY0 = 30, DY1 = 610;
  let DX0 = 300, DX1 = 940, mode = 'margin';      // the plot area widens when the labels move onto the plot
  const map = $('.tm-map');
  const MX = v => DX0 + v * (DX1 - DX0), MY = v => DY0 + v * (DY1 - DY0);
  const defs = el('defs', {}, map);
  const clipR = el('rect', {x: DX0 - 26, y: 6, width: DX1 - DX0 + 52, height: MH - 12}, el('clipPath', {id: 'tm-clip'}, defs));
  const mData = el('g', {'clip-path': 'url(#tm-clip)'}, map), mT = el('g', {}, mData);
  const gLk = el('g', {class: 'tm-mlinks', 'aria-hidden': 'true'}, mT), gA = el('g', {}, mT), gP = el('g', {}, mT);
  const gLead = el('g', {'aria-hidden': 'true', class: 'tm-leads'}, map), gLab = el('g', {class: 'tm-labs'}, map);
  const mDots = IT.map((it, i) => {
    const p = isP(i), ds = isD(i), d = el('circle', {cx: MX(it.x), cy: MY(it.yy), class: 'tm-dot ' + (p ? 'tm-paper' : ds ? 'tm-ds' : 'tm-abs')}, p || ds ? gP : gA);
    if (p) d.setAttribute('fill', byId[it.c].color);
    if (ds) d.setAttribute('stroke', byId[it.c].color);     // datasets: rings in the theme colour
    if (p || ds) { d.setAttribute('tabindex', '0'); d.setAttribute('role', 'link'); d.setAttribute('aria-label', TYPE_NAME[it.t] + ': ' + it.ti + ' (' + it.y + '), ' + byId[it.c].name); }
    d.__i = i; return d;
  });
  // label anchor: the paper nearest the theme's median position
  const anchors = C.map(c => {
    const idx = IT.map((_, i) => i).filter(i => IT[i].c === c.id), med = k => idx.map(i => IT[i][k]).sort((a, b) => a - b)[idx.length >> 1];
    const mx = med('x'), my = med('yy'), cand = idx.filter(isP).length ? idx.filter(isP) : idx;
    const a = cand.reduce((b, i) => Math.hypot(IT[i].x - mx, IT[i].yy - my) < Math.hypot(IT[b].x - mx, IT[b].yy - my) ? i : b, cand[0]);
    const g = el('g', {class: 'tm-lab', tabindex: '-1'}, gLab); g.__c = c.id;
    const sw = el('circle', {r: 7, fill: c.color}, g), num = el('text', {class: 'tm-numtxt', 'text-anchor': 'middle', 'dominant-baseline': 'central'}, g);
    num.textContent = c.num;
    const lines = wrap(c.name, 22).map(s => { const t = el('text', {class: 'tm-label'}, g); t.textContent = s; return t; });
    const lead = el('path', {}, gLead);
    return {c, a, g, sw, num, lines, lead};
  });
  let zoom = {s: 1, tx: 0, ty: 0}, narrow = false;
  const toScreen = i => [MX(IT[i].x) * zoom.s + zoom.tx, MY(IT[i].yy) * zoom.s + zoom.ty];
  function layoutMap() {
    const w = map.getBoundingClientRect().width; if (!w) return;
    const k = MW / w;
    // three ways to label: names in the margins with leader lines (wide), names on the plot (medium), numbers (phones)
    let widest = 0;
    anchors.forEach(A => A.lines.forEach(t => { t.removeAttribute('display'); t.style.fontSize = (16 * k) + 'px'; widest = Math.max(widest, t.getComputedTextLength()); }));
    const m = w < 430 ? 'num' : widest + 64 * k > 300 ? 'onplot' : 'margin';
    if (m !== mode) {
      mode = m; [DX0, DX1] = m === 'margin' ? [300, 940] : [40, 1200];
      clipR.setAttribute('x', DX0 - 26); clipR.setAttribute('width', DX1 - DX0 + 52);
      mDots.forEach(d => { d.setAttribute('cx', MX(IT[d.__i].x)); d.setAttribute('cy', MY(IT[d.__i].yy)); });
    }
    narrow = mode === 'num';
    // default: labels on only when they fit in the margins (wide screens); the reader's own choice always wins
    if (!labelsChosen && state.labels !== (mode === 'margin')) {
      state.labels = mode === 'margin'; root.classList.toggle('tm-nolabels', !state.labels);
      const cb = root.querySelector('.tm-toggle-lab'); if (cb) cb.checked = state.labels;
    }
    root.classList.toggle('tm-narrow', narrow); root.classList.toggle('tm-onplot', mode === 'onplot');
    map.setAttribute('viewBox', '0 0 ' + MW + ' ' + MH);
    mDots.forEach(d => d.setAttribute('r', (isP(d.__i) ? 7 : isD(d.__i) ? 5.5 : 4) * k / zoom.s));
    mDots.forEach(d => d.style.strokeWidth = (isP(d.__i) ? 2 : isD(d.__i) ? 2.5 : 0) * k / zoom.s);
    const fs = (mode === 'onplot' ? 15 : 16) * k, lh = fs * 1.2;
    const sides = {L: [], R: []};
    anchors.forEach(A => {
      const [ax, ay] = toScreen(A.a); A.ax = ax; A.ay = ay;
      A.lines.forEach(t => { t.style.fontSize = fs + 'px'; });
      A.h = A.lines.length * lh;
      if (mode === 'margin') sides[ax < (DX0 + DX1) / 2 ? 'L' : 'R'].push(A);
    });
    if (mode === 'num') {      // numbered badges on the points themselves; names are in the legend
      anchors.forEach(A => {
        A.g.setAttribute('transform', 'translate(' + A.ax + ',' + (A.ay - 18 * k) + ')');
        A.sw.setAttribute('r', 12 * k); A.num.style.fontSize = (13 * k) + 'px'; A.lead.setAttribute('d', '');
        A.lines.forEach(t => t.setAttribute('display', 'none'));
      });
      return;
    }
    if (mode === 'onplot') {   // names just above each theme's group, nudged apart so they never overlap
      const B = anchors.map(A => {
        const ys = IT.map((it, i) => i).filter(i => IT[i].c === A.c.id).map(i => toScreen(i)[1]).sort((a, b) => a - b);
        const top = ys[Math.floor(ys.length * .12)] || A.ay;
        const wd = Math.max(...A.lines.map(t => t.getComputedTextLength())) + 10 * k;
        return {A, x: A.ax, y: top - 12 * k - A.h, w: wd, h: A.h};
      });
      for (let it = 0; it < 80; it++) {
        let moved = false;
        for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
          const a = B[i], b = B[j], ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y) + 4 * k;
          if (ox > 0 && oy > 0) { const up = a.y <= b.y ? a : b, dn = up === a ? b : a; up.y -= oy / 2; dn.y += oy / 2; moved = true; }
        }
        B.forEach(b => { b.x = Math.max(b.w / 2 + 6 * k, Math.min(MW - b.w / 2 - 6 * k, b.x)); b.y = Math.max(4 * k, Math.min(MH - b.h - 4 * k, b.y)); });
        if (!moved) break;
      }
      B.forEach(({A, x, y}) => {
        A.g.removeAttribute('transform'); A.num.style.fontSize = '0'; A.sw.setAttribute('r', 0); A.lead.setAttribute('d', '');
        A.lines.forEach((t, j) => { t.removeAttribute('display'); t.setAttribute('x', x); t.setAttribute('y', y + (j + .82) * lh); t.setAttribute('text-anchor', 'middle'); t.style.strokeWidth = (4 * k) + 'px'; });
      });
      return;
    }
    Object.entries(sides).forEach(([s, L]) => {
      L.sort((a, b) => a.ay - b.ay);
      L.forEach(A => { A.y = Math.max(DY0, Math.min(DY1 - A.h, A.ay - A.h / 2)); });
      for (let it = 0; it < 40; it++) {                     // spread apart, keep inside the frame
        for (let j = 1; j < L.length; j++) { const o = L[j - 1].y + L[j - 1].h + 14 * k - L[j].y; if (o > 0) L[j].y += o; }
        const over = L.length ? L[L.length - 1].y + L[L.length - 1].h - (MH - 10) : 0;
        if (over > 0) L.forEach(A => { A.y -= over; });
        if (L.length && L[0].y < 10) L.forEach(A => { A.y += 10 - L[0].y; });
      }
      L.forEach(A => {
        const right = s === 'R', tx = right ? DX1 + 44 : DX0 - 44;
        A.lines.forEach((t, j) => { t.removeAttribute('display'); t.setAttribute('x', right ? tx + 16 * k : tx - 16 * k); t.setAttribute('y', A.y + (j + .8) * lh); t.setAttribute('text-anchor', right ? 'start' : 'end'); t.style.strokeWidth = ''; });
        A.sw.setAttribute('cx', tx); A.sw.setAttribute('cy', A.y + .5 * lh); A.sw.setAttribute('r', 6 * k);
        A.g.removeAttribute('transform'); A.num.style.fontSize = '0';
        const ly = A.y + .5 * lh, inside = A.ax > DX0 - 20 && A.ax < DX1 + 20 && A.ay > 0 && A.ay < MH;
        A.lead.setAttribute('d', inside ? 'M' + (right ? tx - 9 * k : tx + 9 * k) + ',' + ly + 'L' + (right ? Math.max(A.ax + 12 * k, DX1 + 12) : Math.min(A.ax - 12 * k, DX0 - 12)) + ',' + ly + 'L' + A.ax + ',' + A.ay : '');
        A.lead.style.strokeWidth = (1.2 * k) + 'px';
      });
    });
  }
  function paintMap() {
    mDots.forEach(d => { const v = vis(d.__i); d.classList.toggle('tm-future', v === 0); d.classList.toggle('tm-dim', v === 1); d.classList.toggle('tm-hit', v === 3); });
    const dimT = id => state.active !== null && id !== state.active;
    // a label turns white once its theme's first paper is on screen (abstracts alone keep it faint; owner's call);
    // its leader line shows once the paper it points to has appeared
    const shown = litThemes();
    anchors.forEach(A => {
      A.g.classList.toggle('tm-dim', dimT(A.c.id) || !shown.has(A.c.id));
      A.lead.classList.toggle('tm-dim', dimT(A.c.id) || IT[A.a].y > state.year);
    });
  }
  let zAnim = 0;
  function zoomMap(target) {
    const from = {...zoom}, t0 = performance.now(), D = REDUCED.matches ? 0 : 560;
    cancelAnimationFrame(zAnim);
    const step = t => {
      const q = D ? Math.min(1, (t - t0) / D) : 1, e = q < .5 ? 4 * q * q * q : 1 - Math.pow(-2 * q + 2, 3) / 2;
      zoom = {s: from.s + (target.s - from.s) * e, tx: from.tx + (target.tx - from.tx) * e, ty: from.ty + (target.ty - from.ty) * e};
      mT.setAttribute('transform', 'translate(' + zoom.tx + ',' + zoom.ty + ') scale(' + zoom.s + ')'); layoutMap();
      if (q < 1) zAnim = requestAnimationFrame(step);
    };
    zAnim = requestAnimationFrame(step);
  }
  function zoomToTheme(id) {
    if (id === null) { zoomMap({s: 1, tx: 0, ty: 0}); return; }
    const pts = IT.filter(it => it.c === id).map(it => [MX(it.x), MY(it.yy)]).sort((a, b) => a[0] - b[0]);
    const cut = a => a.slice(Math.floor(a.length * .05), Math.ceil(a.length * .95));   // ignore the farthest strays
    const xs = cut(pts.map(p => p[0]).sort((a, b) => a - b)), ys = cut(pts.map(p => p[1]).sort((a, b) => a - b));
    const bw = xs[xs.length - 1] - xs[0] + 80, bh = ys[ys.length - 1] - ys[0] + 80;
    const s = Math.max(1, Math.min(4, Math.min((DX1 - DX0) / bw, (DY1 - DY0) / bh)));
    const cx = (xs[0] + xs[xs.length - 1]) / 2, cy = (ys[0] + ys[ys.length - 1]) / 2;
    zoomMap({s, tx: (DX0 + DX1) / 2 - cx * s, ty: (DY0 + DY1) / 2 - cy * s});
  }
  // pointing at a dot draws its links to its most similar items (the network's connections, one item at a time)
  function linkFocus(i) {
    gLk.textContent = '';
    state.focus = i;
    if (i !== null) {
      const w = map.getBoundingClientRect().width, k = MW / w / zoom.s;
      nbr[i].forEach(j => {
        if (!vis(j)) return;
        const wgt = (TM.links.find(([a, b]) => (a === i && b === j) || (a === j && b === i)) || [0, 0, .3])[2];
        const l = el('line', {x1: MX(IT[i].x), y1: MY(IT[i].yy), x2: MX(IT[j].x), y2: MY(IT[j].yy)}, gLk);
        l.style.strokeWidth = (1.5 + wgt * 2.5) * k + 'px'; l.style.opacity = (.55 + wgt * .45).toFixed(2);
      });
    }
    paintMap();
  }
  map.addEventListener('mouseover', e => { const i = e.target.__i; if (i !== undefined) { const b = e.target.getBoundingClientRect(); showTip(b.left + b.width / 2, b.top + b.height / 2, i); linkFocus(i); } });
  map.addEventListener('mouseout', e => { if (e.target.__i !== undefined) { hideTip(); linkFocus(null); } });
  map.addEventListener('focusin', e => { const i = e.target.__i; if (i !== undefined) { const b = e.target.getBoundingClientRect(); showTip(b.left, b.top, i); linkFocus(i); } });
  map.addEventListener('focusout', () => { hideTip(); linkFocus(null); });
  map.addEventListener('click', e => { if (e.target.__i !== undefined) { open(e.target.__i); return; } const g = e.target.closest('.tm-lab'); if (g) select(g.__c); });
  map.addEventListener('keydown', e => { if (e.target.__i !== undefined && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(e.target.__i); } });

  /* ================= NETWORK: each item linked to its most similar items; a live force layout you can drag ================= */
  const net = $('.tm-net'), NW = 1000, NH = 600;
  const nL = el('g', {class: 'tm-links'}, net), nA = el('g', {}, net), nP = el('g', {}, net), nLab = el('g', {'aria-hidden': 'true'}, net);
  const P = IT.map(it => ({x: 60 + it.x * (NW - 120), y: 40 + it.yy * (NH - 80), vx: 0, vy: 0, hx: 60 + it.x * (NW - 120), hy: 40 + it.yy * (NH - 80), fixed: false}));
  const nLines = TM.links.map(([a, b, w]) => { const l = el('line', {}, nL); l.style.opacity = (.12 + (w - .25) * .6).toFixed(2); l.__a = a; l.__b = b; return l; });
  const nDots = IT.map((it, i) => {
    const p = isP(i), ds = isD(i), d = el('circle', {class: 'tm-dot ' + (p ? 'tm-paper' : ds ? 'tm-ds' : 'tm-abs')}, p || ds ? nP : nA);
    if (p) d.setAttribute('fill', byId[it.c].color);
    if (ds) d.setAttribute('stroke', byId[it.c].color);
    d.__i = i; return d;
  });
  const nLabels = C.map(c => { const g = el('g', {class: 'tm-nlab'}, nLab); const t = el('text', {'text-anchor': 'middle', class: 'tm-label'}, g); t.textContent = c.name; const b = el('circle', {r: 12, fill: c.color}, g), n = el('text', {'text-anchor': 'middle', 'dominant-baseline': 'central', class: 'tm-numtxt'}, g); n.textContent = c.num; g.__c = c.id; return {g, t, b, n, c}; });
  let alpha = 1, netRun = 0, netK = 1;
  function tick() {
    const a = alpha;
    for (let i = 0; i < N; i++) {                      // repulsion (all pairs; ~300 nodes)
      const pi = P[i];
      for (let j = i + 1; j < N; j++) {
        const pj = P[j]; let dx = pi.x - pj.x, dy = pi.y - pj.y, d2 = dx * dx + dy * dy;
        if (d2 > 3600) continue; if (d2 < 1) { dx = Math.random() - .5; dy = Math.random() - .5; d2 = 1; }
        const f = 16 * a / d2; pi.vx += dx * f; pi.vy += dy * f; pj.vx -= dx * f; pj.vy -= dy * f;
      }
    }
    TM.links.forEach(([i, j, w]) => {                  // springs along similarity links
      const pi = P[i], pj = P[j], dx = pj.x - pi.x, dy = pj.y - pi.y, d = Math.hypot(dx, dy) || 1, f = (d - (16 + 34 * (1 - w))) / d * .05 * a;
      pi.vx += dx * f; pi.vy += dy * f; pj.vx -= dx * f; pj.vy -= dy * f;
    });
    P.forEach(p => {
      p.vx += (p.hx - p.x) * .03 * a; p.vy += (p.hy - p.y) * .03 * a;   // stay near the map position
      if (p.fixed) { p.vx = p.vy = 0; return; }
      p.vx *= .6; p.vy *= .6; p.x = Math.max(12, Math.min(NW - 12, p.x + p.vx)); p.y = Math.max(12, Math.min(NH - 12, p.y + p.vy));
    });
    alpha *= .985;
  }
  function drawNet() {
    nLines.forEach(l => { const a = P[l.__a], b = P[l.__b]; l.setAttribute('x1', a.x); l.setAttribute('y1', a.y); l.setAttribute('x2', b.x); l.setAttribute('y2', b.y); });
    nDots.forEach((d, i) => { d.setAttribute('cx', P[i].x); d.setAttribute('cy', P[i].y); });
    nLabels.forEach(L => {
      const idx = IT.map((_, i) => i).filter(i => IT[i].c === L.c.id), xs = idx.map(i => P[i].x).sort((a, b) => a - b), ys = idx.map(i => P[i].y).sort((a, b) => a - b);
      const x = xs[xs.length >> 1], y = ys[Math.floor(ys.length * .12)] - 10 * netK;
      const hw = narrow ? 14 * netK : L.t.getComputedTextLength() / 2 + 6 * netK;
      L.g.setAttribute('transform', 'translate(' + Math.max(hw, Math.min(NW - hw, x)) + ',' + Math.max(20 * netK, y) + ')');
    });
  }
  function sizeNet() {
    const w = net.getBoundingClientRect().width; if (!w) return;
    netK = NW / w; narrow = w < 640; root.classList.toggle('tm-narrow', narrow);
    nDots.forEach(d => { d.setAttribute('r', (isP(d.__i) ? 6.5 : isD(d.__i) ? 5 : 3.5) * netK); d.style.strokeWidth = (isP(d.__i) ? 2 : isD(d.__i) ? 2.5 : 0) * netK; });
    nLines.forEach(l => { l.style.strokeWidth = netK + 'px'; });
    nLabels.forEach(L => { L.t.style.fontSize = (15 * netK) + 'px'; L.t.style.strokeWidth = (4 * netK) + 'px'; L.b.setAttribute('r', 11 * netK); L.n.style.fontSize = (12 * netK) + 'px'; });
  }
  function paintNet() {
    const v = IT.map((_, i) => vis(i));
    nDots.forEach((d, i) => { d.classList.toggle('tm-future', v[i] === 0); d.classList.toggle('tm-dim', v[i] === 1); d.classList.toggle('tm-hit', v[i] === 3); });
    nLines.forEach(l => {
      const va = v[l.__a], vb = v[l.__b];
      l.classList.toggle('tm-future', !va || !vb);
      l.classList.toggle('tm-dim', va === 1 || vb === 1);
      l.classList.toggle('tm-on', state.focus !== null && (l.__a === state.focus || l.__b === state.focus));
    });
    const lit = litThemes();
    nLabels.forEach(L => { L.g.classList.toggle('tm-dim', state.active !== null && L.c.id !== state.active); L.g.style.display = lit.has(L.c.id) ? '' : 'none'; });
  }
  function runNet() {
    if (netRun || state.view !== 'net') return;
    const loop = () => {
      if (state.view !== 'net' || alpha < .01) { netRun = 0; drawNet(); return; }
      tick(); tick(); drawNet(); netRun = requestAnimationFrame(loop);
    };
    if (REDUCED.matches) { for (let t = 0; t < 300 && alpha > .01; t++) tick(); drawNet(); return; }
    netRun = requestAnimationFrame(loop);
  }
  let ndrag = null;
  const netPt = e => { const r = net.getBoundingClientRect(); return [(e.clientX - r.left) * NW / r.width, (e.clientY - r.top) * NH / r.height]; };
  net.addEventListener('pointerdown', e => {
    const i = e.target.__i; if (i === undefined) return;
    ndrag = {i, moved: false}; P[i].fixed = true; net.setPointerCapture(e.pointerId); e.preventDefault();
  });
  net.addEventListener('pointermove', e => {
    if (ndrag) { const [x, y] = netPt(e); P[ndrag.i].x = x; P[ndrag.i].y = y; ndrag.moved = true; alpha = Math.max(alpha, .25); runNet(); hideTip(); return; }
    const i = e.target.__i;
    if (i !== undefined) { if (state.focus !== i) { state.focus = i; paintNet(); } showTip(e.clientX, e.clientY, i); }
    else if (state.focus !== null) { state.focus = null; paintNet(); hideTip(); }
  });
  net.addEventListener('pointerup', () => { if (!ndrag) return; const d = ndrag; ndrag = null; P[d.i].fixed = false; if (!d.moved) open(d.i); });
  net.addEventListener('pointerleave', () => { if (!ndrag && state.focus !== null) { state.focus = null; paintNet(); hideTip(); } });

  /* ================= 3D: the same items laid out in three dimensions; drag to turn, depth shown by size and fade ================= */
  const cv = $('.tm-3d'), ctx = cv.getContext('2d');
  let yaw = .6, pitch = .25, spin3 = !REDUCED.matches, run3 = 0, last3 = 0, proj = [], hov3 = null, cw = 0, ch = 0;
  const colorOf = i => isP(i) ? byId[IT[i].c].color : '#8a837c';
  // scale the 3D cloud so 95% of items fall inside the unit sphere
  const R95 = IT.map(it => Math.hypot(...it.p3)).sort((a, b) => a - b)[Math.floor(N * .95)] || 1;
  const P3 = IT.map(it => it.p3.map(v => v / R95));
  function size3() {
    const w = stage.clientWidth; if (!w) return;
    narrow = w < 640; root.classList.toggle('tm-narrow', narrow);
    const dpr = Math.min(2, window.devicePixelRatio || 1); cw = w; ch = Math.round(Math.max(340, w * MH / MW));
    cv.width = cw * dpr; cv.height = ch * dpr; cv.style.height = ch + 'px'; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function draw3() {
    if (!cw) size3();
    ctx.clearRect(0, 0, cw, ch);
    const cy_ = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch), D = 4, F = Math.min(cw, ch) * .44;
    proj = IT.map((it, i) => {
      let [x, y, z] = P3[i]; [x, z] = [cy_ * x + sy * z, -sy * x + cy_ * z]; [y, z] = [cp * y - sp * z, sp * y + cp * z];
      const s = D / (D - z); return {i, x: cw / 2 + x * F * s, y: ch / 2 - y * F * s, s, z};
    }).sort((a, b) => a.z - b.z);
    // a faint, softly lit sphere behind the points as a depth cue (lit from the upper left, darker at the rim)
    const R0 = F * 1.08, gx = cw / 2 - R0 * .35, gy = ch / 2 - R0 * .4;
    const grd = ctx.createRadialGradient(gx, gy, R0 * .05, cw / 2, ch / 2, R0);
    grd.addColorStop(0, 'rgba(245,240,235,.10)'); grd.addColorStop(.6, 'rgba(245,240,235,.04)'); grd.addColorStop(1, 'rgba(245,240,235,.015)');
    ctx.beginPath(); ctx.arc(cw / 2, ch / 2, R0, 0, 6.2832); ctx.fillStyle = grd; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(245,240,235,.10)'; ctx.stroke();
    const zs = proj.map(p => p.z), z0 = Math.min(...zs), z1 = Math.max(...zs);
    proj.forEach(p => {
      const v = vis(p.i); if (!v) return;
      const depth = (p.z - z0) / (z1 - z0 || 1), fade = .25 + .75 * depth;      // nearer = larger and brighter
      const r = (isP(p.i) ? 6.5 : isD(p.i) ? 5 : 3.2) * (.7 + .5 * depth) * (p.i === hov3 ? 1.5 : 1);
      ctx.globalAlpha = (v === 1 ? .1 : isP(p.i) || isD(p.i) ? fade : fade * .6);
      if (isD(p.i)) { ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832); ctx.fillStyle = '#1E1A17'; ctx.fill(); ctx.lineWidth = 2.5; ctx.strokeStyle = v === 3 || p.i === hov3 ? '#fff' : byId[IT[p.i].c].color; ctx.stroke(); p.r = r; return; }
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832);
      ctx.fillStyle = v === 3 && !isP(p.i) ? '#e9e2d8' : colorOf(p.i); ctx.fill();
      if (isP(p.i)) { ctx.lineWidth = v === 3 || p.i === hov3 ? 2 : 1.5; ctx.strokeStyle = v === 3 || p.i === hov3 ? '#fff' : '#1E1A17'; ctx.stroke(); }
      p.r = r;
    });
    ctx.globalAlpha = 1;
    // theme labels at each theme's 3D centre
    ctx.font = '700 ' + (narrow ? 13 : 15) + 'px "Source Sans 3", sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const boxes = [];
    if (!state.labels) return;
    const lit = litThemes();          // a theme's label appears with its first paper (as on the map)
    C.map(c => {
      const pts = proj.filter(p => IT[p.i].c === c.id);
      const med = k => pts.map(p => p[k]).sort((a, b) => a - b)[pts.length >> 1];
      return pts.length ? {c, mx: med('x'), my: med('y'), z: med('z')} : null;
    }).filter(Boolean).sort((a, b) => b.z - a.z).forEach(({c, mx, my}) => {   // nearest themes labelled first
      if (state.active !== null && c.id !== state.active) return;
      if (!lit.has(c.id)) return;
      const label0 = narrow ? String(c.num) : c.name, w = narrow ? 24 : ctx.measureText(label0).width + 8, h = narrow ? 24 : 20;
      const b = [mx - w / 2, my - h, mx + w / 2, my + 4];
      if (boxes.some(o => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) return;   // skip labels that would overlap
      boxes.push(b);
      const label = narrow ? String(c.num) : c.name;
      if (narrow) { ctx.fillStyle = c.color; ctx.beginPath(); ctx.arc(mx, my, 11, 0, 6.2832); ctx.fill(); ctx.fillStyle = '#0F0D0B'; ctx.textBaseline = 'middle'; ctx.fillText(label, mx, my + 1); return; }
      ctx.textBaseline = 'alphabetic'; ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(30,26,23,.92)'; ctx.strokeText(label, mx, my); ctx.fillStyle = '#F5F0EB'; ctx.fillText(label, mx, my);
    });
  }
  function loop3(t) {
    if (state.view !== '3d' || !onScreen) { run3 = 0; return; }
    const dt = last3 ? Math.min(.05, (t - last3) / 1000) : 0; last3 = t;
    if (spin3) yaw += dt * .25;
    draw3(); run3 = requestAnimationFrame(loop3);
  }
  const wake3 = () => { if (!run3 && state.view === '3d') { last3 = 0; run3 = requestAnimationFrame(loop3); } };
  let d3 = null;
  cv.addEventListener('pointerdown', e => { d3 = {x: e.clientX, y: e.clientY, yaw, pitch, moved: false}; spin3 = false; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => {
    if (d3) { const dx = e.clientX - d3.x, dy = e.clientY - d3.y; if (Math.abs(dx) + Math.abs(dy) > 3) d3.moved = true; yaw = d3.yaw + dx * .008; pitch = Math.max(-1.3, Math.min(1.3, d3.pitch + dy * .008)); hideTip(); if (!run3) draw3(); return; }
    const r = cv.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null, bd = 14;
    for (let k = proj.length - 1; k >= 0; k--) { const p = proj[k]; if (!vis(p.i) || !p.r) continue; const d = Math.hypot(p.x - x, p.y - y) - p.r; if (d < bd) { bd = d; best = p.i; if (d < 0) break; } }
    hov3 = best; cv.style.cursor = best !== null ? 'pointer' : 'grab';
    if (best !== null) showTip(e.clientX, e.clientY, best); else hideTip();
    if (!run3) draw3();
  });
  cv.addEventListener('pointerup', () => { if (d3 && !d3.moved && hov3 !== null) open(hov3); d3 = null; setTimeout(() => { if (!d3 && !REDUCED.matches && !held3) { spin3 = true; wake3(); } }, 4000); });
  // pause / resume the rotation
  let held3 = REDUCED.matches;
  const spinBtn = $('.tm-spin');
  const setSpin = on => { held3 = !on; spin3 = on; spinBtn.textContent = on ? 'Pause rotation' : 'Resume rotation'; spinBtn.setAttribute('aria-pressed', String(!on)); if (on) wake3(); };
  spinBtn.addEventListener('click', () => setSpin(held3));
  setSpin(!REDUCED.matches);
  cv.addEventListener('pointerleave', () => { hov3 = null; hideTip(); });
  cv.addEventListener('keydown', e => {
    const k = {ArrowLeft: [-.15, 0], ArrowRight: [.15, 0], ArrowUp: [0, -.12], ArrowDown: [0, .12]}[e.key]; if (!k) return;
    e.preventDefault(); spin3 = false; yaw += k[0]; pitch = Math.max(-1.3, Math.min(1.3, pitch + k[1])); draw3();
  });
  let onScreen = false;
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; if (onScreen) wake3(); }).observe(stage);

  /* ================= shared controls ================= */
  function paint() { paintMap(); paintNet(); if (state.view === '3d' && !run3) draw3(); }
  function setView(v) {
    state.view = v; state.focus = null; hideTip();
    [...viewTabs.children].forEach(b => { const on = b.dataset.v === v; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    map.toggleAttribute('hidden', v !== 'map'); net.toggleAttribute('hidden', v !== 'net'); cv.hidden = v !== '3d';   // SVG elements have no .hidden property
    back.hidden = !(v === 'map' && state.active !== null);
    root.dataset.view = v; $('.tm-spin').hidden = v !== '3d';
    if (v === 'map') layoutMap();
    if (v === 'net') { sizeNet(); drawNet(); runNet(); }
    if (v === '3d') { size3(); draw3(); wake3(); }
    paint();
  }
  viewTabs.addEventListener('click', e => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
  viewTabs.addEventListener('keydown', e => {
    const bs = [...viewTabs.children], i = bs.indexOf(document.activeElement); if (i < 0 || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault(); const n = (i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length; bs[n].focus(); setView(bs[n].dataset.v);
  });

  function select(id) {
    state.active = state.active === id ? null : id;
    legend.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.id === state.active)));
    back.hidden = !(state.view === 'map' && state.active !== null);
    zoomToTheme(state.active);
    paint();
    if (state.active === null) { panel.hidden = true; return; }
    const c = byId[id], items = IT.filter(i => i.c === id), papers = items.filter(i => i.t === 'p').sort((a, b) => b.y - a.y), yrs = items.map(i => i.y);
    const dsets = items.filter(i => i.t === 'd').sort((a, b) => b.y - a.y), nAbs = items.length - papers.length - dsets.length;
    panel.innerHTML = '<h3></h3><p class="tm-psub"></p><ol></ol>';
    panel.querySelector('h3').textContent = c.name;
    panel.querySelector('.tm-psub').textContent = papers.length + ' paper' + (papers.length === 1 ? '' : 's') + ', ' + nAbs + ' conference abstracts and ' + dsets.length + ' dataset' + (dsets.length === 1 ? '' : 's') + ', ' + Math.min(...yrs) + '–' + Math.max(...yrs) + (papers.length || dsets.length ? ':' : '.');
    const ol = panel.querySelector('ol');
    papers.concat(dsets).forEach(p => {
      const li = document.createElement('li'), a = document.createElement('a'), s = document.createElement('span');
      if (p.t === 'd') li.className = 'tm-li-ds';
      a.href = p.u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = p.ti; s.textContent = (p.t === 'd' ? 'Dataset · ' : '') + p.y + (p.v ? ' · ' + p.v.split(',')[0] : '');
      li.append(a, s); ol.appendChild(li);
      const i = IT.indexOf(p);
      li.addEventListener('mouseenter', () => { mDots[i].classList.add('tm-ping'); nDots[i].classList.add('tm-ping'); });
      li.addEventListener('mouseleave', () => { mDots[i].classList.remove('tm-ping'); nDots[i].classList.remove('tm-ping'); });
    });
    panel.hidden = false;
  }
  back.addEventListener('click', () => select(state.active));
  C.forEach(c => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.id = c.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<i aria-hidden="true"></i><span></span><small></small>';
    const i = b.querySelector('i'); i.style.background = c.color; i.textContent = c.num;
    b.querySelector('span').textContent = c.name;
    b.querySelector('small').innerHTML = '<b class="tm-np"></b> · <span class="tm-na"></span>';   // papers in white, abstracts in grey
    b.querySelector('.tm-np').textContent = c.papers; b.querySelector('.tm-na').textContent = c.n - c.papers - (c.datasets || 0);
    b.setAttribute('aria-label', c.name + ': ' + c.papers + ' papers, ' + (c.n - c.papers - (c.datasets || 0)) + ' conference abstracts, ' + (c.datasets || 0) + ' datasets. Select to highlight this theme and list its papers.');
    b.addEventListener('click', () => select(c.id));
    li.appendChild(b); legend.appendChild(li);
  });
  qIn.addEventListener('input', () => {
    words = qIn.value.toLowerCase().split(/\s+/).filter(Boolean);
    const hits = IT.filter((it, i) => words.length && vis(i) === 3).length;
    qOut.textContent = words.length ? hits + (hits === 1 ? ' match' : ' matches') : '';
    paint();
  });
  const years = IT.map(i => i.y), y0 = Math.min(...years), y1 = Math.max(...years);
  yr.min = y0; yr.max = y1; yr.value = y1;
  function setYear(v, pop) {
    const prev = state.year; state.year = +v; yr.value = v; yrOut.textContent = y0 + '–' + Math.min(+v, y1);
    if (pop) [mDots, nDots].forEach(ds => ds.forEach(d => { const y = IT[d.__i].y; if (y > prev && y <= state.year) { d.classList.remove('tm-pop'); void d.getBBox(); d.classList.add('tm-pop'); } }));
    paint();
  }
  yr.addEventListener('input', () => { stopPlay(); setYear(yr.value, true); });
  let timer = 0;
  function stopPlay() { clearInterval(timer); timer = 0; play.textContent = 'Play'; play.setAttribute('aria-pressed', 'false'); }
  play.addEventListener('click', () => {
    if (timer) { stopPlay(); return; }
    play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true');
    let y = state.year >= y1 ? y0 - 1 : state.year; setYear(y, false);
    timer = setInterval(() => { y++; setYear(y, !REDUCED.matches); if (y >= y1) stopPlay(); }, 520);
  });
  $('.tm-toggle').addEventListener('change', e => { state.abs = e.target.checked; paint(); });
  $('.tm-toggle-ds').addEventListener('change', e => { state.ds = e.target.checked; paint(); });
  // theme labels on or off, in every view
  $('.tm-toggle-lab').addEventListener('change', e => { labelsChosen = true; state.labels = e.target.checked; root.classList.toggle('tm-nolabels', !state.labels); paint(); });
  const nPap = IT.filter(i => i.t === 'p').length;
  const nDs = IT.filter(i => i.t === 'd').length;
  $('.tm-counts').textContent = nPap + ' papers, ' + (N - nPap - nDs) + ' conference abstracts and ' + nDs + ' datasets';
  window.addEventListener('resize', () => { if (state.view === 'map') layoutMap(); if (state.view === 'net') sizeNet(); if (state.view === '3d') { size3(); draw3(); } });
  setView('map'); setYear(y1, false);
  // first view: the points fade in from left to right
  if (!REDUCED.matches) {
    root.classList.add('tm-intro');
    mDots.forEach(d => { d.style.transitionDelay = Math.round(IT[d.__i].x * 700 + Math.random() * 250) + 'ms'; });
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return;
      o.disconnect(); requestAnimationFrame(() => root.classList.add('tm-in'));
      setTimeout(() => { mDots.forEach(d => { d.style.transitionDelay = ''; }); root.classList.remove('tm-intro', 'tm-in'); }, 1800);
    }, {threshold: .25}).observe(stage);
  }
}

/* =====================================================================
   RESEARCH WORLDS: projects on planetary globes
   ===================================================================== */
const BODIES = {
  earth:  {name: 'Earth',  tone: [1, 1, 1],       contrast: 1,    hi: 1},
  mars:   {name: 'Mars',   tone: [1, 1, 1],       contrast: 1.1,  hi: 1},
  moon:   {name: 'Moon',   tone: [1, 1, 1],       contrast: 1.15, hi: 0},
  venus:  {name: 'Venus',  tone: [1, 1, 1],       contrast: 1.05, hi: 0},
  io:     {name: 'Io',     tone: [1, 1, 1],       contrast: 1.1,  hi: 1},
  europa: {name: 'Europa', tone: [1, .96, .9],    contrast: 1.25, hi: 1},
  ceres:  {name: 'Ceres',  tone: [1, .98, .95],   contrast: 1.1,  hi: 0}
};
const ORDER = ['earth', 'mars', 'moon', 'venus', 'io', 'europa', 'ceres'];
const TEX = (k, hi) => 'images/globes/' + k + (hi ? '-8k' : '') + '.jpg';
// Study sites: name, latitude, longitude (east positive). Approximate centres.
const SITES = {
  iceland: ['Holuhraun, Iceland', 64.87, -16.83], fagradalsfjall: ['Reykjanes Peninsula, Iceland', 63.903, -22.267],   // one site for all Reykjanes work (owner: be consistent)
  hekla: ['Hekla, Iceland', 63.99, -19.67],
  hawaii: ['Kīlauea, Hawaiʻi', 19.41, -155.28], lapalma: ['La Palma, Canary Islands', 28.61, -17.87],
  arizona: ['San Francisco volcanic field, Arizona', 35.36, -111.5], biosphere2: ['Biosphere 2, Arizona', 32.58, -110.85],
  utah: ['Wildcat Hills, Utah', 38.5, -113.3], newmexico: ['El Malpais, New Mexico', 34.9, -107.95],
  alaska: ['Seward Peninsula, Alaska', 65.5, -164.3], deathvalley: ['Death Valley, California', 36.2206, -116.7267],
  nz: ['New Zealand', -36.85, 174.76],
  elysium: ['Elysium Planitia', 3, 154.7], amazonis: ['Amazonis Planitia', 24.8, -164], athabasca: ['Athabasca Valles', 8.6, 155],
  hebrus: ['Hebrus Valles', 20, 126.6], hrad: ['Hrad Vallis', 34, 141], tharsis: ['Tharsis', 2, -112],
  copernicus: ['Copernicus crater', 9.6, -20.1], southpole: ['Lunar south pole', -89, 0], gruithuisen: ['Gruithuisen domes', 36.3, -40.5],
  // used by publications only
  askja: ['Askja, Iceland', 65.03, -16.75], langjokull: ['Langjökull, Iceland', 64.63, -20.27], rainbowbasin: ['Rainbow Basin Natural Area, California', 35.02, -117.03], raudholar: ['Rauðhólar, Iceland', 64.096, -21.745],
  obsidiandome: ['Obsidian Dome, California', 37.76, -119.02], poleta: ['Poleta Folds, California', 37.29, -118.13],
  galena: ['Galena Creek rock glacier, Wyoming', 44.65, -109.79], laki: ['Laki, Iceland', 64.07, -18.23], kverkfjoll: ['Kverkfjöll, Iceland', 64.65, -16.68],
  myvatn: ['Mývatn, Iceland', 65.6, -17.0], idaho: ['Craters of the Moon, Idaho', 43.42, -113.52],
  cerberus: ['Cerberus Fossae', 9.2, 164.3], aristarchus: ['Aristarchus Plateau', 26, -51], marius: ['Marius Hills', 13.4, -55.9],
  loki: ['Loki Patera', 13, 51], pele: ['Pele', -18.7, 104.9], ahuna: ['Ahuna Mons', -10.5, -43.9], giordanobruno: ['Giordano Bruno crater', 35.9, 102.8],
  manannan: ['Manannán crater', 3.1, 120.3],   // 3.1° N, 239.7° W = 120.3° E occator: ['Occator crater', 19.8, -120.7]
};
// Worlds (and sites) for each project, matched by the start of its title in js/data.js
const TAGS = [
  ['From Arizona’s volcanoes', [['earth'], ['moon'], ['mars']]],   // no single site (owner, Nov 24, 2026)
  ['Magmatic and tectonic processes in Amazonis', [['mars', 'amazonis']]],
  ['Simultaneous Localization', [['moon']]],
  ['Linking cryovolcanism', [['europa']]],
  ['The role of dynamic topography', [['earth']]],
  ['The magmatic evolution of Elysium', [['mars', 'elysium']]],
  ['PANTHER', [['earth', 'deathvalley'], ['earth', 'askja'], ['earth', 'iceland'], ['earth', 'langjokull'], ['earth', 'fagradalsfjall']]],
  ['From olivine to feldspar', [['mars']]],
  ['Rheology and eruptibility of three-phase', [['europa']]],
  ['VERITAS', [['venus'], ['earth', 'iceland'], ['earth', 'fagradalsfjall']]],
  ['Revealing the geologic history of Amazonis', [['mars', 'amazonis']]],
  ['From Early Earth to Mars', [['earth', 'biosphere2'], ['mars']]],
  ['Exploring the origin and eruption of silicic lunar', [['moon', 'gruithuisen'], ['earth', 'utah']]],
  ['Planetary data training', [['earth'], ['mars'], ['moon']]],
  ['Preparatory fieldwork', [['earth', 'lapalma']]],
  ['RAVEN', [['earth', 'iceland'], ['earth', 'rainbowbasin'], ['mars']]],   // Holuhraun and Rainbow Basin (owner)
  ['Follow the light', [['earth']]],
  ['Infrastructure for planetary analog', [['earth', 'fagradalsfjall']]],
  ['RAPID', [['earth', 'fagradalsfjall']]],
  ['LIFE', [['earth', 'iceland']]],   // Holuhraun only (owner, Nov 24, 2026)
  ['Lunar impact melt', [['moon']]],
  ['Volcanism and interior heating processes on Io', [['io']]],
  ['Sinuous channels', [['earth'], ['mars', 'elysium'], ['mars', 'tharsis']]],
  ['Volcanic plains on Mars', [['mars', 'elysium'], ['mars', 'tharsis']]],
  ['Precision geodetic', [['earth', 'iceland']]],
  ['Thermal infrared remote sensing', [['earth', 'hawaii']]],
  ['Thermo-rheological modeling', [['earth', 'hawaii'], ['mars'], ['moon']]],
  ['Rocky roads', [['earth', 'hekla']]],
  ['Pattern to process', [['mars', 'athabasca']]],
  ['Volcanic eruptions and climate on Late Amazonian', [['mars', 'athabasca']]],
  ['Exploring biosignature', [['earth', 'iceland'], ['mars']]],
  ['Evaluating the spread of microorganisms', [['earth', 'iceland']]],
  ['Automating hyperspectral', [['earth', 'nz'], ['earth', 'fagradalsfjall']]],
  ['3-D modeling of a secondary ancient lunar', [['moon']]],
  ['Artemis III', [['moon', 'southpole']]],
  ['Investigating magma-cryosphere', [['mars', 'hebrus']]],
  ['Self-secondary craters', [['moon', 'copernicus']]],
  ['Io Volcano Observer', [['io']]],
  ['Tephrostratigraphy', [['earth', 'iceland']]],
  ['Geologic mapping of Hrad', [['mars', 'hrad']]],
  ['Quantitative studies of lava flows and eruption', [['earth'], ['mars']]],
  ['Simulation of inflated', [['earth', 'newmexico'], ['mars']]],
  ['External water', [['earth', 'raudholar'], ['mars']]],   // field site Rauðhólar (owner, Nov 24, 2026)
  ['X-ray diffraction', [['mars'], ['moon']]],
  ['Pahoehoe lava on Mars and Earth', [['earth', 'newmexico'], ['mars']]],
  ['Tidal Heating', [['io']]],
  ['Field investigation of basaltic', [['earth', 'iceland']]],
  ['Quantitative measurements of active Ionian', [['io']]],
  ['Stereo-derived topography', [['earth', 'alaska'], ['mars']]],
  ['Melt decompaction', [['mars']]]
];

// Papers and conference abstracts on the globes: worlds and sites are read from the title (js/topic-map-data.js).
// A title can name several worlds (an Iceland analog for Mars is listed on both); it is plotted only where it names a site.
const PUB_SITES = [
  [/holuhraun|dyngjusand|baugur/i, 'earth', 'iceland'], [/askja/i, 'earth', 'askja'], [/rau[ðd]h[oó]lar/i, 'earth', 'raudholar'], [/langj[oö]kull/i, 'earth', 'langjokull'], [/laki|eldgj/i, 'earth', 'laki'],
  [/kverkfj/i, 'earth', 'kverkfjoll'], [/m[yý]vatn/i, 'earth', 'myvatn'], [/hekla/i, 'earth', 'hekla'],
  [/fagradalsfjall|geldingadal|sundhn|reykjanes/i, 'earth', 'fagradalsfjall'], [/k[iī]lauea|hawai|mauna ulu|mauna loa/i, 'earth', 'hawaii'],
  [/la palma|cumbre vieja/i, 'earth', 'lapalma'], [/el malpais|new mexico|mccartys|zuni-bandera/i, 'earth', 'newmexico'], [/seward|alaska/i, 'earth', 'alaska'],
  [/wildcat hills/i, 'earth', 'utah'], [/death valley|dante/i, 'earth', 'deathvalley'], [/craters of the moon|idaho/i, 'earth', 'idaho'],
  [/san francisco volcanic|sp crater/i, 'earth', 'arizona'], [/biosphere 2/i, 'earth', 'biosphere2'],
  [/elysium/i, 'mars', 'elysium'], [/athabasca/i, 'mars', 'athabasca'], [/amazonis/i, 'mars', 'amazonis'], [/hrad/i, 'mars', 'hrad'],
  [/hebrus|hephaestus/i, 'mars', 'hebrus'], [/tharsis|arsia|pavonis|olympus mons/i, 'mars', 'tharsis'], [/cerberus/i, 'mars', 'cerberus'],
  [/copernicus/i, 'moon', 'copernicus'], [/aristarchus/i, 'moon', 'aristarchus'], [/marius/i, 'moon', 'marius'],
  [/gruithuisen/i, 'moon', 'gruithuisen'], [/giordano bruno/i, 'moon', 'giordanobruno'], [/lunar south pole|south polar region of the moon/i, 'moon', 'southpole'],
  [/loki/i, 'io', 'loki'], [/\bpele\b/i, 'io', 'pele'], [/manann[aá]n/i, 'europa', 'manannan'], [/ahuna/i, 'ceres', 'ahuna'], [/occator/i, 'ceres', 'occator']
];
const PUB_BODIES = [
  ['earth', /iceland|icelandic|earth|terrestrial|arizona|hawai|alaska|antarctic|volcano(es)? in|lava lake/i],
  ['mars', /\bmars\b|martian|hirise/i], ['moon', /\blunar\b|\bmoon\b|apollo/i], ['venus', /venus|veritas/i],
  ['io', /\bio\b|ionian/i], ['europa', /europa/i], ['ceres', /ceres/i]
];
// Sites the owner gave for items whose titles name no site (keyed by link)
const PUB_EXTRA = {
  'https://doi.org/10.1016/j.scitotenv.2026.181659': [['earth', 'iceland']],   // sandsheet microbial dispersal: Holuhraun
  'https://doi.org/10.1029/2020GL090797': [['europa', 'manannan']],             // brine migration: Manannán crater
  'https://doi.org/10.3847/PSJ/ad55f4': [['earth', 'iceland']],
  'https://doi.org/10.48577/jpl.DSFUSK': [['earth', 'deathvalley']],             // passive radar data: Dante’s View, Death Valley (TGRS paper)
  'https://doi.org/10.25422/azu.data.27156978': [['earth', 'iceland']],         // RAVEN UAS surveys: Holuhraun (DataCite description)
  'https://doi.org/10.25422/azu.data.26035837': [['earth', 'iceland'], ['earth', 'askja'], ['earth', 'fagradalsfjall']],   // VERITAS UAS surveys (DataCite)                 // rover vs helicopter: Holuhraun
  'https://doi.org/10.1089/ast.2021.0124': [['earth', 'iceland']],              // microbial response, hydrothermal: Holuhraun
  // UAS drill/scoop samplers: Holuhraun and Askja; Galena Creek, Wyoming; Obsidian Dome and Poleta Folds, California (Chen et al. 2025, PSJ 6:153)
  'https://doi.org/10.1061/9780784485736.030': [['earth', 'iceland'], ['earth', 'askja'], ['earth', 'galena'], ['earth', 'obsidiandome'], ['earth', 'poleta']],
  'https://doi.org/10.3847/PSJ/adcfa1': [['earth', 'iceland'], ['earth', 'askja'], ['earth', 'galena'], ['earth', 'obsidiandome'], ['earth', 'poleta']]
};
// "Site: Holuhraun, Iceland" or "Sites: Death Valley, California; Askja, Holuhraun, Reykjanes Peninsula, Iceland":
// places in the same country or state share one alphabetical list; features with no region (Elysium Planitia) stand alone
function siteLine(keys) {
  const groups = [];
  [...new Set(keys)].forEach(k => {
    const n = SITES[k][0], i = n.lastIndexOf(', '), place = i < 0 ? n : n.slice(0, i), region = i < 0 ? '' : n.slice(i + 2);
    const g = region && groups.find(g => g.region === region);
    if (g) { if (!g.places.includes(place)) g.places.push(place); } else groups.push({region, places: [place]});
  });
  const n = groups.reduce((a, g) => a + g.places.length, 0);
  const cmp = (x, y) => x.localeCompare(y, 'en', {sensitivity: 'base'});
  groups.forEach(g => g.places.sort(cmp));                                   // alphabetical within a country or state
  groups.sort((a, b) => cmp(a.region || a.places[0], b.region || b.places[0]));   // and the groups alphabetical too
  return (n > 1 ? 'Sites: ' : 'Site: ') + groups.map(g => g.places.join(', ') + (g.region ? ', ' + g.region : '')).join('; ');
}
function placePub(it) {
  const t = it.ti.replace(/craters of the moon/ig, 'Craters of the M00n')     // an Idaho park, not the Moon
    .replace(/muliwai a pele/ig, 'Muliwai a P3le')                          // a Kīlauea lava channel, not Pele on Io
    .replace(/(jupiter[’']s|icy|galilean|saturn[’']s) moons?/ig, 'satellite');   // "Jupiter’s moon Io" is not the Moon
  const sites = PUB_SITES.filter(r => r[0].test(t)).map(r => [r[1], r[2]]).concat(PUB_EXTRA[it.u] || []);
  const bodies = new Set(sites.map(s => s[0]));
  PUB_BODIES.forEach(([b, rx]) => { if (rx.test(t)) bodies.add(b); });
  return {bodies, sites};
}

const VS1 = 'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}';
const VS2 = '#version 300 es\nin vec2 p;out vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}';
// Ray-sphere in the fragment shader. WebGL2 samples with seam-corrected gradients so mipmaps work across the date line.
const FS_BODY =
  'void main(){vec2 q=v/zoom;float r2=dot(q,q);' +
  'if(r2>1.){float a=smoothstep(1.06,1.,sqrt(r2));OUT=vec4(.95,.55,.3,a*.10);return;}' +
  'vec3 n=vec3(q,sqrt(1.-r2));' +
  'float cp=cos(-pitch),sp=sin(-pitch);vec3 a=vec3(n.x,cp*n.y-sp*n.z,sp*n.y+cp*n.z);' +
  'float cy=cos(-yaw),sy=sin(-yaw);vec3 b=vec3(cy*a.x+sy*a.z,a.y,-sy*a.x+cy*a.z);' +
  'float lat=asin(clamp(b.y,-1.,1.)),lon=atan(b.x,b.z);' +
  'vec2 uv=vec2((lon+3.14159265)/6.2831853,(1.5707963-lat)/3.14159265);' +
  'vec3 c=SAMPLE;' +
  'c=clamp((c-.5)*contrast+.5,0.,1.)*tone;' +
  'float l=.42+.68*max(dot(n,normalize(vec3(-.45,.35,.82))),0.);float rim=pow(1.-n.z,3.)*.25;' +
  'OUT=vec4(c*l+vec3(.95,.6,.35)*rim*.3,1.);}';
const UNI = 'uniform sampler2D t;uniform float yaw,pitch,contrast,zoom;uniform vec3 tone;';
const FS1 = 'precision highp float;varying vec2 v;' + UNI + FS_BODY.replace(/OUT/g, 'gl_FragColor').replace('SAMPLE', 'texture2D(t,uv).rgb');
const FS2 = '#version 300 es\nprecision highp float;in vec2 v;out vec4 o;' + UNI +
  'vec3 samp(vec2 uv){vec2 dx=dFdx(uv),dy=dFdy(uv);float u2=fract(uv.x+.5);float ax=dFdx(u2),ay=dFdy(u2);' +
  'if(abs(ax)<abs(dx.x))dx.x=ax;if(abs(ay)<abs(dy.x))dy.x=ay;return textureGrad(t,uv,dx,dy).rgb;}' +
  FS_BODY.replace(/OUT/g, 'o').replace('SAMPLE', 'samp(uv)');

function initWorlds(root) {
  if (root.dataset.ready) return;
  root.dataset.ready = '1';
  const tabs = root.querySelector('.wd-tabs'), list = root.querySelector('.wd-list'), box = root.querySelector('.wd-globe');
  const cv = box.querySelector('canvas'), tip = box.querySelector('.wd-tip'), allPanel = root.querySelector('.wd-all');
  const projects = [...activeProjects.map(p => ({p, active: true})), ...completedProjects.map(p => ({p, active: false}))]
    .map(({p, active}) => { const t = TAGS.find(([k]) => p[1].startsWith(k)); return {role: p[0], title: p[1], fund: p[2], active, tags: t ? t[1] : []}; });
  const forBody = k => projects.filter(p => p.tags.some(t => t[0] === k));
  const smooth = () => REDUCED.matches ? 'auto' : 'smooth';

  // ---- WebGL globe (falls back to the project list alone)
  let gl = cv.getContext('webgl2', {antialias: true, premultipliedAlpha: false}), gl2 = !!gl;
  if (!gl) gl = cv.getContext('webgl', {antialias: true, premultipliedAlpha: false});
  let U = () => null, tex = null, maxTex = 0, hiOK = false;
  if (gl) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, gl2 ? VS2 : VS1)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, gl2 ? FS2 : FS1));
    gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    U = n => gl.getUniformLocation(prog, n);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl2 ? gl.REPEAT : gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl2 ? gl.LINEAR_MIPMAP_LINEAR : gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    const an = gl.getExtension('EXT_texture_filter_anisotropic');
    if (an && gl2) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 34, 30, 255]));
    maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    // 8k maps only on WebGL2 desktops (memory); loaded the first time someone zooms in
    hiOK = gl2 && maxTex >= 8192 && !window.matchMedia('(pointer: coarse)').matches;
  } else {
    root.classList.add('wd-noglobe');
  }
  const cache = {}, shown = {};
  let home = {yaw: 0, pitch: .35}, body = null, yaw = 0, pitch = .35, zoom = 1, spin = !REDUCED.matches, markers = [], running = false, onScreen = false;
  function use(im, key) {
    if (!gl || shown.key === key) return;
    gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im);
    if (gl2) gl.generateMipmap(gl.TEXTURE_2D);
    shown.key = key; draw();
  }
  function fetchTex(key, src, then) {
    if (cache[key]) { then(cache[key]); return; }
    if (cache[key] === null) return;                 // already loading
    cache[key] = null;
    const im = new Image(); im.decoding = 'async';
    im.onload = () => { cache[key] = im; then(im); }; im.onerror = () => { delete cache[key]; };
    im.src = src;
  }
  function load(k) {
    if (!gl) return;
    const hiKey = k + '-8k';
    if (cache[hiKey]) { use(cache[hiKey], hiKey); return; }
    fetchTex(k, TEX(k), im => { if (body === k && shown.key !== hiKey) use(im, k); });
    if (hiOK && BODIES[k].hi && zoom >= 1.8) fetchTex(hiKey, TEX(k, true), im => { if (body === k) use(im, hiKey); });
  }
  function size() { if (!gl) return; const d = Math.min(2, window.devicePixelRatio || 1), w = box.clientWidth; if (!w) return; cv.width = cv.height = Math.round(w * d); gl.viewport(0, 0, cv.width, cv.height); }

  // ---- markers: one per site; sites closer than ~26 px on screen merge into one numbered marker
  function draw() {
    if (!body) return;
    if (gl) {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U('yaw'), yaw); gl.uniform1f(U('pitch'), pitch); gl.uniform1f(U('zoom'), zoom);
      gl.uniform1f(U('contrast'), BODIES[body].contrast); gl.uniform3fv(U('tone'), BODIES[body].tone);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    const R = box.clientWidth / 2, groups = [];
    markers.forEach(m => { // inverse of the shader's Ry(-yaw)·Rx(-pitch): Ry(+yaw), then Rx(+pitch)
      const la = m.lat * Math.PI / 180, lo = m.lon * Math.PI / 180;
      let x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
      const cy = Math.cos(yaw), sy = Math.sin(yaw); [x, z] = [cy * x + sy * z, -sy * x + cy * z];
      const cp = Math.cos(pitch), sp = Math.sin(pitch); [y, z] = [cp * y - sp * z, sp * y + cp * z];
      m.sx = R + x * R * zoom + (m.dx || 0); m.sy = R - y * R * zoom + (m.dy || 0);
      m.vis = !!gl && z > 0.08 && Math.hypot(m.sx - R, m.sy - R) < R - 8;
      if (!m.vis) return;
      const g = groups.find(g => g[0].type === m.type && Math.hypot(g[0].sx - m.sx, g[0].sy - m.sy) < 26);
      if (g) g.push(m); else groups.push([m]);
    });
    markers.forEach(m => { m.el.hidden = true; m.group = null; });
    groups.forEach(g => {
      const m = g[0], idx = [...new Set(g.flatMap(s => s.idx))];
      m.group = g; m.el.hidden = false;
      m.el.style.left = m.sx + 'px'; m.el.style.top = m.sy + 'px';
      const label = idx.length > 1 ? String(idx.length) : '';
      if (m.el.textContent !== label) m.el.textContent = label;
      m.el.classList.toggle('multi', idx.length > 1);
      m.el.setAttribute('aria-label', g.map(s => s.name).join('; ') + ': ' + idx.length + ' ' + ({proj: 'project', pap: 'paper', abs: 'conference abstract', ds: 'dataset'})[m.type || 'proj'] + (idx.length > 1 ? 's' : '') +
        (g.length > 1 ? '. Activate to zoom in.' : ''));
    });
  }
  let last = 0;
  function frame(t) {
    if (!onScreen || box.offsetParent === null || !body) { running = false; return; }   // hidden or scrolled away: stop
    const dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    if (spin) yaw += dt * .18;
    if (anim) anim(t);
    draw(); requestAnimationFrame(frame);
  }
  function wake() { if (!running && onScreen) { running = true; last = 0; requestAnimationFrame(frame); } }
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; wake(); }).observe(box);

  // ---- zoom (buttons, wheel or trackpad pinch, touch pinch, + and − keys) with a short ease
  const ZMAX = 8;
  let anim = null;
  function setZoom(z, face, to, after) {   // face: {lat, lon} to centre; to: {yaw, pitch} to return to; after: run at the end
    z = Math.max(1, Math.min(ZMAX, z));
    const z0 = zoom, y0 = yaw, p0 = pitch, t0 = performance.now(), D = REDUCED.matches ? 0 : 260;
    let yT = y0, pT = p0;
    if (face) { yT = -face.lon * Math.PI / 180; pT = face.lat * Math.PI / 180; }
    if (to) { yT = to.yaw; pT = to.pitch; }
    yT = y0 + Math.atan2(Math.sin(yT - y0), Math.cos(yT - y0));       // turn the short way round
    spin = false;
    anim = t => {
      const k = D ? Math.min(1, (t - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3);
      zoom = z0 * Math.pow(z / z0, e); yaw = y0 + (yT - y0) * e; pitch = p0 + (pT - p0) * e;
      if (k >= 1) { anim = null; load(body); if (after) after(); }
    };
    wake();
    if (!running) { anim(performance.now() + D); draw(); }
    zoomOut.disabled = z <= 1; zoomIn.disabled = z >= ZMAX;
  }
  const ctl = root.querySelector('.wd-zoom');
  ctl.innerHTML = '<button type="button" aria-label="Zoom out">−</button><button type="button" aria-label="Zoom in">+</button><button type="button" class="wd-reset">Reset</button>';
  const [zoomOut, zoomIn, reset] = ctl.children;
  zoomOut.addEventListener('click', () => { setZoom(zoom / 1.6); resumeSpin(); });
  zoomIn.addEventListener('click', () => setZoom(zoom * 1.6));
  // Reset: back to the view the world opened with, then spin again
  reset.addEventListener('click', () => { clearTimeout(idle); setZoom(1, null, home, () => { if (!REDUCED.matches) { spin = true; wake(); } }); });
  zoomOut.disabled = true;
  box.addEventListener('wheel', e => {
    // trackpad pinch arrives as ctrl+wheel; a plain wheel zooms only once the globe has focus (so page scrolling still works)
    if (!e.ctrlKey && document.activeElement !== box) return;
    e.preventDefault(); anim = null;
    zoom = Math.max(1, Math.min(ZMAX, zoom * Math.exp(-e.deltaY * (e.ctrlKey ? .01 : .0015)))); spin = false;
    zoomOut.disabled = zoom <= 1; zoomIn.disabled = zoom >= ZMAX;
    clearTimeout(box._z); box._z = setTimeout(() => load(body), 200);
    wake(); draw();
  }, {passive: false});
  const ptrs = new Map();
  let drag = null, pinch = null;
  box.addEventListener('pointerdown', e => {
    if (e.target.closest('.wd-mark')) return;
    box.focus({preventScroll: true});
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY}); box.setPointerCapture(e.pointerId);
    spin = false; anim = null;
    if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = {d: Math.hypot(a.x - b.x, a.y - b.y), zoom}; drag = null; }
    else drag = {x: e.clientX, y: e.clientY, yaw, pitch};
  });
  box.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.set(e.pointerId, {x: e.clientX, y: e.clientY});
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      zoom = Math.max(1, Math.min(ZMAX, pinch.zoom * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d)); wake(); return;
    }
    if (!drag) return; const s = Math.PI / (box.clientWidth * zoom);
    yaw = drag.yaw + (e.clientX - drag.x) * s; pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * s)); wake();
  });
  const up = e => {
    ptrs.delete(e.pointerId);
    if (pinch) { pinch = null; zoomOut.disabled = zoom <= 1; zoomIn.disabled = zoom >= ZMAX; load(body); }
    if (ptrs.size === 1) { const p = [...ptrs.values()][0]; drag = {x: p.x, y: p.y, yaw, pitch}; } else drag = null;
    if (!ptrs.size) resumeSpin();
  };
  let idle = 0;
  function resumeSpin() {   // the globe starts turning again 4 s after a drag, unless zoomed in
    clearTimeout(idle);
    if (REDUCED.matches) return;
    idle = setTimeout(() => { if (zoom <= 1.01 && !ptrs.size && body) { spin = true; wake(); } }, 4000);
  }
  box.addEventListener('pointerup', up); box.addEventListener('pointercancel', up);
  // keyboard: arrow keys turn the globe; + and − zoom
  box.addEventListener('keydown', e => {
    if (e.target !== box) return;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); setZoom(zoom * 1.6); return; }
    if (e.key === '-' || e.key === '_') { e.preventDefault(); setZoom(zoom / 1.6); return; }
    const k = {ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, -.15], ArrowDown: [0, .15]}[e.key];
    if (!k) return; e.preventDefault(); spin = false;
    yaw += k[0] / zoom; pitch = Math.max(-1.4, Math.min(1.4, pitch + k[1] / zoom)); draw(); resumeSpin();
  });
  window.addEventListener('resize', () => { size(); draw(); });

  // ---- papers and conference abstracts (js/topic-map-data.js), placed by their titles
  let pubs = [];
  const show = {proj: true, pap: true, ds: true, abs: true};   // conference abstracts on by default (owner)
  function loadPubs() {
    const go = () => { pubs = window.topicMap.items.map(it => ({...it, ...placePub(it)})); counts(); if (body) select(body, true); };
    if (window.topicMap) { go(); return; }
    const sc = document.createElement('script'); sc.src = 'js/topic-map-data.js'; sc.onload = go; document.head.appendChild(sc);
  }
  const pubsFor = (k, t) => pubs.filter(p => p.t === t && p.bodies.has(k)).sort((a, b) => b.y - a.y);
  // 3D flyovers from the group's own UAS surveys (js/flyover.js, loaded on first use)
  const FLY = [{id: 'vent2016', body: 'earth', label: 'Holuhraun main vent (Baugur)'}, {id: 'hotsprings2015', body: 'earth', label: 'Holuhraun lava margin (Hot Springs)'}];
  const flyBox = root.querySelector('.wd-fly');
  function openFly(id) {
    if (window.openFlyover) { window.openFlyover(id); return; }
    const sc = document.createElement('script'); sc.src = 'js/flyover.js'; sc.onload = () => window.openFlyover(id); document.head.appendChild(sc);
  }
  function flyButtons(k) {
    const list = FLY.filter(f => f.body === k);
    flyBox.hidden = !list.length; flyBox.innerHTML = list.length ? '<span>3D flyovers</span>' : '';
    list.forEach(f => { const b = document.createElement('button'); b.type = 'button'; b.className = 'wd-flybtn'; b.textContent = f.label; b.addEventListener('click', () => openFly(f.id)); flyBox.appendChild(b); });
  }
  const toggles = root.querySelector('.wd-show');
  toggles.innerHTML = '<label><input type="checkbox" data-k="proj" checked> <i class="wd-key-proj" aria-hidden="true"></i>Projects</label><label><input type="checkbox" data-k="pap" checked> <i class="wd-key-pap" aria-hidden="true"></i>Papers</label><label><input type="checkbox" data-k="ds" checked> <i class="wd-key-ds" aria-hidden="true"></i>Datasets</label><label><input type="checkbox" data-k="abs" checked> <i class="wd-key-abs" aria-hidden="true"></i>Conference abstracts</label>';
  toggles.addEventListener('change', e => { show[e.target.dataset.k] = e.target.checked; counts(); if (body) select(body, true); });

  // ---- tabs: All (the full project lists), then one per world
  ['all', ...ORDER].forEach(k => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'wd-tab-' + k; b.dataset.k = k;
    b.setAttribute('aria-controls', k === 'all' ? 'wd-all-panel' : 'wd-panel');
    b.innerHTML = (k === 'all' ? '' : '<span class="wd-swatch" aria-hidden="true"></span>') + '<span></span><small></small>';
    if (k !== 'all') b.querySelector('.wd-swatch').style.backgroundImage = 'url(images/globes/sm/' + k + '.jpg)';
    b.querySelector('span:not(.wd-swatch)').textContent = k === 'all' ? 'All' : BODIES[k].name;
    b.addEventListener('click', () => select(k));
    tabs.appendChild(b);
  });
  // ---- orbit picker: the worlds on simple orbits (Io and Europa around Jupiter, the Moon around Earth); click one to go there
  const orr = root.querySelector('.wd-orrery');
  const orb = orr ? (() => {
    const NS = 'http://www.w3.org/2000/svg', svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 1000 250'); svg.setAttribute('aria-hidden', 'true'); orr.appendChild(svg);
    const mk = (n, a, p) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); (p || svg).appendChild(e); return e; };
    const SX = 500, SY = 125, F = .25;                      // the Sun in the middle, and how flat the orbits look
    mk('circle', {cx: SX, cy: SY, r: 13, class: 'or-sun'});
    // [key, orbit radius, start angle, period factor, parent]
    const W = [['venus', 100, 2.4, .62], ['earth', 165, .9, 1], ['mars', 240, 3.9, 1.88], ['ceres', 330, 4.4, 4.6], ['jupiter', 405, 0.25, 11.9],
      ['moon', 30, .4, .08, 'earth'], ['io', 36, 1.2, .05, 'jupiter'], ['europa', 56, 4.1, .1, 'jupiter']];
    const pos = {}, items = {};
    W.forEach(([k, r, a0, per, par]) => {
      const ring = mk('ellipse', {rx: r, ry: r * F, class: 'or-orbit' + (par ? ' or-sub' : '')});
      if (!par) { ring.setAttribute('cx', SX); ring.setAttribute('cy', SY); }
      const g = mk('g', {class: 'or-world' + (BODIES[k] ? '' : ' or-static'), 'data-k': k});
      mk('circle', {r: k === 'jupiter' ? 11 : k === 'moon' || k === 'io' || k === 'europa' || k === 'ceres' ? 5.5 : 8}, g);
      if (BODIES[k]) { mk('circle', {r: 16, class: 'or-hit'}, g); g.addEventListener('click', () => { const b = tabs.querySelector('[data-k="' + k + '"]'); if (b) b.click(); }); }
      const t = mk('text', {y: k === 'moon' || k === 'jupiter' ? -16 : 28, 'text-anchor': 'middle'}, g); t.textContent = k === 'jupiter' ? 'Jupiter' : (BODIES[k] ? BODIES[k].name : k);
      items[k] = {ring, g, r, a0, per, par};
    });
    let run = 0, t0 = 0, vis = false;
    const place = t => {
      Object.entries(items).forEach(([k, it]) => {
        const a = it.a0 + (REDUCED.matches ? 0 : t / 1000 * .05 / it.per);
        const cx = it.par ? pos[it.par][0] : SX, cy = it.par ? pos[it.par][1] : SY;
        const x = cx + it.r * Math.cos(a), y = cy + it.r * F * Math.sin(a);
        pos[k] = [x, y]; it.g.setAttribute('transform', 'translate(' + x.toFixed(1) + ',' + y.toFixed(1) + ')');
        if (it.par) { it.ring.setAttribute('cx', cx.toFixed(1)); it.ring.setAttribute('cy', cy.toFixed(1)); }
      });
    };
    const loop = t => { if (!vis) { run = 0; return; } place(t - t0); run = requestAnimationFrame(loop); };
    place(0);
    new IntersectionObserver(es => { vis = es[0].isIntersecting; if (vis && !run && !REDUCED.matches) { run = requestAnimationFrame(loop); } }).observe(orr);
    return {mark: k => Object.entries(items).forEach(([kk, it]) => it.g.classList.toggle('on', kk === k))};
  })() : null;

  function counts() {      // the number on each world's tab follows the toggles
    [...tabs.children].forEach(b => {
      const k = b.dataset.k;
      const n = k === 'all' ? projects.length : (show.proj ? forBody(k).length : 0) + (show.pap ? pubsFor(k, 'p').length : 0) + (show.ds ? pubsFor(k, 'd').length : 0) + (show.abs ? pubsFor(k, 'a').length : 0);
      b.querySelector('small').textContent = n;
    });
  }
  counts();
  tabs.addEventListener('keydown', e => {
    const bs = [...tabs.children], i = bs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length;
    bs[n].focus(); select(bs[n].dataset.k);
  });
  const plural = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  function select(k, keepView) {
    [...tabs.children].forEach(b => { const on = b.dataset.k === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    root.classList.toggle('wd-show-all', k === 'all');
    if (orb) orb.mark(k);
    allPanel.hidden = k !== 'all';
    if (k === 'all') { body = null; return; }
    const sameBody = keepView && body === k;
    body = k;
    if (!sameBody) {
      zoom = 1; anim = null; spin = !REDUCED.matches; zoomOut.disabled = true; zoomIn.disabled = false; shown.key = null;
      if (gl) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 34, 30, 255])); }
      size(); load(k);
    }
    list.setAttribute('aria-labelledby', 'wd-tab-' + k);
    flyButtons(k);
    markers.forEach(m => m.el.remove()); markers = [];
    const sites = {};        // site → list items it covers
    const addSite = (s, li, type) => { const key = s + '|' + type; (sites[key] = sites[key] || []).push(li); };
    list.innerHTML = '<h3></h3><p class="wd-sub"></p><div class="wd-scroll"></div>';
    list.querySelector('h3').textContent = BODIES[k].name;
    const sc = list.querySelector('.wd-scroll');
    const section = (title, n) => { const h = document.createElement('h4'); h.className = 'wd-h4'; h.textContent = title + ' (' + n + ')'; sc.appendChild(h); const ul = document.createElement('ul'); sc.appendChild(ul); return ul; };
    const ps = show.proj ? forBody(k) : [], paps = show.pap ? pubsFor(k, 'p') : [], dss = show.ds ? pubsFor(k, 'd') : [], abss = show.abs ? pubsFor(k, 'a') : [];
    if (ps.length) {
      const ul = section('Projects', ps.length);
      ps.forEach(p => {
        const li = document.createElement('li');
        const st = p.tags.filter(t => t[0] === k && t[1]).map(t => t[1]);
        li.innerHTML = '<span class="wd-role"></span><span class="wd-state"></span><strong></strong><span class="wd-fund"></span>' + (st.length ? '<span class="wd-site"></span>' : '');
        li.querySelector('.wd-role').textContent = p.role;
        li.querySelector('.wd-state').textContent = p.active ? 'Active' : 'Completed';
        li.querySelector('strong').textContent = p.title;
        li.querySelector('.wd-fund').textContent = p.fund;
        if (st.length) li.querySelector('.wd-site').textContent = siteLine(st);
        ul.appendChild(li); st.forEach(s => addSite(s, li, 'proj'));
      });
    }
    [[paps, 'Papers', 'wd-pap'], [dss, 'Datasets', 'wd-ds'], [abss, 'Conference abstracts', 'wd-abs']].forEach(([arr, title, cls]) => {
      if (!arr.length) return;
      const ul = section(title, arr.length);
      arr.forEach(p => {
        const li = document.createElement('li'); li.className = cls;
        const st = p.sites.filter(s => s[0] === k).map(s => s[1]);
        const a = document.createElement(p.u ? 'a' : 'strong');
        if (p.u) { a.href = p.u; a.target = '_blank'; a.rel = 'noopener'; }
        a.className = 'wd-ptitle'; a.textContent = p.ti;
        const m = document.createElement('span'); m.className = 'wd-fund'; m.textContent = p.y + (p.v ? ' · ' + p.v.split(',')[0] : '');
        li.append(a, m);
        if (st.length) { const si = document.createElement('span'); si.className = 'wd-site'; si.textContent = siteLine(st); li.appendChild(si); }
        ul.appendChild(li); st.forEach(s => addSite(s, li, cls.slice(3)));
      });
    });
    if (!ps.length && !paps.length && !dss.length && !abss.length) sc.innerHTML = '<p class="wd-empty">Nothing to show. Turn on projects, papers, datasets or conference abstracts below the globe.</p>';
    const nSites = new Set(Object.keys(sites).map(k => k.split('|')[0])).size;
    const parts = [];
    if (show.proj) parts.push(plural(ps.length, 'project'));
    if (show.pap) parts.push(plural(paps.length, 'paper'));
    if (show.ds) parts.push(plural(dss.length, 'dataset'));
    if (show.abs) parts.push(plural(abss.length, 'conference abstract'));
    list.querySelector('.wd-sub').textContent = parts.join(' · ') + (nSites ? ' · ' + plural(nSites, 'study site') + ' on the globe' : '');
    const all = [...sc.querySelectorAll('li')];
    const TYPE = {proj: ['project', 0, -6], pap: ['paper', 13, 9], abs: ['conference abstract', -13, 9], ds: ['dataset', 0, 20]};   // name, screen offset
    Object.entries(sites).forEach(([key, lis]) => {
      const [s, type] = key.split('|'), [name, lat, lon] = SITES[s];
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'wd-mark wd-mark-' + type;
      const m = {el, lat, lon, idx: lis.map(li => all.indexOf(li)), name, type, dx: TYPE[type][1], dy: TYPE[type][2]};
      const ids = () => [...new Set((m.group || [m]).flatMap(g => g.idx))];
      const on = v => {
        el.classList.toggle('on', v);
        all.forEach(li => li.classList.remove('on'));
        if (v) ids().forEach(i => all[i].classList.add('on'));
        if (v) {
          const g = m.group || [m], n = ids().length;
          tip.textContent = g.map(s => s.name).join(' · ') + ' — ' + plural(n, TYPE[m.type][0]);
          const W = box.clientWidth, x = m.sx;
          tip.style.left = (x > W * .55 ? x - 14 - tip.offsetWidth : x + 14) + 'px'; tip.style.top = (m.sy + 14) + 'px';
        }
        tip.style.opacity = v ? 1 : 0;
      };
      el.addEventListener('mouseenter', () => on(true)); el.addEventListener('mouseleave', () => on(false));
      el.addEventListener('focus', () => on(true)); el.addEventListener('blur', () => on(false));
      el.addEventListener('click', () => {
        const g = m.group || [m];
        if (g.length > 1) {               // merged sites: zoom in until they separate
          const lat = g.reduce((a, s) => a + s.lat, 0) / g.length, lon = g.reduce((a, s) => a + s.lon, 0) / g.length;
          const sep = Math.max(...g.map(s => Math.hypot(s.lat - lat, (s.lon - lon) * Math.cos(lat * Math.PI / 180)))) || 1;
          setZoom(Math.max(zoom * 1.8, Math.min(ZMAX, 18 / sep)), {lat, lon});
          on(false); return;
        }
        const first = all[ids()[0]];
        ids().forEach(i => { all[i].classList.remove('flash'); void all[i].offsetWidth; all[i].classList.add('flash'); });
        sc.scrollTo({top: first.offsetTop - 6, behavior: smooth()});
        if (window.matchMedia('(max-width: 860px)').matches) first.scrollIntoView({behavior: smooth(), block: 'center'});
      });
      box.appendChild(el); markers.push(m);
    });
    if (!sameBody) {
      const first = (Object.keys(sites)[0] || '').split('|')[0];   // face the first study site
      if (first) { yaw = -SITES[first][2] * Math.PI / 180; pitch = SITES[first][1] * Math.PI / 180 * .8; } else { yaw = 0; pitch = .35; }
      home = {yaw, pitch};
    }
    wake(); draw();
  }
  size(); select('all'); loadPubs();
}

window.initResearchVisuals = function (page) {
  if (page === 'publications') { const r = document.getElementById('topic-map'); if (r) initTopicMap(r); }
  if (page === 'research') { const r = document.getElementById('research-worlds'); if (r) initWorlds(r); }
  if (page === 'research') {           // the story's code loads only as the reader scrolls near it
    const st = document.getElementById('story-holuhraun');
    if (st && !st.dataset.watch) {
      st.dataset.watch = '1';
      new IntersectionObserver((es, o) => {
        if (!es[0].isIntersecting) return; o.disconnect();
        const go = () => window.initStory(st);
        if (window.initStory) go(); else { const sc = document.createElement('script'); sc.src = 'js/story.js'; sc.onload = go; document.head.appendChild(sc); }
      }, {rootMargin: '800px 0px'}).observe(st);
    }
  }
};
})();
