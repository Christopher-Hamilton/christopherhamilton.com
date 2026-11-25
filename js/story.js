// Scroll-driven stories (Research page). A sticky stage shows one scene per step: a globe, a photo or a 3D flyover.
// Steps are plain HTML in index.html (.st-step with data-kind = globe | img | fly). Scenes load only as the reader
// approaches them, so the page stays fast. Loaded by research-visuals.js when the story section comes near.
(function () {
'use strict';
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)');

// ---- a small globe: one textured sphere, turned to a given place
const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p;gl_Position=vec4(p,0.,1.);}';
const FS = 'precision highp float;varying vec2 v;uniform sampler2D t;uniform float yaw,pitch,zoom;' +
  'void main(){vec2 q=v/zoom;float r2=dot(q,q);if(r2>1.){float a=smoothstep(1.05,1.,sqrt(r2));gl_FragColor=vec4(.6,.75,.95,a*.10);return;}' +
  'vec3 n=vec3(q,sqrt(1.-r2));float cp=cos(-pitch),sp=sin(-pitch);vec3 a=vec3(n.x,cp*n.y-sp*n.z,sp*n.y+cp*n.z);' +
  'float cy=cos(-yaw),sy=sin(-yaw);vec3 b=vec3(cy*a.x+sy*a.z,a.y,-sy*a.x+cy*a.z);' +
  'float lat=asin(clamp(b.y,-1.,1.)),lon=atan(b.x,b.z);vec3 c=texture2D(t,vec2((lon+3.14159265)/6.2831853,(1.5707963-lat)/3.14159265)).rgb;' +
  'float l=.35+.75*max(dot(n,normalize(vec3(-.5,.35,.8))),0.);gl_FragColor=vec4(c*l+vec3(.5,.6,.8)*pow(1.-n.z,3.)*.12,1.);}';
function globe(cv) {
  const gl = cv.getContext('webgl', {premultipliedAlpha: false}); if (!gl) return null;
  const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); return o; };
  const pr = gl.createProgram(); gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr); gl.useProgram(pr);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const l = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0);
  gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
  const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
  [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T].forEach(k => gl.texParameteri(gl.TEXTURE_2D, k, gl.CLAMP_TO_EDGE));
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  const U = n => gl.getUniformLocation(pr, n);
  const g = {yaw: 0, pitch: .3, zoom: .9, img: null, run: 0};
  g.setTexture = src => new Promise(ok => {
    if (g.img === src) return ok();
    const im = new Image(); im.onload = () => { gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, im); g.img = src; ok(); }; im.src = src;
  });
  g.draw = () => {
    const d = Math.min(2, window.devicePixelRatio || 1), s = Math.round(Math.min(cv.clientWidth, cv.clientHeight) * d);
    if (cv.width !== s) { cv.width = cv.height = s; }
    gl.viewport(0, 0, s, s); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(U('yaw'), g.yaw); gl.uniform1f(U('pitch'), g.pitch); gl.uniform1f(U('zoom'), g.zoom);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  };
  // fly to a place: ease yaw, pitch and zoom; then drift very slowly
  g.go = (lat, lon, zoom) => {
    cancelAnimationFrame(g.run);
    const y0 = g.yaw, p0 = g.pitch, z0 = g.zoom, t0 = performance.now(), D = REDUCED.matches ? 0 : 1800;
    let yT = -lon * Math.PI / 180; yT = y0 + Math.atan2(Math.sin(yT - y0), Math.cos(yT - y0));
    const pT = lat * Math.PI / 180;
    const step = t => {
      const k = D ? Math.min(1, (t - t0) / D) : 1, e = k < .5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      g.yaw = y0 + (yT - y0) * e; g.pitch = p0 + (pT - p0) * e; g.zoom = z0 + (zoom - z0) * e;
      if (k >= 1 && !REDUCED.matches) g.yaw += .00025;     // the gentlest drift, so it reads as a world, not a picture
      g.draw(); if (g.live) g.run = requestAnimationFrame(step);
    };
    g.live = true; g.run = requestAnimationFrame(step);
  };
  g.stop = () => { g.live = false; cancelAnimationFrame(g.run); };
  return g;
}

