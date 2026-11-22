// Procedural textures — no external image assets.
import * as THREE from 'three';

export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hash2 = (x, y) => {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return n - Math.floor(n);
};

function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi), b = hash2(xi + 1, yi);
  const c = hash2(xi, yi + 1), d = hash2(xi + 1, yi + 1);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

export function fbm(x, y, oct = 4) {
  let s = 0, amp = 0.5, f = 1;
  for (let i = 0; i < oct; i++) { s += amp * vnoise(x * f, y * f); f *= 2; amp *= 0.5; }
  return s;
}

function cv(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function normalFromHeight(srcCanvas, strength = 2.5) {
  const w = srcCanvas.width, h = srcCanvas.height;
  const src = srcCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const out = new ImageData(w, h);
  const d = out.data;
  const at = (x, y) => src[((((y % h) + h) % h) * w + (((x % w) + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (at(x + 1, y) - at(x - 1, y)) * strength;
      const dy = (at(x, y + 1) - at(x, y - 1)) * strength;
      const nx = -dx, ny = -dy, nz = 1;
      const len = Math.hypot(nx, ny, nz);
      const i = (y * w + x) * 4;
      d[i] = (nx / len * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / len * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / len * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  const c = cv(w, h);
  c.getContext('2d').putImageData(out, 0, 0);
  return c;
}

function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- stone
export function makeStoneTextures() {
  const S = 512, R = rng(9182);
  const col = cv(S), hgt = cv(S);
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');

  cx.fillStyle = '#464239'; cx.fillRect(0, 0, S, S);
  hx.fillStyle = '#101010'; hx.fillRect(0, 0, S, S);

  const rows = 9, rh = S / rows;
  for (let r = 0; r < rows; r++) {
    const y = r * rh;
    const n = 5 + Math.floor(R() * 4);
    let ws = Array.from({ length: n }, () => 0.6 + R() * 1.0);
    const sum = ws.reduce((a, b) => a + b, 0);
    ws = ws.map(v => v / sum * S);

    let x = (r % 2 ? S * 0.5 : 0);
    for (const w of ws) {
      const pad = 2.2;
      const tone = { h: 30 + R() * 14, s: 5 + R() * 9, l: 42 + R() * 18 };
      const shade = 0.86 + R() * 0.24;

      const draw = (bx, bw) => {
        if (bw < 3) return;
        const bw2 = bw - pad * 2, bh = rh - pad * 2;
        cx.fillStyle = `hsl(${tone.h} ${tone.s}% ${tone.l}%)`;
        roundRect(cx, bx + pad, y + pad, bw2, bh, 3); cx.fill();

        const g = cx.createLinearGradient(0, y, 0, y + rh);
        g.addColorStop(0, `rgba(255,255,255,${0.09 * shade})`);
        g.addColorStop(0.45, 'rgba(255,255,255,0)');
        g.addColorStop(1, `rgba(20,16,10,${0.22 * shade})`);
        cx.fillStyle = g;
        roundRect(cx, bx + pad, y + pad, bw2, bh, 3); cx.fill();

        for (let i = 0; i < 30; i++) {
          cx.fillStyle = R() < 0.5 ? 'rgba(0,0,0,.10)' : 'rgba(255,255,255,.075)';
          cx.fillRect(bx + pad + R() * bw2, y + pad + R() * bh, 1 + R() * 2.2, 1 + R() * 2.2);
        }
        if (R() < 0.22) {
          cx.strokeStyle = 'rgba(26,22,17,.42)';
          cx.lineWidth = 0.8 + R();
          cx.beginPath();
          let px = bx + pad + R() * bw2, py = y + pad + R() * bh;
          cx.moveTo(px, py);
          for (let k = 0; k < 4; k++) {
            px += (R() - 0.5) * 26; py += (R() - 0.3) * 14;
            cx.lineTo(px, py);
          }
          cx.stroke();
        }

        const hv = 185 + R() * 70;
        hx.fillStyle = `rgb(${hv},${hv},${hv})`;
        roundRect(hx, bx + pad, y + pad, bw2, bh, 3); hx.fill();
        for (let i = 0; i < 16; i++) {
          hx.fillStyle = `rgba(0,0,0,${0.05 + R() * 0.14})`;
          hx.fillRect(bx + pad + R() * bw2, y + pad + R() * bh, 1 + R() * 3, 1 + R() * 3);
        }
      };

      if (x + w <= S) draw(x, w);
      else { draw(x, S - x); draw(0, w - (S - x)); }
      x = (x + w) % S;
    }
  }

  // large scale weathering
  for (let i = 0; i < 80; i++) {
    const x = R() * S, y = R() * S, rr = 24 + R() * 80;
    const g = cx.createRadialGradient(x, y, 0, x, y, rr);
    const dark = R() < 0.55;
    g.addColorStop(0, dark ? 'rgba(32,29,24,.11)' : 'rgba(214,208,192,.07)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rr, 0, 6.2832); cx.fill();
  }
  // moss / lichen
  for (let i = 0; i < 30; i++) {
    const x = R() * S, y = R() * S, rr = 6 + R() * 30;
    const g = cx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(84,99,52,${0.06 + R() * 0.10})`);
    g.addColorStop(1, 'rgba(84,99,52,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rr, 0, 6.2832); cx.fill();
  }

  // fine grain
  const id = cx.getImageData(0, 0, S, S), d = id.data;
  for (let p = 0; p < d.length; p += 4) {
    const i = p / 4, px = i % S, py = (i / S) | 0;
    const n = (fbm(px * 0.06, py * 0.06, 3) - 0.5) * 30 + (R() - 0.5) * 12;
    d[p] = Math.max(0, Math.min(255, d[p] + n));
    d[p + 1] = Math.max(0, Math.min(255, d[p + 1] + n));
    d[p + 2] = Math.max(0, Math.min(255, d[p + 2] + n));
  }
  cx.putImageData(id, 0, 0);

  return { color: col, normal: normalFromHeight(hgt, 3.2), height: hgt };
}

// ---------------------------------------------------------------- slate roof
export function makeRoofTextures() {
  const S = 512, R = rng(5511);
  const col = cv(S), hgt = cv(S);
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');
  cx.fillStyle = '#1a2027'; cx.fillRect(0, 0, S, S);
  hx.fillStyle = '#161616'; hx.fillRect(0, 0, S, S);

  const cols = 7, rows = 9, tw = S / cols, th = S / rows;
  for (let r = rows - 1; r >= 0; r--) {
    for (let c = -1; c <= cols; c++) {
      const x = c * tw + (r % 2 ? tw * 0.5 : 0);
      const y = r * th;
      const lig = 20 + R() * 16, hue = 208 + R() * 20;
      const path = () => {
        cx.beginPath();
        cx.moveTo(x + 2, y + 1);
        cx.lineTo(x + tw - 2, y + 1);
        cx.lineTo(x + tw - 2, y + th * 0.62);
        cx.quadraticCurveTo(x + tw / 2, y + th + 6, x + 2, y + th * 0.62);
        cx.closePath();
      };
      cx.fillStyle = `hsl(${hue} ${9 + R() * 12}% ${lig}%)`;
      path(); cx.fill();
      cx.strokeStyle = 'rgba(8,12,16,.55)'; cx.lineWidth = 1.6; cx.stroke();

      const g = cx.createLinearGradient(0, y, 0, y + th);
      g.addColorStop(0, 'rgba(190,214,236,.30)');
      g.addColorStop(0.35, 'rgba(190,214,236,.03)');
      g.addColorStop(1, 'rgba(0,0,0,.30)');
      cx.fillStyle = g; path(); cx.fill();

      hx.fillStyle = `rgb(${150 + R() * 90},${150 + R() * 90},${150 + R() * 90})`;
      hx.beginPath();
      hx.moveTo(x + 2, y + 1);
      hx.lineTo(x + tw - 2, y + 1);
      hx.lineTo(x + tw - 2, y + th * 0.62);
      hx.quadraticCurveTo(x + tw / 2, y + th + 6, x + 2, y + th * 0.62);
      hx.closePath(); hx.fill();
    }
  }
  return { color: col, normal: normalFromHeight(hgt, 2.2) };
}

// ---------------------------------------------------------------- wood
export function makeWoodTexture(dark = false) {
  const S = 512, R = rng(2277);
  const c = cv(S), cx = c.getContext('2d');
  cx.fillStyle = dark ? '#2b1d13' : '#4a3320';
  cx.fillRect(0, 0, S, S);

  const planks = 7, pw = S / planks;
  for (let i = 0; i < planks; i++) {
    const x = i * pw;
    const l = (dark ? 12 : 22) + R() * 10;
    cx.fillStyle = `hsl(${24 + R() * 10} ${28 + R() * 12}% ${l}%)`;
    cx.fillRect(x + 1.5, 0, pw - 3, S);

    for (let k = 0; k < 46; k++) {
      cx.strokeStyle = `rgba(${R() < 0.5 ? '0,0,0' : '255,230,190'},${0.03 + R() * 0.08})`;
      cx.lineWidth = 0.6 + R() * 1.6;
      cx.beginPath();
      const yy = R() * S;
      cx.moveTo(x + 2, yy);
      for (let s = 0; s < 5; s++) {
        cx.lineTo(x + 2 + (s + 1) * pw / 5, yy + Math.sin(s * 2 + i) * 4 + (R() - 0.5) * 6);
      }
      cx.stroke();
    }
    if (R() < 0.6) {
      const kx = x + pw * (0.3 + R() * 0.4), ky = R() * S;
      for (let k = 5; k > 0; k--) {
        cx.strokeStyle = `rgba(0,0,0,${0.06 + k * 0.02})`;
        cx.lineWidth = 1;
        cx.beginPath(); cx.ellipse(kx, ky, k * 2.2, k * 3.4, 0.2, 0, 6.2832); cx.stroke();
      }
    }
    cx.fillStyle = 'rgba(0,0,0,.35)';
    cx.fillRect(x, 0, 1.5, S);
  }
  // iron bands option left to geometry
  return c;
}

// ---------------------------------------------------------------- grass
export function makeGrassTexture() {
  const S = 512, R = rng(771);
  const col = cv(S), hgt = cv(S);
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');
  const id = cx.createImageData(S, S), d = id.data;
  const hd = hx.createImageData(S, S), hdata = hd.data;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm(x * 0.02, y * 0.02, 4);
      const n2 = fbm(x * 0.09 + 40, y * 0.09 + 40, 3);
      const t = n * 0.65 + n2 * 0.35;
      const r = 48 + t * 46 + (R() - 0.5) * 16;
      const g = 82 + t * 58 + (R() - 0.5) * 18;
      const b = 34 + t * 26 + (R() - 0.5) * 12;
      const i = (y * S + x) * 4;
      d[i] = r; d[i + 1] = g; d[i + 2] = b; d[i + 3] = 255;
      const hv = 90 + t * 120 + (R() - 0.5) * 40;
      hdata[i] = hdata[i + 1] = hdata[i + 2] = hv; hdata[i + 3] = 255;
    }
  }
  cx.putImageData(id, 0, 0);
  hx.putImageData(hd, 0, 0);

  for (let i = 0; i < 4200; i++) {
    const x = R() * S, y = R() * S;
    const len = 3 + R() * 9;
    cx.strokeStyle = `rgba(${40 + R() * 40},${80 + R() * 60},${30 + R() * 35},${0.25 + R() * 0.5})`;
    cx.lineWidth = 0.7 + R() * 0.9;
    cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x + (R() - 0.5) * 4, y - len); cx.stroke();
  }
  // dry patches
  for (let i = 0; i < 40; i++) {
    const x = R() * S, y = R() * S, rr = 8 + R() * 40;
    const g = cx.createRadialGradient(x, y, 0, x, y, rr);
    g.addColorStop(0, `rgba(128,120,62,${0.05 + R() * 0.08})`);
    g.addColorStop(1, 'rgba(128,120,62,0)');
    cx.fillStyle = g; cx.beginPath(); cx.arc(x, y, rr, 0, 6.2832); cx.fill();
  }
  return { color: col, normal: normalFromHeight(hgt, 1.5) };
}

// ---------------------------------------------------------------- dirt path
export function makeDirtTexture() {
  const S = 512, R = rng(3300);
  const col = cv(S), hgt = cv(S);
  const cx = col.getContext('2d'), hx = hgt.getContext('2d');
  const id = cx.createImageData(S, S), d = id.data;
  const hd = hx.createImageData(S, S), hdata = hd.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n = fbm(x * 0.03, y * 0.03, 4);
      const i = (y * S + x) * 4;
      d[i] = 88 + n * 58 + (R() - 0.5) * 26;
      d[i + 1] = 72 + n * 48 + (R() - 0.5) * 22;
      d[i + 2] = 54 + n * 34 + (R() - 0.5) * 18;
      d[i + 3] = 255;
      const hv = 80 + n * 90 + (R() - 0.5) * 50;
      hdata[i] = hdata[i + 1] = hdata[i + 2] = hv; hdata[i + 3] = 255;
    }
  }
  cx.putImageData(id, 0, 0); hx.putImageData(hd, 0, 0);
  for (let i = 0; i < 500; i++) {
    const x = R() * S, y = R() * S, r = 1 + R() * 3.5;
    cx.fillStyle = `rgba(${120 + R() * 60},${115 + R() * 50},${100 + R() * 40},.5)`;
    cx.beginPath(); cx.ellipse(x, y, r, r * 0.7, R() * 3, 0, 6.2832); cx.fill();
    hx.fillStyle = 'rgba(255,255,255,.5)';
    hx.beginPath(); hx.ellipse(x, y, r, r * 0.7, R() * 3, 0, 6.2832); hx.fill();
  }
  return { color: col, normal: normalFromHeight(hgt, 1.2) };
}

// ---------------------------------------------------------------- water normals
export function makeWaterNormal() {
  const S = 256, R = rng(4400);
  const c = cv(S), ctx = c.getContext('2d');
  const id = ctx.createImageData(S, S), d = id.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const e = 0.7;
      const h = (xx, yy) => fbm(xx * 0.045, yy * 0.045, 4) + 0.35 * fbm(xx * 0.13 + 20, yy * 0.13 + 20, 3);
      const dx = (h(x + e, y) - h(x - e, y)) * 3.2;
      const dy = (h(x, y + e) - h(x, y - e)) * 3.2;
      const nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * S + x) * 4;
      d[i] = (nx / l * 0.5 + 0.5) * 255;
      d[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      d[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(id, 0, 0);
  return c;
}

// ---------------------------------------------------------------- heraldry
export function makeBannerTexture(w = 512, h = 768) {
  const c = cv(w, h), x = c.getContext('2d');
  const g = x.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#7c1b22');
  g.addColorStop(0.55, '#6a141b');
  g.addColorStop(1, '#4c0d13');
  x.fillStyle = g; x.fillRect(0, 0, w, h);

  // cloth shading
  for (let i = 0; i < 26; i++) {
    x.fillStyle = `rgba(0,0,0,${0.02 + Math.random() * 0.05})`;
    x.fillRect(Math.random() * w, 0, 4 + Math.random() * 18, h);
  }
  // gold border
  x.strokeStyle = '#c9a558'; x.lineWidth = w * 0.045;
  x.strokeRect(w * 0.055, h * 0.045, w * 0.89, h * 0.91);
  x.strokeStyle = 'rgba(255,225,160,.5)'; x.lineWidth = 2;
  x.strokeRect(w * 0.075, h * 0.06, w * 0.85, h * 0.88);

  // cross pattée
  x.save();
  x.translate(w / 2, h * 0.43);
  const a = Math.min(w, h) * 0.30;
  const bw = a * 0.19, ew = a * 0.46;
  x.fillStyle = '#d8b25f';
  x.beginPath();
  x.moveTo(-ew / 2, -a); x.lineTo(ew / 2, -a); x.lineTo(bw, -bw);
  x.lineTo(bw, bw); x.lineTo(ew / 2, a); x.lineTo(-ew / 2, a);
  x.lineTo(-bw, bw); x.lineTo(-bw, -bw);
  x.closePath(); x.fill();
  x.beginPath();
  x.moveTo(-a, -ew / 2); x.lineTo(-a, ew / 2); x.lineTo(-bw, bw);
  x.lineTo(bw, bw); x.lineTo(a, ew / 2); x.lineTo(a, -ew / 2);
  x.lineTo(bw, -bw); x.lineTo(-bw, -bw);
  x.closePath(); x.fill();
  x.strokeStyle = 'rgba(60,10,14,.55)';
  x.lineWidth = 3;
  x.beginPath(); x.arc(0, 0, a * 1.22, 0, 6.2832); x.stroke();
  x.restore();

  // tassels
  x.fillStyle = '#c9a558';
  x.fillRect(0, h - h * 0.02, w, h * 0.02);
  return c;
}

export function makeFlagTexture() {
  const c = makeBannerTexture(512, 320);
  return c;
}

// ---------------------------------------------------------------- misc
export function makeSoftTexture(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 128) {
  const c = cv(size), x = c.getContext('2d');
  const g = x.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.5, inner.replace(/,\s*[\d.]+\)$/, ', 0.55)'));
  g.addColorStop(1, outer);
  x.fillStyle = g; x.fillRect(0, 0, size, size);
  return c;
}

export function makeFlameTexture() {
  const c = cv(128), x = c.getContext('2d');
  const g = x.createRadialGradient(64, 78, 2, 64, 70, 60);
  g.addColorStop(0, 'rgba(255,250,220,1)');
  g.addColorStop(0.22, 'rgba(255,224,140,.95)');
  g.addColorStop(0.5, 'rgba(255,150,60,.55)');
  g.addColorStop(1, 'rgba(255,90,20,0)');
  x.fillStyle = g;
  x.beginPath(); x.ellipse(64, 70, 40, 54, 0, 0, 6.2832); x.fill();
  return c;
}

// ---------------------------------------------------------------- ground cover
export function makeGrassTuftTexture() {
  const S = 256, R = rng(5151);
  const c = cv(S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S);

  for (let i = 0; i < 54; i++) {
    const bx = S * 0.5 + (R() - 0.5) * S * 0.8;
    const h = S * (0.28 + R() * 0.64);
    const bend = (R() - 0.5) * S * 0.42;
    const hue = 76 + R() * 34;
    const sat = 30 + R() * 24;
    const lig = 16 + R() * 24;
    const grad = x.createLinearGradient(0, S, 0, S - h);
    grad.addColorStop(0, `hsl(${hue} ${sat}% ${lig}%)`);
    grad.addColorStop(1, `hsl(${hue + 10} ${sat}% ${lig + 16}%)`);
    x.strokeStyle = grad;
    x.lineWidth = 1.6 + R() * 3.0;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(bx, S);
    x.quadraticCurveTo(bx + bend * 0.35, S - h * 0.55, bx + bend, S - h);
    x.stroke();
  }

  // a few pale seed heads catching the light
  for (let i = 0; i < 14; i++) {
    const bx = S * 0.5 + (R() - 0.5) * S * 0.7;
    const h = S * (0.45 + R() * 0.45);
    x.strokeStyle = `hsla(${48 + R() * 16}, ${24 + R() * 18}%, ${48 + R() * 22}%, .9)`;
    x.lineWidth = 1.4;
    x.beginPath();
    x.moveTo(bx, S);
    x.quadraticCurveTo(bx + (R() - 0.5) * 40, S - h * 0.6, bx + (R() - 0.5) * 60, S - h);
    x.stroke();
  }
  return c;
}

export function makeFlowerTexture() {
  const S = 256, R = rng(6262);
  const c = cv(S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S);

  for (let i = 0; i < 22; i++) {
    const bx = S * 0.5 + (R() - 0.5) * S * 0.8;
    const h = S * (0.25 + R() * 0.55);
    const tx = bx + (R() - 0.5) * S * 0.3;
    const ty = S - h;
    x.strokeStyle = `hsl(${82 + R() * 26} ${30 + R() * 20}% ${20 + R() * 16}%)`;
    x.lineWidth = 1.2 + R();
    x.beginPath();
    x.moveTo(bx, S);
    x.quadraticCurveTo(bx + (tx - bx) * 0.3, S - h * 0.55, tx, ty);
    x.stroke();

    const petals = 4 + Math.floor(R() * 3);
    const rr = 2.6 + R() * 3.4;
    const pal = [
      [48, 92, 62], [0, 0, 92], [46, 88, 55],
      [340, 58, 72], [275, 40, 70], [34, 96, 58]
    ][Math.floor(R() * 6)];
    for (let k = 0; k < petals; k++) {
      const a = (k / petals) * Math.PI * 2;
      x.fillStyle = `hsl(${pal[0]} ${pal[1]}% ${pal[2]}%)`;
      x.beginPath();
      x.ellipse(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr, rr * 0.72, rr * 0.55, a, 0, 6.2832);
      x.fill();
    }
    x.fillStyle = 'rgba(255,240,170,.95)';
    x.beginPath(); x.arc(tx, ty, rr * 0.45, 0, 6.2832); x.fill();
  }
  return c;
}

export function makeCloudTexture() {
  const S = 256, R = rng(9090);
  const c = cv(S), x = c.getContext('2d');
  const id = x.createImageData(S, S), d = id.data;
  for (let y = 0; y < S; y++) {
    for (let x2 = 0; x2 < S; x2++) {
      const nx = x2 / S - 0.5, ny = y / S - 0.5;
      const r = Math.hypot(nx * 1.5, ny * 2.6);
      let a = Math.max(0, 1 - r * 1.75);
      a *= 0.6 + 0.75 * fbm(x2 * 0.022, y * 0.022, 4);
      a = Math.max(0, Math.min(1, a * 1.9));
      const i = (y * S + x2) * 4;
      d[i] = 255; d[i + 1] = 252; d[i + 2] = 248;
      d[i + 3] = a * 255 * (0.55 + 0.45 * Math.max(0, 1 - r * 1.35));
    }
  }
  x.putImageData(id, 0, 0);
  return c;
}

export function makeIvyTexture() {
  const S = 256, R = rng(1212);
  const c = cv(S), x = c.getContext('2d');
  x.clearRect(0, 0, S, S);
  for (let i = 0; i < 520; i++) {
    const a = R() * 6.2832, rad = Math.pow(R(), 0.6) * S * 0.46;
    const px = S / 2 + Math.cos(a) * rad;
    const py = S / 2 + Math.sin(a) * rad * 1.25;
    const s = 4 + R() * 9;
    x.fillStyle = `hsl(${88 + R() * 34} ${30 + R() * 26}% ${16 + R() * 22}%)`;
    x.beginPath();
    x.ellipse(px, py, s, s * 0.62, R() * 6.28, 0, 6.2832);
    x.fill();
  }
  return c;
}
