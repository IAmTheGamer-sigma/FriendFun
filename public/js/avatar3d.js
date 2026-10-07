import * as THREE from 'three';
import { ITEM, BADGES, PET_MODELS, GEAR_MODELS } from './catalog.js?v=80abb485';
import { renderToDataURL } from './three-util.js?v=ac3e6f2b';

const faceCache = {}, shirtCache = {};
function faceTexture(id) {
  if (faceCache[id]) return faceCache[id];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#111'; g.strokeStyle = '#111'; g.lineWidth = 7; g.lineCap = 'round';
  const st = id.slice(5).split('_')[0];
  const eyes = (h = 18) => { g.beginPath(); g.ellipse(44, 50, 7, h / 2, 0, 0, Math.PI * 2); g.ellipse(84, 50, 7, h / 2, 0, 0, Math.PI * 2); g.fill(); };
  const smile = (y = 66, r = 26) => { g.beginPath(); g.arc(64, y, r, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); };
  const closedHappy = () => { g.beginPath(); g.arc(44, 56, 10, 1.15 * Math.PI, 1.85 * Math.PI); g.arc(84, 56, 10, 1.15 * Math.PI, 1.85 * Math.PI); g.stroke(); };
  const heart = (x, y, s) => { g.beginPath(); g.moveTo(x, y + s); g.bezierCurveTo(x - s * 1.6, y, x - s * 0.7, y - s * 1.4, x, y - s * 0.5); g.bezierCurveTo(x + s * 0.7, y - s * 1.4, x + s * 1.6, y, x, y + s); g.fill(); };
  switch (st) {
    case 'grin': eyes(); g.beginPath(); g.moveTo(34, 76); g.quadraticCurveTo(64, 120, 94, 76); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(40, 78, 48, 8); break;
    case 'cool': g.fillRect(26, 40, 34, 18); g.fillRect(68, 40, 34, 18); g.fillRect(56, 44, 16, 5); g.beginPath(); g.moveTo(44, 86); g.quadraticCurveTo(70, 100, 88, 80); g.stroke(); break;
    case 'wink': g.beginPath(); g.ellipse(44, 50, 7, 9, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(74, 52); g.lineTo(94, 50); g.stroke(); g.beginPath(); g.arc(64, 70, 24, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke(); break;
    case 'shock': eyes(22); g.beginPath(); g.ellipse(64, 90, 10, 14, 0, 0, Math.PI * 2); g.fill(); break;
    case 'mad': eyes(14); g.beginPath(); g.moveTo(32, 32); g.lineTo(54, 42); g.moveTo(96, 32); g.lineTo(74, 42); g.stroke(); g.beginPath(); g.arc(64, 104, 22, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
    case 'buckteeth': eyes(); g.beginPath(); g.moveTo(30, 72); g.quadraticCurveTo(64, 114, 98, 72); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(50, 78, 13, 28); g.fillRect(65, 78, 13, 28); g.fillStyle = '#e8e8e8'; g.fillRect(50, 78, 13, 7); g.fillRect(65, 78, 13, 7); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(50, 78, 13, 28); g.strokeRect(65, 78, 13, 28); g.beginPath(); g.moveTo(64, 78); g.lineTo(64, 106); g.stroke(); break;
    case 'beak': eyes(); g.fillStyle = '#ff9800'; g.beginPath(); g.ellipse(64, 84, 31, 14, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fb8c00'; g.beginPath(); g.ellipse(64, 91, 31, 8, 0, 0, Math.PI); g.fill(); g.strokeStyle = '#e65100'; g.lineWidth = 4; g.beginPath(); g.moveTo(35, 86); g.quadraticCurveTo(64, 93, 93, 86); g.stroke(); g.fillStyle = '#e65100'; g.beginPath(); g.ellipse(52, 78, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(76, 78, 3.2, 4.5, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#ffe0b2'; g.beginPath(); g.ellipse(48, 76, 6, 3, -0.4, 0, Math.PI * 2); g.fill(); break;
    case 'fangs': eyes(); g.strokeStyle = '#111'; g.lineWidth = 7; g.beginPath(); g.moveTo(32, 72); g.quadraticCurveTo(64, 98, 96, 70); g.stroke(); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(48, 76); g.lineTo(57, 76); g.lineTo(52.5, 100); g.closePath(); g.fill(); g.beginPath(); g.moveTo(71, 76); g.lineTo(80, 76); g.lineTo(75.5, 100); g.closePath(); g.fill(); g.fillStyle = '#c62828'; g.beginPath(); g.arc(52.5, 100, 2.5, 0, Math.PI * 2); g.arc(75.5, 100, 2.5, 0, Math.PI * 2); g.fill(); break;
    case 'stitches': eyes(13); g.strokeStyle = '#111'; g.lineWidth = 5; g.beginPath(); g.moveTo(30, 78); for (let x = 30; x < 98; x += 8) { g.lineTo(x + 4, 70); g.lineTo(x + 8, 78); } g.stroke(); g.lineWidth = 3; g.strokeStyle = '#6d4c41'; for (let x = 36; x <= 92; x += 14) { g.beginPath(); g.moveTo(x, 68); g.lineTo(x, 88); g.stroke(); } break;
    case '3dglasses': g.fillStyle = '#e53935'; g.fillRect(28, 40, 32, 20); g.fillStyle = '#26c6da'; g.fillRect(68, 40, 32, 20); g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(28, 40, 32, 20); g.strokeRect(68, 40, 32, 20); smile(); break;
    case 'alien': g.beginPath(); g.ellipse(40, 48, 10, 18, -0.4, 0, Math.PI * 2); g.ellipse(88, 48, 10, 18, 0.4, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(64, 92, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); break;
    case 'angel': closedHappy(); smile(72, 18); g.strokeStyle = '#ffd400'; g.lineWidth = 5; g.beginPath(); g.arc(64, 22, 16, 0, Math.PI * 2); g.stroke(); break;
    case 'angry': eyes(12); g.lineWidth = 9; g.beginPath(); g.moveTo(30, 30); g.lineTo(56, 42); g.moveTo(98, 30); g.lineTo(72, 42); g.stroke(); g.lineWidth = 7; g.beginPath(); g.arc(64, 108, 20, 1.25 * Math.PI, 1.75 * Math.PI); g.stroke(); break;
    case 'bandit': g.fillStyle = '#111'; g.fillRect(24, 38, 80, 26); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(44, 51, 8, 6, 0, 0, Math.PI * 2); g.ellipse(84, 51, 8, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(52, 84); g.quadraticCurveTo(76, 96, 92, 78); g.stroke(); break;
    case 'beard': eyes(); smile(); g.fillStyle = '#6d4c41'; g.beginPath(); g.moveTo(30, 70); g.quadraticCurveTo(64, 128, 98, 70); g.quadraticCurveTo(64, 92, 30, 70); g.fill(); break;
    case 'blush': eyes(); smile(); g.fillStyle = '#f48fb1'; g.beginPath(); g.arc(32, 66, 9, 0, Math.PI * 2); g.arc(96, 66, 9, 0, Math.PI * 2); g.fill(); break;
    case 'clown': eyes(); g.fillStyle = '#e53935'; g.beginPath(); g.arc(64, 62, 10, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(30, 70, 8, 0, Math.PI * 2); g.arc(98, 70, 8, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#e53935'; g.lineWidth = 6; g.beginPath(); g.arc(64, 66, 30, 0.25 * Math.PI, 0.75 * Math.PI); g.stroke(); break;
    case 'coolwink': g.fillRect(26, 40, 34, 18); g.fillRect(68, 40, 34, 18); g.fillRect(56, 44, 16, 5); g.beginPath(); g.moveTo(50, 88); g.quadraticCurveTo(74, 98, 90, 80); g.stroke(); break;
    case 'cry': eyes(); g.fillStyle = '#29b6f6'; g.beginPath(); g.moveTo(38, 58); g.quadraticCurveTo(44, 78, 38, 92); g.quadraticCurveTo(32, 78, 38, 58); g.fill(); g.beginPath(); g.moveTo(90, 58); g.quadraticCurveTo(96, 78, 90, 92); g.quadraticCurveTo(84, 78, 90, 58); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.arc(64, 100, 14, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); break;
    case 'cyclops': g.beginPath(); g.ellipse(64, 52, 14, 18, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 52, 5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; smile(); break;
    case 'demon': g.fillStyle = '#e53935'; g.beginPath(); g.ellipse(44, 50, 9, 7, -0.3, 0, Math.PI * 2); g.ellipse(84, 50, 9, 7, 0.3, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(32, 34); g.lineTo(54, 44); g.moveTo(96, 34); g.lineTo(74, 44); g.stroke(); g.beginPath(); g.arc(64, 106, 20, 1.25 * Math.PI, 1.75 * Math.PI); g.stroke(); break;
    case 'derp': g.beginPath(); g.ellipse(42, 44, 8, 10, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(86, 58, 8, 10, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.moveTo(50, 84); g.quadraticCurveTo(70, 92, 84, 82); g.stroke(); g.fillStyle = '#f48fb1'; g.fillRect(72, 84, 12, 18); break;
    case 'dizzy': g.lineWidth = 6; for (const x of [44, 84]) { g.beginPath(); g.moveTo(x - 8, 42); g.lineTo(x + 8, 58); g.moveTo(x + 8, 42); g.lineTo(x - 8, 58); g.stroke(); } g.beginPath(); g.moveTo(40, 88); for (let x = 40; x <= 88; x += 8) g.lineTo(x + 4, 84); g.stroke(); break;
    case 'eyepatch': g.beginPath(); g.ellipse(44, 50, 7, 9, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.ellipse(84, 50, 14, 12, 0, 0, Math.PI * 2); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 5; g.beginPath(); g.moveTo(24, 34); g.lineTo(104, 66); g.stroke(); g.beginPath(); g.moveTo(52, 86); g.quadraticCurveTo(72, 94, 86, 82); g.stroke(); break;
    case 'fire': g.fillStyle = '#ff9800'; g.beginPath(); g.ellipse(44, 50, 9, 12, 0, 0, Math.PI * 2); g.ellipse(84, 50, 9, 12, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#e53935'; g.beginPath(); g.ellipse(44, 54, 4, 6, 0, 0, Math.PI * 2); g.ellipse(84, 54, 4, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(36, 80); g.quadraticCurveTo(64, 110, 92, 80); g.closePath(); g.fill(); break;
    case 'freckles': eyes(); smile(); g.fillStyle = '#8d6e63'; for (const [x, y] of [[34, 62], [42, 66], [94, 62], [86, 66], [52, 60], [76, 60]]) { g.beginPath(); g.arc(x, y, 2.5, 0, Math.PI * 2); g.fill(); } break;
    case 'ghostface': g.beginPath(); g.ellipse(46, 52, 9, 14, 0.15, 0, Math.PI * 2); g.ellipse(82, 52, 9, 14, -0.15, 0, Math.PI * 2); g.fill(); g.beginPath(); g.ellipse(64, 94, 12, 18, 0, 0, Math.PI * 2); g.fill(); break;
    case 'gold': g.strokeStyle = '#c9a227'; g.fillStyle = '#c9a227'; eyes(); g.lineWidth = 7; smile(); break;
    case 'happy': closedHappy(); g.beginPath(); g.moveTo(38, 74); g.quadraticCurveTo(64, 112, 90, 74); g.closePath(); g.fill(); break;
    case 'hearteyes': g.fillStyle = '#e53935'; heart(44, 52, 12); heart(84, 52, 12); g.fillStyle = '#111'; smile(); break;
    case 'hero': g.fillStyle = '#1565c0'; g.fillRect(26, 40, 76, 24); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(44, 52, 8, 7, 0, 0, Math.PI * 2); g.ellipse(84, 52, 8, 7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; smile(74, 20); break;
    case 'ice': g.fillStyle = '#4fc3f7'; eyes(); g.fillStyle = '#111'; smile(); g.strokeStyle = '#4fc3f7'; g.lineWidth = 4; g.beginPath(); g.moveTo(20, 20); g.lineTo(30, 30); g.moveTo(108, 20); g.lineTo(98, 30); g.stroke(); break;
    case 'laugh': closedHappy(); g.beginPath(); g.ellipse(64, 88, 20, 16, 0, 0, Math.PI * 2); g.fill(); break;
    case 'love': g.fillStyle = '#f48fb1'; heart(44, 52, 12); heart(84, 52, 12); g.fillStyle = '#111'; g.beginPath(); g.moveTo(44, 80); g.quadraticCurveTo(64, 102, 84, 80); g.stroke(); break;
    case 'money': g.fillStyle = '#43a047'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.fillText('$', 44, 60); g.fillText('$', 84, 60); g.fillStyle = '#111'; g.beginPath(); g.moveTo(36, 78); g.quadraticCurveTo(64, 112, 92, 78); g.closePath(); g.fill(); g.fillStyle = '#fff'; g.fillRect(42, 80, 44, 7); break;
    case 'monocle': eyes(); smile(); g.strokeStyle = '#c9a227'; g.lineWidth = 4; g.beginPath(); g.arc(84, 50, 16, 0, Math.PI * 2); g.stroke(); g.beginPath(); g.moveTo(96, 62); g.lineTo(104, 96); g.stroke(); break;
    case 'mustache': eyes(); smile(); g.fillStyle = '#111'; g.beginPath(); g.ellipse(48, 74, 16, 7, -0.25, 0, Math.PI * 2); g.ellipse(80, 74, 16, 7, 0.25, 0, Math.PI * 2); g.fill(); break;
    case 'nerd': g.strokeStyle = '#111'; g.lineWidth = 4; g.strokeRect(28, 38, 30, 24); g.strokeRect(70, 38, 30, 24); g.beginPath(); g.moveTo(58, 48); g.lineTo(70, 48); g.stroke(); eyes(12); g.fillStyle = '#fff'; g.fillRect(54, 76, 20, 14); g.strokeStyle = '#111'; g.lineWidth = 3; g.strokeRect(54, 76, 20, 14); g.beginPath(); g.moveTo(64, 76); g.lineTo(64, 90); g.stroke(); break;
    case 'ninja': g.fillStyle = '#111'; g.fillRect(24, 36, 80, 30); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(44, 51, 10, 7, 0, 0, Math.PI * 2); g.ellipse(84, 51, 10, 7, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.ellipse(44, 51, 4, 5, 0, 0, Math.PI * 2); g.ellipse(84, 51, 4, 5, 0, 0, Math.PI * 2); g.fill(); break;
    case 'rainbow': eyes(); const cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5']; g.lineWidth = 6; cols.forEach((cc, i) => { g.strokeStyle = cc; g.beginPath(); g.arc(64, 78, 30 - i * 6, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke(); }); break;
    case 'robot': g.fillStyle = '#78909c'; g.fillRect(34, 40, 20, 18); g.fillRect(74, 40, 20, 18); g.fillStyle = '#111'; for (let x = 40; x <= 88; x += 12) g.fillRect(x, 80, 6, 14); break;
    case 'sad': g.beginPath(); g.ellipse(44, 54, 7, 9, 0, 0, Math.PI * 2); g.ellipse(84, 54, 7, 9, 0, 0, Math.PI * 2); g.fill(); g.beginPath(); g.arc(64, 108, 22, 1.2 * Math.PI, 1.8 * Math.PI); g.stroke(); g.fillStyle = '#29b6f6'; g.beginPath(); g.arc(38, 66, 4, 0, Math.PI * 2); g.fill(); break;
    case 'sick': eyes(10); g.strokeStyle = '#43a047'; g.lineWidth = 6; g.beginPath(); g.moveTo(40, 88); for (let x = 40; x <= 88; x += 8) g.lineTo(x + 4, 92); g.stroke(); g.strokeStyle = '#111'; break;
    case 'silver': g.strokeStyle = '#9aa0a6'; g.fillStyle = '#9aa0a6'; eyes(); g.lineWidth = 7; smile(); break;
    case 'sleepy': g.beginPath(); g.moveTo(34, 52); g.lineTo(54, 52); g.moveTo(74, 52); g.lineTo(94, 52); g.stroke(); g.beginPath(); g.ellipse(64, 92, 8, 10, 0, 0, Math.PI * 2); g.stroke(); g.fillStyle = '#111'; g.font = 'bold 22px Arial'; g.fillText('z', 96, 30); break;
    case 'smile': default: eyes(); smile(); break;
    case 'stareyes': g.fillStyle = '#fdd835'; const star2 = (x, y) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? 5 : 11; g.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } g.closePath(); g.fill(); }; star2(44, 50); star2(84, 50); g.fillStyle = '#111'; smile(); break;
    case 'sus': g.beginPath(); g.ellipse(44, 52, 9, 6, 0, 0, Math.PI * 2); g.ellipse(84, 52, 9, 6, 0, 0, Math.PI * 2); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(46, 50, 2.5, 0, Math.PI * 2); g.arc(86, 50, 2.5, 0, Math.PI * 2); g.fill(); g.fillStyle = '#111'; g.beginPath(); g.moveTo(48, 88); g.lineTo(80, 88); g.stroke(); break;
    case 'terminator': g.fillStyle = '#e53935'; g.beginPath(); g.arc(44, 50, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#78909c'; g.fillRect(70, 42, 26, 16); g.fillStyle = '#111'; for (let x = 74; x <= 92; x += 9) g.fillRect(x, 78, 5, 14); g.beginPath(); g.moveTo(44, 86); g.lineTo(60, 86); g.stroke(); break;
    case 'tongue': eyes(); smile(); g.fillStyle = '#f48fb1'; g.beginPath(); g.roundRect(56, 78, 16, 26, 8); g.fill(); g.strokeStyle = '#111'; g.lineWidth = 3; g.beginPath(); g.moveTo(64, 82); g.lineTo(64, 100); g.stroke(); break;
    case 'unibrow': g.fillRect(30, 32, 68, 10); eyes(); smile(); break;
    case 'vr': g.fillStyle = '#263238'; g.beginPath(); g.roundRect(26, 36, 76, 30, 10); g.fill(); g.fillStyle = '#4fc3f7'; g.fillRect(36, 46, 56, 6); g.fillStyle = '#111'; smile(76, 22); break;
    case 'warpaint': eyes(14); g.strokeStyle = '#e53935'; g.lineWidth = 8; g.beginPath(); g.moveTo(24, 66); g.lineTo(52, 66); g.moveTo(76, 66); g.lineTo(104, 66); g.stroke(); g.strokeStyle = '#111'; g.lineWidth = 7; g.beginPath(); g.moveTo(48, 90); g.lineTo(80, 90); g.stroke(); break;
    case 'zombie': g.lineWidth = 5; g.beginPath(); g.moveTo(36, 44); g.lineTo(52, 58); g.moveTo(52, 44); g.lineTo(36, 58); g.stroke(); g.beginPath(); g.ellipse(84, 52, 8, 10, 0, 0, Math.PI * 2); g.fill(); g.lineWidth = 4; g.beginPath(); g.moveTo(44, 88); g.lineTo(84, 88); g.stroke(); g.strokeStyle = '#6d4c41'; g.lineWidth = 3; for (const x of [54, 64, 74]) { g.beginPath(); g.moveTo(x, 82); g.lineTo(x, 94); g.stroke(); } break;
    case 'zzz': g.beginPath(); g.moveTo(36, 52); g.quadraticCurveTo(44, 56, 52, 50); g.moveTo(76, 52); g.quadraticCurveTo(84, 56, 92, 50); g.stroke(); g.fillStyle = '#111'; g.font = 'bold 20px Arial'; g.fillText('z', 92, 28); g.fillText('z', 100, 48); g.beginPath(); g.ellipse(64, 92, 8, 10, 0, 0, Math.PI * 2); g.stroke(); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (faceCache[id] = t);
}

function shirtTexture(id) {
  if (shirtCache[id]) return shirtCache[id];
  const it = ITEM[id];
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  const C = (it && it.color) || '#aaaaaa';
  const st = id.slice(6).split('_')[0];
  const star = (cx, cy, R, r) => { g.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r : R; g.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad); } g.closePath(); g.fill(); };
  g.fillStyle = C; g.fillRect(0, 0, 128, 128);
  switch (st) {
    case 'star': g.fillStyle = '#fff'; star(64, 64, 40, 17); break;
    case 'heart': g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 100); g.bezierCurveTo(10, 60, 30, 18, 64, 44); g.bezierCurveTo(98, 18, 118, 60, 64, 100); g.fill(); break;
    case 'ff': g.fillStyle = '#fff'; g.beginPath(); g.roundRect(24, 34, 80, 60, 12); g.fill(); g.fillStyle = '#e2231a'; g.font = 'bold 40px Arial'; g.textAlign = 'center'; g.fillText('FF', 64, 78); break;
    case 'stripes': for (let y = 0; y < 128; y += 32) { g.fillStyle = '#ffffff'; g.fillRect(0, y, 128, 16); g.fillStyle = '#e53935'; g.fillRect(0, y + 16, 128, 16); } break;
    case 'vampcape': g.fillStyle = '#7b1e1e'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#5a1414'; g.beginPath(); g.moveTo(18, 0); g.lineTo(46, 0); g.lineTo(34, 46); g.closePath(); g.fill(); g.beginPath(); g.moveTo(110, 0); g.lineTo(82, 0); g.lineTo(94, 46); g.closePath(); g.fill(); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(64, 32, 9, 0, Math.PI * 2); g.fill(); g.fillStyle = '#7b1e1e'; g.beginPath(); g.arc(64, 32, 4, 0, Math.PI * 2); g.fill(); break;
    case 'mummy': g.fillStyle = '#e8e0c8'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#b8ab8a'; g.lineWidth = 3; for (let y = 6; y < 128; y += 18) { g.beginPath(); g.moveTo(-4, y); g.lineTo(132, y + 8); g.stroke(); g.beginPath(); g.moveTo(-4, y + 10); g.lineTo(132, y + 2); g.stroke(); } break;
    case 'suit': case 'tux': case 'goldsuit': g.fillStyle = st === 'goldsuit' ? '#c9a227' : '#263238'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(40, 0); g.lineTo(88, 0); g.lineTo(64, 70); g.fill(); g.fillStyle = '#c62828'; g.beginPath(); g.moveTo(58, 6); g.lineTo(70, 6); g.lineTo(72, 50); g.lineTo(64, 62); g.lineTo(56, 50); g.fill(); break;
    case 'camo': g.fillStyle = '#558b2f'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#33691e'; for (const [x, y, r] of [[30, 30, 18], [90, 50, 22], [50, 90, 16], [100, 100, 14]]) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#8d6e63'; g.beginPath(); g.arc(64, 60, 12, 0, Math.PI * 2); g.fill(); break;
    case 'flannel': g.fillStyle = '#b71c1c'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#212121'; g.lineWidth = 8; for (let x = 0; x < 128; x += 32) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 128); g.stroke(); } for (let y = 0; y < 128; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(128, y); g.stroke(); } break;
    case 'hawaiian': g.fillStyle = '#00838f'; g.fillRect(0, 0, 128, 128); const fl = ['#f48fb1', '#fff176', '#ffffff']; [[30, 40], [90, 30], [60, 80], [100, 95], [25, 100]].forEach(([x, y], i) => { g.fillStyle = fl[i % 3]; for (let p = 0; p < 5; p++) { const a = p / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 8, y + Math.sin(a) * 8, 6, 0, Math.PI * 2); g.fill(); } g.fillStyle = '#ff9800'; g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill(); }); break;
    case 'rainbow': case 'tiedye': const rc = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa']; rc.forEach((cc, i) => { g.fillStyle = cc; g.fillRect(0, i * 22, 128, 22); }); break;
    case 'referee': for (let x = 0; x < 128; x += 32) { g.fillStyle = '#111'; g.fillRect(x, 0, 16, 128); g.fillStyle = '#fff'; g.fillRect(x + 16, 0, 16, 128); } break;
    case 'skeleton': g.fillStyle = '#111'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#eee'; for (let y = 20; y < 120; y += 24) g.fillRect(30, y, 68, 8); g.fillRect(58, 8, 12, 112); break;
    case 'armor': g.fillStyle = '#78909c'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#546e7a'; g.fillRect(0, 0, 128, 18); g.fillRect(0, 55, 128, 18); g.fillRect(0, 92, 128, 18); g.fillStyle = '#ffd400'; g.beginPath(); g.arc(64, 40, 8, 0, Math.PI * 2); g.fill(); break;
    case 'astronaut': g.fillStyle = '#eceff1'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#ff6f00'; g.fillRect(0, 50, 128, 10); g.fillRect(0, 80, 128, 10); g.fillStyle = '#1e88e5'; g.beginPath(); g.arc(64, 28, 12, 0, Math.PI * 2); g.fill(); break;
    case 'labcoat': case 'chefcoat': g.fillStyle = '#fafafa'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#bdbdbd'; g.lineWidth = 4; g.beginPath(); g.moveTo(64, 0); g.lineTo(64, 128); g.stroke(); g.fillStyle = '#9e9e9e'; for (let y = 24; y < 128; y += 28) { g.beginPath(); g.arc(52, y, 4, 0, Math.PI * 2); g.arc(76, y, 4, 0, Math.PI * 2); g.fill(); } break;
    case 'vest': g.fillStyle = '#6d4c41'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#4e342e'; g.fillRect(56, 0, 16, 128); g.fillStyle = '#ffd400'; for (let y = 20; y < 128; y += 26) { g.beginPath(); g.arc(64, y, 5, 0, Math.PI * 2); g.fill(); } break;
    case 'scuba': g.fillStyle = '#212121'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#00acc1'; g.fillRect(48, 0, 32, 128); break;
    case 'safari': g.fillStyle = '#c5a880'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#8d6e63'; g.lineWidth = 4; g.strokeRect(24, 50, 30, 26); g.strokeRect(74, 50, 30, 26); break;
    case 'poncho': g.fillStyle = '#8d6e63'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#e53935'; g.fillRect(0, 40, 128, 12); g.fillStyle = '#fdd835'; g.fillRect(0, 76, 128, 12); break;
    case 'turtle': g.fillStyle = '#43a047'; g.fillRect(0, 0, 128, 128); g.strokeStyle = '#1b5e20'; g.lineWidth = 5; for (let y = 16; y < 128; y += 32) for (let x = 16; x < 128; x += 32) { g.strokeRect(x - 12, y - 12, 24, 24); } break;
    case 'jersey': g.fillStyle = '#fff'; g.font = 'bold 56px Arial'; g.textAlign = 'center'; g.fillText('7', 64, 88); g.fillStyle = '#e53935'; g.fillRect(0, 0, 128, 10); break;
    case 'hoodie': g.fillStyle = 'rgba(0,0,0,.25)'; g.beginPath(); g.roundRect(34, 78, 60, 34, 8); g.fill(); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(34, 70, 60, 6); break;
    case 'jacket': g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(60, 0, 8, 128); g.fillStyle = 'rgba(255,255,255,.2)'; g.fillRect(0, 0, 128, 8); break;
    case 'sweater': g.fillStyle = 'rgba(255,255,255,.25)'; g.fillRect(0, 0, 128, 14); for (let x = 8; x < 128; x += 16) { g.fillRect(x, 14, 4, 114); } break;
    case 'polo': g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.moveTo(48, 0); g.lineTo(80, 0); g.lineTo(64, 26); g.fill(); break;
    case 'dress': g.fillStyle = 'rgba(255,255,255,.3)'; g.fillRect(0, 64, 128, 10); break;
    case 'band': g.fillStyle = '#212121'; g.fillRect(0, 0, 128, 128); g.fillStyle = '#fff'; g.font = 'bold 30px Arial'; g.textAlign = 'center'; g.fillText('ROCK', 64, 74); g.strokeStyle = '#e53935'; g.lineWidth = 4; g.strokeRect(14, 40, 100, 48); break;
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return (shirtCache[id] = t);
}

function mat(color) { return new THREE.MeshStandardMaterial({ color, roughness: 0.75 }); }
function box(w, h, d, color) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat(color)); m.castShadow = true; m.receiveShadow = true; return m; }

function hatStyle(id) {
  const s = id.slice(4);
  const styles = ['tophat', 'clubhat', 'bunnyears', 'ducktuft', 'catears', 'bearears', 'foxears', 'wolfears', 'flowercrown', 'propeller', 'beanie', 'crown', 'wizard', 'pirate', 'cowboy', 'santa', 'party', 'sombrero', 'ninja', 'chef', 'ushanka', 'beret', 'detective', 'visor', 'sun', 'fez', 'frog', 'shark', 'chicken', 'pizza', 'burger', 'taco', 'donut', 'icecream', 'popcorn', 'helm', 'cap', 'cone', 'horns', 'halo', 'headphones', 'witch'];
  for (const k of styles) if (s === k || s.startsWith(k + '_')) return k;
  return 'cap';
}
function buildHat(id) {
  const it = ITEM[id]; if (!it || id === 'hat_none') return null;
  const st = hatStyle(id);
  const g = new THREE.Group(), M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.5, metalness: st === 'crown' ? 0.8 : 0 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const C = it.color || '#aaaaaa', W = '#ffffff', D = '#212121';
  switch (st) {
    case 'cap': add(new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, 0.05); add(new THREE.BoxGeometry(1.1, 0.08, 0.6), C, 0, 0.05, 0.75); break;
    case 'tophat': add(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24), C); add(new THREE.CylinderGeometry(0.55, 0.55, 1.1, 24), C, 0, 0.55); add(new THREE.CylinderGeometry(0.56, 0.56, 0.18, 24), it.band || '#b71c1c', 0, 0.15); break;
    case 'crown': add(new THREE.CylinderGeometry(0.62, 0.62, 0.35, 24, 1, true), C, 0, 0.15); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.ConeGeometry(0.13, 0.35, 8), C, Math.cos(a) * 0.6, 0.48, Math.sin(a) * 0.6); } add(new THREE.SphereGeometry(0.1), '#e53935', 0, 0.15, 0.63); break;
    case 'horns': { const l = add(new THREE.ConeGeometry(0.14, 0.6, 12), C, -0.38, 0.22); l.rotation.z = 0.4; const r = add(new THREE.ConeGeometry(0.14, 0.6, 12), C, 0.38, 0.22); r.rotation.z = -0.4; break; }
    case 'halo': { const h = add(new THREE.TorusGeometry(0.5, 0.07, 8, 32), C, 0, 0.55); h.rotation.x = Math.PI / 2; h.material.emissive = new THREE.Color('#fff176'); break; }
    case 'headphones': { add(new THREE.TorusGeometry(0.7, 0.07, 8, 24, Math.PI), C, 0, -0.45); add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16).rotateZ(Math.PI / 2), '#222', -0.68, -0.6); add(new THREE.CylinderGeometry(0.3, 0.3, 0.2, 16).rotateZ(Math.PI / 2), '#222', 0.68, -0.6); break; }
    case 'clubhat': { add(new THREE.SphereGeometry(0.7, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), C); add(new THREE.CylinderGeometry(0.95, 0.95, 0.07, 28), C, 0, 0.03); const r = add(new THREE.TorusGeometry(0.66, 0.07, 6, 24, Math.PI), '#f2c200'); r.rotation.y = Math.PI / 2; break; }
    case 'cone': add(new THREE.ConeGeometry(0.6, 1.4, 20), C, 0, 0.65); add(new THREE.CylinderGeometry(0.36, 0.44, 0.22, 20), W, 0, 0.75); add(new THREE.BoxGeometry(1.3, 0.1, 1.3), C, 0, 0); break;
    case 'beanie': add(new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, -0.05); add(new THREE.CylinderGeometry(0.69, 0.69, 0.22, 20), '#004d40', 0, 0); add(new THREE.SphereGeometry(0.18), W, 0, 0.68); break;
    case 'bunnyears': {
      for (const sx of [-1, 1]) {
        const base = add(new THREE.CapsuleGeometry(0.17, 0.7, 6, 12), '#9e9e9e', sx * 0.3, 0.55);
        base.rotation.z = sx * -0.13;
        const tip = add(new THREE.CapsuleGeometry(0.15, 0.55, 6, 12), '#9e9e9e', sx * 0.44, 1.22);
        tip.rotation.z = sx * -0.42;
        const inner = add(new THREE.CapsuleGeometry(0.075, 0.85, 6, 12), '#f8bbd0', sx * 0.37, 0.88, 0.1);
        inner.rotation.z = sx * -0.27;
      } break; }
    case 'ducktuft': {
      for (let i = -2; i <= 2; i++) { const f = add(new THREE.ConeGeometry(0.15, 0.75, 8), D, i * 0.22, 0.42 - Math.abs(i) * 0.06); f.rotation.z = -i * 0.34; f.rotation.x = -0.3; }
      const ring = add(new THREE.TorusGeometry(0.72, 0.12, 10, 28), W, 0, -1.02);
      ring.rotation.x = Math.PI / 2;
      break; }
    case 'witch': {
      add(new THREE.CylinderGeometry(0.95, 0.95, 0.08, 24), C, 0, 0.02);
      const cone = add(new THREE.ConeGeometry(0.55, 1.35, 20), C, 0.06, 0.72);
      cone.rotation.z = -0.1;
      add(new THREE.CylinderGeometry(0.57, 0.6, 0.16, 20), '#ff9800', 0.02, 0.14);
      const tip = add(new THREE.ConeGeometry(0.16, 0.4, 10), C, 0.32, 1.42);
      tip.rotation.z = -0.7;
      break; }
    case 'catears': { for (const sx of [-1, 1]) { const e = add(new THREE.ConeGeometry(0.2, 0.55, 4), C, sx * 0.4, 0.35); e.rotation.y = Math.PI / 4; e.rotation.z = sx * -0.15; } break; }
    case 'bearears': for (const sx of [-1, 1]) { add(new THREE.SphereGeometry(0.24, 12, 10), C, sx * 0.45, 0.28); add(new THREE.SphereGeometry(0.12, 10, 8), '#f8bbd0', sx * 0.45, 0.28, 0.16); } break;
    case 'foxears': { for (const sx of [-1, 1]) { const e = add(new THREE.ConeGeometry(0.18, 0.7, 6), C, sx * 0.38, 0.42); e.rotation.z = sx * -0.12; add(new THREE.ConeGeometry(0.07, 0.2, 6), D, sx * 0.4, 0.72); } break; }
    case 'wolfears': { for (const sx of [-1, 1]) { const e = add(new THREE.ConeGeometry(0.16, 0.85, 6), C, sx * 0.36, 0.5); e.rotation.z = sx * -0.1; } break; }
    case 'helm': add(new THREE.SphereGeometry(0.72, 20, 14, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, -0.05); add(new THREE.BoxGeometry(0.9, 0.12, 0.1), D, 0, 0.1, 0.62); add(new THREE.ConeGeometry(0.1, 0.5, 8), '#e53935', 0, 0.85); break;
    case 'wizard': add(new THREE.CylinderGeometry(0.9, 0.9, 0.08, 24), C, 0, 0.02); { const c = add(new THREE.ConeGeometry(0.5, 1.5, 18), C, 0.05, 0.75); c.rotation.z = -0.12; } add(new THREE.SphereGeometry(0.09), '#fff176', -0.25, 0.5, 0.45); add(new THREE.SphereGeometry(0.07), '#fff176', 0.35, 0.95, 0.3); break;
    case 'pirate': add(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 3), C, 0, 0.12); { const r = add(new THREE.CylinderGeometry(0.85, 0.85, 0.12, 3), C, 0, 0.12); r.rotation.y = Math.PI / 3; } add(new THREE.SphereGeometry(0.5, 16, 12), C, 0, 0.05); add(new THREE.SphereGeometry(0.12), W, 0, 0.35, 0.5); break;
    case 'cowboy': add(new THREE.CylinderGeometry(1.0, 1.0, 0.07, 26), C, 0, 0.02); add(new THREE.SphereGeometry(0.55, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, 0.02); add(new THREE.CylinderGeometry(0.57, 0.57, 0.12, 18), D, 0, 0.28); break;
    case 'santa': { const c = add(new THREE.ConeGeometry(0.55, 1.0, 18), '#d32f2f', 0.1, 0.5); c.rotation.z = -0.35; } add(new THREE.CylinderGeometry(0.68, 0.68, 0.2, 20), W, 0, 0.02); add(new THREE.SphereGeometry(0.16), W, 0.55, 0.85); break;
    case 'party': { const c = add(new THREE.ConeGeometry(0.35, 0.8, 14), C, 0, 0.4); c.rotation.z = 0.15; } add(new THREE.SphereGeometry(0.12), W, -0.12, 0.82); add(new THREE.CylinderGeometry(0.5, 0.55, 0.1, 14), C, 0, 0); break;
    case 'sombrero': add(new THREE.CylinderGeometry(1.15, 1.25, 0.06, 26), C, 0, 0); add(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, 0); add(new THREE.TorusGeometry(0.55, 0.05, 8, 20), '#ffd400', 0, 0.35); break;
    case 'ninja': add(new THREE.SphereGeometry(0.7, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), D, 0, -0.08); add(new THREE.BoxGeometry(1.45, 0.12, 0.12), D, 0, 0.1, -0.1); break;
    case 'chef': add(new THREE.CylinderGeometry(0.55, 0.5, 0.55, 18), W, 0, 0.45); add(new THREE.SphereGeometry(0.55, 16, 10), W, 0, 0.7); add(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 18), W, 0, 0.05); break;
    case 'propeller': add(new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, 0.05); add(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), '#9e9e9e', 0, 0.85); { const b = add(new THREE.BoxGeometry(1.3, 0.06, 0.18), '#ffd400', 0, 1.05); b.rotation.y = 0.5; } break;
    case 'flowercrown': { const t = add(new THREE.TorusGeometry(0.62, 0.09, 8, 26), '#43a047', 0, 0.25); t.rotation.x = Math.PI / 2; for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; add(new THREE.SphereGeometry(0.11, 8, 6), ['#f48fb1', '#fff176', '#ffffff'][i % 3], Math.cos(a) * 0.62, 0.3, Math.sin(a) * 0.62); } break; }
    case 'ushanka': add(new THREE.SphereGeometry(0.7, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, -0.05); add(new THREE.BoxGeometry(0.18, 0.5, 0.5), C, -0.68, -0.2); add(new THREE.BoxGeometry(0.18, 0.5, 0.5), C, 0.68, -0.2); break;
    case 'beret': { const b = add(new THREE.SphereGeometry(0.62, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0.12, 0.1); b.scale.set(1.15, 0.55, 1.15); b.rotation.z = -0.18; } add(new THREE.SphereGeometry(0.07), C, 0.12, 0.48); break;
    case 'detective': add(new THREE.CylinderGeometry(0.8, 0.8, 0.06, 22), C, 0, 0.02); add(new THREE.CylinderGeometry(0.42, 0.48, 0.5, 18), C, 0, 0.28); add(new THREE.CylinderGeometry(0.49, 0.49, 0.1, 18), D, 0, 0.12); break;
    case 'visor': { const v = add(new THREE.CylinderGeometry(0.72, 0.72, 0.07, 20, 1, false, -Math.PI / 2.6, Math.PI / 1.3), C, 0, 0.05, 0.1); break; }
    case 'sun': add(new THREE.CylinderGeometry(1.05, 1.05, 0.05, 24), C, 0, 0.05); add(new THREE.SphereGeometry(0.5, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, 0.05); break;
    case 'fez': add(new THREE.CylinderGeometry(0.42, 0.55, 0.65, 18), C, 0, 0.35); add(new THREE.SphereGeometry(0.06), '#ffd400', 0, 0.7); break;
    case 'frog': add(new THREE.SphereGeometry(0.68, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#43a047', 0, -0.02); for (const sx of [-1, 1]) { add(new THREE.SphereGeometry(0.16, 10, 8), '#43a047', sx * 0.3, 0.62); add(new THREE.SphereGeometry(0.07, 8, 6), D, sx * 0.3, 0.62, 0.12); } break;
    case 'shark': add(new THREE.SphereGeometry(0.68, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), '#78909c', 0, -0.02); { const f = add(new THREE.ConeGeometry(0.18, 0.55, 4), '#546e7a', 0, 0.75); f.scale.z = 0.4; } for (const sx of [-1, 1]) { add(new THREE.SphereGeometry(0.08, 8, 6), D, sx * 0.25, 0.25, 0.6); } break;
    case 'chicken': add(new THREE.SphereGeometry(0.66, 18, 12, 0, Math.PI * 2, 0, Math.PI / 2), W, 0, -0.02); for (let i = 0; i < 3; i++) add(new THREE.SphereGeometry(0.14, 8, 6), '#e53935', 0, 0.72 + (i === 1 ? 0.12 : 0), -0.25 + i * 0.25); add(new THREE.ConeGeometry(0.12, 0.25, 8), '#ff9800', 0, 0.15, 0.68); break;
    case 'pizza': add(new THREE.CylinderGeometry(0.75, 0.75, 0.1, 20), '#f5c04e', 0, 0.35); for (const [px, pz] of [[-0.3, 0.1], [0.25, -0.2], [0.1, 0.35]]) add(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 10), '#d32f2f', px, 0.36, pz); break;
    case 'burger': add(new THREE.SphereGeometry(0.6, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), '#e8a94e', 0, 0.25); add(new THREE.CylinderGeometry(0.62, 0.62, 0.14, 16), '#6d4c41', 0, 0.22); add(new THREE.CylinderGeometry(0.58, 0.58, 0.1, 16), '#7cb342', 0, 0.32); break;
    case 'taco': { const s = add(new THREE.TorusGeometry(0.55, 0.28, 10, 18, Math.PI), '#f5c04e', 0, 0.3); s.rotation.z = 0; } add(new THREE.SphereGeometry(0.16, 8, 6), '#7cb342', -0.2, 0.55); add(new THREE.SphereGeometry(0.16, 8, 6), '#e53935', 0.2, 0.55); break;
    case 'donut': { const d = add(new THREE.TorusGeometry(0.5, 0.28, 12, 22), '#e8a94e', 0, 0.45); d.rotation.x = Math.PI / 2; const f = add(new THREE.TorusGeometry(0.5, 0.29, 12, 22), '#f48fb1', 0, 0.5); f.rotation.x = Math.PI / 2; f.scale.z = 0.6; } break;
    case 'icecream': { const c = add(new THREE.ConeGeometry(0.4, 0.7, 14), '#d7a86e', 0, 0.35); c.rotation.x = Math.PI; } add(new THREE.SphereGeometry(0.42, 14, 10), '#f8bbd0', 0, 0.75); add(new THREE.SphereGeometry(0.1), '#d32f2f', 0, 1.15); break;
    case 'popcorn': add(new THREE.BoxGeometry(0.8, 0.5, 0.8), '#d32f2f', 0, 0.3); for (let i = 0; i < 5; i++) add(new THREE.SphereGeometry(0.14, 8, 6), '#fff8e1', -0.25 + (i % 3) * 0.25, 0.62 + (i > 2 ? 0.12 : 0), (i % 2) * 0.2 - 0.1); break;
    default: add(new THREE.SphereGeometry(0.68, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), C, 0, 0.05); add(new THREE.BoxGeometry(1.1, 0.08, 0.6), C, 0, 0.05, 0.75);
  }
  return g;
}

function buildBugsHead(g) {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const grey = '#9e9e9e', pink = '#f8bbd0';
  const skull = add(new THREE.SphereGeometry(0.62, 24, 18), grey, 0, 0.62); skull.scale.set(1, 1.12, 0.95);
  const mz = add(new THREE.SphereGeometry(0.36, 18, 14), '#f2f2f2', 0, 0.38, 0.44); mz.scale.set(1.2, 0.85, 0.9);
  const nose = add(new THREE.SphereGeometry(0.1, 10, 8), '#212121', 0, 0.54, 0.7); nose.scale.set(1.4, 0.85, 0.7);
  add(new THREE.BoxGeometry(0.12, 0.26, 0.06), '#ffffff', -0.065, 0.16, 0.64);
  add(new THREE.BoxGeometry(0.12, 0.26, 0.06), '#ffffff', 0.065, 0.16, 0.64);
  for (const sx of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.17, 14, 12), '#ffffff', sx * 0.25, 0.94, 0.42); eye.scale.set(1, 1.3, 0.6);
    add(new THREE.SphereGeometry(0.075, 10, 8), '#212121', sx * 0.25, 0.94, 0.55);
    const ear = add(new THREE.CapsuleGeometry(0.16, 0.95, 6, 12), grey, sx * 0.27, 1.62);
    ear.rotation.z = sx * -0.16;
    const inner = add(new THREE.CapsuleGeometry(0.075, 0.68, 6, 12), pink, sx * 0.3, 1.58, 0.09);
    inner.rotation.z = sx * -0.16;
  }
}
function buildDaffyHead(g) {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.6 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const black = '#212121';
  const skull = add(new THREE.SphereGeometry(0.62, 24, 18), black, 0, 0.62); skull.scale.set(1, 1.12, 0.95);
  const bill = add(new THREE.SphereGeometry(0.32, 18, 14), '#ff9800', 0, 0.44, 0.6); bill.scale.set(1.5, 0.42, 1.15);
  const billLo = add(new THREE.SphereGeometry(0.3, 16, 12), '#fb8c00', 0, 0.36, 0.62); billLo.scale.set(1.35, 0.3, 1.0);
  add(new THREE.BoxGeometry(0.55, 0.03, 0.05), '#e65100', 0, 0.58, 0.78);
  for (const sx of [-1, 1]) {
    const eye = add(new THREE.SphereGeometry(0.18, 14, 12), '#ffffff', sx * 0.22, 1.04, 0.4); eye.scale.set(1, 1.25, 0.6);
    add(new THREE.SphereGeometry(0.08,  10, 8), '#212121', sx * 0.22, 1.04, 0.54);
  }
  for (let i = -2; i <= 2; i++) {
    const f = add(new THREE.ConeGeometry(0.13, 0.7 - Math.abs(i) * 0.09, 8), black, i * 0.19, 1.48);
    f.rotation.z = -i * 0.32; f.rotation.x = -0.22;
  }
  const ring = add(new THREE.TorusGeometry(0.55, 0.1, 10, 24), '#ffffff', 0, 0.02);
  ring.rotation.x = Math.PI / 2;
}
function buildSlimeHead(g) {
  const green = '#66bb6a', dark = '#43a047';
  const M = (c, r = 0.22) => new THREE.MeshStandardMaterial({ color: c, roughness: r });
  const add = (geo, color, x = 0, y = 0, z = 0, rough) => { const m = new THREE.Mesh(geo, M(color, rough)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const blob = add(new THREE.SphereGeometry(0.66, 24, 18), green, 0, 0.6); blob.scale.set(1.06, 0.92, 1);
  // gooey drips on top
  add(new THREE.SphereGeometry(0.17, 12, 10), green, -0.32, 1.14);
  add(new THREE.SphereGeometry(0.13, 12, 10), green, 0.02, 1.24);
  add(new THREE.SphereGeometry(0.15, 12, 10), green, 0.34, 1.12);
  // drip sliding down the side
  const drip = add(new THREE.SphereGeometry(0.1, 10, 8), green, 0.64, 0.42, 0.12); drip.scale.set(0.8, 1.7, 0.8);
  // big cute eyes
  for (const sx of [-1, 1]) {
    add(new THREE.SphereGeometry(0.17, 14, 12), '#ffffff', sx * 0.25, 0.76, 0.5, 0.4);
    add(new THREE.SphereGeometry(0.075, 10, 8), '#212121', sx * 0.25, 0.76, 0.64, 0.4);
  }
  // smile
  const smile = add(new THREE.TorusGeometry(0.15, 0.032, 8, 16, Math.PI), dark, 0, 0.5, 0.56, 0.5);
  smile.rotation.z = Math.PI;
  // glossy highlight
  const hi = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.45 }));
  hi.position.set(-0.32, 0.92, 0.5); hi.scale.set(1, 1.5, 0.5); g.add(hi);
}
function buildPumpkinHead(g) {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const p = add(new THREE.SphereGeometry(0.68, 24, 18), '#e67e22', 0, 0.62); p.scale.set(1, 0.95, 0.95);
  for (let i = -2; i <= 2; i++) { const r = add(new THREE.TorusGeometry(0.7, 0.03, 6, 24), '#d35400', 0, 0.62); r.rotation.y = Math.PI / 2 + i * 0.28; r.scale.set(1, 0.95, 1); }
  add(new THREE.CylinderGeometry(0.09, 0.14, 0.32, 10), '#2e7d32', 0, 1.32);
  const glow = new THREE.MeshBasicMaterial({ color: '#ffca28' });
  const tri = (x, y) => { const m = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.26, 3), glow); m.position.set(x, y, 0.6); m.rotation.x = -0.12; g.add(m); };
  tri(-0.25, 0.8); tri(0.25, 0.8);
  let px = -0.32;
  for (let i = 0; i < 5; i++) { const m = new THREE.Mesh(new THREE.BoxGeometry(0.16, i % 2 ? 0.2 : 0.12, 0.04), glow); m.position.set(px, 0.34 + (i % 2 ? 0.03 : -0.03), 0.62); m.rotation.z = (i % 2 ? -1 : 1) * 0.2; g.add(m); px += 0.16; }
}
function buildGhostHead(g) {
  const M = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
  const add = (geo, color, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, M(color)); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  const b = add(new THREE.SphereGeometry(0.62, 24, 18), '#f5f5f5', 0, 0.78); b.scale.set(1, 1.2, 0.95);
  add(new THREE.CylinderGeometry(0.6, 0.72, 0.55, 24, 1, true), '#f5f5f5', 0, 0.12);
  const dark = new THREE.MeshBasicMaterial({ color: '#212121' });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), dark); e.scale.set(1, 1.5, 0.5); e.position.set(sx * 0.24, 0.88, 0.56); g.add(e); }
  const mo = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 10), dark); mo.scale.set(1, 1.4, 0.5); mo.position.set(0, 0.5, 0.58); g.add(mo);
  for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; add(new THREE.ConeGeometry(0.09, 0.22, 6), '#f5f5f5', Math.cos(a) * 0.66, -0.12, Math.sin(a) * 0.66); }
}
const HEADS = {
  head_bugs: { h: 1.3, custom: buildBugsHead },
  head_daffy: { h: 1.3, custom: buildDaffyHead },
  head_slimebody: { h: 1.35, custom: buildSlimeHead },
  head_pumpkin: { h: 1.45, custom: buildPumpkinHead },
  head_ghost: { h: 1.6, custom: buildGhostHead },
  head_classic: { h: 1.2, fz: 0.63, fw: 1, geo: () => new THREE.CylinderGeometry(0.62, 0.62, 1.2, 24) },
  head_block: { h: 1.2, fz: 0.611, fw: 1.05, geo: () => new THREE.BoxGeometry(1.2, 1.2, 1.2) },
  head_round: { h: 1.36, r: 0.68, round: true, geo: () => new THREE.SphereGeometry(0.68, 28, 20) },
  head_tall: { h: 1.6, fz: 0.56, fw: 0.95, hs: 0.9, geo: () => new THREE.CylinderGeometry(0.55, 0.55, 1.6, 24) },
  head_wide: { h: 1.05, fz: 0.63, fw: 1.1, hs: 1.15, geo: () => new THREE.CylinderGeometry(0.62, 0.62, 1.05, 24).scale(1.4, 1, 1) },
  head_alien: { h: 1.5, fz: 0.6, color: '#7cb342', geo: () => new THREE.SphereGeometry(0.62, 24, 18).scale(1, 1.35, 0.95) },
  head_brick: { h: 1.2, fz: 0.61, color: '#a6492f', geo: () => new THREE.BoxGeometry(1.2, 1.2, 1.2) },
  head_cactus: { h: 1.3, fz: 0.56, color: '#43a047', geo: () => new THREE.CylinderGeometry(0.5, 0.55, 1.3, 20) },
  head_cloud: { h: 1.1, fz: 0.6, color: '#f5f5f5', geo: () => new THREE.SphereGeometry(0.62, 20, 14).scale(1.3, 0.9, 1) },
  head_cone: { h: 1.3, fz: 0.55, color: '#ff9800', geo: () => new THREE.ConeGeometry(0.62, 1.3, 20) },
  head_cookie: { h: 0.9, fz: 0.66, color: '#c98f4e', geo: () => new THREE.CylinderGeometry(0.65, 0.65, 0.9, 22) },
  head_cube: { h: 1.2, fz: 0.61, color: '#9aa0a6', geo: () => new THREE.BoxGeometry(1.2, 1.2, 1.2) },
  head_cylinder: { h: 1.2, fz: 0.63, color: '#b0bec5', geo: () => new THREE.CylinderGeometry(0.62, 0.62, 1.2, 24) },
  head_diamond: { h: 1.3, fz: 0.55, color: '#4fc3f7', geo: () => new THREE.OctahedronGeometry(0.75) },
  head_egg: { h: 1.45, fz: 0.6, color: '#fafafa', geo: () => new THREE.SphereGeometry(0.62, 22, 16).scale(1, 1.25, 1) },
  head_fishbowl: { h: 1.4, fz: 0.68, color: '#b3e5fc', geo: () => new THREE.SphereGeometry(0.7, 22, 16) },
  head_football: { h: 1.35, fz: 0.55, color: '#8d5a2b', geo: () => new THREE.SphereGeometry(0.62, 20, 14).scale(0.85, 1.1, 0.85) },
  head_gold: { h: 1.36, fz: 0.66, color: '#ffd400', geo: () => new THREE.SphereGeometry(0.68, 24, 18) },
  head_heart: { h: 1.25, fz: 0.5, color: '#e53935', geo: () => new THREE.SphereGeometry(0.62, 20, 14).scale(1.15, 1, 0.8) },
  head_moon: { h: 1.24, fz: 0.6, color: '#fff9c4', geo: () => new THREE.SphereGeometry(0.62, 22, 16) },
  head_mushroom: { h: 1.0, fz: 0.7, color: '#d32f2f', geo: () => new THREE.SphereGeometry(0.62, 20, 12).scale(1.25, 0.8, 1.25) },
  head_robot: { h: 1.1, fz: 0.56, color: '#90a4ae', geo: () => new THREE.BoxGeometry(1.1, 1.1, 1.1) },
  head_skull: { h: 1.24, fz: 0.6, color: '#f5f5f5', geo: () => new THREE.SphereGeometry(0.62, 22, 16) },
  head_slime: { h: 1.1, fz: 0.65, color: '#7cb342', geo: () => new THREE.SphereGeometry(0.62, 20, 14).scale(1.1, 0.9, 1.1) },
  head_snowman: { h: 1.24, fz: 0.6, color: '#ffffff', geo: () => new THREE.SphereGeometry(0.62, 22, 16) },
  head_sphere: { h: 1.36, fz: 0.66, geo: () => new THREE.SphereGeometry(0.68, 24, 18) },
  head_star: { h: 1.3, fz: 0.6, color: '#fdd835', geo: () => new THREE.IcosahedronGeometry(0.7) },
  head_tv: { h: 1.0, fz: 0.46, color: '#37474f', geo: () => new THREE.BoxGeometry(1.3, 1.0, 0.9) },
  head_watermelon: { h: 1.4, fz: 0.64, color: '#43a047', geo: () => new THREE.SphereGeometry(0.66, 22, 16).scale(1, 1.1, 1) },
  head_wood: { h: 1.2, fz: 0.63, color: '#8d6e63', geo: () => new THREE.CylinderGeometry(0.6, 0.62, 1.2, 20) },
};

