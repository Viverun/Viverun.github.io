// Castle architecture: curtain wall, corner towers, gatehouse, keep, great hall.
import * as THREE from 'three';
import { makeFlameTexture } from './textures.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);

export function box(parent, w, h, d, mat, x = 0, y = 0, z = 0, ry = 0) {
  const m = new THREE.Mesh(BOX, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.rotation.y = ry;
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

export function cyl(parent, rt, rb, h, mat, x, y, z, seg = 32) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg, 1), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

function barrelAt(M, parent, x, z, s = 1) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  cyl(g, 0.4 * s, 0.4 * s, 0.95 * s, M.woodDark, 0, 0.475 * s, 0, 16);
  for (const yy of [0.16, 0.48, 0.8]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.408 * s, 0.035 * s, 6, 20), M.iron);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = yy * s;
    g.add(ring);
  }
  parent.add(g);
  return g;
}

function merlonRun(len, y, mat, o = {}) {
  const w = o.w ?? 1.4, t = o.t ?? 0.55, h = o.h ?? 1.45, gap = o.gap ?? 0.85;
  const g = new THREE.Group();
  const step = w + gap;
  const n = Math.max(2, Math.floor((len - w) / step) + 1);
  const span = (n - 1) * step;
  for (let i = 0; i < n; i++) {
    box(g, w, h, t, mat, -span / 2 + i * step, y + h / 2, 0);
  }
  return g;
}

function ringMerlons(r, y, count, mat, o = {}) {
  const w = o.w ?? 1.4, t = o.t ?? 0.55, h = o.h ?? 1.45;
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2;
    box(g, w, h, t, mat, Math.sin(a) * r, y + h / 2, Math.cos(a) * r, a);
  }
  return g;
}

function archShape(w, h) {
  const r = w / 2, st = h - r;
  const s = new THREE.Shape();
  s.moveTo(-r, 0);
  s.lineTo(r, 0);
  s.lineTo(r, st);
  s.absarc(0, st, r, 0, Math.PI, false);
  s.lineTo(-r, 0);
  return s;
}

function archWindow(parent, M, { w = 1.7, h = 3.4, x, y, z, ry = 0, lit = false }) {
  const g = new THREE.Group();
  const frame = new THREE.Mesh(new THREE.ShapeGeometry(archShape(w + 0.55, h + 0.3), 24), M.trim);
  frame.position.z = -0.05;
  g.add(frame);
  const gl = new THREE.Mesh(new THREE.ShapeGeometry(archShape(w, h), 24), lit ? M.glassLit : M.glass);
  g.add(gl);
  box(g, 0.1, h * 0.9, 0.09, M.trim, 0, h * 0.45, 0.045);
  box(g, w * 0.94, 0.1, 0.09, M.trim, 0, h - w * 0.5, 0.045);
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  return g;
}

function slit(parent, M, r, angle, y) {
  const a = angle;
  box(parent, 0.26, 1.8, 0.34, M.iron, Math.sin(a) * r, y, Math.cos(a) * r, a);
  box(parent, 0.5, 0.16, 0.3, M.trim, Math.sin(a) * r, y - 0.98, Math.cos(a) * r, a);
}

function roundTower(M, { x, z, r, h, roofH = 7.5, segments = 44, flag = false, cloth, slits = true }) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);

  cyl(g, r * 0.94, r * 1.07, h, M.tower, 0, h / 2, 0, segments);
  cyl(g, r * 1.12, r * 1.17, 1.5, M.plinth, 0, 0.75, 0, segments);
  cyl(g, r * 1.01, r * 1.01, 0.4, M.trim, 0, h * 0.63, 0, segments);
  cyl(g, r * 1.13, r * 0.96, 1.15, M.trim, 0, h - 0.35, 0, segments); // corbel table
  g.add(ringMerlons(r * 1.04, h + 0.22, Math.round((2 * Math.PI * r) / 2.05), M.tower, { w: 1.35, t: 0.6, h: 1.5 }));

  const roof = new THREE.Mesh(new THREE.ConeGeometry(r * 1.04, roofH, segments), M.roof);
  roof.position.y = h + 0.55 + roofH / 2;
  roof.castShadow = true;
  roof.receiveShadow = true;
  g.add(roof);

  // eave band + finial
  cyl(g, r * 1.05, r * 1.07, 0.28, M.iron, 0, h + 0.55, 0, segments);
  cyl(g, 0.05, 0.05, 1.5, M.iron, 0, h + roofH + 1.0, 0, 8);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), M.iron);
  ball.position.y = h + 0.6 + roofH + 0.55;
  g.add(ball);

  if (slits) {
    for (const a of [0.6, 2.2, 3.8, 5.2]) {
      slit(g, M, r * 1.0, a, h * 0.55);
      slit(g, M, r * 1.0, a + 0.9, h * 0.82);
    }
  }

  if (flag) {
    const poleY = h + 0.6 + roofH;
    cyl(g, 0.06, 0.08, 4.2, M.iron, 0, poleY + 1.6, 0, 8);
    const clothGeo = new THREE.PlaneGeometry(3.4, 1.9, 22, 12);
    clothGeo.translate(1.7, 0, 0);
    const mesh = new THREE.Mesh(clothGeo, M.flag);
    mesh.position.set(0.05, poleY + 2.6, 0);
    mesh.castShadow = true;
    g.add(mesh);
    cloth.push({ mesh, w: 3.4, h: 1.9, kind: 'flag', amp: 0.3, speed: 5.2 });
  }
  return g;
}

