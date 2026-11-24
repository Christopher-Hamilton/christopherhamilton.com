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
  const legend = root.querySelector('.tm-legend'), C = TM.clusters, byId = Object.fromEntries(C.map(c => [c.id, c]));
  const X = v => PAD + v * (W - 2 * PAD), Y = v => PAD + v * (H - 2 * PAD);
  const el = (n, a) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); return e; };
  const gA = el('g', {}), gP = el('g', {}), gL = el('g', {'aria-hidden': 'true'});
  svg.append(gA, gP, gL);
  let active = null;
  const dots = TM.items.map(it => {
    const paper = it.t === 'p';
    const d = el('circle', {cx: X(it.x), cy: Y(it.yy), r: paper ? 6.5 : 2.6, class: 'tm-dot ' + (paper ? 'tm-paper' : 'tm-abs' + (it.u ? ' linked' : ''))});
    if (paper) {
      d.setAttribute('fill', byId[it.c].color); d.setAttribute('tabindex', '0'); d.setAttribute('role', 'link');
      d.setAttribute('aria-label', it.ti + ' (' + it.y + '), ' + byId[it.c].name);
    }
    d.__it = it; (paper ? gP : gA).appendChild(d); return d;
  });
  // label each theme just above the bulk of its group (stray points ignored), kept inside the frame
  const anchors = C.map(c => {
    const pts = TM.items.filter(i => i.c === c.id), xs = pts.map(i => X(i.x)).sort((a, b) => a - b), mx = xs[Math.floor(xs.length / 2)];
    const near = pts.filter(i => Math.abs(X(i.x) - mx) < 140), ys = (near.length > 2 ? near : pts).map(i => Y(i.yy)).sort((a, b) => a - b);
    const t = el('text', {'text-anchor': 'middle', class: 'tm-label'});
    t.textContent = c.name; t.__c = c.id; gL.appendChild(t);
    return {t, mx, top: ys[Math.floor(ys.length * 0.1)]};
  });
  // sizes in screen pixels, whatever width the map is drawn at: labels 16 px, papers 7 px, abstracts 3 px (radius)
  function fit() {
    const w = svg.getBoundingClientRect().width;
    if (!w) return;
    const k = W / w;
    dots.forEach(d => d.setAttribute('r', (d.__it.t === 'p' ? 7 : 3) * k));
    anchors.forEach(({t, mx, top}) => {
      t.style.fontSize = (16 * k) + 'px'; t.style.strokeWidth = (4 * k) + 'px';
      t.setAttribute('x', mx); t.setAttribute('y', Math.max(18 * k, top - 10 * k));
      const half = t.getComputedTextLength() / 2 + 6;
      if (mx - half < 6) t.setAttribute('x', 6 + half);
      if (mx + half > W - 6) t.setAttribute('x', W - 6 - half);
    });
  }
  fit();
  window.addEventListener('resize', fit);
  function show(target, it) {
    tip.innerHTML = '<b></b><span></span>';
    tip.firstChild.textContent = it.ti;
    tip.lastChild.textContent = (it.t === 'p' ? 'Paper' : 'Conference abstract') + ' · ' + (it.v ? it.v + ', ' : '') + it.y + ' · ' + byId[it.c].name;
    const r = stage.getBoundingClientRect(), b = target.getBoundingClientRect(), w = Math.min(330, r.width - 20);
    let x = b.left - r.left + 14; if (x > r.width - w) x = Math.max(6, b.left - r.left - w);
    tip.style.left = x + 'px'; tip.style.top = (b.top - r.top + 14) + 'px'; tip.style.opacity = 1;
  }
  const hide = () => { tip.style.opacity = 0; };
  svg.addEventListener('mouseover', e => { if (e.target.__it) show(e.target, e.target.__it); });
  svg.addEventListener('mouseout', e => { if (e.target.__it) hide(); });
  svg.addEventListener('focusin', e => { if (e.target.__it) show(e.target, e.target.__it); });
  svg.addEventListener('focusout', hide);
  const open = it => { if (it.u) window.open(it.u, '_blank', 'noopener'); };
  svg.addEventListener('click', e => { if (e.target.__it) open(e.target.__it); });
  svg.addEventListener('keydown', e => { if (e.target.__it && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); open(e.target.__it); } });
  function highlight(id) {
    active = active === id ? null : id;
    dots.forEach(d => d.classList.toggle('tm-dim', active !== null && d.__it.c !== active));
    gL.querySelectorAll('text').forEach(t => t.classList.toggle('tm-dim', active !== null && t.__c !== active));
    legend.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.id === active)));
  }
  C.slice().sort((a, b) => b.n - a.n).forEach(c => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.type = 'button'; b.dataset.id = c.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = '<i aria-hidden="true"></i><span></span><small></small>';
    b.querySelector('i').style.background = c.color;
    b.querySelector('span').textContent = c.name;
    b.querySelector('small').textContent = c.papers + ' · ' + (c.n - c.papers);
    b.setAttribute('aria-label', c.name + ': ' + c.papers + ' papers, ' + (c.n - c.papers) + ' conference abstracts');
    b.addEventListener('click', () => highlight(c.id));
    li.appendChild(b); legend.appendChild(li);
  });
  const nP = TM.items.filter(i => i.t === 'p').length;
  root.querySelector('.tm-counts').textContent = nP + ' papers and ' + (TM.items.length - nP) + ' conference abstracts';
  root.querySelector('.tm-toggle').addEventListener('change', e => { gA.style.display = e.target.checked ? '' : 'none'; });
}

