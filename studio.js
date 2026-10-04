import * as THREE from 'three';
import { TransformControls } from 'three/addons/controls/TransformControls.js';
import { setupLighting, makePartMesh, findSpawn, worldThumbnail } from './three-util.js';

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const PRESETS = {
  part: { name: 'Part', s: [4, 1, 2], c: '#a3a2a5', k: 'part', m: 'plastic' },
  spawn: { name: 'SpawnLocation', s: [6, 0.5, 6], c: '#6b6b6b', k: 'spawn', m: 'spawn' },
  kill: { name: 'KillBrick', s: [4, 1, 4], c: '#ff2020', k: 'kill', m: 'neon' },
  checkpoint: { name: 'Checkpoint', s: [5, 0.5, 5], c: '#2ec4ff', k: 'checkpoint', m: 'neon' },
  coin: { name: 'Coin', s: [1.2, 1.2, 1.2], c: '#ffd400', k: 'coin', m: 'plastic' },
  bounce: { name: 'BouncePad', s: [6, 1, 6], c: '#22ff88', k: 'bounce', m: 'neon' },
  speed: { name: 'SpeedPad', s: [4, 0.5, 4], c: '#ff9800', k: 'speed', m: 'neon' },
  win: { name: 'WinPad', s: [8, 0.5, 8], c: '#ffffff', k: 'win', m: 'neon' },
};
const MATERIALS = ['plastic', 'neon', 'grass', 'wood', 'brick', 'glass', 'concrete', 'sand', 'metal', 'baseplate', 'spawn'];
const KINDS = ['part', 'spawn', 'kill', 'checkpoint', 'win', 'bounce', 'coin', 'speed'];
const toHex = c => '#' + new THREE.Color(c).getHexString();

export class Studio {
  constructor(container, o) {
    this.c = container; this.o = o;
    this.world = structuredClone(o.world);
    this.gameId = o.gameId || null; this.name = o.name || 'Untitled Game'; this.description = o.description || '';
    this.meshes = new Map(); this.sel = null; this.undoStack = []; this.redoStack = []; this.dirty = false;
    this.snap = true; this.keys = {};
    this.dom(); this.three(); this.bind(); this.rebuildAll();
    const sp = findSpawn(this.world);
    this.camPos = new THREE.Vector3(sp.x + 30, sp.y + 25, sp.z + 30); this.yaw = Math.PI / 4; this.pitch = -0.5;
    this.last = performance.now(); this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }

