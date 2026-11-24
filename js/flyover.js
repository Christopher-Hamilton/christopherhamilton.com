// 3D flyovers of field sites from the group's own UAS surveys (orthomosaic draped on a DTM).
// Hand-written WebGL, no library. Loaded on demand by window.openFlyover(id) (see research-visuals.js).
// To add a site: export <name>.bin/.json/-2048.jpg/-4096.jpg into images/flyover/ (recipe in the update-cv skill), add an entry
// here and a matching line in FLY (js/research-visuals.js).
(function () {
'use strict';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');
const FLYOVERS = {
  hotsprings2015: {
    title: 'Holuhraun lava margin and hot springs, Iceland',
    sub: 'Where the 2014–2015 lava flow-field meets the braided channels of the Jökulsá á Fjöllum',
    base: 'images/flyover/hotsprings-2015',
    credit: 'Orthomosaic and digital terrain model from an unoccupied aircraft system (UAS) survey in 2015 by C.W. Hamilton and S.P. Scheidt.',
    exag: 2
  },
  vent2016: {
    title: 'Baugur, the main vent of the 2014–2015 Holuhraun eruption',
    sub: 'The spatter cone and lava channel a year after the eruption ended',
    base: 'images/flyover/vent-2016',
    credit: 'Merged terrestrial LiDAR and UAS point cloud from 2016: Sutton, Richardson, Whelley, Scheidt and Hamilton (2023), doi.org/10.25422/azu.data.19680372 (CC BY-NC-SA 4.0), gridded to 1 m for the web. The point cloud carries no photographic colour, so the surface is shown as shaded relief.',
    exag: 1
  }
};
window.FLYOVERS = FLYOVERS;

// ---- small matrix helpers (column-major, like WebGL)
const persp = (fov, a, n, f) => { const t = 1 / Math.tan(fov / 2), d = 1 / (n - f); return [t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (f + n) * d, -1, 0, 0, 2 * f * n * d, 0]; };
function lookAt(e, c, u) {
  let z = [e[0] - c[0], e[1] - c[1], e[2] - c[2]]; const zl = Math.hypot(...z); z = z.map(v => v / zl);
  let x = [u[1] * z[2] - u[2] * z[1], u[2] * z[0] - u[0] * z[2], u[0] * z[1] - u[1] * z[0]]; const xl = Math.hypot(...x); x = x.map(v => v / xl);
  const y = [z[1] * x[2] - z[2] * x[1], z[2] * x[0] - z[0] * x[2], z[0] * x[1] - z[1] * x[0]];
  return [x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0,
    -(x[0] * e[0] + x[1] * e[1] + x[2] * e[2]), -(y[0] * e[0] + y[1] * e[1] + y[2] * e[2]), -(z[0] * e[0] + z[1] * e[1] + z[2] * e[2]), 1];
}
const mul = (a, b) => { const o = new Array(16); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { let s = 0; for (let k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; } return o; };

// height h (0–1 of the site's relief), gradient g for lighting; exaggeration is a uniform so it can change live
const VS = 'attribute vec2 p;attribute float h;attribute vec2 g;uniform mat4 m;uniform float ex,rel;varying vec2 uv;varying vec3 n;varying float d;' +
  'void main(){vec3 w=vec3(p.x,h*rel*ex,p.y);uv=vec2(p.x,p.y)*vec2(1.)/1.+.5;n=normalize(vec3(-g.x*ex,1.,-g.y*ex));gl_Position=m*vec4(w,1.);d=gl_Position.w;}';
const FS = 'precision highp float;varying vec2 uv;varying vec3 n;varying float d;uniform sampler2D t;uniform vec3 sun,fog;uniform float far;' +
  'void main(){vec3 c=texture2D(t,uv).rgb;float l=max(dot(normalize(n),sun),0.);float sky=.5+.5*n.y;' +
  'vec3 col=c*(.55+.25*sky*.5+.55*l);float f=smoothstep(far*.35,far,d);gl_FragColor=vec4(mix(col,fog,f*.75),1.);}';

let dlg = null;

function build() {
  dlg = document.createElement('dialog');
  dlg.className = 'fly-dialog';
  dlg.setAttribute('aria-labelledby', 'fly-title');
  dlg.innerHTML = '<div class="fly-head"><div><h2 id="fly-title"></h2><p class="fly-sub"></p></div>' +
    '<button type="button" class="fly-close" aria-label="Close 3D view">&times;</button></div>' +
    '<div class="fly-stage"><canvas tabindex="0" aria-label="3D terrain. Drag to orbit, scroll or pinch to zoom, arrow keys to turn."></canvas><p class="fly-load">Loading terrain…</p></div>' +
    '<div class="fly-bar"><button type="button" class="fly-play" aria-pressed="true">Pause flyover</button>' +
    '<label class="fly-ex">Vertical exaggeration <input type="range" min="1" max="5" step="0.5"><output></output></label></div>' +
    '<p class="fly-credit"></p>';
  document.body.appendChild(dlg);
  dlg.querySelector('.fly-close').addEventListener('click', () => dlg.close());
  dlg.addEventListener('close', () => stop(dlg.querySelector('canvas')));
}

window.openFlyover = function (id) {
  const F = FLYOVERS[id]; if (!F) return;
  if (!dlg) build();
  dlg.querySelector('#fly-title').textContent = F.title;
  dlg.querySelector('.fly-sub').textContent = F.sub;
  dlg.querySelector('.fly-credit').textContent = F.credit;
  dlg.showModal();
  start(F, dlg.querySelector('canvas'), dlg.querySelector('.fly-load'),
    {play: dlg.querySelector('.fly-play'), ex: dlg.querySelector('.fly-ex input'), out: dlg.querySelector('.fly-ex output')});
};
// for the story: draw a flyover into any canvas (no zoom on wheel, so the page still scrolls)
window.mountFlyover = (id, cv, load) => FLYOVERS[id] && start(FLYOVERS[id], cv, load, null);
window.stopFlyover = cv => stop(cv);
function stop(cv) { const s = cv && cv.__fly; if (s) { s.open = false; cancelAnimationFrame(s.raf); } }

async function start(F, cv, load, ui) {
  const prev = cv.__fly;
  if (prev && prev.id === F.base) { if (!prev.open) { prev.open = true; prev.last = 0; loop(prev); } return prev; }
  if (prev) stop(cv);
  load.hidden = false;
  const gl = cv.getContext('webgl', {antialias: true}) ;
  if (!gl || !gl.getExtension('OES_element_index_uint')) { load.textContent = 'Your browser cannot show this 3D view.'; return; }
  const big = Math.min(window.innerWidth, window.innerHeight) > 700 && gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096;
  const [meta, buf, img] = await Promise.all([
    fetch(F.base + '.json').then(r => r.json()),
    fetch(F.base + '.bin').then(r => r.arrayBuffer()),
    new Promise((ok, no) => { const im = new Image(); im.onload = () => ok(im); im.onerror = no; im.src = F.base + '-' + (big ? 4096 : 2048) + '.jpg'; })
  ]);
  const R = meta.rows, Cn = meta.cols, H = new Uint16Array(buf), N = R * Cn;
  const W = (Cn - 1) * meta.cell, D = (R - 1) * meta.cell, S = Math.max(W, D);   // site size in metres; model is scaled to S = 1
  const rel = (meta.zmax - meta.zmin) / S;                                           // relief as a fraction of the width
  // vertices: x, z in model units (centred), height 0–1, gradient for normals
  const P = new Float32Array(N * 2), Hh = new Float32Array(N), G = new Float32Array(N * 2);
  const hv = i => H[i] ? (H[i] - 1) / 65534 : NaN;
  for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
    const i = r * Cn + c; P[2 * i] = (c * meta.cell - W / 2) / S; P[2 * i + 1] = (r * meta.cell - D / 2) / S; Hh[i] = hv(i) || 0;
  }
  const k = rel * S / (2 * meta.cell);       // height units → slope per model step
  for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) {
    const i = r * Cn + c, at = (rr, cc) => { rr = Math.max(0, Math.min(R - 1, rr)); cc = Math.max(0, Math.min(Cn - 1, cc)); const v = hv(rr * Cn + cc); return isNaN(v) ? Hh[i] : v; };
    G[2 * i] = (at(r, c + 1) - at(r, c - 1)) * k; G[2 * i + 1] = (at(r + 1, c) - at(r - 1, c)) * k;
  }
  const idx = [];
  for (let r = 0; r < R - 1; r++) for (let c = 0; c < Cn - 1; c++) {
    const a = r * Cn + c, b = a + 1, d = a + Cn, e = d + 1;
    if (H[a] && H[b] && H[d] && H[e]) idx.push(a, d, b, b, d, e);    // skip cells outside the survey
  }
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS.replace('vec2(1.)/1.', 'vec2(' + (S / W).toFixed(5) + ',' + (S / D).toFixed(5) + ')')));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  const attr = (name, data, size) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); const l = gl.getAttribLocation(pr, name); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, gl.FLOAT, false, 0, 0); };
  attr('p', P, 2); attr('h', Hh, 1); attr('g', G, 2);
  const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(idx), gl.STATIC_DRAW);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, img);
  gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  const an = gl.getExtension('EXT_texture_filter_anisotropic'); if (an) gl.texParameterf(gl.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
  gl.enable(gl.DEPTH_TEST);
  const U = n => gl.getUniformLocation(pr, n);
  const sun = [-.55, .5, -.4], sl = Math.hypot(...sun); gl.uniform3fv(U('sun'), sun.map(v => v / sl));
  gl.uniform3fv(U('fog'), [.62, .66, .70]); gl.uniform1f(U('rel'), rel);
  load.hidden = true;
  const st = {id: F.base, gl, U, n: idx.length, cv, open: true, raf: 0, ex: F.exag || 2, yaw: .7, pitch: .5, dist: .95, fly: !REDUCED.matches, t: 0, last: 0, rel};
  cv.__fly = st;
  controls(st, ui);
  loop(st);
  return st;
}