/* =====================================================================
   RESEARCH WORLDS: projects on planetary globes
   ===================================================================== */
const BODIES = {
  earth:  {name: 'Earth',  img: 'images/globes/earth.jpg',  tone: [1, 1, 1],      contrast: 1},
  mars:   {name: 'Mars',   img: 'images/globes/mars.jpg',   tone: [1, 1, 1],      contrast: 1.15},
  moon:   {name: 'Moon',   img: 'images/globes/moon.jpg',   tone: [1, 1, 1],      contrast: 1.2},
  venus:  {name: 'Venus',  img: 'images/globes/venus.jpg',  tone: [1, 1, 1],      contrast: 1.05},
  io:     {name: 'Io',     img: 'images/globes/io.jpg',     tone: [1, 1, 1],      contrast: 1.1},
  europa: {name: 'Europa', img: 'images/globes/europa.jpg', tone: [1, .95, .86], contrast: 1.6}
};
const ORDER = ['earth', 'mars', 'moon', 'venus', 'io', 'europa'];
// Study sites: name, latitude, longitude (east positive). Approximate centres.
const SITES = {
  iceland: ['Holuhraun, Iceland', 64.87, -16.83], reykjanes: ['Reykjanes Peninsula, Iceland', 63.89, -22.27],
  hawaii: ['Kīlauea, Hawaiʻi', 19.41, -155.28], lapalma: ['La Palma, Canary Islands', 28.61, -17.87],
  arizona: ['San Francisco volcanic field, Arizona', 35.36, -111.5], biosphere2: ['Biosphere 2, Arizona', 32.58, -110.85],
  utah: ['Wildcat Hills, Utah', 38.5, -113.3], newmexico: ['El Malpais, New Mexico', 34.9, -107.95],
  alaska: ['Seward Peninsula, Alaska', 65.5, -164.3], deathvalley: ['Death Valley, California', 36.22, -116.73],
  nz: ['New Zealand', -36.85, 174.76],
  elysium: ['Elysium Planitia', 3, 154.7], amazonis: ['Amazonis Planitia', 24.8, -164], athabasca: ['Athabasca Valles', 8.6, 155],
  hebrus: ['Hebrus Valles', 20, 126.6], hrad: ['Hrad Vallis', 34, 141], tharsis: ['Tharsis', 2, -112],
  copernicus: ['Copernicus crater', 9.6, -20.1], southpole: ['Lunar south pole', -89, 0], gruithuisen: ['Gruithuisen domes', 36.3, -40.5],
  loki: ['Loki Patera', 13, 51], pele: ['Pele', -18.7, 104.9]
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
  ['Infrastructure for planetary analog', [['earth']]],
  ['RAPID', [['earth', 'reykjanes']]],
  ['LIFE', [['earth', 'reykjanes']]],
  ['Lunar impact melt', [['moon']]],
  ['Volcanism and interior heating processes on Io', [['io', 'loki']]],
  ['Sinuous channels', [['earth'], ['mars']]],
  ['Volcanic plains on Mars', [['mars', 'elysium'], ['mars', 'tharsis']]],
  ['Precision geodetic', [['earth', 'iceland']]],
  ['Thermal infrared remote sensing', [['earth', 'hawaii']]],
  ['Thermo-rheological modeling', [['earth', 'hawaii'], ['mars'], ['moon']]],
  ['Rocky roads', [['earth']]],
  ['Pattern to process', [['mars', 'athabasca']]],
  ['Volcanic eruptions and climate on Late Amazonian', [['mars', 'athabasca']]],
  ['Exploring biosignature', [['earth', 'iceland'], ['mars']]],
  ['Evaluating the spread of microorganisms', [['earth', 'iceland']]],
  ['Automating hyperspectral', [['earth', 'nz']]],
  ['3-D modeling of a secondary ancient lunar', [['moon']]],
  ['Artemis III', [['moon', 'southpole']]],
  ['Investigating magma-cryosphere', [['mars', 'hebrus']]],
  ['Self-secondary craters', [['moon', 'copernicus']]],
  ['Io Volcano Observer', [['io', 'pele']]],
  ['Tephrostratigraphy', [['earth', 'iceland']]],
  ['Geologic mapping of Hrad', [['mars', 'hrad']]],
  ['Quantitative studies of lava flows and eruption', [['earth'], ['mars']]],
  ['Simulation of inflated', [['earth', 'newmexico'], ['mars']]],
  ['External water', [['earth', 'iceland'], ['mars']]],
  ['X-ray diffraction', [['mars'], ['moon']]],
  ['Pahoehoe lava on Mars and Earth', [['earth', 'newmexico'], ['mars']]],
  ['Tidal Heating', [['io']]],
  ['Field investigation of basaltic', [['earth', 'iceland']]],
  ['Quantitative measurements of active Ionian', [['io', 'loki']]],
  ['Stereo-derived topography', [['earth', 'alaska'], ['mars']]],
  ['Melt decompaction', [['mars']]]
];

