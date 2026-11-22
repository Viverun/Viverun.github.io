// Scene assembly, lighting, atmosphere and the render loop.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

import { buildMaterials } from './materials.js';
import { buildCastle } from './castle.js';
import { buildScenery, buildClouds } from './scenery.js';
import { makeCloudTexture, makeSoftTexture, rng } from './textures.js';

const params = new URLSearchParams(location.search);
const still = params.has('still');

// ---------------------------------------------------------------- renderer
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.9;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0x9cb2c4, 0.00092);

const camera = new THREE.PerspectiveCamera(41, innerWidth / innerHeight, 0.5, 4000);

// ---------------------------------------------------------------- sky + sun
const elevation = 18, azimuth = 62;
const sunDir = new THREE.Vector3().setFromSphericalCoords(
  1,
  THREE.MathUtils.degToRad(90 - elevation),
  THREE.MathUtils.degToRad(azimuth)
);

const sky = new Sky();
sky.scale.setScalar(3200);
{
  const u = sky.material.uniforms;
  u.turbidity.value = 1.2;
  u.rayleigh.value = 3.2;
  u.mieCoefficient.value = 0.0008;
  u.mieDirectionalG.value = 0.72;
  u.sunPosition.value.copy(sunDir);
}
scene.add(sky);

// ---------------------------------------------------------------- materials
const M = buildMaterials(renderer);

// environment map from the same sky (gives the PBR materials something to reflect)
{
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const sky2 = new Sky();
  sky2.scale.setScalar(4000);
  for (const k in sky.material.uniforms) {
    if (sky2.material.uniforms[k]) sky2.material.uniforms[k].value = sky.material.uniforms[k].value;
  }
  envScene.add(sky2);
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(3000, 32),
    new THREE.MeshBasicMaterial({ color: 0x39432e })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -8;
  envScene.add(ground);

  const env = pmrem.fromScene(envScene, 0.03, 0.1, 20000);
  scene.environment = env.texture;
  scene.environmentIntensity = 0.55;
  pmrem.dispose();
}

// ---------------------------------------------------------------- lights
const sun = new THREE.DirectionalLight(0xffdcae, 3.45);
sun.position.copy(sunDir).multiplyScalar(170);
sun.castShadow = true;
sun.shadow.mapSize.set(4096, 4096);
sun.shadow.camera.left = -72;
sun.shadow.camera.right = 72;
sun.shadow.camera.top = 78;
sun.shadow.camera.bottom = -72;
sun.shadow.camera.near = 30;
sun.shadow.camera.far = 420;
sun.shadow.bias = -0.00035;
sun.shadow.normalBias = 0.035;
scene.add(sun, sun.target);

scene.add(new THREE.HemisphereLight(0x8fb0cf, 0x3d4630, 0.5));

const fill = new THREE.DirectionalLight(0x9bbbe0, 0.24);
fill.position.set(-sunDir.x * 120, 60, -sunDir.z * 120);
scene.add(fill);

// ---------------------------------------------------------------- world
const castle = buildCastle(M);
scene.add(castle.group);

const scenery = buildScenery(M);
scene.add(scenery.group);

const cloudCanvas = makeCloudTexture();
const clouds = buildClouds(cloudCanvas);
scene.add(clouds.group);

// uphill ground mist
{
  const mistTex = new THREE.CanvasTexture(makeSoftTexture('rgba(255,255,255,.55)', 'rgba(255,255,255,0)'));
  const mist = new THREE.SpriteMaterial({
    map: mistTex, transparent: true, opacity: 0.1, depthWrite: false, color: 0xdfe9f2
  });
  for (let i = 0; i < 10; i++) {
    const s = new THREE.Sprite(mist.clone());
    const a = Math.random() * Math.PI * 2;
    const r = 90 + Math.random() * 160;
    s.position.set(Math.cos(a) * r, 1.5 + Math.random() * 3, Math.sin(a) * r);
    s.scale.set(120 + Math.random() * 90, 16 + Math.random() * 14, 1);
    s.material.opacity = 0.035 + Math.random() * 0.05;
    scene.add(s);
  }
}

// ---------------------------------------------------------------- smoke
const smoke = [];
{
  const R = rng(808);
  const tex = new THREE.CanvasTexture(makeSoftTexture('rgba(215,215,215,.8)', 'rgba(215,215,215,0)'));
  for (const c of castle.chimneys) {
    for (let i = 0; i < 20; i++) {
      const mat = new THREE.SpriteMaterial({
        map: tex, transparent: true, depthWrite: false,
        color: 0xa8a8a4, opacity: 0
      });
      const sp = new THREE.Sprite(mat);
      sp.position.copy(c);
      scene.add(sp);
      smoke.push({
        sprite: sp,
        origin: c.clone(),
        age: (i / 20) * 9 + R() * 0.5,
        life: 8 + R() * 5,
        seed: R() * 20
      });
    }
  }
}