function controls(s, ui) {
  const cv = s.cv;
  const setPlay = v => { s.fly = v; if (ui) { ui.play.textContent = v ? 'Pause flyover' : 'Play flyover'; ui.play.setAttribute('aria-pressed', String(v)); } };
  setPlay(s.fly);
  if (ui) {
    ui.play.onclick = () => setPlay(!s.fly);
    ui.ex.value = s.ex; ui.out.textContent = '×' + s.ex;
    ui.ex.oninput = () => { s.ex = +ui.ex.value; ui.out.textContent = '×' + s.ex; };
  }
  let drag = null; const ptr = new Map(); let pinch = null;
  cv.onpointerdown = e => { cv.setPointerCapture(e.pointerId); ptr.set(e.pointerId, [e.clientX, e.clientY]); setPlay(false);
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = {d: Math.hypot(a[0] - b[0], a[1] - b[1]), dist: s.dist}; drag = null; } else drag = {x: e.clientX, y: e.clientY, yaw: s.yaw, pitch: s.pitch}; };
  cv.onpointermove = e => { if (!ptr.has(e.pointerId)) return; ptr.set(e.pointerId, [e.clientX, e.clientY]);
    if (pinch && ptr.size === 2) { const [a, b] = [...ptr.values()]; s.dist = Math.max(.25, Math.min(2.5, pinch.dist * pinch.d / Math.hypot(a[0] - b[0], a[1] - b[1]))); return; }
    if (drag) { s.yaw = drag.yaw - (e.clientX - drag.x) * .006; s.pitch = Math.max(.08, Math.min(1.45, drag.pitch + (e.clientY - drag.y) * .005)); } };
  cv.onpointerup = cv.onpointercancel = e => { ptr.delete(e.pointerId); pinch = null; drag = null; };
  cv.onwheel = ui ? e => { e.preventDefault(); setPlay(false); s.dist = Math.max(.25, Math.min(2.5, s.dist * Math.exp(e.deltaY * .0012))); } : null;
  cv.onkeydown = e => { const k = {ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, .06], ArrowDown: [0, -.06]}[e.key];
    if (k) { e.preventDefault(); setPlay(false); s.yaw += k[0]; s.pitch = Math.max(.08, Math.min(1.45, s.pitch + k[1])); }
    if (e.key === '+' || e.key === '=') s.dist = Math.max(.25, s.dist / 1.2); if (e.key === '-') s.dist = Math.min(2.5, s.dist * 1.2); };
}