const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}';
const FS = 'precision highp float;varying vec2 v;uniform sampler2D t;uniform float yaw,pitch,contrast;uniform vec3 tone;' +
  'void main(){float r2=dot(v,v);' +
  'if(r2>1.){float a=smoothstep(1.06,1.,sqrt(r2));gl_FragColor=vec4(.95,.55,.3,a*.10);return;}' +
  'vec3 n=vec3(v.x,v.y,sqrt(1.-r2));' +
  'float cp=cos(-pitch),sp=sin(-pitch);vec3 a=vec3(n.x,cp*n.y-sp*n.z,sp*n.y+cp*n.z);' +
  'float cy=cos(-yaw),sy=sin(-yaw);vec3 b=vec3(cy*a.x+sy*a.z,a.y,-sy*a.x+cy*a.z);' +
  'float lat=asin(clamp(b.y,-1.,1.)),lon=atan(b.x,b.z);' +
  'vec3 c=texture2D(t,vec2((lon+3.14159265)/6.2831853,(1.5707963-lat)/3.14159265)).rgb;' +
  'c=clamp((c-.5)*contrast+.5,0.,1.)*tone;' +
  'float l=.35+.75*max(dot(n,normalize(vec3(-.45,.35,.82))),0.);float rim=pow(1.-n.z,3.)*.25;' +
  'gl_FragColor=vec4(c*l+vec3(.95,.6,.35)*rim*.3,1.);}';