// ---------------------------------------------------------------- birds
const birds = [];
{
  const mat = new THREE.MeshBasicMaterial({ color: 0x252b2f, side: THREE.DoubleSide });
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const wingGeo = new THREE.PlaneGeometry(1.05, 0.34);
    wingGeo.translate(0.52, 0, 0);
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      const w = new THREE.Mesh(wingGeo, mat);
      w.rotation.x = -Math.PI / 2;
      pivot.add(w);
      if (s < 0) pivot.rotation.y = Math.PI;
      g.add(pivot);
      pivot.userData.side = s;
      if (!g.userData.wings) g.userData.wings = [];
      g.userData.wings.push(pivot);
    }
    scene.add(g);
    birds.push({
      group: g,
      radius: 45 + Math.random() * 45,
      height: 42 + Math.random() * 22,
      speed: 0.055 + Math.random() * 0.045,
      phase: Math.random() * Math.PI * 2
    });
  }
}

// ---------------------------------------------------------------- controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 12.5, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.055;
controls.autoRotate = !still;
controls.autoRotateSpeed = 0.28;
controls.minDistance = 46;
controls.maxDistance = 240;
controls.minPolarAngle = 0.28;
controls.maxPolarAngle = Math.PI * 0.495;
controls.enablePan = false;

const camAz = params.has('az') ? (+params.get('az') * Math.PI) / 180 : 0.42;
const camR = params.has('r') ? +params.get('r') : 104;
const camH = params.has('h') ? +params.get('h') : 36;
camera.position.set(Math.sin(camAz) * camR, camH, Math.cos(camAz) * camR);
controls.update();

if (still) controls.autoRotate = false;

// ---------------------------------------------------------------- post
const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, {
  type: THREE.HalfFloatType,
  samples: 4
});
const composer = new EffectComposer(renderer, rt);
composer.setSize(innerWidth, innerHeight);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.22, 0.6, 0.9);
composer.addPass(bloom);
composer.addPass(new OutputPass());

// ---------------------------------------------------------------- animation
const clock = new THREE.Clock();
const baseCloth = new WeakMap();

function updateCloth(list, t) {
  for (const c of list) {
    const geo = c.mesh.geometry;
    const pos = geo.attributes.position;
    let base = baseCloth.get(geo);
    if (!base) { base = pos.array.slice(); baseCloth.set(geo, base); }
    const n = pos.count;
    for (let i = 0; i < n; i++) {
      const bx = base[i * 3], by = base[i * 3 + 1];
      let z;
      if (c.kind === 'flag') {
        const k = Math.max(0, bx / c.w);
        z = Math.sin(bx * 1.7 - t * c.speed + by * 0.55) * c.amp * k
          + Math.sin(by * 2.6 + t * 4.1) * 0.055 * k;
      } else {
        const k = Math.max(0, -by / c.h);
        z = Math.sin(by * 1.25 + t * c.speed) * c.amp * k
          + Math.sin(bx * 1.1 - t * 1.6) * c.amp * 0.38 * k;
      }
      pos.array[i * 3 + 2] = z;
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
  }
}

let firstFrame = true;

function tick() {
  const dt = Math.min(0.05, clock.getDelta());
  const t = clock.elapsedTime;

  updateCloth(castle.cloth, t);

  // water shimmer
  const nm = M.water.normalMap;
  nm.offset.x = t * 0.006;
  nm.offset.y = Math.sin(t * 0.05) * 0.02 + t * 0.002;

  // torches
  for (const tr of castle.torches) {
    const flick = 0.72 + 0.18 * Math.sin(t * 11 + tr.seed) + 0.1 * Math.sin(t * 23 + tr.seed * 2);
    tr.light.intensity = tr.base * flick;
    tr.sprite.scale.set(0.8 + 0.1 * flick, 1.2 + 0.2 * flick, 1);
  }

  // smoke
  for (const p of smoke) {
    p.age += dt;
    if (p.age > p.life) p.age = 0;
    const k = p.age / p.life;
    p.sprite.position.set(
      p.origin.x + Math.sin(p.seed + k * 5) * (1.2 + k * 5) + k * 3,
      p.origin.y + k * 26,
      p.origin.z + Math.cos(p.seed + k * 4) * (1.0 + k * 4)
    );
    const s = 1.0 + k * 7.5;
    p.sprite.scale.set(s, s * 0.9, 1);
    p.sprite.material.opacity = Math.sin(Math.PI * Math.min(1, k * 1.15)) * 0.085 * (1 - k * 0.4);
  }

  // windmill sails
  for (const s of scenery.spinners) s.obj.rotation.z = t * s.speed;

  // clouds
  for (const c of clouds.clouds) {
    c.sprite.position.x += c.speed * dt;
    if (c.sprite.position.x > 620) c.sprite.position.x = -620;
  }

  // birds
  for (const b of birds) {
    const a = b.phase + t * b.speed;
    b.group.position.set(Math.cos(a) * b.radius, b.height + Math.sin(t * 0.7 + b.phase) * 2.4, Math.sin(a) * b.radius);
    b.group.rotation.y = -a;
    const flap = Math.sin(t * 9 + b.phase) * 0.55;
    for (const w of b.group.userData.wings) w.rotation.z = w.userData.side > 0 ? flap : -flap;
  }

  controls.update();
  composer.render();

  if (firstFrame) {
    firstFrame = false;
    document.getElementById('loader').classList.add('done');
    setTimeout(() => document.getElementById('hud').classList.add('dim'), 7000);
    window.__castleReady = true;
    window.__castleInfo = {
      triangles: renderer.info.render.triangles,
      calls: renderer.info.render.calls
    };
  }
}

renderer.setAnimationLoop(tick);

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.setSize(innerWidth, innerHeight);
});
