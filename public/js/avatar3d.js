import * as THREE from 'three';
import { ITEM, BADGES } from './catalog.js';
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
    case 'face_buckteeth': eyes(); g.beginPath(); g.moveTo(30, 72); g.quadraticCurveTo(64, 114, 98, 72); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(50, 78, 13, 28); g.fillRect(65, 78, 13, 28); g.fillStyle = '#e8e8e8'; g.fillRect(50, 78, 13, 7); g.fillRect(65, 78, 13, 7); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(50, 78, 13, 28); g.strokeRect(65, 78, 13, 28); g.beginPath(); g.moveTo(64, 78); g.lineTo(64, 106); g.stroke(); break;
    case 'face_beak': eyes(); g.fillStyle = '#ff9800'; g.beginPath(); g.ellipse(64, 84, 31, 14, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fb8c00'; g.beginPath(); g.ellipse(64, 91, 31, 8, 0, 0, Math.PI); g.fill(); g.strokeStyle = '#e65100'; g.lineWidth = 4; g.beginPath(); g.moveTo(35, 86); g.quadraticCurveTo(64, 93, 93, 86); g.stroke(); g.fillStyle = '#e65100'; g.beginPath(); g.ellipse(52, 78, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(76, 78, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffe0b2'; g.beginPath(); g.ellipse(48, 76, 6, 3, -0.4, 0, Math.PI * 2); g.fill(); break;
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
    case 'hat_clubhat': { add(new THREE.SphereGeometry(0.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), it.color); add(new THREE.CylinderGeometry(0.95, 0.95, 0.07, 28), it.color, 0, 0.03); const r = add(new THREE.TorusGeometry(0.66, 0.07, 6, 24, Math.PI), '#f2c200'); r.rotation.y = Math.PI / 2; break; }
    case 'hat_cone': add(new THREE.ConeGeometry(0.6, 1.4, 20), it.color, 0, 0.65); add(new THREE.CylinderGeometry(0.36, 0.44, 0.22, 20), '#ffffff', 0, 0.75); add(new THREE.BoxGeometry(1.3, 0.1, 1.3), it.color, 0, 0); break;
    case 'hat_beanie': add(new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), it.color, 0, -0.05); add(new THREE.CylinderGeometry(0.69, 0.69, 0.22, 20), '#004d40', 0, 0); add(new THREE.SphereGeometry(0.18), '#ffffff', 0, 0.68); break;
    case 'hat_bunnyears': {
      for (const sx of [-1, 1]) {
        const base = add(new THREE.CapsuleGeometry(0.17, 0.7, 6, 12), '#9e9e9e', sx * 0.3, 0.55);
        base.rotation.z = sx * -0.13;
        const tip = add(new THREE.CapsuleGeometry(0.15, 0.55, 6, 12), '#9e9e9e', sx * 0.44, 1.22);
        tip.rotation.z = sx * -0.42;
        const inner = add(new THREE.CapsuleGeometry(0.075, 0.85, 6, 12), '#f8bbd0', sx * 0.37, 0.88, 0.1);
        inner.rotation.z = sx * -0.27;
      } break; }
    case 'hat_ducktuft': {
      for (let i = -2; i <= 2; i++) { const f = add(new THREE.ConeGeometry(0.15, 0.75, 8), '#212121', i * 0.22, 0.42 - Math.abs(i) * 0.06); f.rotation.z = -i * 0.34; f.rotation.x = -0.3; }
      const ring = add(new THREE.TorusGeometry(0.72, 0.12, 10, 28), '#ffffff', 0, -1.02);
      ring.rotation.x = Math.PI / 2;
      break; }
  }
  return g;
}

