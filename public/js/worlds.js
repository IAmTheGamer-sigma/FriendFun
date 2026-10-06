// World generators shared by server (seeding) and client (studio templates).
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

let nextId = 1;
function part(p, s, c, extra = {}) {
  return { id: 'p' + (nextId++), name: extra.name || 'Part', p, s, c, k: 'part', m: 'plastic', ...extra };
}
function startWorld(sky = '#8fc8ff') { nextId = 1; return { sky, parts: [] }; }

export function baseplate() {
  const w = startWorld();
  w.parts.push(part([0, -0.5, 0], [256, 1, 256], '#a3a2a5', { name: 'Baseplate', m: 'baseplate' }));
  w.parts.push(part([0, 0.25, 0], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  return w;
}

export function obby() {
  const w = startWorld('#9fd6ff');
  const r = rng(42);
  const colors = ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93', '#ff924c'];
  w.parts.push(part([0, -40, 0], [2000, 1, 2000], '#ff3b1f', { name: 'Lava', k: 'kill', m: 'neon' }));
  w.parts.push(part([0, 0, 0], [24, 2, 24], '#d9d9d9', { name: 'StartPlatform' }));
  w.parts.push(part([0, 1.25, 0], [6, 0.5, 6], '#3a7bd5', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  let z = -12, y = 0, x = 0;
  for (let stage = 1; stage <= 10; stage++) {
    const col = colors[stage % colors.length];
    const type = stage % 5;
    if (type === 1) { // jumps
      for (let i = 0; i < 6; i++) { z -= 8 + r() * 3; x += (r() - 0.5) * 8; y += r() < 0.4 ? 2 : 0; w.parts.push(part([x, y, z], [5, 1, 5], col)); }
    } else if (type === 2) { // kill brick walkway
      z -= 22; w.parts.push(part([x, y, z], [8, 1, 36], col, { name: 'Walkway' }));
      for (let i = 0; i < 5; i++) w.parts.push(part([x + (i % 2 ? 2 : -2), y + 0.75, z - 14 + i * 7], [4, 0.5, 1.5], '#ff2020', { name: 'KillBrick', k: 'kill', m: 'neon' }));
      z -= 18;
    } else if (type === 3) { // truss climb / stairs up
      for (let i = 0; i < 7; i++) { z -= 5; y += 2.2; w.parts.push(part([x, y, z], [6, 1, 3], col, { name: 'Step' })); }
    } else if (type === 4) { // bounce pads
      z -= 10; w.parts.push(part([x, y, z], [6, 1, 6], '#22ff88', { name: 'BouncePad', k: 'bounce', m: 'neon' }));
      z -= 14; y += 10; w.parts.push(part([x, y, z], [8, 1, 8], col));
    } else { // thin beams
      for (let i = 0; i < 3; i++) { z -= 12; w.parts.push(part([x, y, z], [1.5, 1, 14], col, { name: 'Beam' })); }
      z -= 10;
    }
    z -= 10;
    w.parts.push(part([x, y, z], [12, 1, 12], '#efefef', { name: 'Stage' + stage }));
    w.parts.push(part([x, y + 0.75, z], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint' + stage, k: 'checkpoint', m: 'neon' }));
    w.parts.push(part([x + 4, y + 2.5, z + 4], [1.2, 1.2, 1.2], '#ffd400', { name: 'Coin', k: 'coin' }));
  }
  z -= 14;
  w.parts.push(part([x, y, z], [20, 1, 20], '#ffd700', { name: 'WinPlatform', m: 'neon' }));
  w.parts.push(part([x, y + 0.75, z], [8, 0.5, 8], '#ffffff', { name: 'WinPad', k: 'win', m: 'neon' }));
  return w;
}

export function hangout() {
  const w = startWorld('#a8dcff');
  const r = rng(7);
  w.parts.push(part([0, -0.5, 0], [300, 1, 300], '#4caf50', { name: 'Grass', m: 'grass' }));
  w.parts.push(part([0, 0.05, 0], [12, 0.1, 300], '#555a60', { name: 'Road', m: 'concrete' }));
  w.parts.push(part([0, 0.06, 0], [300, 0.1, 12], '#555a60', { name: 'Road', m: 'concrete' }));
  w.parts.push(part([16, 0.25, 16], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  // fountain
  w.parts.push(part([30, 1, 30], [14, 2, 14], '#cfcfcf', { name: 'Fountain', m: 'concrete' }));
  w.parts.push(part([30, 2.05, 30], [12, 0.1, 12], '#3fa9f5', { name: 'Water', m: 'glass', cc: false, tr: 0.3 }));
  w.parts.push(part([30, 4, 30], [2, 6, 2], '#cfcfcf', { name: 'FountainTop', m: 'concrete' }));
  // houses
  const houseColors = ['#e07a5f', '#f2cc8f', '#81b29a', '#9a8c98', '#e9c46a', '#a8dadc'];
  for (let i = 0; i < 10; i++) {
    const side = i % 2 ? 1 : -1, along = -120 + (i >> 1) * 55;
    const hx = side * 28, hz = along, col = houseColors[i % houseColors.length];
    const W = 16, D = 14, H = 10;
    w.parts.push(part([hx, 0.25, hz], [W + 2, 0.5, D + 2], '#8d6e63', { name: 'Floor', m: 'wood' }));
    w.parts.push(part([hx, H / 2, hz - D / 2], [W, H, 1], col, { name: 'Wall', m: 'brick' }));
    w.parts.push(part([hx - W / 2, H / 2, hz], [1, H, D], col, { name: 'Wall', m: 'brick' }));
    w.parts.push(part([hx + W / 2, H / 2, hz], [1, H, D], col, { name: 'Wall', m: 'brick' }));
    w.parts.push(part([hx - 5, H / 2, hz + D / 2], [6, H, 1], col, { name: 'Wall', m: 'brick' }));
    w.parts.push(part([hx + 5, H / 2, hz + D / 2], [6, H, 1], col, { name: 'Wall', m: 'brick' }));
    w.parts.push(part([hx, H - 1.5, hz + D / 2], [4, 3, 1], col, { name: 'Wall', m: 'brick' }));
    w.parts.push(part([hx, H + 0.5, hz], [W + 3, 1, D + 3], '#5d4037', { name: 'Roof', m: 'wood' }));
    w.parts.push(part([hx, H + 2, hz], [W - 2, 2, D - 2], '#6d4c41', { name: 'Roof', m: 'wood' }));
    w.parts.push(part([hx + 4, 1, hz - 4], [4, 1.5, 2], '#3949ab', { name: 'Couch' }));
  }
  // trees
  for (let i = 0; i < 40; i++) {
    const tx = (r() - 0.5) * 260, tz = (r() - 0.5) * 260;
    if (Math.abs(tx) < 45 && Math.abs(tz) < 140) continue;
    const h = 6 + r() * 6;
    w.parts.push(part([tx, h / 2, tz], [1.6, h, 1.6], '#6d4c41', { name: 'Trunk', m: 'wood' }));
    w.parts.push(part([tx, h + 2, tz], [7, 5, 7], '#2e7d32', { name: 'Leaves', m: 'grass' }));
  }
  // benches & coins
  for (let i = 0; i < 6; i++) w.parts.push(part([-10, 1, -60 + i * 25], [2, 1, 6], '#795548', { name: 'Bench', m: 'wood' }));
  for (let i = 0; i < 20; i++) w.parts.push(part([(r() - 0.5) * 200, 2, (r() - 0.5) * 200], [1.2, 1.2, 1.2], '#ffd400', { name: 'Coin', k: 'coin' }));
  // stage
  w.parts.push(part([-50, 1.5, 50], [30, 3, 18], '#37474f', { name: 'Stage', m: 'wood' }));
  w.parts.push(part([-50, 10, 41], [30, 1, 1], '#ff00aa', { name: 'Lights', m: 'neon' }));
  return w;
}

export function tower() {
  const w = startWorld('#ffb4a2');
  const r = rng(99);
  w.parts.push(part([0, -0.5, 0], [200, 1, 200], '#455a64', { name: 'Ground', m: 'concrete' }));
  w.parts.push(part([0, 0.25, 22], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  w.parts.push(part([0, 60, 0], [10, 120, 10], '#263238', { name: 'TowerCore', m: 'concrete' }));
  const cols = ['#e63946', '#f4a261', '#2a9d8f', '#457b9d', '#9b5de5'];
  let a = 0, y = 2;
  for (let i = 0; i < 60; i++) {
    a += 0.5 + r() * 0.2; y += 2;
    const rad = 10;
    const kind = i % 15 === 14 ? 'checkpoint' : (i % 7 === 3 ? 'kill' : 'part');
    w.parts.push(part([Math.cos(a) * rad, y, Math.sin(a) * rad], [4, 1, 4], kind === 'kill' ? '#ff1f1f' : kind === 'checkpoint' ? '#2ec4ff' : cols[(i / 12) | 0],
      { name: kind === 'kill' ? 'KillBrick' : kind === 'checkpoint' ? 'Checkpoint' : 'Step', k: kind, m: kind === 'part' ? 'plastic' : 'neon' }));
    if (kind === 'kill') { a += 0.55; y += 0; w.parts.push(part([Math.cos(a) * rad, y, Math.sin(a) * rad], [4, 1, 4], cols[(i / 12) | 0], { name: 'Step' })); }
    if (i % 5 === 0) w.parts.push(part([Math.cos(a) * rad, y + 2.5, Math.sin(a) * rad], [1.2, 1.2, 1.2], '#ffd400', { name: 'Coin', k: 'coin' }));
  }
  w.parts.push(part([0, 121, 0], [16, 1, 16], '#ffd700', { name: 'Top', m: 'neon' }));
  w.parts.push(part([0, 121.75, 0], [6, 0.5, 6], '#ffffff', { name: 'WinPad', k: 'win', m: 'neon' }));
  return w;
}

export function coinRush() {
  const w = startWorld('#c3f0ff');
  const r = rng(1234);
  w.parts.push(part([0, -30, 0], [2000, 1, 2000], '#1e88e5', { name: 'Water', k: 'kill', m: 'glass', tr: 0.2 }));
  w.parts.push(part([0, 0, 0], [20, 2, 20], '#fdd835', { name: 'Island', m: 'sand' }));
  w.parts.push(part([0, 1.25, 0], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  for (let branch = 0; branch < 4; branch++) {
    let ang = branch * Math.PI / 2, d = 10, y = 0;
    for (let i = 0; i < 12; i++) {
      ang += (r() - 0.5) * 0.6; d += 9 + r() * 3; y = Math.max(-4, y + ((r() * 5) | 0) - 1);
      const px = Math.cos(ang) * d, pz = Math.sin(ang) * d, sz = 5 + r() * 4;
      w.parts.push(part([px, y, pz], [sz, 1, sz], `hsl(${(r() * 360) | 0},70%,60%)`, { name: 'Platform' }));
      w.parts.push(part([px, y + 2.5, pz], [1.2, 1.2, 1.2], '#ffd400', { name: 'Coin', k: 'coin' }));
      if (i % 5 === 4) w.parts.push(part([px + sz / 2 - 1.3, y + 0.75, pz], [2.2, 0.5, 2.2], '#ff9800', { name: 'SpeedPad', k: 'speed', m: 'neon' }));
    }
  }
  return w;
}

export const templates = { baseplate, obby, hangout, tower, coinRush };

// ============ ORIGINAL HALLOWEEN WORLDS (hand-designed, Oct 2026) ============
// Helper: floating candy coin
function candy(w, x, y, z) {
  w.parts.push(part([x, y, z], [1.2, 1.2, 1.2], '#ffd400', { name: 'Candy', k: 'coin' }));
}

// 1. HAUNTED MANSION ESCAPE - room-by-room obby through a spooky mansion
export function hwMansion() {
  const w = startWorld('#14141f');
  w.parts.push(part([0, -20, -130], [400, 1, 400], '#05050c', { name: 'Abyss', k: 'kill', m: 'neon' }));
  // FOYER
  w.parts.push(part([0, -1, 0], [28, 2, 28], '#5a5a6e', { name: 'FoyerFloor', m: 'concrete' }));
  w.parts.push(part([0, 0.25, 10], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    w.parts.push(part([sx * 11, 4, sz * 11], [2.5, 10, 2.5], '#3d3d52', { name: 'Pillar', m: 'brick' }));
  w.parts.push(part([0, 9.5, 13], [28, 2, 2], '#3d3d52', { name: 'EntryArch', m: 'brick' }));
  candy(w, -6, 2, 0); candy(w, 6, 2, 0); candy(w, 0, 2, -8);
  // STAGE 1: hallway of floating rugs over the abyss
  const rugs = [[0, -22], [3, -30], [-3, -38], [2, -46], [-2, -54], [0, -62]];
  for (const [x, z] of rugs) {
    w.parts.push(part([x, -0.5, z], [7, 1, 7], '#7d2e3e', { name: 'Rug' }));
    candy(w, x, 1, z);
  }
  w.parts.push(part([0, 0, -70], [10, 1, 10], '#4a4a5e', { name: 'Landing1', m: 'concrete' }));
  w.parts.push(part([0, 0.75, -70], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint1', k: 'checkpoint', m: 'neon' }));
  // STAGE 2: library bookshelf climb
  const shelfC = ['#8b4513', '#a0522d', '#7a3b1f'], bookC = ['#c0392b', '#2980b9', '#27ae60'];
  let sy = 0;
  for (let i = 0; i < 6; i++) {
    const z = -80 - i * 6, left = i % 2 === 0;
    sy += 2.5;
    w.parts.push(part([left ? -3 : 3, sy - 0.5, z], [10, 1, 5], shelfC[i % 3], { name: 'Shelf' + i, m: 'wood' }));
    w.parts.push(part([left ? 5 : -5, sy + 1, z], [1.2, 2.5, 4], bookC[i % 3], { name: 'Books' + i, m: 'plastic' }));
    candy(w, left ? -3 : 3, sy + 1, z);
  }
  w.parts.push(part([0, sy, -116], [12, 1, 8], '#4a4a5e', { name: 'Landing2', m: 'concrete' }));
  w.parts.push(part([0, sy + 0.75, -116], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint2', k: 'checkpoint', m: 'neon' }));
  // STAGE 3: dining hall - long table with floating plates
  const dy = sy + 0.5;
  w.parts.push(part([0, dy - 0.5, -140], [8, 1, 36], '#6d4c41', { name: 'DiningTable', m: 'wood' }));
  for (let i = 0; i < 6; i++) {
    const pz = -126 - i * 6, px = i % 2 ? 2.5 : -2.5;
    w.parts.push(part([px, dy + 2.5, pz], [3, 0.6, 3], '#ecf0f1', { name: 'Plate' + i, m: 'glass' }));
    candy(w, px, dy + 4, pz);
  }
  w.parts.push(part([0, dy + 12, -140], [1, 5, 1], '#444', { name: 'Chain' }));
  w.parts.push(part([0, dy + 9, -140], [6, 1, 6], '#f1c40f', { name: 'Chandelier', m: 'neon' }));
  w.parts.push(part([0, dy, -162], [12, 1, 8], '#4a4a5e', { name: 'Landing3', m: 'concrete' }));
  w.parts.push(part([0, dy + 0.75, -162], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint3', k: 'checkpoint', m: 'neon' }));
  // STAGE 4: attic beams with cursed portraits to dodge
  const by = dy + 1;
  for (let i = 0; i < 5; i++) {
    const bz = -172 - i * 7;
    w.parts.push(part([i % 2 ? 1.5 : -1.5, by, bz], [2, 1, 10], '#5d4037', { name: 'Beam' + i, m: 'wood' }));
    if (i < 4) w.parts.push(part([i % 2 ? -2.5 : 2.5, by + 1.5, bz - 3.5], [2, 2, 0.5], '#ff2020', { name: 'CursedPortrait' + i, k: 'kill', m: 'neon' }));
  }
  w.parts.push(part([0, by, -206], [12, 1, 10], '#4a4a5e', { name: 'Landing4', m: 'concrete' }));
  w.parts.push(part([0, by + 0.75, -206], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint4', k: 'checkpoint', m: 'neon' }));
  // ROOFTOP FINALE
  w.parts.push(part([0, by + 2.5, -214], [8, 1, 6], '#3d3d52', { name: 'RoofStep1', m: 'brick' }));
  w.parts.push(part([0, by + 5, -221], [10, 1, 8], '#3d3d52', { name: 'RoofStep2', m: 'brick' }));
  w.parts.push(part([0, by + 6.5, -232], [20, 1, 20], '#ffd700', { name: 'RoofWin', m: 'neon' }));
  w.parts.push(part([0, by + 7.25, -232], [8, 0.5, 8], '#ffffff', { name: 'WinPad', k: 'win', m: 'neon' }));
  w.parts.push(part([60, 60, -260], [12, 12, 2], '#f4f1de', { name: 'Moon', m: 'neon', cc: false }));
  return w;
}

// 2. PUMPKIN PATCH HUNT - candy hunt among giant pumpkins + corn maze
export function hwPumpkin() {
  const w = startWorld('#1b1030');
  const r = rng(20261031);
  w.parts.push(part([0, -0.5, 0], [220, 1, 220], '#1e3d1e', { name: 'Field', m: 'grass' }));
  w.parts.push(part([0, 0.25, 95], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  // fence around the patch
  for (let i = -5; i <= 5; i++) {
    w.parts.push(part([i * 20, 1.5, 105], [1, 3, 1], '#5d4037', { name: 'Fence', m: 'wood' }));
    w.parts.push(part([i * 20, 1.5, -105], [1, 3, 1], '#5d4037', { name: 'Fence', m: 'wood' }));
    w.parts.push(part([105, 1.5, i * 20], [1, 3, 1], '#5d4037', { name: 'Fence', m: 'wood' }));
    w.parts.push(part([-105, 1.5, i * 20], [1, 3, 1], '#5d4037', { name: 'Fence', m: 'wood' }));
  }
  // giant pumpkins (hand-placed ring + scattered)
  const pumpkins = [[-40, -40], [40, -40], [-40, 40], [40, 40], [0, -60], [-60, 0], [60, 0], [0, 60], [-25, -75], [25, 75]];
  for (const [px, pz] of pumpkins) {
    const s = 5 + r() * 2;
    w.parts.push(part([px, s / 2, pz], [s, s, s], '#e67e22', { name: 'Pumpkin', m: 'plastic' }));
    w.parts.push(part([px, s + 0.6, pz], [1, 1.2, 1], '#2e7d32', { name: 'Stem', m: 'plastic' }));
    // glowing face on two of them
    if ((px + pz) % 3 === 0) {
      w.parts.push(part([px, s * 0.65, pz + s / 2 + 0.1], [1, 1, 0.2], '#ffca28', { name: 'GlowEye', m: 'neon', cc: false }));
    }
    candy(w, px, s + 1.8, pz); // candy on top
    candy(w, px + s, 1.2, pz + s);
  }
  // corn maze (hand-designed simple maze, walls 6 tall)
  const mazeC = '#c9a227';
  const walls = [
    [0, -10, 40, 2], [0, 10, 40, 2], [-20, 0, 2, 22], [20, 0, 2, 22],
    [-10, -20, 22, 2], [10, 20, 22, 2], [-30, -10, 2, 22], [30, 10, 2, 22],
  ];
  for (const [x, z, sx, sz] of walls) {
    w.parts.push(part([x, 3, z - 40], [sx, 6, sz], mazeC, { name: 'CornWall', m: 'grass' }));
    candy(w, x, 7, z - 40);
  }
  // scarecrows
  for (const [sx, sz] of [[-70, -70], [70, 70], [-70, 70]]) {
    w.parts.push(part([sx, 2.5, sz], [1, 5, 1], '#5d4037', { name: 'ScarePole', m: 'wood' }));
    w.parts.push(part([sx, 4, sz], [5, 1, 1], '#5d4037', { name: 'ScareArms', m: 'wood' }));
    w.parts.push(part([sx, 5.5, sz], [2, 2, 2], '#f2cc8f', { name: 'ScareHead' }));
    w.parts.push(part([sx, 6.8, sz], [2.6, 0.8, 2.6], '#7a3b1f', { name: 'ScareHat', m: 'plastic' }));
    candy(w, sx, 8, sz);
  }
  // dead trees
  for (let i = 0; i < 8; i++) {
    const tx = (r() - 0.5) * 180, tz = (r() - 0.5) * 180;
    if (Math.abs(tx) < 50 && Math.abs(tz + 40) < 50) continue;
    w.parts.push(part([tx, 4, tz], [1.5, 8, 1.5], '#4a3728', { name: 'DeadTrunk', m: 'wood' }));
    w.parts.push(part([tx + 2, 7, tz], [4, 1, 1], '#4a3728', { name: 'Branch', m: 'wood' }));
    w.parts.push(part([tx - 2, 6, tz], [4, 1, 1], '#4a3728', { name: 'Branch', m: 'wood' }));
  }
  // scattered candy
  for (let i = 0; i < 15; i++) candy(w, (r() - 0.5) * 170, 1.2, (r() - 0.5) * 170);
  // haunted barn (decorative shell you can walk into)
  w.parts.push(part([-80, 0.25, -80], [24, 0.5, 20], '#6d4c41', { name: 'BarnFloor', m: 'wood' }));
  w.parts.push(part([-80, 5, -90], [24, 10, 1], '#7a3b1f', { name: 'BarnWall', m: 'wood' }));
  w.parts.push(part([-92, 5, -80], [1, 10, 20], '#7a3b1f', { name: 'BarnWall', m: 'wood' }));
  w.parts.push(part([-68, 5, -80], [1, 10, 20], '#7a3b1f', { name: 'BarnWall', m: 'wood' }));
  w.parts.push(part([-80, 10.5, -80], [26, 1, 22], '#5d4037', { name: 'BarnRoof', m: 'wood' }));
  for (let i = 0; i < 4; i++) candy(w, -88 + i * 5, 1.5, -80);
  return w;
}

// 3. WITCH'S TOWER CLIMB - crooked tower, themed floors
export function hwWitch() {
  const w = startWorld('#101826');
  const r = rng(777);
  w.parts.push(part([0, -0.5, 0], [160, 1, 160], '#1c2b1c', { name: 'Ground', m: 'grass' }));
  w.parts.push(part([0, 0.25, 30], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  // crooked tower core (stacked offset rings)
  let cx = 0, cz = 0, y = 0;
  const towerCols = ['#3a3a4a', '#43435a', '#33333f'];
  for (let f = 0; f < 8; f++) {
    cx += (r() - 0.5) * 4; cz += (r() - 0.5) * 4; // crooked lean
    const hh = 12;
    // ring walls (4 sides with a door gap on alternating sides)
    const s = 16 - f; // tower narrows as it rises
    const gapSide = f % 4;
    if (gapSide !== 0) w.parts.push(part([cx, y + hh / 2, cz - s / 2], [s, hh, 1.5], towerCols[f % 3], { name: 'TowerWall', m: 'brick' }));
    if (gapSide !== 1) w.parts.push(part([cx, y + hh / 2, cz + s / 2], [s, hh, 1.5], towerCols[f % 3], { name: 'TowerWall', m: 'brick' }));
    if (gapSide !== 2) w.parts.push(part([cx - s / 2, y + hh / 2, cz], [1.5, hh, s], towerCols[f % 3], { name: 'TowerWall', m: 'brick' }));
    if (gapSide !== 3) w.parts.push(part([cx + s / 2, y + hh / 2, cz], [1.5, hh, s], towerCols[f % 3], { name: 'TowerWall', m: 'brick' }));
    y += hh;
  }
  // FLOOR 1: potion cellar - big potion bottle platforms spiraling up
  const potionC = ['#9b59b6', '#2ecc71', '#e74c3c', '#3498db'];
  let a = 0, py = 2;
  for (let i = 0; i < 10; i++) {
    a += 0.65; py += 2.2;
    const px = Math.cos(a) * 9, pz = Math.sin(a) * 9;
    w.parts.push(part([px, py, pz], [4, 1, 4], potionC[i % 4], { name: 'Potion' + i, m: 'glass' }));
    w.parts.push(part([px, py + 1.2, pz], [1.5, 1.5, 1.5], potionC[i % 4], { name: 'PotionTop' + i, m: 'neon', cc: false }));
    if (i % 3 === 0) candy(w, px, py + 2, pz);
  }
  w.parts.push(part([Math.cos(a) * 9, py + 0.75, Math.sin(a) * 9], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint1', k: 'checkpoint', m: 'neon' }));
  // FLOOR 2: broomstick beams (thin, with cursed gaps)
  const by = py + 3;
  for (let i = 0; i < 8; i++) {
    a += 0.55; const rad = 8;
    const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad;
    w.parts.push(part([bx, by + i * 1.8, bz], [1.2, 1, 7], '#8b5a2b', { name: 'Broom' + i, m: 'wood' }));
    if (i % 4 === 3) w.parts.push(part([bx, by + i * 1.8 + 0.75, bz], [1.2, 0.5, 2], '#ff2020', { name: 'Curse' + i, k: 'kill', m: 'neon' }));
    candy(w, bx, by + i * 1.8 + 1.5, bz);
  }
  const cy = by + 8 * 1.8;
  w.parts.push(part([Math.cos(a) * 8, cy + 0.75, Math.sin(a) * 8], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint2', k: 'checkpoint', m: 'neon' }));
  // FLOOR 3: giant spellbook steps
  const bookC = ['#8e44ad', '#16a085', '#d35400'];
  for (let i = 0; i < 7; i++) {
    a += 0.6; const rad = 7;
    const bx = Math.cos(a) * rad, bz = Math.sin(a) * rad, bz2 = cy + 3 + i * 2.4;
    w.parts.push(part([bx, bz2, bz], [6, 1, 4], bookC[i % 3], { name: 'Spellbook' + i, m: 'plastic' }));
    w.parts.push(part([bx, bz2 + 0.8, bz], [4.5, 0.6, 3], '#f4f1de', { name: 'Pages' + i, cc: false }));
    candy(w, bx, bz2 + 1.6, bz);
  }
  const ty = cy + 3 + 7 * 2.4;
  w.parts.push(part([Math.cos(a) * 7, ty + 0.75, Math.sin(a) * 7], [5, 0.5, 5], '#2ec4ff', { name: 'Checkpoint3', k: 'checkpoint', m: 'neon' }));
  // FLOOR 4: crystal platforms to the cauldron
  for (let i = 0; i < 6; i++) {
    a += 0.7; const rad = 6 - i * 0.5;
    const px = Math.cos(a) * rad, pz = Math.sin(a) * rad, pz2 = ty + 2 + i * 2.2;
    w.parts.push(part([px, pz2, pz], [3.5, 1, 3.5], '#af7ac5', { name: 'Crystal' + i, m: 'neon' }));
    candy(w, px, pz2 + 1.5, pz);
  }
  // CAULDRON TOP with win pad
  const wy = ty + 2 + 6 * 2.2 + 2;
  w.parts.push(part([0, wy, 0], [14, 1, 14], '#2c2c3a', { name: 'TopPlatform', m: 'concrete' }));
  w.parts.push(part([0, wy + 1.5, 0], [8, 3, 8], '#1a1a1a', { name: 'Cauldron', m: 'plastic' }));
  w.parts.push(part([0, wy + 3.2, 0], [6.5, 0.5, 6.5], '#2ecc71', { name: 'Brew', m: 'neon', cc: false }));
  w.parts.push(part([5, wy + 0.75, 5], [4, 0.5, 4], '#ffffff', { name: 'WinPad', k: 'win', m: 'neon' }));
  // witch hat decor on the tower
  w.parts.push(part([cx, y + 3, cz], [6, 1.5, 6], '#1a1a2e', { name: 'HatBrim', m: 'plastic', cc: false }));
  w.parts.push(part([cx, y + 6, cz], [3.5, 6, 3.5], '#1a1a2e', { name: 'HatTop', m: 'plastic', cc: false }));
  return w;
}

// 4. GHOST TOWN HANGOUT - spooky western town + graveyard
export function hwGhost() {
  const w = startWorld('#16121e');
  const r = rng(1313);
  w.parts.push(part([0, -0.5, 0], [240, 1, 240], '#3d3229', { name: 'Dirt', m: 'sand' }));
  // main street
  w.parts.push(part([0, 0.05, 0], [14, 0.1, 200], '#2e2620', { name: 'Street', m: 'concrete' }));
  w.parts.push(part([0, 0.25, 80], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  // buildings: saloon, bank, hotel, jail (facades you can enter)
  const buildings = [
    { x: -22, z: 40, n: 'Saloon', c: '#7a4a2b' }, { x: 22, z: 40, n: 'Bank', c: '#6e6e6e' },
    { x: -22, z: -10, n: 'Hotel', c: '#8b5e34' }, { x: 22, z: -10, n: 'Jail', c: '#5a5a5a' },
    { x: -22, z: -60, n: 'GeneralStore', c: '#75563a' }, { x: 22, z: -60, n: 'Church', c: '#d5cdbf' },
  ];
  for (const b of buildings) {
    const Wd = 18, Dp = 14, Ht = 9;
    w.parts.push(part([b.x, 0.25, b.z], [Wd + 2, 0.5, Dp + 2], '#4a3b2c', { name: b.n + 'Floor', m: 'wood' }));
    w.parts.push(part([b.x, Ht / 2, b.z - Dp / 2], [Wd, Ht, 1], b.c, { name: b.n + 'Back', m: 'wood' }));
    w.parts.push(part([b.x - Wd / 2, Ht / 2, b.z], [1, Ht, Dp], b.c, { name: b.n + 'Side', m: 'wood' }));
    w.parts.push(part([b.x + Wd / 2, Ht / 2, b.z], [1, Ht, Dp], b.c, { name: b.n + 'Side', m: 'wood' }));
    // front with door gap
    w.parts.push(part([b.x - 6, Ht / 2, b.z + Dp / 2], [6, Ht, 1], b.c, { name: b.n + 'Front', m: 'wood' }));
    w.parts.push(part([b.x + 6, Ht / 2, b.z + Dp / 2], [6, Ht, 1], b.c, { name: b.n + 'Front', m: 'wood' }));
    w.parts.push(part([b.x, Ht - 1.5, b.z + Dp / 2], [6, 3, 1], b.c, { name: b.n + 'Lintel', m: 'wood' }));
    w.parts.push(part([b.x, Ht + 0.5, b.z], [Wd + 2, 1, Dp + 2], '#3a2e22', { name: b.n + 'Roof', m: 'wood' }));
    // sign
    w.parts.push(part([b.x, Ht + 2, b.z + Dp / 2 + 0.5], [10, 2, 0.5], '#f1c40f', { name: b.n + 'Sign', m: 'neon', cc: false }));
    // interior table
    w.parts.push(part([b.x, 1, b.z - 2], [4, 1.5, 4], '#5d4037', { name: b.n + 'Table', m: 'wood' }));
    candy(w, b.x, 2.5, b.z - 2);
  }
  // graveyard (east side)
  w.parts.push(part([70, 0.1, -40], [60, 0.2, 60], '#2b3a2b', { name: 'GraveyardGrass', m: 'grass' }));
  for (let i = 0; i < 12; i++) {
    const gx = 50 + (i % 4) * 14, gz = -60 + ((i / 4) | 0) * 14;
    w.parts.push(part([gx, 1, gz], [2, 2, 0.8], '#9e9e9e', { name: 'Tombstone' + i, m: 'concrete' }));
    w.parts.push(part([gx, 0.3, gz + 2], [3, 0.6, 5], '#5d4037', { name: 'Grave' + i, m: 'wood' }));
    if (i % 3 === 0) candy(w, gx, 2.5, gz);
  }
  // creepy fence around graveyard
  for (let i = 0; i <= 6; i++) {
    w.parts.push(part([40 + i * 10, 1.5, -72], [1, 3, 1], '#333', { name: 'IronFence', m: 'plastic' }));
    w.parts.push(part([40 + i * 10, 1.5, -8], [1, 3, 1], '#333', { name: 'IronFence', m: 'plastic' }));
  }
  // old well in town square
  w.parts.push(part([-40, 1.5, 30], [8, 3, 8], '#6e6e6e', { name: 'WellBase', m: 'brick' }));
  w.parts.push(part([-40, 3.2, 30], [6, 0.5, 6], '#0a0a0a', { name: 'WellHole', cc: false }));
  w.parts.push(part([-43, 5, 30], [1, 5, 1], '#5d4037', { name: 'WellPost', m: 'wood' }));
  w.parts.push(part([-37, 5, 30], [1, 5, 1], '#5d4037', { name: 'WellPost', m: 'wood' }));
  w.parts.push(part([-40, 7.5, 30], [8, 1, 4], '#4a3728', { name: 'WellRoof', m: 'wood' }));
  candy(w, -40, 9, 30);
  // lamp posts with ghostly lights
  for (const [lx, lz] of [[-10, 60], [10, 20], [-10, -20], [10, -60]]) {
    w.parts.push(part([lx, 3, lz], [0.8, 6, 0.8], '#222', { name: 'LampPost', m: 'plastic' }));
    w.parts.push(part([lx, 6.5, lz], [1.5, 1.5, 1.5], '#b39ddb', { name: 'GhostLight', m: 'neon', cc: false }));
  }
  // floating ghost decor (non-collidable)
  for (let i = 0; i < 5; i++) {
    const gx = (r() - 0.5) * 120, gz = (r() - 0.5) * 120;
    w.parts.push(part([gx, 12 + r() * 6, gz], [3, 4, 2], '#ffffff', { name: 'Ghost', m: 'glass', cc: false, tr: 0.5 }));
  }
  // scattered candy
  for (let i = 0; i < 12; i++) candy(w, (r() - 0.5) * 180, 1.5, (r() - 0.5) * 180);
  return w;
}

// 5. SPOOKY BASEPLATE - haunted building base with mini castle
export function hwBase() {
  const w = startWorld('#0f0f18');
  const r = rng(666);
  w.parts.push(part([0, -0.5, 0], [256, 1, 256], '#2a2a35', { name: 'Baseplate', m: 'baseplate' }));
  w.parts.push(part([0, 0.25, 40], [6, 0.5, 6], '#6b6b6b', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' }));
  // mini haunted castle centerpiece (climbable)
  const cc = '#4a4a5e';
  w.parts.push(part([0, 2, -20], [30, 4, 30], cc, { name: 'CastleBase', m: 'brick' }));
  for (const [tx, tz] of [[-12, -32], [12, -32], [-12, -8], [12, -8]]) {
    w.parts.push(part([tx, 9, tz], [6, 14, 6], cc, { name: 'CastleTower', m: 'brick' }));
    w.parts.push(part([tx, 17, tz], [8, 2, 8], '#3d3d52', { name: 'TowerTop', m: 'brick' }));
    candy(w, tx, 19, tz);
  }
  w.parts.push(part([0, 8, -20], [32, 8, 32], cc, { name: 'CastleMid', m: 'brick' }));
  w.parts.push(part([0, 13, -20], [20, 2, 20], '#3d3d52', { name: 'CastleRoof', m: 'brick' }));
  // gate arch
  w.parts.push(part([-4, 6, -4], [2, 8, 2], '#3d3d52', { name: 'GatePillar', m: 'brick' }));
  w.parts.push(part([4, 6, -4], [2, 8, 2], '#3d3d52', { name: 'GatePillar', m: 'brick' }));
  w.parts.push(part([0, 10.5, -4], [10, 1.5, 2], '#3d3d52', { name: 'GateArch', m: 'brick' }));
  // dead trees around
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2, rad = 60 + r() * 40;
    const tx = Math.cos(a) * rad, tz = Math.sin(a) * rad - 10;
    w.parts.push(part([tx, 4, tz], [1.5, 8, 1.5], '#3a2e22', { name: 'DeadTree', m: 'wood' }));
    w.parts.push(part([tx + 2, 7, tz], [4, 1, 1], '#3a2e22', { name: 'Branch', m: 'wood' }));
  }
  // jack-o-lantern ring
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, rad = 35;
    const px = Math.cos(a) * rad, pz = Math.sin(a) * rad - 10;
    w.parts.push(part([px, 1, pz], [2, 2, 2], '#e67e22', { name: 'Jackolantern' }));
    w.parts.push(part([px, 1.2, pz + 1.05], [0.5, 0.5, 0.2], '#ffca28', { name: 'GlowFace', m: 'neon', cc: false }));
  }
  // crooked fence bits
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, rad = 90;
    w.parts.push(part([Math.cos(a) * rad, 1.5, Math.sin(a) * rad - 10], [1, 3, 1], '#4a3728', { name: 'FencePost', m: 'wood' }));
  }
  // floating island with candy (parkour teaser)
  w.parts.push(part([-50, 14, 50], [10, 2, 10], '#5d4037', { name: 'FloatIsland', m: 'wood' }));
  w.parts.push(part([-50, 16, 50], [2, 2, 2], '#e67e22', { name: 'IslandPumpkin' }));
  for (let i = 0; i < 3; i++) candy(w, -50 + (i - 1) * 3, 17.5, 50);
  return w;
}
