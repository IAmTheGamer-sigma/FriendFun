import * as THREE from 'three';
import { ITEM } from './catalog.js';
import { renderToDataURL } from './three-util.js';

const faceCache = {}, shirtCache = {};
function faceTexture(id) {
  if (faceCache[id]) return faceCache[id];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineWidth = 7; g.lineCap = 'round';
  const eyes = (h = 18) => { g.beginPath(); g.ellipse(44, 50, 7, h / 2, 0, 0, Math.PI * 2); g.ellipse(84, 50, 7, h / 2, 0, 0, Math.PI * 2); g.fill(); };
  switch (id) {
    case 'face_grin': eyes(); g.beginPath(); g.moveTo(34, 76); g.quadraticCurveTo(64, 120, 94, 76); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(40, 78, 48, 8); break;
    case 'face_cool': g.fillRect(26, 40, 34, 18); g.fillRect(68, 40, 34, 18); g.fillRect(56, 44, 16, 5); g.beginPath(); g.moveTo(44, 86); g.quadraticCurveTo(70, 100, 88, 80); g.stroke(); break;
    case 'face_wink': g.beginPath(); g.ellipse(44, 50, 7, 9, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(74, 52); g.lineTo(94, 50); g.stroke(); g.beginPath(); g.arc(64, 70, 24, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); break;
    case 'face_shock': eyes(22); g.beginPath(); g.ellipse(64, 90, 10, 14, 0, 0, Math.PI * 2); g.fill(); break;
    case 'face_mad': eyes(14); g.beginPath(); g.moveTo(32, 32); g.lineTo(54, 42); g.moveTo(96, 32); g.lineTo(74, 42); g.stroke(); g.beginPath(); g.arc(64, 104, 22, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
    default: eyes(); g.beginPath(); g.arc(64, 66, 26, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (faceCache[id] = t);
}
function shirtTexture(id) {
  if (shirtCache[id]) return shirtCache[id];
  const it = ITEM[id];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const star = (cx, cy, R, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } g.closePath(); g.fill(); };
  if (id === 'shirt_star') { g.fillStyle = it.color; star(64, 64, 40, 17); }
  else if (id === 'shirt_heart') { g.fillStyle = it.color; g.beginPath(); g.moveTo(64, 100); g.bezierCurveTo(10, 60, 30, 18, 64, 44); g.bezierCurveTo(98, 18, 118, 60, 64, 100); g.fill(); }
  else if (id === 'shirt_ff') { g.fillStyle = '#fff'; g.beginPath(); g.roundRect(24, 34, 80, 60, 12); g.fill(); g.fillStyle = '#e2231a'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('FF', 64, 78); }
  else if (id === 'shirt_stripes') { for (let y = 0; y < 128; y += 32) { g.fillStyle = '#ffffff'; g.fillRect(0, y, 128, 16); g.fillStyle = '#e53935'; g.fillRect(0, y + 16, 128, 16); } }
  else if (id === 'shirt_suit') { g.fillStyle = '#263238'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(40, 0); g.lineTo(88, 0); g.lineTo(64, 70); g.fill(); g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(58, 6); g.lineTo(70, 6); g.lineTo(72, 50); g.lineTo(64, 62); g.lineTo(56, 50); g.fill(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (shirtCache[id] = t);
}

function mat(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75 }); }
function box(w, h, d, color) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.castShadow = true; m.receiveShadow = true; return m; }

function buildHat(id) {
  const it = ITEM[id]; if (!it || id === 'hat_none') return null;
  const g = new THREE.Group(), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: id === 'hat_crown' ? 0.8 : 0 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  switch (id) {
    case 'hat_cap': add(new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), it.color, 0, 0.05); add(new THREE.BoxGeometry(1.1, 0.08, 0.6), it.color, 0, 0.05, 0.75); break;
    case 'hat_tophat': add(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24), it.color); add(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 24), it.color, 0, 0.55); add(new THREE.CylinderGeometry(0.56, 0.56, 0.18, 24), '#b71c1c', 0, 0.15); break;
    case 'hat_crown': add(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 24, 1, true), it.color, 0, 0.15); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(0.13, 0.35, 8), it.color, Math.cos(a) * 0.6, 0.48, Math.sin(a) * 0.6); } add(new THREE.SphereGeometry(0.1), '#e53935', 0, 0.15, 0.63); break;
    case 'hat_horns': { const l = add(new THREE.ConeGeometry(0.14, 0.6, 12), it.color, -0.38, 0.22); l.rotation.z = 0.4; const r = add(new THREE.ConeGeometry(0.14, 0.6, 12), it.color, 0.38, 0.22); r.rotation.z = -0.4; break; }
    case 'hat_halo': { const h = add(new THREE.TorusGeometry(0.5, 0.07, 8, 32), it.color, 0, 0.55); h.rotation.x = Math.PI / 2; h.material.emissive = new THREE.Color('#fff176'); break; }
    case 'hat_headphones': { const b = add(new THREE.TorusGeometry(0.7, 0.07, 8, 24, Math.PI), it.color, 0, -0.45); add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16).rotateZ(Math.PI / 2), '#222', -0.68, -0.6); add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16).rotateZ(Math.PI / 2), '#222', 0.68, -0.6); break; }
    case 'hat_cone': add(new THREE.ConeGeometry(0.6, 1.4, 20), it.color, 0, 0.65); add(new THREE.CylinderGeometry(0.36, 0.44, 0.22, 20), '#ffffff', 0, 0.75); add(new THREE.BoxGeometry(1.3, 0.1, 1.3), it.color, 0, 0); break;
    case 'hat_beanie': add(new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), it.color, 0, -0.05); add(new THREE.CylinderGeometry(0.69, 0.69, 0.22, 20), '#004d40', 0, 0); add(new THREE.SphereGeometry(0.18), '#ffffff', 0, 0.68); break;
  }
  return g;
}