function buildBugsHead(g) {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const grey = '#9e9e9e', pink = '#f8bbd0';
  const skull = add(new THREE.SphereGeometry(0.62, 24, 18), grey, 0, 0.62); skull.scale.set(1, 1.1, 0.95);
  const mz = add(new THREE.SphereGeometry(0.34, 18, 14), '#e8e8e8', 0, 0.4, 0.42); mz.scale.set(1.15, 0.8, 0.9);
  const nose = add(new THREE.SphereGeometry(0.09, 10, 8), '#212121', 0, 0.53, 0.66); nose.scale.set(1.3, 0.8, 0.7);
  add(new THREE.BoxGeometry(0.11, 0.22, 0.06), '#ffffff', -0.06, 0.2, 0.6);
  add(new THREE.BoxGeometry(0.11, 0.22, 0.06), '#ffffff', 0.06, 0.2, 0.6);
  for (const sx of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.16, 14, 12), '#ffffff', sx * 0.24, 0.92, 0.4); eye.scale.set(1, 1.25, 0.6);
    add(new THREE.SphereGeometry(0.07, 10, 8), '#212121', sx * 0.24, 0.92, 0.53);
    const ear = add(new THREE.CapsuleGeometry(0.15, 0.7, 6, 12), grey, sx * 0.28, 1.5);
    ear.rotation.z = sx * -0.18;
    const inner = add(new THREE.CapsuleGeometry(0.07, 0.5, 6, 12), pink, sx * 0.31, 1.46, 0.09);
    inner.rotation.z = sx * -0.18;
  }
}
function buildDaffyHead(g) {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const black = '#212121';
  const skull = add(new THREE.SphereGeometry(0.62, 24, 18), black, 0, 0.62); skull.scale.set(1, 1.1, 0.95);
  const bill = add(new THREE.SphereGeometry(0.3, 18, 14), '#ff9800', 0, 0.48, 0.55); bill.scale.set(1.35, 0.45, 1.0);
  add(new THREE.BoxGeometry(0.5, 0.03, 0.05), '#e65100', 0, 0.6, 0.72);
  for (const sx of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.17, 14, 12), '#ffffff', sx * 0.25, 0.98, 0.38); eye.scale.set(1, 1.2, 0.6);
    add(new THREE.SphereGeometry(0.075, 10, 8), '#212121', sx * 0.25, 0.98, 0.51);
  }
  for (let i = -2; i <= 2; i++) {
    const f = add(new THREE.ConeGeometry(0.12, 0.6 - Math.abs(i) * 0.08, 8), black, i * 0.18, 1.42);
    f.rotation.z = -i * 0.3; f.rotation.x = -0.2;
  }
  const ring = add(new THREE.TorusGeometry(0.55, 0.1, 10, 24), '#ffffff', 0, 0.02);
  ring.rotation.x = Math.PI / 2;
}
const HEADS = {
  head_bugs: { h: 1.3, custom: buildBugsHead },
  head_daffy: { h: 1.3, custom: buildDaffyHead },
  head_classic: { h: 1.2, fz: 0.63, fw: 1, geo: () => new THREE.CylinderGeometry(0.62, 0.62, 1.2, 24) },
  head_block: { h: 1.2, fz: 0.611, fw: 1.05, geo: () => new THREE.BoxGeometry(1.2, 1.2, 1.2) },
  head_round: { h: 1.36, r: 0.68, round: true, geo: () => new THREE.SphereGeometry(0.68, 28, 20) },
  head_tall: { h: 1.6, fz: 0.56, fw: 0.95, hs: 0.9, geo: () => new THREE.CylinderGeometry(0.55, 0.55, 1.6, 24) },
  head_wide: { h: 1.05, fz: 0.63, fw: 1.1, hs: 1.15, geo: () => new THREE.CylinderGeometry(0.62, 0.62, 1.05, 24).scale(1.4, 1, 1) },
};

// Returns a THREE.Group; feet at y=0, facing +z. userData.limbs = { larm, rarm, lleg, rleg, head, torso }
const BODY_SUITS = { head_bugs: '#9e9e9e', head_daffy: '#212121' };
export function buildCharacter(avatar) {
  const C = { ...avatar.colors };
  const suitColor = BODY_SUITS[avatar.head];
  if (suitColor) for (const k of Object.keys(C)) C[k] = suitColor;
  const suit = avatar.shirt === 'shirt_suit' && !suitColor;
  const root = new THREE.Group();
  const torso = box(2, 2, 1, suit ? '#263238' : C.torso); torso.position.y = 3; root.add(torso);
  if (avatar.shirt && avatar.shirt !== 'shirt_none') {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshStandardMaterial({ map: shirtTexture(avatar.shirt), transparent: true, roughness: 0.8 }));
    d.position.z = 0.501; torso.add(d);
  }
  const headPivot = new THREE.Group(); headPivot.position.y = 4; root.add(headPivot);
  const H = HEADS[avatar.head] || HEADS.head_classic;
  if (H.custom) { H.custom(headPivot); }
  else {
    const head = new THREE.Mesh(H.geo(), mat(C.head)); head.position.y = H.h / 2; head.castShadow = true; headPivot.add(head);
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(avatar.face), transparent: true });
    const face = H.round
      ? new THREE.Mesh(new THREE.SphereGeometry(H.r + 0.01, 24, 16, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.75, 1.5), faceMat)
      : new THREE.Mesh(new THREE.PlaneGeometry(H.fw, H.fw), faceMat);
    face.position.set(0, H.h / 2, H.round ? 0 : H.fz); headPivot.add(face);
  }
  const hat = buildHat(avatar.hat); if (hat) { hat.position.y = H.h; hat.scale.setScalar(H.hs || 1); headPivot.add(hat); }
  const limb = (x, y, color) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = box(1, 2, 1, color); m.position.y = -1; p.add(m); root.add(p); return p; };
  const larm = limb(-1.5, 4, suit ? '#263238' : C.larm), rarm = limb(1.5, 4, suit ? '#263238' : C.rarm);
  const lleg = limb(-0.5, 2, C.lleg), rleg = limb(0.5, 2, C.rleg);
  if (avatar.head === 'head_bugs') {
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.28, 14, 12), mat('#ffffff'));
    tail.position.set(0, 2.3, -0.62); tail.castShadow = true; root.add(tail);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.5, 0.15), mat('#f5f5f5'));
    belly.position.set(0, 2.9, 0.5); root.add(belly);
  }
  if (avatar.head === 'head_daffy') {
    for (let i = -1; i <= 1; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 8), mat('#212121'));
      f.position.set(i * 0.3, 2.2, -0.7); f.rotation.x = 1.9; f.castShadow = true; root.add(f);
    }
  }
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

export const CLUB_PATH = 'M2 17h20v3H2zM4 16a8 8 0 0 1 16 0zM10.5 7h3v5h-3z';
export function makeNameTag(name, badge) {
  const b = BADGES[badge];
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = 'bold 48px "Source Sans Pro", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const x = b ? 278 : 256;
  g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,0.6)'; g.strokeText(name, x, 48);
  g.fillStyle = '#fff'; g.fillText(name, x, 48);
  if (b) {
    const p = new Path2D(b.path);
    g.save(); g.translate(x - g.measureText(name).width / 2 - 54, 22); g.scale(2, 2);
    g.lineWidth = 3; g.stroke(p); g.fillStyle = b.color; g.fill(p); g.restore();
  }
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
