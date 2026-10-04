import * as THREE from 'three';

// ---------- procedural textures ----------
const texCache = {};
function canvasTex(name, size, draw) {
  if (texCache[name]) return texCache[name];
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); draw(g, size);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return (texCache[name] = t);
}
function noise(g, s, base, amt, n = 4000, sz = 2) {
  g.fillStyle = base; g.fillRect(0, 0, s, s);
  for (let i = 0; i < n; i++) { const v = (Math.random() - 0.5) * amt; g.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; g.fillRect(Math.random() * s, Math.random() * s, sz, sz); }
}
const TEX = {
  plastic: { scale: 4, make: () => canvasTex('plastic', 128, (g, s) => { noise(g, s, '#f4f4f4', 0.06, 1500, 2); }) },
  baseplate: { scale: 4, make: () => canvasTex('baseplate', 128, (g, s) => { noise(g, s, '#f0f0f0', 0.05, 800); g.strokeStyle = 'rgba(0,0,0,0.18)'; g.lineWidth = 4; g.strokeRect(2, 2, s - 4, s - 4); }) },
  grass: { scale: 8, make: () => canvasTex('grass', 256, (g, s) => { noise(g, s, '#e8e8e8', 0.3, 9000, 2); }) },
  sand: { scale: 6, make: () => canvasTex('sand', 256, (g, s) => { noise(g, s, '#f2f2f2', 0.18, 12000, 1); }) },
  concrete: { scale: 8, make: () => canvasTex('concrete', 256, (g, s) => { noise(g, s, '#e6e6e6', 0.15, 6000, 3); }) },
  wood: { scale: 4, make: () => canvasTex('wood', 256, (g, s) => { g.fillStyle = '#eaeaea'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 3) { g.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.12})`; g.fillRect(0, y + Math.sin(y) * 2, s, 1 + Math.random() * 2); } g.fillStyle = 'rgba(0,0,0,0.25)'; for (let y = 0; y < s; y += 64) g.fillRect(0, y, s, 2); }) },
  brick: { scale: 4, make: () => canvasTex('brick', 256, (g, s) => { g.fillStyle = '#bdbdbd'; g.fillRect(0, 0, s, s); const bh = s / 8, bw = s / 4; for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const x = c * bw + (r % 2 ? bw / 2 : 0); g.fillStyle = `rgb(${235 + Math.random() * 20 | 0},${235 + Math.random() * 20 | 0},${235 + Math.random() * 20 | 0})`; g.fillRect(x + 3, r * bh + 3, bw - 6, bh - 6); } }) },
  metal: { scale: 4, make: () => canvasTex('metal', 256, (g, s) => { g.fillStyle = '#e0e0e0'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.3})`; g.fillRect(0, y, s, 1); } }) },
  spawn: { scale: 0, make: () => canvasTex('spawn', 256, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); g.strokeStyle = '#d0d0d0'; g.lineWidth = 18; g.beginPath(); g.arc(s / 2, s / 2, s * 0.32, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#d0d0d0'; g.beginPath(); g.arc(s / 2, s / 2, s * 0.12, 0, Math.PI * 2); g.fill(); }) },
};

const matCache = new Map();
export function partMaterial(m, color, tr = 0) {
  const k = m + '|' + color + '|' + tr;
  if (matCache.has(k)) return matCache.get(k);
  let mat;
  if (m === 'neon') mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(1.15) });
  else if (m === 'glass') mat = new THREE.MeshStandardMaterial({ color, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 1 - Math.max(tr, 0.45) });
  else {
    const t = (TEX[m] || TEX.plastic).make();
    mat = new THREE.MeshStandardMaterial({ color, map: t, roughness: m === 'metal' ? 0.35 : 0.85, metalness: m === 'metal' ? 0.6 : 0 });
  }
  if (tr > 0 && m !== 'glass') { mat.transparent = true; mat.opacity = 1 - tr; }
  matCache.set(k, mat);
  return mat;
}