// Returns a THREE.Group; feet at y=0, facing +z. userData.limbs = { larm, rarm, lleg, rleg, head, torso }
export function buildCharacter(avatar) {
  const C = avatar.colors;
  const suit = avatar.shirt === 'shirt_suit';
  const root = new THREE.Group();
  const torso = box(2, 2, 1, suit ? '#263238' : C.torso); torso.position.y = 3; root.add(torso);
  if (avatar.shirt && avatar.shirt !== 'shirt_none') {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ map: shirtTexture(avatar.shirt), transparent: true, roughness: 0.8 }));
    d.position.z = 0.501; torso.add(d);
  }
  const headPivot = new THREE.Group(); headPivot.position.y = 4; root.add(headPivot);
  const head = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 1.2, 24), mat(C.head)); head.position.y = 0.6; head.castShadow = true; headPivot.add(head);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: faceTexture(avatar.face), transparent: true }));
  face.position.set(0, 0.6, 0.63); headPivot.add(face);
  const hat = buildHat(avatar.hat); if (hat) { hat.position.y = 1.2; headPivot.add(hat); }
  const limb = (x, y, color) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = box(1, 2, 1, color); m.position.y = -1; p.add(m); root.add(p); return p; };
  const larm = limb(-1.5, 4, suit ? '#263238' : C.larm), rarm = limb(1.5, 4, suit ? '#263238' : C.rarm);
  const lleg = limb(-0.5, 2, C.lleg), rleg = limb(0.5, 2, C.rleg);
  root.userData.limbs = { larm, rarm, lleg, rleg, head: headPivot, torso };
  return root;
}

export function animateCharacter(ch, state, t, dt) {
  const L = ch.userData.limbs; if (!L) return;
  // rotation.x > 0 swings a limb backwards (character faces +z); arms up ~ -PI
  let la = 0, ra = 0, ll = 0, rl = 0;
  if (state === 'walk') { const s = Math.sin(t * 9) * 0.9; la = s; ra = -s; ll = -s; rl = s; }
  else if (state === 'jump' || state === 'fall') { la = ra = -Math.PI * 0.9; }
  else if (state === 'wave') { ra = -(Math.PI * 0.85 + Math.sin(t * 12) * 0.3); }
  else if (state === 'dance') { const s = Math.sin(t * 8); la = -Math.PI * 0.5 - s; ra = -Math.PI * 0.5 + s; ll = s * 0.4; rl = -s * 0.4; }
  else if (state === 'sit') { ll = rl = -Math.PI / 2; la = ra = -0.6; }
  else { const s = Math.sin(t * 2) * 0.05; la = s; ra = -s; }
  const k = Math.min(1, dt * 15);
  L.larm.rotation.x += (la - L.larm.rotation.x) * k;
  L.rarm.rotation.x += (ra - L.rarm.rotation.x) * k;
  L.lleg.rotation.x += (ll - L.lleg.rotation.x) * k;
  L.rleg.rotation.x += (rl - L.rleg.rotation.x) * k;
}

export function makeNameTag(name) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 48px "Source Sans Pro", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(name, 256, 48);
  g.fillStyle = '#fff'; g.fillText(name, 256, 48);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
  s.scale.set(6, 1.125, 1); s.position.y = 6.6; s.renderOrder = 999;
  return s;
}

// ---------- 2D avatar images ----------
const imgCache = new Map();
export function avatarImage(avatar, mode = 'headshot') {
  const k = mode + JSON.stringify(avatar);
  if (imgCache.has(k)) return imgCache.get(k);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight('#ffffff', '#888888', 1.6));
  const d = new THREE.DirectionalLight('#ffffff', 1.6); d.position.set(3, 6, 8); scene.add(d);
  const ch = buildCharacter(avatar);
  ch.rotation.y = -0.35;
  const L = ch.userData.limbs;
  L.larm.rotation.x = 0.15; L.rarm.rotation.x = -0.15; L.lleg.rotation.x = -0.1; L.rleg.rotation.x = 0.1;
  scene.add(ch);
  const cam = new THREE.PerspectiveCamera(mode === 'headshot' ? 30 : 32, 1, 0.1, 100);
  if (mode === 'headshot') { cam.position.set(0, 5, 5.2); cam.lookAt(0, 4.7, 0); }
  else { cam.position.set(0, 3.6, 12.5); cam.lookAt(0, 3, 0); }
  const url = renderToDataURL(scene, cam, mode === 'headshot' ? 150 : 300, mode === 'headshot' ? 150 : 300);
  imgCache.set(k, url);
  return url;
}
