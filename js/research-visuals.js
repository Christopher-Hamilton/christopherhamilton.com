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
  const isP = i => IT[i].t === 'p';
  const state = {active: null, q: '', year: 9999, abs: true, view: 'map', focus: null};
  IT.forEach(it => { it.lc = (it.ti + ' ' + (it.v || '')).toLowerCase(); });
  const nbr = IT.map(() => []);
  TM.links.forEach(([a, b]) => { nbr[a].push(b); nbr[b].push(a); });
  const wrap = (s, n) => { const w = s.split(' '), out = ['']; w.forEach(x => { const l = out.length - 1; if ((out[l] + ' ' + x).trim().length > n && out[l]) out.push(x); else out[l] = (out[l] + ' ' + x).trim(); }); return out; };

  // ---- one state for every view: 0 hidden (later year / abstracts off), 1 dimmed, 2 normal, 3 search hit
  let words = [];
  function vis(i) {
    const it = IT[i];
    if (it.y > state.year || (!state.abs && it.t !== 'p')) return 0;
    const match = !words.length || words.every(w => it.lc.includes(w));
    if ((state.active !== null && it.c !== state.active) || !match) return 1;
    if (state.focus !== null && i !== state.focus && !nbr[state.focus].includes(i)) return 1;
    return words.length ? 3 : 2;
  }

  // ---- tooltip
  function showTip(x, y, i) {
    const it = IT[i];
    tip.innerHTML = '<b></b><span></span>';
    tip.firstChild.textContent = it.ti;
    tip.lastChild.textContent = (it.t === 'p' ? 'Paper' : 'Conference abstract') + ' · ' + (it.v ? it.v + ', ' : '') + it.y + ' · ' + byId[it.c].name;
    const r = stage.getBoundingClientRect(), w = Math.min(330, r.width - 20);
    let tx = x - r.left + 14; if (tx > r.width - w) tx = Math.max(6, x - r.left - w - 14);
    let ty = y - r.top + 14; if (ty > r.height - 100) ty = Math.max(6, y - r.top - 110);
    tip.style.left = tx + 'px'; tip.style.top = ty + 'px'; tip.style.opacity = 1;
  }
  const hideTip = () => { tip.style.opacity = 0; };
  const open = i => { if (IT[i].u) window.open(IT[i].u, '_blank', 'noopener'); };

  /* ================= 2D MAP: points, labels in the margins with leader lines ================= */
  const MW = 1240, MH = 680, DX0 = 300, DX1 = 940, DY0 = 34, DY1 = 646;
  const map = $('.tm-map');
  const MX = v => DX0 + v * (DX1 - DX0), MY = v => DY0 + v * (DY1 - DY0);
  const defs = el('defs', {}, map);
  el('rect', {x: DX0 - 26, y: 6, width: DX1 - DX0 + 52, height: MH - 12}, el('clipPath', {id: 'tm-clip'}, defs));
  const mData = el('g', {'clip-path': 'url(#tm-clip)'}, map), mT = el('g', {}, mData);
  const gA = el('g', {}, mT), gP = el('g', {}, mT);
  const gLead = el('g', {'aria-hidden': 'true', class: 'tm-leads'}, map), gLab = el('g', {class: 'tm-labs'}, map);
  const mDots = IT.map((it, i) => {
    const p = isP(i), d = el('circle', {cx: MX(it.x), cy: MY(it.yy), class: 'tm-dot ' + (p ? 'tm-paper' : 'tm-abs')}, p ? gP : gA);
    if (p) { d.setAttribute('fill', byId[it.c].color); d.setAttribute('tabindex', '0'); d.setAttribute('role', 'link'); d.setAttribute('aria-label', it.ti + ' (' + it.y + '), ' + byId[it.c].name); }
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
    narrow = w < 640; root.classList.toggle('tm-narrow', narrow);
    map.setAttribute('viewBox', narrow ? (DX0 - 26) + ' 0 ' + (DX1 - DX0 + 52) + ' ' + MH : '0 0 ' + MW + ' ' + MH);
    const k = (narrow ? DX1 - DX0 + 52 : MW) / w;
    mDots.forEach(d => d.setAttribute('r', (isP(d.__i) ? 7 : 4) * k / zoom.s));
    mDots.forEach(d => d.style.strokeWidth = (isP(d.__i) ? 2 : 0) * k / zoom.s);
    const fs = 16 * k, lh = 19 * k;
    const sides = {L: [], R: []};
    anchors.forEach(A => {
      const [ax, ay] = toScreen(A.a); A.ax = ax; A.ay = ay;
      A.lines.forEach(t => { t.style.fontSize = fs + 'px'; });
      A.h = A.lines.length * lh;
      if (!narrow) sides[ax < (DX0 + DX1) / 2 ? 'L' : 'R'].push(A);
    });
    if (narrow) {      // numbered badges on the points themselves; names are in the legend
      anchors.forEach(A => {
        A.g.setAttribute('transform', 'translate(' + A.ax + ',' + (A.ay - 18 * k) + ')');
        A.sw.setAttribute('r', 12 * k); A.num.style.fontSize = (13 * k) + 'px'; A.lead.setAttribute('d', '');
        A.lines.forEach(t => t.setAttribute('display', 'none'));
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
        A.lines.forEach((t, j) => { t.removeAttribute('display'); t.setAttribute('x', right ? tx + 16 * k : tx - 16 * k); t.setAttribute('y', A.y + (j + .8) * lh); t.setAttribute('text-anchor', right ? 'start' : 'end'); });
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
    // a label is full strength while its theme has anything on screen (and no other theme is selected);
    // its leader line shows once the paper it points to has appeared
    const shown = new Set(IT.filter((it, i) => vis(i) >= 2).map(it => it.c));
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
  map.addEventListener('mouseover', e => { const i = e.target.__i; if (i !== undefined) { const b = e.target.getBoundingClientRect(); showTip(b.left + b.width / 2, b.top + b.height / 2, i); } });
  map.addEventListener('mouseout', e => { if (e.target.__i !== undefined) hideTip(); });
  map.addEventListener('focusin', e => { const i = e.target.__i; if (i !== undefined) { const b = e.target.getBoundingClientRect(); showTip(b.left, b.top, i); } });
  map.addEventListener('focusout', hideTip);
  map.addEventListener('click', e => { if (e.target.__i !== undefined) { open(e.target.__i); return; } const g = e.target.closest('.tm-lab'); if (g) select(g.__c); });
  map.addEventListener('keydown', e => { if (e.target.__i !== undefined && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(e.target.__i); } });

  /* ================= NETWORK: each item linked to its most similar items; a live force layout you can drag ================= */
  const net = $('.tm-net'), NW = 1000, NH = 680;
  const nL = el('g', {class: 'tm-links'}, net), nA = el('g', {}, net), nP = el('g', {}, net), nLab = el('g', {'aria-hidden': 'true'}, net);
  const P = IT.map(it => ({x: 60 + it.x * (NW - 120), y: 40 + it.yy * (NH - 80), vx: 0, vy: 0, hx: 60 + it.x * (NW - 120), hy: 40 + it.yy * (NH - 80), fixed: false}));
  const nLines = TM.links.map(([a, b, w]) => { const l = el('line', {}, nL); l.style.opacity = (.12 + (w - .25) * .6).toFixed(2); l.__a = a; l.__b = b; return l; });
  const nDots = IT.map((it, i) => {
    const p = isP(i), d = el('circle', {class: 'tm-dot ' + (p ? 'tm-paper' : 'tm-abs')}, p ? nP : nA);
    if (p) d.setAttribute('fill', byId[it.c].color);
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
    nDots.forEach(d => { d.setAttribute('r', (isP(d.__i) ? 6.5 : 3.5) * netK); d.style.strokeWidth = (isP(d.__i) ? 2 : 0) * netK; });
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
    nLabels.forEach(L => L.g.classList.toggle('tm-dim', state.active !== null && L.c.id !== state.active));
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
    // faint reference rings (equator and two meridians) as a depth cue
    ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(181,173,166,.16)';
    [[1, 0, 0, 0, 0, 1], [1, 0, 0, 0, 1, 0], [0, 1, 0, 0, 0, 1]].forEach(([ax, ay, az, bx, by, bz]) => {
      ctx.beginPath();
      for (let k = 0; k <= 72; k++) {
        const t = k / 72 * 6.2832, c = Math.cos(t) * 1.05, s_ = Math.sin(t) * 1.05;
        let x = ax * c + bx * s_, y = ay * c + by * s_, z = az * c + bz * s_;
        [x, z] = [cy_ * x + sy * z, -sy * x + cy_ * z]; [y, z] = [cp * y - sp * z, sp * y + cp * z];
        const q = D / (D - z), X = cw / 2 + x * F * q, Y = ch / 2 - y * F * q;
        k ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y);
      }
      ctx.stroke();
    });
    const zs = proj.map(p => p.z), z0 = Math.min(...zs), z1 = Math.max(...zs);
    proj.forEach(p => {
      const v = vis(p.i); if (!v) return;
      const depth = (p.z - z0) / (z1 - z0 || 1), fade = .25 + .75 * depth;      // nearer = larger and brighter
      const r = (isP(p.i) ? 6.5 : 3.2) * (.7 + .5 * depth) * (p.i === hov3 ? 1.5 : 1);
      ctx.globalAlpha = (v === 1 ? .1 : isP(p.i) ? fade : fade * .6);
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 6.2832);
      ctx.fillStyle = v === 3 && !isP(p.i) ? '#e9e2d8' : colorOf(p.i); ctx.fill();
      if (isP(p.i)) { ctx.lineWidth = v === 3 || p.i === hov3 ? 2 : 1.5; ctx.strokeStyle = v === 3 || p.i === hov3 ? '#fff' : '#1E1A17'; ctx.stroke(); }
      p.r = r;
    });
    ctx.globalAlpha = 1;
    // theme labels at each theme's 3D centre
    ctx.font = '700 ' + (narrow ? 13 : 15) + 'px "Source Sans 3", sans-serif'; ctx.textAlign = 'center'; ctx.lineJoin = 'round';
    const boxes = [];
    C.map(c => {
      const pts = proj.filter(p => IT[p.i].c === c.id);
      const med = k => pts.map(p => p[k]).sort((a, b) => a - b)[pts.length >> 1];
      return pts.length ? {c, mx: med('x'), my: med('y'), z: med('z')} : null;
    }).filter(Boolean).sort((a, b) => b.z - a.z).forEach(({c, mx, my}) => {   // nearest themes labelled first
      if (state.active !== null && c.id !== state.active) return;
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
  cv.addEventListener('pointerup', () => { if (d3 && !d3.moved && hov3 !== null) open(hov3); d3 = null; setTimeout(() => { if (!d3 && !REDUCED.matches) { spin3 = true; wake3(); } }, 4000); });
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
    root.dataset.view = v;
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
    panel.innerHTML = '<h3></h3><p class="tm-psub"></p><ol></ol>';
    panel.querySelector('h3').textContent = c.name;
    panel.querySelector('.tm-psub').textContent = papers.length + ' paper' + (papers.length === 1 ? '' : 's') + ' and ' + (items.length - papers.length) + ' conference abstracts, ' + Math.min(...yrs) + '–' + Math.max(...yrs) + (papers.length ? ':' : '.');
    const ol = panel.querySelector('ol');
    papers.forEach(p => {
      const li = document.createElement('li'), a = document.createElement('a'), s = document.createElement('span');
      a.href = p.u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = p.ti; s.textContent = p.y + (p.v ? ' · ' + p.v.split(',')[0] : '');
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
    b.querySelector('small').textContent = c.papers + ' · ' + (c.n - c.papers);
    b.setAttribute('aria-label', c.name + ': ' + c.papers + ' papers, ' + (c.n - c.papers) + ' conference abstracts. Select to highlight this theme and list its papers.');
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
  const nPap = IT.filter(i => i.t === 'p').length;
  $('.tm-counts').textContent = nPap + ' papers and ' + (N - nPap) + ' conference abstracts';
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
  iceland: ['Holuhraun, Iceland', 64.87, -16.83], reykjanes: ['Reykjanes Peninsula, Iceland', 63.89, -22.27],
  hekla: ['Hekla, Iceland', 63.99, -19.67],
  hawaii: ['Kīlauea, Hawaiʻi', 19.41, -155.28], lapalma: ['La Palma, Canary Islands', 28.61, -17.87],
  arizona: ['San Francisco volcanic field, Arizona', 35.36, -111.5], biosphere2: ['Biosphere 2, Arizona', 32.58, -110.85],
  utah: ['Wildcat Hills, Utah', 38.5, -113.3], newmexico: ['El Malpais, New Mexico', 34.9, -107.95],
  alaska: ['Seward Peninsula, Alaska', 65.5, -164.3], deathvalley: ['Death Valley, California', 36.22, -116.73],
  nz: ['New Zealand', -36.85, 174.76],
  elysium: ['Elysium Planitia', 3, 154.7], amazonis: ['Amazonis Planitia', 24.8, -164], athabasca: ['Athabasca Valles', 8.6, 155],
  hebrus: ['Hebrus Valles', 20, 126.6], hrad: ['Hrad Vallis', 34, 141], tharsis: ['Tharsis', 2, -112],
  copernicus: ['Copernicus crater', 9.6, -20.1], southpole: ['Lunar south pole', -89, 0], gruithuisen: ['Gruithuisen domes', 36.3, -40.5],
  // used by publications only
  askja: ['Askja, Iceland', 65.03, -16.75], laki: ['Laki, Iceland', 64.07, -18.23], kverkfjoll: ['Kverkfjöll, Iceland', 64.65, -16.68],
  myvatn: ['Mývatn, Iceland', 65.6, -17.0], idaho: ['Craters of the Moon, Idaho', 43.42, -113.52],
  cerberus: ['Cerberus Fossae', 9.2, 164.3], aristarchus: ['Aristarchus Plateau', 26, -51], marius: ['Marius Hills', 13.4, -55.9],
  loki: ['Loki Patera', 13, 51], pele: ['Pele', -18.7, 104.9], ahuna: ['Ahuna Mons', -10.5, -43.9], occator: ['Occator crater', 19.8, -120.7]
};
// Worlds (and sites) for each project, matched by the start of its title in js/data.js
const TAGS = [
  ['From Arizona’s volcanoes', [['earth', 'arizona'], ['moon'], ['mars']]],
  ['Magmatic and tectonic processes in Amazonis', [['mars', 'amazonis']]],
  ['Simultaneous Localization', [['moon']]],
  ['Linking cryovolcanism', [['europa']]],
  ['The role of dynamic topography', [['earth']]],
  ['The magmatic evolution of Elysium', [['mars', 'elysium']]],
  ['PANTHER', [['earth', 'deathvalley']]],
  ['From olivine to feldspar', [['mars']]],
  ['Rheology and eruptibility of three-phase', [['europa']]],
  ['VERITAS', [['venus'], ['earth', 'iceland']]],
  ['Revealing the geologic history of Amazonis', [['mars', 'amazonis']]],
  ['From Early Earth to Mars', [['earth', 'biosphere2'], ['mars']]],
  ['Exploring the origin and eruption of silicic lunar', [['moon', 'gruithuisen'], ['earth', 'utah']]],
  ['Planetary data training', [['earth'], ['mars'], ['moon']]],
  ['Preparatory fieldwork', [['earth', 'lapalma']]],
  ['RAVEN', [['earth', 'iceland'], ['mars']]],
  ['Follow the light', [['earth']]],
  ['Infrastructure for planetary analog', [['earth', 'reykjanes']]],
  ['RAPID', [['earth', 'reykjanes']]],
  ['LIFE', [['earth', 'reykjanes']]],
  ['Lunar impact melt', [['moon']]],
  ['Volcanism and interior heating processes on Io', [['io']]],
  ['Sinuous channels', [['earth'], ['mars']]],
  ['Volcanic plains on Mars', [['mars', 'elysium'], ['mars', 'tharsis']]],
  ['Precision geodetic', [['earth', 'iceland']]],
  ['Thermal infrared remote sensing', [['earth', 'hawaii']]],
  ['Thermo-rheological modeling', [['earth', 'hawaii'], ['mars'], ['moon']]],
  ['Rocky roads', [['earth', 'hekla']]],
  ['Pattern to process', [['mars', 'athabasca']]],
  ['Volcanic eruptions and climate on Late Amazonian', [['mars', 'athabasca']]],
  ['Exploring biosignature', [['earth', 'iceland'], ['mars']]],
  ['Evaluating the spread of microorganisms', [['earth', 'iceland']]],
  ['Automating hyperspectral', [['earth', 'nz']]],
  ['3-D modeling of a secondary ancient lunar', [['moon']]],
  ['Artemis III', [['moon', 'southpole']]],
  ['Investigating magma-cryosphere', [['mars', 'hebrus']]],
  ['Self-secondary craters', [['moon', 'copernicus']]],
  ['Io Volcano Observer', [['io']]],
  ['Tephrostratigraphy', [['earth', 'iceland']]],
  ['Geologic mapping of Hrad', [['mars', 'hrad']]],
  ['Quantitative studies of lava flows and eruption', [['earth'], ['mars']]],
  ['Simulation of inflated', [['earth', 'newmexico'], ['mars']]],
  ['External water', [['earth', 'iceland'], ['mars']]],
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
  [/holuhraun|dyngjusand/i, 'earth', 'iceland'], [/askja/i, 'earth', 'askja'], [/laki|eldgj/i, 'earth', 'laki'],
  [/kverkfj/i, 'earth', 'kverkfjoll'], [/m[yý]vatn/i, 'earth', 'myvatn'], [/hekla/i, 'earth', 'hekla'],
  [/fagradalsfjall|reykjanes|geldingadal|sundhn/i, 'earth', 'reykjanes'], [/k[iī]lauea|hawai/i, 'earth', 'hawaii'],
  [/la palma|cumbre vieja/i, 'earth', 'lapalma'], [/el malpais|new mexico/i, 'earth', 'newmexico'], [/seward|alaska/i, 'earth', 'alaska'],
  [/wildcat hills|utah/i, 'earth', 'utah'], [/death valley/i, 'earth', 'deathvalley'], [/craters of the moon|idaho/i, 'earth', 'idaho'],
  [/san francisco volcanic|sp crater/i, 'earth', 'arizona'], [/biosphere 2/i, 'earth', 'biosphere2'],
  [/elysium/i, 'mars', 'elysium'], [/athabasca/i, 'mars', 'athabasca'], [/amazonis/i, 'mars', 'amazonis'], [/hrad/i, 'mars', 'hrad'],
  [/hebrus|hephaestus/i, 'mars', 'hebrus'], [/tharsis|arsia|pavonis|olympus mons/i, 'mars', 'tharsis'], [/cerberus/i, 'mars', 'cerberus'],
  [/copernicus/i, 'moon', 'copernicus'], [/aristarchus/i, 'moon', 'aristarchus'], [/marius/i, 'moon', 'marius'],
  [/gruithuisen/i, 'moon', 'gruithuisen'], [/lunar south pole|south polar region of the moon/i, 'moon', 'southpole'],
  [/loki/i, 'io', 'loki'], [/\bpele\b/i, 'io', 'pele'], [/ahuna/i, 'ceres', 'ahuna'], [/occator/i, 'ceres', 'occator']
];
const PUB_BODIES = [
  ['earth', /iceland|icelandic|earth|terrestrial|arizona|hawai|alaska|antarctic|volcano(es)? in|lava lake/i],
  ['mars', /\bmars\b|martian|hirise/i], ['moon', /\blunar\b|\bmoon\b|apollo/i], ['venus', /venus|veritas/i],
  ['io', /\bio\b|ionian/i], ['europa', /europa/i], ['ceres', /ceres/i]
];
function placePub(it) {
  const t = it.ti.replace(/craters of the moon/ig, 'Craters of the M00n');   // an Idaho park, not the Moon
  const sites = PUB_SITES.filter(r => r[0].test(t)).map(r => [r[1], r[2]]);
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
  let body = null, yaw = 0, pitch = .35, zoom = 1, spin = !REDUCED.matches, markers = [], running = false, onScreen = false;
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
      m.sx = R + x * R * zoom; m.sy = R - y * R * zoom;
      m.vis = !!gl && z > 0.08 && Math.hypot(m.sx - R, m.sy - R) < R - 8;
      if (!m.vis) return;
      const g = groups.find(g => Math.hypot(g[0].sx - m.sx, g[0].sy - m.sy) < 26);
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
      m.el.setAttribute('aria-label', g.map(s => s.name).join('; ') + ': ' + idx.length + ' project' + (idx.length > 1 ? 's' : '') +
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
  function setZoom(z, face) {
    z = Math.max(1, Math.min(ZMAX, z));
    const z0 = zoom, y0 = yaw, p0 = pitch, t0 = performance.now(), D = REDUCED.matches ? 0 : 260;
    let yT = y0, pT = p0;
    if (face) { yT = -face.lon * Math.PI / 180; pT = face.lat * Math.PI / 180; yT = y0 + Math.atan2(Math.sin(yT - y0), Math.cos(yT - y0)); }
    spin = false;
    anim = t => {
      const k = D ? Math.min(1, (t - t0) / D) : 1, e = 1 - Math.pow(1 - k, 3);
      zoom = z0 * Math.pow(z / z0, e); yaw = y0 + (yT - y0) * e; pitch = p0 + (pT - p0) * e;
      if (k >= 1) { anim = null; load(body); }
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
  reset.addEventListener('click', () => { setZoom(1); resumeSpin(); });
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
  const show = {proj: true, pap: true, abs: false};
  function loadPubs() {
    const go = () => { pubs = window.topicMap.items.map(it => ({...it, ...placePub(it)})); counts(); if (body) select(body, true); };
    if (window.topicMap) { go(); return; }
    const sc = document.createElement('script'); sc.src = 'js/topic-map-data.js'; sc.onload = go; document.head.appendChild(sc);
  }
  const pubsFor = (k, t) => pubs.filter(p => p.t === t && p.bodies.has(k)).sort((a, b) => b.y - a.y);
  const toggles = root.querySelector('.wd-show');
  toggles.innerHTML = '<label><input type="checkbox" data-k="proj" checked> Projects</label><label><input type="checkbox" data-k="pap" checked> <i class="wd-key-pap" aria-hidden="true"></i>Papers</label><label><input type="checkbox" data-k="abs"> <i class="wd-key-abs" aria-hidden="true"></i>Conference abstracts</label>';
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
  function counts() {      // the number on each world's tab follows the toggles
    [...tabs.children].forEach(b => {
      const k = b.dataset.k;
      const n = k === 'all' ? projects.length : (show.proj ? forBody(k).length : 0) + (show.pap ? pubsFor(k, 'p').length : 0) + (show.abs ? pubsFor(k, 'a').length : 0);
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
    markers.forEach(m => m.el.remove()); markers = [];
    const sites = {};        // site → list items it covers
    const addSite = (s, li) => (sites[s] = sites[s] || []).push(li);
    list.innerHTML = '<h3></h3><p class="wd-sub"></p><div class="wd-scroll"></div>';
    list.querySelector('h3').textContent = BODIES[k].name;
    const sc = list.querySelector('.wd-scroll');
    const section = (title, n) => { const h = document.createElement('h4'); h.className = 'wd-h4'; h.textContent = title + ' (' + n + ')'; sc.appendChild(h); const ul = document.createElement('ul'); sc.appendChild(ul); return ul; };
    const ps = show.proj ? forBody(k) : [], paps = show.pap ? pubsFor(k, 'p') : [], abss = show.abs ? pubsFor(k, 'a') : [];
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
        if (st.length) li.querySelector('.wd-site').textContent = 'Site: ' + st.map(s => SITES[s][0]).join('; ');
        ul.appendChild(li); st.forEach(s => addSite(s, li));
      });
    }
    [[paps, 'Papers', 'wd-pap'], [abss, 'Conference abstracts', 'wd-abs']].forEach(([arr, title, cls]) => {
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
        if (st.length) { const si = document.createElement('span'); si.className = 'wd-site'; si.textContent = 'Site: ' + st.map(s => SITES[s][0]).join('; '); li.appendChild(si); }
        ul.appendChild(li); st.forEach(s => addSite(s, li));
      });
    });
    if (!ps.length && !paps.length && !abss.length) sc.innerHTML = '<p class="wd-empty">Nothing to show. Turn on projects, papers or conference abstracts above the list.</p>';
    const nSites = Object.keys(sites).length;
    const parts = [];
    if (show.proj) parts.push(plural(ps.length, 'project'));
    if (show.pap) parts.push(plural(paps.length, 'paper'));
    if (show.abs) parts.push(plural(abss.length, 'conference abstract'));
    list.querySelector('.wd-sub').textContent = parts.join(' · ') + (nSites ? ' · ' + plural(nSites, 'study site') + ' on the globe' : '');
    const all = [...sc.querySelectorAll('li')];
    Object.entries(sites).forEach(([s, lis]) => {
      const [name, lat, lon] = SITES[s];
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'wd-mark';
      const m = {el, lat, lon, idx: lis.map(li => all.indexOf(li)), name};
      const ids = () => [...new Set((m.group || [m]).flatMap(g => g.idx))];
      const on = v => {
        el.classList.toggle('on', v);
        all.forEach(li => li.classList.remove('on'));
        if (v) ids().forEach(i => all[i].classList.add('on'));
        if (v) {
          const g = m.group || [m], n = ids().length;
          tip.textContent = g.map(s => s.name).join(' · ') + ' — ' + plural(n, 'item');
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
      const first = Object.keys(sites)[0];             // face the first study site
      if (first) { yaw = -SITES[first][2] * Math.PI / 180; pitch = SITES[first][1] * Math.PI / 180 * .8; }
    }
    wake(); draw();
  }
  size(); select('all'); loadPubs();
}

window.initResearchVisuals = function (page) {
  if (page === 'publications') { const r = document.getElementById('topic-map'); if (r) initTopicMap(r); }
  if (page === 'research') { const r = document.getElementById('research-worlds'); if (r) initWorlds(r); }
};
})();