export function boxGeometry(sx, sy, sz, m) {
  const g = new THREE.BoxGeometry(sx, sy, sz);
  const sc = (TEX[m] || TEX.plastic).scale;
  if (!sc) return g;
  const uv = g.attributes.uv;
  const dims = [[sz, sy], [sz, sy], [sx, sz], [sx, sz], [sx, sy], [sx, sy]];
  for (let f = 0; f < 6; f++) for (let v = 0; v < 4; v++) {
    const i = f * 4 + v;
    uv.setXY(i, uv.getX(i) * dims[f][0] / sc, uv.getY(i) * dims[f][1] / sc);
  }
  return g;
}

const coinGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.25, 24).rotateX(Math.PI / 2);
const coinMat = new THREE.MeshStandardMaterial({ color: '#ffd400', emissive: '#a07800', metalness: 0.7, roughness: 0.3 });

export function makePartMesh(p) {
  let mesh;
  if (p.k === 'coin') {
    mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.userData.spin = true;
  } else {
    mesh = new THREE.Mesh(boxGeometry(p.s[0], p.s[1], p.s[2], p.m), partMaterial(p.m, p.c, p.tr || 0));
    mesh.castShadow = !p.tr; mesh.receiveShadow = true;
  }
  mesh.position.set(p.p[0], p.p[1], p.p[2]);
  mesh.userData.part = p;
  return mesh;
}

export function setupLighting(scene, sky) {
  scene.background = new THREE.Color(sky);
  scene.fog = new THREE.Fog(sky, 250, 900);
  scene.add(new THREE.HemisphereLight('#ffffff', '#776655', 1.1));
  const sun = new THREE.DirectionalLight('#fff6e0', 2.0);
  sun.position.set(60, 120, 40);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const c = sun.shadow.camera; c.left = c.bottom = -90; c.right = c.top = 90; c.near = 1; c.far = 400;
  sun.shadow.bias = -0.0005;
  scene.add(sun); scene.add(sun.target);
  return sun;
}

export function buildWorld(scene, world) {
  const meshes = new Map();
  for (const p of world.parts) { const m = makePartMesh(p); scene.add(m); meshes.set(p.id, m); }
  return meshes;
}

export function findSpawn(world) {
  const spawns = world.parts.filter(p => p.k === 'spawn');
  if (spawns.length) { const s = spawns[(Math.random() * spawns.length) | 0]; return new THREE.Vector3(s.p[0], s.p[1] + s.s[1] / 2, s.p[2]); }
  let top = 0; for (const p of world.parts) if (Math.abs(p.p[0]) < p.s[0] / 2 && Math.abs(p.p[2]) < p.s[2] / 2) top = Math.max(top, p.p[1] + p.s[1] / 2);
  return new THREE.Vector3(0, top + 0.1, 0);
}

// ---------- offscreen snapshot renderer ----------
let snap = null;
function snapRenderer(w, h) {
  if (!snap) { snap = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, alpha: true }); snap.shadowMap.enabled = true; snap.outputColorSpace = THREE.SRGBColorSpace; }
  snap.setSize(w, h, false);
  return snap;
}
export function renderToDataURL(scene, camera, w, h, type = 'image/png') {
  const r = snapRenderer(w, h);
  camera.aspect = w / h; camera.updateProjectionMatrix();
  r.setClearColor(0x000000, 0);
  r.render(scene, camera);
  return r.domElement.toDataURL(type, 0.85);
}
export function disposeScene(scene) {
  scene.traverse(o => { if (o.geometry && o.geometry !== coinGeo) o.geometry.dispose(); });
}

export function worldThumbnail(world) {
  const scene = new THREE.Scene();
  setupLighting(scene, world.sky || '#8fc8ff');
  buildWorld(scene, world);
  const spawn = findSpawn(world);
  // aim at the centroid of non-huge parts
  const c = new THREE.Vector3(); let n = 0;
  for (const p of world.parts) if (p.s[0] < 100 && p.s[2] < 100) { c.add(new THREE.Vector3(...p.p)); n++; }
  if (n) c.divideScalar(n); else c.copy(spawn);
  const target = spawn.clone().lerp(c, 0.35);
  const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.5, 2000);
  cam.position.copy(spawn).add(new THREE.Vector3(28, 22, 34));
  cam.lookAt(target.x, target.y + 2, target.z);
  const url = renderToDataURL(scene, cam, 480, 270, 'image/jpeg');
  disposeScene(scene);
  return url;
}