// Returns a THREE.Group; feet at y=0, facing +z. userData.limbs = { larm, rarm, lleg, rleg, head, torso }
const BODY_SUITS = { head_bugs: '#9e9e9e', head_daffy: '#212121', head_slimebody: '#66bb6a' };
export function buildCharacter(avatar, opts = {}) {
  const C = { ...avatar.colors };
  const suitColor = BODY_SUITS[avatar.head];
  if (suitColor) for (const k of Object.keys(C)) C[k] = suitColor;
  const suit = avatar.shirt === 'shirt_suit' && !suitColor;
  const isBugs = avatar.head === 'head_bugs', isDaffy = avatar.head === 'head_daffy';
  const root = new THREE.Group();
  const torsoW = isBugs ? 1.8 : 2;
  const torso = box(torsoW, 2, 1, suit ? '#263238' : C.torso); torso.position.y = 3; root.add(torso);
  if (avatar.shirt && avatar.shirt !== 'shirt_none') {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(torsoW, 2), new THREE.MeshStandardMaterial({ map: shirtTexture(avatar.shirt), transparent: true, roughness: 0.8 }));
    d.position.z = 0.501; torso.add(d);
  }
  const headPivot = new THREE.Group(); headPivot.position.y = 4; root.add(headPivot);
  const H = HEADS[avatar.head] || HEADS.head_classic;
  if (H.custom) { H.custom(headPivot); }
  else {
    const head = new THREE.Mesh(H.geo(), mat(H.color || C.head)); head.position.y = H.h / 2; head.castShadow = true; headPivot.add(head);
    const faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(avatar.face), transparent: true });
    const face = H.round
      ? new THREE.Mesh(new THREE.SphereGeometry(H.r + 0.01, 24, 16, Math.PI / 2 - 0.75, 1.5, Math.PI / 2 - 0.75, 1.5), faceMat)
      : new THREE.Mesh(new THREE.PlaneGeometry(H.fw, H.fw), faceMat);
    face.position.set(0, H.h / 2, H.round ? 0 : H.fz); headPivot.add(face);
  }
  const hat = buildHat(avatar.hat); if (hat) { hat.position.y = H.h; hat.scale.setScalar(H.hs || 1); headPivot.add(hat); }
  const limb = (x, y, color, w = 1) => { const p = new THREE.Group(); p.position.set(x, y, 0); const m = box(w, 2, w, color); m.position.y = -1; p.add(m); root.add(p); return p; };
  let larm, rarm, lleg, rleg;
  if (isBugs) {
    larm = limb(-1.35, 4, C.larm, 0.8); rarm = limb(1.35, 4, C.rarm, 0.8);
    lleg = limb(-0.45, 2, C.lleg, 0.9); rleg = limb(0.45, 2, C.rleg, 0.9);
    for (const leg of [lleg, rleg]) {
      const foot = box(0.95, 0.45, 1.7, '#9e9e9e');
      foot.position.set(0, -1.85, 0.45); foot.castShadow = true; leg.add(foot);
    }
    const tail = new THREE.Mesh(new THREE.SphereGeometry(0.3, 14, 12), mat('#ffffff'));
    tail.position.set(0, 2.3, -0.62); tail.castShadow = true; root.add(tail);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(1.15, 1.5, 0.15), mat('#f5f5f5'));
    belly.position.set(0, 2.9, 0.5); root.add(belly);
  } else if (isDaffy) {
    larm = limb(-1.35, 4, C.larm, 0.75); rarm = limb(1.35, 4, C.rarm, 0.75);
    lleg = limb(-0.4, 2, '#ff9800', 0.55); rleg = limb(0.4, 2, '#ff9800', 0.55);
    for (const leg of [lleg, rleg]) {
      const foot = box(1.15, 0.28, 1.5, '#ff9800');
      foot.position.set(0, -1.9, 0.5); foot.castShadow = true; leg.add(foot);
    }
    for (let i = -1; i <= 1; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.7, 8), mat('#212121'));
      f.position.set(i * 0.3, 2.2, -0.7); f.rotation.x = 1.9; f.castShadow = true; root.add(f);
    }
  } else {
    larm = limb(-1.5, 4, suit ? '#263238' : C.larm); rarm = limb(1.5, 4, suit ? '#263238' : C.rarm);
    lleg = limb(-0.5, 2, C.lleg); rleg = limb(0.5, 2, C.rleg);
  }
  root.userData.limbs = { larm, rarm, lleg, rleg, head: headPivot, torso };
  const petSpec = opts.pet === false ? null : PET_MODELS[avatar.pet];
  if (petSpec) {
    const pet = new THREE.Group();
    for (const b of petSpec.boxes) {
      const m = box(b[3], b[4], b[5], b[6]);
      m.position.set(b[0], b[1], b[2]);
      if (b[7]) m.rotation.z = b[7];
      pet.add(m);
    }
    pet.position.set(1.9, 0, 0.6);
    pet.rotation.y = -0.4;
    root.add(pet);
    root.userData.pet = pet;
  }
  const gearSpec = opts.gear === false ? null : GEAR_MODELS[avatar.gear];
  if (gearSpec) {
    const gear = new THREE.Group();
    for (const b of gearSpec.boxes) {
      const m = box(b[3], b[4], b[5], b[6]);
      m.position.set(b[0], b[1], b[2]);
      if (b[7]) m.rotation.z = b[7];
      gear.add(m);
    }
    gear.scale.setScalar(0.5);
    const rarmG = root.userData.limbs?.rarm;
    gear.position.set(0, -2, 0.5);
    (rarmG || root).add(gear);
    root.userData.gear = gear;
  }
  return root;
}