  dom() {
    const tool = (id, label, icon, title) => `<button class="rb-btn" data-tool="${id}" title="${title}"><span class="rb-ico">${icon}</span>${label}</button>`;
    const ins = (k, label, color) => `<button class="rb-btn" data-insert="${k}" title="Insert ${label}"><span class="rb-ico"><i class="sw" style="background:${color}"></i></span>${label}</button>`;
    this.c.innerHTML = `
    <div class="studio">
      <div class="st-top">
        <div class="st-title"><span class="ff-mini">FF</span> FriendFun Studio <span class="st-gname">${esc(this.name)}</span><span class="st-dirty"></span></div>
        <div class="st-top-actions"><button class="st-act" data-a="save">Save</button><button class="st-act pub" data-a="publish">Publish</button><button class="st-act" data-a="exit">Exit</button></div>
      </div>
      <div class="st-ribbon">
        <div class="rb-group"><div class="rb-row">
          ${tool('select', 'Select', '&#x2196;', 'Select (1)')}${tool('move', 'Move', '&#x2725;', 'Move (2)')}${tool('scale', 'Scale', '&#x2922;', 'Scale (3)')}
        </div><div class="rb-label">Tools</div></div>
        <div class="rb-group"><div class="rb-row">
          ${ins('part', 'Part', '#a3a2a5')}${ins('spawn', 'Spawn', '#6b6b6b')}${ins('kill', 'Kill', '#ff2020')}${ins('checkpoint', 'Checkpoint', '#2ec4ff')}${ins('coin', 'Coin', '#ffd400')}${ins('bounce', 'Bounce', '#22ff88')}${ins('speed', 'Speed', '#ff9800')}${ins('win', 'Win', '#ffffff')}
        </div><div class="rb-label">Insert</div></div>
        <div class="rb-group"><div class="rb-row">
          <button class="rb-btn" data-a="stairs" title="Insert a staircase"><span class="rb-ico">▰</span>Stairs</button>
          <button class="rb-btn" data-a="platform" title="Insert a large platform"><span class="rb-ico">▰</span>Platform</button>
          <button class="rb-btn" data-a="wall" title="Insert a wall"><span class="rb-ico">▤</span>Wall</button>
          <button class="rb-btn" data-a="tower" title="Build a tower"><span class="rb-ico">▥</span>Tower</button>
          <button class="rb-btn" data-a="tree" title="Build a tree"><span class="rb-ico">♣</span>Tree</button>
          <button class="rb-btn" data-a="coinLine" title="Insert five coins"><span class="rb-ico">●</span>Coin Line</button>
          <button class="rb-btn" data-a="mirror" title="Mirror selected part across the center"><span class="rb-ico">↔</span>Mirror</button>
        </div><div class="rb-label">Quick Build</div></div>
        <div class="rb-group"><div class="rb-row">
          <label class="rb-btn" title="Color of selection"><input type="color" class="rb-color" value="#a3a2a5">Color</label>
          <label class="rb-btn" title="Material of selection"><select class="rb-mat">${MATERIALS.map(m => `<option>${m}</option>`).join('')}</select>Material</label>
          <label class="rb-btn" title="Snap to grid"><input type="checkbox" class="rb-snap" checked>Snap</label>
        </div><div class="rb-label">Part</div></div>
        <div class="rb-group"><div class="rb-row">
          <button class="rb-btn" data-a="dup" title="Duplicate (Ctrl+D)"><span class="rb-ico">&#x2750;</span>Duplicate</button>
          <button class="rb-btn" data-a="del" title="Delete (Del)"><span class="rb-ico">&#x2716;</span>Delete</button>
          <button class="rb-btn" data-a="undo" title="Undo (Ctrl+Z)"><span class="rb-ico">&#x21B6;</span>Undo</button>
          <button class="rb-btn" data-a="redo" title="Redo (Ctrl+Y)"><span class="rb-ico">&#x21B7;</span>Redo</button>
        </div><div class="rb-label">Edit</div></div>
        <div class="rb-group"><div class="rb-row">
          <button class="rb-btn" data-a="export" title="Export the current world as JSON"><span class="rb-ico">⇩</span>Export</button>
          <button class="rb-btn" data-a="import" title="Import a world JSON file"><span class="rb-ico">⇧</span>Import</button>
        </div><div class="rb-label">Project</div></div>
        <div class="rb-group"><div class="rb-row">
          <button class="rb-btn play" data-a="play" title="Play test (F5)"><span class="rb-ico">&#x25B6;</span>Play</button>
          <button class="rb-btn" data-a="focusSpawn" title="Focus the camera on the spawn"><span class="rb-ico">⌖</span>Spawn</button>
          <button class="rb-btn" data-a="topView" title="Switch to a top-down view"><span class="rb-ico">⬇</span>Top View</button>
          <label class="rb-btn" title="Sky color"><input type="color" class="rb-sky" value="${toHex(this.world.sky || '#8fc8ff')}">Sky</label>
        </div><div class="rb-label">Test</div></div>
      </div>
      <div class="st-main">
        <div class="st-view"><canvas class="st-canvas"></canvas><div class="st-hint">Right-drag to look &middot; WASD/QE to fly &middot; Wheel to zoom &middot; F to focus &middot; Click to select</div></div>
        <div class="st-side">
          <div class="st-panel"><div class="st-panel-h">Explorer</div><div class="st-explorer"></div></div>
          <div class="st-panel"><div class="st-panel-h">Properties</div><div class="st-props"><div class="st-empty">Select a part to see its properties</div></div></div>
        </div>
      </div>
      <div class="st-play hidden"></div>
    </div>`;
    const q = s => this.c.querySelector(s);
    this.canvas = q('.st-canvas'); this.explorer = q('.st-explorer'); this.props = q('.st-props');
    this.importInput = document.createElement('input'); this.importInput.type = 'file'; this.importInput.accept = '.json,application/json'; this.importInput.hidden = true; this.c.appendChild(this.importInput);
    this.c.querySelector('.studio').addEventListener('click', e => {
      const t = e.target.closest('[data-tool]'); if (t) this.setTool(t.dataset.tool);
      const i = e.target.closest('[data-insert]'); if (i) this.insert(i.dataset.insert);
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'dup') this.duplicate(); if (a === 'del') this.remove(); if (a === 'undo') this.undo(); if (a === 'redo') this.redo();
      if (a === 'stairs') this.insertStairs(); if (a === 'platform') this.insertPlatform(); if (a === 'wall') this.insertWall(); if (a === 'tower') this.insertTower(); if (a === 'tree') this.insertTree(); if (a === 'coinLine') this.insertCoinLine(); if (a === 'mirror') this.mirror();
      if (a === 'focusSpawn') this.focusSpawn(); if (a === 'topView') this.topView(); if (a === 'export') this.exportWorld(); if (a === 'import') this.importInput.click();
      if (a === 'play') this.play(); if (a === 'save') this.save(); if (a === 'publish') this.publishDialog(); if (a === 'exit') this.exit();
    });
    q('.rb-color').oninput = e => { if (this.sel) { this.pushUndo(); this.sel.c = e.target.value; this.refresh(this.sel); } };
    q('.rb-mat').onchange = e => { if (this.sel) { this.pushUndo(); this.sel.m = e.target.value; this.refresh(this.sel); } };
    q('.rb-snap').onchange = e => { this.snap = e.target.checked; this.applySnap(); };
    q('.rb-sky').oninput = e => { this.world.sky = e.target.value; this.scene.background.set(e.target.value); this.scene.fog.color.set(e.target.value); this.markDirty(); };
    this.importInput.onchange = e => this.importWorld(e.target.files?.[0]);
  }

  three() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, preserveDrawingBuffer: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.shadowMap.enabled = true; r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene(); setupLighting(this.scene, this.world.sky || '#8fc8ff');
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);
    this.grid = new THREE.GridHelper(512, 128, 0x000000, 0x000000); this.grid.material.opacity = 0.08; this.grid.material.transparent = true; this.grid.position.y = 0.01;
    this.scene.add(this.grid);
    this.tc = new TransformControls(this.camera, this.canvas);
    this.tc.addEventListener('dragging-changed', e => {
      this.tcDragging = e.value;
      if (e.value) this.pushUndo();
      else this.bakeTransform();
    });
    this.tc.addEventListener('objectChange', () => this.liveTransform());
    this.scene.add(this.tc);
    this.selBox = new THREE.Box3Helper(new THREE.Box3(), 0x2f8cff); this.selBox.visible = false; this.scene.add(this.selBox);
    this.ray = new THREE.Raycaster();
    this.setTool('move'); this.applySnap(); this.resize();
  }
  resize() {
    const v = this.c.querySelector('.st-view'); const w = v.clientWidth, h = v.clientHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }
  setTool(t) {
    this.tool = t;
    this.c.querySelectorAll('[data-tool]').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    if (t === 'select') this.tc.detach(); else { this.tc.setMode(t === 'move' ? 'translate' : 'scale'); if (this.sel) this.tc.attach(this.meshes.get(this.sel.id)); }
  }
  applySnap() { this.tc.setTranslationSnap(this.snap ? 1 : null); this.tc.setScaleSnap(this.snap ? 0.25 : null); }

  // ---------- world mesh management ----------
  rebuildAll() {
    for (const m of this.meshes.values()) { this.scene.remove(m); if (m.userData.part.k !== 'coin') m.geometry.dispose(); }
    this.meshes.clear(); this.tc.detach();
    for (const p of this.world.parts) this.addMesh(p);
    if (this.sel) this.sel = this.world.parts.find(p => p.id === this.sel.id) || null;
    this.select(this.sel);
    this.renderExplorer();
  }
  addMesh(p) { const m = makePartMesh(p); if (p.k === 'coin') m.userData.spin = false; this.scene.add(m); this.meshes.set(p.id, m); return m; }
  refresh(p) {
    const old = this.meshes.get(p.id); const wasAttached = this.tc.object === old;
    if (old) { this.scene.remove(old); if (p.k !== 'coin' && old.geometry.type === 'BoxGeometry') old.geometry.dispose(); }
    const m = this.addMesh(p); if (wasAttached) this.tc.attach(m);
    this.markDirty(); this.renderProps(); this.renderExplorerItem(p);
  }
  markDirty() { this.dirty = true; this.c.querySelector('.st-dirty').textContent = ' *'; }
  newId() { let i = this.world.parts.length + 1; const ids = new Set(this.world.parts.map(p => p.id)); while (ids.has('p' + i)) i++; return 'p' + i; }

  // ---------- selection ----------
  select(p) {
    this.sel = p || null;
    if (p && this.tool !== 'select') this.tc.attach(this.meshes.get(p.id)); else this.tc.detach();
    this.selBox.visible = !!p;
    if (p) { this.c.querySelector('.rb-color').value = toHex(p.c); this.c.querySelector('.rb-mat').value = p.m; }
    this.explorer.querySelectorAll('.ex-item').forEach(e => e.classList.toggle('sel', !!p && e.dataset.id === p.id));
    const el = p && this.explorer.querySelector(`[data-id="${p.id}"]`); if (el) el.scrollIntoView({ block: 'nearest' });
    this.renderProps();
  }
  renderExplorer() {
    this.explorer.innerHTML = `<div class="ex-root">&#x25B8; Workspace</div>` + this.world.parts.map(p => `<div class="ex-item" data-id="${p.id}"><i class="sw" style="background:${p.c}"></i>${esc(p.name)}</div>`).join('');
    this.explorer.onclick = e => { const it = e.target.closest('.ex-item'); if (it) this.select(this.world.parts.find(p => p.id === it.dataset.id)); };
  }
  renderExplorerItem(p) { const el = this.explorer.querySelector(`[data-id="${p.id}"]`); if (el) el.innerHTML = `<i class="sw" style="background:${p.c}"></i>${esc(p.name)}`; }
  renderProps() {
    const p = this.sel;
    if (!p) { this.props.innerHTML = '<div class="st-empty">Select a part to see its properties</div>'; return; }
    const v3 = (k, label) => `<div class="pr-row"><span>${label}</span><div class="pr-v3">${[0, 1, 2].map(i => `<input type="number" step="0.5" data-v3="${k}" data-i="${i}" value="${+p[k][i].toFixed(2)}">`).join('')}</div></div>`;
    this.props.innerHTML = `
      <div class="pr-sec">Data</div>
      <div class="pr-row"><span>Name</span><input data-f="name" value="${esc(p.name)}"></div>
      <div class="pr-sec">Appearance</div>
      <div class="pr-row"><span>Color</span><input type="color" data-f="c" value="${toHex(p.c)}"></div>
      <div class="pr-row"><span>Material</span><select data-f="m">${MATERIALS.map(m => `<option ${m === p.m ? 'selected' : ''}>${m}</option>`).join('')}</select></div>
      <div class="pr-row"><span>Transparency</span><input type="number" min="0" max="1" step="0.1" data-f="tr" value="${p.tr || 0}"></div>
      <div class="pr-sec">Behavior</div>
      <div class="pr-row"><span>Type</span><select data-f="k">${KINDS.map(k => `<option ${k === p.k ? 'selected' : ''}>${k}</option>`).join('')}</select></div>
      <div class="pr-row"><span>CanCollide</span><input type="checkbox" data-f="cc" ${p.cc !== false ? 'checked' : ''}></div>
      <div class="pr-sec">Transform</div>
      ${v3('p', 'Position')}${v3('s', 'Size')}`;
    this.props.querySelectorAll('input,select').forEach(inp => inp.addEventListener('change', () => {
      this.pushUndo();
      if (inp.dataset.v3) { const v = parseFloat(inp.value); if (!isNaN(v)) p[inp.dataset.v3][+inp.dataset.i] = inp.dataset.v3 === 's' ? Math.max(0.05, v) : v; }
      else { const f = inp.dataset.f; if (f === 'cc') { if (inp.checked) delete p.cc; else p.cc = false; } else if (f === 'tr') { const t = Math.max(0, Math.min(1, parseFloat(inp.value) || 0)); if (t) p.tr = t; else delete p.tr; } else p[f] = inp.value; }
      this.refresh(p);
    }));
  }

  // ---------- editing ----------
  pushUndo() { this.undoStack.push(JSON.stringify(this.world.parts)); if (this.undoStack.length > 60) this.undoStack.shift(); this.redoStack = []; }
  undo() { if (!this.undoStack.length) return; this.redoStack.push(JSON.stringify(this.world.parts)); this.world.parts = JSON.parse(this.undoStack.pop()); this.rebuildAll(); this.markDirty(); }
  redo() { if (!this.redoStack.length) return; this.undoStack.push(JSON.stringify(this.world.parts)); this.world.parts = JSON.parse(this.redoStack.pop()); this.rebuildAll(); this.markDirty(); }
  insert(kind) {
    this.pushUndo();
    const pr = PRESETS[kind];
    this.ray.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    const hit = this.ray.intersectObjects([...this.meshes.values()], false)[0];
    const at = hit ? hit.point : this.camPos.clone().add(new THREE.Vector3(0, 0, -20).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')));
    const p = { id: this.newId(), name: pr.name, p: [Math.round(at.x), +(at.y + pr.s[1] / 2).toFixed(2), Math.round(at.z)], s: [...pr.s], c: pr.c, k: pr.k, m: pr.m };
    this.world.parts.push(p); this.addMesh(p); this.renderExplorer(); this.select(p); this.markDirty();
    if (this.tool === 'select') this.setTool('move');
  }
  duplicate() {
    if (!this.sel) return; this.pushUndo();
    const p = { ...structuredClone(this.sel), id: this.newId() }; p.p[1] += p.s[1];
    this.world.parts.push(p); this.addMesh(p); this.renderExplorer(); this.select(p); this.markDirty();
  }
  buildPart(name, p, s, c = '#a3a2a5', k = 'part', m = 'plastic') {
    return { id: this.newId(), name, p: p.map(v => +v.toFixed(2)), s: s.map(v => +v.toFixed(2)), c, k, m };
  }
  addBuild(parts) {
    this.pushUndo();
    const existing = new Set(this.world.parts.map(p => p.id));
    for (const p of parts) { while (existing.has(p.id)) p.id = this.newId(); existing.add(p.id); this.world.parts.push(p); this.addMesh(p); }
    this.renderExplorer(); this.select(parts.at(-1) || null); this.markDirty();
  }
  buildOrigin() { return this.sel ? new THREE.Vector3(...this.sel.p) : this.camPos.clone().addScaledVector(this.forward(), 14); }
  insertPlatform() { const b = this.buildOrigin(); this.addBuild([this.buildPart('Platform', [Math.round(b.x), Math.max(0.5, Math.round(b.y)), Math.round(b.z)], [16, 1, 16], '#4aa3ff')]); }
  insertWall() { const b = this.buildOrigin(); this.addBuild([this.buildPart('Wall', [Math.round(b.x), Math.max(2, Math.round(b.y) + 3), Math.round(b.z)], [16, 6, 1])]); }
  insertTower() { const b = this.buildOrigin(), parts = []; for (let i = 0; i < 5; i++) parts.push(this.buildPart('Tower Floor ' + (i + 1), [Math.round(b.x), Math.round(b.y) + i * 5, Math.round(b.z)], [12, 1, 12], i % 2 ? '#7d8794' : '#a3a2a5')); this.addBuild(parts); }
  insertTree() { const b = this.buildOrigin(); this.addBuild([this.buildPart('Tree Trunk', [Math.round(b.x), Math.round(b.y) + 3, Math.round(b.z)], [2, 6, 2], '#7a4b24', 'part', 'wood'), this.buildPart('Tree Crown', [Math.round(b.x), Math.round(b.y) + 7, Math.round(b.z)], [7, 5, 7], '#35a854', 'part', 'grass')]); }
  focusSpawn() { const sp = findSpawn(this.world); this.camPos.set(sp.x + 18, sp.y + 12, sp.z + 18); this.yaw = Math.PI * 1.25; this.pitch = -0.45; }
  topView() { const p = this.sel ? new THREE.Vector3(...this.sel.p) : findSpawn(this.world); this.camPos.set(p.x, p.y + 80, p.z + 0.01); this.yaw = 0; this.pitch = -Math.PI / 2 + 0.001; }
  exportWorld() { const payload = JSON.stringify({ format: 'FriendFun Studio World', version: 1, name: this.name, description: this.description, world: this.world }, null, 2); const blob = new Blob([payload], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = (this.name || 'friendfun-game').replace(/[^a-z0-9_-]+/gi, '-').toLowerCase() + '.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); this.o.toast('World exported'); }
  async importWorld(file) {
    if (!file) return;
    try {
      const data = JSON.parse(await file.text()), world = data.world || data;
      if (!Array.isArray(world.parts)) throw new Error('Invalid world file');
      const parts = world.parts.slice(0, 5000).map((p, i) => {
        const vec = (v, fallback) => Array.isArray(v) ? [0, 1, 2].map(j => Number.isFinite(+v[j]) ? +v[j] : fallback[j]) : [...fallback];
        return {
          id: String(p.id || 'imported_' + i).slice(0, 20),
          name: String(p.name || 'Part').slice(0, 40),
          p: vec(p.p, [0, 0, 0]),
          s: vec(p.s, [1, 1, 1]).map(v => Math.max(0.05, Math.min(2048, v))),
          c: /^#[0-9a-fA-F]{6}$/.test(p.c) ? p.c : '#a3a2a5',
          k: KINDS.includes(p.k) ? p.k : 'part',
          m: MATERIALS.includes(p.m) ? p.m : 'plastic',
          ...(p.cc === false ? { cc: false } : {}),
          ...(p.tr ? { tr: Math.max(0, Math.min(1, +p.tr || 0)) } : {})
        };
      });
      const ids = new Set();
      for (const p of parts) { while (ids.has(p.id)) p.id += 'x'; ids.add(p.id); }
      this.pushUndo();
      this.world = { sky: /^#[0-9a-fA-F]{6}$/.test(world.sky) ? world.sky : '#8fc8ff', parts };
      this.rebuildAll(); this.markDirty(); this.o.toast('World imported');
    } catch (e) { this.o.toast('Could not import that world file', true); }
    this.importInput.value = '';
  }
  insertStairs() {
    this.pushUndo();
    const base = this.sel ? new THREE.Vector3(...this.sel.p) : this.camPos.clone().addScaledVector(this.forward(), 10);
    const parts = Array.from({ length: 6 }, (_, i) => ({ id: this.newId() + '_' + i, name: `Step ${i + 1}`, p: [Math.round(base.x), Math.max(.5, Math.round(base.y) + i + 1), Math.round(base.z) - i * 3], s: [8, 1, 3], c: '#4aa3ff', k: 'part', m: 'plastic' }));
    const existing = new Set(this.world.parts.map(p => p.id));
    for (const p of parts) { while (existing.has(p.id)) p.id += 'x'; existing.add(p.id); this.world.parts.push(p); this.addMesh(p); }
    this.renderExplorer(); this.select(parts.at(-1)); this.markDirty();
  }
  insertCoinLine() {
    this.pushUndo();
    const base = this.sel ? new THREE.Vector3(...this.sel.p) : this.camPos.clone().addScaledVector(this.forward(), 10);
    const parts = Array.from({ length: 5 }, (_, i) => ({ id: this.newId() + '_coin' + i, name: `Coin ${i + 1}`, p: [Math.round(base.x) + i * 3, Math.round(base.y) + 2, Math.round(base.z)], s: [1.2, 1.2, 1.2], c: '#ffd400', k: 'coin', m: 'plastic' }));
    const existing = new Set(this.world.parts.map(p => p.id));
    for (const p of parts) { while (existing.has(p.id)) p.id += 'x'; existing.add(p.id); this.world.parts.push(p); this.addMesh(p); }
    this.renderExplorer(); this.select(parts.at(-1)); this.markDirty();
  }
  mirror() {
    if (!this.sel) return this.o.toast('Select a part to mirror first', true);
    this.pushUndo();
    const p = structuredClone(this.sel); p.id = this.newId(); p.name = `${p.name} Mirror`; p.p[0] = -p.p[0];
    this.world.parts.push(p); this.addMesh(p); this.renderExplorer(); this.select(p); this.markDirty();
  }
  remove() {
    if (!this.sel) return; this.pushUndo();
    const m = this.meshes.get(this.sel.id); this.tc.detach(); this.scene.remove(m); this.meshes.delete(this.sel.id);
    this.world.parts = this.world.parts.filter(p => p !== this.sel);
    this.sel = null; this.renderExplorer(); this.select(null); this.markDirty();
  }
  liveTransform() {
    const m = this.tc.object; if (!m) return; const p = m.userData.part;
    if (this.tc.mode === 'translate') { p.p = [m.position.x, m.position.y, m.position.z].map(v => +v.toFixed(3)); }
  }
  bakeTransform() {
    const m = this.tc.object; if (!m) return; const p = m.userData.part;
    p.p = [m.position.x, m.position.y, m.position.z].map(v => +v.toFixed(3));
    if (m.scale.x !== 1 || m.scale.y !== 1 || m.scale.z !== 1) {
      if (p.k !== 'coin') p.s = [p.s[0] * Math.abs(m.scale.x), p.s[1] * Math.abs(m.scale.y), p.s[2] * Math.abs(m.scale.z)].map(v => Math.max(0.05, +v.toFixed(3)));
      m.scale.set(1, 1, 1);
    }
    this.refresh(p);
  }

  // ---------- input ----------
  bind() {
    let look = false, lx = 0, ly = 0, downAt = null;
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('pointerdown', e => {
      this.canvas.focus();
      if (e.button === 2) { look = true; lx = e.clientX; ly = e.clientY; this.canvas.setPointerCapture(e.pointerId); }
      if (e.button === 0) downAt = [e.clientX, e.clientY];
    });
    this.canvas.addEventListener('pointermove', e => {
      if (!look) return; this.yaw -= (e.clientX - lx) * 0.005; this.pitch = THREE.MathUtils.clamp(this.pitch - (e.clientY - ly) * 0.005, -1.5, 1.5); lx = e.clientX; ly = e.clientY;
    });
    this.canvas.addEventListener('pointerup', e => {
      if (e.button === 2) look = false;
      if (e.button === 0 && downAt && Math.hypot(e.clientX - downAt[0], e.clientY - downAt[1]) < 5 && !this.tcDragging && !this.tc.axis) {
        const r = this.canvas.getBoundingClientRect();
        this.ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), this.camera);
        const hit = this.ray.intersectObjects([...this.meshes.values()], false)[0];
        this.select(hit ? hit.object.userData.part : null);
      }
      downAt = null;
    });
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); const f = this.forward(); this.camPos.addScaledVector(f, e.deltaY > 0 ? -4 : 4); }, { passive: false });
    this.onKey = e => {
      if (!this.c.querySelector('.st-play').classList.contains('hidden')) return;
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
      const down = e.type === 'keydown'; this.keys[e.code] = down;
      if (!down) return;
      if (e.ctrlKey && e.code === 'KeyZ') { e.preventDefault(); this.undo(); }
      else if (e.ctrlKey && e.code === 'KeyY') { e.preventDefault(); this.redo(); }
      else if (e.ctrlKey && e.code === 'KeyD') { e.preventDefault(); this.duplicate(); }
      else if (e.ctrlKey && e.code === 'KeyS') { e.preventDefault(); this.save(); }
      else if (e.code === 'Delete' || e.code === 'Backspace') this.remove();
      else if (e.code === 'Digit1') this.setTool('select');
      else if (e.code === 'Digit2') this.setTool('move');
      else if (e.code === 'Digit3') this.setTool('scale');
      else if (e.code === 'KeyF' && this.sel) { const p = new THREE.Vector3(...this.sel.p); const d = Math.max(...this.sel.s) * 1.5 + 8; this.camPos.copy(p).addScaledVector(this.forward(), -d); }
      else if (e.code === 'F5') { e.preventDefault(); this.play(); }
      else if (e.code === 'KeyB') this.insertPlatform();
      else if (e.code === 'KeyT') this.insertTree();
    };
    addEventListener('keydown', this.onKey); addEventListener('keyup', this.onKey);
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize);
    this.onUnload = e => { if (this.dirty) { e.preventDefault(); e.returnValue = ''; } }; addEventListener('beforeunload', this.onUnload);
  }
  forward() { return new THREE.Vector3(0, 0, -1).applyEuler(new THREE.Euler(this.pitch, this.yaw, 0, 'YXZ')); }

  loop(now) {
    if (this.destroyed) return; this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
    if (!this.c.querySelector('.st-play').classList.contains('hidden')) return;
    const k = this.keys, sp = (k.ShiftLeft ? 120 : 40) * dt;
    const f = this.forward(), r = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    if (!k.ControlLeft && !k.ControlRight) {
      if (k.KeyW) this.camPos.addScaledVector(f, sp); if (k.KeyS) this.camPos.addScaledVector(f, -sp);
      if (k.KeyD) this.camPos.addScaledVector(r, sp); if (k.KeyA) this.camPos.addScaledVector(r, -sp);
      if (k.KeyE) this.camPos.y += sp; if (k.KeyQ) this.camPos.y -= sp;
    }
    this.camera.position.copy(this.camPos); this.camera.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    if (this.sel) { const m = this.meshes.get(this.sel.id); if (m) this.selBox.box.setFromObject(m).expandByScalar(0.05); }
    this.renderer.render(this.scene, this.camera);
  }

  // ---------- play / save / publish ----------
  play() {
    const box = this.c.querySelector('.st-play'); box.classList.remove('hidden');
    this.keys = {};
    this.o.playTest(box, structuredClone(this.world), this.name, () => { box.classList.add('hidden'); this.resize(); });
  }
  async save(extra = {}) {
    const body = { name: this.name, description: this.description, world: this.world, ...extra };
    try {
      if (this.gameId) await this.o.api('PUT', '/api/games/' + this.gameId, body);
      else { const r = await this.o.api('POST', '/api/games', body); this.gameId = r.id; this.o.onCreated?.(r.id); }
      this.dirty = false; this.c.querySelector('.st-dirty').textContent = '';
      this.o.toast(extra.publish ? 'Published! Your game is live.' : 'Saved');
      return true;
    } catch (e) { this.o.toast(e.message, true); return false; }
  }
  publishDialog() {
    const d = document.createElement('div'); d.className = 'modal-bg';
    d.innerHTML = `<div class="modal"><h2>Publish to FriendFun</h2>
      <label>Name<input class="pd-name" maxlength="50" value="${esc(this.name)}"></label>
      <label>Description<textarea class="pd-desc" maxlength="1000" rows="4">${esc(this.description)}</textarea></label>
      <div class="modal-actions"><button class="btn-secondary pd-cancel">Cancel</button><button class="btn-primary pd-ok">Publish</button></div></div>`;
    document.body.appendChild(d);
    d.querySelector('.pd-cancel').onclick = () => d.remove();
    d.querySelector('.pd-ok').onclick = async () => {
      this.name = d.querySelector('.pd-name').value.trim() || 'Untitled Game'; this.description = d.querySelector('.pd-desc').value;
      this.c.querySelector('.st-gname').textContent = this.name;
      const thumb = worldThumbnail(this.world);
      if (await this.save({ publish: true, thumbnail: thumb })) d.remove();
    };
  }
  exit() {
    if (this.dirty && !confirm('You have unsaved changes. Exit anyway?')) return;
    this.destroy(); this.o.onExit?.(this.gameId);
  }
  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this.onKey); removeEventListener('keyup', this.onKey); removeEventListener('resize', this.onResize); removeEventListener('beforeunload', this.onUnload);
    this.tc.dispose(); this.renderer.dispose(); this.c.innerHTML = '';
  }
}
