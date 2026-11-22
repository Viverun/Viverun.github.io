// Terrain, moat, bridge, roads, vegetation and sky furniture.
import * as THREE from 'three';
import { box, cyl } from './castle.js';
import { rng, fbm, makeGrassTuftTexture, makeFlowerTexture } from './textures.js';

// Irregular moat profile (single-valued radius around the island).
const MOAT_IN = a => 29.4 + 1.5 * Math.sin(3 * a + 1.1) + 0.8 * Math.sin(7 * a + 0.5) + 0.45 * Math.sin(11 * a + 2.0);
const MOAT_OUT = a => MOAT_IN(a) + 8.3 + 1.1 * Math.sin(5 * a + 2.0) + 0.55 * Math.sin(9 * a + 1.0);

function radialShape(fn, segs, reverse = false) {
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const k = reverse ? segs - i : i;
    const a = (k / segs) * Math.PI * 2;
    const r = fn(a);
    const x = Math.cos(a) * r, y = -Math.sin(a) * r;
    if (i === 0) s.moveTo(x, y); else s.lineTo(x, y);
  }
  s.closePath();
  return s;
}

function ringSurface(inner, outer, y, segs, uvScale = 0.02) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const ri = inner(a), ro = outer(a);
    const c = Math.cos(a), s = Math.sin(a);
    pos.push(c * ri, y, s * ri); uv.push(c * ri * uvScale, s * ri * uvScale);
    pos.push(c * ro, y, s * ro); uv.push(c * ro * uvScale, s * ro * uvScale);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