export function animateCharacter(ch, state, t, dt) {
  const L = ch.userData.limbs; if (!L) return;
  // Classic Roblox style: idle is statue-still, walk swings big, jump = arms straight up, fall = arms out
  // rotation.x > 0 swings a limb backwards (character faces +z); arms up ~ -PI
  if (L.torso.userData.baseY === undefined) L.torso.userData.baseY = L.torso.position.y;
  let la = 0, ra = 0, ll = 0, rl = 0, laz = 0, raz = 0, bob = 0;
  if (state === 'walk') {
    const s = Math.sin(t * 10);
    la = s * 1.05; ra = -s * 1.05; ll = -s * 1.05; rl = s * 1.05;
    laz = 0.14; raz = -0.14;
    bob = Math.abs(Math.cos(t * 10)) * 0.14;
  }
  else if (state === 'jump') { la = ra = -Math.PI; laz = 0.15; raz = -0.15; }
  else if (state === 'fall') { laz = 1.45; raz = -1.45; ll = 0.15; rl = 0.15; }
  else if (state === 'wave') { ra = -(Math.PI * 0.85 + Math.sin(t * 12) * 0.3); }
  else if (state === 'dance') { const s = Math.sin(t * 8); la = -Math.PI * 0.5 - s; ra = -Math.PI * 0.5 + s; ll = s * 0.4; rl = -s * 0.4; }
  else if (state === 'sit') { ll = rl = -Math.PI / 2; la = ra = -0.6; }
  // idle: perfectly still, like classic Roblox
  const k = Math.min(1, dt * 15);
  L.larm.rotation.x += (la - L.larm.rotation.x) * k;
  L.rarm.rotation.x += (ra - L.rarm.rotation.x) * k;
  L.lleg.rotation.x += (ll - L.lleg.rotation.x) * k;
  L.rleg.rotation.x += (rl - L.rleg.rotation.x) * k;
  L.larm.rotation.z += (laz - L.larm.rotation.z) * k;
  L.rarm.rotation.z += (raz - L.rarm.rotation.z) * k;
  L.torso.position.y += ((L.torso.userData.baseY + bob) - L.torso.position.y) * k;
}