function initWorlds(root) {
  if (root.dataset.ready) return;
  root.dataset.ready = '1';
  const tabs = root.querySelector('.wd-tabs'), list = root.querySelector('.wd-list'), box = root.querySelector('.wd-globe');
  const cv = box.querySelector('canvas'), tip = box.querySelector('.wd-tip');
  const projects = [...activeProjects.map(p => ({p, active: true})), ...completedProjects.map(p => ({p, active: false}))]
    .map(({p, active}) => { const t = TAGS.find(([k]) => p[1].startsWith(k)); return {role: p[0], title: p[1], fund: p[2], active, tags: t ? t[1] : []}; });
  const forBody = k => projects.filter(p => p.tags.some(t => t[0] === k));

  // ---- WebGL globe (falls back to the project list alone)
  const gl = cv.getContext('webgl', {antialias: true, premultipliedAlpha: false});
  let U = () => null, tex = null;
  if (gl) {
    const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const prog = gl.createProgram();
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(prog); gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    U = n => gl.getUniformLocation(prog, n);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 34, 30, 255]));
  } else {
    root.classList.add('wd-noglobe');
  }
  const cache = {};
  let body = 'earth', yaw = 0, pitch = .35, spin = !REDUCED.matches, markers = [], running = false, onScreen = false;
  function use(im) { if (!gl) return; gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); }
  function load(k) {
    if (!gl) return;
    if (cache[k]) { use(cache[k]); return; }
    const im = new Image(); im.onload = () => { cache[k] = im; if (body === k) use(im); }; im.src = BODIES[k].img;
  }
  function size() { if (!gl) return; const d = Math.min(2, window.devicePixelRatio || 1), w = box.clientWidth; cv.width = cv.height = Math.round(w * d); gl.viewport(0, 0, cv.width, cv.height); }
  function draw() {
    if (gl) {
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(U('yaw'), yaw); gl.uniform1f(U('pitch'), pitch);
      gl.uniform1f(U('contrast'), BODIES[body].contrast); gl.uniform3fv(U('tone'), BODIES[body].tone);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    }
    const R = box.clientWidth / 2;
    markers.forEach(m => { // inverse of the shader's Ry(-yaw)·Rx(-pitch): Ry(+yaw), then Rx(+pitch)
      const la = m.lat * Math.PI / 180, lo = m.lon * Math.PI / 180;
      let x = Math.cos(la) * Math.sin(lo), y = Math.sin(la), z = Math.cos(la) * Math.cos(lo);
      const cy = Math.cos(yaw), sy = Math.sin(yaw); [x, z] = [cy * x + sy * z, -sy * x + cy * z];
      const cp = Math.cos(pitch), sp = Math.sin(pitch); [y, z] = [cp * y - sp * z, sp * y + cp * z];
      m.el.style.left = (R + x * R) + 'px'; m.el.style.top = (R - y * R) + 'px';
      m.el.hidden = !(gl && z > 0.08);
    });
  }
  let last = 0;
  function frame(t) {
    if (!onScreen || box.offsetParent === null) { running = false; return; }   // page hidden or scrolled away: stop
    const dt = last ? Math.min(.05, (t - last) / 1000) : 0; last = t;
    if (spin) yaw += dt * .18;
    draw(); requestAnimationFrame(frame);
  }
  function wake() { if (!running && onScreen) { running = true; last = 0; requestAnimationFrame(frame); } }
  new IntersectionObserver(es => { onScreen = es[0].isIntersecting; wake(); }).observe(box);
  let drag = null;
  box.addEventListener('pointerdown', e => {
    if (e.target.classList.contains('wd-mark')) return;
    drag = {x: e.clientX, y: e.clientY, yaw, pitch}; spin = false; box.setPointerCapture(e.pointerId);
  });
  box.addEventListener('pointermove', e => {
    if (!drag) return; const s = Math.PI / box.clientWidth;
    yaw = drag.yaw + (e.clientX - drag.x) * s; pitch = Math.max(-1.4, Math.min(1.4, drag.pitch + (e.clientY - drag.y) * s)); wake();
  });
  box.addEventListener('pointerup', () => { drag = null; });
  box.addEventListener('pointercancel', () => { drag = null; });
  // keyboard: arrow keys turn the globe
  box.addEventListener('keydown', e => {
    const k = {ArrowLeft: [-.2, 0], ArrowRight: [.2, 0], ArrowUp: [0, -.15], ArrowDown: [0, .15]}[e.key];
    if (!k || e.target !== box) return; e.preventDefault(); spin = false;
    yaw += k[0]; pitch = Math.max(-1.4, Math.min(1.4, pitch + k[1])); draw();
  });
  window.addEventListener('resize', () => { size(); draw(); });

  // ---- tabs (one per world), markers and the project list
  ORDER.forEach(k => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.id = 'wd-tab-' + k; b.dataset.k = k; b.setAttribute('aria-controls', 'wd-panel');
    b.innerHTML = '<span class="wd-swatch" aria-hidden="true"></span><span></span><small></small>';
    b.querySelector('.wd-swatch').style.backgroundImage = 'url(' + BODIES[k].img + ')';
    b.children[1].textContent = BODIES[k].name;
    b.querySelector('small').textContent = forBody(k).length;
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
    body = k; load(k);
    [...tabs.children].forEach(b => { const on = b.dataset.k === k; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    list.setAttribute('aria-labelledby', 'wd-tab-' + k);
    markers.forEach(m => m.el.remove()); markers = [];
    const ps = forBody(k), sites = {};
    ps.forEach((p, i) => p.tags.filter(t => t[0] === k && t[1]).forEach(t => (sites[t[1]] = sites[t[1]] || []).push(i)));
    list.innerHTML = '<h3></h3><p class="wd-sub"></p><ul></ul>';
    list.querySelector('h3').textContent = BODIES[k].name;
    list.querySelector('.wd-sub').textContent = ps.length + ' project' + (ps.length === 1 ? '' : 's');
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
      el.setAttribute('aria-label', name + ': ' + idx.length + ' project' + (idx.length > 1 ? 's' : ''));
      const on = v => {
        el.classList.toggle('on', v); idx.forEach(i => lis[i].classList.toggle('on', v));
        if (v) {
          tip.textContent = name + ' · ' + idx.length + ' project' + (idx.length > 1 ? 's' : '');
          const R = box.clientWidth, x = parseFloat(el.style.left);
          tip.style.left = (x > R * .6 ? x - 12 - tip.offsetWidth : x + 12) + 'px'; tip.style.top = (parseFloat(el.style.top) + 12) + 'px';
        }
        tip.style.opacity = v ? 1 : 0;
      };
      el.addEventListener('mouseenter', () => on(true)); el.addEventListener('mouseleave', () => on(false));
      el.addEventListener('focus', () => on(true)); el.addEventListener('blur', () => on(false));
      el.addEventListener('click', () => lis[idx[0]].scrollIntoView({behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'nearest'}));
      box.appendChild(el); markers.push({el, lat, lon});
    });
    const first = Object.keys(sites)[0];               // face the first study site
    if (first) { yaw = -SITES[first][2] * Math.PI / 180; pitch = SITES[first][1] * Math.PI / 180 * .8; }
    draw();
  }
  size(); select('earth');
}

window.initResearchVisuals = function (page) {
  if (page === 'publications') { const r = document.getElementById('topic-map'); if (r) initTopicMap(r); }
  if (page === 'research') { const r = document.getElementById('research-worlds'); if (r) initWorlds(r); }
};
})();
