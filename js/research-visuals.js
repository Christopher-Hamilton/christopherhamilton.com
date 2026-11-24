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
  const NS = 'http://www.w3.org/2000/svg', W = 1000, H = 640, PAD = 34, TM = window.topicMap;
  const svg = root.querySelector('svg'), tip = root.querySelector('.tm-tip'), stage = root.querySelector('.tm-stage');
  const legend = root.querySelector('.tm-legend'), panel = root.querySelector('.tm-panel'), back = root.querySelector('.tm-back');
  const qIn = root.querySelector('.tm-q'), qOut = root.querySelector('.tm-qcount');
  const yr = root.querySelector('.tm-year'), yrOut = root.querySelector('.tm-yr'), play = root.querySelector('.tm-play');
  const C = TM.clusters.slice().sort((a, b) => b.n - a.n), byId = Object.fromEntries(C.map(c => [c.id, c]));
  C.forEach((c, i) => { c.num = i + 1; });
  const X = v => PAD + v * (W - 2 * PAD), Y = v => PAD + v * (H - 2 * PAD);
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const gH = el('g', {'aria-hidden': 'true'}), gA = el('g', {}), gP = el('g', {}), gL = el('g', {'aria-hidden': 'true'});
  svg.append(gH, gA, gP, gL);
  const state = {active: null, q: '', year: 9999, abs: true};
  let vb = [0, 0, W, H];

  // ---- dots (papers coloured by theme, abstracts small and grey)
  const dots = TM.items.map(it => {
    const paper = it.t === 'p';
    const d = el('circle', {cx: X(it.x), cy: Y(it.yy), r: paper ? 6.5 : 2.6, class: 'tm-dot ' + (paper ? 'tm-paper' : 'tm-abs' + (it.u ? ' linked' : ''))});
    if (paper) {
      d.setAttribute('fill', byId[it.c].color); d.setAttribute('tabindex', '0'); d.setAttribute('role', 'link');
      d.setAttribute('aria-label', it.ti + ' (' + it.y + '), ' + byId[it.c].name);
    }
    d.__it = it; d.__lc = (it.ti + ' ' + (it.v || '')).toLowerCase(); (paper ? gP : gA).appendChild(d); return d;
  });

  // ---- theme regions: a rounded hull around the core of each group (the farthest 15% of strays left out)
  const hull = P => {
    P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of P) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (const p of P.reverse()) { while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  };
  const regions = C.map(c => {
    const pts = TM.items.filter(i => i.c === c.id).map(i => [X(i.x), Y(i.yy)]);
    const med = k => pts.map(p => p[k]).sort((a, b) => a - b)[Math.floor(pts.length / 2)];
    const cx = med(0), cy = med(1);
    const core = pts.map(p => [p, Math.hypot(p[0] - cx, p[1] - cy)]).sort((a, b) => a[1] - b[1])
      .slice(0, Math.max(3, Math.ceil(pts.length * .85))).map(a => a[0]);
    const h = hull(core);
    const path = el('path', {d: 'M' + h.map(p => p.join(',')).join('L') + 'Z', fill: c.color, stroke: c.color, 'stroke-linejoin': 'round', class: 'tm-region'});
    path.__c = c.id; gH.appendChild(path);
    const xs = core.map(p => p[0]), ys = core.map(p => p[1]);
    return {c, path, cx, cy, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]};
  });

  // ---- labels: theme name (wide screens) or its legend number (narrow screens), nudged apart so none overlap
  const labels = regions.map(r => {
    const g = el('g', {class: 'tm-lab'}), t = el('text', {'text-anchor': 'middle', class: 'tm-label'}), n = el('g', {class: 'tm-num'});
    t.textContent = r.c.name;
    const nc = el('circle', {r: 11, fill: r.c.color}), nt = el('text', {'text-anchor': 'middle', 'dominant-baseline': 'central'});
    nt.textContent = r.c.num; n.append(nc, nt); g.append(t, n); g.__c = r.c.id; gL.appendChild(g);
    return {g, t, n, nc, r};
  });
  function placeLabels(k) {
    const narrow = svg.getBoundingClientRect().width < 640;
    root.classList.toggle('tm-narrow', narrow);
    const B = labels.map(L => {
      L.t.style.fontSize = (16 * k) + 'px'; L.t.style.strokeWidth = (4 * k) + 'px';
      L.nc.setAttribute('r', 12 * k); L.n.lastChild.style.fontSize = (13 * k) + 'px';
      const w = narrow ? 26 * k : L.t.getComputedTextLength() + 10 * k, h = narrow ? 26 * k : 22 * k;
      return {L, x: L.r.cx, y: L.r.box[1] - 4 * k, w, h};
    });
    for (let it = 0; it < 60; it++) {        // push overlapping labels apart, vertically first
      let moved = false;
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) {
        const a = B[i], b = B[j], ox = (a.w + b.w) / 2 - Math.abs(a.x - b.x), oy = (a.h + b.h) / 2 - Math.abs(a.y - b.y);
        if (ox > 0 && oy > 0) { const s = a.y <= b.y ? 1 : -1; a.y -= s * oy / 2; b.y += s * oy / 2; moved = true; }
      }
      B.forEach(b => {
        b.x = Math.max(vb[0] + b.w / 2 + 4 * k, Math.min(vb[0] + vb[2] - b.w / 2 - 4 * k, b.x));
        b.y = Math.max(vb[1] + b.h, Math.min(vb[1] + vb[3] - 4 * k, b.y));
      });
      if (!moved) break;
    }
    B.forEach(b => {
      b.L.t.setAttribute('x', b.x); b.L.t.setAttribute('y', b.y);
      b.L.n.setAttribute('transform', 'translate(' + b.x + ',' + (b.y - b.h / 2) + ')');
    });
  }
  // sizes stay constant on screen whatever the width or zoom: papers 7 px, abstracts 3 px, labels 16 px
  function fit() {
    const w = svg.getBoundingClientRect().width;
    if (!w) return;
    const k = vb[2] / w;
    dots.forEach(d => d.setAttribute('r', (d.__it.t === 'p' ? 7 : 3) * k));
    regions.forEach(r => r.path.setAttribute('stroke-width', 30 * k));
    placeLabels(k);
  }

  // ---- filtering: theme, search words and year all combine
  function apply() {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    let hits = 0;
    dots.forEach(d => {
      const it = d.__it, future = it.y > state.year;
      const match = !words.length || words.every(w => d.__lc.includes(w));
      if (words.length && match && !future && (it.t === 'p' || state.abs)) hits++;
      d.classList.toggle('tm-future', future);
      d.classList.toggle('tm-dim', (state.active !== null && it.c !== state.active) || !match);
      d.classList.toggle('tm-hit', !!words.length && match);
    });
    const dimTheme = id => state.active !== null && id !== state.active;
    regions.forEach(r => r.path.classList.toggle('tm-dim', dimTheme(r.c.id) || !!words.length));
    labels.forEach(L => L.g.classList.toggle('tm-dim', dimTheme(L.r.c.id)));
    legend.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.id === state.active)));
    qOut.textContent = words.length ? hits + (hits === 1 ? ' match' : ' matches') : '';
  }

  // ---- zoom to a theme (animated viewBox) and list its papers below the map
  let zAnim = 0;
  function zoomTo(target) {
    const from = vb.slice(), t0 = performance.now(), D = REDUCED.matches ? 0 : 520;
    cancelAnimationFrame(zAnim);
    const step = t => {
      const k = D ? Math.min(1, (t - t0) / D) : 1, e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      vb = from.map((v, i) => v + (target[i] - v) * e);
      svg.setAttribute('viewBox', vb.join(' ')); fit();
      if (k < 1) zAnim = requestAnimationFrame(step);
    };
    zAnim = requestAnimationFrame(step);
  }
  function select(id) {
    state.active = state.active === id ? null : id;
    apply();
    back.hidden = state.active === null;
    root.classList.toggle('tm-zoomed', state.active !== null);
    if (state.active === null) { zoomTo([0, 0, W, H]); panel.hidden = true; return; }
    const r = regions.find(r => r.c.id === id), [x0, y0, x1, y1] = r.box, m = 60;
    let w = Math.max(x1 - x0 + 2 * m, 300), h = Math.max(y1 - y0 + 2 * m, 300 * H / W);
    if (w / h > W / H) h = w * H / W; else w = h * W / H;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    zoomTo([Math.max(0, Math.min(W - w, cx - w / 2)), Math.max(0, Math.min(H - h, cy - h / 2)), Math.min(w, W), Math.min(h, H)]);
    const c = byId[id], items = TM.items.filter(i => i.c === id), papers = items.filter(i => i.t === 'p').sort((a, b) => b.y - a.y);
    const yrs = items.map(i => i.y);
    panel.innerHTML = '<h3></h3><p class="tm-psub"></p><ol></ol>';
    panel.querySelector('h3').textContent = c.num + '. ' + c.name;
    panel.querySelector('.tm-psub').textContent = papers.length + ' paper' + (papers.length === 1 ? '' : 's') + ' and ' +
      (items.length - papers.length) + ' conference abstracts, ' + Math.min(...yrs) + '–' + Math.max(...yrs) + (papers.length ? ':' : '.');
    const ol = panel.querySelector('ol');
    papers.forEach(p => {
      const li = document.createElement('li'), a = document.createElement('a');
      a.href = p.u; a.target = '_blank'; a.rel = 'noopener'; a.textContent = p.ti;
      const s = document.createElement('span'); s.textContent = p.y + (p.v ? ' · ' + p.v.split(',')[0] : '');
      li.append(a, s); ol.appendChild(li);
      const d = dots.find(d => d.__it === p);
      li.addEventListener('mouseenter', () => { d.classList.add('tm-ping'); show(d, p); });
      li.addEventListener('mouseleave', () => { d.classList.remove('tm-ping'); hide(); });
    });
    panel.hidden = false;
  }
  back.addEventListener('click', () => select(state.active));

  // ---- tooltips and opening items
  function show(target, it) {
    tip.innerHTML = '<b></b><span></span>';
    tip.firstChild.textContent = it.ti;
    tip.lastChild.textContent = (it.t === 'p' ? 'Paper' : 'Conference abstract') + ' · ' + (it.v ? it.v + ', ' : '') + it.y + ' · ' + byId[it.c].name;
    const r = stage.getBoundingClientRect(), b = target.getBoundingClientRect(), w = Math.min(330, r.width - 20);
    let x = b.left - r.left + 14; if (x > r.width - w) x = Math.max(6, b.left - r.left - w);
    let y = b.top - r.top + 14; if (y > r.height - 90) y = Math.max(6, b.top - r.top - 100);
    tip.style.left = x + 'px'; tip.style.top = y + 'px'; tip.style.opacity = 1;
  }
  const hide = () => { tip.style.opacity = 0; };
  svg.addEventListener('mouseover', e => { if (e.target.__it) show(e.target, e.target.__it); });
  svg.addEventListener('mouseout', e => { if (e.target.__it) hide(); });
  svg.addEventListener('focusin', e => { if (e.target.__it) show(e.target, e.target.__it); });
  svg.addEventListener('focusout', hide);
  const open = it => { if (it.u) window.open(it.u, '_blank', 'noopener'); };
  svg.addEventListener('click', e => {
    if (e.target.__it) { open(e.target.__it); return; }
    const reg = e.target.closest('.tm-region, .tm-lab'); if (reg) select(reg.__c ?? reg.parentNode.__c);
  });
  gL.addEventListener('click', e => { const g = e.target.closest('.tm-lab'); if (g) select(g.__c); });
  svg.addEventListener('keydown', e => { if (e.target.__it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(e.target.__it); } });

  // ---- legend (numbered to match the map on narrow screens)
  C.forEach(c => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.id = c.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<i aria-hidden="true"></i><span></span><small></small>';
    const i = b.querySelector('i'); i.style.background = c.color; i.textContent = c.num;
    b.querySelector('span').textContent = c.name;
    b.querySelector('small').textContent = c.papers + ' · ' + (c.n - c.papers);
    b.setAttribute('aria-label', c.num + '. ' + c.name + ': ' + c.papers + ' papers, ' + (c.n - c.papers) + ' conference abstracts. Zoom to this theme.');
    b.addEventListener('click', () => select(c.id));
    b.addEventListener('mouseenter', () => { if (state.active === null) labels.forEach(L => L.g.classList.toggle('tm-soft', L.r.c.id !== c.id)), regions.forEach(r => r.path.classList.toggle('tm-glow', r.c.id === c.id)); });
    b.addEventListener('mouseleave', () => { labels.forEach(L => L.g.classList.remove('tm-soft')); regions.forEach(r => r.path.classList.remove('tm-glow')); });
    li.appendChild(b); legend.appendChild(li);
  });

  // ---- search
  qIn.addEventListener('input', () => { state.q = qIn.value; apply(); });

  // ---- timeline: drag the slider or press Play to watch the work build up year by year
  const years = TM.items.map(i => i.y), y0 = Math.min(...years), y1 = Math.max(...years);
  yr.min = y0; yr.max = y1; yr.value = y1;
  const setYear = (v, pop) => {
    const prev = state.year; state.year = +v; yr.value = v;
    yrOut.textContent = (+v >= y1 ? y0 + '–' + y1 : y0 + '–' + v);
    if (pop) dots.forEach(d => { if (d.__it.y > prev && d.__it.y <= state.year) { d.classList.remove('tm-pop'); void d.getBBox(); d.classList.add('tm-pop'); } });
    apply();
  };
  yr.addEventListener('input', () => { stopPlay(); setYear(yr.value, true); });
  let timer = 0;
  function stopPlay() { clearInterval(timer); timer = 0; play.textContent = 'Play'; play.setAttribute('aria-pressed', 'false'); }
  play.addEventListener('click', () => {
    if (timer) { stopPlay(); return; }
    play.textContent = 'Pause'; play.setAttribute('aria-pressed', 'true');
    let y = state.year >= y1 ? y0 - 1 : state.year;
    setYear(y, false);
    timer = setInterval(() => { y++; setYear(y, !REDUCED.matches); if (y >= y1) stopPlay(); }, 520);
  });

  root.querySelector('.tm-toggle').addEventListener('change', e => { state.abs = e.target.checked; gA.style.display = e.target.checked ? '' : 'none'; apply(); });
  const nP = TM.items.filter(i => i.t === 'p').length;
  root.querySelector('.tm-counts').textContent = nP + ' papers and ' + (TM.items.length - nP) + ' conference abstracts';
  fit(); setYear(y1, false);
  window.addEventListener('resize', fit);

  // first view: the dots gather into their themes
  if (!REDUCED.matches) {
    root.classList.add('tm-intro');
    dots.forEach(d => { d.style.transitionDelay = Math.round(d.__it.x * 700 + Math.random() * 250) + 'ms'; });
    new IntersectionObserver((es, o) => {
      if (!es[0].isIntersecting) return;
      o.disconnect(); requestAnimationFrame(() => root.classList.add('tm-in'));
      setTimeout(() => { dots.forEach(d => { d.style.transitionDelay = ''; }); root.classList.remove('tm-intro', 'tm-in'); }, 1800);
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
  europa: {name: 'Europa', tone: [1, .96, .9],    contrast: 1.25, hi: 1}
};
const ORDER = ['earth', 'mars', 'moon', 'venus', 'io', 'europa'];
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
  copernicus: ['Copernicus crater', 9.6, -20.1], southpole: ['Lunar south pole', -89, 0], gruithuisen: ['Gruithuisen domes', 36.3, -40.5]
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

  // ---- tabs: All (the full project lists), then one per world
  ['all', ...ORDER].forEach(k => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'wd-tab-' + k; b.dataset.k = k;
    b.setAttribute('aria-controls', k === 'all' ? 'wd-all-panel' : 'wd-panel');
    b.innerHTML = (k === 'all' ? '' : '<span class="wd-swatch" aria-hidden="true"></span>') + '<span></span><small></small>';
    if (k !== 'all') b.querySelector('.wd-swatch').style.backgroundImage = 'url(images/globes/sm/' + k + '.jpg)';
    b.querySelector('span:not(.wd-swatch)').textContent = k === 'all' ? 'All' : BODIES[k].name;
    b.querySelector('small').textContent = k === 'all' ? projects.length : forBody(k).length;
    b.addEventListener('click', () => select(k));
    tabs.appendChild(b);
  });
  tabs.addEventListener('keydown', e => {
    const bs = [...tabs.children], i = bs.indexOf(document.activeElement);
    if (i < 0 || !['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const n = e.key === 'Home' ? 0 : e.key === 'End' ? bs.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length;
    bs[n].focus(); select(bs[n].dataset.k);
  });
  function select(k) {
    [...tabs.children].forEach(b => { const on = b.dataset.k === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    root.classList.toggle('wd-show-all', k === 'all');
    allPanel.hidden = k !== 'all';
    if (k === 'all') { body = null; return; }
    body = k; zoom = 1; anim = null; spin = !REDUCED.matches; zoomOut.disabled = true; zoomIn.disabled = false; shown.key = null;
    if (gl) { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 34, 30, 255])); }
    size(); load(k);
    list.setAttribute('aria-labelledby', 'wd-tab-' + k);
    markers.forEach(m => m.el.remove()); markers = [];
    const ps = forBody(k), sites = {};
    ps.forEach((p, i) => p.tags.filter(t => t[0] === k && t[1]).forEach(t => (sites[t[1]] = sites[t[1]] || []).push(i)));
    list.innerHTML = '<h3></h3><p class="wd-sub"></p><ul></ul>';
    list.querySelector('h3').textContent = BODIES[k].name;
    const nSites = Object.keys(sites).length;
    list.querySelector('.wd-sub').textContent = ps.length + ' project' + (ps.length === 1 ? '' : 's') +
      (nSites ? ' · ' + nSites + ' study site' + (nSites === 1 ? '' : 's') + ' on the globe' : ' · no single study site');
    const ul = list.querySelector('ul');
    const lis = ps.map(p => {
      const li = document.createElement('li');
      const site = p.tags.filter(t => t[0] === k && t[1]).map(t => SITES[t[1]][0]).join('; ');
      li.innerHTML = '<span class="wd-role"></span><span class="wd-state"></span><strong></strong><span class="wd-fund"></span>' + (site ? '<span class="wd-site"></span>' : '');
      li.querySelector('.wd-role').textContent = p.role;
      li.querySelector('.wd-state').textContent = p.active ? 'Active' : 'Completed';
      li.querySelector('strong').textContent = p.title;
      li.querySelector('.wd-fund').textContent = p.fund;
      if (site) li.querySelector('.wd-site').textContent = 'Site: ' + site;
      ul.appendChild(li); return li;
    });
    Object.entries(sites).forEach(([s, idx]) => {
      const [name, lat, lon] = SITES[s];
      const el = document.createElement('button');
      el.type = 'button'; el.className = 'wd-mark';
      const m = {el, lat, lon, idx, name};
      const ids = () => [...new Set((m.group || [m]).flatMap(g => g.idx))];
      const on = v => {
        el.classList.toggle('on', v);
        lis.forEach(li => li.classList.remove('on'));
        if (v) ids().forEach(i => lis[i].classList.add('on'));
        if (v) {
          const g = m.group || [m], n = ids().length;
          tip.textContent = g.map(s => s.name).join(' · ') + ' — ' + n + ' project' + (n > 1 ? 's' : '');
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
        const first = lis[ids()[0]];
        ids().forEach(i => { lis[i].classList.remove('flash'); void lis[i].offsetWidth; lis[i].classList.add('flash'); });
        ul.scrollTo({top: first.offsetTop - 6, behavior: smooth()});
        if (window.matchMedia('(max-width: 860px)').matches) first.scrollIntoView({behavior: smooth(), block: 'center'});
      });
      box.appendChild(el); markers.push(m);
    });
    const first = Object.keys(sites)[0];               // face the first study site
    if (first) { yaw = -SITES[first][2] * Math.PI / 180; pitch = SITES[first][1] * Math.PI / 180 * .8; }
    wake(); draw();
  }
  size(); select('all');
}

window.initResearchVisuals = function (page) {
  if (page === 'publications') { const r = document.getElementById('topic-map'); if (r) initTopicMap(r); }
  if (page === 'research') { const r = document.getElementById('research-worlds'); if (r) initWorlds(r); }
};
})();