export const CLUB_PATH = 'M2 17h20v3H2zM4 16a8 8 0 0 1 16 0zM10.5 7h3v5h-3z';
// Blocky drivable vehicles. Returns a THREE.Group, ~4 wide x 7 long, facing +Z.
export function buildVehicle(id) {
  const spec = ITEM[id] || {};
  const color = spec.color || '#e53935';
  const truck = id === 'vehicle_truck';
  const g = new THREE.Group();
  const bodyH = truck ? 1.6 : 1.1, bodyY = truck ? 1.9 : 1.35;
  const body = box(4, bodyH, 7, color); body.position.y = bodyY; g.add(body);
  const cab = box(3.4, truck ? 1.4 : 1.0, truck ? 2.2 : 3.0, '#b0bec5');
  cab.position.set(0, bodyY + bodyH / 2 + cab.geometry.parameters.height / 2 - 0.1, truck ? 1.2 : -0.6); g.add(cab);
  const winShield = box(3.0, 0.7, 0.15, '#e1f5fe');
  winShield.position.set(0, cab.position.y + 0.1, cab.position.z + cab.geometry.parameters.depth / 2); g.add(winShield);
  const wheelG = new THREE.CylinderGeometry(truck ? 0.85 : 0.65, truck ? 0.85 : 0.65, 0.6, 12);
  const wheelM = mat('#212121');
  const wheels = [];
  for (const [x, z] of [[-2.1, 2.2], [2.1, 2.2], [-2.1, -2.2], [2.1, -2.2]]) {
    const w = new THREE.Mesh(wheelG, wheelM); w.rotation.z = Math.PI / 2;
    w.position.set(x, truck ? 0.85 : 0.65, z); w.castShadow = true;
    g.add(w); wheels.push(w);
  }
  const lightM = new THREE.MeshStandardMaterial({ color: '#fff9c4', emissive: '#ffeb3b', emissiveIntensity: 0.8 });
  for (const x of [-1.3, 1.3]) {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.15), lightM);
    l.position.set(x, bodyY, 3.55); g.add(l);
  }
  g.userData.wheels = wheels;
  return g;
}
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