function loadScript(src) {
  src += '?v=' + (window.SITE_V || '');
  return new Promise(ok => { if (document.querySelector('script[src="' + src + '"]')) { const t = setInterval(() => { if (window.mountFlyover) { clearInterval(t); ok(); } }, 50); return; }
    const s = document.createElement('script'); s.src = src; s.onload = ok; document.head.appendChild(s); });
}

function initStory(root) {
  if (root.dataset.ready) return; root.dataset.ready = '1';
  const steps = [...root.querySelectorAll('.st-step')];
  const gcv = root.querySelector('.st-globe'), fcv = root.querySelector('.st-fly'), img = root.querySelector('.st-img');
  const cap = root.querySelector('.st-cap'), load = root.querySelector('.st-load'), dots = root.querySelector('.st-dots');
  const G = globe(gcv);
  let cur = -1;
  steps.forEach((s, i) => { const b = document.createElement('button'); b.type = 'button'; b.setAttribute('aria-label', 'Step ' + (i + 1) + ': ' + s.querySelector('h3').textContent); b.addEventListener('click', () => s.scrollIntoView({behavior: REDUCED.matches ? 'auto' : 'smooth', block: 'center'})); dots.appendChild(b); });
  const pin = root.querySelector('.st-pin');
  const show = which => { [gcv, fcv, img].forEach(el => el.classList.toggle('on', el === which)); pin.classList.toggle('on', which === gcv); };
  function prefetch(s) {              // warm the cache for the next scene
    if (!s) return; const d = s.dataset;
    if (d.kind === 'img') { const i = new Image(); i.src = d.src; }
    if (d.kind === 'globe') { const i = new Image(); i.src = 'images/globes/' + d.tex + '.jpg'; }
    if (d.kind === 'fly') loadScript('js/flyover.js').then(() => { const F = window.FLYOVERS[d.id]; if (F) { fetch(F.base + '.json'); fetch(F.base + '.bin'); } });
  }
  async function activate(i) {
    if (i === cur) return; cur = i;
    const s = steps[i], d = s.dataset;
    steps.forEach((x, j) => x.classList.toggle('on', j === i));
    [...dots.children].forEach((b, j) => b.setAttribute('aria-current', j === i ? 'step' : 'false'));
    cap.textContent = d.cap || '';
    if (d.kind !== 'fly' && window.stopFlyover) window.stopFlyover(fcv);
    if (d.kind !== 'globe' && G) G.stop();
    if (d.kind === 'globe' && G) {
      load.hidden = false; await G.setTexture('images/globes/' + d.tex + '.jpg'); if (cur !== i) return; load.hidden = true;
      show(gcv); G.go(+d.lat, +d.lon, +(d.zoom || 1));
    } else if (d.kind === 'img') {
      img.alt = d.alt || ''; img.src = d.src; show(img);
    } else if (d.kind === 'fly') {
      load.hidden = false; load.textContent = 'Loading terrain…';
      await loadScript('js/flyover.js'); if (cur !== i) return;
      show(fcv); await window.mountFlyover(d.id, fcv, load);
    }
    prefetch(steps[i + 1]);
  }
  // the step that crosses the reading line becomes active: mid-screen beside the stage, or below the stage on phones
  const narrow = window.matchMedia('(max-width: 860px)').matches;
  const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) activate(steps.indexOf(e.target)); }),
    {rootMargin: narrow ? '-66% 0px -30% 0px' : '-45% 0px -45% 0px'});
  steps.forEach(s => io.observe(s));
  // pause the scene when the story is off screen
  new IntersectionObserver(es => { if (!es[0].isIntersecting) { if (G) G.stop(); if (window.stopFlyover) window.stopFlyover(fcv); cur = -1; } }).observe(root);
}

window.initStory = initStory;
})();