export function buildCastle(M) {
  const group = new THREE.Group();
  const cloth = [];
  const torches = [];
  const chimneys = [];

  const COURT = 19, WALL_H = 9, WALL_T = 2.4;

  // ---------------------------------------------------------- curtain walls
  for (const s of [-1, 1]) {
    // north/south walls (run along x)
    box(group, COURT * 2, WALL_H, WALL_T, M.wall, 0, WALL_H / 2, s * COURT);
    box(group, COURT * 2 + 1, 1.3, WALL_T + 0.8, M.plinth, 0, 0.65, s * COURT);
    box(group, COURT * 2, 1.0, 0.45, M.trim, 0, WALL_H + 0.5, s * (COURT - WALL_T / 2 + 0.15));
    const m = merlonRun(COURT * 2 - 0.6, WALL_H, M.tower, { w: 1.2, gap: 1.0, h: 1.2 });
    m.position.set(0, 0, s * (COURT + WALL_T / 2 - 0.3));
    group.add(m);

    // east/west walls (run along z)
    box(group, WALL_T, WALL_H, COURT * 2, M.wall, s * COURT, WALL_H / 2, 0);
    box(group, WALL_T + 0.8, 1.3, COURT * 2 + 1, M.plinth, s * COURT, 0.65, 0);
    box(group, 0.45, 1.0, COURT * 2, M.trim, s * (COURT - WALL_T / 2 + 0.15), WALL_H + 0.5, 0);
    const m2 = merlonRun(COURT * 2 - 0.6, WALL_H, M.tower, { w: 1.2, gap: 1.0, h: 1.2 });
    m2.rotation.y = Math.PI / 2;
    m2.position.set(s * (COURT + WALL_T / 2 - 0.3), 0, 0);
    group.add(m2);

    // buttresses (north face and both side walls) + arrow slits
    if (s < 0) {
      for (const u of [-13, -6.5, 6.5, 13]) {
        box(group, 1.5, 5.4, 0.8, M.plinth, u, 2.7, s * (COURT + WALL_T / 2 + 0.3));
        box(group, 1.95, 0.5, 1.2, M.trim, u, 5.55, s * (COURT + WALL_T / 2 + 0.45));
      }
    }
    for (const u of [-13, -6.5, 6.5, 13]) {
      box(group, 0.8, 5.4, 1.5, M.plinth, s * (COURT + WALL_T / 2 + 0.3), 2.7, u);
      box(group, 1.2, 0.5, 1.95, M.trim, s * (COURT + WALL_T / 2 + 0.45), 5.55, u);
    }
    for (const u of [-9.6, 9.6, -16.2, 16.2]) {
      if (s > 0 && Math.abs(u) < 9) continue;
      box(group, 0.3, 1.8, 0.3, M.iron, u, 6.4, s * (COURT + WALL_T / 2 + 0.04));
    }
    for (const u of [-9.6, 9.6, -16.2, 16.2]) {
      box(group, 0.3, 1.8, 0.3, M.iron, s * (COURT + WALL_T / 2 + 0.04), 6.4, u);
    }
  }

  // corner towers
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      group.add(roundTower(M, {
        x: sx * COURT, z: sz * COURT, r: 4.4, h: 15.6, roofH: 7.8, cloth,
        flag: !(sx < 0 && sz < 0)
      }));
    }
  }

  // ---------------------------------------------------------- gatehouse
  const GZ = COURT; // 19
  const gateGeo = (() => {
    const s = new THREE.Shape();
    s.moveTo(-6.45, 0); s.lineTo(6.45, 0); s.lineTo(6.45, 13.6); s.lineTo(-6.45, 13.6); s.closePath();
    const hole = new THREE.Path();
    hole.moveTo(-3.05, 0); hole.lineTo(-3.05, 4.5);
    hole.absarc(0, 4.5, 3.05, Math.PI, 0, true);
    hole.lineTo(3.05, 0); hole.closePath();
    s.holes.push(hole);
    const g = new THREE.ExtrudeGeometry(s, { depth: 4.6, bevelEnabled: false, curveSegments: 28 });
    g.translate(0, 0, -2.3);
    return g;
  })();
  const gateWall = new THREE.Mesh(gateGeo, M.gate);
  gateWall.position.set(0, 0, GZ);
  gateWall.castShadow = true; gateWall.receiveShadow = true;
  group.add(gateWall);

  // voussoir arch + jambs around the gate opening
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.06, 0.3, 10, 44, Math.PI), M.trim);
    ring.position.set(0, 4.5, GZ + 2.34);
    group.add(ring);
    for (const sx of [-1, 1]) {
      box(group, 0.62, 4.5, 0.5, M.trim, sx * 3.06, 2.25, GZ + 2.32);
    }
    for (const sx of [-1, 1]) {
      box(group, 0.26, 1.5, 0.16, M.iron, sx * 4.55, 10.3, GZ + 2.32);
    }
  }

  // corbel / machicolation row and parapet
  for (let i = -5; i <= 5; i++) {
    box(group, 0.55, 0.9, 0.5, M.trim, i * 1.12, 12.6, GZ + 2.35);
  }
  box(group, 12.9, 0.4, 4.9, M.trim, 0, 13.2, GZ);
  const gm = merlonRun(12.1, 13.4, M.tower, { w: 1.25, gap: 1.0, h: 1.25 });
  gm.position.set(0, 0, GZ + 2.3);
  group.add(gm);

  // gate towers
  for (const sx of [-1, 1]) {
    group.add(roundTower(M, {
      x: sx * 6.65, z: GZ, r: 3.25, h: 15.4, roofH: 6.8, cloth, flag: sx > 0
    }));
  }

  // portcullis (half raised)
  const pc = new THREE.Group();
  for (let i = -4; i <= 4; i++) {
    box(pc, 0.12, 3.4, 0.12, M.iron, i * 0.62, 6.4, 0);
  }
  for (const yy of [4.9, 6.3, 7.7]) box(pc, 5.1, 0.13, 0.15, M.iron, 0, yy, 0);
  pc.position.set(0, 0, GZ - 1.25);
  group.add(pc);

  // timber doors, swung inward
  for (const sx of [-1, 1]) {
    const hinge = new THREE.Group();
    hinge.position.set(sx * 2.85, 0, GZ + 0.55);
    hinge.rotation.y = sx * 1.42;
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(2.7, 5.6, 0.22), M.woodDark);
    leaf.position.set(-sx * 1.35, 2.8, 0);
    leaf.castShadow = true; leaf.receiveShadow = true;
    hinge.add(leaf);
    for (const yy of [0.9, 2.8, 4.7]) {
      const band = new THREE.Mesh(new THREE.BoxGeometry(2.75, 0.17, 0.06), M.iron);
      band.position.set(-sx * 1.35, yy, 0.14);
      hinge.add(band);
    }
    group.add(hinge);
  }

  // gate torches
  for (const sx of [-1, 1]) {
    torches.push(addTorch(group, M, sx * 3.75, 4.9, GZ + 2.4, 0));
  }

  // hanging banner over the gate
  {
    const pole = box(group, 8.6, 0.16, 0.16, M.iron, 0, 12.2, GZ + 2.55);
    const g2 = new THREE.PlaneGeometry(2.9, 3.9, 18, 18);
    g2.translate(0, -1.95, 0);
    const b = new THREE.Mesh(g2, M.banner);
    b.position.set(0, 11.95, GZ + 2.62);
    b.castShadow = true;
    group.add(b);
    cloth.push({ mesh: b, w: 2.9, h: 3.9, kind: 'banner', amp: 0.14, speed: 2.2 });
  }

  // ---------------------------------------------------------- keep
  const keep = new THREE.Group();
  keep.position.set(0, 0, -2);
  group.add(keep);

  const KH = 26, KW = 16;
  box(keep, KW + 2.2, 1.5, KW + 2.2, M.plinth, 0, 0.75, 0);
  box(keep, KW, KH, KW, M.keep, 0, 1.5 + KH / 2, 0);
  box(keep, KW + 0.7, 0.55, KW + 0.7, M.trim, 0, 1.5 + KH * 0.46, 0);
  box(keep, KW + 1.1, 1.15, KW + 1.1, M.trim, 0, 1.5 + KH - 0.95, 0);

  // hipped lead/slate roof inside the parapet
  {
    const hip = new THREE.Mesh(new THREE.ConeGeometry(KW * 0.68, 4.6, 4), M.roof);
    hip.rotation.y = Math.PI / 4;
    hip.position.y = 1.5 + KH + 2.3;
    hip.castShadow = true;
    hip.receiveShadow = true;
    keep.add(hip);
    const ridge = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), M.iron);
    ridge.position.y = 1.5 + KH + 4.65;
    keep.add(ridge);
  }

  const ky = 1.5 + KH;
  for (const s of [-1, 1]) {
    const a = merlonRun(KW - 0.4, ky, M.tower, { w: 1.35, gap: 0.85 });
    a.position.set(0, 0, s * (KW / 2 - 0.3));
    keep.add(a);
    const b = merlonRun(KW - 0.4, ky, M.tower, { w: 1.35, gap: 0.85 });
    b.rotation.y = Math.PI / 2;
    b.position.set(s * (KW / 2 - 0.3), 0, 0);
    keep.add(b);
  }

  // corner turrets
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const t = new THREE.Group();
      t.position.set(sx * (KW / 2 - 0.4), 0, sz * (KW / 2 - 0.4));
      cyl(t, 1.85, 1.85, 17, M.tower, 0, 21.6, 0, 24);
      cyl(t, 2.35, 1.95, 1.5, M.trim, 0, 12.9, 0, 24);
      cyl(t, 2.05, 2.05, 0.4, M.trim, 0, 26.2, 0, 24);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(2.5, 4.8, 24), M.roof);
      cone.position.y = 32.6;
      cone.castShadow = true;
      t.add(cone);
      cyl(t, 0.045, 0.045, 1.3, M.iron, 0, 35.3, 0, 8);
      keep.add(t);
    }
  }

  // stair / watch turret on the west face
  {
    const t = new THREE.Group();
    t.position.set(-(KW / 2 + 0.6), 0, -0.5);
    cyl(t, 3.0, 3.35, 32, M.tower, 0, 16.0, 0, 36);
    cyl(t, 3.55, 3.15, 1.6, M.trim, 0, 31.4, 0, 36);
    cyl(t, 3.6, 3.6, 0.4, M.trim, 0, 23.0, 0, 36);
    const cone = new THREE.Mesh(new THREE.ConeGeometry(3.4, 7.2, 36), M.roof);
    cone.position.y = 35.8;
    cone.castShadow = true;
    t.add(cone);
    cyl(t, 0.06, 0.06, 1.8, M.iron, 0, 39.7, 0, 8);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), M.iron);
    ball.position.y = 40.5; t.add(ball);
    for (const a of [0.4, 1.7, 3.0, 4.4, 5.6]) slit(t, M, 3.05, a, 26);
    keep.add(t);
  }

  // keep windows
  archWindow(keep, M, { x: 0, y: 11.8, z: KW / 2 + 0.03, lit: true });
  archWindow(keep, M, { x: 0, y: 17.6, z: KW / 2 + 0.03 });
  archWindow(keep, M, { x: 0, y: 23.0, z: KW / 2 + 0.03, w: 2.2, h: 3.6 });
  for (const s of [-1, 1]) {
    archWindow(keep, M, { x: s * (KW / 2 + 0.03), y: 14.8, z: 0.5, ry: s * Math.PI / 2, lit: s > 0 });
    archWindow(keep, M, { x: s * (KW / 2 + 0.03), y: 21.4, z: -2.6, ry: s * Math.PI / 2, w: 1.4, h: 2.9 });
    archWindow(keep, M, { x: s * 3.6, y: 15.5, z: -(KW / 2 + 0.03), ry: Math.PI, w: 1.5, h: 3.1 });
  }
  archWindow(keep, M, { x: 0, y: 11.2, z: -(KW / 2 + 0.03), ry: Math.PI, w: 1.7, h: 3.2 });
  archWindow(keep, M, { x: 0, y: 21.4, z: -(KW / 2 + 0.03), ry: Math.PI, w: 2.0, h: 3.4 });

  // keep door + torches + banners
  {
    const doorMat = M.woodDark.clone();
    doorMat.map = M.woodDark.map.clone();
    doorMat.map.repeat.set(0.32, 0.32);
    doorMat.map.needsUpdate = true;
    const d = new THREE.Mesh(new THREE.ShapeGeometry(archShape(4.6, 7.0), 28), doorMat);
    d.position.set(0, 0, KW / 2 + 0.04);
    d.castShadow = true;
    keep.add(d);

    // stone door surround
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.28, 10, 32, Math.PI), M.trim);
    ring.position.set(0, 4.7, KW / 2 + 0.03);
    keep.add(ring);
    for (const sx of [-1, 1]) box(keep, 0.6, 4.9, 0.45, M.trim, sx * 2.85, 2.45, KW / 2 + 0.02);
    box(keep, 6.5, 0.5, 0.8, M.trim, 0, 0.25, KW / 2 + 0.05);

    for (const sx of [-1, 1]) torches.push(addTorch(keep, M, sx * 3.8, 6.1, KW / 2 + 0.2, 0));

    for (const sx of [-1, 1]) {
      const pole = box(keep, 2.9, 0.14, 0.14, M.iron, sx * 5.2, 24.4, KW / 2 + 0.22);
      const g2 = new THREE.PlaneGeometry(2.35, 8.6, 16, 26);
      g2.translate(0, -4.3, 0);
      const b = new THREE.Mesh(g2, M.banner);
      b.position.set(sx * 5.2, 24.2, KW / 2 + 0.24);
      b.castShadow = true;
      keep.add(b);
      cloth.push({ mesh: b, w: 2.35, h: 8.6, kind: 'banner', amp: 0.24, speed: 1.9 });
    }
  }

  // ---------------------------------------------------------- great hall
  {
    const hall = new THREE.Group();
    hall.position.set(-1, 0, -14.7);
    group.add(hall);
    const HW = 19, HD = 6.8, HH = 8.2;

    box(hall, HW, HH, HD, M.wall, 0, HH / 2, 0);
    box(hall, HW + 0.9, 1.1, HD + 0.8, M.plinth, 0, 0.55, 0);
    box(hall, HW + 0.5, 0.4, HD + 0.5, M.trim, 0, HH - 0.2, 0);

    // roof planes
    const rh = 5.0, slope = Math.atan2(rh, HD / 2), L = Math.hypot(HD / 2, rh);
    for (const s of [-1, 1]) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(HW + 1.4, 0.3, L), M.roof);
      r.position.set(0, HH + rh / 2, s * HD / 4);
      r.rotation.x = s * slope;
      r.castShadow = true; r.receiveShadow = true;
      hall.add(r);
    }
    // gable ends
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(-HD / 2, 0); sh.lineTo(HD / 2, 0); sh.lineTo(0, rh); sh.closePath();
      const gable = new THREE.Mesh(new THREE.ShapeGeometry(sh), M.wall);
      gable.rotation.y = s * Math.PI / 2;
      gable.position.set(s * (HW / 2 + 0.02), HH, 0);
      gable.castShadow = true;
      hall.add(gable);
    }
    box(hall, HW + 1.6, 0.3, 0.55, M.roof, 0, HH + rh + 0.1, 0);

    // windows + door on courtyard side
    for (const x of [-6, -2, 2, 6]) {
      archWindow(hall, M, { x, y: 4.1, z: HD / 2 + 0.03, w: 1.25, h: 2.8, lit: x === -2 || x === 6 });
    }
    const door = new THREE.Mesh(new THREE.ShapeGeometry(archShape(2.1, 3.6), 22), M.woodDark);
    door.position.set(0, 0, HD / 2 + 0.04);
    hall.add(door);

    // chimney
    const ch = box(hall, 1.3, 5.4, 1.3, M.plinth, 6.4, HH + 3.2, -0.4);
    box(hall, 1.7, 0.3, 1.7, M.trim, 6.4, HH + 5.9, -0.4);
    chimneys.push(new THREE.Vector3(-1 + 6.4, HH + 6.05, -14.7 - 0.4));
  }

  // ---------------------------------------------------------- courtyard props
  {
    // well
    const well = new THREE.Group();
    well.position.set(9.2, 0, 7.5);
    cyl(well, 1.5, 1.6, 1.0, M.plinth, 0, 0.5, 0, 22);
    cyl(well, 1.15, 1.15, 1.1, M.mud, 0, 0.55, 0, 20);
    for (const s of [-1, 1]) box(well, 0.22, 2.0, 0.22, M.woodDark, s * 1.25, 1.7, 0);
    box(well, 3.1, 0.16, 0.16, M.woodDark, 0, 2.6, 0);
    const wr = new THREE.Mesh(new THREE.ConeGeometry(1.85, 1.1, 4), M.roof);
    wr.rotation.y = Math.PI / 4;
    wr.position.y = 3.15;
    wr.castShadow = true;
    well.add(wr);
    group.add(well);

    // barrels
    barrelAt(M, group, 7.4, -9.4);
    barrelAt(M, group, 8.5, -9.0, 0.9);
    barrelAt(M, group, 7.9, -8.2, 0.8);
    barrelAt(M, group, -9.2, 2.4, 0.95);

    // crates
    for (const [x, z, s] of [[-9.8, 4.2, 1.0], [-8.7, 4.9, 0.8], [-9.4, 5.9, 0.7]]) {
      const c = box(group, 1.05 * s, 1.05 * s, 1.05 * s, M.wood, x, 0.53 * s, z, 0.3);
      c.rotation.y = Math.random() * 0.8;
    }
  }

  // ---------------------------------------------------------- ivy
  {
    const patch = (parent, w, h, x, y, z, ry) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), M.ivy);
      m.position.set(x, y, z);
      m.rotation.y = ry;
      m.castShadow = false;
      m.receiveShadow = true;
      parent.add(m);
    };
    patch(keep, 5.0, 7.0, -5.6, 4.6, KW / 2 + 0.07, 0);
    patch(group, 6.0, 5.5, -10.5, 3.4, -(COURT + WALL_T / 2 + 0.06), Math.PI);
    patch(group, 4.5, 6.0, 12.5, 3.6, -(COURT + WALL_T / 2 + 0.06), Math.PI);
    patch(group, 4.0, 5.0, -4.9, 3.2, GZ + 2.31, 0);
  }

  // ---------------------------------------------------------- outbuildings
  {
    const shed = new THREE.Group();
    shed.position.set(14.0, 0, -3.5);
    box(shed, 4.6, 3.8, 9.2, M.wall, 0, 1.9, 0);
    box(shed, 5.2, 1.1, 9.8, M.plinth, 0, 0.55, 0);
    for (const z of [-4.3, 0, 4.3]) {
      box(shed, 0.22, 3.9, 0.22, M.woodDark, 2.4, 1.95, z);
    }
    const r = new THREE.Mesh(new THREE.BoxGeometry(6.2, 0.28, 10.2), M.roof);
    r.position.set(0.3, 4.15, 0);
    r.rotation.z = -0.16;
    r.castShadow = true; r.receiveShadow = true;
    shed.add(r);
    group.add(shed);

    for (const [z, s] of [[2.0, 1.0], [2.9, 0.85], [-1.2, 0.9]]) {
      barrelAt(M, shed, 3.0, z, s);
    }
  }

  // warm pool of light in the gate passage
  {
    const passage = new THREE.PointLight(0xff9a4a, 7, 15, 2);
    passage.position.set(0, 3.2, GZ + 1.2);
    group.add(passage);
  }

  return { group, cloth, torches, chimneys };
}

// Torch: bracket, basket, flame sprite, point light.
function addTorch(parent, M, x, y, z, ry) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;

  box(g, 0.16, 0.9, 0.16, M.iron, 0, -0.55, 0.0);
  box(g, 0.42, 0.1, 0.42, M.iron, 0, -0.1, 0.0);
  cyl(g, 0.2, 0.14, 0.4, M.iron, 0, 0.12, 0, 8);

  const mat = new THREE.SpriteMaterial({
    map: new THREE.CanvasTexture(makeFlameTexture()),
    color: 0xff8a3c,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(0.85, 1.3, 1);
  sp.position.set(0, 0.9, 0);
  g.add(sp);

  const light = new THREE.PointLight(0xff9a45, 10, 15, 2);
  light.position.set(0, 0.9, 0.1);
  g.add(light);

  parent.add(g);
  return { sprite: sp, light, base: 10, seed: Math.random() * 100 };
}