function loop(s) {
  if (!s || !s.open) return;
  s.raf = requestAnimationFrame(t => {
    const dt = s.last ? Math.min(.05, (t - s.last) / 1000) : 0; s.last = t;
    if (s.fly) {                                     // a slow circuit: swing round, dip low over the margin, rise again
      s.t += dt; s.yaw += dt * .12; s.pitch = .36 + .2 * Math.sin(s.t * .23); s.dist = .78 + .24 * Math.sin(s.t * .17 + 1);
    }
    const gl = s.gl, cv = s.cv, dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = Math.round(cv.clientWidth * dpr), h = Math.round(cv.clientHeight * dpr);
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
    gl.viewport(0, 0, w, h); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const tgt = [0, s.rel * s.ex * .4, 0];
    const eye = [tgt[0] + s.dist * Math.cos(s.pitch) * Math.sin(s.yaw), tgt[1] + s.dist * Math.sin(s.pitch), tgt[2] + s.dist * Math.cos(s.pitch) * Math.cos(s.yaw)];
    const m = mul(persp(.85, w / h, .01, 10), lookAt(eye, tgt, [0, 1, 0]));
    gl.uniformMatrix4fv(s.U('m'), false, new Float32Array(m)); gl.uniform1f(s.U('ex'), s.ex); gl.uniform1f(s.U('far'), s.dist + 1.2);
    gl.drawElements(gl.TRIANGLES, s.n, gl.UNSIGNED_INT, 0);
    loop(s);
  });
}
})();