function wallSurface(fn, yTop, yBot, segs) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= segs; i++) {
    const a = (i / segs) * Math.PI * 2;
    const r = fn(a), c = Math.cos(a), s = Math.sin(a);
    pos.push(c * r, yTop, s * r); uv.push(a * r, yTop);
    pos.push(c * r, yBot, s * r); uv.push(a * r, yBot);
    if (i < segs) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const clamp01 = v => Math.max(0, Math.min(1, v));

// Ring-shaped ground mesh with per-vertex tint, so the lawn has broad
// patchy variation instead of reading as one flat green sheet.
function groundGeometry(inner, outer, segs, rings, colorAt) {
  const pos = [], uv = [], col = [], idx = [];
  for (let j = 0; j <= rings; j++) {
    const t = Math.pow(j / rings, 1.4);
    for (let i = 0; i <= segs; i++) {
      const a = (i / segs) * Math.PI * 2;
      const ri = inner(a), ro = outer(a);
      const r = ri + (ro - ri) * t;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, 0, z);
      uv.push(x, z);
      const c = colorAt(x, z);
      col.push(c[0], c[1], c[2]);
    }
  }
  for (let j = 0; j < rings; j++) {
    for (let i = 0; i < segs; i++) {
      const k = j * (segs + 1) + i;
      const n = k + segs + 1;
      idx.push(k, k + 1, n, k + 1, n + 1, n);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Ribbon of ground that follows a curve, used for the approach road.
function ribbonGeometry(curve, samples, widthAt, y = 0) {
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const p = curve.getPointAt(t);
    const tg = curve.getTangentAt(t);
    const nx = -tg.z, nz = tg.x;
    const w = widthAt(t) * 0.5;
    const ax = p.x + nx * w, az = p.z + nz * w;
    const bx = p.x - nx * w, bz = p.z - nz * w;
    pos.push(ax, y, az, bx, y, bz);
    uv.push(ax, az, bx, bz);
    if (i < samples) {
      const k = i * 2;
      idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Two crossed vertical quads, for alpha-tested grass and flowers.
function crossedQuadsGeometry() {
  const p = [], u = [], nrm = [], idx = [];
  const quad = (a, b, c, d, nx, ny, nz) => {
    const base = p.length / 3;
    p.push(...a, ...b, ...c, ...d);
    u.push(0, 0, 1, 0, 1, 1, 0, 1);
    for (let i = 0; i < 4; i++) nrm.push(nx, ny, nz);
    idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  quad([-0.5, 0, 0], [0.5, 0, 0], [0.5, 1, 0], [-0.5, 1, 0], 0, 0, 1);
  quad([0, 0, -0.5], [0, 0, 0.5], [0, 1, 0.5], [0, 1, -0.5], 1, 0, 0);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(u, 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
  g.setIndex(idx);
  return g;
}

export function buildScenery(M) {
  const group = new THREE.Group();
  const spinners = [];
  const R = rng(4242);
  const SEG = 256;

  // ---------------------------------------------------------- island + bank
  const groundMat = M.grass.clone();
  groundMat.vertexColors = true;

  // broad, soft patches of dry and shaded grass
  const groundTint = (x, z) => {
    const n = fbm(x * 0.018 + 11.3, z * 0.018 - 7.1, 4);
    const fine = fbm(x * 0.09 - 4.2, z * 0.09 + 9.6, 3);
    const dry = smoothstep(0.52, 0.78, n);
    const shade = 0.86 + (n - 0.5) * 0.30 + (fine - 0.5) * 0.16;
    const r = shade * (0.92 + dry * 0.20);
    const g = shade * (0.99 + dry * 0.03);
    const b = shade * (0.88 - dry * 0.20);
    return [r, g, b];
  };

  const island = new THREE.Mesh(groundGeometry(() => 0.001, MOAT_IN, SEG, 8, groundTint), groundMat);
  island.receiveShadow = true;
  group.add(island);

  const bank = new THREE.Mesh(groundGeometry(MOAT_OUT, () => 620, SEG, 48, groundTint), groundMat);
  bank.receiveShadow = true;
  group.add(bank);

  // ---------------------------------------------------------- moat
  const revet = M.wall.clone();
  revet.side = THREE.DoubleSide;
  for (const fn of [MOAT_IN, MOAT_OUT]) {
    const w = new THREE.Mesh(wallSurface(fn, 0.02, -3.5, SEG), revet);
    w.receiveShadow = true;
    group.add(w);
  }

  // dark waterline band on the revetments
  {
    const moss = new THREE.MeshStandardMaterial({ color: 0x35402a, roughness: 1, side: THREE.DoubleSide });
    const inner = new THREE.Mesh(wallSurface(a => MOAT_IN(a) + 0.025, -0.55, -1.5, SEG), moss);
    const outer = new THREE.Mesh(wallSurface(a => MOAT_OUT(a) - 0.025, -0.55, -1.5, SEG), moss);
    inner.receiveShadow = outer.receiveShadow = true;
    group.add(inner, outer);
  }

  const bed = new THREE.Mesh(ringSurface(MOAT_IN, MOAT_OUT, -3.4, SEG), M.mud);
  bed.receiveShadow = true;
  group.add(bed);

  const water = new THREE.Mesh(ringSurface(MOAT_IN, MOAT_OUT, -1.12, SEG), M.water);
  water.receiveShadow = true;
  group.add(water);

  // ---------------------------------------------------------- bridge
  {
    const s = new THREE.Shape();
    s.moveTo(0, -3.2); s.lineTo(11, -3.2); s.lineTo(11, 0.32); s.lineTo(0, 0.32); s.closePath();
    for (const cx of [3.4, 7.6]) {
      const h = new THREE.Path();
      h.moveTo(cx - 1.3, -2.95);
      h.lineTo(cx - 1.3, -1.95);
      h.absarc(cx, -1.95, 1.3, Math.PI, 0, true);
      h.lineTo(cx + 1.3, -2.95);
      h.closePath();
      s.holes.push(h);
    }
    const geo = new THREE.ExtrudeGeometry(s, { depth: 6, bevelEnabled: false, curveSegments: 20 });
    geo.translate(0, 0, -3);
    const bridge = new THREE.Mesh(geo, M.gate);
    bridge.rotation.y = -Math.PI / 2;
    bridge.position.set(0, 0, 28.2);
    bridge.castShadow = true; bridge.receiveShadow = true;
    group.add(bridge);

    for (const sx of [-1, 1]) {
      box(group, 0.5, 1.15, 10.4, M.trim, sx * 2.7, 0.95, 33.7);
      box(group, 0.66, 0.28, 10.8, M.trim, sx * 2.7, 1.62, 33.7);
    }
  }

  // ---------------------------------------------------------- reeds + boat
  {
    const reedMat = new THREE.MeshStandardMaterial({ color: 0x6d7f42, roughness: 1 });
    for (let i = 0; i < 80; i++) {
      const a = R() * Math.PI * 2;
      const outerSide = R() < 0.5;
      const r = outerSide ? MOAT_OUT(a) + 0.4 : MOAT_IN(a) - 0.4;
      const g = new THREE.Group();
      g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      const n = 3 + Math.floor(R() * 5);
      for (let k = 0; k < n; k++) {
        const h = 0.55 + R() * 1.4;
        const blade = new THREE.Mesh(new THREE.ConeGeometry(0.055, h, 4), reedMat);
        blade.position.set((R() - 0.5) * 0.7, h / 2 - 0.05, (R() - 0.5) * 0.7);
        blade.rotation.z = (R() - 0.5) * 0.4;
        blade.castShadow = true;
        g.add(blade);
      }
      group.add(g);
    }

    // small moored rowboat
    const ba = 2.35;
    const br = (MOAT_IN(ba) + MOAT_OUT(ba)) / 2;
    const boat = new THREE.Group();
    boat.position.set(Math.cos(ba) * br, -1.06, Math.sin(ba) * br);
    boat.rotation.y = -ba + Math.PI / 2;
    const hull = new THREE.Mesh(
      new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2),
      M.woodDark
    );
    hull.scale.set(2.0, 0.62, 0.72);
    boat.add(hull);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 28), M.wood);
    rim.rotation.x = Math.PI / 2;
    rim.scale.set(2.0, 0.72, 1);
    boat.add(rim);
    for (const zz of [-0.8, 0.5]) {
      box(boat, 1.1, 0.08, 0.34, M.wood, 0, 0.1, zz);
    }
    group.add(boat);
  }

  // ---------------------------------------------------------- roads
  // Sunken lane from the bridge, bending away across the meadow.
  const roadCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 35.5),
    new THREE.Vector3(1.2, 0, 50),
    new THREE.Vector3(5.2, 0, 68),
    new THREE.Vector3(9.6, 0, 88),
    new THREE.Vector3(10.4, 0, 108),
    new THREE.Vector3(4.6, 0, 132),
    new THREE.Vector3(-4.4, 0, 160),
    new THREE.Vector3(-6.2, 0, 196),
    new THREE.Vector3(-1.8, 0, 236),
    new THREE.Vector3(4.5, 0, 288)
  ], false, 'catmullrom', 0.5);

  const roadWidth = t => 7.0 - 1.7 * t + Math.sin(t * 13.0) * 0.32 + Math.sin(t * 4.3 + 1.2) * 0.42;
  {
    const road = new THREE.Mesh(ribbonGeometry(roadCurve, 180, roadWidth, 0.055), M.dirt);
    road.receiveShadow = true;
    group.add(road);

    // courtyard path from the gate to the keep door
    const c = new THREE.Shape();
    c.moveTo(-2.0, -6.3);
    c.lineTo(-2.25, -12.0);
    c.lineTo(-2.1, -17.6);
    c.lineTo(2.1, -17.6);
    c.lineTo(2.25, -12.0);
    c.lineTo(2.0, -6.3);
    c.closePath();
    const court = new THREE.Mesh(new THREE.ShapeGeometry(c, 2), M.dirt);
    court.rotation.x = -Math.PI / 2;
    court.position.y = 0.055;
    court.receiveShadow = true;
    group.add(court);

    // apron in front of the keep door
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.4, 24), M.dirt);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(0, 0.058, 7.5);
    pad.receiveShadow = true;
    group.add(pad);
  }

  // ---------------------------------------------------------- roadside
  {
    const RP = rng(9091);
    const sideAt = (t, dist) => {
      const p = roadCurve.getPointAt(t);
      const tg = roadCurve.getTangentAt(t);
      return {
        x: p.x - tg.z * dist,
        z: p.z + tg.x * dist,
        yaw: Math.atan2(tg.x, tg.z)
      };
    };

    // post-and-rail fence along the eastern verge
    {
      const posts = [];
      for (let i = 0; i <= 13; i++) {
        const t = 0.075 + i * 0.0165;
        const s = sideAt(t, 5.1 + (RP() - 0.5) * 0.5);
        const post = box(group, 0.16, 1.18 + RP() * 0.12, 0.16, M.woodDark,
          s.x, 0.6, s.z);
        post.rotation.z = (RP() - 0.5) * 0.1;
        posts.push(s);
      }
      for (let i = 0; i < posts.length - 1; i++) {
        const a = posts[i], b = posts[i + 1];
        const dx = b.x - a.x, dz = b.z - a.z;
        const len = Math.hypot(dx, dz) - 0.14;
        for (const yy of [0.52, 0.96]) {
          const rail = box(group, 0.07, 0.1, len, M.wood,
            (a.x + b.x) / 2, yy, (a.z + b.z) / 2);
          rail.rotation.y = Math.atan2(dx, dz);
        }
      }
    }

    // parked cart on the western verge
    {
      const s = sideAt(0.17, -5.4);
      const cart = new THREE.Group();
      cart.position.set(s.x, 0.02, s.z);
      cart.rotation.y = s.yaw + 0.1;

      box(cart, 1.9, 0.2, 2.75, M.wood, 0, 0.92, 0);
      for (const sx of [-1, 1]) {
        box(cart, 0.12, 0.42, 2.75, M.wood, sx * 0.93, 1.24, 0);
        box(cart, 0.1, 0.18, 3.1, M.woodDark, sx * 0.62, 0.78, -2.85)
          .rotation.x = -0.12;
      }
      box(cart, 1.9, 0.42, 0.12, M.wood, 0, 1.24, -1.33);
      box(cart, 1.9, 0.42, 0.12, M.wood, 0, 1.24, 1.33);

      // crates in the bed
      for (const [x, z, s2, ry] of [[-0.42, -0.5, 1.0, 0.18], [0.4, 0.35, 0.82, -0.35]]) {
        box(cart, 0.72 * s2, 0.72 * s2, 0.72 * s2, M.wood, x, 1.38, z, ry);
      }

      for (const sx of [-1, 1]) {
        const wheel = new THREE.Group();
        wheel.position.set(sx * 1.02, 0.62, 0.35);
        wheel.rotation.y = Math.PI / 2;
        const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.085, 7, 20), M.woodDark);
        rim.castShadow = true;
        wheel.add(rim);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.22, 10), M.iron);
        hub.rotation.x = Math.PI / 2;
        wheel.add(hub);
        for (let k = 0; k < 4; k++) {
          const spoke = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.08, 0.06), M.woodDark);
          spoke.rotation.x = k * Math.PI / 4;
          wheel.add(spoke);
        }
        cart.add(wheel);
      }
      group.add(cart);
    }

    // fingerpost by the bridge
    {
      const s = sideAt(0.018, 4.4);
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      box(g, 0.16, 2.5, 0.16, M.woodDark, 0, 1.25, 0);
      const b1 = box(g, 1.15, 0.3, 0.07, M.wood, 0.45, 2.18, 0);
      b1.rotation.y = 0.5;
      const b2 = box(g, 1.0, 0.28, 0.07, M.wood, -0.4, 1.78, 0);
      b2.rotation.y = -0.7;
      g.rotation.y = s.yaw;
      group.add(g);
    }

    // weathered milestone
    {
      const s = sideAt(0.26, -4.7);
      const g = new THREE.Group();
      g.position.set(s.x, 0, s.z);
      g.rotation.y = s.yaw + 0.25;
      const m = box(g, 0.62, 0.85, 0.38, M.plinth, 0, 0.42, 0);
      m.rotation.z = -0.04;
      box(g, 0.3, 0.09, 0.04, M.iron, 0, 0.62, 0.2);
      box(g, 0.09, 0.3, 0.04, M.iron, 0, 0.58, 0.2);
      group.add(g);
    }

    // loose stones and grass-free patches along the road
    const gravelMat = M.plinth.clone();
    gravelMat.color.set(0x8f897c);
    for (let i = 0; i < 46; i++) {
      const t = 0.02 + RP() * 0.36;
      const s = sideAt(t, (RP() < 0.5 ? -1 : 1) * (roadWidth(t) * 0.5 + 0.2 + RP() * 1.5));
      const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16 + RP() * 0.22, 0), gravelMat);
      rock.position.set(s.x, 0.06, s.z);
      rock.scale.y = 0.55 + RP() * 0.3;
      rock.rotation.set(RP() * 3, RP() * 6, RP() * 3);
      rock.castShadow = true;
      rock.receiveShadow = true;
      group.add(rock);
    }
  }

  // ---------------------------------------------------------- vegetation
  const leafMats = [M.leaf, M.leaf2,
    new THREE.MeshStandardMaterial({ color: 0x2d4224, roughness: 0.95 }),
    new THREE.MeshStandardMaterial({ color: 0x4c6231, roughness: 0.95 })
  ];

  const tree = (x, z, s) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = R() * Math.PI * 2;
    const th = (3.4 + R() * 1.6) * s;
    cyl(g, 0.15 * s, 0.42 * s, th, M.bark, 0, th / 2, 0, 8);

    for (let b = 0; b < 3; b++) {
      const br = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * s, 0.15 * s, 2.4 * s, 6), M.bark);
      const ang = R() * Math.PI * 2;
      br.position.set(Math.cos(ang) * 0.6 * s, th * (0.55 + R() * 0.2), Math.sin(ang) * 0.6 * s);
      br.rotation.set(Math.cos(ang) * 0.9, 0, Math.sin(ang) * 0.9);
      br.castShadow = true;
      g.add(br);
    }

    const blobs = 7 + Math.floor(R() * 5);
    const mat = leafMats[Math.floor(R() * leafMats.length)];
    for (let i = 0; i < blobs; i++) {
      const rad = (0.95 + R() * 1.15) * s;
      const geo = new THREE.IcosahedronGeometry(rad, 1);
      const m = new THREE.Mesh(geo, mat);
      const ang = R() * Math.PI * 2;
      const rr = Math.pow(R(), 0.7) * 2.1 * s;
      m.position.set(
        Math.cos(ang) * rr,
        th + (0.4 + R() * 2.6) * s,
        Math.sin(ang) * rr
      );
      m.scale.y = 0.62 + R() * 0.35;
      m.rotation.set(R() * 3, R() * 3, R() * 3);
      m.castShadow = true;
      m.receiveShadow = true;
      g.add(m);
    }
    group.add(g);
  };

  const conifer = (x, z, s) => {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const th = 2.2 * s;
    cyl(g, 0.16 * s, 0.34 * s, th, M.bark, 0, th / 2, 0, 7);
    for (let i = 0; i < 4; i++) {
      const rr = (2.2 - i * 0.42) * s;
      const hh = (3.2 - i * 0.35) * s;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(rr, hh, 9), leafMats[2]);
      cone.position.y = th + i * 1.55 * s;
      cone.castShadow = true;
      g.add(cone);
    }
    group.add(g);
  };

  for (let i = 0; i < 30; i++) {
    const a = R() * Math.PI * 2;
    const rad = 48 + Math.pow(R(), 0.65) * 120;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (Math.abs(x) < 11 && z > 10) continue;
    if (R() < 0.3) conifer(x, z, 1.0 + R() * 0.9);
    else tree(x, z, 1.0 + R() * 1.2);
  }

  // a few closer trees for depth
  tree(-46, 58, 1.5); tree(58, 52, 1.3); conifer(-58, 12, 1.5);

  // forest ring
  {
    const geo = new THREE.ConeGeometry(2.4, 8, 7);
    const mat = new THREE.MeshStandardMaterial({ color: 0x2f4426, roughness: 1 });
    const inst = new THREE.InstancedMesh(geo, mat, 340);
    const dummy = new THREE.Object3D();
    const col = new THREE.Color();
    for (let i = 0; i < 340; i++) {
      const a = R() * Math.PI * 2;
      const rad = 150 + Math.pow(R(), 0.6) * 250;
      const s = 0.8 + R() * 1.4;
      dummy.position.set(Math.cos(a) * rad, 4 * s, Math.sin(a) * rad);
      dummy.scale.set(s, s, s);
      dummy.rotation.y = R() * 3;
      dummy.updateMatrix();
      inst.setMatrixAt(i, dummy.matrix);
      col.setHSL(0.26 + R() * 0.06, 0.22 + R() * 0.16, 0.13 + R() * 0.1);
      inst.setColorAt(i, col);
    }
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    group.add(inst);
  }

  // rocks
  const rockGeos = [0, 1, 2].map(() => {
    const g = new THREE.IcosahedronGeometry(1, 1);
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i);
      v.multiplyScalar(0.78 + R() * 0.5);
      p.setXYZ(i, v.x, v.y * 0.72, v.z);
    }
    g.computeVertexNormals();
    return g;
  });
  const rockMat = M.plinth.clone();
  rockMat.color.set(0x8d887b);
  for (let i = 0; i < 44; i++) {
    const a = R() * Math.PI * 2, rad = 34 + Math.pow(R(), 0.7) * 130;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (Math.abs(x) < 9 && z > 20) continue;
    const m = new THREE.Mesh(rockGeos[i % 3], rockMat);
    const s = 0.35 + Math.pow(R(), 2) * 1.7;
    m.position.set(x, s * 0.25, z);
    m.scale.setScalar(s);
    m.rotation.set(R() * 3, R() * 6, R() * 3);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
  }

  // bushes
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, rad = 32 + Math.pow(R(), 0.8) * 110;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (Math.abs(x) < 8 && z > 15) continue;
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    for (let k = 0; k < 3; k++) {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.5 + R() * 0.5, 1), R() < 0.5 ? M.leaf : M.leaf2);
      m.position.set((R() - 0.5) * 1.2, 0.35 + R() * 0.5, (R() - 0.5) * 1.2);
      m.castShadow = true;
      g.add(m);
    }
    group.add(g);
  }

  // ---------------------------------------------------------- ground cover
  {
    const G = rng(7373);
    const sideAt = (t, dist) => {
      const p = roadCurve.getPointAt(t);
      const tg = roadCurve.getTangentAt(t);
      return { x: p.x - tg.z * dist, z: p.z + tg.x * dist };
    };
    const nearRoad = (x, z) => {
      for (let i = 0; i <= 36; i++) {
        const p = roadCurve.getPointAt(i / 36);
        if ((p.x - x) ** 2 + (p.z - z) ** 2 < 26) return true;
      }
      return false;
    };

    const place = [];
    // verges of the approach road
    for (let i = 0; i < 190; i++) {
      const t = 0.008 + G() * 0.44;
      const s = G() < 0.5 ? -1 : 1;
      const p = sideAt(t, s * (roadWidth(t) * 0.5 + 0.3 + G() * 3.6));
      place.push([p.x, p.z, 0.65 + G() * 0.9]);
    }
    // soft fringe along the moat bank
    for (let i = 0; i < 120; i++) {
      const a = G() * Math.PI * 2;
      const r = MOAT_OUT(a) + 0.15 + G() * 2.2;
      place.push([Math.cos(a) * r, Math.sin(a) * r, 0.6 + G() * 0.85]);
    }
    // meadow scatter and a little inside the walls
    for (let i = 0; i < 150; i++) {
      const a = G() * Math.PI * 2;
      const r = 33 + Math.pow(G(), 0.7) * 95;
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (nearRoad(x, z)) continue;
      place.push([x, z, 0.55 + G() * 0.8]);
    }
    for (let i = 0; i < 34; i++) {
      const a = G() * Math.PI * 2;
      const r = 14.5 + G() * 3.4;
      place.push([Math.cos(a) * r, Math.sin(a) * r, 0.45 + G() * 0.5]);
    }

    const makeCover = (canvas, count, sizeLo, sizeHi, drape) => {
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mat = new THREE.MeshStandardMaterial({
        map: tex, alphaTest: 0.36, side: THREE.DoubleSide,
        roughness: 1, metalness: 0
      });
      const mesh = new THREE.InstancedMesh(crossedQuadsGeometry(), mat, count);
      mesh.frustumCulled = false;
      mesh.receiveShadow = true;
      const dummy = new THREE.Object3D();
      const col = new THREE.Color();
      for (let i = 0; i < count; i++) {
        const p = place[(i * drape) % place.length];
        const s = p[2];
        dummy.position.set(p[0], 0.015, p[1]);
        dummy.rotation.y = G() * Math.PI;
        dummy.scale.set(
          s * (sizeLo + G() * (sizeHi - sizeLo)) * 0.9,
          s * (sizeLo + G() * (sizeHi - sizeLo)) * 1.15,
          s * (sizeLo + G() * (sizeHi - sizeLo)) * 0.9
        );
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        col.setRGB(0.82 + G() * 0.28, 0.88 + G() * 0.26, 0.78 + G() * 0.26);
        mesh.setColorAt(i, col);
      }
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      group.add(mesh);
    };

    makeCover(makeGrassTuftTexture(), 430, 0.75, 1.5, 7);
    makeCover(makeFlowerTexture(), 130, 0.55, 1.05, 13);
  }

  // ---------------------------------------------------------- windmill
  {
    const mill = new THREE.Group();
    mill.position.set(-53, 0, -7);
    mill.rotation.y = 0.42;

    cyl(mill, 2.5, 3.15, 12.5, M.tower, 0, 6.25, 0, 22);
    cyl(mill, 3.3, 3.55, 1.1, M.plinth, 0, 0.55, 0, 22);
    cyl(mill, 2.72, 2.55, 0.55, M.trim, 0, 9.6, 0, 22);

    // timber cap
    const cap = new THREE.Mesh(new THREE.ConeGeometry(2.95, 4.6, 22), M.woodDark);
    cap.position.y = 14.4;
    cap.castShadow = true;
    mill.add(cap);
    cyl(mill, 0.07, 0.07, 1.5, M.iron, 0, 17.2, 0, 6);

    // doorway and windows facing the approach
    const door = box(mill, 1.35, 2.35, 0.22, M.woodDark, 0, 1.18, 3.08);
    door.rotation.x = -0.09;
    box(mill, 1.7, 0.22, 0.5, M.wood, 0, 2.5, 3.15).rotation.x = 0.25;
    for (const [yy, zz] of [[6.4, 2.9], [9.4, 2.68]]) {
      box(mill, 0.62, 0.9, 0.18, M.iron, 0, yy, zz);
    }

    // sails
    const hub = new THREE.Group();
    hub.position.set(0, 14.6, 3.05);
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.9, 10), M.iron);
    axle.rotation.x = Math.PI / 2;
    axle.castShadow = true;
    hub.add(axle);

    const clothMat = new THREE.MeshStandardMaterial({
      color: 0xcfc0a2, roughness: 0.95, side: THREE.DoubleSide
    });
    for (let k = 0; k < 4; k++) {
      const sail = new THREE.Group();
      sail.rotation.z = (k / 4) * Math.PI * 2;
      const beam = box(sail, 0.2, 9.4, 0.18, M.woodDark, 0, 4.6, 0);
      beam.castShadow = true;
      const cloth = new THREE.Mesh(new THREE.PlaneGeometry(1.75, 6.1), clothMat);
      cloth.position.set(1.02, 5.6, 0.02);
      cloth.castShadow = true;
      sail.add(cloth);
      for (const yy of [2.6, 4.2, 5.8, 7.4, 8.9]) {
        box(sail, 1.95, 0.07, 0.1, M.woodDark, 1.0, yy, 0.04);
      }
      box(sail, 0.07, 6.2, 0.1, M.woodDark, 1.88, 5.6, 0.04);
      hub.add(sail);
    }
    mill.add(hub);
    spinners.push({ obj: hub, speed: 0.32 });

    // millstone and sacks by the door
    const stone = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 0.2, 18), M.plinth);
    stone.position.set(2.3, 0.85, 2.7);
    stone.rotation.set(1.35, 0, 0.3);
    stone.castShadow = true;
    mill.add(stone);
    for (const [x, z, s] of [[-1.9, 2.7, 0.8], [-2.4, 3.2, 0.65]]) {
      const sack = new THREE.Mesh(new THREE.SphereGeometry(0.55 * s, 10, 8), M.wood);
      sack.position.set(x, 0.42 * s, z);
      sack.scale.set(1, 0.8, 0.8);
      sack.castShadow = true;
      mill.add(sack);
    }

    group.add(mill);
  }

  // ---------------------------------------------------------- distant hills
  {
    const hillMat = M.hill.clone();
    hillMat.vertexColors = true;
    const tint = new THREE.Color();

    for (let i = 0; i < 11; i++) {
      const seed = i * 37.7 + 4;
      const geo = new THREE.SphereGeometry(1, 48, 24);
      const p = geo.attributes.position;
      const col = [];
      for (let k = 0; k < p.count; k++) {
        const x = p.getX(k), y = p.getY(k), z = p.getZ(k);
        const r = 1 + (fbm(x * 2.1 + seed, z * 2.1 - seed, 4) - 0.5) * 0.34;
        p.setXYZ(k, x * r, y * r, z * r);
        const t = 0.78 + (y + 1) * 0.13 + fbm(x * 4 + seed, z * 4 + seed, 2) * 0.08;
        tint.setRGB(t * 0.94, t, t * 0.9);
        col.push(tint.r, tint.g, tint.b);
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      geo.computeVertexNormals();

      const a = (i / 11) * Math.PI * 2 + (R() - 0.5) * 0.5;
      const rad = i < 3 ? 480 + R() * 70 : 570 + R() * 210;
      const m = new THREE.Mesh(geo, hillMat);
      m.position.set(Math.cos(a) * rad, -45 - R() * 10, Math.sin(a) * rad);
      m.scale.set(200 + R() * 190, 48 + R() * 48, 170 + R() * 150);
      group.add(m);
    }
  }

  // ---------------------------------------------------------- clouds
  return { group, water, spinners };
}

