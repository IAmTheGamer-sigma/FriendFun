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
