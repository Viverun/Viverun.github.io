// Materials built from the procedural texture set.
import * as THREE from 'three';
import * as TX from './textures.js';

export function buildMaterials(renderer) {
  const aniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const tex = (canvas, rx, ry, srgb = true) => {
    const t = new THREE.CanvasTexture(canvas);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.anisotropy = aniso;
    return t;
  };

  const stone = TX.makeStoneTextures();
  const roof = TX.makeRoofTextures();
  const wood = TX.makeWoodTexture(false);
  const woodDark = TX.makeWoodTexture(true);
  const grass = TX.makeGrassTexture();
  const dirt = TX.makeDirtTexture();
  const waterN = TX.makeWaterNormal();
  const banner = TX.makeBannerTexture(512, 768);
  const flag = TX.makeBannerTexture(512, 320);
  const ivy = TX.makeIvyTexture();

  const stoneMat = (rx, ry, color = 0xffffff, o = {}) => new THREE.MeshStandardMaterial({
    map: tex(stone.color, rx, ry),
    normalMap: tex(stone.normal, rx, ry, false),
    normalScale: new THREE.Vector2(o.ns ?? 0.85, o.ns ?? 0.85),
    color,
    roughness: o.roughness ?? 0.94,
    metalness: 0,
    envMapIntensity: o.env ?? 0.55
  });

  const M = {
    // --- masonry
    wall:     stoneMat(9, 2.4, 0xd9d4c6),
    tower:    stoneMat(6, 3.0, 0xe4dfd2),
    keep:     stoneMat(5, 5.4, 0xdcd6c9),
    trim:     stoneMat(3, 0.9, 0xf0ebdd, { roughness: 0.86 }),
    plinth:   stoneMat(7, 1.1, 0xb9b3a5),
    gate:     stoneMat(0.26, 0.26, 0xd8d2c4),   // extrude UVs are in metres
    ruin:     stoneMat(4, 2, 0xc3bdb0),

    // --- roofing
    roof: new THREE.MeshStandardMaterial({
      map: tex(roof.color, 4.6, 3.4),
      normalMap: tex(roof.normal, 4.6, 3.4, false),
      normalScale: new THREE.Vector2(1.5, 1.5),
      color: 0xb9c2cc,
      roughness: 0.58, metalness: 0.07, envMapIntensity: 0.7
    }),

    // --- timber / iron / glass
    wood: new THREE.MeshStandardMaterial({
      map: tex(wood, 2, 1), roughness: 0.82, metalness: 0, envMapIntensity: 0.4
    }),
    woodDark: new THREE.MeshStandardMaterial({
      map: tex(woodDark, 2, 1), color: 0xb8a898, roughness: 0.85, metalness: 0
    }),
    iron: new THREE.MeshStandardMaterial({
      color: 0x1a1c1f, roughness: 0.42, metalness: 0.85, envMapIntensity: 1.2
    }),
    glass: new THREE.MeshStandardMaterial({
      color: 0x121a23, roughness: 0.16, metalness: 0.45,
      emissive: 0x0b1119, emissiveIntensity: 0.6, envMapIntensity: 1.6
    }),
    glassLit: new THREE.MeshStandardMaterial({
      color: 0x2a2014, roughness: 0.28, metalness: 0.2,
      emissive: 0xff9a3c, emissiveIntensity: 1.0, envMapIntensity: 0.5
    }),

    // --- landscape
    grass: new THREE.MeshStandardMaterial({
      map: tex(grass.color, 0.055, 0.055),
      normalMap: tex(grass.normal, 0.07, 0.07, false),
      normalScale: new THREE.Vector2(0.7, 0.7),
      color: 0xb2b795,
      roughness: 1, metalness: 0, envMapIntensity: 0.3
    }),
    dirt: new THREE.MeshStandardMaterial({
      map: tex(dirt.color, 0.18, 0.18),
      normalMap: tex(dirt.normal, 0.18, 0.18, false),
      normalScale: new THREE.Vector2(0.8, 0.8),
      roughness: 1, metalness: 0
    }),
    mud: new THREE.MeshStandardMaterial({ color: 0x2b2620, roughness: 1 }),
    hill: new THREE.MeshStandardMaterial({ color: 0x36452f, roughness: 1 }),

    // --- water
    water: new THREE.MeshPhysicalMaterial({
      color: 0x1f3a36,
      roughness: 0.24,
      metalness: 0.0,
      transparent: true,
      opacity: 0.97,
      normalMap: tex(waterN, 11, 11, false),
      normalScale: new THREE.Vector2(0.75, 0.75),
      envMapIntensity: 0.95,
      clearcoat: 0.55,
      clearcoatRoughness: 0.14
    }),

    // --- cloth / foliage
    banner: new THREE.MeshStandardMaterial({
      map: tex(banner, 1, 1), roughness: 0.92, side: THREE.DoubleSide,
      envMapIntensity: 0.3
    }),
    flag: new THREE.MeshStandardMaterial({
      map: tex(flag, 1, 1), roughness: 0.92, side: THREE.DoubleSide,
      envMapIntensity: 0.3
    }),
    ivy: new THREE.MeshStandardMaterial({
      map: tex(TX.makeIvyTexture(), 1, 1), alphaTest: 0.3, side: THREE.DoubleSide,
      roughness: 0.9, transparent: false
    }),
    leaf: new THREE.MeshStandardMaterial({ color: 0x344a28, roughness: 0.94 }),
    leaf2: new THREE.MeshStandardMaterial({ color: 0x415a2f, roughness: 0.94 }),
    bark: new THREE.MeshStandardMaterial({ color: 0x3a2b1f, roughness: 0.96 }),

    textures: { stone, roof, banner, flag, ivy, waterN }
  };

  return M;
}