export function buildClouds(canvas) {
  const group = new THREE.Group();
  const R = rng(606);
  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(canvas),
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    color: 0xaebcc8
  });
  const clouds = [];
  const addAt = (x, y, z, s, op) => {
    const sp = new THREE.Sprite(mat.clone());
    sp.position.set(x, y, z);
    sp.scale.set(s, s * 0.44, 1);
    sp.material.opacity = op;
    group.add(sp);
    clouds.push({ sprite: sp, speed: 1.2 + R() * 1.8, x0: x });
  };
  // low banks to either side of the castle, where the default camera actually looks
  addAt(-260, 58, -280, 300, 0.75);
  addAt(260, 60, -300, 320, 0.7);
  addAt(-390, 70, -420, 360, 0.6);
  addAt(390, 72, -430, 340, 0.55);
  for (let i = 0; i < 8; i++) {
    const a = R() * Math.PI * 2, rad = 250 + R() * 210;
    addAt(Math.cos(a) * rad, 46 + R() * 34, Math.sin(a) * rad, 190 + R() * 130, 0.45 + R() * 0.25);
  }
  for (let i = 0; i < 7; i++) {
    const a = R() * Math.PI * 2, rad = 520 + R() * 240;
    addAt(Math.cos(a) * rad, 24 + R() * 28, Math.sin(a) * rad, 300 + R() * 170, 0.3 + R() * 0.25);
  }
  return { group, clouds };
}
