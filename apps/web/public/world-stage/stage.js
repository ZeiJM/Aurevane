/* ---------- Navigation map: world, camera, walking ---------- */
const T = 64, WCOLS = 26, WROWS = 18;
let VROWS = 9, VCOLS = 13; /* widens with the screen: tile size follows the map height, extra width shows extra tiles */
const EAST = 212, NORTH = 87;
const NS = 'http://www.w3.org/2000/svg';
function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const rand = rng(20261010);
const px = (v) => Math.round(v * T * 10) / 10;

function smooth(points) {
  const p = points.map(([x, y]) => [x * T, y * T]);
  let d = `M${p[0][0]},${p[0][1]}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}
function sample(points, steps = 24) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++)
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      out.push([points[i][0] + (points[i + 1][0] - points[i][0]) * t, points[i][1] + (points[i + 1][1] - points[i][1]) * t]);
    }
  return out;
}
const river = [[15.2, -1], [14.6, 3], [15.6, 6], [15.4, 9], [16.8, 12], [16.4, 15.5], [17, 19]];
const road = [[-1, 6.6], [4, 7.1], [9, 6.8], [14, 7], [18, 7.2], [27, 6.8]];
const riverPts = sample(river), roadPts = sample(road);
const lake = { x: 6, y: 12.6, rx: 3.3, ry: 2.2 };
const houses = [
  { x: 5.1, y: 2.6, w: 2.2, h: 1.4, c: '#b98a5a', r: '#7a3b2e', chim: true },
  { x: 8.0, y: 1.7, w: 2.4, h: 1.5, c: '#c9a470', r: '#6c3a30', chim: true },
  { x: 11.0, y: 2.9, w: 1.9, h: 1.4, c: '#a97a52', r: '#5d4a3a', chim: true },
  { x: 5.4, y: 4.7, w: 1.7, h: 1.2, c: '#c2a27c', r: '#83402f', chim: false },
  { x: 10.2, y: 4.9, w: 2.1, h: 1.3, c: '#b48b5f', r: '#6a3a2d', chim: true },
  { x: 2.7, y: 3.7, w: 1.7, h: 1.2, c: '#bd9566', r: '#5b4c3e', chim: false },
];

const blocked = new Set();
const key = (x, y) => x + ',' + y;
const onBridge = (x, y) => y === 7 && x >= 13 && x <= 17;
for (let y = 0; y < WROWS; y++)
  for (let x = 0; x < WCOLS; x++) {
    const cx = x + 0.5, cy = y + 0.5;
    const inLake = ((cx - lake.x) / (lake.rx + 0.05)) ** 2 + ((cy - lake.y) / (lake.ry + 0.05)) ** 2 < 1;
    const inRiver = riverPts.some(([rx, ry]) => Math.hypot(rx - cx, ry - cy) < 0.8) && !onBridge(x, y);
    if (inLake || inRiver) blocked.add(key(x, y));
  }
/* a building blocks only the tiles whose centre lies under its footprint, so doors and yards stay walkable */
const footprintTiles = (x, y, w, h) => {
  const out = [];
  for (let ty = Math.floor(y); ty < Math.ceil(y + h); ty++)
    for (let tx = Math.floor(x); tx < Math.ceil(x + w); tx++) if (tx + 0.5 > x + 0.05 && tx + 0.5 < x + w - 0.05 && ty + 0.5 > y + 0.05 && ty + 0.5 < y + h - 0.05) out.push(key(tx, ty));
  if (!out.length) out.push(key(Math.floor(x + w / 2), Math.floor(y + h / 2)));
  return out;
};
houses.forEach((h) => footprintTiles(h.x, h.y, h.w, h.h).forEach((k) => blocked.add(k)));

const world = document.getElementById('world');
const add = (parent, tag, attrs = {}, html) => {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  if (html) el.innerHTML = html;
  parent.appendChild(el);
  return el;
};

/* ---------- Painted art kit: textures drawn once on canvas, shared gradients, builders for every prop ---------- */
const ART = (() => {
  const gsvg = document.createElementNS(NS, 'svg');
  gsvg.setAttribute('width', '0'); gsvg.setAttribute('height', '0'); gsvg.setAttribute('aria-hidden', 'true'); gsvg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  document.body.prepend(gsvg);
  const defsA = add(gsvg, 'defs');
  defsA.insertAdjacentHTML('beforeend', '<filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter></filter>'.replace('</filter></filter>','</filter>') + '<radialGradient id="puffG"><stop offset="0" stop-color="#b9b6ae" stop-opacity=".9"/><stop offset="1" stop-color="#b9b6ae" stop-opacity="0"/></radialGradient>');
  const R = rng(90210);
  const hv = (a, b) => (((Math.imul(a + 11, 73856093) ^ Math.imul(b + 7, 19349663)) >>> 0) % 1000) / 1000;
  const scatter = (w, h, n, one) => {
    for (let i = 0; i < n; i++) {
      const p = { a: R(), b: R(), c: R(), d: R() }, bx = R() * w, by = R() * h;
      for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) one(bx + ox, by + oy, p);
    }
  };
  const tex = (w, h, k, draw) => {
    const c = document.createElement('canvas'); c.width = w * k; c.height = h * k;
    const x = c.getContext('2d'); x.scale(k, k); draw(x, w, h);
    return c.toDataURL('image/png');
  };
  const rrect = (x, a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
  const imgPattern = (id, w, h, url) => {
    const p = add(defsA, 'pattern', { id, width: w, height: h, patternUnits: 'userSpaceOnUse' });
    const im = add(p, 'image', { width: w, height: h }); im.setAttribute('href', url);
    return p;
  };

  /* ground textures: painted blades, moss blotches and flecks. 208 x 192 divides a 13 x 9 tile sector, so chunks join seamlessly */
  const GROUND = {
    temperate: { base: '#18352a', dark: '#0d241c', mid: '#21442f', light: '#2f5a38', hi: '#55723f', spec: ['#6b5a3a', '#4a4030', '#7a7a68', '#8a6a4a', '#a89a6a'], n: 150, dirt: '#3a2e1e' },
    meadow: { base: '#26482f', dark: '#17321f', mid: '#33583a', light: '#46703f', hi: '#7a9248', spec: ['#8a7a4a', '#6a5a3a', '#a89a6a', '#7a6a8a'], n: 150, dirt: '#40331f' },
    woods: { base: '#122a21', dark: '#0a1c16', mid: '#1a3a2b', light: '#264a34', hi: '#48663f', spec: ['#5a4428', '#3a2c1c', '#6a5230', '#4a3a24'], n: 220, dirt: '#2a2016' },
    rocky: { base: '#33473b', dark: '#243529', mid: '#425a49', light: '#587460', hi: '#8a9e86', spec: ['#7a7e78', '#5e625e', '#989c94'], n: 200, dirt: '#3a3328' },
  };
  Object.entries(GROUND).forEach(([id, s]) => {
    const url = tex(208, 192, 2, (x, w, h) => {
      x.fillStyle = s.base; x.fillRect(0, 0, w, h);
      scatter(w, h, 22, (px, py, p) => {
        const r = 30 + p.a * 70, g = x.createRadialGradient(px, py, 0, px, py, r), col = p.b > 0.62 ? s.dirt : p.b > 0.3 ? s.dark : s.mid;
        g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2);
      });
      scatter(w, h, 1500, (px, py, p) => {
        const L = 3 + p.a * 6, ang = -Math.PI / 2 + (p.b - 0.5) * 1.2, col = [s.dark, s.mid, s.light, s.light, s.hi][Math.floor(p.c * 5)];
        x.strokeStyle = col + (p.c > 0.8 ? 'cc' : '88'); x.lineWidth = 0.9; x.beginPath(); x.moveTo(px, py);
        x.quadraticCurveTo(px + Math.cos(ang) * L * 0.5 + 2 * (p.b - 0.5), py + Math.sin(ang) * L * 0.5, px + Math.cos(ang) * L, py + Math.sin(ang) * L); x.stroke();
      });
      scatter(w, h, s.n, (px, py, p) => { x.fillStyle = s.spec[Math.floor(p.c * s.spec.length)] + 'cc'; x.beginPath(); x.ellipse(px, py, 0.9 + p.a * 2, 0.7 + p.a * 1.3, 0, 0, 6.3); x.fill(); });
    });
    imgPattern('tx-' + id, 208, 192, url);
  });

  /* cobbles: 16 px stones on a 64 px tile */
  imgPattern('cobble', 64, 64, tex(64, 64, 3, (x, w, h) => {
    x.fillStyle = '#1c1913'; x.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) for (let col = 0; col < 4; col++) {
      const off = row % 2 ? 8 : 0, jw = 13.4 + hv(row, col) * 1.5, jh = 12.8 + hv(col, row + 9) * 1.6, lum = hv(row * 3, col * 5);
      for (const ox of [-64, 0, 64]) {
        const sx = col * 16 + off + ox + 1, sy = row * 16 + 1, g = x.createLinearGradient(sx, sy, sx + jw * 0.4, sy + jh);
        g.addColorStop(0, lum > 0.5 ? '#a89a78' : '#93866a'); g.addColorStop(1, lum > 0.5 ? '#6f6350' : '#5e5444');
        x.fillStyle = g; rrect(x, sx, sy, jw, jh, 4.6); x.fill();
        x.strokeStyle = 'rgba(255,246,220,.38)'; x.lineWidth = 0.8; x.beginPath(); x.moveTo(sx + 3, sy + 1.3); x.lineTo(sx + jw - 3.5, sy + 1.3); x.stroke();
        if (lum > 0.82) { x.fillStyle = 'rgba(86,130,70,.55)'; x.beginPath(); x.ellipse(sx + 4, sy + jh - 2, 3.4, 1.6, 0, 0, 6.3); x.fill(); }
      }
    }
  }));

  /* roof shingles and thatch */
  const shingles = (c) => tex(48, 40, 3, (x, w, h) => {
    x.fillStyle = c[1]; x.fillRect(0, 0, w, h);
    for (let row = -1; row < 5; row++) for (let col = -1; col < 5; col++) {
      const off = ((row % 2) + 2) % 2 ? 6 : 0, sx = col * 12 + off, sy = row * 10, v = hv(((row % 4) + 4) % 4, ((col % 4) + 4) % 4);
      x.fillStyle = v < 0.33 ? c[0] : v < 0.7 ? c[1] : c[2];
      x.beginPath(); x.moveTo(sx, sy); x.lineTo(sx + 12, sy); x.lineTo(sx + 12, sy + 6); x.quadraticCurveTo(sx + 12, sy + 12, sx + 6, sy + 12); x.quadraticCurveTo(sx, sy + 12, sx, sy + 6); x.closePath(); x.fill();
      x.strokeStyle = 'rgba(0,0,0,.4)'; x.lineWidth = 0.9; x.stroke();
      x.strokeStyle = 'rgba(255,255,255,.2)'; x.beginPath(); x.moveTo(sx + 1.5, sy + 1); x.lineTo(sx + 10.5, sy + 1); x.stroke();
    }
  });
  imgPattern('rf-slate', 48, 40, shingles(['#33456c', '#293858', '#41537c']));
  imgPattern('rf-red', 48, 40, shingles(['#6a2a30', '#552026', '#7c3a3c']));
  imgPattern('rf-teal', 48, 40, shingles(['#245a58', '#1d4748', '#2f706a']));
  imgPattern('rf-thatch', 48, 40, tex(48, 40, 3, (x, w, h) => {
    x.fillStyle = '#9c7e44'; x.fillRect(0, 0, w, h);
    scatter(w, h, 240, (px, py, p) => { x.strokeStyle = ['#c8a964', '#7d6334', '#b8995a'][Math.floor(p.c * 3)] + 'bb'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (p.b - 0.5) * 3, py + 9 + p.a * 5); x.stroke(); });
    x.strokeStyle = 'rgba(40,24,8,.35)'; x.lineWidth = 1.4; for (let i = 0; i < 4; i++) { x.beginPath(); x.moveTo(0, i * 10 + 9); x.lineTo(w, i * 10 + 9); x.stroke(); }
  }));

  /* water: two drifting caustic layers (SMIL pattern drift, paused by the motion switch) */
  const waterTex = (col, alpha, lw) => tex(104, 96, 2, (x, w, h) => {
    scatter(w, h, 18, (px, py, p) => {
      x.strokeStyle = col; x.globalAlpha = alpha * (0.5 + p.a); x.lineWidth = lw * (0.6 + p.b); x.beginPath(); x.moveTo(px, py);
      x.quadraticCurveTo(px + 9, py + (p.d - 0.5) * 8, px + 18 + p.c * 12, py + (p.b - 0.5) * 3); x.quadraticCurveTo(px + 30, py + (p.a - 0.5) * 6, px + 38 + p.c * 10, py); x.stroke();
    });
  });
  const wa = imgPattern('wa', 104, 96, waterTex('#bfe0dc', 0.26, 1.1));
  add(wa, 'animateTransform', { attributeName: 'patternTransform', type: 'translate', from: '0 0', to: '104 96', dur: '20s', repeatCount: 'indefinite' });
  const wb = imgPattern('wb', 104, 96, waterTex('#031f30', 0.4, 1.6));
  add(wb, 'animateTransform', { attributeName: 'patternTransform', type: 'translate', from: '0 0', to: '-104 96', dur: '30s', repeatCount: 'indefinite' });

  defsA.insertAdjacentHTML('beforeend', `
    <radialGradient id="lg-oak" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#5a7c46"/><stop offset=".45" stop-color="#27553a"/><stop offset="1" stop-color="#0e2a20"/></radialGradient>
    <radialGradient id="lg-oak2" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#3e6a45"/><stop offset=".5" stop-color="#1c452f"/><stop offset="1" stop-color="#0a2219"/></radialGradient>
    <radialGradient id="lg-pine" cx=".3" cy=".25" r=".95"><stop offset="0" stop-color="#35705a"/><stop offset=".5" stop-color="#173f36"/><stop offset="1" stop-color="#08201f"/></radialGradient>
    <radialGradient id="lg-amber" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#c8a04a"/><stop offset=".5" stop-color="#8a5e24"/><stop offset="1" stop-color="#47260f"/></radialGradient>
    <radialGradient id="lg-glowtree" cx=".35" cy=".3" r=".85"><stop offset="0" stop-color="#a6f6e8"/><stop offset=".5" stop-color="#2aa59a"/><stop offset="1" stop-color="#0c4a52"/></radialGradient>
    <linearGradient id="lg-trunk" x1="0" x2="1"><stop offset="0" stop-color="#4e3a2a"/><stop offset=".5" stop-color="#31211a"/><stop offset="1" stop-color="#150c0a"/></linearGradient>
    <radialGradient id="shadowG"><stop offset="0" stop-color="#020d0a" stop-opacity=".62"/><stop offset="1" stop-color="#020d0a" stop-opacity="0"/></radialGradient>
    <radialGradient id="lg-patchD"><stop offset="0" stop-color="#02120e" stop-opacity=".28"/><stop offset="1" stop-color="#02120e" stop-opacity="0"/></radialGradient>
    <radialGradient id="lg-patchM"><stop offset="0" stop-color="#d8e07a" stop-opacity=".16"/><stop offset="1" stop-color="#d8e07a" stop-opacity="0"/></radialGradient>
    <radialGradient id="lg-patchR"><stop offset="0" stop-color="#9aa6a2" stop-opacity=".24"/><stop offset="1" stop-color="#9aa6a2" stop-opacity="0"/></radialGradient>
    <radialGradient id="lg-patchG"><stop offset="0" stop-color="#0c3a2c" stop-opacity=".34"/><stop offset="1" stop-color="#0c3a2c" stop-opacity="0"/></radialGradient>
    <radialGradient id="lg-patchL"><stop offset="0" stop-color="#b6dc7a" stop-opacity=".16"/><stop offset="1" stop-color="#b6dc7a" stop-opacity="0"/></radialGradient>
    <linearGradient id="lg-wall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e4d4b0"/><stop offset="1" stop-color="#a69272"/></linearGradient>
    <linearGradient id="lg-wallS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#a1a8bb"/><stop offset="1" stop-color="#586079"/></linearGradient>
    <linearGradient id="lg-roofshade" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".24"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
    <linearGradient id="lg-eave" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity=".5"/><stop offset="1" stop-color="#000" stop-opacity="0"/></linearGradient>
    <radialGradient id="lg-water" cx=".38" cy=".32" r=".8"><stop offset="0" stop-color="#2d7f8a"/><stop offset=".55" stop-color="#17566a"/><stop offset="1" stop-color="#0a2e40"/></radialGradient>
    <radialGradient id="lg-glowwin"><stop offset="0" stop-color="#ffcf7a" stop-opacity=".85"/><stop offset="1" stop-color="#ffcf7a" stop-opacity="0"/></radialGradient>
    <radialGradient id="lg-glowteal"><stop offset="0" stop-color="#8ff0e0" stop-opacity=".8"/><stop offset="1" stop-color="#8ff0e0" stop-opacity="0"/></radialGradient>
    <linearGradient id="lg-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e6cf90"/><stop offset=".5" stop-color="#a8802e"/><stop offset="1" stop-color="#5a3e14"/></linearGradient>
    <linearGradient id="lg-silver" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#eef7fb"/><stop offset=".5" stop-color="#8fb4c8"/><stop offset="1" stop-color="#42606f"/></linearGradient>
    <linearGradient id="lg-violet" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e2d6ff"/><stop offset=".5" stop-color="#8a6fd0"/><stop offset="1" stop-color="#352566"/></linearGradient>
    <radialGradient id="lg-medal" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#16596e"/><stop offset="1" stop-color="#05202b"/></radialGradient>
    <radialGradient id="lg-medalV" cx=".4" cy=".3" r=".9"><stop offset="0" stop-color="#2c2058"/><stop offset="1" stop-color="#0d0a24"/></radialGradient>
    <linearGradient id="lg-rays" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff2c9" stop-opacity=".85"/><stop offset="1" stop-color="#fff2c9" stop-opacity="0"/></linearGradient>
    <linearGradient id="lg-field1" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8aa34e"/><stop offset="1" stop-color="#5d7d3a"/></linearGradient>
    <linearGradient id="lg-field2" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#c3a457"/><stop offset="1" stop-color="#8d7236"/></linearGradient>`);

  imgPattern('grain', 64, 64, tex(64, 64, 2, (x, w, h) => {
    scatter(w, h, 420, (px, py, p) => { x.fillStyle = p.c > 0.5 ? 'rgba(255,244,214,.10)' : 'rgba(0,0,0,.16)'; x.fillRect(px, py, 1 + p.a * 1.2, 1 + p.b * 1.2); });
  }));
  defsA.insertAdjacentHTML('beforeend', '<radialGradient id="lg-vig" cx=".5" cy=".5" r=".75"><stop offset=".55" stop-color="#020c12" stop-opacity="0"/><stop offset="1" stop-color="#020c12" stop-opacity=".42"/></radialGradient><linearGradient id="lg-grade" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffbe6e" stop-opacity=".14"/><stop offset=".5" stop-color="#ffbe6e" stop-opacity="0"/><stop offset="1" stop-color="#0a2c4a" stop-opacity=".3"/></linearGradient>');
  const shadow = (g, x, y, rx, ry) => add(g, 'ellipse', { cx: x, cy: y, rx, ry, fill: 'url(#shadowG)' });
  const A = {};

  /* one shared ground texture everywhere so sector borders never show a seam; biome character comes from soft blotches kept well inside each tile */
  A.ground = (parent, x, y, w, h, biome, rr) => {
    add(parent, 'rect', { x, y, width: w, height: h, fill: 'url(#tx-temperate)' });
    const n = Math.ceil((w * h) / 52000), mix = { temperate: ['D', 'L', 'D'], woods: ['D', 'D', 'D', 'G'], meadow: ['L', 'L', 'M', 'D'], rocky: ['R', 'R', 'D', 'L'] }[biome] || ['D', 'L'];
    const grad = { D: 'url(#lg-patchD)', L: 'url(#lg-patchL)', M: 'url(#lg-patchM)', R: 'url(#lg-patchR)', G: 'url(#lg-patchG)' };
    for (let i = 0; i < n; i++) {
      const rx = 60 + rr() * 110, ry = 44 + rr() * 80;
      const cx = x + rx + rr() * Math.max(0, w - 2 * rx), cy = y + ry + rr() * Math.max(0, h - 2 * ry);
      add(parent, 'ellipse', { cx, cy, rx, ry, fill: grad[mix[Math.floor(rr() * mix.length)]] });
    }
  };

  const blobs = (list) => list.map(([cx, cy, r]) => `M${(cx - r).toFixed(1)},${cy.toFixed(1)}a${r.toFixed(1)},${r.toFixed(1)} 0 1 0 ${(2 * r).toFixed(1)},0a${r.toFixed(1)},${r.toFixed(1)} 0 1 0 ${(-2 * r).toFixed(1)},0z`).join('');
  const PAL = {
    oak: ['#0b2018', '#12301f', '#1b412a', '#2a5535', '#436b3e', '#6f8a4a'],
    amber: ['#2a1a0c', '#4a2f14', '#6a4618', '#8a6220', '#a8802e', '#c9a24c'],
    glow: ['#08262a', '#0f3a3c', '#17504c', '#24706a', '#3f9a8a', '#8fe0cc'],
    pine: ['#06161a', '#0b2224', '#123432', '#1c4a42', '#2c6254', '#4f8570'],
  };
  A.tree = (parent, x, y, s, pal, i) => {
    const kind = pal > 0.985 ? 'glow' : pal > 0.93 ? 'amber' : pal < 0.36 ? 'pine' : 'oak';
    const g = add(parent, 'g', { class: 'tree sway' + (i % 3 ? '' : ' slow'), style: `animation-delay:${(i * 0.37) % 5}s` });
    shadow(g, x + 20 * s, y + 10 * s, 42 * s, 13 * s);
    const sp = rng(i * 977 + 13), P = PAL[kind];
    if (kind === 'pine') {
      add(g, 'polygon', { points: `${x - 4 * s},${y + 12 * s} ${x - 2 * s},${y - 14 * s} ${x + 2 * s},${y - 14 * s} ${x + 4 * s},${y + 12 * s}`, fill: 'url(#lg-trunk)' });
      for (let k = 0; k < 5; k++) {
        const top = y - (16 + k * 13) * s, hw = (31 - k * 5.4) * s, bot = top + 26 * s;
        let pts = `${x},${top - 3 * s}`;
        for (let t = 1; t <= 4; t++) pts += ` ${x + hw * (t / 4) + (sp() - 0.5) * 3 * s},${top + (bot - top) * (t / 4) * 0.92 + (t % 2 ? 0 : 4 * s)}`;
        pts += ` ${x + hw * 0.5},${bot} ${x},${bot - 3 * s} ${x - hw * 0.5},${bot}`;
        for (let t = 4; t >= 1; t--) pts += ` ${x - hw * (t / 4) + (sp() - 0.5) * 3 * s},${top + (bot - top) * (t / 4) * 0.92 + (t % 2 ? 0 : 4 * s)}`;
        add(g, 'polygon', { points: pts, fill: P[2] });
        add(g, 'polygon', { points: `${x},${top - 3 * s} ${x + hw},${bot - 2 * s} ${x + hw * 0.5},${bot} ${x},${bot - 3 * s}`, fill: P[0], opacity: 0.7 });
        add(g, 'polygon', { points: `${x},${top - 3 * s} ${x - hw * 0.7},${top + (bot - top) * 0.62} ${x - hw * 0.25},${top + (bot - top) * 0.5}`, fill: P[4], opacity: 0.55 });
      }
      return;
    }
    add(g, 'polygon', { points: `${x - 11 * s},${y + 15 * s} ${x - 5 * s},${y + 4 * s} ${x - 3.5 * s},${y - 26 * s} ${x + 3.5 * s},${y - 26 * s} ${x + 5 * s},${y + 4 * s} ${x + 11 * s},${y + 15 * s}`, fill: 'url(#lg-trunk)' });
    add(g, 'path', { d: `M${x - 1 * s},${y + 8 * s} v-24 M${x + 2 * s},${y + 4 * s} v-14`, stroke: '#0e0806', 'stroke-width': 1.1, opacity: 0.7, fill: 'none' });
    const lobes = [[0, -36, 21], [-17, -25, 17], [17, -25, 17], [-8, -49, 15], [11, -45, 14], [-22, -40, 11], [23, -38, 11], [0, -24, 19]];
    const sets = [[], [], [], [], []];
    lobes.forEach(([lx, ly, lr]) => {
      sets[0].push([x + lx * s, y + ly * s, lr * s]);
      const n = 7 + Math.floor(lr / 3);
      for (let k = 0; k < n; k++) {
        const a = sp() * 6.28, d = sp() * lr * 0.82, px = lx + Math.cos(a) * d, py = ly + Math.sin(a) * d * 0.86, lit = (-(Math.cos(a) * 0.7 + Math.sin(a) * 0.7) + 1) / 2 + sp() * 0.35;
        const tier = Math.min(4, Math.max(1, Math.floor(lit * lit * 3.6 + 0.4)));
        sets[tier].push([x + px * s, y + py * s, (2 + sp() * 2.6) * s]);
      }
    });
    add(g, 'path', { d: blobs(sets[0]), fill: P[1] });
    add(g, 'ellipse', { cx: x + 3 * s, cy: y - 14 * s, rx: 26 * s, ry: 9 * s, fill: P[0], opacity: 0.55 });
    add(g, 'path', { d: blobs(sets[1]), fill: P[2] });
    add(g, 'path', { d: blobs(sets[2]), fill: P[3] });
    add(g, 'path', { d: blobs(sets[3]), fill: P[4] });
    add(g, 'path', { d: blobs(sets[4]), fill: P[5], opacity: 0.55 });
    if (kind === 'glow') {
      add(g, 'circle', { class: 'lamp', cx: x, cy: y - 36 * s, r: 66 * s, fill: 'url(#lg-glowteal)', style: 'mix-blend-mode:screen' });
      for (let k = 0; k < 5; k++) add(g, 'circle', { class: 'glowcap', cx: x + (k - 2) * 9 * s, cy: y - (24 + (k % 3) * 9) * s, r: 2.4 * s, fill: '#d8fff8' });
    }
  };

  /* gothic three-quarter buildings: stone ground floor, timber-framed upper floor, steep slate roof with gold finials, dormers and warm lit windows */
  A.house = (parent, x, y, w, hh, o) => {
    const g = add(parent, 'g', { class: 'bld' });
    const st = o.style, sd = w * 0.2, fy = y + hh * 0.44, wb = y + hh * 0.98, roof = 'url(#rf-' + o.roof + ')';
    const mid = fy + (wb - fy) * 0.5;
    add(g, 'ellipse', { cx: x + w * 0.7, cy: wb + 4, rx: w * 0.82, ry: 16, fill: 'url(#shadowG)' });
    /* side wall (in shade) */
    add(g, 'polygon', { points: `${x + w},${fy} ${x + w + sd},${fy - sd * 0.35} ${x + w + sd},${wb - sd * 0.35} ${x + w},${wb}`, fill: '#2c2a2a' });
    add(g, 'polygon', { points: `${x + w},${fy} ${x + w + sd},${fy - sd * 0.35} ${x + w + sd},${wb - sd * 0.35} ${x + w},${wb}`, fill: 'url(#lg-wallS)', opacity: 0.45 });
    add(g, 'rect', { class: 'win', x: x + w + sd * 0.3, y: mid - sd * 0.45, width: sd * 0.4, height: sd * 0.6, rx: 2, transform: `skewY(-19)`, style: `transform-origin:${x + w}px ${mid}px` });
    /* ground floor stone */
    add(g, 'rect', { x, y: mid, width: w, height: wb - mid, fill: '#5d5b60' });
    add(g, 'rect', { x, y: mid, width: w, height: wb - mid, fill: 'url(#lg-eave)', opacity: 0.4 });
    for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) add(g, 'rect', { x: x + c * (w / 6) + (r % 2) * 5 - 2, y: mid + 2 + r * ((wb - mid) / 3), width: w / 6 - 2, height: (wb - mid) / 3 - 2, rx: 1.5, fill: '#fff', opacity: 0.05 + ((r * 7 + c * 3) % 5) * 0.012 });
    /* timber-framed upper floor */
    add(g, 'rect', { x, y: fy, width: w, height: mid - fy, fill: st === 2 ? '#6a6870' : '#a89a78' });
    add(g, 'rect', { x, y: fy, width: w, height: mid - fy, fill: 'url(#lg-eave)', opacity: 0.45 });
    if (st !== 2) {
      [x + 1, x + w * 0.33, x + w * 0.66, x + w - 1].forEach((bx) => add(g, 'line', { x1: bx, y1: fy, x2: bx, y2: mid, stroke: '#2a1c16', 'stroke-width': 3.4 }));
      add(g, 'line', { x1: x, y1: mid, x2: x + w, y2: mid, stroke: '#2a1c16', 'stroke-width': 4 });
      add(g, 'line', { x1: x + 1, y1: mid, x2: x + w * 0.33, y2: fy + 2, stroke: '#2a1c16', 'stroke-width': 2.4 });
      add(g, 'line', { x1: x + w - 1, y1: mid, x2: x + w * 0.66, y2: fy + 2, stroke: '#2a1c16', 'stroke-width': 2.4 });
    }
    /* door with stone surround and lantern */
    const dw = w * 0.17, dh = (wb - mid) * 0.92, dx = x + w * 0.5 - dw / 2, dy = wb - 2;
    add(g, 'path', { d: `M${dx - 3},${dy} v${-dh + dw / 2} a${dw / 2 + 3},${dw / 2 + 3} 0 0 1 ${dw + 6},0 v${dh - dw / 2} z`, fill: '#7a7880', stroke: '#1d1c20', 'stroke-width': 1.4 });
    add(g, 'path', { d: `M${dx},${dy} v${-dh + dw / 2} a${dw / 2},${dw / 2} 0 0 1 ${dw},0 v${dh - dw / 2} z`, fill: '#3a2416', stroke: '#140c08', 'stroke-width': 1.2 });
    add(g, 'path', { d: `M${dx + dw / 2},${dy} v${-dh} M${dx},${dy - dh * 0.45} h${dw}`, stroke: '#1a0e08', 'stroke-width': 1.1, fill: 'none' });
    add(g, 'circle', { cx: dx + dw * 0.8, cy: dy - dh * 0.4, r: 1.5, fill: '#c9a24c' });
    add(g, 'rect', { x: dx - 6, y: dy - 1, width: dw + 12, height: 5, fill: '#6a6a72' });
    add(g, 'circle', { class: 'lamp', cx: dx + dw + 13, cy: dy - dh * 0.65, r: 34, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
    add(g, 'rect', { x: dx + dw + 11.5, y: dy - dh * 0.65, width: 3, height: dh * 0.5, fill: '#24262e' });
    add(g, 'circle', { cx: dx + dw + 13, cy: dy - dh * 0.65, r: 3.2, fill: '#e8a84a' });
    /* windows: tall arched, lit */
    const winAt = (wx, wy, ww, wh, round) => {
      add(g, 'circle', { class: 'lamp', cx: wx + ww / 2, cy: wy + wh / 2, r: Math.max(30, w * 0.3), fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
      add(g, 'rect', { x: wx - 2.5, y: wy - 2.5, width: ww + 5, height: wh + 5, rx: round ? ww / 2 : 1.5, fill: '#14120f' });
      add(g, 'rect', { class: 'win', x: wx, y: wy, width: ww, height: wh, rx: round ? ww / 2 : 1 });
      add(g, 'path', { d: `M${wx + ww / 2},${wy} v${wh} M${wx},${wy + wh * 0.45} h${ww}`, stroke: '#1a120c', 'stroke-width': 1.3, fill: 'none' });
      add(g, 'rect', { x: wx - 3.5, y: wy + wh + 2.5, width: ww + 7, height: 3.2, fill: '#6a6a72' });
    };
    if (st === 2) winAt(x + w * 0.5 - w * 0.07, fy + (mid - fy) * 0.15, w * 0.14, (mid - fy) * 0.7, true);
    else {
      winAt(x + w * 0.1, fy + (mid - fy) * 0.18, w * 0.15, (mid - fy) * 0.66, false);
      winAt(x + w * 0.75, fy + (mid - fy) * 0.18, w * 0.15, (mid - fy) * 0.66, false);
      winAt(x + w * 0.12, mid + (wb - mid) * 0.2, w * 0.13, (wb - mid) * 0.46, true);
      winAt(x + w * 0.75, mid + (wb - mid) * 0.2, w * 0.13, (wb - mid) * 0.46, true);
    }
    if (st === 1) { /* guild banner */
      add(g, 'rect', { x: x + w * 0.5 + dw, y: fy + 4, width: 9, height: 22, fill: '#26407a', stroke: '#c9a24c', 'stroke-width': 0.8 });
      add(g, 'path', { d: `M${x + w * 0.5 + dw + 4.5},${fy + 8} v12 M${x + w * 0.5 + dw + 1.5},${fy + 12} h6`, stroke: '#e0c070', 'stroke-width': 1.2 });
    }
    /* roof: steep slab sloping with the side wall's perspective */
    const rl = x - 12, rr2 = x + w + sd + 12, top = y - (st === 2 ? hh * 0.16 : 0);
    const pts = `${rl},${fy + 10} ${x + 8},${top + 2} ${x + w + sd - 6},${top + 2 - sd * 0.35} ${rr2},${fy + 10 - sd * 0.35}`;
    add(g, 'polygon', { points: `${rl},${fy + 12} ${rr2},${fy + 12 - sd * 0.35} ${rr2},${fy + 18 - sd * 0.35} ${rl},${fy + 18}`, fill: '#0e0b0b' });
    add(g, 'rect', { x, y: fy + 14, width: w + sd, height: 12, fill: 'url(#lg-eave)' });
    add(g, 'polygon', { points: pts, fill: roof, stroke: '#0c0808', 'stroke-width': 1.6, 'stroke-linejoin': 'round' });
    add(g, 'polygon', { points: pts, fill: 'url(#lg-roofshade)' });
    add(g, 'polygon', { points: `${x + 8},${top + 2} ${x + w + sd - 6},${top + 2 - sd * 0.35} ${x + w + sd - 6},${top + 8 - sd * 0.35} ${x + 8},${top + 8}`, fill: '#c9a24c', opacity: 0.55 });
    [[x + 8, top + 2], [x + w + sd - 6, top + 2 - sd * 0.35]].forEach(([fx, fyy]) => add(g, 'polygon', { points: `${fx - 2.5},${fyy + 4} ${fx},${fyy - 14} ${fx + 2.5},${fyy + 4}`, fill: '#d6b25a', stroke: '#6a4a14', 'stroke-width': 0.8 }));
    /* dormers */
    if (st !== 2) [0.28, 0.6].forEach((q) => {
      const dxm = x + w * q, dym = top + (fy - top) * 0.45 - sd * 0.12 * q, dwm = w * 0.14;
      add(g, 'polygon', { points: `${dxm - dwm / 2 - 3},${dym + 12} ${dxm},${dym - 8} ${dxm + dwm / 2 + 3},${dym + 12}`, fill: roof, stroke: '#0c0808', 'stroke-width': 1.2 });
      add(g, 'polygon', { points: `${dxm - dwm / 2 - 3},${dym + 12} ${dxm},${dym - 8} ${dxm + dwm / 2 + 3},${dym + 12}`, fill: 'url(#lg-roofshade)' });
      add(g, 'rect', { x: dxm - dwm / 2, y: dym + 1, width: dwm, height: 11, fill: '#2a2018' });
      add(g, 'rect', { class: 'win', x: dxm - dwm / 2 + 2, y: dym + 3, width: dwm - 4, height: 8 });
    });
    if (st === 2) { const fx2 = x + w * 0.5; add(g, 'line', { x1: fx2, y1: top + 2, x2: fx2, y2: top - 22, stroke: '#24262e', 'stroke-width': 2 }); add(g, 'polygon', { class: 'sway', points: `${fx2},${top - 22} ${fx2 + 19},${top - 17} ${fx2},${top - 11}`, fill: '#27407a', stroke: '#c9a24c', 'stroke-width': 1 }); }
    if (o.chim) {
      const cx = x + w * 0.74, cy = top + 4;
      add(g, 'rect', { x: cx - 8, y: cy - 8, width: 16, height: 34, fill: '#55555c', stroke: '#1d1c20', 'stroke-width': 1.3 });
      add(g, 'rect', { x: cx - 11, y: cy - 13, width: 22, height: 7, rx: 1.5, fill: '#3e3e44', stroke: '#1d1c20', 'stroke-width': 1.1 });
      add(g, 'path', { d: `M${cx - 8},${cy + 4} h16 M${cx - 8},${cy + 14} h16`, stroke: '#1d1c20', 'stroke-width': 1, opacity: 0.7 });
      const sm = add(g, 'g', {});
      for (let p = 0; p < 4; p++) add(sm, 'circle', { class: 'puff', cx, cy: cy - 14, r: 12, fill: 'url(#puffG)', style: `animation-delay:${o.idx * 0.7 + p * 1.5}s` });
    }
    return g;
  };

  /* crenellated round tower with a guild banner, and a gatehouse made of two */
  A.tower = (parent, cx, by, s = 1) => {
    const g = add(parent, 'g', { class: 'bld' });
    const w = 58 * s, h = 74 * s, x = cx - w / 2;
    add(g, 'ellipse', { cx: cx + 18 * s, cy: by + 4, rx: w * 0.9, ry: 14 * s, fill: 'url(#shadowG)' });
    add(g, 'rect', { x, y: by - h, width: w, height: h, fill: 'url(#lg-wallS)' });
    add(g, 'rect', { x: x + w * 0.62, y: by - h, width: w * 0.38, height: h, fill: '#0e1018', opacity: 0.4 });
    for (let r = 0; r < 6; r++) for (let c = 0; c < 4; c++) add(g, 'rect', { x: x + c * (w / 4) + (r % 2) * 6 - 3, y: by - h + 8 + r * (h / 6.4), width: w / 4 - 2, height: h / 6.4 - 2, rx: 1.5, fill: '#fff', opacity: 0.05 + ((r * 5 + c * 3) % 4) * 0.015 });
    add(g, 'ellipse', { cx, cy: by - h, rx: w / 2 + 5 * s, ry: 12 * s, fill: '#4a4c58', stroke: '#14151c', 'stroke-width': 1.3 });
    add(g, 'ellipse', { cx, cy: by - h - 1, rx: w / 2 - 3 * s, ry: 8 * s, fill: '#2a2c36' });
    for (let k = 0; k < 8; k++) { const a = (k / 8) * 6.283, mx = cx + Math.cos(a) * (w / 2 + 1), my = by - h + Math.sin(a) * 10 * s; if (Math.sin(a) > -0.2) add(g, 'rect', { x: mx - 4 * s, y: my - 8 * s, width: 8 * s, height: 11 * s, fill: '#6a6c78', stroke: '#14151c', 'stroke-width': 1 }); }
    add(g, 'rect', { x: cx - 3, y: by - h * 0.62, width: 6, height: 18 * s, rx: 3, fill: '#1a120c' });
    add(g, 'circle', { class: 'lamp', cx, cy: by - h * 0.55, r: 30, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
    add(g, 'rect', { x: cx - 3, y: by - h * 0.62, width: 6, height: 18 * s, rx: 3, class: 'win' });
    add(g, 'polygon', { class: 'sway', points: `${cx - 8 * s},${by - h * 0.4} ${cx + 8 * s},${by - h * 0.4} ${cx + 8 * s},${by - h * 0.4 + 28 * s} ${cx},${by - h * 0.4 + 22 * s} ${cx - 8 * s},${by - h * 0.4 + 28 * s}`, fill: '#27407a', stroke: '#c9a24c', 'stroke-width': 1 });
    return g;
  };

  A.pond = (parent, cx, cy, rx, ry, idx, rr) => {
    const g = add(parent, 'g');
    add(g, 'ellipse', { cx, cy: cy + 4, rx: rx + 36, ry: ry + 30, fill: '#08201a', opacity: 0.55 });
    add(g, 'ellipse', { cx, cy, rx: rx + 24, ry: ry + 20, fill: '#34382c' });
    add(g, 'ellipse', { cx: cx - 3, cy: cy - 2, rx: rx + 15, ry: ry + 12, fill: '#4e5040' });
    add(g, 'ellipse', { cx, cy, rx: rx + 7, ry: ry + 6, fill: '#9ab8b2', opacity: 0.4 });
    add(g, 'ellipse', { cx, cy, rx, ry, fill: 'url(#lg-water)' });
    add(g, 'ellipse', { cx, cy, rx, ry, fill: 'url(#wa)', opacity: 0.75 });
    add(g, 'ellipse', { cx, cy, rx: rx * 0.97, ry: ry * 0.97, fill: 'url(#wb)', opacity: 0.55 });
    add(g, 'ellipse', { cx: cx + rx * 0.08, cy: cy + ry * 0.12, rx: rx * 0.6, ry: ry * 0.56, fill: '#04283a', opacity: 0.32 });
    add(g, 'ellipse', { cx: cx - rx * 0.32, cy: cy - ry * 0.4, rx: rx * 0.34, ry: ry * 0.16, fill: '#d2fbf6', opacity: 0.2 });
    for (let k = 0; k < Math.max(2, Math.round(rx / 55)); k++) {
      const lx = cx + (rr() - 0.5) * rx * 1.3, ly = cy + (rr() - 0.2) * ry * 0.9;
      add(g, 'ellipse', { cx: lx, cy: ly, rx: 14, ry: 8, fill: '#2f7a46', stroke: '#164a2c', 'stroke-width': 1 });
      add(g, 'path', { d: `M${lx},${ly} L${lx + 12},${ly - 3}`, stroke: '#164a2c', 'stroke-width': 1.5 });
      if (rr() > 0.5) add(g, 'circle', { cx: lx - 2, cy: ly - 2, r: 3.4, fill: '#f4b6d0', stroke: '#8a3a5a', 'stroke-width': 0.8 });
    }
    [0, 2.2].forEach((dl) => add(g, 'ellipse', { class: 'ripple', cx: cx + (idx % 2 ? 18 : -14), cy: cy + 4, rx: rx * 0.6, ry: ry * 0.5, fill: 'none', stroke: '#e3fbff', 'stroke-width': 2, style: `animation-delay:${dl + (idx % 3)}s` }));
    for (let k = 0; k < Math.max(4, Math.round(rx / 20)); k++) add(g, 'ellipse', { class: 'glint', cx: cx + (rr() - 0.5) * rx * 1.5, cy: cy + (rr() - 0.5) * ry * 1.3, rx: 9 + rr() * 11, ry: 1.7, fill: '#f4ffff', style: `animation-delay:${rr() * 4}s` });
    add(g, 'ellipse', { class: 'shorefoam', cx, cy, rx: rx + 3, ry: ry + 2.5, fill: 'none', stroke: '#f3fffb', 'stroke-width': 2.4, 'stroke-dasharray': '16 26', opacity: 0.7 });
    const ic = add(g, 'g', { class: 'ice' });
    add(ic, 'ellipse', { cx, cy, rx: rx + 4, ry: ry + 3, fill: '#aacbe0' });
    add(ic, 'ellipse', { cx: cx - 6, cy: cy - 4, rx: rx * 0.9, ry: ry * 0.86, fill: '#e1f2f9' });
    add(ic, 'polyline', { points: `${cx - rx * 0.5},${cy} ${cx - rx * 0.1},${cy - ry * 0.4} ${cx + rx * 0.4},${cy + ry * 0.2}`, fill: 'none', stroke: '#8fb6cc', 'stroke-width': 1.8, opacity: 0.8 });
    return g;
  };

  A.reeds = (parent, cx, cy, rx, ry, n, rr) => {
    for (let k = 0; k < n; k++) {
      const a = rr() * Math.PI, px = cx + Math.cos(a) * (rx + 18 + rr() * 10), py = cy + Math.sin(a) * (ry + 14 + rr() * 8);
      const lean = (rr() - 0.5) * 10;
      add(parent, 'g', { class: 'sway grass', style: `animation-delay:${rr() * 3}s` }, `<path d="M${px},${py} q${lean - 3},-16 ${lean - 8},-30 M${px},${py} q${lean + 1},-18 ${lean + 3},-34 M${px},${py} q${lean + 4},-14 ${lean + 9},-26" stroke="#3f7a3a" stroke-width="2.6" fill="none" stroke-linecap="round"/><rect x="${px + lean + 1}" y="${py - 42}" width="5" height="13" rx="2.5" fill="#6a3a22"/>`);
    }
  };

  A.river = (parent, dp) => {
    const g = add(parent, 'g');
    const s = (w, c, o, extra = {}) => add(g, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', opacity: o, ...extra });
    s(122, '#06180f', 0.5); s(108, '#34382c', 1); s(96, '#4e5040', 1); s(88, '#9ab8b2', 0.5); s(82, '#134a5e', 1); s(62, '#17596d', 1);
    s(78, 'url(#wa)', 0.8); s(70, 'url(#wb)', 0.6); s(30, '#082a3a', 0.5);
    [[-18, ''], [0, 'b'], [17, '']].forEach(([off, cls], i) => add(g, 'path', { d: dp, class: 'flow ' + cls, transform: `translate(${off},0)`, fill: 'none', stroke: '#f2ffff', 'stroke-width': 2.8, 'stroke-linecap': 'round', 'stroke-dasharray': '14 52', opacity: 0.4, style: `animation-delay:${-i * 0.9}s` }));
    return g;
  };

  A.road = (parent, dp, k = 1) => {
    const s = (w, c, o, extra = {}) => add(parent, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w * k, 'stroke-linecap': 'butt', opacity: o, ...extra });
    s(72, '#06180f', 0.4); s(62, '#1f4a30', 0.9, { 'stroke-dasharray': '7 9' }); s(56, '#3a342a', 1); s(50, 'url(#cobble)', 1);
    s(50, '#02100c', 0.3);
    s(50, '#000', 0.12, { 'stroke-dasharray': '1 14' });
  };

  A.bridge = (parent, bx, by, len) => {
    const g = add(parent, 'g');
    add(g, 'rect', { x: bx - 8, y: by - 44, width: len + 16, height: 94, rx: 8, fill: '#03141a', opacity: 0.4 });
    add(g, 'rect', { x: bx, y: by - 36, width: len, height: 72, fill: 'url(#cobble)' });
    add(g, 'rect', { x: bx, y: by - 36, width: len, height: 72, fill: '#000', opacity: 0.1 });
    [-1, 1].forEach((sd) => {
      const yy = by + (sd < 0 ? -46 : 31);
      add(g, 'rect', { x: bx - 6, y: yy, width: len + 12, height: 15, rx: 4, fill: '#6d7488', stroke: '#2a2e3c', 'stroke-width': 1.5 });
      add(g, 'rect', { x: bx - 6, y: yy, width: len + 12, height: 4, rx: 2, fill: '#a3abc0' });
      for (let k = 1; k < Math.floor(len / 36); k++) add(g, 'line', { x1: bx + k * 36, y1: yy, x2: bx + k * 36, y2: yy + 15, stroke: '#2a2e3c', 'stroke-width': 1.2 });
    });
    [[bx - 2, by - 40], [bx + len + 2, by - 40], [bx - 2, by + 40], [bx + len + 2, by + 40]].forEach(([lx, ly]) => {
      add(g, 'circle', { class: 'lamp', cx: lx, cy: ly - 10, r: 44, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
      add(g, 'rect', { x: lx - 5, y: ly - 8, width: 10, height: 14, rx: 2, fill: '#4a4f60', stroke: '#1d2030', 'stroke-width': 1 });
      add(g, 'circle', { cx: lx, cy: ly - 12, r: 4.6, fill: '#ffcf7a', stroke: '#6a4a1c', 'stroke-width': 1 });
    });
    return g;
  };

  A.plaza = (parent, cx, cy) => {
    add(parent, 'ellipse', { cx: cx + 6, cy: cy + 10, rx: 82, ry: 72, fill: 'url(#shadowG)' });
    add(parent, 'circle', { cx, cy, r: 68, fill: '#14110d' });
    add(parent, 'circle', { cx, cy, r: 64, fill: 'url(#cobble)' });
    add(parent, 'circle', { cx, cy, r: 64, fill: '#000', opacity: 0.12 });
    add(parent, 'circle', { cx, cy, r: 64, fill: 'none', stroke: '#4e4c54', 'stroke-width': 7 });
    add(parent, 'circle', { cx, cy, r: 64, fill: 'none', stroke: '#8a8892', 'stroke-width': 1.4, opacity: 0.6 });
    add(parent, 'circle', { cx, cy, r: 41, fill: 'none', stroke: '#c9a24c', 'stroke-width': 1.4, 'stroke-dasharray': '2 7', opacity: 0.7 });
    add(parent, 'circle', { cx, cy, r: 28, fill: '#5a5860', stroke: '#14151c', 'stroke-width': 1.6 });
    add(parent, 'circle', { cx, cy, r: 22, fill: '#8a8892' });
    add(parent, 'circle', { cx, cy, r: 18.5, fill: 'url(#lg-water)' });
    add(parent, 'circle', { cx, cy, r: 18.5, fill: 'url(#wa)', opacity: 0.8 });
    add(parent, 'circle', { class: 'ripple', cx, cy, r: 16, fill: 'none', stroke: '#cfe6e2', 'stroke-width': 1.4 });
    add(parent, 'circle', { cx, cy: cy - 4, r: 7, fill: '#8a8892', stroke: '#14151c', 'stroke-width': 1.3 });
    add(parent, 'rect', { x: cx - 2, y: cy - 20, width: 4, height: 14, fill: '#a8a6ae', stroke: '#14151c', 'stroke-width': 1 });
    add(parent, 'polygon', { points: `${cx},${cy - 25} ${cx + 3},${cy - 20} ${cx - 3},${cy - 20}`, fill: '#d6b25a' });
    [[-56, -52], [56, -52], [-56, 52], [56, 52]].forEach(([dx, dy]) => {
      add(parent, 'circle', { class: 'lamp', cx: cx + dx, cy: cy + dy - 12, r: 50, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
      add(parent, 'rect', { x: cx + dx - 2.5, y: cy + dy - 12, width: 5, height: 20, fill: '#1c1e26' });
      add(parent, 'rect', { x: cx + dx - 5, y: cy + dy - 20, width: 10, height: 10, rx: 2, fill: '#2a2c36', stroke: '#c9a24c', 'stroke-width': 0.8 });
      add(parent, 'rect', { x: cx + dx - 3, y: cy + dy - 18, width: 6, height: 6, fill: '#f0b050' });
    });
  };

  A.field = (parent, x, y, w, h, n) => {
    const g = add(parent, 'g');
    add(g, 'rect', { x: x - 6, y: y - 6, width: w + 12, height: h + 12, rx: 6, fill: '#1f3a22', opacity: 0.55 });
    add(g, 'rect', { x, y, width: w, height: h, rx: 3, fill: n ? 'url(#lg-field2)' : 'url(#lg-field1)' });
    const step = 11;
    for (let i = 0; i < Math.floor(w / step); i++) {
      add(g, 'line', { x1: x + 6 + i * step, y1: y + 4, x2: x + 6 + i * step, y2: y + h - 4, stroke: n ? '#6f5a28' : '#3f5f26', 'stroke-width': 3, opacity: 0.85 });
      for (let j = 0; j < Math.floor(h / 15); j++) add(g, 'circle', { cx: x + 6 + i * step + 3.5, cy: y + 10 + j * 15, r: 2.6, fill: n ? '#e9d36a' : '#9bd16a', opacity: 0.85 });
    }
    for (let k = 0; k <= Math.floor(w / 28); k++) {
      add(g, 'rect', { x: x - 3 + k * (w / Math.floor(w / 28)) - 1, y: y - 9, width: 4, height: 11, fill: '#4a3022' });
      add(g, 'rect', { x: x - 3 + k * (w / Math.floor(w / 28)) - 1, y: y + h - 2, width: 4, height: 11, fill: '#4a3022' });
    }
    add(g, 'line', { x1: x, y1: y - 5, x2: x + w, y2: y - 5, stroke: '#6a4a2e', 'stroke-width': 2 });
    add(g, 'line', { x1: x, y1: y + h + 6, x2: x + w, y2: y + h + 6, stroke: '#6a4a2e', 'stroke-width': 2 });
    return g;
  };

  A.rock = (parent, x, y, s) => {
    shadow(parent, x + 10, y + 14, 30 * s, 9 * s);
    add(parent, 'polygon', { points: `${x - 22 * s},${y + 12} ${x - 14 * s},${y - 12 * s} ${x + 6 * s},${y - 20 * s} ${x + 24 * s},${y - 6 * s} ${x + 24 * s},${y + 12}`, fill: '#6e7580', stroke: '#1a1f28', 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
    add(parent, 'polygon', { points: `${x - 14 * s},${y - 12 * s} ${x + 6 * s},${y - 20 * s} ${x + 4 * s},${y - 2 * s} ${x - 10 * s},${y + 6 * s}`, fill: '#a9b0ba' });
    add(parent, 'polygon', { points: `${x + 6 * s},${y - 20 * s} ${x + 24 * s},${y - 6 * s} ${x + 24 * s},${y + 12} ${x + 4 * s},${y + 12} ${x + 4 * s},${y - 2 * s}`, fill: '#3e444f', opacity: 0.8 });
    add(parent, 'ellipse', { cx: x - 8 * s, cy: y + 10, rx: 10 * s, ry: 3.4, fill: '#4f8a46', opacity: 0.85 });
  };

  A.ruin = (parent, x, y, w, h, idx) => {
    const g = add(parent, 'g');
    shadow(g, x + w * 32, y + 18, w * 46, 11);
    const bw = w * T, bh = h * T;
    add(g, 'rect', { x, y: y - bh * 0.45, width: bw, height: bh, rx: 3, fill: 'url(#lg-wallS)', stroke: '#1d2030', 'stroke-width': 1.5 });
    add(g, 'rect', { x, y: y - bh * 0.45, width: bw, height: 8, rx: 3, fill: '#c0c6d4', opacity: 0.55 });
    add(g, 'path', { d: `M${x + bw * 0.2},${y - bh * 0.45 + 12} v${bh * 0.5}`, stroke: '#1d2030', 'stroke-width': 1.2, opacity: 0.6 });
    add(g, 'ellipse', { cx: x + bw * 0.3, cy: y - bh * 0.4 + 12, rx: bw * 0.22, ry: 4, fill: '#4f8a46', opacity: 0.85 });
    if (idx % 2 === 0) add(g, 'path', { class: 'rune', d: `M${x + bw / 2},${y - bh * 0.15} l0,-14 m-6,7 l12,0 m-9,-5 l6,10`, stroke: '#7fe8e0', 'stroke-width': 2, 'stroke-linecap': 'round', fill: 'none' });
    return g;
  };

  A.tuft = (parent, x, y, i, rr, biome) => {
    const roll = rr();
    if (roll > 0.92 && biome === 'woods') {
      add(parent, 'circle', { class: 'lamp', cx: x, cy: y - 6, r: 20, fill: 'url(#lg-glowteal)', style: 'mix-blend-mode:screen' });
      add(parent, 'rect', { x: x - 1.5, y: y - 7, width: 3, height: 8, fill: '#9a9080' });
      add(parent, 'path', { class: 'glowcap', d: `M${x - 6},${y - 6} q6,-10 12,0 z`, fill: '#6fc0b0', stroke: '#14423e', 'stroke-width': 1 });
    } else if (roll > 0.86) {
      const col = ['#a89a6a', '#b8b0a0', '#8a6a7a', '#7a7aa0'][i % 4];
      for (let k = 0; k < 3; k++) add(parent, 'circle', { cx: x + (k - 1) * 4.5, cy: y - (k % 2) * 3, r: 1.9, fill: col });
    } else if (roll > 0.74 && biome !== 'rocky') {
      add(parent, 'g', { class: 'sway grass', style: `animation-delay:${rr() * 3}s` }, `<path d="M${x},${y} q-12,-6 -18,-16 M${x},${y} q-4,-14 -2,-26 M${x},${y} q10,-8 18,-14 M${x},${y} q4,-12 12,-22" stroke="#2f5a3a" stroke-width="2.4" fill="none" stroke-linecap="round"/>`);
    } else if (roll > 0.66) {
      add(parent, 'ellipse', { cx: x, cy: y + 2, rx: 6 + rr() * 5, ry: 3.4, fill: '#7a7e78' });
      add(parent, 'ellipse', { cx: x - 1, cy: y, rx: 5 + rr() * 4, ry: 2.8, fill: '#9a9e96' });
    } else {
      const c1 = biome === 'meadow' ? '#4a7a44' : '#2c5236';
      add(parent, 'g', { class: 'sway grass', style: `animation-delay:${rr() * 3}s` }, `<path d="M${x},${y} q-3,-10 -8,-17 M${x},${y} q1,-12 2,-20 M${x},${y} q4,-10 9,-15" stroke="${c1}" stroke-width="2.4" fill="none" stroke-linecap="round"/><path d="M${x + 1},${y} q-1,-8 -3,-14" stroke="#6f8a4a" stroke-width="1.2" fill="none" stroke-linecap="round" opacity=".65"/>`);
    }
  };

  A.token = (g, kind) => {
    add(g, 'ellipse', { cx: 0, cy: 24, rx: 21, ry: 6, fill: '#000', opacity: 0.42 });
    if (kind === 'ai') {
      add(g, 'circle', { class: 'aura', r: 32, fill: 'none', stroke: '#b9a2ff', 'stroke-opacity': 0.45, 'stroke-width': 2 });
      add(g, 'polygon', { points: '27,0 13.5,23.4 -13.5,23.4 -27,0 -13.5,-23.4 13.5,-23.4', fill: 'url(#lg-violet)', stroke: '#1a1038', 'stroke-width': 2 });
      add(g, 'polygon', { points: '22,0 11,19 -11,19 -22,0 -11,-19 11,-19', fill: 'url(#lg-medalV)' });
      add(g, 'circle', { r: 8.5, fill: 'none', stroke: '#cbb8ff', 'stroke-width': 2.2 });
      add(g, 'ellipse', { rx: 2.4, ry: 6, fill: '#e6dcff' });
      [[-13, 0], [13, 0], [0, -14], [0, 14]].forEach(([dx, dy]) => add(g, 'circle', { cx: dx, cy: dy, r: 1.6, fill: '#b9a2ff' }));
      return;
    }
    const ring = kind === 'hero' ? 'url(#lg-gold)' : 'url(#lg-silver)', ink = kind === 'hero' ? '#f2d9b4' : '#cfe6f0', cloak = kind === 'hero' ? '#2f9aa8' : '#5f86a0';
    add(g, 'circle', { class: 'aura', r: 33, fill: 'none', stroke: kind === 'hero' ? '#e6cb80' : '#9fd3e6', 'stroke-opacity': 0.4, 'stroke-width': 2 });
    add(g, 'circle', { r: 25, fill: ring, stroke: '#1a1408', 'stroke-width': 2 });
    add(g, 'circle', { r: 20.5, fill: 'url(#lg-medal)' });
    add(g, 'path', { d: 'M-14,17 Q-12,0 0,-3 Q12,0 14,17 Z', fill: cloak, stroke: '#06202b', 'stroke-width': 1.4 });
    add(g, 'path', { d: 'M-5,0 L0,14 L5,0', fill: 'none', stroke: kind === 'hero' ? '#e6cb80' : '#d8eef6', 'stroke-width': 1.6 });
    add(g, 'circle', { cx: 0, cy: -7, r: 6.6, fill: ink, stroke: '#06202b', 'stroke-width': 1.2 });
    add(g, 'path', { d: 'M-7,-8 Q-6,-17 2,-15 Q8,-14 7,-8 Q3,-12 -2,-11 Q-5,-10 -7,-8 Z', fill: kind === 'hero' ? '#22284a' : '#2a3a4a' });
    add(g, 'polygon', { points: '0,-33 4,-28 0,-23 -4,-28', fill: kind === 'hero' ? '#7fe8e0' : '#cfe6f0', stroke: '#06202b', 'stroke-width': 1.2 });
  };

  return A;
})();
const SPR={"small_stone_cottage":{"w":342,"h":307,"cx":168,"cb":262,"cw":277,"ct":0},"half_timbered_house":{"w":342,"h":334,"cx":168,"cb":289,"cw":277,"ct":0},"timber_stone_tavern":{"w":360,"h":315,"cx":177,"cb":272,"cw":301,"ct":0},"thatched_farmhouse":{"w":360,"h":289,"cx":177,"cb":247,"cw":301,"ct":0},"merchant_townhouse":{"w":320,"h":307,"cx":156,"cb":262,"cw":255,"ct":0},"stone_towerhouse":{"w":350,"h":356,"cx":172,"cb":311,"cw":287,"ct":0},"village_chapel":{"w":360,"h":407,"cx":176,"cb":362,"cw":297,"ct":0},"grand_guild_hall":{"w":380,"h":341,"cx":187,"cb":303,"cw":329,"ct":0},"blacksmith_forge":{"w":376,"h":307,"cx":198,"cb":262,"cw":287,"ct":0},"walled_gatehouse":{"w":380,"h":273,"cx":182,"cb":230,"cw":329,"ct":0},"round_watchtower":{"w":310,"h":356,"cx":152,"cb":311,"cw":245,"ct":0},"stone_bridge_keep":{"w":380,"h":263,"cx":187,"cb":221,"cw":321,"ct":0},"ancient_moss_tree_a":{"w":240,"h":330,"cx":113,"cb":306,"cw":225,"ct":0},"ancient_moss_tree_b":{"w":240,"h":330,"cx":113,"cb":306,"cw":226,"ct":0},"autumn_shrub":{"w":198,"h":157,"cx":99,"cb":124,"cw":198,"ct":0},"dead_bare_tree":{"w":234,"h":339,"cx":106,"cb":315,"cw":143,"ct":0},"dense_green_bush":{"w":197,"h":163,"cx":98,"cb":128,"cw":197,"ct":0},"fir_tree_a":{"w":240,"h":260,"cx":120,"cb":241,"cw":240,"ct":0},"fir_tree_b":{"w":240,"h":262,"cx":120,"cb":243,"cw":240,"ct":0},"fir_tree_c":{"w":240,"h":255,"cx":120,"cb":236,"cw":240,"ct":0},"mossy_boulder_a":{"w":198,"h":155,"cx":99,"cb":128,"cw":198,"ct":0},"mossy_boulder_b":{"w":198,"h":155,"cx":99,"cb":128,"cw":198,"ct":0},"oak_tree_autumn":{"w":240,"h":334,"cx":114,"cb":309,"cw":227,"ct":0},"oak_tree_large":{"w":240,"h":324,"cx":114,"cb":299,"cw":228,"ct":0},"oak_tree_medium":{"w":240,"h":322,"cx":112,"cb":299,"cw":224,"ct":0},"oak_tree_old":{"w":240,"h":323,"cx":115,"cb":299,"cw":230,"ct":0},"sakura_tree_a":{"w":300,"h":342,"cx":139,"cb":317,"cw":260,"ct":0},"sakura_tree_b":{"w":300,"h":334,"cx":157,"cb":309,"cw":285,"ct":0},"wisteria_tree":{"w":252,"h":345,"cx":120,"cb":319,"cw":239,"ct":0},"goldleaf_birch":{"w":250,"h":344,"cx":118,"cb":318,"cw":237,"ct":0},"sakura_blossom_arch":{"w":300,"h":256,"cx":152,"cb":206,"cw":287,"ct":0},"wisteria_bower":{"w":300,"h":265,"cx":148,"cb":213,"cw":296,"ct":0},"ancient_moss_arch":{"w":300,"h":269,"cx":147,"cb":217,"cw":292,"ct":0},"moonpetal_shrine":{"w":300,"h":216,"cx":141,"cb":169,"cw":274,"ct":0},"firefly_lantern_glade":{"w":300,"h":209,"cx":149,"cb":162,"cw":283,"ct":17},"bluebell_ribbon":{"w":300,"h":163,"cx":150,"cb":126,"cw":300,"ct":0},"flower_path_border":{"w":300,"h":162,"cx":150,"cb":128,"cw":300,"ct":0},"frostflower_carpet":{"w":300,"h":164,"cx":150,"cb":128,"cw":300,"ct":0},"golden_blossom_bank":{"w":300,"h":164,"cx":150,"cb":129,"cw":300,"ct":0},"lavender_edge":{"w":300,"h":163,"cx":150,"cb":129,"cw":300,"ct":0},"sakura_petal_drift":{"w":300,"h":235,"cx":152,"cb":171,"cw":293,"ct":0},"autumn_stone_steps":{"w":300,"h":224,"cx":142,"cb":172,"cw":271,"ct":0},"crystalline_pool":{"w":300,"h":249,"cx":150,"cb":216,"cw":300,"ct":0},"teal_rune_stone":{"w":170,"h":189,"cx":80,"cb":163,"cw":101,"ct":0},"iron_lamppost":{"w":170,"h":214,"cx":81,"cb":198,"cw":54,"ct":0},"stone_village_well":{"w":170,"h":190,"cx":78,"cb":187,"cw":144,"ct":0},"wooden_signpost":{"w":170,"h":180,"cx":87,"cb":163,"cw":99,"ct":0},"graveyard_stones":{"w":170,"h":130,"cx":90,"cb":99,"cw":156,"ct":0},"small_campfire":{"w":170,"h":143,"cx":85,"cb":124,"cw":63,"ct":46},"market_stall_blue":{"w":170,"h":157,"cx":77,"cb":150,"cw":154,"ct":0},"market_stall_cream":{"w":170,"h":157,"cx":77,"cb":150,"cw":154,"ct":0},"hay_cart":{"w":170,"h":137,"cx":80,"cb":126,"cw":160,"ct":0},"crates_barrels":{"w":170,"h":122,"cx":69,"cb":88,"cw":129,"ct":0},"stacked_barrels":{"w":170,"h":116,"cx":94,"cb":81,"cw":129,"ct":0},"fishing_boat":{"w":170,"h":145,"cx":85,"cb":138,"cw":170,"ct":0},"stepping_stones":{"w":170,"h":89,"cx":85,"cb":68,"cw":170,"ct":0},"wildflower_patch":{"w":170,"h":120,"cx":85,"cb":120,"cw":170,"ct":0},"bluebell_patch":{"w":170,"h":124,"cx":85,"cb":120,"cw":170,"ct":0},"reeds_clump":{"w":170,"h":156,"cx":84,"cb":147,"cw":139,"ct":0},"cobble_fountain":{"w":170,"h":132,"cx":85,"cb":132,"cw":170,"ct":17},"stone_wall":{"w":170,"h":94,"cx":85,"cb":84,"cw":170,"ct":0},"stone_wall_ivy":{"w":170,"h":93,"cx":84,"cb":83,"cw":168,"ct":0},"hanging_banner":{"w":170,"h":187,"cx":114,"cb":171,"cw":86,"ct":0},"fence_straight":{"w":170,"h":105,"cx":85,"cb":87,"cw":170,"ct":0},"teal_cloaked_hero":{"w":110,"h":207,"cx":56,"cb":191,"cw":108,"ct":0},"hooded_ranger":{"w":110,"h":207,"cx":56,"cb":191,"cw":108,"ct":0},"runic_mage":{"w":110,"h":171,"cx":46,"cb":158,"cw":90,"ct":0},"town_guard":{"w":110,"h":171,"cx":55,"cb":157,"cw":110,"ct":0},"travelling_merchant":{"w":110,"h":180,"cx":56,"cb":165,"cw":108,"ct":0},"violet_marsh_drifter":{"w":110,"h":207,"cx":56,"cb":191,"cw":108,"ct":0},"violet_road_warden":{"w":110,"h":189,"cx":56,"cb":174,"cw":108,"ct":0},"armoured_knight":{"w":110,"h":189,"cx":56,"cb":174,"cw":108,"ct":0}};

/* ======================================================================
   v19 art: environment pack sprites, scenic zones, custom waterfall,
   moonstone ring and mystery landmarks. Overrides the procedural kit.
   ====================================================================== */
(() => {
  const A = ART, D = document.body.firstElementChild.querySelector('defs');
  const AS = 'assets/';
  A.org = [0, 0];
  const spr = (parent, name, bx, by, cw, o = {}) => {
    const m = SPR[name], k = cw / m.cw, w = m.w * k, h = m.h * k;
    const im = add(parent, 'image', { x: bx - m.cx * k, y: by - m.cb * k, width: w, height: h });
    im.setAttribute('href', AS + name + '.webp');
    if (o.flip) { im.setAttribute('transform', `translate(${2 * bx},0) scale(-1,1)`); }
    if (o.cls) im.setAttribute('class', o.cls);
    if (o.op) im.setAttribute('opacity', o.op);
    return im;
  };
  A.spr = spr;
  const sh = (g, x, y, rx, ry, o = 0.5) => add(g, 'ellipse', { cx: x, cy: y, rx, ry, fill: 'url(#shadowG)', opacity: o });
  const pc = {};
  const pat = (name, size) => {
    const [ox, oy] = A.org, id = `q-${name}-${ox}-${oy}`;
    if (!pc[id]) {
      const p = add(D, 'pattern', { id, width: size, height: size, patternUnits: 'userSpaceOnUse', patternTransform: `translate(${-ox},${-oy})` });
      const im = add(p, 'image', { width: size, height: size }); im.setAttribute('href', AS + name + '.webp');
      pc[id] = 1;
    }
    return `url(#${id})`;
  };
  /* extra gradients */
  D.insertAdjacentHTML('beforeend', `
    <linearGradient id="gx-rock" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8d979a"/><stop offset=".5" stop-color="#5d6a70"/><stop offset="1" stop-color="#2f3b45"/></linearGradient>
    <linearGradient id="gx-rockside" x1="0" x2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".42"/></linearGradient>
    <linearGradient id="gx-fall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e9fbff" stop-opacity=".95"/><stop offset=".6" stop-color="#9fe0ee" stop-opacity=".85"/><stop offset="1" stop-color="#ffffff" stop-opacity=".95"/></linearGradient>
    <radialGradient id="gx-mist"><stop offset="0" stop-color="#f4ffff" stop-opacity=".7"/><stop offset="1" stop-color="#f4ffff" stop-opacity="0"/></radialGradient>
    <radialGradient id="gx-teal"><stop offset="0" stop-color="#8ff6e8" stop-opacity=".85"/><stop offset=".5" stop-color="#3fd0c4" stop-opacity=".25"/><stop offset="1" stop-color="#3fd0c4" stop-opacity="0"/></radialGradient>
    <linearGradient id="gx-slab" x1="0" x2="1"><stop offset="0" stop-color="#9aa6a9"/><stop offset=".55" stop-color="#5f6c72"/><stop offset="1" stop-color="#2b363f"/></linearGradient>
    <linearGradient id="gx-bow" x1="0" x2="1"><stop offset="0" stop-color="#ff8a8a"/><stop offset=".25" stop-color="#ffd27a"/><stop offset=".5" stop-color="#9affb0"/><stop offset=".75" stop-color="#7ad0ff"/><stop offset="1" stop-color="#c49aff"/></linearGradient>
    <radialGradient id="gx-depth" cx=".5" cy=".5" r=".55"><stop offset="0" stop-color="#0d4258"/><stop offset=".45" stop-color="#17708a"/><stop offset=".8" stop-color="#37a6aa"/><stop offset="1" stop-color="#7ed3c0"/></radialGradient>
    <linearGradient id="gx-sky" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#e6f7ff" stop-opacity=".38"/><stop offset=".5" stop-color="#bfe6f2" stop-opacity=".1"/><stop offset="1" stop-color="#bfe6f2" stop-opacity="0"/></linearGradient>
    <radialGradient id="gx-fog"><stop offset="0" stop-color="#cfe0ee" stop-opacity=".42"/><stop offset="1" stop-color="#cfe0ee" stop-opacity="0"/></radialGradient>`);

  /* ---------- ground ---------- */
  const BL = {
    temperate: ['meadow_flower_grass', 'mossy_forest_grass', 'meadow_flower_grass'],
    meadow: ['meadow_flower_grass', 'golden_blossom_meadow', 'dry_golden_grass', 'meadow_flower_grass'],
    woods: ['dark_leaf_litter', 'mossy_forest_grass', 'moonlit_grove', 'mossy_forest_grass'],
    rocky: ['dry_golden_grass', 'dark_leaf_litter', 'mossy_forest_grass'],
  };
  A.ground = (parent, x, y, w, h, biome, rr, scene) => {
    add(parent, 'rect', { x, y, width: w, height: h, fill: pat('g_base', 448) });
    const place = (tex, bw, bh, cx0, cy0, op, flip) => {
      const cx = Math.max(x + bw / 2 + 2, Math.min(x + w - bw / 2 - 2, cx0)), cy = Math.max(y + bh / 2 + 2, Math.min(y + h - bh / 2 - 2, cy0));
      const im = add(parent, 'image', { x: cx - bw / 2, y: cy - bh / 2, width: bw, height: bh, opacity: op });
      im.setAttribute('href', AS + 'b_' + tex + '.webp'); im.setAttribute('preserveAspectRatio', 'none');
      if (flip) im.setAttribute('transform', `translate(${2 * cx},0) scale(-1,1)`);
    };
    const n = Math.ceil((w * h) / 300000) + 1, set = BL[biome] || BL.temperate;
    for (let i = 0; i < n; i++) { const bw = 330 + rr() * 200; place(set[Math.floor(rr() * set.length)], bw, bw * 0.7, x + rr() * w, y + rr() * h, 0.38 + rr() * 0.22, rr() > 0.5); }
    if (scene) {
      const P = [[0.3, 0.32], [0.72, 0.3], [0.5, 0.62], [0.22, 0.74], [0.8, 0.76]];
      P.forEach(([px, py], i) => place(scene.ground[i % scene.ground.length], 520, 380, x + px * w, y + py * h, 0.97, i % 2));
    }
    for (let i = 0; i < Math.ceil((w * h) / 220000); i++) {
      const rx = 70 + rr() * 100, ry = 50 + rr() * 70;
      add(parent, 'ellipse', { cx: x + rx + rr() * Math.max(0, w - 2 * rx), cy: y + ry + rr() * Math.max(0, h - 2 * ry), rx, ry, fill: rr() > 0.3 ? 'url(#lg-patchL)' : 'url(#lg-patchD)', opacity: 0.7 });
    }
  };

  /* ---------- trees ---------- */
  const TREES = {
    oak: ['oak_tree_large', 'oak_tree_medium', 'oak_tree_old'], fir: ['fir_tree_a', 'fir_tree_b', 'fir_tree_c'], amber: ['oak_tree_autumn'],
    glow: ['ancient_moss_tree_a', 'ancient_moss_tree_b'], sakura: ['sakura_tree_a', 'sakura_tree_b'], wist: ['wisteria_tree'], gold: ['goldleaf_birch', 'oak_tree_autumn'],
    moss: ['ancient_moss_tree_a', 'ancient_moss_tree_b', 'oak_tree_old'], dead: ['dead_bare_tree'], bush: ['dense_green_bush'], ashrub: ['autumn_shrub'],
  };
  A.TREES = TREES;
  A.tree = (parent, x, y, s, pal, i, kind) => {
    kind = kind || (pal > 0.985 ? 'glow' : pal > 0.93 ? 'amber' : pal < 0.36 ? 'fir' : 'oak');
    const g = add(parent, 'g', { class: 'tree sway' + (i % 3 ? '' : ' slow'), style: `animation-delay:${(i * 0.37) % 5}s` });
    const list = TREES[kind], nm = list[Math.floor(pal * 997) % list.length], cw = (kind === 'bush' || kind === 'ashrub' ? 66 : kind === 'fir' ? 92 : 108) * s;
    sh(g, x + 14 * s, y + 8 * s, cw * 0.46, cw * 0.14, 0.62);
    spr(g, nm, x, y + 11 * s, cw, { flip: i % 2 });
    if (kind === 'glow') {
      add(g, 'circle', { class: 'lamp', cx: x, cy: y - 40 * s, r: 66 * s, fill: 'url(#lg-glowteal)', style: 'mix-blend-mode:screen' });
      for (let k = 0; k < 5; k++) add(g, 'circle', { class: 'glowcap', cx: x + (k - 2) * 12 * s, cy: y - (26 + (k % 3) * 12) * s, r: 2.4 * s, fill: '#d8fff8' });
    }
  };

  /* ---------- buildings ---------- */
  const HOUSES = ['small_stone_cottage', 'half_timbered_house', 'timber_stone_tavern', 'merchant_townhouse'];
  A.house = (parent, x, y, w, hh, o) => {
    const g = add(parent, 'g', { class: 'bld' });
    const name = o.name || (o.roof === 'thatch' ? 'thatched_farmhouse' : o.style === 2 ? 'stone_towerhouse' : HOUSES[(o.idx * 3 + (o.style || 0)) % 4]);
    const cw = Math.max(w * 1.48, 150), bx = x + w / 2 + 6, by = y + hh - 2, m = SPR[name], k = cw / m.cw;
    add(g, 'ellipse', { cx: bx + cw * 0.08, cy: by + 4, rx: cw * 0.62, ry: 17, fill: 'url(#shadowG)' });
    spr(g, name, bx, by, cw);
    const wy = by - (m.cb - m.ct) * k * 0.46;
    [-0.22, 0.12].forEach((q) => add(g, 'circle', { class: 'lamp', cx: bx + q * cw, cy: wy, r: cw * 0.2, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' }));
    if (o.chim && name !== 'stone_towerhouse') {
      const sm = add(g, 'g', {}), sx = bx + cw * 0.2, sy = by - (m.cb - m.ct) * k * 0.98;
      for (let p = 0; p < 4; p++) add(sm, 'circle', { class: 'puff', cx: sx, cy: sy, r: 11, fill: 'url(#puffG)', style: `animation-delay:${o.idx * 0.7 + p * 1.5}s` });
    }
    return g;
  };
  A.tower = (parent, cx, by, s = 1) => {
    const g = add(parent, 'g', { class: 'bld' });
    sh(g, cx + 14, by + 4, 56, 15);
    spr(g, 'round_watchtower', cx, by + 6, 84 * s);
    add(g, 'circle', { class: 'lamp', cx, cy: by - 50, r: 38, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
    return g;
  };

  /* ---------- water, river, road ---------- */
  /* organic closed outline: radius wobbles smoothly with angle so water never looks like a stamped ellipse */
  const wob = (cx, cy, rx, ry, seed, amp, grow = 0) => {
    const n = 14, r = rng(seed), ph = [r() * 6.28, r() * 6.28, r() * 6.28], pts = [];
    for (let k = 0; k < n; k++) { const a0 = (k / n) * 6.283, w = 1 + amp * (0.55 * Math.sin(a0 * 2 + ph[0]) + 0.3 * Math.sin(a0 * 3 + ph[1]) + 0.15 * Math.sin(a0 * 5 + ph[2])); pts.push([cx + Math.cos(a0) * (rx * w + grow), cy + Math.sin(a0) * (ry * w + grow * ry / rx)]); }
    let d = `M${((pts[n - 1][0] + pts[0][0]) / 2).toFixed(1)},${((pts[n - 1][1] + pts[0][1]) / 2).toFixed(1)}`;
    for (let k = 0; k < n; k++) { const p1 = pts[k], p2 = pts[(k + 1) % n]; d += ` Q${p1[0].toFixed(1)},${p1[1].toFixed(1)} ${((p1[0] + p2[0]) / 2).toFixed(1)},${((p1[1] + p2[1]) / 2).toFixed(1)}`; }
    return d + 'Z';
  };
  A.waterBody = (g, cx, cy, rx, ry, seed, rr, op = {}) => {
    const tex = op.tex || 't_gentle_river_water', ts = tex === 't_gentle_river_water' ? 384 : 256, AMP = 0.07;
    add(g, 'path', { d: wob(cx, cy + 5, rx, ry, seed, AMP, 36), fill: '#04150e', opacity: 0.42 });
    add(g, 'path', { d: wob(cx, cy, rx, ry, seed, AMP, 24), fill: '#2b4a30' });
    add(g, 'path', { d: wob(cx, cy, rx, ry, seed, AMP, 15), fill: '#4d5a3a' });
    add(g, 'path', { d: wob(cx, cy, rx, ry, seed, AMP, 9), fill: '#8f8a64', opacity: 0.9 });
    add(g, 'path', { d: wob(cx, cy, rx, ry, seed, AMP, 5), fill: '#bdb88c', opacity: 0.55 });
    const water = wob(cx, cy, rx, ry, seed, AMP, 0);
    add(g, 'path', { d: water, fill: 'url(#gx-depth)', ...(op.tint ? {} : {}) });
    if (op.tint) add(g, 'path', { d: water, fill: op.tint, opacity: 0.45 });
    add(g, 'path', { d: water, fill: pat(tex, ts), opacity: tex === 't_lotus_water' ? 0.8 : 0.34 });
    add(g, 'path', { d: water, fill: 'url(#wa)', opacity: 0.3 });
    add(g, 'path', { d: wob(cx, cy, rx * 0.97, ry * 0.97, seed, AMP, 0), fill: 'url(#wb)', opacity: 0.32 });
    /* bank shadow, sky sheen, and reflections of the trees that stand on the far shore */
    add(g, 'path', { d: water, fill: 'none', stroke: '#031a20', 'stroke-width': 14, opacity: 0.3 });
    add(g, 'path', { d: water, fill: 'url(#gx-sky)' });
    /* scattered shore stones and mossy tufts instead of a stamped ring */
    const nst = Math.round((rx + ry) / 10);
    for (let k = 0; k < nst; k++) { const a0 = rr() * 6.283, px = cx + Math.cos(a0) * (rx + 7 + rr() * 9), py = cy + Math.sin(a0) * (ry + 5 + rr() * 7), s = 3 + rr() * 5; add(g, 'ellipse', { cx: px, cy: py, rx: s, ry: s * 0.62, fill: ['#8c8b7c', '#a39f8b', '#6f7468'][k % 3], stroke: '#232a24', 'stroke-width': 0.7 }); add(g, 'ellipse', { cx: px - s * 0.2, cy: py - s * 0.26, rx: s * 0.55, ry: s * 0.26, fill: '#fff', opacity: 0.2 }); }
    for (let k = 0; k < 2; k++) { const a0 = 0.4 + rr() * 2.4 + k * 3.1, px = cx + Math.cos(a0) * (rx + 12), py = cy + Math.sin(a0) * (ry + 9); A.rock(g, px, py + 2, 0.5 + rr() * 0.3); }
    /* surface life: lily pads, sparkle, one soft ripple, thin broken foam */
    const pads = op.lotus ? Math.max(6, Math.round(rx / 14)) : Math.max(2, Math.round(rx / 60));
    for (let k = 0; k < pads; k++) {
      const lx = cx + (rr() - 0.5) * rx * 1.5, ly = cy + (rr() - 0.5) * ry * 1.3;
      if (((lx - cx) / rx) ** 2 + ((ly - cy) / ry) ** 2 > 0.7) continue;
      const sc = 0.8 + rr() * 0.5;
      add(g, 'ellipse', { cx: lx + 2, cy: ly + 2, rx: 13 * sc, ry: 7 * sc, fill: '#021a14', opacity: 0.35 });
      add(g, 'ellipse', { cx: lx, cy: ly, rx: 13 * sc, ry: 7 * sc, fill: '#2f8650', stroke: '#164a2c', 'stroke-width': 0.9 });
      add(g, 'path', { d: `M${lx},${ly} L${lx + 11 * sc},${ly - 3 * sc}`, stroke: '#164a2c', 'stroke-width': 1.2 });
      if (op.lotus || rr() > 0.55) { add(g, 'ellipse', { cx: lx - 1, cy: ly - 3, rx: 4.5, ry: 3.4, fill: op.petal || '#f6bfd6', stroke: '#9a3f62', 'stroke-width': 0.8 }); add(g, 'circle', { cx: lx - 1, cy: ly - 3, r: 1.3, fill: '#ffe08a' }); }
    }
    if (op.petals) for (let k = 0; k < 26; k++) { const a0 = rr() * 6.283, d = Math.sqrt(rr()); add(g, 'ellipse', { cx: cx + Math.cos(a0) * rx * 0.95 * d, cy: cy + Math.sin(a0) * ry * 0.95 * d, rx: 2.4, ry: 1.4, fill: '#ffd6e6', opacity: 0.85, transform: `rotate(${rr() * 180} ${cx} ${cy})` }); }
    add(g, 'ellipse', { class: 'ripple', cx: cx + (seed % 2 ? 18 : -14), cy: cy + 4, rx: rx * 0.5, ry: ry * 0.42, fill: 'none', stroke: '#e3fbff', 'stroke-width': 1.4, style: `animation-delay:${seed % 3}s` });
    return water;
  };
  A.pond = (parent, cx, cy, rx, ry, idx, rr, op = {}) => {
    const g = add(parent, 'g');
    A.waterBody(g, cx, cy, rx, ry, 7 + idx * 13 + Math.floor(cx) % 17, rr, op);
    const ic = add(g, 'g', { class: 'ice' });
    add(ic, 'ellipse', { cx, cy, rx: rx + 4, ry: ry + 3, fill: '#aacbe0' });
    add(ic, 'ellipse', { cx: cx - 6, cy: cy - 4, rx: rx * 0.9, ry: ry * 0.86, fill: '#e1f2f9' });
    add(ic, 'polyline', { points: `${cx - rx * 0.5},${cy} ${cx - rx * 0.1},${cy - ry * 0.4} ${cx + rx * 0.4},${cy + ry * 0.2}`, fill: 'none', stroke: '#8fb6cc', 'stroke-width': 1.8, opacity: 0.8 });
    return g;
  };
  A.reeds = (parent, cx, cy, rx, ry, n, rr) => {
    for (let k = 0; k < Math.ceil(n / 2); k++) {
      const a = rr() * Math.PI * 1.1 + 0.05, px = cx + Math.cos(a) * (rx + 16 + rr() * 8), py = cy + Math.sin(a) * (ry + 12 + rr() * 6);
      const g = add(parent, 'g', { class: 'sway grass', style: `animation-delay:${rr() * 3}s` });
      spr(g, 'reeds_clump', px, py + 4, 34 + rr() * 14, { flip: k % 2 });
    }
  };
  A.river = (parent, dp) => {
    const g = add(parent, 'g');
    const s = (w, c, o, extra = {}) => add(g, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', opacity: o, ...extra });
    s(130, '#04150e', 0.4); s(114, '#2b4a30', 1); s(104, '#4d5a3a', 1); s(96, '#a39d76', 0.95); s(92, '#6fc7bd', 0.9);
    s(86, '#2f9ca4', 1); s(70, '#1a7188', 1); s(46, '#0f5069', 1); s(24, '#0a3a52', 0.75);
    s(82, pat('t_gentle_river_water', 384), 0.3); s(80, 'url(#wa)', 0.3); s(66, 'url(#wb)', 0.32);
    s(60, 'url(#gx-sky)', 0.9, { 'stroke-width': 40 });
    return g;
  };
  A.road = (parent, dp, k = 1) => {
    const s = (w, c, o, extra = {}) => add(parent, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w * k, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round', opacity: o, ...extra });
    if (k < 1) { s(72, '#06180f', 0.4); s(62, '#3a3a2a', 0.9); s(54, pat('t_cobblestone_road', 256), 1); s(54, '#c9a26a', 0.18); return; }
    s(78, '#06180f', 0.32); s(70, '#4d6a34', 0.55, { 'stroke-dasharray': '5 7' }); s(62, '#5b452e', 1); s(54, pat('t_worn_dirt_road', 256), 1);
    s(54, '#e4b878', 0.12); s(24, '#d9b07a', 0.1);
  };
  A.plaza = (parent, cx, cy) => {
    add(parent, 'ellipse', { cx: cx + 6, cy: cy + 10, rx: 84, ry: 74, fill: 'url(#shadowG)' });
    add(parent, 'circle', { cx, cy, r: 70, fill: '#14110d' });
    add(parent, 'circle', { cx, cy, r: 66, fill: pat('t_cobblestone_road', 256) });
    add(parent, 'circle', { cx, cy, r: 66, fill: '#c9a26a', opacity: 0.22 });
    add(parent, 'circle', { cx, cy, r: 66, fill: 'none', stroke: '#6f6a5c', 'stroke-width': 7 });
    add(parent, 'circle', { cx, cy, r: 66, fill: 'none', stroke: '#c9b88a', 'stroke-width': 1.4, opacity: 0.6 });
    add(parent, 'circle', { cx, cy, r: 42, fill: 'none', stroke: '#c9a24c', 'stroke-width': 1.4, 'stroke-dasharray': '2 7', opacity: 0.7 });
    spr(parent, 'cobble_fountain', cx, cy + 30, 92);
    add(parent, 'circle', { class: 'ripple', cx, cy: cy + 6, r: 18, fill: 'none', stroke: '#cfe6e2', 'stroke-width': 1.4 });
    [[-60, -50], [60, -50], [-60, 54], [60, 54]].forEach(([dx, dy]) => {
      add(parent, 'circle', { class: 'lamp', cx: cx + dx, cy: cy + dy - 22, r: 52, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
      spr(parent, 'iron_lamppost', cx + dx, cy + dy + 6, 26);
    });
  };
  A.rock = (parent, x, y, s) => { sh(parent, x + 8, y + 12, 30 * s, 8 * s); spr(parent, s > 1 ? 'mossy_boulder_b' : 'mossy_boulder_a', x, y + 13, 58 * s, { flip: s * 10 % 2 > 1 }); };
  A.ruin = (parent, x, y, w, h, idx) => {
    const g = add(parent, 'g');
    if (idx % 3 === 0) {
      sh(g, x + 8, y + 12, 30, 8);
      add(g, 'circle', { class: 'rune lamp', cx: x, cy: y - 22, r: 40, fill: 'url(#gx-teal)', style: 'mix-blend-mode:screen;opacity:.5' });
      spr(g, 'teal_rune_stone', x, y + 12, 44 + w * 12);
    } else { sh(g, x + 8, y + 12, 28, 8); spr(g, idx % 2 ? 'mossy_boulder_a' : 'mossy_boulder_b', x, y + 12, 40 + w * 20, { flip: idx % 2 }); }
    return g;
  };
  const oldTuft = A.tuft;
  A.tuft = (parent, x, y, i, rr, biome) => {
    const r = rr();
    if (r > 0.9 && biome === 'woods') return oldTuft(parent, x, y, i, () => 0.95, biome);
    if (r > 0.8) { spr(parent, i % 3 ? 'wildflower_patch' : 'bluebell_patch', x, y + 4, 38 + rr() * 16, { flip: i % 2 }); return; }
    if (r > 0.7) { const g = add(parent, 'g', { class: 'sway grass', style: `animation-delay:${rr() * 3}s` }); sh(g, x + 6, y + 6, 20, 6, 0.4); spr(g, 'dense_green_bush', x, y + 8, 40 + rr() * 16, { flip: i % 2 }); return; }
    return oldTuft(parent, x, y, i, () => rr() * 0.6, biome);
  };

  /* ---------- custom: waterfall ---------- */
  A.fall = (og, cx, by, W) => {
    const g = add(og, 'g'), H = 178, L = cx - W / 2, R = cx + W / 2, r = rng(Math.floor(cx * 7 + by));
    const NC = 8, cols = [];
    /* basalt-like columns of different heights, tallest in the middle, ragged outer wings */
    for (let i = 0; i < NC; i++) {
      const t = i / (NC - 1), mid = 1 - Math.abs(t - 0.5) * 2, x0 = L - 20 + ((W + 40) * i) / NC, x1 = L - 20 + ((W + 40) * (i + 1)) / NC;
      cols.push({ x0, x1, top: by - H * (0.52 + 0.46 * Math.pow(mid, 0.7)) + (r() - 0.5) * 16, lean: (r() - 0.5) * 6 });
    }
    sh(g, cx + 20, by + 10, W * 0.66, 22, 0.75);
    /* stream feeding the lip from the plateau */
    const lipY = by - H + 4;
    add(g, 'path', { d: `M${cx - 70},${lipY - 92} q60,20 20,46 q-40,22 50,46`, stroke: '#2a5a60', 'stroke-width': 34, fill: 'none', opacity: 0.9, 'stroke-linecap': 'round' });
    add(g, 'path', { d: `M${cx - 70},${lipY - 92} q60,20 20,46 q-40,22 50,46`, stroke: pat('t_gentle_river_water', 384), 'stroke-width': 26, fill: 'none', 'stroke-linecap': 'round' });
    add(g, 'path', { d: `M${cx - 70},${lipY - 92} q60,20 20,46 q-40,22 50,46`, stroke: '#fff', 'stroke-width': 2.4, fill: 'none', 'stroke-dasharray': '4 22', opacity: 0.7, class: 'flow' });
    /* plateau massif behind the columns: its lower edge follows the column tops so no gap shows */
    let cap = `M${cols[0].x0 - 6},${cols[0].top + 14}`;
    cols.forEach((c) => { cap += ` L${c.x0},${c.top + 6} L${c.x1},${c.top + 6}`; });
    cap += ` L${R + 26},${cols[NC - 1].top + 10} q18,-30 -8,-62 q-60,-44 -${W * 0.55},-40 q-${W * 0.3},0 -${W * 0.44},38 q-16,26 -8,62 z`;
    add(g, 'path', { d: cap, fill: '#436f40' });
    add(g, 'path', { d: cap, fill: 'url(#gx-rockside)', opacity: 0.5 });
    add(g, 'path', { d: `M${L - 14},${lipY - 14} q14,-44 70,-54 q${W * 0.4},-20 ${W * 0.72},4 q24,14 36,40`, fill: 'none', stroke: '#9fd070', 'stroke-width': 5, opacity: 0.55, 'stroke-linecap': 'round' });
    for (let k = 0; k < 7; k++) A.tuft(g, L + 20 + r() * (W - 40), lipY - 8 - r() * 40, k, r, 'meadow');
    /* columns */
    cols.forEach((c, i) => {
      const w = c.x1 - c.x0, bot = by + (r() - 0.5) * 6;
      const d = `M${c.x0},${bot} L${c.x0 + c.lean},${c.top + 8} L${c.x0 + w * 0.35 + c.lean},${c.top - 3} L${c.x1 - 2 + c.lean},${c.top + 6} L${c.x1},${bot} Z`;
      add(g, 'path', { d, fill: 'url(#gx-rock)', stroke: '#1a2128', 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
      add(g, 'path', { d: `M${c.x0},${bot} L${c.x0 + c.lean},${c.top + 8} L${c.x0 + w * 0.3 + c.lean},${c.top - 2} L${c.x0 + w * 0.3},${bot} Z`, fill: '#fff', opacity: 0.1 });
      add(g, 'path', { d: `M${c.x1 - w * 0.34},${bot} L${c.x1 - w * 0.34 + c.lean},${c.top + 4} L${c.x1 - 2 + c.lean},${c.top + 6} L${c.x1},${bot} Z`, fill: '#000', opacity: 0.3 });
      for (let k = 0; k < 4; k++) { const yy = c.top + 18 + k * ((bot - c.top) / 4.4) + (r() - 0.5) * 6; add(g, 'path', { d: `M${c.x0 + 1},${yy} l${w - 2},${(r() - 0.5) * 6}`, stroke: '#111a20', 'stroke-width': 1.1, opacity: 0.45 }); }
      add(g, 'ellipse', { cx: (c.x0 + c.x1) / 2 + c.lean, cy: c.top + 5, rx: w * 0.5, ry: 6, fill: '#6aa04a', opacity: 0.95 });
      for (let k = 0; k < 2; k++) add(g, 'ellipse', { cx: c.x0 + r() * w, cy: c.top + 24 + r() * (bot - c.top - 40), rx: 6 + r() * 8, ry: 2.4 + r() * 2, fill: '#4f8a46', opacity: 0.7 });
    });
    /* the two-tier fall sits in a recess between the central columns */
    const fw1 = 40, fw2 = 66, ledgeY = by - H * 0.46;
    add(g, 'path', { d: `M${cx - fw1 / 2 - 8},${lipY + 2} L${cx - fw2 / 2 - 8},${by - 2} L${cx + fw2 / 2 + 8},${by - 2} L${cx + fw1 / 2 + 8},${lipY + 2} Z`, fill: '#122c36' });
    add(g, 'ellipse', { cx, cy: ledgeY + 8, rx: fw2 / 2 + 22, ry: 12, fill: '#4a4a46', stroke: '#171c20', 'stroke-width': 1.3 });
    add(g, 'ellipse', { cx, cy: ledgeY + 5, rx: fw2 / 2 + 14, ry: 9, fill: '#2f7f8c' });
    add(g, 'ellipse', { cx, cy: ledgeY + 4, rx: fw2 / 2 + 8, ry: 6, fill: '#bff0f5', opacity: 0.55 });
    const sheet = (x0, y0, x1, y1, w0, w1, op, cls) => {
      add(g, 'path', { d: `M${x0 - w0 / 2},${y0} L${x1 - w1 / 2},${y1} Q${x1},${y1 + 7} ${x1 + w1 / 2},${y1} L${x0 + w0 / 2},${y0} Z`, fill: 'url(#gx-fall)', opacity: op });
      [-0.3, 0.1, 0.34].forEach((q, i) => add(g, 'path', { class: 'fall' + (i % 2 ? ' b' : ''), d: `M${x0 + q * w0},${y0 + 3} L${x1 + q * w1},${y1 - 3}`, stroke: '#fff', 'stroke-width': 2.2, 'stroke-dasharray': '16 20', opacity: 0.75, fill: 'none' }));
    };
    sheet(cx, lipY + 2, cx, ledgeY, fw1, fw1 + 10, 0.96); sheet(cx, ledgeY + 6, cx, by - 6, fw2 - 12, fw2, 0.98);
    [-1, 1].forEach((sd) => add(g, 'path', { class: 'fall b', d: `M${cx + sd * (fw1 / 2 + 14)},${lipY + 40} q${sd * 4},${H * 0.3} ${sd * 6},${H * 0.58}`, stroke: '#eaffff', 'stroke-width': 2.6, 'stroke-dasharray': '10 16', fill: 'none', opacity: 0.6 }));
    add(g, 'ellipse', { cx, cy: ledgeY + 8, rx: fw1 / 2 + 12, ry: 6, fill: '#fff', opacity: 0.85 });
    /* vines */
    cols.forEach((c, i) => { if (i === 3 || i === 4) return; for (let k = 0; k < 2; k++) { const xx = c.x0 + 4 + r() * (c.x1 - c.x0 - 8); add(g, 'path', { d: `M${xx},${c.top + 10} q3,${14 + r() * 20} ${(r() - 0.5) * 8},${28 + r() * 26}`, stroke: '#3f9a7a', 'stroke-width': 1.6, fill: 'none', opacity: 0.9 }); } });
    /* pool */
    const pool = { x: cx, y: by + 48, rx: W * 0.38, ry: 42 };
    A.waterBody(g, pool.x, pool.y, pool.rx, pool.ry, 21, r, { tint: '#2fc4c8' });
    [0, 1.6, 3.2].forEach((d) => add(g, 'ellipse', { class: 'ripple', cx, cy: pool.y - 20, rx: pool.rx * 0.6, ry: pool.ry * 0.5, fill: 'none', stroke: '#f4ffff', 'stroke-width': 2.2, style: `animation-delay:${d}s` }));
    add(g, 'ellipse', { cx, cy: by + 10, rx: 62, ry: 17, fill: '#ffffff', opacity: 0.8 });
    add(g, 'ellipse', { cx, cy: by + 12, rx: 46, ry: 11, fill: '#e6fbff', opacity: 0.95 });
    /* rainbow + mist */
    add(g, 'path', { d: `M${cx - 128},${by + 10} Q${cx - 30},${by - 170} ${cx + 112},${by - 18}`, fill: 'none', stroke: 'url(#gx-bow)', 'stroke-width': 11, opacity: 0.2, style: 'mix-blend-mode:screen' });
    for (let k = 0; k < 5; k++) add(g, 'circle', { class: 'mist', cx: cx + (k - 2) * 26, cy: by + 2 - (k % 2) * 18, r: 46, fill: 'url(#gx-mist)', style: `animation-delay:${k * 1.1}s` });
    add(g, 'circle', { class: 'mist', cx, cy: ledgeY + 8, r: 40, fill: 'url(#gx-mist)', style: 'animation-delay:.6s' });
    /* dressing: boulders, ferns, trees on the cap */
    [[L - 26, by + 16, 1.1], [R + 22, by + 20, 1.0], [L + 14, by + 70, 0.8], [R - 10, by + 72, 0.9], [L - 40, by - 20, 0.8]].forEach(([px, py, s]) => A.rock(g, px, py, s));
    [[L - 6, by + 36], [R + 2, by + 42], [cx - 138, by + 50], [cx + 134, by + 38]].forEach(([px, py], i) => spr(g, 'dense_green_bush', px, py, 52, { flip: i % 2 }));
    [[L + 30, lipY - 10, 0.85, 0.2], [R - 34, lipY - 4, 0.9, 0.5], [cx + 4, lipY - 56, 0.7, 0.7]].forEach(([px, py, s, p], i) => A.tree(g, px, py, s, p, 70 + i, 'moss'));
    return g;
  };

  /* ---------- custom: moonstone ring ---------- */
  A.stonering = (og, cx, cy, rad) => {
    const g = add(og, 'g'), r = rng(Math.floor(cx * 3 + cy));
    sh(g, cx, cy + 8, rad * 1.4, rad * 0.8, 0.5);
    add(g, 'ellipse', { cx, cy, rx: rad * 1.22, ry: rad * 0.82, fill: '#0a1c1c', opacity: 0.3 });
    add(g, 'ellipse', { cx, cy, rx: rad * 0.7, ry: rad * 0.46, fill: '#566267', stroke: '#1d262e', 'stroke-width': 1.5 });
    add(g, 'ellipse', { cx, cy: cy - 3, rx: rad * 0.62, ry: rad * 0.4, fill: '#7c8a8f' });
    add(g, 'circle', { class: 'pulse', cx, cy: cy - 6, r: rad * 0.9, fill: 'url(#gx-teal)', style: 'mix-blend-mode:screen' });
    add(g, 'path', { class: 'rune', d: `M${cx},${cy - 14} v-10 m-6,6 h12 m-9,-9 l6,8 m0,0 l6,-8`, stroke: '#9afff0', 'stroke-width': 2.2, 'stroke-linecap': 'round', fill: 'none', style: 'filter:drop-shadow(0 0 5px #7fe8e0);opacity:1' });
    const n = 7, stones = [];
    for (let k = 0; k < n; k++) { const a = (k / n) * 6.283 - 1.2, px = cx + Math.cos(a) * rad * 1.25, py = cy + Math.sin(a) * rad * 0.82, hh = 54 + r() * 34, ww = 20 + r() * 8; stones.push([px, py, hh, ww, k]); }
    stones.sort((a, b) => a[1] - b[1]).forEach(([px, py, hh, ww, k]) => {
      sh(g, px + 6, py + 3, ww * 1.3, 7, 0.6);
      const lean = (r() - 0.5) * 6;
      add(g, 'path', { d: `M${px - ww / 2},${py} L${px - ww / 2 + lean},${py - hh + 10} L${px - 3 + lean},${py - hh - 4} L${px + ww / 2 - 2 + lean},${py - hh + 6} L${px + ww / 2},${py} Z`, fill: 'url(#gx-slab)', stroke: '#141c22', 'stroke-width': 1.4, 'stroke-linejoin': 'round' });
      add(g, 'path', { d: `M${px + ww * 0.1},${py} L${px + ww * 0.1 + lean},${py - hh + 8} L${px + ww / 2 - 2 + lean},${py - hh + 6} L${px + ww / 2},${py} Z`, fill: '#000', opacity: 0.28 });
      add(g, 'ellipse', { cx: px - 2, cy: py - 4, rx: ww * 0.5, ry: 3.4, fill: '#4f8a46', opacity: 0.85 });
      add(g, 'path', { class: 'rune', d: `M${px + lean * 0.5},${py - hh * 0.62} v${-hh * 0.28} m-4,${hh * 0.12} h8 m-6,${hh * 0.09} l4,${-hh * 0.1}`, stroke: '#9afff0', 'stroke-width': 1.8, 'stroke-linecap': 'round', fill: 'none', style: 'filter:drop-shadow(0 0 4px #7fe8e0);opacity:.95' });
    });
    for (let k = 0; k < 9; k++) add(g, 'circle', { class: 'mote', cx: cx + (r() - 0.5) * rad * 2.2, cy: cy - 10 - r() * 50, r: 1.6 + r() * 1.2, fill: '#c8fff6', style: `animation-delay:${r() * 5}s` });
    return g;
  };


  /* village dressing: stalls, lamps, well, barrels, cart, hedges and fences around the home town */
  A.dressHome = (w) => {
    const g = add(w, 'g');
    const blk = (x, y) => blocked.add(key(Math.floor(x), Math.floor(y - 0.1)));
    const P = (name, x, y, cw, o = {}) => { const gg2 = add(g, 'g'); sh(gg2, x * T + 6, y * T + 4, cw * 0.4, cw * 0.11, 0.55); spr(gg2, name, x * T, y * T + 4, cw, o); if (o.lamp) add(gg2, 'circle', { class: 'lamp', cx: x * T, cy: y * T - cw * 0.5, r: 52, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' }); if (!o.free) blk(x, y); };
    P('market_stall_blue', 7.15, 5.95, 78); P('market_stall_cream', 9.95, 5.95, 78);
    P('crates_barrels', 12.45, 4.6, 46); P('stacked_barrels', 6.2, 1.7, 40);
    [[3.3, 6.05], [5.6, 6.05], [11.6, 6.05], [3.4, 8.2]].forEach(([x, y]) => P('iron_lamppost', x, y, 28, { lamp: 1 }));
    P('stone_village_well', 4.3, 5.7, 52); P('hay_cart', 12.3, 5.75, 84); P('wooden_signpost', 4.6, 8.95, 38);
    [[3.4, 3.1], [9.2, 3.35], [6.9, 5.1], [11.4, 4.45], [12.6, 6.25], [2.4, 4.9]].forEach(([x, y], i) => P(i % 2 ? 'wildflower_patch' : 'bluebell_patch', x, y, 44, { free: 1 }));
    [[12.95, 1.6], [12.95, 3.6]].forEach(([x, y]) => P('fence_straight', x, y, 40, { free: 1 }));
    [[4.05, 1.9], [13.7, 1.2]].forEach(([x, y], i) => { A.tree(g, x * T, y * T, 1.05, 0.5 + i * 0.1, 40 + i, 'oak'); blk(x, y); });
    [[7.85, 2.25], [10.4, 1.35], [5.6, 6.6]].forEach(([x, y]) => P('dense_green_bush', x, y, 50, { free: 1 }));
  };

  /* ---------- scenic zones ---------- */
  const SC = {
    sakura: { name: 'Moonpetal Sakura Grove', ground: ['sakura_petaled_grass'], trees: ['sakura', 'sakura', 'sakura', 'oak'], dens: 0.15 },
    wild: { name: 'Everbloom Wildflower Vale', ground: ['meadow_flower_grass', 'golden_blossom_meadow'], trees: ['oak', 'bush'], dens: 0.07 },
    fall: { name: 'Silvermist Waterfall Sanctuary', ground: ['mossy_forest_grass', 'moonlit_grove'], trees: ['moss', 'oak', 'fir'], dens: 0.14 },
    lantern: { name: 'Lanternlight Reflection Garden', ground: ['moonlit_grove', 'mossy_forest_grass'], trees: ['glow', 'moss'], dens: 0.1 },
    wist: { name: 'Wisteria Dream Hollow', ground: ['wisteria_shadow_grass'], trees: ['wist', 'wist', 'moss'], dens: 0.15 },
    gold: { name: 'Sunweave Golden Meadow', ground: ['golden_blossom_meadow', 'dry_golden_grass'], trees: ['gold', 'bush'], dens: 0.06 },
    frost: { name: 'Frostflower Crystal Glade', ground: ['frostflower_glade', 'snow_ice_cracks'], trees: ['fir'], dens: 0.12 },
    autumn: { name: 'Amberleaf Autumn Passage', ground: ['autumn_amber_glade', 'dark_leaf_litter'], trees: ['amber', 'amber', 'ashrub'], dens: 0.17 },
    lotus: { name: 'Moonlit Lotus Water Garden', ground: ['moonlit_grove', 'mossy_forest_grass'], trees: ['moss', 'bush'], dens: 0.08 },
    stones: { name: 'Starfall Moonstone Ruins', ground: ['dark_leaf_litter', 'moonlit_grove'], trees: ['dead', 'moss', 'fir'], dens: 0.09 },
    cove: { name: 'Hollow Coast Cove', ground: ['dry_golden_grass', 'mossy_forest_grass'], trees: ['oak', 'bush'], dens: 0.06 },
    bluebell: { name: 'Bluebell Forest Silence', ground: ['bluebell_glade', 'mossy_forest_grass'], trees: ['moss', 'oak', 'moss'], dens: 0.17 },
  };
  const SCK = Object.keys(SC);
  A.SC = SC;
  A.sceneOfCell = (c, r) => { const h = h2(c * 31 + 977, r * 57 + 311); return (h % 100) < 46 ? SCK[(h >>> 7) % SCK.length] : null; };

  /* data generation: returns after pushing items. helpers come from ensureData */
  A.genScene = (data, key0, rr, x0, y0, helpers) => {
    const { blockRect, blockEllipse, reserve } = helpers, S = SC[key0];
    const fx = x0 + 5 + Math.floor(rr() * 3), fy = y0 + 4 + Math.floor(rr() * 2), it = data.items;
    const deco = (name, x, y, cw, o = {}) => it.push({ t: 'x', k: 'deco', name, x, y, cw, ...o });
    const prop = (name, x, y, cw, o = {}) => { it.push({ t: 'x', k: 'prop', name, x, y, cw, ...o }); blocked.add(key(Math.floor(x), Math.floor(y - 0.25))); };
    const pond = (cx, cy, rx, ry, op = {}) => { it.push({ t: 'pond', cx, cy, rx, ry, op }); blockEllipse(cx, cy, rx + 0.2, ry + 0.2); reserve(cx, cy, rx + 1.3, ry + 1.3); };
    switch (key0) {
      case 'sakura':
        pond(fx + 0.5, fy + 0.5, 1.6, 1.0, { petals: true });
        prop('moonpetal_shrine', fx - 3.2, fy - 1.2, 110, { glow: 1 }); reserve(fx - 3.2, fy - 1.2, 1.6, 1.4);
        it.push({ t: 'x', k: 'arch', name: 'sakura_blossom_arch', x: fx + 3.4, y: fy + 1.6, cw: 150 }); blocked.add(key(Math.floor(fx + 3.4 - 0.9), Math.floor(fy + 1.4))); blocked.add(key(Math.floor(fx + 3.4 + 0.9), Math.floor(fy + 1.4))); reserve(fx + 3.4, fy + 1.6, 1.6, 1.2);
        for (let i = 0; i < 3; i++) deco('sakura_petal_drift', fx - 2 + i * 2.4, fy + 1 + (i % 2) * 1.4, 270, { op: 0.9 });
        break;
      case 'wild':
        for (let i = 0; i < 5; i++) deco(['flower_path_border', 'bluebell_ribbon', 'golden_blossom_bank', 'lavender_edge', 'flower_path_border'][i], fx - 3 + i * 1.7, fy + (i % 2 ? 1.4 : -0.6), 210);
        prop('wooden_signpost', fx + 0.6, fy + 2.4, 38); reserve(fx, fy, 3.4, 2.4);
        break;
      case 'fall': {
        const cx = fx + 0.5, by = fy - 0.2;
        it.push({ t: 'x', k: 'fall', x: cx, y: by, W: 4.4 * T });
        for (let ty = Math.floor(by - 2.2); ty <= Math.floor(by); ty++) for (let tx = Math.floor(cx - 2.2); tx <= Math.floor(cx + 2.2); tx++) blocked.add(key(tx, ty));
        blockEllipse(cx, by + 0.72, 2.0, 0.9); reserve(cx, by, 4.2, 3.6);
        break; }
      case 'lantern':
        pond(fx + 0.5, fy + 0.6, 1.5, 0.95, { tex: 't_gentle_river_water', tint: '#12304a' });
        [[-2.3, -1.4], [2.3, -1.4], [-2.5, 1.9], [2.5, 1.9], [0, -2.1]].forEach(([ox, oy]) => prop('iron_lamppost', fx + 0.5 + ox, fy + 0.5 + oy, 30, { glow: 1 }));
        deco('firefly_lantern_glade', fx + 0.5, fy + 0.3, 300, { cls: 'lamp2' }); deco('stepping_stones', fx + 0.5, fy + 3.2, 120); reserve(fx, fy, 3.4, 3.2);
        break;
      case 'wist':
        it.push({ t: 'x', k: 'arch', name: 'wisteria_bower', x: fx + 0.5, y: fy + 1.2, cw: 160 }); blocked.add(key(Math.floor(fx + 0.5 - 0.9), Math.floor(fy + 1))); blocked.add(key(Math.floor(fx + 0.5 + 0.9), Math.floor(fy + 1))); reserve(fx + 0.5, fy + 1.2, 1.8, 1.2);
        for (let i = 0; i < 4; i++) deco('lavender_edge', fx - 3 + i * 2, fy + 2.6 + (i % 2) * 0.5, 220);
        break;
      case 'gold':
        for (let i = 0; i < 4; i++) deco('golden_blossom_bank', fx - 3 + i * 2, fy + (i % 2 ? 1.2 : -0.9), 230);
        prop('hay_cart', fx + 1.2, fy + 0.4, 100); prop('stacked_barrels', fx - 1.6, fy + 0.2, 52); reserve(fx, fy, 3.5, 2.6);
        break;
      case 'frost':
        it.push({ t: 'x', k: 'deco', name: 'crystalline_pool', x: fx + 0.5, y: fy + 1, cw: 210, glowc: 1 }); blockEllipse(fx + 0.5, fy + 0.6, 1.4, 0.8); reserve(fx, fy, 2.8, 2.2);
        for (let i = 0; i < 4; i++) deco('frostflower_carpet', fx - 3 + i * 2, fy + (i % 2 ? 1.8 : -1.3), 230);
        break;
      case 'autumn':
        deco('autumn_stone_steps', fx + 0.5, fy + 1, 190); prop('small_campfire', fx + 2.6, fy + 0.6, 44, { fire: 1 }); prop('wooden_signpost', fx - 2.4, fy + 0.8, 38); reserve(fx, fy, 3.4, 2.4);
        for (let i = 0; i < 3; i++) deco('golden_blossom_bank', fx - 2.5 + i * 2.5, fy + 2.2, 170, { op: 0.9 });
        break;
      case 'lotus':
        pond(fx + 0.5, fy + 0.5, 2.5, 1.6, { tex: 't_lotus_water', lotus: true, petal: '#f6bfd6' });
        it.push({ t: 'x', k: 'deco', name: 'fishing_boat', x: fx + 1.4, y: fy + 0.9, cw: 84 }); deco('stepping_stones', fx - 3.8, fy + 0.9, 130);
        break;
      case 'stones': {
        const cx = fx + 0.5, cy = fy + 0.6;
        it.push({ t: 'x', k: 'ring', x: cx, y: cy, r: 82 });
        for (let ty = Math.floor(cy - 1.1); ty <= Math.floor(cy + 1.1); ty++) for (let tx = Math.floor(cx - 2.1); tx <= Math.floor(cx + 2.1); tx++) { const ax = (tx + 0.5 - cx) / 2.1, ay = (ty + 0.5 - cy) / 1.2; const d = Math.hypot(ax, ay); if (d > 0.78 && d < 1.1 && ((tx * 7 + ty * 3) & 1)) blocked.add(key(tx, ty)); }
        prop('teal_rune_stone', fx - 3.2, fy + 2.2, 54, { glow: 1 }); prop('teal_rune_stone', fx + 3.6, fy - 0.8, 50, { glow: 1 }); reserve(fx, fy, 3.6, 2.6);
        break; }
      case 'cove':
        pond(fx + 0.5, fy + 0.4, 3.0, 1.5, { tex: 't_gentle_river_water', tint: '#0e4a66' });
        it.push({ t: 'x', k: 'deco', name: 'fishing_boat', x: fx - 0.4, y: fy + 0.7, cw: 92 });
        for (let i = 0; i < 5; i++) it.push({ t: 'rock', x: fx - 3 + i * 1.6 + rr() * 0.4, y: fy - 1.9 + rr() * 0.3, s: 1.1 + rr() * 0.6 });
        prop('wooden_signpost', fx + 3.6, fy + 2.0, 38);
        break;
      case 'bluebell':
        for (let i = 0; i < 4; i++) deco('bluebell_ribbon', fx - 3 + i * 2, fy + (i % 2 ? 1.4 : -0.8), 220);
        for (let i = 0; i < 10; i++) deco('bluebell_patch', fx - 3.5 + rr() * 7, fy - 1.5 + rr() * 4, 52);
        it.push({ t: 'x', k: 'fog', x: fx + 0.5, y: fy + 0.6 }); reserve(fx, fy, 3.4, 2.4);
        break;
    }
    const kinds = S.trees;
    data.treeKinds = kinds; data.dens = S.dens;
  };

  /* mystery landmarks: one per few sectors, hinting at the unwritten parts of the world */
  const MYS = [
    { k: 'runestone', text: 'A rune stone hums faintly. The marks are not any script you were taught.' },
    { k: 'graves', text: 'Unnamed graves, tended by someone. The flowers are fresh.' },
    { k: 'camp', text: 'A campfire still warm, and no footprints leading away.' },
    { k: 'sign', text: 'A signpost points toward a place that is on no chart. The paint is still wet.' },
    { k: 'lamp', text: 'A lantern burns here, keeperless, in the middle of nowhere.' },
    { k: 'arch', text: 'A mossy doorway to nowhere. The air on the far side feels colder.' },
  ];
  A.MYS = MYS;
  A.genMystery = (data, rr, x0, y0) => {
    if (rr() > 0.34) return;
    const m = MYS[Math.floor(rr() * MYS.length)];
    for (let n = 0; n < 12; n++) {
      const tx = x0 + 3 + Math.floor(rr() * 7), ty = y0 + 2 + Math.floor(rr() * 5);
      if (blocked.has(key(tx, ty))) continue;
      blocked.add(key(tx, ty));
      data.items.push({ t: 'x', k: 'mys', m: m.k, x: tx + 0.5, y: tx * 0 + ty + 0.7 });
      (data.mys = data.mys || []).push({ x: tx + 0.5, y: ty + 0.5, text: m.text, seen: false });
      return;
    }
  };

  /* render one scenic/mystery item */
  A.item = (it, gg, og, L, idx, cr) => {
    const [px, py] = L(it.x, it.y);
    if (it.k === 'deco') {
      const o = {}; if (it.op) o.op = it.op; if (it.cls) o.cls = it.cls;
      spr(gg, it.name, px, py, it.cw, o);
      if (it.glowc) { add(og, 'circle', { class: 'lamp', cx: px, cy: py - 20, r: 90, fill: 'url(#lg-glowteal)', style: 'mix-blend-mode:screen' }); }
    } else if (it.k === 'prop') {
      const g = add(og, 'g'); sh(g, px + 6, py + 4, it.cw * 0.4, it.cw * 0.12, 0.6);
      spr(g, it.name, px, py + 6, it.cw);
      if (it.glow) add(g, 'circle', { class: 'lamp', cx: px, cy: py - it.cw * 0.45, r: Math.max(46, it.cw * 0.55), fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen' });
      if (it.fire) { add(g, 'circle', { class: 'ember', cx: px, cy: py - 8, r: 34, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen;opacity:.55' }); }
    } else if (it.k === 'arch') {
      const g = add(og, 'g'); sh(g, px, py, it.cw * 0.5, 14, 0.55); spr(g, it.name, px, py + 6, it.cw);
    } else if (it.k === 'fall') A.fall(og, px, py, it.W);
    else if (it.k === 'ring') A.stonering(og, px, py, it.r);
    else if (it.k === 'fog') { for (let k = 0; k < 3; k++) add(og, 'ellipse', { class: 'fogband', cx: px + (k - 1) * 150, cy: py + (k % 2) * 40, rx: 190, ry: 38, fill: 'url(#gx-fog)', style: `animation-delay:${k * 3}s` }); }
    else if (it.k === 'mys') {
      const g = add(og, 'g', { class: 'mys' });
      if (it.m === 'runestone') { add(g, 'circle', { class: 'pulse', cx: px, cy: py - 24, r: 50, fill: 'url(#gx-teal)', style: 'mix-blend-mode:screen' }); sh(g, px + 6, py + 4, 28, 8, 0.6); spr(g, 'teal_rune_stone', px, py + 6, 56); }
      else if (it.m === 'graves') { sh(g, px, py + 4, 46, 10, 0.5); spr(g, 'graveyard_stones', px, py + 8, 100); spr(g, 'bluebell_patch', px + 30, py + 12, 34); }
      else if (it.m === 'camp') { sh(g, px, py + 4, 26, 8, 0.5); add(g, 'circle', { class: 'ember', cx: px, cy: py - 8, r: 40, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen;opacity:.6' }); spr(g, 'small_campfire', px, py + 6, 46); add(g, 'circle', { class: 'puff', cx: px, cy: py - 26, r: 9, fill: 'url(#puffG)' }); }
      else if (it.m === 'sign') { sh(g, px, py + 4, 18, 6, 0.5); spr(g, 'wooden_signpost', px, py + 6, 44); }
      else if (it.m === 'lamp') { add(g, 'circle', { cx: px, cy: py - 34, r: 66, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen;opacity:.8' }); sh(g, px + 4, py + 4, 16, 6, 0.5); spr(g, 'iron_lamppost', px, py + 6, 34); }
      else if (it.m === 'arch') { sh(g, px, py + 2, 70, 12, 0.5); spr(g, 'ancient_moss_arch', px, py + 8, 140); add(g, 'ellipse', { class: 'mist', cx: px, cy: py - 34, rx: 34, ry: 50, fill: 'url(#gx-fog)' }); }
    }
  };
})();





/* the traveller: depth-sorted with the scenery so trees and roofs pass in front of walkers */
const hero = add(world, 'g', { id: 'hero' });
let portraitSeq = 0;
/* A walker token: a gold (you) or silver ring around the real character portrait. */
function mkToken(g, kind, portrait, opt = {}) {
  add(g, 'ellipse', { cx: 0, cy: 24, rx: 21, ry: 6, fill: '#000', opacity: 0.42 });
  const gold = kind === 'hero', off = opt.offline;
  const body = add(g, 'g', off ? { opacity: 0.62 } : {});
  add(body, 'circle', { class: 'aura', r: 33, fill: 'none', stroke: gold ? '#e6cb80' : '#9fd3e6', 'stroke-opacity': 0.4, 'stroke-width': 2 });
  add(body, 'circle', { r: 25, fill: gold ? 'url(#lg-gold)' : 'url(#lg-silver)', stroke: '#1a1408', 'stroke-width': 2 });
  add(body, 'circle', { r: 20.5, fill: 'url(#lg-medal)' });
  if (portrait) {
    const id = 'tkc' + ++portraitSeq;
    const cp = add(body, 'clipPath', { id });
    add(cp, 'circle', { r: 20.5 });
    const im = add(body, 'image', { x: -22, y: -21, width: 44, height: 44, 'clip-path': `url(#${id})`, preserveAspectRatio: 'xMidYMin slice' });
    im.setAttribute('href', portrait);
    if (off) im.setAttribute('style', 'filter:grayscale(.85)');
  } else {
    add(body, 'path', { d: 'M-14,17 Q-12,0 0,-3 Q12,0 14,17 Z', fill: gold ? '#2f9aa8' : '#5f86a0', stroke: '#06202b', 'stroke-width': 1.4 });
    add(body, 'circle', { cx: 0, cy: -7, r: 6.6, fill: gold ? '#f2d9b4' : '#cfe6f0', stroke: '#06202b', 'stroke-width': 1.2 });
  }
  add(body, 'polygon', { points: '0,-33 4,-28 0,-23 -4,-28', fill: gold ? '#7fe8e0' : '#cfe6f0', stroke: '#06202b', 'stroke-width': 1.2 });
  if (off) add(body, 'circle', { cx: 17, cy: -17, r: 4.5, fill: '#5d6a70', stroke: '#06202b', 'stroke-width': 1.2 });
  return body;
}
/* hollow ghost: shown on top of scenery only while the walker is hidden behind it */
function mkGhost(portrait, gold) {
  const g = add(ghostLayer, 'g', { class: 'ghost', style: 'display:none' });
  add(g, 'circle', { r: 26, fill: '#06202b', 'fill-opacity': 0.18, stroke: gold ? '#f2d58a' : '#cfe9f4', 'stroke-width': 2.4, 'stroke-dasharray': '5 4' });
  if (portrait) {
    const id = 'gcp' + ++portraitSeq;
    const cp = add(g, 'clipPath', { id });
    add(cp, 'circle', { r: 20.5 });
    const im = add(g, 'image', { x: -22, y: -21, width: 44, height: 44, 'clip-path': `url(#${id})`, opacity: 0.4, preserveAspectRatio: 'xMidYMin slice' });
    im.setAttribute('href', portrait);
  }
  return g;
}



/* sky layer: light shafts, clouds, drifting leaves, fireflies (screen space) */
const sky = document.getElementById('sky');
for (let i = 0; i < 3; i++) add(sky, 'polygon', { class: 'ray', points: `${80 + i * 270},-60 ${190 + i * 270},-60 ${520 + i * 270},760 ${300 + i * 270},760`, fill: 'url(#lg-rays)' });
/* cloud shadows: irregular cumulus silhouettes baked once on canvas, soft-edged, with broken wisps */
const cloudTex = (seed) => {
  const r = rng(seed), W = 680, H = 320, c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  x.shadowColor = 'rgba(2,14,20,0.62)'; x.shadowBlur = 11; x.shadowOffsetX = W; x.fillStyle = '#000';
  /* real cumulus: flat-ish base, cauliflower top built from overlapping domes of unequal size */
  const cloud = (ox, oy, scale) => {
    const base = oy, n = 7 + Math.floor(r() * 4), span = 250 * scale;
    x.beginPath(); x.rect(ox - span * 0.5 - W, base - 4 * scale, span * 1.02, 12 * scale); x.fill();
    for (let k = 0; k < n; k++) {
      const t = k / (n - 1), bell = Math.sin(t * Math.PI), rad = (20 + bell * 44 + r() * 14) * scale, cx = ox - span / 2 + t * span + (r() - 0.5) * 16 * scale, cy = base - rad * 0.55 - bell * 16 * scale;
      x.beginPath(); x.arc(cx - W, cy, rad, 0, 6.2832); x.fill();
      if (rad > 40 * scale) for (let m = 0; m < 2; m++) { const rr2 = rad * (0.42 + r() * 0.2), a = -1.1 + r() * 2.2 - 1.57; x.beginPath(); x.arc(cx + Math.cos(a) * rad * 0.62 - W, cy + Math.sin(a) * rad * 0.62, rr2, 0, 6.2832); x.fill(); }
    }
  };
  cloud(W * 0.5, H * 0.6, 1);
  cloud(W * 0.18 + r() * 40, H * 0.84, 0.36); cloud(W * 0.86 - r() * 30, H * 0.28, 0.32);
  return c.toDataURL('image/png');
};
/* cloud shadows lie on the ground: the layer follows the camera exactly (same easing as the world) and tiles seamlessly, so walking never makes them slide */
const cloudRoot = add(sky, 'g', { id: 'cloud-root' });
const cloudTile = add(cloudRoot, 'g', {});
const CLP_X = 2200, CLP_Y = 540;
const cloudURLs = [0, 1, 2].map((i) => cloudTex(777 + i * 91));
for (let mx = -2; mx <= 2; mx++) for (let my = -1; my <= 1; my++) {
  const cell = add(cloudTile, 'g', { transform: `translate(${mx * CLP_X},${my * CLP_Y})` });
  for (let i = 0; i < 3; i++) {
    const lane = add(cell, 'g', { transform: `translate(0,${40 + i * 180})` });
    const inner = add(lane, 'g', { class: 'cloud', style: `animation-delay:${-i * 20}s;animation-duration:${55 + i * 14}s` });
    const im = add(inner, 'image', { x: -320 - i * 30, y: -150, width: 640 + i * 90, height: 300 + i * 40, opacity: 0.5 });
    im.setAttribute('href', cloudURLs[i]);
  }
}
function followClouds(cx, cy) {
  const px = cx * T, py = cy * T;
  cloudRoot.style.transform = `translate(${-px}px, ${-py}px)`;
  cloudTile.setAttribute('transform', `translate(${Math.round(px / CLP_X) * CLP_X},${Math.round(py / CLP_Y) * CLP_Y})`);
}
for (let i = 0; i < 9; i++)
  add(sky, 'ellipse', { class: 'leaf', cx: 380 + rand() * 480, cy: -10 + rand() * 220, rx: 5, ry: 2.6, fill: ['#b0892f', '#6a9a3a', '#c9703a'][i % 3], style: `animation-delay:${-rand() * 14}s;animation-duration:${11 + rand() * 7}s` });
for (let i = 0; i < 18; i++)
  add(sky, 'circle', { class: 'fly', cx: 60 + rand() * 700, cy: 120 + rand() * 420, r: 2.4, fill: '#f4e48a', opacity: 0.55, style: `animation-delay:${-rand() * 9}s;animation-duration:${6 + rand() * 6}s` });



/* ---------- Server world: the current sector is chunk (0,0); every other chunk is decorative terrain that continues it ---------- */
const CW = 13, CH = 9;
const defsEl = document.querySelector('#nav-svg defs');
const chunkClip = add(defsEl, 'clipPath', { id: 'chunkclip' });
add(chunkClip, 'rect', { x: -4, y: -4, width: CW * T + 8, height: CH * T + 8 });
const groundLayer = add(world, 'g', {});
world.insertBefore(groundLayer, world.firstChild);
const objLayer = add(world, 'g', {});
const ghostLayer = add(world, 'g', { id: 'ghosts', 'pointer-events': 'none' });
world.insertBefore(objLayer, ghostLayer);
const routeLayer = add(world, 'g', { id: 'routes', 'pointer-events': 'none' });
world.insertBefore(routeLayer, objLayer);

const h2 = (a, b) => { let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return (h ^ (h >>> 16)) >>> 0; };
const hstr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };
const vnoise = (x, y) => {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, s = (t) => t * t * (3 - 2 * t);
  const v = (a, b) => h2(a + 9000, b + 9000) / 4294967296;
  const a = v(xi, yi), b = v(xi + 1, yi), c = v(xi, yi + 1), d = v(xi + 1, yi + 1);
  return a + (b - a) * s(xf) + (c - a) * s(yf) + (a - b - c + d) * s(xf) * s(yf);
};

/* ---------- painted ground per biome (canvas textures sized to tile the 13 x 9 sector seamlessly) ---------- */
const BT = (() => {
  const r0 = rng(515151);
  const scat = (w, h, n, one) => { for (let i = 0; i < n; i++) { const p = { a: r0(), b: r0(), c: r0(), d: r0() }, bx = r0() * w, by = r0() * h; for (const ox of [-w, 0, w]) for (const oy of [-h, 0, h]) one(bx + ox, by + oy, p); } };
  const blotch = (x, w, h, n, cols, rmin = 26, rmax = 90, alpha = '77') => scat(w, h, n, (px, py, p) => { const r = rmin + p.a * (rmax - rmin), g = x.createRadialGradient(px, py, 0, px, py, r), col = cols[Math.floor(p.b * cols.length)]; g.addColorStop(0, col + alpha); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); });
  const make = (id, draw) => {
    const W = 208, H = 192, K = 2, c = document.createElement('canvas'); c.width = W * K; c.height = H * K;
    const x = c.getContext('2d'); x.scale(K, K); draw(x, W, H);
    const p = add(defsEl, 'pattern', { id, width: W, height: H, patternUnits: 'userSpaceOnUse' });
    const im = add(p, 'image', { width: W, height: H }); im.setAttribute('href', c.toDataURL('image/png'));
  };
  make('bt-sand', (x, w, h) => {
    x.fillStyle = '#d1b072'; x.fillRect(0, 0, w, h);
    blotch(x, w, h, 18, ['#e8cf93', '#b8924f', '#dcbd7d', '#c79f5b'], 30, 85);
    scat(w, h, 26, (px, py, p) => { /* wind ripples: a pale crest with a darker lee */
      const L = 22 + p.a * 40, a = -0.18 + p.b * 0.3; x.lineCap = 'round';
      x.strokeStyle = 'rgba(156,118,58,.38)'; x.lineWidth = 2.6; x.beginPath(); x.moveTo(px, py + 2); x.quadraticCurveTo(px + L / 2, py + 2 - 7 * p.c + a * L * 0.4, px + L, py + 2 + a * L); x.stroke();
      x.strokeStyle = 'rgba(250,234,184,.55)'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + L / 2, py - 7 * p.c + a * L * 0.4, px + L, py + a * L); x.stroke();
    });
    scat(w, h, 150, (px, py, p) => { x.fillStyle = ['#a27c42', '#e9d49c', '#8c6a38', '#f3e3b0'][Math.floor(p.c * 4)] + 'cc'; x.beginPath(); x.ellipse(px, py, 0.8 + p.a * 1.8, 0.6 + p.a * 1.1, 0, 0, 6.3); x.fill(); });
  });
  make('bt-basalt', (x, w, h) => {
    x.fillStyle = '#2d2527'; x.fillRect(0, 0, w, h);
    blotch(x, w, h, 20, ['#171112', '#43363a', '#241a1c', '#54413f'], 26, 80);
    scat(w, h, 16, (px, py, p) => { const s = 8 + p.a * 18; x.fillStyle = 'rgba(86,70,72,.55)'; x.beginPath(); x.moveTo(px - s, py + s * 0.4); x.lineTo(px - s * 0.3, py - s * 0.7); x.lineTo(px + s * 0.8, py - s * 0.3); x.lineTo(px + s * 0.6, py + s * 0.6); x.closePath(); x.fill(); x.strokeStyle = 'rgba(10,6,6,.5)'; x.lineWidth = 1; x.stroke(); });
    scat(w, h, 22, (px, py, p) => { /* glowing cracks */
      const L = 16 + p.a * 34, bend = (p.b - 0.5) * 26;
      x.lineCap = 'round'; x.strokeStyle = 'rgba(255,90,20,.18)'; x.lineWidth = 7; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + L / 2, py + bend, px + L, py + (p.c - 0.5) * 16); x.stroke();
      x.strokeStyle = '#ff7a26'; x.lineWidth = 1.8; x.stroke(); x.strokeStyle = '#ffd27a'; x.lineWidth = 0.7; x.stroke();
    });
    scat(w, h, 120, (px, py, p) => { x.fillStyle = p.c > 0.9 ? '#ff9a3acc' : 'rgba(150,130,128,.55)'; x.fillRect(px, py, 1 + p.a * 1.6, 1 + p.b * 1.4); });
  });
  make('bt-snow', (x, w, h) => {
    x.fillStyle = '#dbe8f1'; x.fillRect(0, 0, w, h);
    blotch(x, w, h, 20, ['#ffffff', '#b7d2e3', '#eef6fb', '#c7dcea'], 30, 90);
    scat(w, h, 24, (px, py, p) => { const L = 24 + p.a * 40; x.lineCap = 'round'; x.strokeStyle = 'rgba(150,185,210,.4)'; x.lineWidth = 2.2; x.beginPath(); x.moveTo(px, py + 2); x.quadraticCurveTo(px + L / 2, py - 5, px + L, py + 1); x.stroke(); x.strokeStyle = 'rgba(255,255,255,.8)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + L / 2, py - 7, px + L, py - 1); x.stroke(); });
    scat(w, h, 18, (px, py, p) => { x.strokeStyle = 'rgba(112,152,180,.55)'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 6 + p.a * 14, py + (p.b - 0.5) * 12); x.lineTo(px + 14 + p.a * 20, py + (p.c - 0.5) * 18); x.stroke(); });
    scat(w, h, 110, (px, py, p) => { x.fillStyle = p.c > 0.5 ? 'rgba(255,255,255,.95)' : 'rgba(126,168,196,.5)'; x.beginPath(); x.arc(px, py, 0.6 + p.a * 1.2, 0, 6.3); x.fill(); });
  });
  make('bt-highland', (x, w, h) => {
    x.fillStyle = '#4b5a53'; x.fillRect(0, 0, w, h);
    blotch(x, w, h, 22, ['#35423c', '#6a7d6c', '#5b5f7e', '#3d4a50'], 26, 80);
    scat(w, h, 1100, (px, py, p) => { const L = 3 + p.a * 5; x.strokeStyle = ['#7f9b74', '#a9bc94', '#53705a', '#6e6a96'][Math.floor(p.c * 4)] + '99'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (p.b - 0.5) * 3, py - L); x.stroke(); });
    scat(w, h, 60, (px, py, p) => { x.fillStyle = ['#8d93a4', '#6d7384', '#a6a9bb'][Math.floor(p.c * 3)] + 'cc'; x.beginPath(); x.ellipse(px, py, 1.4 + p.a * 3, 1 + p.a * 2, p.b, 0, 6.3); x.fill(); });
  });
  make('bt-march', (x, w, h) => {
    x.fillStyle = '#212d29'; x.fillRect(0, 0, w, h);
    blotch(x, w, h, 22, ['#121a18', '#33463f', '#2a3b36', '#1a2823'], 28, 84);
    scat(w, h, 1000, (px, py, p) => { const L = 3 + p.a * 6; x.strokeStyle = ['#4a5b4a', '#2f3f33', '#687866', '#3a3a30'][Math.floor(p.c * 4)] + 'aa'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + (p.b - 0.5) * 6, py - L * 0.5, px + (p.b - 0.5) * 4, py - L); x.stroke(); });
    scat(w, h, 7, (px, py, p) => { x.fillStyle = 'rgba(30,52,58,.65)'; x.beginPath(); x.ellipse(px, py, 8 + p.a * 14, 3 + p.b * 5, 0, 0, 6.3); x.fill(); x.strokeStyle = 'rgba(150,190,196,.35)'; x.lineWidth = 0.8; x.stroke(); });
    scat(w, h, 70, (px, py, p) => { x.fillStyle = ['#5d6657', '#3f463d', '#77806d'][Math.floor(p.c * 3)] + 'cc'; x.beginPath(); x.ellipse(px, py, 0.8 + p.a * 1.8, 0.6 + p.a, 0, 0, 6.3); x.fill(); });
  });
  make('bt-coast', (x, w, h) => {
    x.fillStyle = '#cdb985'; x.fillRect(0, 0, w, h);
    blotch(x, w, h, 20, ['#dfcf9c', '#b29d68', '#8fa061', '#d7c490'], 26, 80);
    scat(w, h, 700, (px, py, p) => { const L = 3 + p.a * 5; x.strokeStyle = ['#7e9a58', '#9bb06a', '#6d8a50'][Math.floor(p.c * 3)] + 'aa'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (p.b - 0.5) * 3, py - L); x.stroke(); });
    scat(w, h, 140, (px, py, p) => { x.fillStyle = ['#f4ead0', '#a38f5f', '#e0b8a8', '#8a7a56'][Math.floor(p.c * 4)] + 'cc'; x.beginPath(); x.ellipse(px, py, 0.8 + p.a * 1.7, 0.6 + p.a, p.b, 0, 6.3); x.fill(); });
  });
  return { ok: true };
})();

/* ---------- biome themes: the region decides ground, scenery, water and weather look ---------- */
const BIOME_OF = { 'aureth-crown': 'plains', 'verdant-expanse': 'forest', 'emberreach': 'volcanic', 'frostmere': 'ice', 'glasswind-desert': 'desert', 'hollow-coast': 'coast', 'starfall-highlands': 'highland', 'umbral-march': 'march' };
const THEMES = {
  plains: { reg: 'plains', ground: 'meadow', blots: ['golden_blossom_meadow', 'dry_golden_grass', 'meadow_flower_grass'], obst: [['oak', 4], ['gold', 3], ['bush', 2], ['rock', 1]], ring: 0.55, tuft: 'meadow', water: 'water', label: 'Golden plains' },
  forest: { reg: 'temperate', ground: 'woods', blots: [], obst: [['oak', 3], ['moss', 3], ['fir', 2], ['bush', 1]], ring: 0.72, tuft: 'woods', water: 'water', label: 'Ancient woodland' },
  volcanic: { reg: 'volcanic', ground: 'bt-basalt', blots: [], obst: [['rock', 8], ['dead', 2]], ring: 0.5, tuft: null, water: 'lava', label: 'Volcanic ash' },
  ice: { reg: 'cold', ground: 'bt-snow', blots: ['snow_ice_cracks', 'frostflower_glade'], obst: [['fir', 7], ['rock', 2]], ring: 0.6, tuft: null, water: 'ice', label: 'Snowfield' },
  desert: { reg: 'arid', ground: 'bt-sand', blots: ['dry_golden_grass'], obst: [['rock', 5], ['ashrub', 4], ['dead', 1]], ring: 0.38, tuft: null, water: 'oasis', label: 'Dune sea' },
  coast: { reg: 'coast', ground: 'bt-coast', blots: ['dry_golden_grass', 'mossy_forest_grass'], obst: [['bush', 3], ['oak', 2], ['rock', 3]], ring: 0.4, tuft: 'meadow', water: 'sea', label: 'Tidal shore' },
  highland: { reg: 'highland', ground: 'bt-highland', blots: ['wisteria_shadow_grass', 'moonlit_grove'], obst: [['rock', 5], ['fir', 4]], ring: 0.55, tuft: 'rocky', water: 'water', label: 'High moor' },
  march: { reg: 'march', ground: 'bt-march', blots: ['dark_leaf_litter', 'moonlit_grove'], obst: [['dead', 4], ['moss', 3], ['rock', 2], ['grave', 1]], ring: 0.62, tuft: 'woods', water: 'murk', label: 'Dark frontier' },
};
const pickW = (list, r) => { let t = 0; for (const [, w] of list) t += w; let a = r * t; for (const [k, w] of list) { if ((a -= w) < 0) return k; } return list[0][0]; };

/* ---------- sector model ---------- */
let SECTOR = null;
let SV = null; /* latest authoritative state from the page */
function cellOf2(x, y) { return SECTOR && x >= 0 && y >= 0 && x < CW && y < CH ? SECTOR.grid[y][x] : null; }
function isBlocked(x, y) { const c = cellOf2(x, y); return !c || !c.walk; }
const chunks = new Map();
let boardObj = null;
const occluders = []; /* depth-sorted scenery that can hide a walker: {by, shape} */

function loadSector(sec) {
  const rows = [];
  for (let y = 0; y < CH; y++) { rows.push([]); for (let x = 0; x < CW; x++) rows[y].push({ ch: '#', walk: false, safe: false, known: false }); }
  for (const c of sec.cells) rows[c.y][c.x] = { ch: c.terrain, walk: c.walkable, safe: c.safe, known: true };
  const bk = BIOME_OF[sec.regionId] || 'forest';
  SECTOR = { id: sec.id, name: sec.name, regionId: sec.regionId, coordinate: sec.coordinate, biome: bk, theme: THEMES[bk], grid: rows, landmarks: sec.landmarks, exits: sec.exits, seed: hstr(sec.id) };
  analyseSector();
  for (const d of chunks.values()) if (d.dom) d.dom.forEach((n) => n.remove());
  chunks.clear(); occluders.length = 0; boardObj = null;
  if (window.AV_setRegion) window.AV_setRegion(SECTOR.theme.reg);
}

/* water, roads, bridges and settlements, derived from the authored rows */
function analyseSector() {
  const S = SECTOR, g = S.grid, ch = (x, y) => (x >= 0 && y >= 0 && x < CW && y < CH ? g[y][x].ch : null);
  S.bridges = []; S.riverCells = new Set(); S.seaCells = new Set();
  let water = 0;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (g[y][x].ch === '~') water++;
  const sea = S.theme.water === 'sea' && water >= 16;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    const c = ch(x, y);
    if (c === '~') (sea ? S.seaCells : S.riverCells).add(key(x, y));
    if (c === '=' && !sea && ((ch(x, y - 1) === '~' && ch(x, y + 1) === '~') || (ch(x - 1, y) === '~' && ch(x + 1, y) === '~'))) { S.bridges.push({ x, y, vertical: ch(x, y - 1) === '~' }); S.riverCells.add(key(x, y)); }
  }
  S.sea = sea;
  S.clearZones = [];
  /* river polylines: connected components, one centre point per row (or column) */
  const seen = new Set(), comps = [];
  for (const k0 of S.riverCells) {
    if (seen.has(k0)) continue;
    const comp = [], q = [k0]; seen.add(k0);
    while (q.length) { const k1 = q.pop(); comp.push(k1); const [cx, cy] = k1.split(',').map(Number); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = key(cx + dx, cy + dy); if (S.riverCells.has(k2) && !seen.has(k2)) { seen.add(k2); q.push(k2); } } }
    comps.push(comp.map((k) => k.split(',').map(Number)));
  }
  S.rivers = comps.map((cells) => {
    const xs = cells.map((c) => c[0]), ys = cells.map((c) => c[1]);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    const vertical = maxY - minY >= maxX - minX;
    if (cells.length < 3 || (minY > 0 && maxY < CH - 1 && minX > 0 && maxX < CW - 1)) return { pond: true, cells, cx: (minX + maxX + 1) / 2, cy: (minY + maxY + 1) / 2, rx: (maxX - minX + 1) / 2, ry: (maxY - minY + 1) / 2 };
    const pts = [];
    if (vertical) {
      for (let y = minY; y <= maxY; y++) { const row = cells.filter((c) => c[1] === y).map((c) => c[0]); pts.push([row.reduce((a, b) => a + b, 0) / row.length + 0.5, y + 0.5]); }
      if (minY === 0) pts.unshift([pts[0][0], -3.4]);
      if (maxY === CH - 1) pts.push([pts[pts.length - 1][0], CH + 3.4]);
    } else {
      for (let x = minX; x <= maxX; x++) { const col = cells.filter((c) => c[0] === x).map((c) => c[1]); pts.push([x + 0.5, col.reduce((a, b) => a + b, 0) / col.length + 0.5]); }
      if (minX === 0) pts.unshift([-3.4, pts[0][1]]);
      if (maxX === CW - 1) pts.push([CW + 3.4, pts[pts.length - 1][1]]);
    }
    return { pond: false, vertical, pts, srcNorth: vertical && minY === 0, drainsSouth: vertical && maxY === CH - 1, cells };
  });
  S.rivers.forEach((r) => {
    if (r.pond) return;
    const f = r.pts[0], l = r.pts[r.pts.length - 1];
    if (r.srcNorth) S.clearZones.push([Math.floor(f[0] - 3), Math.floor(f[0] + 3), -7, -2]);
    [f, l].forEach((p) => { if (p[0] < -0.5 || p[0] > CW + 0.5 || p[1] < -0.5 || p[1] > CH + 0.5) S.clearZones.push([Math.floor(p[0] - 3), Math.floor(p[0] + 3), Math.floor(p[1] - 2), Math.floor(p[1] + 2)]); });
  });
  /* settlement */
  const sCells = []; for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) if (g[y][x].ch === 's') sCells.push([x, y]);
  S.town = sCells.length > 0;
}
/* what a tile outside the board looks like: the nearest board edge decides */
function refCell(tx, ty) { const x = Math.max(0, Math.min(CW - 1, tx)), y = Math.max(0, Math.min(CH - 1, ty)); return { x, y, c: SECTOR.grid[y][x], inX: tx === x, inY: ty === y }; }
function riverDist(tx, ty) {
  let best = 99;
  for (const r of SECTOR.rivers) {
    if (r.pond) continue;
    for (let i = 0; i < r.pts.length - 1; i++) {
      const a = r.pts[i], b = r.pts[i + 1], px = tx + 0.5, py = ty + 0.5, dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((px - a[0]) * dx + (py - a[1]) * dy) / L)); best = Math.min(best, Math.hypot(px - (a[0] + t * dx), py - (a[1] + t * dy)));
    }
  }
  return best;
}
/* tile kinds for the whole local space */
function tileKind(tx, ty) {
  const S = SECTOR;
  if (tx >= 0 && ty >= 0 && tx < CW && ty < CH) {
    const c = S.grid[ty][tx], k = key(tx, ty);
    if (S.seaCells.has(k)) return 'sea';
    if (c.ch === '~' || (S.riverCells.has(k) && c.ch !== '=')) return 'water';
    if (S.bridges.some((b) => b.x === tx && b.y === ty)) return 'bridge';
    if (c.ch === '=') return 'road';
    if (c.ch === 's') return 'town';
    if (c.ch === '#') return 'solid';
    return 'free';
  }
  const r = refCell(tx, ty);
  if (S.seaCells.has(key(r.x, r.y))) return 'sea';
  if (S.rivers.length && !S.sea) {
    for (const z of S.clearZones) if (tx >= z[0] && tx <= z[1] && ty >= z[2] && ty <= z[3]) return 'clear';
    if (riverDist(tx, ty) < 0.62) return 'water';
  }
  if (r.c.ch === '=' && ((tx < 0 || tx >= CW) && r.inY || (ty < 0 || ty >= CH) && r.inX)) return 'road';
  return 'ring';
}

/* ---------- drawing helpers ---------- */
const WATER_PAL = {
  water: { edge: '#04150e', bank: '#2b4a30', sand: '#a39d76', foam: '#6fc7bd', deep: ['#2f9ca4', '#1a7188', '#0f5069', '#0a3a52'], tex: 0.3 },
  oasis: { edge: '#3a2a10', bank: '#8a6b34', sand: '#e0c785', foam: '#7fe0d0', deep: ['#35c6c4', '#1f9fae', '#157f96', '#0f6684'], tex: 0.28 },
  ice: { edge: '#2a4a60', bank: '#7ea6c0', sand: '#e6f2fa', foam: '#e6f6ff', deep: ['#bcdceb', '#a5cbe0', '#8db9d4', '#7aa9c8'], tex: 0.18 },
  lava: { edge: '#120606', bank: '#2a1514', sand: '#4a2a22', foam: '#ff9a3a', deep: ['#ff7a24', '#e5501a', '#bd3410', '#8c2208'], tex: 0.0 },
  murk: { edge: '#050a08', bank: '#1d2a22', sand: '#46543f', foam: '#6e9a8a', deep: ['#2c4c4c', '#213f43', '#17323a', '#0f252e'], tex: 0.22 },
  sea: { edge: '#04150e', bank: '#2b4a30', sand: '#d9c58a', foam: '#e8fffb', deep: ['#2f9ca4', '#1a7188', '#0f5069', '#0a3a52'], tex: 0.3 },
};
const riverTexPat = (() => { const p = add(defsEl, 'pattern', { id: 'p-riverwater', width: 384, height: 384, patternUnits: 'userSpaceOnUse' }); const im = add(p, 'image', { width: 384, height: 384 }); im.setAttribute('href', 'assets/t_gentle_river_water.webp'); return 'url(#p-riverwater)'; })();
function paintRiver(g, dp, kind) {
  const P = WATER_PAL[kind] || WATER_PAL.water, k = 0.66;
  const s = (w, c, o, extra = {}) => add(g, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w * k, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: o, ...extra });
  s(130, P.edge, 0.4); s(114, P.bank, 1); s(104, P.bank, 1); s(96, P.sand, 0.95); s(92, P.foam, 0.9);
  s(86, P.deep[0], 1); s(70, P.deep[1], 1); s(46, P.deep[2], 1); s(24, P.deep[3], 0.75);
  if (kind === 'lava') {
    s(78, '#ffb347', 0.35, { class: 'lavaglow' }); s(40, '#ffe08a', 0.45, { class: 'lavaglow' });
    s(60, '#fff2b0', 0.8, { 'stroke-dasharray': '3 26', class: 'flow' }); s(40, '#2a0e08', 0.55, { 'stroke-dasharray': '10 38', class: 'flow b' });
  } else {
    if (P.tex) s(82, riverTexPat, P.tex);
    s(80, 'url(#wa)', 0.3); s(66, 'url(#wb)', 0.32); s(40, 'url(#gx-sky)', 0.9);
    if (kind === 'water' || kind === 'oasis' || kind === 'murk') s(54, '#fff', 0.55, { 'stroke-dasharray': '3 30', class: 'flow' });
  }
  if (kind === 'ice') { s(84, '#dcf0f8', 0.6); s(3, '#fff', 0.85, { 'stroke-dasharray': '3 30' }); }
  else if (kind === 'water' && SECTOR.theme.reg === 'cold') { const ic = add(g, 'g', { class: 'ice' }); [[84, '#b7d6e8'], [62, '#dcf0f8']].forEach(([w, c]) => add(ic, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w * 0.66, 'stroke-linecap': 'round' })); }
}
function paintRoad(g, runs) {
  /* every road run is drawn with round caps so corners and junctions join without notches */
  runs.forEach((dp) => {
    const s = (w, c, o, extra = {}) => add(g, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: o, ...extra });
    s(78, '#06180f', 0.3); s(70, SECTOR.theme.reg === 'arid' ? '#a98a50' : SECTOR.theme.reg === 'volcanic' ? '#3a2a26' : '#4d6a34', SECTOR.theme.reg === 'arid' ? 0.35 : 0.55, { 'stroke-dasharray': '5 7' });
  });
  runs.forEach((dp) => {
    const s = (w, c, o, extra = {}) => add(g, 'path', { d: dp, fill: 'none', stroke: c, 'stroke-width': w, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', opacity: o, ...extra });
    s(62, SECTOR.theme.reg === 'volcanic' ? '#2c1f1c' : '#5b452e', 1); s(54, riverTexPat === null ? '#7a5a38' : 'url(#p-roadtex)', 1);
    s(54, SECTOR.theme.reg === 'arid' ? '#f0d9a0' : '#e4b878', 0.14);
  });
}
{ const p = add(defsEl, 'pattern', { id: 'p-roadtex', width: 256, height: 256, patternUnits: 'userSpaceOnUse' }); const im = add(p, 'image', { width: 256, height: 256 }); im.setAttribute('href', 'assets/t_worn_dirt_road.webp'); }
/* road runs: maximal straight runs of road/bridge/settlement-link cells, plus the stretch that leaves the board */
function roadRuns() {
  const S = SECTOR, isR = (x, y) => { const c = cellOf2(x, y); return c && (c.ch === '=' || S.bridges.some((b) => b.x === x && b.y === y)); };
  const runs = [], used = new Set();
  for (let y = 0; y < CH; y++) for (let x = 0; x < CW; x++) {
    if (!isR(x, y)) continue;
    if (!isR(x - 1, y) && (isR(x + 1, y) || x === 0 || x === CW - 1 || isR(x, y - 1) === false && false)) { /* horizontal run start */
      let x2 = x; while (isR(x2 + 1, y)) x2++;
      const a = x === 0 ? -1.5 : x + 0.5, b = x2 === CW - 1 ? CW + 1.5 : x2 + 0.5;
      runs.push(smooth([[a, y + 0.5], [b, y + 0.5]]));
      for (let k = x; k <= x2; k++) used.add(key(k, y));
    }
  }
  for (let x = 0; x < CW; x++) for (let y = 0; y < CH; y++) {
    if (!isR(x, y) || isR(x, y - 1)) continue;
    let y2 = y; while (isR(x, y2 + 1)) y2++;
    if (y2 === y && used.has(key(x, y))) continue;
    if (y2 === y && !(y === 0 || y === CH - 1)) { if (!used.has(key(x, y))) runs.push(smooth([[x + 0.5, y + 0.5], [x + 0.5001, y + 0.5001]])); continue; }
    const a = y === 0 ? -1.5 : y + 0.5, b = y2 === CH - 1 ? CH + 1.5 : y2 + 0.5;
    runs.push(smooth([[x + 0.5, a], [x + 0.5, b]]));
  }
  /* roads that touch a settlement: carry the road to the nearest town tile so it reads as a street */
  return runs;
}

/* ---------- chunk assembly ---------- */
const OBST_JIT = (rr) => (rr() - 0.5) * 0.36;
function groundTheme(gg, x, y, w, h, T0, rr) {
  if (T0.ground === 'meadow' || T0.ground === 'woods') {
    ART.ground(gg, x, y, w, h, T0.ground, rr);
    if (T0.blots.length) for (let i = 0; i < 5; i++) {
      const bw = 330 + rr() * 200, im = add(gg, 'image', { x: x + rr() * (w - bw), y: y + rr() * (h - bw * 0.7), width: bw, height: bw * 0.7, opacity: 0.34 });
      im.setAttribute('href', 'assets/b_' + T0.blots[Math.floor(rr() * T0.blots.length)] + '.webp'); im.setAttribute('preserveAspectRatio', 'none');
    }
    return;
  }
  add(gg, 'rect', { x, y, width: w, height: h, fill: `url(#${T0.ground})` });
  const n = T0.reg === 'arid' ? 2 : 4;
  for (let i = 0; i < n && T0.blots.length; i++) {
    const bw = 340 + rr() * 220, im = add(gg, 'image', { x: x + rr() * (w - bw), y: y + rr() * (h - bw * 0.7), width: bw, height: bw * 0.7, opacity: T0.reg === 'cold' ? 0.62 : 0.36 });
    im.setAttribute('href', 'assets/b_' + T0.blots[Math.floor(rr() * T0.blots.length)] + '.webp'); im.setAttribute('preserveAspectRatio', 'none');
  }
  for (let i = 0; i < Math.ceil((w * h) / 240000); i++) {
    const rx = 70 + rr() * 100, ry = 50 + rr() * 70;
    add(gg, 'ellipse', { cx: x + rx + rr() * Math.max(0, w - 2 * rx), cy: y + ry + rr() * Math.max(0, h - 2 * ry), rx, ry, fill: rr() > 0.4 ? 'url(#lg-patchL)' : 'url(#lg-patchD)', opacity: T0.reg === 'volcanic' ? 0.35 : 0.55 });
  }
}
function ensureChunk(sx, sy) {
  const id = sx + ',' + sy;
  if (!chunks.has(id)) chunks.set(id, { sx, sy, id, dom: null });
  return chunks.get(id);
}
function buildChunk(d) {
  const S = SECTOR, T0 = S.theme, home = d.sx === 0 && d.sy === 0;
  const ox = d.sx * CW * T, oy = d.sy * CH * T, x0 = d.sx * CW, y0 = d.sy * CH;
  const L = (tx, ty) => [(tx - x0) * T, (ty - y0) * T];
  ART.org = [ox, oy];
  const gg = add(groundLayer, 'g', { transform: `translate(${ox},${oy})`, 'clip-path': 'url(#chunkclip)' });
  const og = add(objLayer, 'g', { transform: `translate(${ox},${oy})` });
  d.dom = [gg, og];
  const rr = rng(h2(d.sx + 5 + S.seed % 977, d.sy + 9 + (S.seed >>> 10) % 991));
  groundTheme(gg, -3, -3, CW * T + 6, CH * T + 6, T0, rr);
  const items = []; /* {by, draw(g), occ} */
  const kindAt = (tx, ty) => tileKind(tx, ty);

  /* settlement paving */
  if (home && S.town) for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CW; tx++) if (kindAt(tx, ty) === 'town') {
    add(gg, 'rect', { x: tx * T - 0.5, y: ty * T - 0.5, width: T + 1, height: T + 1, fill: 'url(#cobble)' });
    add(gg, 'rect', { x: tx * T - 0.5, y: ty * T - 0.5, width: T + 1, height: T + 1, fill: SECTOR.theme.reg === 'arid' ? '#e0b86a' : '#000', opacity: SECTOR.theme.reg === 'arid' ? 0.22 : 0.1 });
  }
  /* roads */
  if (home) { const runs = roadRuns(); if (runs.length) paintRoad(gg, runs); }
  else {
    const hz = new Set(), vt = new Set();
    for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CW; tx++) if (kindAt(tx, ty) === 'road') { if (tx < 0 || tx >= CW) hz.add(ty); else vt.add(tx); }
    const runs = [];
    hz.forEach((ty) => runs.push(smooth([[-0.6, ty - y0 + 0.5], [CW + 0.6, ty - y0 + 0.5]])));
    vt.forEach((tx) => runs.push(smooth([[tx - x0 + 0.5, -0.6], [tx - x0 + 0.5, CH + 0.6]])));
    if (runs.length) paintRoad(gg, runs);
  }
  /* water: sea, rivers, ponds (drawn in sector space, clipped per chunk) */
  const sx = -x0 * T, sy = -y0 * T;
  const wg = add(gg, 'g', { transform: `translate(${sx},${sy})` });
  const wk = T0.water;
  if (S.sea) {
    const seaTiles = [];
    for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CW; tx++) if (kindAt(tx, ty) === 'sea') seaTiles.push([tx, ty]);
    if (seaTiles.length) {
      const ext = (nx, ny) => (kindAt(nx, ny) === 'sea' ? 3.6 : 0.5);
      const sd = seaTiles.map(([tx, ty]) => { const l = ext(tx - 1, ty), r = ext(tx + 1, ty), u = ext(tx, ty - 1), d = ext(tx, ty + 1); return `M${tx * T - l} ${ty * T - u}h${T + l + r}v${T + u + d}h${-(T + l + r)}z`; }).join('');
      add(wg, 'path', { d: sd, fill: '#1a7188' });
      add(wg, 'path', { d: sd, fill: '#0f5069', opacity: 0.35 });
      add(wg, 'path', { d: sd, fill: riverTexPat, opacity: 0.4 });
      add(wg, 'path', { d: sd, fill: 'url(#wa)', opacity: 0.3 });
      add(wg, 'path', { d: sd, fill: 'url(#wb)', opacity: 0.3 });
    }
    /* shoreline: a pale wet-sand band and moving foam where the sea meets land */
    seaTiles.forEach(([tx, ty]) => {
      [[0, -1, 'N'], [0, 1, 'S'], [-1, 0, 'W'], [1, 0, 'E']].forEach(([dx, dy, side]) => {
        if (kindAt(tx + dx, ty + dy) === 'sea') return;
        const px = tx * T, py = ty * T;
        const [ax, ay, bx, by] = side === 'N' ? [px, py, px + T, py] : side === 'S' ? [px, py + T, px + T, py + T] : side === 'W' ? [px, py, px, py + T] : [px + T, py, px + T, py + T];
        add(wg, 'line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: '#cdbb86', 'stroke-width': 12, opacity: 0.55, 'stroke-linecap': 'round' });
        add(wg, 'line', { class: 'shorefoam', x1: ax, y1: ay, x2: bx, y2: by, stroke: '#f2fffb', 'stroke-width': 3.4, opacity: 0.85, 'stroke-dasharray': '10 8', 'stroke-linecap': 'round' });
      });
    });
  }
  const inChunk = (px, py, m) => px + m > x0 * T && px - m < (x0 + CW) * T && py + m > y0 * T && py - m < (y0 + CH) * T;
  const pondAt = (px, py, rx, ry, seed) => { if (!inChunk(px, py, Math.max(rx, ry) + 60)) return; ART.org = [0, 0]; ART.pond(wg, px, py, rx, ry, seed, rr, { tint: wk === 'lava' ? '#e5501a' : wk === 'ice' ? '#b7d9ea' : undefined }); ART.org = [ox, oy]; };
  S.rivers.forEach((r, ri) => {
    if (r.pond) { pondAt(r.cx * T, r.cy * T, (r.rx + 0.15) * T, (r.ry + 0.12) * T, ri); return; }
    paintRiver(wg, smooth(r.pts), wk === 'sea' ? 'water' : wk);
    const first = r.pts[0], last = r.pts[r.pts.length - 1], outside = (p) => p[0] < -0.5 || p[0] > CW + 0.5 || p[1] < -0.5 || p[1] > CH + 0.5;
    if (outside(first) && !r.srcNorth) pondAt(first[0] * T, first[1] * T, 1.5 * T, 1.0 * T, 30 + ri);
    if (outside(last)) pondAt(last[0] * T, last[1] * T, 2.2 * T, 1.2 * T, 20 + ri);
  });
  ART.org = [ox, oy];

  /* scenery tile by tile */
  const placed = [];
  const addTree = (cx, cy, kind, s, pal, jit) => {
    const px = (cx - x0 + 0.5 + (jit ? OBST_JIT(rr) : 0)) * T, py = (cy - y0 + 0.62 + (jit ? OBST_JIT(rr) * 0.6 : 0)) * T;
    items.push({ by: py + 11 * s, occ: { t: 'e', cx: px, cy: py - 50 * s, rx: 38 * s, ry: 46 * s }, draw: (g) => ART.tree(g, px, py, s, pal, items.length, kind) });
  };
  const addRock = (cx, cy, s) => {
    const px = (cx - x0 + 0.5 + OBST_JIT(rr)) * T, py = (cy - y0 + 0.55 + OBST_JIT(rr) * 0.5) * T;
    items.push({ by: py + 13, occ: { t: 'e', cx: px, cy: py - 8, rx: 24 * s, ry: 18 * s }, draw: (g) => { const gr = add(g, 'g', { class: 'rock' }); ART.rock(gr, px, py, s); if (T0.reg === 'volcanic' && rr() > 0.5) add(gr, 'circle', { class: 'puff', cx: px + 4, cy: py - 24, r: 9, fill: 'url(#puffG)' }); } });
  };
  const addGrave = (cx, cy) => { const px = (cx - x0 + 0.5) * T, py = (cy - y0 + 0.7) * T; items.push({ by: py + 8, occ: { t: 'e', cx: px, cy: py - 14, rx: 40, ry: 20 }, draw: (g) => { add(g, 'ellipse', { cx: px, cy: py + 4, rx: 40, ry: 10, fill: 'url(#shadowG)', opacity: 0.5 }); ART.spr(g, 'graveyard_stones', px, py + 8, 92); } }); };
  const addHouse = (cx, cy, i) => {
    const w = 1.5 * T, hh = 1.0 * T, bx = (cx - x0 + 0.5) * T - w / 2, by = (cy - y0) * T + 4;
    const cw = Math.max(w * 1.48, 150);
    items.push({ by: by + hh - 2, occ: { t: 'r', x0: bx + w / 2 - cw * 0.42, x1: bx + w / 2 + cw * 0.5, y0: by + hh - cw * 0.78, y1: by + hh }, draw: (g) => ART.house(g, bx, by, w, hh, { style: i % 3 === 2 ? 2 : i % 2, roof: ['red', 'slate', 'thatch', 'teal'][i % 4], chim: i % 3 !== 1, idx: i }) });
  };
  const sCount = (tx, ty) => { let n = 0; for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) if (a || b) { const c = home ? cellOf2(tx + a, ty + b) : null; if (c && c.ch === 's') n++; } return n; };
  const fount = [];
  for (let ty = y0; ty < y0 + CH; ty++) for (let tx = x0; tx < x0 + CW; tx++) {
    const k = kindAt(tx, ty), r1 = rr();
    if (k === 'solid') {
      if (home && S.town) {
        const n4 = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([a, b]) => cellOf2(tx + a, ty + b) && cellOf2(tx + a, ty + b).ch === 's').length;
        if (n4 === 4) { fount.push([tx, ty]); continue; }
        if (sCount(tx, ty) >= 2) { addHouse(tx, ty, tx * 7 + ty * 3); continue; }
      }
      const o = pickW(T0.obst, r1);
      if (o === 'rock') addRock(tx, ty, 0.8 + rr() * 0.6);
      else if (o === 'grave') addGrave(tx, ty);
      else addTree(tx, ty, o, 0.85 + rr() * 0.5, rr(), true);
    } else if (k === 'ring') {
      if (rr() < T0.ring) {
        const o = pickW(T0.obst, rr());
        if (o === 'rock') addRock(tx, ty, 0.8 + rr() * 0.7);
        else if (o === 'grave') addRock(tx, ty, 1);
        else addTree(tx, ty, o, 0.85 + rr() * 0.5, rr(), true);
      } else if (rr() < 0.3 && T0.tuft) {
        const [tx2, ty2] = L(tx + rr(), ty + rr()); items.push({ by: ty2, draw: (g) => ART.tuft(g, tx2, ty2, tx + ty, rr, T0.tuft) });
      }
    } else if (k === 'free' && T0.tuft && rr() < 0.22 && home) {
      const [tx2, ty2] = L(tx + 0.2 + rr() * 0.6, ty + 0.3 + rr() * 0.5); items.push({ by: ty2, tuft: true, draw: (g) => ART.tuft(g, tx2, ty2, tx + ty, rr, T0.tuft) });
    } else if (k === 'free' && !T0.tuft && rr() < 0.1 && home) {
      /* sparse biomes: pebbles / bones / ember stones instead of grass */
      const [tx2, ty2] = L(tx + 0.2 + rr() * 0.6, ty + 0.4 + rr() * 0.4);
      items.push({ by: ty2, draw: (g) => { add(g, 'ellipse', { cx: tx2, cy: ty2, rx: 5 + rr() * 5, ry: 2.5 + rr() * 2, fill: T0.reg === 'volcanic' ? '#3b2a28' : T0.reg === 'cold' ? '#c9dcea' : '#a28a54', opacity: 0.75 }); } });
    }
  }
  /* settlement dressing */
  if (home && S.town) {
    fount.forEach(([tx, ty]) => { const px = (tx - x0 + 0.5) * T, py = (ty - y0 + 0.5) * T; items.push({ by: py + 30, occ: { t: 'e', cx: px, cy: py, rx: 40, ry: 36 }, draw: (g) => { add(g, 'ellipse', { cx: px, cy: py + 24, rx: 48, ry: 13, fill: 'url(#shadowG)' }); ART.spr(g, 'cobble_fountain', px, py + 34, 100); add(g, 'circle', { class: 'ripple', cx: px, cy: py + 2, r: 16, fill: 'none', stroke: '#cfe6e2', 'stroke-width': 1.4 }); } }); });
    let lampN = 0;
    for (let ty = 0; ty < CH; ty++) for (let tx = 0; tx < CW; tx++) if (S.grid[ty][tx].ch === 's' && (tx + ty * 2) % 4 === 0 && lampN < 8) {
      const blockedSide = [[1, 0], [-1, 0]].find(([a]) => { const c = cellOf2(tx + a, ty); return c && c.ch === '#'; });
      if (!blockedSide) continue; lampN++;
      const px = (tx + 0.5 + blockedSide[0] * 0.38) * T, py = (ty + 0.9) * T;
      items.push({ by: py, draw: (g) => { add(g, 'circle', { class: 'lamp', cx: px, cy: py - 34, r: 56, fill: 'url(#lg-glowwin)', style: 'mix-blend-mode:screen;opacity:.85' }); add(g, 'ellipse', { cx: px + 4, cy: py + 3, rx: 10, ry: 4, fill: 'url(#shadowG)' }); ART.spr(g, 'iron_lamppost', px, py + 5, 30); } });
    }
  }
  /* bridges */
  if (home) S.bridges.forEach((b) => { const r = S.rivers.find((rv) => !rv.pond && rv.cells.some((c) => c[0] === b.x && c[1] === b.y)); const wgt = 2.4 * T; const cx = (b.vertical ? (r ? r.pts[0][0] : b.x + 0.5) : b.x + 0.5) * T; items.push({ by: -1, bridge: true, draw: (g) => (b.vertical ? ART.bridge(g, cx - wgt / 2, (b.y + 0.5) * T, wgt) : ART.bridge(g, (b.x + 0.5) * T - wgt / 2, (b.y + 0.5) * T, wgt)) }); });
  /* landmarks */
  if (home) S.landmarks.forEach((lm) => {
    const px = (lm.x + 0.5) * T, py = (lm.y + 0.5) * T;
    if (lm.kind === 'watchtower') items.push({ by: py - 10, occ: { t: 'e', cx: px, cy: py - 60, rx: 30, ry: 70 }, draw: (g) => ART.tower(g, px, py - 12, 0.86) });
    else if (lm.kind === 'frontier' || lm.kind === 'anchor') items.push({ by: py, draw: (g) => { add(g, 'circle', { class: 'pulse', cx: px, cy: py - 20, r: 44, fill: 'url(#gx-teal)', style: 'mix-blend-mode:screen' }); ART.spr(g, 'teal_rune_stone', px, py + 8, 50); } });
  });
  /* waterfall at a river's northern source, and a spring where a river enters from the side */
  if (home) S.rivers.forEach((r) => {
    if (r.pond) return;
    if (r.srcNorth && T0.water !== 'lava') {
      const cx = r.pts[1][0] * T, by = -3.1 * T;
      d.fall = true;
      items.push({ by: by + 20, fall: true, draw: (g) => ART.fall(g, cx, by, 3.4 * T) });
    }
  });
  /* ice and cold-biome cover on water; embers for lava */
  const sorted = items.filter((i) => !i.bridge).sort((a, b) => a.by - b.by);
  const grp = add(og, 'g', { class: 'ys' });
  if (home) { boardObj = grp; occluders.length = 0; }
  items.filter((i) => i.bridge).forEach((i) => i.draw(add(grp, 'g', { 'data-by': -1 })));
  sorted.forEach((i) => { const g = add(grp, 'g', { 'data-by': i.by.toFixed(1) }); i.draw(g); if (home && i.occ) occluders.push({ by: i.by, ...i.occ }); });
  if (home) { /* travellers live in the same depth-sorted group */
    hero.setAttribute('data-by', '0'); grp.appendChild(hero);
    OTHERS.forEach((p) => grp.appendChild(p.el));
    ACTORS_SORT();
  }
}
function updateChunks(cx, cy, vc, vr) {
  if (!SECTOR) return;
  const sx0 = Math.floor(cx / CW) - 0, sx1 = Math.floor((cx + vc) / CW), sy0 = Math.floor(cy / CH), sy1 = Math.floor((cy + vr) / CH);
  for (let sy = sy0; sy <= sy1; sy++) for (let sx = sx0; sx <= sx1; sx++) { const d = ensureChunk(sx, sy); if (!d.dom) buildChunk(d); }
  for (const d of chunks.values()) if (d.dom && (d.sx < sx0 - 1 || d.sx > sx1 + 1 || d.sy < sy0 - 1 || d.sy > sy1 + 1) && !(d.sx === 0 && d.sy === 0)) { d.dom.forEach((n) => n.remove()); d.dom = null; }
}


/* ---------- camera + walking (server authoritative: the stage only sends intents and draws what the server confirms) ---------- */
const view = document.getElementById('viewport');
const sbXY = document.getElementById('sb-xy'), sbSecCell = document.getElementById('sb-sec-cell');
const svgEl = document.getElementById('nav-svg');
const post = (msg) => { try { parent.postMessage({ av: 'world-stage', ...msg }, location.origin); } catch (e) {} };
let me = { x: 6, y: 4 }, meV = { x: 6, y: 4 };
const ZB = 0.84; /* widest default: 100% shows about 15.5 x 10.7 tiles */
let zoom = 1; /* 1 = 13 x 9 tiles; 0.6 = about 21.7 x 15 tiles */
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function camera() {
  const vc = VCOLS / (zoom * ZB), vr = VROWS / (zoom * ZB);
  return { vc, vr, cx: meV.x + 0.5 - vc / 2, cy: meV.y + 0.5 - vr / 2 };
}
function fitMap() {
  const vp = document.getElementById('viewport'), W = vp.clientWidth, H = vp.clientHeight;
  if (W < 50 || H < 50) return;
  const a = Math.min(2.8, W / H);
  if (a >= 13 / 9) { VROWS = 9; VCOLS = Math.round(9 * a * 100) / 100; } else { VCOLS = 13; VROWS = Math.round(13 / a * 100) / 100; }
  paint();
}
window.addEventListener('resize', () => fitMap());
if (window.ResizeObserver) new ResizeObserver(() => fitMap()).observe(document.getElementById('viewport'));

/* ---------- travellers ---------- */
const OTHERS = []; /* one entry per occupied tile: the highest level stands for the stack */
const byId = new Map();
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const dist = (p) => Math.max(Math.abs(p.x - me.x), Math.abs(p.y - me.y));
const feedEl = document.getElementById('feed');
const nbList = document.getElementById('nb-list'), nbNote = document.getElementById('nb-note');
let noteTimer = 0;
function say(msg) { feedEl.textContent = msg; nbNote.textContent = msg; clearTimeout(noteTimer); noteTimer = setTimeout(() => { nbNote.textContent = ''; }, 4500); }
const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function actorBy(vy) { return (vy + 0.5) * T + 22; }
function placeActor(el, by) {
  el.setAttribute('data-by', by.toFixed(1));
  if (!boardObj) return;
  let next = null;
  for (const c of boardObj.children) { if (c === el) continue; const b = Number(c.getAttribute('data-by')); if (b > by) { next = c; break; } }
  if (el.parentNode !== boardObj || el.nextSibling !== next) boardObj.insertBefore(el, next);
}
function ACTORS_SORT() {
  if (!boardObj) return;
  placeActor(hero, actorBy(meV.y)); hero._row = Math.floor(meV.y);
  OTHERS.forEach((p) => { placeActor(p.el, actorBy(p.vy)); p._row = Math.floor(p.vy); });
}
let heroGhost = null;
function hiddenBehind(vx, vy) {
  const px = (vx + 0.5) * T, py = (vy + 0.5) * T - 4, by = actorBy(vy);
  for (const o of occluders) {
    if (o.by <= by) continue;
    if (o.t === 'e') { const a = (px - o.cx) / (o.rx + 14), b = (py - o.cy) / (o.ry + 14); if (a * a + b * b < 1) return true; }
    else if (px > o.x0 - 14 && px < o.x1 + 14 && py > o.y0 - 14 && py < o.y1 + 14) return true;
  }
  return false;
}
function drawActors() {
  hero.style.transform = `translate(${(meV.x + 0.5) * T}px, ${(meV.y + 0.5) * T}px)`;
  if (Math.floor(meV.y) !== hero._row) placeActor(hero, actorBy(meV.y)), (hero._row = Math.floor(meV.y));
  if (!heroGhost) heroGhost = mkGhost(HERO_PORTRAIT, true);
  const hb = hiddenBehind(meV.x, meV.y);
  heroGhost.style.display = hb ? '' : 'none';
  if (hb) heroGhost.style.transform = `translate(${(meV.x + 0.5) * T}px, ${(meV.y + 0.5) * T}px)`;
  OTHERS.forEach((p) => {
    p.el.style.transform = `translate(${(p.vx + 0.5) * T}px, ${(p.vy + 0.5) * T}px)`;
    if (Math.floor(p.vy) !== p._row) { placeActor(p.el, actorBy(p.vy)); p._row = Math.floor(p.vy); }
    const hb2 = hiddenBehind(p.vx, p.vy);
    p.ghost.style.display = hb2 ? '' : 'none';
    if (hb2) p.ghost.style.transform = `translate(${(p.vx + 0.5) * T}px, ${(p.vy + 0.5) * T}px)`;
  });
}
let HERO_PORTRAIT = null, heroBuilt = false;
function buildHero() {
  if (heroBuilt) return; heroBuilt = true;
  mkToken(hero, 'hero', HERO_PORTRAIT);
  if (window.AV_attachLantern) window.AV_attachLantern();
}

function refreshPlayers(list) {
  /* group by tile; the highest level represents the stack, every character stays in the Nearby list */
  const tiles = new Map();
  list.filter((p) => p.position.sectorId === SECTOR.id).slice().sort((a, b) => b.level - a.level || a.name.localeCompare(b.name)).forEach((p) => {
    const k = p.position.x + ',' + p.position.y;
    if (!tiles.has(k)) tiles.set(k, { rep: p, count: 0 });
    tiles.get(k).count++;
  });
  const keep = new Set();
  tiles.forEach(({ rep, count }, k) => {
    keep.add(rep.characterId);
    let o = byId.get(rep.characterId);
    const sig = [rep.name, rep.level, rep.online, count, rep.portrait].join('|');
    if (!o) { o = { id: rep.characterId, x: rep.position.x, y: rep.position.y, vx: rep.position.x, vy: rep.position.y, el: add(world, 'g', { class: 'mk', 'data-player': rep.characterId }) }; byId.set(rep.characterId, o); OTHERS.push(o); o.ghost = null; }
    o.x = rep.position.x; o.y = rep.position.y; o.name = rep.name; o.lv = rep.level; o.online = rep.online !== false; o.count = count; o.attackable = rep.attackable;
    if (o.sig !== sig) {
      o.sig = sig; o.el.replaceChildren();
      if (o.ghost) o.ghost.remove();
      o.ghost = mkGhost(rep.portrait, false);
      o.ring = add(o.el, 'circle', { r: 38, fill: 'none', stroke: '#e0624a', 'stroke-width': 3, 'stroke-dasharray': '7 6', style: 'display:none' });
      mkToken(o.el, 'player', rep.portrait, { offline: !o.online });
      const lab = rep.name + (count > 1 ? `  +${count - 1}` : ''), lw = lab.length * 7.2 + 18;
      add(o.el, 'rect', { x: -lw / 2, y: 33, width: lw, height: 21, rx: 4, fill: '#041a22', opacity: 0.82, stroke: '#c9a24c', 'stroke-opacity': 0.55 });
      add(o.el, 'text', { y: 48, 'text-anchor': 'middle', fill: o.online ? '#fff3d7' : '#a9b5b3', 'font-size': 12.5, 'font-family': 'Palatino Linotype, Palatino, Georgia, serif', 'letter-spacing': '.03em' }).textContent = lab;
      if (boardObj) boardObj.appendChild(o.el);
      o._row = -99;
    }
  });
  for (let i = OTHERS.length - 1; i >= 0; i--) if (!keep.has(OTHERS[i].id)) { OTHERS[i].el.remove(); if (OTHERS[i].ghost) OTHERS[i].ghost.remove(); byId.delete(OTHERS[i].id); OTHERS.splice(i, 1); }
  ACTORS_SORT();
}

/* ---------- zone, dock, points of interest ---------- */
const zoneBadge = document.getElementById('zone-badge'); let lastSafe = null;
const zoneSafe = (x, y) => { const c = cellOf2(x, y); return !!c && c.safe; };
function updateZone() {
  if (!SECTOR) return;
  const safe = zoneSafe(me.x, me.y);
  zoneBadge.dataset.z = safe ? 'safe' : 'pvp'; zoneBadge.textContent = safe ? 'Safe zone' : 'PvP zone';
  zoneBadge.title = safe ? 'Towns and settlements are safe zones: combat is disabled' : 'Open land: other characters can fight here';
  if (lastSafe !== null && lastSafe !== safe) say(safe ? 'You are in a safe zone. Combat is disabled here.' : 'You have left the safe zone. This is a PvP zone.');
  lastSafe = safe;
}
let lastRoster = '';
let ROSTER = [];
function renderRoster() {
  const sorted = ROSTER.slice().sort((a, b) => Number(b.online !== false) - Number(a.online !== false) || b.level - a.level || a.name.localeCompare(b.name));
  const mySafe = zoneSafe(me.x, me.y), busy = Boolean(SV && (SV.busy || SV.movementBlocked));
  const html = sorted.map((p) => {
    const d = Math.max(Math.abs(p.position.x - me.x), Math.abs(p.position.y - me.y)), r = d <= 1, on = p.online !== false;
    const btn = r
      ? `${!mySafe && !zoneSafe(p.position.x, p.position.y) ? `<button type="button" class="atk" data-act="attack" data-id="${esc(p.characterId)}" aria-label="Attack ${esc(p.name)}"${p.attackable && !busy ? '' : ' disabled'}>Attack</button>` : ''}<button type="button" class="tk" disabled title="Talking is coming soon" aria-label="Talk to ${esc(p.name)} (coming soon)">Talk</button>`
      : `<button type="button" data-act="approach" data-id="${esc(p.characterId)}" aria-label="Approach ${esc(p.name)}"${busy ? ' disabled' : ''}>Approach</button>`;
    return `<div class="nbt" data-reach="${r}" data-online="${on}" data-ai="false"><span class="nc"><img src="${esc(p.portrait)}" alt="" referrerpolicy="no-referrer"></span><span class="nn" title="${esc(p.name)}">${esc(p.name)}</span><span class="ns">Player · Lv ${p.level}${on ? '' : ' · Away'}</span><span class="na">${btn}</span></div>`;
  }).join('') || '<p class="dockempty">A quiet stretch of road. Other characters appear here when they are in your area.</p>';
  if (html !== lastRoster) { nbList.innerHTML = html; lastRoster = html; }
}
nbList.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
  const p = ROSTER.find((q) => q.characterId === b.dataset.id); if (!p) return;
  if (b.dataset.act === 'attack') { post({ type: 'attack', targetId: p.characterId }); say(`Challenging ${p.name}…`); }
  else { say(`Approaching ${p.name}…`); post({ type: 'walk', destination: { sectorId: SECTOR.id, x: p.position.x, y: p.position.y } }); }
});
function onMoveUi() {
  updateZone(); renderRoster();
  if (window.AV) window.AV.onMove();
}

/* ---------- painting ---------- */
let lastSectorId = null;
function frameUpdate() {
  const { vc, vr, cx, cy } = camera();
  world.style.transform = `translate(${-cx * T}px, ${-cy * T}px)`;
  followClouds(cx, cy);
  updateChunks(cx, cy, vc, vr);
  drawActors();
}
function paint() {
  const { cx, cy } = camera();
  svgEl.setAttribute('viewBox', `0 0 ${(VCOLS * T / (zoom * ZB)).toFixed(1)} ${(VROWS * T / (zoom * ZB)).toFixed(1)}`);
  frameUpdate();
  if (SECTOR) {
    const sec = SV && SV.sectors.find((s) => s.id === SECTOR.id);
    sbXY.textContent = sec ? `${sec.coordinate} · E${sec.east + me.x} · N${sec.north - me.y}` : '';
    if (lastSectorId !== null && lastSectorId !== SECTOR.id) { sbSecCell.classList.remove('sbflash'); void sbSecCell.offsetWidth; sbSecCell.classList.add('sbflash'); }
    lastSectorId = SECTOR.id;
  }
  onMoveUi();
}
let lastV = performance.now();
function visualStep(now) {
  requestAnimationFrame(visualStep);
  const dt = Math.min(0.05, (now - lastV) / 1000); lastV = now;
  let changed = false;
  const mv = (o, tx, ty) => {
    const dx = tx - o.x, dy = ty - o.y, d = Math.hypot(dx, dy);
    if (d < 0.002) { if (d > 0) { o.x = tx; o.y = ty; return true; } return false; }
    if (reduceMotion) { o.x = tx; o.y = ty; return true; }
    const sp = Math.max(3.4, d * 4.5), s = Math.min(d, sp * dt);
    o.x += (dx / d) * s; o.y += (dy / d) * s; return true;
  };
  if (mv(meV, me.x, me.y)) changed = true;
  OTHERS.forEach((p) => { const pv = { x: p.vx, y: p.vy }; if (mv(pv, p.x, p.y)) { p.vx = pv.x; p.vy = pv.y; changed = true; } });
  if (changed) frameUpdate();
}
requestAnimationFrame(visualStep);

/* ---------- route preview ---------- */
const routeG = add(routeLayer, 'g', {});
function drawRoute() {
  routeG.replaceChildren();
  if (!SV || !SECTOR) return;
  const pts = SV.route.filter((s) => s.position.sectorId === SECTOR.id).map((s) => s.position);
  if (!pts.length) return;
  const all = [{ x: me.x, y: me.y }, ...pts];
  add(routeG, 'polyline', { points: all.map((p) => `${(p.x + 0.5) * T},${(p.y + 0.5) * T}`).join(' '), fill: 'none', stroke: '#f4e2a8', 'stroke-width': 4, 'stroke-dasharray': '2 12', 'stroke-linecap': 'round', opacity: 0.85 });
  const last = pts[pts.length - 1], cx = (last.x + 0.5) * T, cy = (last.y + 0.5) * T;
  add(routeG, 'circle', { class: 'pulse', cx, cy, r: 22, fill: 'none', stroke: '#ffe197', 'stroke-width': 2.4 });
  add(routeG, 'polygon', { points: `${cx},${cy - 11} ${cx + 8},${cy} ${cx},${cy + 11} ${cx - 8},${cy}`, fill: '#e6cb80', stroke: '#06202b', 'stroke-width': 1.6 });
}

/* ---------- input ---------- */
let queued = null; /* last wish while the page is busy confirming an earlier command */
function sendWalk(dest) {
  if (SV && (SV.busy || SV.movementBlocked)) { queued = dest; if (SV.movementBlocked) say(SV.movementBlocked); return; }
  queued = null; post({ type: 'walk', destination: dest });
}
function exitAt(x, y) { return SECTOR && SECTOR.exits.find((e) => e.from.sectorId === SECTOR.id && e.from.x === x && e.from.y === y); }
function blockWhy(x, y) {
  const k = x >= 0 && y >= 0 && x < CW && y < CH ? tileKind(x, y) : 'ring';
  if (k === 'water') return SECTOR.theme.water === 'lava' ? 'A river of lava. Nothing survives crossing it; look for a bridge.' : 'The water is too deep and fast to wade. Look for a bridge.';
  if (k === 'sea') return 'Open water. You cannot cross the sea on foot.';
  if (cellOf2(x, y) && !cellOf2(x, y).known) return 'Uncharted ground.';
  return 'Something blocks the way.';
}
function tileFromEvent(e) {
  const r = view.getBoundingClientRect(), { vc, vr, cx, cy } = camera();
  return { x: Math.floor(((e.clientX - r.left) / r.width) * vc + cx), y: Math.floor(((e.clientY - r.top) / r.height) * vr + cy) };
}
view.addEventListener('click', (e) => {
  if (performance.now() - pinchedAt < 350 || !SECTOR) return;
  const mk = e.target.closest && e.target.closest('[data-player]');
  if (mk) { const p = byId.get(mk.dataset.player); if (p) { const full = ROSTER.find((q) => q.characterId === p.id); if (full) { const near = dist(full.position) <= 1; if (near && full.attackable && !(zoneSafe(me.x, me.y) || zoneSafe(full.position.x, full.position.y))) post({ type: 'attack', targetId: p.id }); else if (near) say(zoneSafe(me.x, me.y) ? 'This is a safe zone. Combat is disabled in towns.' : `${p.name} cannot be attacked right now.`); else sendWalk({ sectorId: SECTOR.id, x: full.position.x, y: full.position.y }); } } return; }
  const t = tileFromEvent(e);
  const ex = exitAt(t.x, t.y);
  if (ex) { say(`Travelling along ${ex.name}.`); sendWalk(ex.to); return; }
  if (isBlocked(t.x, t.y)) { say(blockWhy(t.x, t.y)); return; }
  sendWalk({ sectorId: SECTOR.id, x: t.x, y: t.y });
});
/* movement keys are hardwired: W A S D and the arrows work anywhere while the map is on screen */
const keys = { ArrowUp: [0, -1], w: [0, -1], ArrowDown: [0, 1], s: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], ArrowRight: [1, 0], d: [1, 0] };
let inView = true;
new IntersectionObserver(([en]) => (inView = en.isIntersecting), { threshold: 0.2 }).observe(view);
window.addEventListener('keydown', (e) => {
  if (!inView || e.ctrlKey || e.metaKey || e.altKey || !SECTOR) return;
  if (e.target && /^(INPUT|SELECT|TEXTAREA)$/.test(e.target.tagName)) return;
  if (e.key === '-' || e.key === '=' || e.key === '+') { e.preventDefault(); return setZoom(zoom + (e.key === '-' ? -0.1 : 0.1)); }
  const d = keys[e.key.length === 1 ? e.key.toLowerCase() : e.key];
  if (!d) return;
  e.preventDefault();
  const nx = me.x + d[0], ny = me.y + d[1];
  if (nx < 0 || ny < 0 || nx >= CW || ny >= CH) { const ex = exitAt(me.x, me.y); if (ex) { say(`Travelling along ${ex.name}.`); sendWalk(ex.to); } return; }
  if (isBlocked(nx, ny)) { say(blockWhy(nx, ny)); return; }
  sendWalk({ sectorId: SECTOR.id, x: nx, y: ny });
});



/* toggles */
const board = document.getElementById('board');
const setPressed = (btn, on) => btn.setAttribute('aria-pressed', String(on));
const motionBtn = document.getElementById('btn-motion');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const fxBtn = document.getElementById('fx-btn'), fxState = document.getElementById('fx-state');
let fxOn = !reduce;
try { const sv = localStorage.getItem('aurevane.mapEffects'); if (sv === 'off') fxOn = false; else if (sv === 'on') fxOn = true; } catch (e) {}
function setFx(on, save) {
  fxOn = on;
  board.dataset.motion = String(on); board.dataset.lite = String(!on);
  setPressed(motionBtn, on); setPressed(fxBtn, on); fxState.textContent = on ? 'On' : 'Off';
  if (save) { try { localStorage.setItem('aurevane.mapEffects', on ? 'on' : 'off'); } catch (e) {} }
}
setFx(fxOn, false);
motionBtn.addEventListener('click', () => setFx(!fxOn, true));
fxBtn.addEventListener('click', () => setFx(!fxOn, true));

/* zoom: widens the visible window; the camera, rails and click targeting all follow */
const zoomEl = document.getElementById('zoom'), zoomVal = document.getElementById('zoom-val');
let zTween = 0;
function setZoom(target) {
  target = clamp(Math.round(target * 100) / 100, 0.6, 1);
  zoomEl.value = String(Math.round(target * 100));
  zoomVal.textContent = Math.round(target * 100) + '%';
  cancelAnimationFrame(zTween);
  if (reduce || board.dataset.motion !== 'true') { world.classList.remove('snap'); zoom = target; paint(); return; }
  const from = zoom, t0 = performance.now();
  world.classList.add('snap');
  const tick = (now) => {
    const k = Math.min(1, (now - t0) / 260);
    zoom = from + (target - from) * (1 - Math.pow(1 - k, 3));
    paint();
    if (k < 1) zTween = requestAnimationFrame(tick);
    else world.classList.remove('snap');
  };
  zTween = requestAnimationFrame(tick);
}
function zoomNow(t) {
  t = clamp(Math.round(t * 100) / 100, 0.6, 1);
  cancelAnimationFrame(zTween); world.classList.remove('snap');
  zoom = t; zoomEl.value = String(Math.round(t * 100)); zoomVal.textContent = Math.round(t * 100) + '%';
  paint();
}
/* scroll wheel, trackpad pinch (ctrl + wheel) and two-finger touch pinch all drive the same zoom as the slider */
let pinchedAt = 0;
const zlEl = document.getElementById('zl');
const zlLocked = () => zlEl.getAttribute('aria-pressed') === 'true';
window.zoomLocked = zlLocked;
const setZl = (on) => { zlEl.setAttribute('aria-pressed', String(on)); zlEl.querySelector('b').textContent = on ? 'On' : 'Off'; zlEl.title = on ? 'Zoom locked: scroll and pinch will not zoom. Click to unlock.' : 'Click to lock scroll and pinch zoom'; };
try { setZl(localStorage.getItem('aurevane.zoomLock') === 'on'); } catch (e) {}
zlEl.addEventListener('click', () => { setZl(!zlLocked()); try { localStorage.setItem('aurevane.zoomLock', zlLocked() ? 'on' : 'off'); } catch (e) {} });
view.style.touchAction = 'pan-y';
view.addEventListener('wheel', (e) => { if (zlLocked()) return; e.preventDefault(); zoomNow(zoom - e.deltaY * (e.ctrlKey ? 0.012 : 0.0016)); }, { passive: false });
const pts = new Map(); let pinch0 = 0, zoom0 = 1;
const pdist = () => { const [a, b] = [...pts.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
view.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2) { pinch0 = pdist(); zoom0 = zoom; pinchedAt = performance.now(); } });
view.addEventListener('pointermove', (e) => { if (!pts.has(e.pointerId)) return; pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pts.size === 2 && pinch0 > 0 && !zlLocked()) { pinchedAt = performance.now(); zoomNow(zoom0 * (pdist() / pinch0)); } });
const endPtr = (e) => { pts.delete(e.pointerId); if (pts.size < 2) pinch0 = 0; };
view.addEventListener('pointerup', endPtr); view.addEventListener('pointercancel', endPtr);
const onGlobe = () => window.AV && window.AV.mode() === 'world';
zoomEl.addEventListener('input', () => (onGlobe() ? window.AV.globeZoom(Number(zoomEl.value) / 100) : setZoom(Number(zoomEl.value) / 100)));
document.getElementById('zoom-out').addEventListener('click', () => (onGlobe() ? window.AV.globeStep(1 / 1.2) : setZoom(zoom - 0.1)));
document.getElementById('zoom-in').addEventListener('click', () => (onGlobe() ? window.AV.globeStep(1.2) : setZoom(zoom + 0.1)));


/* ---------- globe support: one numbered tile per sector, wrapped around the world ---------- */
const STEP_MS = 275;
const GCOLS = 32, GROWS = 16, HOME_C = 10, HOME_R = 7;
const hubNames = {};
const cellOf = (sx, sy) => [(((HOME_C + sx) % GCOLS) + GCOLS) % GCOLS, (((HOME_R + sy) % GROWS) + GROWS) % GROWS];
const NAME_A = ['Alder', 'Bracken', 'Cinder', 'Dun', 'Elm', 'Fen', 'Gale', 'Heron', 'Iron', 'Juniper', 'Kestrel', 'Lark', 'Moss', 'Nettle', 'Oak', 'Pike', 'Quill', 'Reed', 'Sorrel', 'Thorn', 'Umber', 'Vale', 'Willow', 'Yarrow'];
const NAME_B = ['wood', 'mere', 'fold', 'reach', 'hollow', 'stead', 'moor', 'glen', 'ford', 'rise', 'brook', 'field'];
const sectorNum = (sx, sy) => { const [c, r] = cellOf(sx, sy); return r * GCOLS + c + 1; };
function sectorName(sx, sy) {
  const [c, r] = cellOf(sx, sy);
  if (hubNames[c + ',' + r]) return hubNames[c + ',' + r];
  const h = h2(c + 500, r + 500);
  return NAME_A[h % 24] + NAME_B[(h >>> 5) % 12];
}
/* where each real sector sits on the globe (the globe is the same world the local map shows) */
const SECTOR_CELL = {
  'aureth-crown': [15, 7], 'verdant-expanse': [10, 7], 'emberreach': [20, 6], 'frostmere': [15, 2], 'glasswind-desert': [15, 12], 'hollow-coast': [8, 11], 'starfall-highlands': [7, 4], 'umbral-march': [23, 10],
  'crown-road': [14, 7], 'southern-caravan-road': [15, 9], 'highland-road': [12, 6], 'northern-pass': [11, 3], 'ember-road': [18, 6], 'coastal-road': [9, 9], 'eastern-march-road': [22, 8], 'old-coast-road': [22, 10],
  'crown-hinterland': [16, 7], 'crown-northfields': [15, 6], 'crown-uplands': [16, 6],
};
const HUB_OF_REGION = { 'aureth-crown': 'aureth', 'verdant-expanse': 'verdant', 'emberreach': 'ember', 'frostmere': 'frost', 'glasswind-desert': 'glass', 'hollow-coast': 'hollow', 'starfall-highlands': 'starfall', 'umbral-march': 'umbral' };


/* ---------- Day/night, weather, regions ---------- */
(() => {
  const clamp01 = (v) => Math.max(0, Math.min(1, v));
  const hash = (n) => { let t = (n + 0x6d2b79f5) >>> 0; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  /* One server-wide roll per real hour: keep the weather or move to a neighbouring state. Deterministic from the hour number. */
  const STAY = 0.5;
  const TRANS = {
    clear: { overcast: 0.4, wind: 0.25, fog: 0.2, rain: 0.15 },
    overcast: { clear: 0.35, rain: 0.35, fog: 0.1, wind: 0.1, storm: 0.1 },
    rain: { overcast: 0.4, storm: 0.25, clear: 0.2, fog: 0.15 },
    storm: { rain: 0.5, overcast: 0.4, clear: 0.1 },
    fog: { clear: 0.5, overcast: 0.35, rain: 0.15 },
    wind: { clear: 0.4, overcast: 0.35, rain: 0.15, storm: 0.1 },
  };
  const cache = new Map();
  function weatherAt(h) {
    if (cache.has(h)) return cache.get(h);
    let w = 'clear';
    for (let i = h - 96; i <= h; i++) {
      if (hash(i) < STAY) continue;
      let acc = 0; const r = hash(i + 7919);
      for (const [k, p] of Object.entries(TRANS[w])) { acc += p; if (r < acc) { w = k; break; } }
    }
    cache.set(h, w);
    return w;
  }
  const LABELS = {
    temperate: { clear: 'Clear', overcast: 'Overcast', rain: 'Rain', storm: 'Thunderstorm', fog: 'Fog', wind: 'Windy' },
    cold: { clear: 'Clear and frosty', overcast: 'Overcast', rain: 'Snow', storm: 'Blizzard', fog: 'Freezing fog', wind: 'Biting wind' },
    arid: { clear: 'Clear and hot', overcast: 'Hazy', rain: 'Light shower', storm: 'Sandstorm', fog: 'Heat haze', wind: 'Dust wind' },
  };
  LABELS.plains = LABELS.coast = LABELS.highland = LABELS.temperate;
  LABELS.volcanic = { clear: 'Clear and scorching', overcast: 'Smoke haze', rain: 'Ashfall', storm: 'Cinder storm', fog: 'Sulphur fog', wind: 'Hot ash wind' };
  LABELS.march = { clear: 'Clear and bleak', overcast: 'Gloom', rain: 'Cold rain', storm: 'Thunderstorm', fog: 'Marsh fog', wind: 'Grave wind' };
  const REGIONS = {
    temperate: { name: 'Verdant Expanse', blurb: 'Ancient woodland, river settlements and forgotten paths.' },
    cold: { name: 'Frostmere', blurb: 'A frozen bowl of pines, ice-locked lakes and warm halls.' },
    arid: { name: 'Glasswind Desert', blurb: 'Dune seas, oasis markets and wind-scoured stone.' },
  };
  const KEYS = [[0, [10, 16, 56, 0.62]], [5, [14, 22, 70, 0.55]], [6.2, [255, 150, 90, 0.22]], [7.6, [255, 205, 150, 0.08]], [9, [255, 255, 255, 0]], [16, [255, 255, 255, 0]], [17.6, [255, 170, 90, 0.16]], [19, [120, 70, 120, 0.38]], [20.6, [20, 26, 76, 0.55]], [24, [10, 16, 56, 0.62]]];
  function tintAt(h) {
    for (let i = 0; i < KEYS.length - 1; i++) {
      const [a, ca] = KEYS[i], [b, cb] = KEYS[i + 1];
      if (h >= a && h <= b) { const k = (h - a) / (b - a); return ca.map((v, j) => v + (cb[j] - v) * k); }
    }
    return KEYS[0][1];
  }
  function look(w, region) {
    const base = {
      clear: { mult: ['#ffffff', 0], veil: ['#ffffff', 0] },
      overcast: { mult: ['#4f5a66', 0.22], veil: ['#ffffff', 0] },
      rain: { mult: ['#3a4652', 0.32], veil: ['#ffffff', 0], fx: { kind: 'rain', n: 63, vx: 90, speed: 900 } },
      storm: { mult: ['#232c38', 0.5], veil: ['#ffffff', 0], fx: { kind: 'rain', n: 126, vx: 320, speed: 1150 }, lightning: true, wind: true },
      fog: { mult: ['#7d8b92', 0.1], veil: ['#dbe3e6', 0.42] },
      wind: { mult: ['#5d6a74', 0.1], veil: ['#ffffff', 0], wind: true },
    };
    const o = JSON.parse(JSON.stringify(base[w]));
    if (region === 'cold') {
      if (w === 'rain') { o.fx = { kind: 'snow', n: 63, vx: 30, speed: 70 }; o.mult = ['#5a6978', 0.18]; }
      if (w === 'storm') { o.fx = { kind: 'snow', n: 176, vx: 360, speed: 230 }; o.mult = ['#46566a', 0.28]; o.veil = ['#e8f0f6', 0.4]; o.lightning = false; }
      if (w === 'fog') o.veil = ['#d6e6f2', 0.48];
      if (w === 'wind') o.fx = { kind: 'snow', n: 29, vx: 260, speed: 40 };
    }
    if (region === 'arid') {
      if (w === 'overcast') o.mult = ['#8a7a60', 0.16];
      if (w === 'rain') { o.fx = { kind: 'rain', n: 20, vx: 40, speed: 800 }; o.mult = ['#7a6c58', 0.14]; }
      if (w === 'storm') { o.fx = { kind: 'sand', n: 118, vx: 560, speed: 30 }; o.mult = ['#8a6a3a', 0.3]; o.veil = ['#c99a55', 0.42]; o.lightning = false; }
      if (w === 'fog') o.veil = ['#f0d9a8', 0.3];
      if (w === 'wind') { o.fx = { kind: 'sand', n: 42, vx: 400, speed: 30 }; o.veil = ['#d9b475', 0.14]; }
    }
    if (region === 'volcanic') {
      if (w === 'clear') o.mult = ['#7a4a30', 0.1];
      if (w === 'overcast') o.mult = ['#5b3a30', 0.3];
      if (w === 'rain') { o.fx = { kind: 'sand', n: 90, vx: 50, speed: 140, color: 'rgba(160,150,146,0.6)' }; o.mult = ['#4a3028', 0.3]; }
      if (w === 'storm') { o.fx = { kind: 'sand', n: 160, vx: 260, speed: 200, color: 'rgba(255,150,70,0.55)' }; o.mult = ['#321c18', 0.5]; o.veil = ['#6a4636', 0.3]; }
      if (w === 'fog') o.veil = ['#b79c8c', 0.4];
      if (w === 'wind') { o.fx = { kind: 'sand', n: 60, vx: 340, speed: 60, color: 'rgba(180,120,90,0.5)' }; o.veil = ['#a08068', 0.12]; }
    }
    if (region === 'march') {
      o.mult = [o.mult[0] === '#ffffff' ? '#3a4a46' : o.mult[0], Math.max(o.mult[1], 0.16)];
      if (w === 'fog') o.veil = ['#c7d2cc', 0.55];
      if (w === 'clear') o.veil = ['#9fb0a8', 0.08];
    }
    return o;
  }

  const dn = document.getElementById('daynight'), wm = document.getElementById('wx-mult'), wv = document.getElementById('wx-veil');
  const sbTime = document.getElementById('sb-time'), sbWx = document.getElementById('sb-wx'), flashEl = document.getElementById('flash');
  const cv = document.getElementById('wx-canvas'), ctx = cv.getContext('2d');
  const tod = document.getElementById('tod'), todOut = document.getElementById('tod-out'), todLive = document.getElementById('tod-live');
  const wxSel = document.getElementById('wx-sel'), rgSel = document.getElementById('rg-sel');

  /* a lantern that follows the traveller after dark */
  const grad = add(defsEl, 'radialGradient', { id: 'lanternG' });
  add(grad, 'stop', { offset: '0', 'stop-color': '#ffd88a', 'stop-opacity': '0.95' });
  add(grad, 'stop', { offset: '1', 'stop-color': '#ffd88a', 'stop-opacity': '0' });
  const lantern = add(hero, 'circle', { class: 'lantern', r: 150, fill: 'url(#lanternG)', style: 'mix-blend-mode:screen' });
  hero.insertBefore(lantern, hero.firstChild);

  let timeManual = null, wxManual = null, region = 'temperate', pendingFx = null, curFx = null, lightning = false;
  /* server time runs in real seconds, minutes and hours (UTC); day and night follow it */
  const utcNow = () => { const n = new Date(); return { h: n.getUTCHours(), m: n.getUTCMinutes(), s: n.getUTCSeconds() }; };
  let ENV = null, envAt = 0;
  window.AV_setEnv = (e) => { ENV = e; envAt = performance.now(); apply(); };
  const envMinute = () => { if (!ENV) return null; const m = ENV.frozen ? ENV.minuteOfDay : ENV.minuteOfDay + (performance.now() - envAt) / 60000; return ((m % 1440) + 1440) % 1440; };
  const gameHours = () => { if (timeManual !== null) return timeManual; const m = envMinute(); if (m !== null) return m / 60; const n = utcNow(); return n.h + n.m / 60 + n.s / 3600; };
  const curWeather = () => wxManual || (ENV ? ENV.weather : weatherAt(Math.floor(Date.now() / 3600000)));
  const pad2 = (n) => String(n).padStart(2, '0');

  function apply() {
    const h = gameHours(), w = curWeather(), lk = look(w, region), t = tintAt(h);
    dn.style.fill = `rgb(${t[0] | 0},${t[1] | 0},${t[2] | 0})`; dn.style.opacity = t[3].toFixed(3);
    const night = clamp01((t[3] - 0.14) / 0.4);
    view.dataset.night = String(night > 0.25);
    lantern.style.opacity = (night * 0.6).toFixed(2);
    wm.style.fill = lk.mult[0]; wm.style.opacity = lk.mult[1];
    wv.style.fill = lk.veil[0]; wv.style.opacity = (lk.veil[1] * (1 - night * 0.6)).toFixed(3);
    board.dataset.wind = lk.wind ? 'strong' : 'calm';
    board.dataset.region = region; world.dataset.region = region;
    view.dataset.fx = String(Boolean(lk.fx));
    pendingFx = lk.fx || null; lightning = Boolean(lk.lightning);
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60), u = utcNow();
    const mNow = envMinute(), ss = mNow === null ? u.s : Math.floor(((mNow * 60) % 60));
    sbTime.textContent = timeManual !== null ? `${pad2(hh)}:${pad2(mm)} UTC` : mNow === null ? `${pad2(u.h)}:${pad2(u.m)}:${pad2(u.s)} UTC` : ENV.frozen ? `${pad2(hh)}:${pad2(mm)} UTC` : `${pad2(hh)}:${pad2(mm)}:${pad2(ss)} UTC`;
    sbWx.textContent = LABELS[region][w] + '';
    if (timeManual === null && document.activeElement !== tod) { tod.value = String(Math.round(h * 60)); }
    todOut.textContent = `${pad2(hh)}:${pad2(mm)}`;
    document.dispatchEvent(new CustomEvent('av-region', { detail: { key: region, ...REGIONS[region] } }));
  }

  /* particles: rain, snow and blown sand on a canvas above the map */
  let W = 0, H = 0, parts = [], alpha = 0, raf = 0, last = 0, nextBolt = 0;
  function size() { const r = view.getBoundingClientRect(), dpr = 1; cv.width = Math.max(1, r.width * dpr); cv.height = Math.max(1, r.height * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); W = r.width; H = r.height; build(); }
  function build() {
    parts = [];
    if (!curFx) return;
    const n = Math.round(curFx.n * Math.max(0.5, W / 830));
    for (let i = 0; i < n; i++) parts.push({ x: Math.random() * (W + 200) - 100, y: Math.random() * H, len: 8 + Math.random() * 12, k: 0.8 + Math.random() * 0.5, r: 1.1 + Math.random() * 2.1, ph: Math.random() * 6.28 });
  }
  function bolt() {
    flashEl.style.transition = 'none'; flashEl.style.opacity = '0.45';
    requestAnimationFrame(() => requestAnimationFrame(() => { flashEl.style.transition = 'opacity 700ms ease-out'; flashEl.style.opacity = '0'; }));
    setTimeout(() => { if (!lightning) return; flashEl.style.transition = 'none'; flashEl.style.opacity = '0.25'; requestAnimationFrame(() => requestAnimationFrame(() => { flashEl.style.transition = 'opacity 600ms ease-out'; flashEl.style.opacity = '0'; })); }, 190);
  }
  function frame(now) {
    raf = requestAnimationFrame(frame);
    if (now - last < 33) return; /* about 30 frames a second is plenty for rain and snow */
    const dt = Math.min(0.07, (now - last) / 1000); last = now;
    const key1 = JSON.stringify(curFx), key2 = JSON.stringify(pendingFx);
    if (key1 !== key2) { alpha -= dt / 0.8; if (alpha <= 0) { alpha = 0; curFx = pendingFx; build(); } }
    else if (curFx) alpha = Math.min(1, alpha + dt / 1.2);
    ctx.clearRect(0, 0, W, H);
    if (curFx && alpha > 0) {
      const fx = curFx, t = now / 1000;
      ctx.globalAlpha = alpha;
      if (fx.kind === 'snow') {
        ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.beginPath();
        for (const p of parts) {
          p.x += (fx.vx + Math.sin(t * 1.3 + p.ph) * 22) * dt * p.k; p.y += fx.speed * dt * p.k;
          if (p.y > H + 4) { p.y = -4; p.x = Math.random() * (W + 200) - 100; } if (p.x > W + 100) p.x = -100;
          ctx.moveTo(p.x + p.r, p.y); ctx.arc(p.x, p.y, p.r, 0, 6.283);
        }
        ctx.fill();
      } else {
        ctx.strokeStyle = fx.color || (fx.kind === 'sand' ? 'rgba(226,192,128,0.55)' : 'rgba(205,228,245,0.55)'); ctx.lineWidth = fx.kind === 'sand' ? 1.6 : 1.2; ctx.beginPath();
        for (const p of parts) {
          p.x += fx.vx * dt * p.k; p.y += fx.speed * dt * p.k;
          if (p.y > H + 20) { p.y = -20; p.x = Math.random() * (W + 200) - 100; } if (p.x > W + 100) p.x = -100;
          const L = fx.kind === 'sand' ? p.len * 2.2 : p.len, sp = Math.hypot(fx.vx, fx.speed) || 1;
          ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - (fx.vx / sp) * L, p.y - (fx.speed / sp) * L);
        }
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    if (lightning && now > nextBolt) { bolt(); nextBolt = now + 4500 + Math.random() * 7500; }
  }
  function syncLoop() {
    cancelAnimationFrame(raf);
    try { if (board.dataset.motion === 'true') svgEl.unpauseAnimations(); else svgEl.pauseAnimations(); } catch (e) {}
    if (board.dataset.motion === 'true') { last = performance.now(); nextBolt = last + 2500; raf = requestAnimationFrame(frame); }
    else { ctx.clearRect(0, 0, W, H); flashEl.style.opacity = '0'; curFx = null; alpha = 0; parts = []; }
  }
  new MutationObserver(() => { syncLoop(); apply(); }).observe(board, { attributes: true, attributeFilter: ['data-motion'] });
  new ResizeObserver(size).observe(view);

  /* controls */
  const setLive = (on) => todLive.setAttribute('aria-pressed', String(on));
  tod.addEventListener('input', () => { timeManual = Number(tod.value) / 60; setLive(false); apply(); });
  todLive.addEventListener('click', () => { timeManual = null; setLive(true); apply(); });
  document.querySelectorAll('.preview [data-h]').forEach((b) => b.addEventListener('click', () => { timeManual = Number(b.dataset.h); tod.value = String(Math.round(timeManual * 60)); setLive(false); apply(); }));
  wxSel.addEventListener('change', () => { wxManual = wxSel.value === 'live' ? null : wxSel.value; apply(); });
  rgSel.addEventListener('change', () => { region = rgSel.value; apply(); });
  window.AV_setRegion = (k) => { if (k === region) return; region = k; apply(); };
  setInterval(apply, 1000);
  apply(); size(); syncLoop();
})();
setTimeout(fitMap, 0);

/* ---------- World globe: painted sector tiles, drag to rotate, scroll to zoom ---------- */
(() => {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('globe-svg');
  const stageWorld = document.getElementById('stage-world');
  const stageMap = document.getElementById('stage-map');
  const CX = 260, CY = 260, R0 = 232;
  const COLS = GCOLS, ROWS = GROWS, DL = 360 / COLS, DP = 180 / ROWS;
  const rad = (d) => (d * Math.PI) / 180;
  let lon0 = -180 + 12.8 * DL, lat0 = 24, zg = 1;

  /* hubs sit on cell centres and are spread five or more sectors apart */
  const HUBS = [
    { id: 'aureth', name: 'Aureth Crown', c: 15, r: 7, biome: 'plains' },
    { id: 'verdant', name: 'Verdant Expanse', c: HOME_C, r: HOME_R, biome: 'forest' },
    { id: 'ember', name: 'Emberreach', c: 20, r: 6, biome: 'volcanic' },
    { id: 'frost', name: 'Frostmere', c: 15, r: 2, biome: 'ice' },
    { id: 'glass', name: 'Glasswind Desert', c: 15, r: 12, biome: 'desert' },
    { id: 'hollow', name: 'Hollow Coast', c: 8, r: 11, biome: 'coast' },
    { id: 'starfall', name: 'Starfall Highlands', c: 7, r: 4, biome: 'highland' },
    { id: 'umbral', name: 'Umbral March', c: 23, r: 10, biome: 'march' },
  ].map((h) => ({ ...h, lon: -180 + (h.c + 0.5) * DL, lat: 90 - (h.r + 0.5) * DP, cell: [h.c + 0.5, h.r + 0.5] }));
  HUBS.forEach((h) => (hubNames[h.c + ',' + h.r] = h.name));
  const LINKS = [['aureth', 'verdant'], ['aureth', 'glass'], ['aureth', 'starfall'], ['starfall', 'frost'], ['aureth', 'ember'], ['verdant', 'hollow'], ['ember', 'umbral'], ['verdant', 'starfall'], ['aureth', 'frost']];
  const hubCells = HUBS;
  const byId = (id) => hubCells.find((h) => h.id === id);
  const dseg = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)));
    return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
  };
  const CELLS = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const lon = -180 + c * DL, lat = 90 - r * DP, mid = [c + 0.5, r + 0.5];
    const hub = hubCells.reduce((b, h) => (Math.hypot(h.cell[0] - mid[0], h.cell[1] - mid[1]) < Math.hypot(b.cell[0] - mid[0], b.cell[1] - mid[1]) ? h : b));
    const nearHub = Math.hypot(hub.cell[0] - mid[0], hub.cell[1] - mid[1]);
    const roadD = Math.min(...LINKS.map(([a, b]) => dseg(mid, byId(a).cell, byId(b).cell)));
    const onRoad = roadD < 0.55;
    const mainLand = nearHub < 2.9 + vnoise(c * 0.55 + 3, r * 0.55 + 9) * 2.4 || roadD < 1.3;
    const isle = nearHub > 3.2 && r > 0 && r < ROWS - 1 && vnoise(c * 0.42 + 11, r * 0.42 + 4) > 0.6;
    const isLand = mainLand || isle;
    CELLS.push({ c, r, lon, lat, isLand, hub, nearHub, onRoad, charted: isLand && (nearHub < 2.3 || onRoad), isHub: nearHub < 0.75 });
  }
  /* fill holes and bays so each continent reads as one solid landmass */
  for (let pass = 0; pass < 3; pass++) {
    const flip = [];
    CELLS.forEach((x) => {
      if (x.isLand) return;
      let n = 0;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]]) { const o = CELLS.find((k) => k.c === (x.c + dc + COLS) % COLS && k.r === x.r + dr); if (o && o.isLand) n++; }
      if (n >= 4) flip.push(x);
    });
    flip.forEach((x) => (x.isLand = true));
  }
  const cellAt = (c, r) => CELLS.find((x) => x.c === c && x.r === r);
  /* the globe shows the same sectors the local map does: each real sector claims its tile and takes its region's biome */
  const CELL_SECTOR = {};
  Object.entries(SECTOR_CELL).forEach(([id, [c, r]]) => { const x = cellAt(c, r); if (x) { x.isLand = true; x.sectorId = id; CELL_SECTOR[c + ',' + r] = id; } });
  const REGION_OF_ID = { 'crown-road': 'aureth-crown', 'crown-hinterland': 'aureth-crown', 'crown-northfields': 'aureth-crown', 'crown-uplands': 'aureth-crown', 'southern-caravan-road': 'glasswind-desert', 'highland-road': 'starfall-highlands', 'northern-pass': 'frostmere', 'ember-road': 'emberreach', 'coastal-road': 'hollow-coast', 'eastern-march-road': 'umbral-march', 'old-coast-road': 'umbral-march' };
  Object.entries(SECTOR_CELL).forEach(([id, [c, r]]) => { const x = cellAt(c, r), hub = HUBS.find((h) => h.id === HUB_OF_REGION[REGION_OF_ID[id] || id]); if (x && hub) x.hub = hub; });
  const syncCharted = () => {
    const known = new Map(((window.__sv && window.__sv.sectors) || []).map((s) => [s.id, s]));
    CELLS.forEach((x) => { const s = x.sectorId && known.get(x.sectorId); x.charted = Boolean(s); x.secName = s ? s.name : null; });
  };
  syncCharted();
  let currentCell = CELLS.find((x) => x.isHub && x.hub.id === 'verdant');
  const cellNum = (c) => c.r * COLS + c.c + 1;
  const cellName = (c) => c.secName || (c.isHub ? c.hub.name : sectorName(c.c - HOME_C, c.r - HOME_R));
  let selected = currentCell;

  /* ---------- static defs: painted biome textures, filters, gradients ---------- */
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  const defs = el('defs', {}, svg);
  const rg = mulberry(5150);
  function mulberry(a) { return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function cpat(id, size, draw) {
    const c = document.createElement('canvas'); c.width = c.height = size * 2;
    const x = c.getContext('2d'); x.scale(2, 2);
    const sc = (n, fn) => { for (let i = 0; i < n; i++) { const p = { a: rg(), b: rg(), c: rg(), d: rg() }, bx = rg() * size, by = rg() * size; for (const ox of [-size, 0, size]) for (const oy of [-size, 0, size]) fn(bx + ox, by + oy, p); } };
    draw(x, size, sc);
    const p = el('pattern', { id, width: size, height: size, patternUnits: 'userSpaceOnUse' }, defs);
    const im = el('image', { width: size, height: size }, p); im.setAttribute('href', c.toDataURL('image/png'));
  }
  const blot = (x, sc, size, cols, n = 10) => sc(n, (px, py, p) => { const r = 14 + p.a * 30, g = x.createRadialGradient(px, py, 0, px, py, r), col = cols[Math.floor(p.b * cols.length)]; g.addColorStop(0, col + '66'); g.addColorStop(1, col + '00'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); });
  const base = (x, s, col) => { x.fillStyle = col; x.fillRect(0, 0, s, s); };
  cpat('b-forest', 96, (x, s, sc) => {
    base(x, s, '#1d4a32'); blot(x, sc, s, ['#12301f', '#2f6a40', '#163a28']);
    sc(70, (px, py, p) => { const r = 3.4 + p.a * 3.6; x.fillStyle = '#0f2e20'; x.beginPath(); x.arc(px + 1.2, py + 1.6, r, 0, 6.3); x.fill(); const g = x.createRadialGradient(px - r * 0.3, py - r * 0.4, 0, px, py, r); g.addColorStop(0, p.c > 0.85 ? '#d6b04a' : '#6fb35a'); g.addColorStop(1, '#1f5a36'); x.fillStyle = g; x.beginPath(); x.arc(px, py, r, 0, 6.3); x.fill(); });
  });
  cpat('b-plains', 96, (x, s, sc) => {
    base(x, s, '#82a04c'); blot(x, sc, s, ['#6a8a3c', '#a9bb62', '#c8b45a']);
    sc(16, (px, py, p) => { const w = 12 + p.a * 14, h = 8 + p.b * 12; x.fillStyle = ['#c7b45c', '#6f9448', '#a8b857', '#8a7a3a'][Math.floor(p.c * 4)] + 'cc'; x.fillRect(px, py, w, h); x.strokeStyle = 'rgba(40,50,20,.35)'; x.lineWidth = 0.8; for (let k = 2; k < w; k += 3) { x.beginPath(); x.moveTo(px + k, py); x.lineTo(px + k, py + h); x.stroke(); } });
    sc(60, (px, py, p) => { x.strokeStyle = '#c9d98a99'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 2.5, py - 4); x.stroke(); });
  });
  cpat('b-volcanic', 96, (x, s, sc) => {
    base(x, s, '#2c2022'); blot(x, sc, s, ['#17100f', '#4a3432', '#3a2624']);
    sc(18, (px, py, p) => { const w = 10 + p.a * 14; x.fillStyle = '#4e3a38'; x.beginPath(); x.moveTo(px - w, py + w * 0.7); x.lineTo(px, py - w * 0.8); x.lineTo(px + w, py + w * 0.7); x.fill(); x.fillStyle = '#1d1414'; x.beginPath(); x.moveTo(px, py - w * 0.8); x.lineTo(px + w, py + w * 0.7); x.lineTo(px + 2, py + w * 0.7); x.fill(); });
    sc(22, (px, py, p) => { const L = 10 + p.a * 22; x.strokeStyle = 'rgba(255,110,40,.28)'; x.lineWidth = 4; x.lineCap = 'round'; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + L * 0.5, py + (p.b - 0.5) * 14, px + L, py + (p.c - 0.5) * 10); x.stroke(); x.strokeStyle = '#ff8a3a'; x.lineWidth = 1.4; x.stroke(); });
  });
  cpat('b-ice', 96, (x, s, sc) => {
    base(x, s, '#c7dde9'); blot(x, sc, s, ['#f2f9ff', '#9cc0d6', '#e4f1f8']);
    sc(30, (px, py, p) => { const w = 6 + p.a * 14; x.fillStyle = '#f7fcff'; x.beginPath(); x.moveTo(px, py - w); x.lineTo(px + w * 0.6, py); x.lineTo(px, py + w * 0.5); x.lineTo(px - w * 0.5, py); x.fill(); x.fillStyle = 'rgba(120,160,190,.45)'; x.beginPath(); x.moveTo(px, py - w); x.lineTo(px + w * 0.6, py); x.lineTo(px, py + w * 0.5); x.fill(); });
    sc(14, (px, py, p) => { x.strokeStyle = '#7fa8c2aa'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px, py); x.lineTo(px + 8 + p.a * 14, py + (p.b - 0.5) * 12); x.stroke(); });
  });
  cpat('b-desert', 96, (x, s, sc) => {
    base(x, s, '#cba768'); blot(x, sc, s, ['#e6c985', '#a9843f', '#d8b676']);
    sc(34, (px, py, p) => { const L = 14 + p.a * 26; x.lineCap = 'round'; x.strokeStyle = '#a9843faa'; x.lineWidth = 2.4; x.beginPath(); x.moveTo(px, py + 1.6); x.quadraticCurveTo(px + L / 2, py - 7 - p.b * 5 + 1.6, px + L, py + 1.6); x.stroke(); x.strokeStyle = '#f1dba2'; x.lineWidth = 1.5; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + L / 2, py - 7 - p.b * 5, px + L, py); x.stroke(); });
  });
  cpat('b-coast', 96, (x, s, sc) => {
    base(x, s, '#3f8a92'); blot(x, sc, s, ['#2a6e7c', '#7ac0c0', '#d8c68e']);
    sc(10, (px, py, p) => { x.fillStyle = '#dccb92'; x.beginPath(); x.ellipse(px, py, 8 + p.a * 12, 4 + p.b * 6, p.c, 0, 6.3); x.fill(); x.strokeStyle = '#f6fffb99'; x.lineWidth = 1.4; x.stroke(); });
    sc(24, (px, py, p) => { x.strokeStyle = '#d9fbf799'; x.lineWidth = 0.9; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 6, py - 3, px + 12, py); x.stroke(); });
  });
  cpat('b-highland', 96, (x, s, sc) => {
    base(x, s, '#5b5a88'); blot(x, sc, s, ['#3c3b64', '#8d8cc0', '#4a4972']);
    sc(26, (px, py, p) => { const w = 8 + p.a * 12, h = 14 + p.b * 16; x.fillStyle = '#8d8cc0'; x.beginPath(); x.moveTo(px - w, py + h * 0.5); x.lineTo(px, py - h); x.lineTo(px, py + h * 0.5); x.fill(); x.fillStyle = '#3c3b64'; x.beginPath(); x.moveTo(px, py - h); x.lineTo(px + w, py + h * 0.5); x.lineTo(px, py + h * 0.5); x.fill(); x.fillStyle = '#f2f4ff'; x.beginPath(); x.moveTo(px, py - h); x.lineTo(px + w * 0.28, py - h * 0.5); x.lineTo(px - w * 0.28, py - h * 0.5); x.fill(); });
  });
  cpat('b-march', 96, (x, s, sc) => {
    base(x, s, '#26322f'); blot(x, sc, s, ['#14201d', '#55655e', '#3b4b45'], 14);
    sc(22, (px, py, p) => { x.strokeStyle = '#0e1614'; x.lineWidth = 1.6; x.lineCap = 'round'; x.beginPath(); x.moveTo(px, py + 6); x.lineTo(px, py - 8); x.moveTo(px, py - 3); x.lineTo(px - 4, py - 8); x.moveTo(px, py - 5); x.lineTo(px + 4, py - 9); x.stroke(); });
    sc(7, (px, py, p) => { x.fillStyle = '#55655e'; x.fillRect(px, py, 6 + p.a * 6, 5 + p.b * 4); x.fillStyle = '#1a2522'; x.fillRect(px + 1, py + 1, 3, 2); });
  });
  cpat('b-sea', 96, (x, s, sc) => {
    base(x, s, '#0b3a50'); blot(x, sc, s, ['#06283a', '#14607a', '#0d4a64'], 14);
    sc(28, (px, py, p) => { x.strokeStyle = 'rgba(160,230,240,' + (0.1 + p.a * 0.18) + ')'; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 7, py - 3 - p.b * 3, px + 14 + p.c * 8, py); x.stroke(); });
  });
  cpat('stipple', 14, (x, s, sc) => { x.fillStyle = 'rgba(223,233,231,.4)'; x.beginPath(); x.arc(3, 4, 1, 0, 6.3); x.fill(); x.beginPath(); x.arc(10, 10, 1, 0, 6.3); x.fill(); });
  cpat('mist', 96, (x, s, sc) => {
    sc(14, (px, py, p) => { const r = 16 + p.a * 28, g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(190,176,235,.38)'); g.addColorStop(1, 'rgba(190,176,235,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); });
    sc(10, (px, py, p) => { x.strokeStyle = 'rgba(210,200,245,.35)'; x.lineWidth = 1.1; x.beginPath(); x.moveTo(px, py); x.bezierCurveTo(px + 8, py - 10, px + 16, py + 10, px + 26 + p.a * 14, py - 2); x.stroke(); });
  });
  /* pack sprites scattered over biomes, matching the local map */
  const SPB = {
    forest: [['oak_tree_medium', 0.95], ['ancient_moss_tree_a', 0.9], ['dense_green_bush', 0.6], ['oak_tree_large', 1]],
    plains: [['wildflower_patch', 0.7], ['goldleaf_birch', 0.9], ['hay_cart', 0.6], ['oak_tree_medium', 0.8]],
    volcanic: [['dead_bare_tree', 0.9], ['mossy_boulder_a', 0.7], ['mossy_boulder_b', 0.6], ['dead_bare_tree', 0.75]],
    ice: [['fir_tree_a', 0.9], ['fir_tree_b', 0.85], ['frostflower_carpet', 0.7], ['fir_tree_c', 0.95]],
    desert: [['mossy_boulder_a', 0.6], ['dead_bare_tree', 0.7], ['autumn_shrub', 0.6], ['mossy_boulder_b', 0.55]],
    coast: [['reeds_clump', 0.7], ['stepping_stones', 0.6], ['mossy_boulder_b', 0.5], ['reeds_clump', 0.6]],
    highland: [['mossy_boulder_a', 0.9], ['fir_tree_b', 0.8], ['mossy_boulder_b', 0.8], ['fir_tree_a', 0.85]],
    march: [['dead_bare_tree', 0.85], ['graveyard_stones', 0.7], ['ancient_moss_tree_b', 0.9], ['reeds_clump', 0.6]],
  };
  Object.keys(SPB).forEach((b, bi) => {
    const sz = 120, pp = el('pattern', { id: 'sp-' + b, width: sz, height: sz, patternUnits: 'userSpaceOnUse' }, defs);
    const r = mulberry(900 + bi * 31);
    for (let i = 0; i < 6; i++) {
      const [nm, k] = SPB[b][i % 4], w = 20 * k * (0.85 + r() * 0.3), x = r() * (sz - w), y = r() * (sz - w);
      const im = el('image', { x, y, width: w, height: w, opacity: 0.95 }, pp); im.setAttribute('href', 'assets/' + nm + '.webp');
    }
  });
  defs.insertAdjacentHTML('beforeend', `
    <radialGradient id="atmo" cx="50%" cy="50%" r="50%"><stop offset="84%" stop-color="#7fd3e6" stop-opacity="0"/><stop offset="94%" stop-color="#7fd3e6" stop-opacity=".34"/><stop offset="100%" stop-color="#b9a2ff" stop-opacity=".0"/></radialGradient>
    <radialGradient id="shade" cx="34%" cy="28%" r="86%"><stop offset="0" stop-color="#fff2c9" stop-opacity=".26"/><stop offset=".45" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#010a12" stop-opacity=".78"/></radialGradient>
    <radialGradient id="seag" cx="40%" cy="35%" r="75%"><stop offset="0" stop-color="#14607a"/><stop offset="1" stop-color="#05202e"/></radialGradient>
    <clipPath id="sphere"><circle cx="${CX}" cy="${CY}" r="${R0}"/></clipPath>
    <filter id="rough" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency=".06" numOctaves="2" seed="7" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="5"/></filter>
    <filter id="fog"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="halo"><feGaussianBlur stdDeviation="6"/></filter>`);

  /* ---------- fixed layers ---------- */
  el('circle', { cx: CX, cy: CY, r: R0 + 18, fill: 'url(#atmo)' }, svg);
  el('circle', { cx: CX, cy: CY, r: R0, fill: 'url(#seag)' }, svg);
  const seaClip = el('g', { 'clip-path': 'url(#sphere)' }, svg);
  const sea = el('g', { class: 'seadrift' }, seaClip);
  el('rect', { x: -60, y: -60, width: 640, height: 640, fill: 'url(#b-sea)', opacity: 0.85 }, sea);
  const dyn = el('g', { 'clip-path': 'url(#sphere)' }, svg);
  const top = el('g', {}, svg);
  /* ---------- projection and rendering ---------- */
  const proj = (lon, lat) => {
    const l = rad(lon - lon0), p = rad(lat), p0 = rad(lat0), R = R0;
    const c = Math.sin(p0) * Math.sin(p) + Math.cos(p0) * Math.cos(p) * Math.cos(l);
    return { x: CX + R * Math.cos(p) * Math.sin(l), y: CY - R * (Math.cos(p0) * Math.sin(p) - Math.sin(p0) * Math.cos(p) * Math.cos(l)), c };
  };
  const ptsOf = (cell) => cell.corners.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const tip = document.createElement('div');
  tip.className = 'gtip'; tip.hidden = true; stageWorld.appendChild(tip);
  let dragging = false, moved = 0, lastTap = { cell: null, t: 0 };
  const motionOn = () => document.getElementById('board').dataset.motion === 'true';
  let lastTime = 0;

  function render(fast) {
    /* zoom scales the whole picture, so the sphere stays a perfect, fully clipped ball at every level */
    const asp = Math.max(0.5, (stageWorld.clientWidth || 520) / (stageWorld.clientHeight || 520)), base = 520 / zg, vh = asp >= 1 ? base : base / asp, vw = asp >= 1 ? base * asp : base; svg.setAttribute('viewBox', `${(CX - vw / 2).toFixed(1)} ${(CY - vh / 2).toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}`);
    dyn.replaceChildren(); top.replaceChildren();
    const vis = [];
    for (const cell of CELLS) {
      const corners = [proj(cell.lon, cell.lat), proj(cell.lon + DL, cell.lat), proj(cell.lon + DL, cell.lat - DP), proj(cell.lon, cell.lat - DP)];
      if (corners.some((p) => p.c < 0.04)) continue;
      vis.push({ ...cell, corners, ref: cell });
    }
    if (!fast) {
      const sh = el('g', { filter: 'url(#halo)', opacity: 0.55 }, dyn);
      vis.filter((v) => v.isLand).forEach((v) => el('polygon', { points: ptsOf(v), fill: '#36a6b4', stroke: '#36a6b4', 'stroke-width': 10 }, sh));
    }
    const outl = el('g', fast ? {} : { filter: 'url(#rough)' }, dyn);
    vis.filter((v) => v.isLand).forEach((v) => el('polygon', { points: ptsOf(v), fill: '#050f14', stroke: '#050f14', 'stroke-width': 5 }, outl));
    const landG = el('g', fast ? {} : { filter: 'url(#rough)' }, dyn);
    vis.filter((v) => v.isLand).forEach((v) => {
      const f = 'url(#b-' + v.hub.biome + ')';
      el('polygon', { points: ptsOf(v), fill: f, stroke: f, 'stroke-width': 1.8 }, landG);
    });
    vis.filter((v) => v.isLand).forEach((v) => {
      el('polygon', { points: ptsOf(v), fill: 'url(#sp-' + v.hub.biome + ')' }, landG);
    });
    const unc = vis.filter((v) => v.isLand && !v.charted);
    unc.forEach((v) => el('polygon', { points: ptsOf(v), fill: '#16303a', 'fill-opacity': 0.22, stroke: '#16303a', 'stroke-opacity': 0.22, 'stroke-width': 1.8 }, landG));
    unc.forEach((v) => el('polygon', { points: ptsOf(v), fill: 'url(#stipple)' }, landG));
    unc.forEach((v) => el('polygon', { points: ptsOf(v), fill: 'url(#mist)', opacity: 0.16 }, landG));
    if (unc.length) {
      const clip = el('clipPath', { id: 'veilclip' }, dyn);
      unc.forEach((v) => el('polygon', { points: ptsOf(v) }, clip));
      const vg = el('g', { 'clip-path': 'url(#veilclip)' }, dyn);
      const fogs = el('g', { class: 'veil', filter: 'url(#fog)' }, vg);
      [[120, 150, 70, 26], [300, 120, 90, 30], [210, 300, 100, 34], [390, 260, 80, 30], [150, 400, 90, 28], [330, 400, 70, 24], [60, 300, 60, 24], [440, 150, 60, 22], [250, 60, 80, 22]].forEach(([x, y, rx, ry]) => {
        el('ellipse', { cx: x, cy: y, rx, ry, fill: '#cfe0e4', opacity: 0.07 }, fogs);
        el('ellipse', { cx: x + 240, cy: y, rx, ry, fill: '#cfe0e4', opacity: 0.07 }, fogs);
      });
    }
    /* sector grid and hit targets */
    vis.forEach((v) => {
      const p = el('polygon', {
        points: ptsOf(v), fill: 'transparent', class: 'sec',
        stroke: v.charted ? '#f4e2a8' : v.isLand ? '#cfe0dc' : '#2a6a84',
        'stroke-opacity': v.charted ? 0.22 : v.isLand ? 0.2 : 0.1, 'stroke-width': 0.8,
        'stroke-dasharray': !v.charted && v.isLand ? '3 3' : '0',
      }, top);
      p.addEventListener('click', () => {
        if (moved >= 5) return;
        const now = performance.now();
        if (lastTap.cell === v.ref && now - lastTap.t < 420) { lastTap = { cell: null, t: 0 }; return travel(v.ref); }
        lastTap = { cell: v.ref, t: now };
        choose(v.ref);
      });
      p.addEventListener('pointermove', (e) => {
        if (dragging) return;
        const r = stageWorld.getBoundingClientRect();
        tip.hidden = false;
        tip.innerHTML = v.charted ? (v.ref === currentCell ? `${cellName(v)}<small>Sector ${cellNum(v)} · you are here</small>` : `${cellName(v)}<small>Sector ${cellNum(v)} · about ${etaTo(v.ref).text} · double-click to travel</small>`) : v.isLand ? `Uncharted Territory<small>Sector ${cellNum(v)} · beyond reliable charts</small>` : `Open sea<small>Sector ${cellNum(v)} · closed to travel</small>`;
        tip.style.left = Math.min(r.width - 260, Math.max(4, e.clientX - r.left + 14)) + 'px';
        tip.style.top = Math.max(4, e.clientY - r.top - 54) + 'px';
      });
      p.addEventListener('pointerleave', () => (tip.hidden = true));
    });
    if (!fast) vis.filter((v) => v.isLand && !v.charted && v.corners.every((p) => p.c > 0.34)).forEach((v) => {
      const mx = v.corners.reduce((a, p) => a + p.x, 0) / 4, my = v.corners.reduce((a, p) => a + p.y, 0) / 4;
      el('text', { x: mx, y: my + 5, 'text-anchor': 'middle', fill: '#d9ccff', 'fill-opacity': 0.5, 'font-size': 14, 'font-family': 'Palatino Linotype, Palatino, Georgia, serif', 'pointer-events': 'none' }, top).textContent = '?';
    });
    /* selection and current location outlines */
    const mark = (cell, attrs) => {
      const cs = [proj(cell.lon, cell.lat), proj(cell.lon + DL, cell.lat), proj(cell.lon + DL, cell.lat - DP), proj(cell.lon, cell.lat - DP)];
      if (cs.some((p) => p.c < 0.04)) return null;
      return el('polygon', { points: cs.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' '), 'pointer-events': 'none', ...attrs }, top);
    };
    mark(currentCell, { fill: '#e9c27e24', stroke: '#e7ca7b', 'stroke-width': 2 });
    mark(selected, { fill: '#8bd8d122', stroke: '#a7ece1', 'stroke-width': 2.4 });
    /* region chips, clamped inside the rim */
    hubCells.forEach((h) => {
      const m = proj(h.lon, h.lat);
      if (m.c < 0.28) return;
      let x = m.x, y = m.y - 14;
      const d = Math.hypot(x - CX, y - CY), lim = R0 - 56;
      if (d > lim) { x = CX + ((x - CX) * lim) / d; y = CY + ((y - CY) * lim) / d; }
      const w = h.name.length * 7.4 + 24;
      const g = el('g', { 'pointer-events': 'none' }, top);
      el('rect', { x: x - w / 2, y: y - 12, width: w, height: 22, fill: '#06202b', opacity: 0.74, stroke: '#e6cb80', 'stroke-opacity': 0.45 }, g);
      el('text', { x, y: y + 4, 'text-anchor': 'middle', fill: '#fff3d7', 'font-size': 13, 'font-weight': 500, 'font-family': 'Palatino Linotype, Palatino, Georgia, serif', 'letter-spacing': '.02em' }, g).textContent = h.name;
      const cur = h.c === currentCell.c && h.r === currentCell.r;
      el('polygon', { points: `${m.x},${m.y - 6} ${m.x + 6},${m.y} ${m.x},${m.y + 6} ${m.x - 6},${m.y}`, fill: cur ? '#e6cb80' : '#fff3d7', stroke: '#06202b', 'stroke-width': 1.5 }, g);
      if (cur) el('circle', { class: 'pulse', cx: m.x, cy: m.y, r: 9, fill: 'none', stroke: '#ffe197', 'stroke-width': 2 }, g);
    });
    el('circle', { cx: CX, cy: CY, r: R0, fill: 'url(#shade)', 'pointer-events': 'none' }, top);
    el('circle', { cx: CX, cy: CY, r: R0, fill: 'none', stroke: '#e6cb80', 'stroke-width': 2, opacity: 0.8, 'pointer-events': 'none' }, top);
  }
  new ResizeObserver(() => { if (!stageWorld.hidden) redraw(false); }).observe(stageWorld);
  let queued = false;
  const redraw = (fast) => { if (queued) return; queued = true; requestAnimationFrame(() => { queued = false; render(fast); }); };

  /* ---------- interaction ---------- */
  let sx = 0, sy = 0;
  svg.addEventListener('pointerdown', (e) => { dragging = true; moved = 0; sx = e.clientX; sy = e.clientY; svg.classList.add('dragging'); tip.hidden = true; });
  window.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    moved += Math.abs(dx) + Math.abs(dy);
    sx = e.clientX; sy = e.clientY;
    if (moved > 5 && gp.size < 2) { lon0 -= dx * 0.32 / zg; lat0 = Math.max(-70, Math.min(70, lat0 + dy * 0.32 / zg)); redraw(true); }
  });
  window.addEventListener('pointerup', () => { if (!dragging) return; dragging = false; svg.classList.remove('dragging'); redraw(false); setTimeout(() => (moved = 0), 0); });
  const zoomEl = document.getElementById('zoom'), zoomVal = document.getElementById('zoom-val');
  const syncSlider = () => { if (mode !== 'world') return; zoomEl.value = String(Math.round(zg * 100)); zoomVal.textContent = Math.round(zg * 100) + '%'; };
  const zoomTo = (v) => { zg = Math.max(0.8, Math.min(2.4, v)); syncSlider(); redraw(false); };
  const zoomBy = (k) => zoomTo(zg * k);
  const gp = new Map(); let g0 = 0, z0 = 1;
  const gd = () => { const [a, b] = [...gp.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
  svg.addEventListener('pointerdown', (e) => { if (e.pointerType !== 'touch') return; gp.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (gp.size === 2) { g0 = gd(); z0 = zg; dragging = false; moved = 99; } });
  svg.addEventListener('pointermove', (e) => { if (!gp.has(e.pointerId)) return; gp.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (gp.size === 2 && g0 > 0 && !window.zoomLocked()) { moved = 99; zoomTo(z0 * (gd() / g0)); } });
  const gEnd = (e) => { gp.delete(e.pointerId); if (gp.size < 2) g0 = 0; };
  svg.addEventListener('pointerup', gEnd); svg.addEventListener('pointercancel', gEnd);
  svg.addEventListener('wheel', (e) => { if (stageWorld.hidden || window.zoomLocked()) return; e.preventDefault(); zoomTo(zg * Math.exp(-e.deltaY * (e.ctrlKey ? 0.012 : 0.0016))); }, { passive: false });
  function centerOn(cell) {
    const tl = cell.lon + DL / 2, tp = Math.max(-60, Math.min(60, cell.lat - DP / 2));
    if (!motionOn()) { lon0 = tl; lat0 = tp; return render(false); }
    const l0 = lon0, p0 = lat0, t0 = performance.now();
    const step = (now) => { const k = Math.min(1, (now - t0) / 520), e = 1 - Math.pow(1 - k, 3); lon0 = l0 + (tl - l0) * e; lat0 = p0 + (tp - p0) * e; render(k < 1); if (k < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  svg.addEventListener('keydown', (e) => {
    const rot = { w: [0, 8], s: [0, -8], a: [-8, 0], d: [8, 0] }[e.key.toLowerCase()];
    if (rot) { e.preventDefault(); lon0 += rot[0]; lat0 = Math.max(-70, Math.min(70, lat0 + rot[1])); return redraw(false); }
    const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
    if (d) { e.preventDefault(); const n = cellAt((selected.c + d[0] + COLS) % COLS, Math.max(0, Math.min(ROWS - 1, selected.r + d[1]))); if (n) { choose(n); centerOn(n); } }
    if (e.key === '+' || e.key === '=') zoomBy(1.15);
    if (e.key === '-') zoomBy(1 / 1.15);
  });

  /* ---------- header, points of interest, view switch, travel ---------- */
  const locTitle = document.getElementById('loc-title'), locSub = document.getElementById('loc-sub');
  const poiEl = document.getElementById('poi-list'), sideMap = document.getElementById('side-map'), body = document.querySelector('.screen-body');
  const toggle = document.getElementById('v-toggle');
  let region = { key: 'temperate', name: 'Verdant Expanse', blurb: '' };
  let mode = 'map';
  const secs = (n) => { const s = Math.round(n); return s >= 60 ? `${Math.floor(s / 60)} min ${s % 60} s` : `${s} s`; };
  function etaTo(cell) {
    const dc = Math.min(Math.abs(cell.c - currentCell.c), COLS - Math.abs(cell.c - currentCell.c)), dr = Math.abs(cell.r - currentCell.r);
    const tiles = Math.max(dc, dr) * CW;
    return { tiles, text: secs(tiles * STEP_MS / 1000) };
  }
  function renderHead() {
    const wh = locTitle.closest('.where'); if (wh) wh.dataset.mode = mode;
    if (mode === 'map') {
      locTitle.textContent = SECTOR ? SECTOR.name : 'Location';
      const rg = SV && SECTOR ? SV.sectors.find((s) => s.id === SECTOR.regionId) : null;
      locSub.textContent = rg ? '(' + rg.name + ' Region)' : '';
    } else { locTitle.textContent = 'World Map'; locSub.textContent = ''; }
  }
  function travel(cell) {
    const name = cellName(cell);
    if (!cell.charted) { tip.hidden = false; tip.innerHTML = 'Not charted<small>Only charted sectors can be travelled to</small>'; setTimeout(() => (tip.hidden = true), 1600); return; }
    if (cell === currentCell) { setView('map'); return; }
    const eta = etaTo(cell);
    setView('map');
    say(`Travelling to ${name} · about ${eta.text}. Click the map to change course.`);
    post({ type: 'travel', sectorId: cell.sectorId });
  }
  function choose(cell) { selected = cell; redraw(false); }
  function setView(next) {
    mode = next;
    stageMap.hidden = next !== 'map'; stageWorld.hidden = next !== 'world';
    sideMap.hidden = next !== 'map'; body.dataset.view = next;
    toggle.setAttribute('aria-label', next === 'map' ? 'Switch to world view' : 'Switch to local view');
    if (next === 'world') { zoomEl.min = '80'; zoomEl.max = '240'; zoomEl.step = '4'; syncSlider(); }
    else { zoomEl.min = '60'; zoomEl.max = '100'; zoomEl.step = '2'; zoomEl.value = String(Math.round(zoom * 100)); zoomVal.textContent = Math.round(zoom * 100) + '%'; }
    renderHead();
    if (next === 'world') { selected = currentCell; render(false); centerOn(selected); svg.focus({ preventScroll: true }); }
  }
  toggle.addEventListener('click', () => setView(mode === 'map' ? 'world' : 'map'));
  window.addEventListener('keydown', (e) => {
    if ((e.key === 'm' || e.key === 'M') && !e.ctrlKey && !e.metaKey && !e.altKey && !/^(INPUT|SELECT|TEXTAREA)$/.test((e.target || {}).tagName || '')) {
      const r = toggle.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) setView(mode === 'map' ? 'world' : 'map');
    }
  });
  document.addEventListener('av-region', (e) => { region = e.detail; if (mode === 'map') renderHead(); });
  let shownSector = '';
  window.AV = {
    mode: () => mode, setView, globeZoom: zoomTo, globeStep: zoomBy,
    onMove: () => {
      if (SECTOR && SECTOR.id !== shownSector) { shownSector = SECTOR.id; const c = SECTOR_CELL[SECTOR.id]; currentCell = (c && cellAt(c[0], c[1])) || currentCell; if (mode === 'map') renderHead(); else render(false); }
      if (window.__renderPoiList) window.__renderPoiList();
    },
    sync: () => { window.__sv = SV; syncCharted(); renderHead(); if (mode === 'world') redraw(false); },
  };
  renderHead();
  render(false);
  /* settings popout and collapsible coordinates */
  const setPop = document.getElementById('set-pop'), gears = [document.getElementById('set-btn'), document.getElementById('set-btn2')];
  let gearOpen = null;
  const setOpen = (btn) => {
    gearOpen = btn;
    setPop.hidden = !btn;
    gears.forEach((g) => g.setAttribute('aria-expanded', String(g === btn)));
    if (btn) { const r = btn.getBoundingClientRect(); setPop.style.left = Math.max(8, Math.min(innerWidth - setPop.offsetWidth - 8, r.left)) + 'px'; setPop.style.bottom = (innerHeight - r.top + 8) + 'px'; }
  };
  gears.forEach((g) => g.addEventListener('click', (e) => { e.stopPropagation(); setOpen(gearOpen === g ? null : g); }));
  document.addEventListener('click', (e) => { if (!setPop.hidden && !setPop.contains(e.target)) setOpen(null); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !setPop.hidden) { const g = gearOpen; setOpen(null); g.focus(); } });
  window.addEventListener('scroll', () => { if (!setPop.hidden) setOpen(gearOpen); }, { passive: true });
  const coord = document.getElementById('sb-sec-cell'), coordBtn = document.getElementById('coord-toggle');
  const setCoord = (open, save) => {
    coord.dataset.open = String(open); coordBtn.setAttribute('aria-expanded', String(open));
    coordBtn.setAttribute('aria-label', open ? 'Coordinates. Click to collapse' : 'Show coordinates');
    if (save) { try { localStorage.setItem('aurevane.coords', open ? 'open' : 'closed'); } catch (e) {} }
  };
  let cOpen = true; try { cOpen = localStorage.getItem('aurevane.coords') !== 'closed'; } catch (e) {}
  setCoord(cOpen, false);
  coordBtn.addEventListener('click', (e) => { e.stopPropagation(); setCoord(coord.dataset.open !== 'true', true); });
})();


/* side-scroll rows: hover an arrow to glide, click to jump a page; arrows appear only when there is more to see */
(function () {
  document.querySelectorAll('[data-hs]').forEach((w) => {
    const list = w.children[1], L = w.querySelector('.hsa.l'), R = w.querySelector('.hsa.r');
    let raf = 0, dir = 0;
    const sync = () => { if (list.id === 'nb-list') list.style.setProperty('--per', String(Math.max(1, Math.min(3, Math.floor((list.clientWidth + 8) / 208)))));
      const max = list.scrollWidth - list.clientWidth; L.hidden = list.scrollLeft < 4; R.hidden = list.scrollLeft > max - 4; };
    const glide = () => { if (!dir) return; list.scrollLeft += dir * 3.2; sync(); raf = requestAnimationFrame(glide); };
    [[L, -1], [R, 1]].forEach(([b, d]) => {
      b.addEventListener('click', () => {
        const kids = list.children; if (!kids.length) return;
        const step = kids.length > 1 ? kids[1].offsetLeft - kids[0].offsetLeft : kids[0].offsetWidth;
        const per = Math.max(1, Math.floor((list.clientWidth + 8) / step));
        list.scrollBy({ left: d * per * step, behavior: 'smooth' });
      });
    });
    list.addEventListener('scroll', sync, { passive: true });
    new ResizeObserver(sync).observe(list);
    new MutationObserver(sync).observe(list, { childList: true });
    sync();
  });
})();

/* one dock, two tabs: click Nearby or Points of interest to swap the list shown below the map */
(function () {
  const dock = document.getElementById('dock'); if (!dock) return;
  const tabs = { nearby: [document.getElementById('tab-nb'), document.getElementById('nb-list')], poi: [document.getElementById('tab-poi'), document.getElementById('poi-list')] };
  const show = (k) => { dock.dataset.tab = k; for (const key in tabs) { const on = key === k; tabs[key][0].setAttribute('aria-selected', String(on)); tabs[key][1].hidden = !on; } };
  tabs.nearby[0].addEventListener('click', () => show('nearby'));
  tabs.poi[0].addEventListener('click', () => show('poi'));
  let k0 = 'nearby'; try { const v = localStorage.getItem('aurevane.dockTab'); if (v === 'poi' || v === 'nearby') k0 = v; } catch (e) {}
  const save = (k) => { try { localStorage.setItem('aurevane.dockTab', k); } catch (e) {} };
  tabs.nearby[0].addEventListener('click', () => save('nearby'));
  tabs.poi[0].addEventListener('click', () => save('poi'));
  show(k0);
})();


/* ======================================================================
   Wildlife: birds that glide in, land, peck about and take off again;
   rare ground animals that wander and bolt when approached.
   Paused when map effects are off.
   ====================================================================== */
(() => {
  const board = document.getElementById('board');
  const ground = add(world, 'g', { class: 'wild', 'pointer-events': 'none' });
  world.insertBefore(ground, ghostLayer);
  const air = add(world, 'g', { class: 'wild', 'pointer-events': 'none' });
  world.appendChild(air);
  const W = Math.random;
  const pick = (a) => a[Math.floor(W() * a.length)];

  /* ---------- drawings (facing right, feet at 0,0) ---------- */
  const SP = {
    sparrow: { body: '#8b6a45', belly: '#e3d3b0', head: '#7a5a3a', beak: '#e4a84a', wing: '#5e4529', s: 1 },
    jay: { body: '#3f78c8', belly: '#f1f4f8', head: '#2f5fa8', beak: '#1a1f2a', wing: '#254f98', s: 1.15, crest: 1 },
    crow: { body: '#1d2229', belly: '#2b323c', head: '#171b21', beak: '#0e1115', wing: '#10141a', s: 1.45 },
    finch: { body: '#f0c92c', belly: '#f7e07a', head: '#e8b920', beak: '#e08a4a', wing: '#1c1c20', s: 0.95 },
    dove: { body: '#c9d0da', belly: '#f4f1ea', head: '#b8c1ce', beak: '#7a6a5a', wing: '#8e99aa', s: 1.3 },
  };
  const SPK = Object.keys(SP);
  const mkBird = (kind) => {
    const c = SP[kind], g = add(air, 'g'), sc = c.s * 0.68;
    const shadow = add(g, 'ellipse', { rx: 9 * sc, ry: 3 * sc, fill: '#000', opacity: 0.28 });
    const b = add(g, 'g'), far = add(b, 'g'), body = add(b, 'g'), near = add(b, 'g');
    const wing = (p, col) => { p.innerHTML = `<ellipse cx="-8" cy="0" rx="9.5" ry="3.3" fill="${col}" stroke="#0004" stroke-width=".6"/><path d="M-16,0 l-3,-2 M-15,1.5 l-4,0" stroke="${col}" stroke-width="1.4"/>`; };
    wing(far, c.wing); far.setAttribute('opacity', '.75');
    body.innerHTML = `<polygon points="-8,-9 -17,-12 -16,-6" fill="${c.wing}"/><ellipse cx="0" cy="-8" rx="10" ry="6.3" fill="${c.body}"/><ellipse cx="1.5" cy="-6" rx="7.5" ry="4" fill="${c.belly}" opacity=".9"/><circle cx="8.5" cy="-12.5" r="4.4" fill="${c.head}"/>${c.crest ? '<path d="M6,-16 l-1,-5 l4,3" fill="#2f5fa8"/>' : ''}<polygon points="12.4,-13 17,-11.7 12.4,-10.8" fill="${c.beak}"/><circle cx="9.8" cy="-13.4" r="1" fill="#05070a"/><path class="leg" d="M-1,-2 v2 M2,-2 v2" stroke="#6a5030" stroke-width="1"/>`;
    wing(near, c.body);
    g.style.display = 'none';
    return { g, b, far, near, shadow, sc, legs: body.querySelector('.leg') };
  };
  const bird = { arr: [] };
  const spawnBird = () => {
    if (bird.arr.length >= 2) return;
    const { cx, cy, vc, vr } = camera();
    let tx, ty;
    for (let n = 0; n < 20; n++) {
      tx = cx + 1 + W() * (vc - 2); ty = cy + 1 + W() * (vr - 2);
      if (Math.hypot(tx - me.x - 0.5, ty - me.y - 0.5) > 2.8 && !isBlocked(Math.floor(tx), Math.floor(ty))) break; tx = null;
    }
    if (tx == null) return;
    const side = pick([[-1, 0], [1, 0], [0, -1]]), kind = pick(SPK), o = mkBird(kind);
    const sx = (cx + vc / 2 + side[0] * (vc / 2 + 3) + (side[1] ? (W() - 0.5) * vc : 0)) * T, sy = (cy + vr / 2 + side[1] * (vr / 2 + 3) + (side[0] ? (W() - 0.5) * vr * 0.6 : 0)) * T;
    Object.assign(o, { kind, st: 'in', x: sx, y: sy, sx, sy, tx: tx * T, ty: ty * T, t: 0, alt: 70, dir: 1, rest: 6 + W() * 9, hop: 0 });
    bird.arr.push(o); o.g.style.display = '';
  };
  const setBird = (o, flying, ang) => {
    const f = o.dir < 0 ? -1 : 1;
    o.g.setAttribute('transform', `translate(${o.x.toFixed(1)},${(o.y - o.alt).toFixed(1)})`);
    o.shadow.setAttribute('transform', `translate(0,${o.alt.toFixed(1)}) scale(${(1 - o.alt / 260).toFixed(2)})`);
    o.shadow.setAttribute('opacity', (0.3 - o.alt / 700).toFixed(2));
    o.b.setAttribute('transform', `scale(${f * o.sc},${o.sc}) rotate(${ang || 0})`);
    o.legs.style.display = flying ? 'none' : '';
  };
  const wingAng = (o, a) => { o.near.setAttribute('transform', `translate(1,-9) rotate(${a})`); o.far.setAttribute('transform', `translate(1,-9) rotate(${a * 0.8 - 6})`); };
  const stepBird = (o, dt, now) => {
    const hd = Math.hypot(o.x / T - me.x - 0.5, o.y / T - me.y - 0.5);
    if (o.st === 'in') {
      o.t += dt * 0.42; const t = Math.min(1, o.t), e = t * t * (3 - 2 * t);
      o.x = o.sx + (o.tx - o.sx) * e; o.y = o.sy + (o.ty - o.sy) * e; o.alt = Math.sin(Math.PI * Math.min(1, t * 1.05)) * 62 + (1 - e) * 18; o.dir = Math.sign(o.tx - o.sx) || 1;
      wingAng(o, 28 + Math.sin(now * 0.03 + o.sx) * 52); setBird(o, true, -6);
      if (t >= 1) { o.st = 'perch'; o.alt = 0; wingAng(o, 3); o.next = now + 900; setBird(o, false, 0); }
    } else if (o.st === 'perch') {
      o.rest -= dt;
      if (now > o.next) { o.next = now + 500 + W() * 1800; if (W() < 0.5) o.dir *= -1; o.hop = W() < 0.6 ? 1 : 0; o.pk = W() < 0.5; }
      const peck = o.pk ? Math.max(0, Math.sin(now * 0.02)) * 14 : 0, hopY = o.hop ? Math.max(0, Math.sin((now % 500) / 500 * Math.PI)) * 5 : 0;
      o.alt = hopY; wingAng(o, 3); setBird(o, false, peck);
      if (o.rest <= 0 || hd < 2.4) { o.st = 'out'; o.t = 0; o.ox = o.x; o.oy = o.y; const a = W() * 6.28; const dir = hd < 2.6 ? Math.atan2(o.y / T - me.y - 0.5, o.x / T - me.x - 0.5) + (W() - 0.5) * 1.4 : a; o.vx = Math.cos(dir); o.vy = Math.sin(dir) * 0.6 - 0.25; o.dir = o.vx < 0 ? -1 : 1; }
    } else {
      o.t += dt; const sp = 150 + o.t * 90;
      o.x += o.vx * sp * dt; o.y += o.vy * sp * dt * 0.7; o.alt = Math.min(150, 10 + o.t * 85 + o.t * o.t * 20);
      wingAng(o, 26 + Math.sin(now * 0.034 + o.ox) * 56); setBird(o, true, -12);
      const { cx, cy, vc, vr } = camera();
      if (o.x / T < cx - 3 || o.x / T > cx + vc + 3 || o.y / T < cy - 5 || o.y / T > cy + vr + 3 || o.t > 8) o.dead = true;
    }
  };

  /* ---------- ground animals ---------- */
  const AN = {
    rabbit: { w: 26, spd: 1.6, run: 5.2, hop: 1, svg: '<ellipse cx="-12" cy="-10" rx="3.6" ry="3.4" fill="#f6f2ea"/><ellipse cx="-2" cy="-9" rx="11.5" ry="8" fill="#b7a089"/><ellipse cx="-6" cy="-7" rx="6.5" ry="5.4" fill="#9a8570"/><ellipse cx="9" cy="-14" rx="6.2" ry="5.6" fill="#c4ad96"/><ellipse cx="7" cy="-25" rx="2.4" ry="7.5" fill="#b7a089" transform="rotate(-12 7 -25)"/><ellipse cx="11.5" cy="-24" rx="2.2" ry="7" fill="#a89079" transform="rotate(10 11.5 -24)"/><ellipse cx="7" cy="-24" rx="1" ry="5" fill="#e8b8b0" transform="rotate(-12 7 -24)"/><circle cx="12" cy="-15" r="1.1" fill="#141414"/><circle cx="14.6" cy="-13" r="1.1" fill="#7a4a4a"/>' },
    fox: { w: 44, spd: 1.2, run: 4.2, svg: '<path d="M-17,-16 q-16,-6 -24,3 q8,9 22,3 z" fill="#d9742c"/><path d="M-41,-13 q-3,3 -2,6 q4,1 7,-2 z" fill="#f6efe2"/><ellipse cx="0" cy="-17" rx="19" ry="8" fill="#d9742c"/><ellipse cx="3" cy="-14" rx="14" ry="4.4" fill="#f3e6d2"/><path d="M13,-22 l11,-3 l8,5 l-8,4 l-9,2 z" fill="#d9742c"/><polygon points="14,-23 15,-31 20,-24" fill="#d9742c"/><polygon points="14.6,-24 15.4,-29 18,-24.6" fill="#2a1a14"/><polygon points="31,-20.5 34,-19.6 31,-18" fill="#1a1210"/><circle cx="23" cy="-20" r="1" fill="#141414"/><g stroke="#3a2a22" stroke-width="2.4" stroke-linecap="round"><path d="M-10,-11 v10 M-4,-11 v10 M9,-11 v10 M14,-11 v10"/></g>' },
    deer: { w: 62, spd: 0.8, run: 3.6, svg: '<ellipse cx="0" cy="-36" rx="23" ry="11" fill="#a0703f"/><ellipse cx="2" cy="-31" rx="17" ry="5.5" fill="#d6b88a"/><path d="M14,-40 L24,-56 L31,-54 L24,-38 z" fill="#a0703f"/><ellipse cx="31" cy="-57" rx="7" ry="5" fill="#a97a46"/><ellipse cx="37" cy="-55.6" rx="2.6" ry="2" fill="#2a1c14"/><circle cx="32" cy="-58" r="1.1" fill="#141414"/><ellipse cx="25" cy="-62" rx="2.4" ry="4.6" fill="#a0703f" transform="rotate(-24 25 -62)"/><path d="M28,-62 l-3,-14 l-4,-4 m4,4 l5,-5 M31,-63 l1,-14 l5,-4 m-5,4 l-5,-4" stroke="#6a4a2a" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="-23" cy="-38" r="3" fill="#f2ead8"/><g fill="#f2ead8" opacity=".85"><circle cx="-6" cy="-40" r="1.3"/><circle cx="2" cy="-42" r="1.2"/><circle cx="8" cy="-39" r="1.3"/><circle cx="-12" cy="-37" r="1.1"/></g><g stroke="#6e4a28" stroke-width="3" stroke-linecap="round"><path d="M-14,-28 v28 M-8,-28 v28 M12,-28 v28 M18,-28 v28"/></g>' },
    squirrel: { w: 22, spd: 1.8, run: 6, hop: 1, svg: '<path d="M-8,-8 q-14,-6 -10,-20 q10,-4 12,6 q-2,8 -2,14 z" fill="#b8683a"/><path d="M-8,-8 q-10,-4 -8,-16" stroke="#e8b88a" stroke-width="2" fill="none"/><ellipse cx="0" cy="-8" rx="8" ry="6.2" fill="#a85a32"/><ellipse cx="2" cy="-6" rx="5" ry="3.6" fill="#ecd9b8"/><circle cx="8" cy="-13" r="4.3" fill="#b8683a"/><polygon points="6,-16.5 6.6,-21 9,-17" fill="#a85a32"/><circle cx="9.6" cy="-13.6" r="1" fill="#141414"/><circle cx="12" cy="-12" r="1" fill="#2a1a14"/>' },
    hedgehog: { w: 22, spd: 0.7, run: 2.4, svg: '<ellipse cx="-2" cy="-9" rx="12" ry="8.5" fill="#6a5238"/><g stroke="#3a2c1e" stroke-width="1.3" stroke-linecap="round" fill="none"><path d="M-12,-9 l-5,-3 M-10,-14 l-4,-5 M-5,-17 l-2,-6 M1,-18 l1,-6 M6,-16 l3,-5 M9,-11 l5,-2"/></g><ellipse cx="11" cy="-6.4" rx="6.4" ry="4.2" fill="#d6b894"/><circle cx="15.5" cy="-6" r="1.4" fill="#2a1a14"/><circle cx="13" cy="-8" r="1" fill="#141414"/>' },
  };
  const ANK = ['rabbit', 'rabbit', 'squirrel', 'fox', 'deer', 'hedgehog'];
  const critters = [];
  const spawnAnimal = () => {
    if (critters.length >= 1) return;
    const { cx, cy, vc, vr } = camera();
    for (let n = 0; n < 25; n++) {
      const tx = Math.floor(cx + 1 + W() * (vc - 2)), ty = Math.floor(cy + 1 + W() * (vr - 2));
      if (Math.hypot(tx - me.x, ty - me.y) < 4.5 || isBlocked(tx, ty) || !free((tx + 0.5) * T, (ty + 0.7) * T)) continue;
      const kind = pick(ANK), a = AN[kind], g = add(ground, 'g');
      add(g, 'ellipse', { cx: 0, cy: 1, rx: a.w * 0.55, ry: a.w * 0.14, fill: '#000', opacity: 0.3 });
      const bd = add(g, 'g'); bd.innerHTML = a.svg;
      critters.push({ kind, a, g, bd, x: (tx + 0.5) * T, y: (ty + 0.7) * T, dir: W() < 0.5 ? -1 : 1, st: 'idle', t: 1 + W() * 3, born: performance.now(), tx: 0, ty: 0, fleeing: false });
      return;
    }
  };
  /* animals obey the player's pathing: the whole body (centre plus a margin on each side) must stay on walkable tiles, so they cannot clip through houses, trees, water or tile corners */
  const free1 = (x, y) => !isBlocked(Math.floor(x / T), Math.floor((y - 6) / T));
  const free = (x, y) => { const r = T * 0.3; return free1(x, y) && free1(x - r, y) && free1(x + r, y) && free1(x, y - r * 0.6) && free1(x, y + r * 0.6); };
  const stepCritter = (o, dt, now) => {
    const hx = me.x + 0.5, hy = me.y + 0.5, hd = Math.hypot(o.x / T - hx, o.y / T - hy), a = o.a;
    if (hd < 3.4 && !o.fleeing) { o.fleeing = true; o.st = 'walk'; const ang = Math.atan2(o.y / T - hy, o.x / T - hx); o.tx = o.x + Math.cos(ang) * 7 * T; o.ty = o.y + Math.sin(ang) * 7 * T; }
    if (o.st === 'idle') { o.t -= dt; if (o.t <= 0) { const ang = W() * 6.28, d = (1.4 + W() * 2.6) * T; o.tx = o.x + Math.cos(ang) * d; o.ty = o.y + Math.sin(ang) * d; o.st = 'walk'; } }
    if (o.st === 'walk') {
      const dx = o.tx - o.x, dy = o.ty - o.y, d = Math.hypot(dx, dy), sp = (o.fleeing ? a.run : a.spd) * T * dt;
      if (d < 3) { o.st = 'idle'; o.t = 1.5 + W() * 4; }
      else { const nx = o.x + (dx / d) * Math.min(sp, d), ny = o.y + (dy / d) * Math.min(sp, d); if (free(nx, ny)) { o.x = nx; o.y = ny; if (Math.abs(dx) > 2) o.dir = dx < 0 ? -1 : 1; } else if (free(nx, o.y)) { o.x = nx; } else if (free(o.x, ny)) { o.y = ny; } else { o.st = 'idle'; o.t = 0.6 + W(); if (o.fleeing) o.fleeing = false; } }
    }
    const moving = o.st === 'walk', ph = now * (o.fleeing ? 0.026 : 0.012);
    const bob = moving ? (a.hop ? Math.abs(Math.sin(ph)) * (o.fleeing ? 12 : 7) : Math.sin(ph * 2) * 1.6) : 0;
    o.g.setAttribute('transform', `translate(${o.x.toFixed(1)},${o.y.toFixed(1)})`);
    o.bd.setAttribute('transform', `translate(0,${(-bob).toFixed(1)}) scale(${o.dir * 0.72},0.72)`);
    const { cx, cy, vc, vr } = camera();
    const out = o.x / T < cx - 3 || o.x / T > cx + vc + 3 || o.y / T < cy - 3 || o.y / T > cy + vr + 3;
    if (out || now - o.born > 90000 && hd > 6) o.dead = true;
    if (o.fleeing && o.st === 'idle' && hd > 6) o.fleeing = false;
  };

  /* ---------- scheduler ---------- */
  let last = performance.now(), acc = 0, nb = 3, na = 14;
  const tick = (now) => {
    requestAnimationFrame(tick);
    const dt = Math.min(0.06, (now - last) / 1000); last = now;
    const on = board.dataset.motion === 'true' && !document.hidden && SECTOR && SECTOR.theme.reg !== 'volcanic' && document.getElementById('stage-map') && document.getElementById('stage-map').offsetParent !== null;
    ground.style.display = air.style.display = on ? '' : 'none';
    if (!on) return;
    if ((acc += dt) > 1) { acc = 0; nb -= 1; na -= 1; if (nb <= 0) { if (W() < 0.55) spawnBird(); nb = 20 + W() * 35; } if (na <= 0) { if (W() < 0.4) spawnAnimal(); na = 40 + W() * 70; } }
    for (const o of bird.arr) stepBird(o, dt, now);
    for (const o of critters) stepCritter(o, dt, now);
    for (let i = bird.arr.length - 1; i >= 0; i--) if (bird.arr[i].dead) { bird.arr[i].g.remove(); bird.arr.splice(i, 1); }
    for (let i = critters.length - 1; i >= 0; i--) if (critters[i].dead) { critters[i].g.remove(); critters.splice(i, 1); }
  };
  requestAnimationFrame(tick);
  window.WILD = { spawnBird, spawnAnimal, count: () => [bird.arr.length, critters.length] };
})();

/* ======================================================================
   Page bridge: the page owns every server call; the stage draws state and sends intents.
   ====================================================================== */
(() => {
  const sectorById = () => new Map(((SV && SV.sectors) || []).map((s) => [s.id, s]));
  function rebuildPois() {
    const S = SECTOR; if (!S) return;
    const secs = sectorById();
    const imgFor = { settlement: ['timber_stone_tavern', 125, 60], watchtower: ['round_watchtower', 120, 40], frontier: ['teal_rune_stone', 80, 66], anchor: ['teal_rune_stone', 80, 66] };
    const list = S.landmarks.map((l) => { const [img, sz, py] = imgFor[l.kind] || imgFor.anchor; return { name: l.name, img, sz, py, x: l.x, y: l.y, dest: { sectorId: S.id, x: l.x, y: l.y }, kind: 'poi' }; });
    const seenTo = new Set();
    S.exits.filter((e) => e.from.sectorId === S.id).forEach((e) => {
      if (seenTo.has(e.to.sectorId)) return; seenTo.add(e.to.sectorId);
      const to = secs.get(e.to.sectorId); if (!to) return;
      list.push({ name: `Road to ${to.name}`, img: 'wooden_signpost', sz: 60, py: 62, x: e.from.x, y: e.from.y, dest: e.to, kind: 'exit', via: e.name });
    });
    window.__pois = list;
    lastPoi = ''; renderPoiList();
    poiLabelG.replaceChildren();
    list.filter((l) => !(l.kind === 'exit' && S.landmarks.some((m) => m.x === l.x && m.y === l.y))).forEach((l) => {
      const g = add(poiLabelG, 'g', {}), cx = (l.x + 0.5) * T, cy = (l.y + 0.5) * T;
      add(g, 'polygon', { points: `${cx},${cy - 46} ${cx + 7},${cy - 39} ${cx},${cy - 32} ${cx - 7},${cy - 39}`, fill: l.kind === 'exit' ? '#9fd3e6' : '#e6cb80', stroke: '#06202b', 'stroke-width': 1.6 });
      add(g, 'text', { x: cx, y: cy - 54, 'text-anchor': 'middle', fill: '#fff3d7', 'font-size': 12.5, 'font-weight': 500, 'font-family': 'Palatino Linotype, Palatino, Georgia, serif', 'letter-spacing': '.05em', stroke: '#06202b', 'stroke-width': 3.6, 'paint-order': 'stroke' }).textContent = l.name;
    });
  }
  const poiLabelG = add(world, 'g', { 'pointer-events': 'none' });
  const poiEl = document.getElementById('poi-list');
  let lastPoi = '';
  function renderPoiList() {
    const list = (window.__pois || []).map((l, i) => [l, i]).sort((a, b) => a[0].name.localeCompare(b[0].name));
    const html = list.map(([l, i]) => `<button type="button" class="pt" data-poi="${i}" aria-label="${esc(l.name)}"><span class="pc"><img src="assets/${l.img}.webp" alt="" style="width:${l.sz}%;top:${l.py}%"></span><span class="pn">${esc(l.name)}</span></button>`).join('') || '<p class="dockempty">No known points of interest here yet.</p>';
    if (html !== lastPoi) { poiEl.innerHTML = html; lastPoi = html; }
  }
  window.__renderPoiList = renderPoiList;
  poiEl.addEventListener('click', (e) => {
    const b = e.target.closest('[data-poi]'); if (!b) return;
    const l = (window.__pois || [])[Number(b.dataset.poi)]; if (!l) return;
    say(l.kind === 'exit' ? `Travelling along ${l.via || 'the road'}.` : `Walking to ${l.name}.`); sendWalk(l.dest);
  });

  function applyState(s) {
    const prevId = SECTOR && SECTOR.id;
    SV = s;
    const sec = s.sectors.find((x) => x.id === s.position.sectorId);
    if (!sec) return;
    HERO_PORTRAIT = s.portrait || null;
    if (!SECTOR || SECTOR.id !== sec.id) {
      for (let i = OTHERS.length - 1; i >= 0; i--) { OTHERS[i].el.remove(); if (OTHERS[i].ghost) OTHERS[i].ghost.remove(); }
      OTHERS.length = 0; byId.clear();
      loadSector(sec);
      me = { x: s.position.x, y: s.position.y }; meV = { ...me };
      lastRoster = ''; routeG.replaceChildren();
      board.classList.remove('arrive'); void board.offsetWidth; board.classList.add('arrive');
    } else {
      SECTOR.landmarks = sec.landmarks; SECTOR.exits = sec.exits;
      me = { x: s.position.x, y: s.position.y };
      if (Math.hypot(meV.x - me.x, meV.y - me.y) > 3) meV = { ...me };
    }
    buildHero();
    if (heroGhost) { heroGhost.remove(); heroGhost = null; }
    ROSTER = s.players.filter((p) => p.position.sectorId === SECTOR.id);
    refreshPlayers(ROSTER);
    if (!boardObj || !boardObj.contains(hero)) { updateChunks(...Object.values((({ cx, cy, vc, vr }) => ({ cx, cy, vc, vr }))(camera()))); }
    rebuildPois();
    drawRoute();
    if (window.AV_setEnv) window.AV_setEnv(s.environment);
    paint();
    if (window.AV && window.AV.sync) window.AV.sync();
    if (queued && !s.busy && !s.movementBlocked) { const q = queued; queued = null; sendWalk(q); }
  }
  window.addEventListener('message', (e) => {
    if (e.origin !== location.origin || !e.data || e.data.av !== 'world-host') return;
    if (e.data.type === 'state') applyState(e.data.state);
    else if (e.data.type === 'say') say(e.data.text);
  });
  post({ type: 'ready' });
})();
