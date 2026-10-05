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
  lava: { name: 'Lava', s: [4, 1, 4], c: '#ff4500', k: 'kill', m: 'neon' },
  ice: { name: 'Ice', s: [4, 1, 4], c: '#a0e8ff', k: 'part', m: 'glass' },
  wall: { name: 'Wall', s: [1, 12, 12], c: '#c0c0c0', k: 'part', m: 'brick' },
  platform: { name: 'Platform', s: [12, 1, 12], c: '#8b9a6b', k: 'part', m: 'grass' },
  gem: { name: 'Gem', s: [1.5, 1.5, 1.5], c: '#00ffcc', k: 'coin', m: 'neon' },
  pillar: { name: 'Pillar', s: [2, 12, 2], c: '#a3a2a5', k: 'part', m: 'concrete' },
};
const MATERIALS = ['plastic', 'neon', 'grass', 'wood', 'brick', 'glass', 'concrete', 'sand', 'metal', 'baseplate', 'spawn'];
const KINDS = ['part', 'spawn', 'kill', 'checkpoint', 'win', 'bounce', 'coin', 'speed'];
const toHex = c => '#' + new THREE.Color(c).getHexString();

export class Studio {
  constructor(container, o) {
    this.c = container; this.o = o;
    this.world = structuredClone(o.world);
    if (!Array.isArray(this.world.folders)) this.world.folders = [];
    if (!Array.isArray(this.world.scripts)) this.world.scripts = [];
    this.gameId = o.gameId || null; this.name = o.name || 'Untitled Game'; this.description = o.description || '';
    this.meshes = new Map(); this.sel = null; this.closedFolders = new Set(); this.undoStack = []; this.redoStack = []; this.dirty = false;
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
          ${tool('select', 'Select', '&#x2196;', 'Select (1)')}${tool('move', 'Move', '&#x2725;', 'Move (2)')}${tool('scale', 'Scale', '&#x2922;', 'Scale (3)')}${tool('rotate', 'Rotate', '&#x27F3;', 'Rotate (4)')}
        </div><div class="rb-label">Tools</div></div>
        <div class="rb-group"><div class="rb-row">
          ${Object.entries(PRESETS).map(([k, pr]) => ins(k, pr.name, pr.c)).join('')}
        </div><div class="rb-label">Insert</div></div>
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
          <button class="rb-btn play" data-a="play" title="Play test (F5)"><span class="rb-ico">&#x25B6;</span>Play</button>
          <label class="rb-btn" title="Sky color"><input type="color" class="rb-sky" value="${toHex(this.world.sky || '#8fc8ff')}">Sky</label>
        </div><div class="rb-label">Test</div></div>
      </div>
      <div class="st-main">
        <div class="st-view"><canvas class="st-canvas"></canvas><div class="st-hint">Right-drag to look &middot; WASD/QE to fly &middot; Wheel to zoom &middot; F to focus &middot; Click to select</div></div>
        <div class="st-side">
          <div class="st-panel"><div class="st-panel-h">Explorer</div><div class="st-explorer"></div></div>
          <div class="st-panel"><div class="st-panel-h">Properties</div><div class="st-props"><div class="st-empty">Select a part to see its properties</div></div></div>
          ${this.o.aiAccess ? `<div class="st-panel"><div class="st-panel-h">AI Coder</div><div class="st-ai">
            <textarea class="ai-prompt" placeholder="Describe what to build... e.g. 'make an obby with lava and coins'"></textarea>
            <button class="rb-btn ai-gen">Generate</button>
            <div class="ai-result"></div>
          </div></div>` : ''}
        </div>
      </div>
      <div class="st-play hidden"></div>
    </div>`;
    const q = s => this.c.querySelector(s);
    this.canvas = q('.st-canvas'); this.explorer = q('.st-explorer'); this.props = q('.st-props');
    this.c.querySelector('.studio').addEventListener('click', e => {
      const t = e.target.closest('[data-tool]'); if (t) this.setTool(t.dataset.tool);
      const i = e.target.closest('[data-insert]'); if (i) this.insert(i.dataset.insert);
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'dup') this.duplicate(); if (a === 'del') this.remove(); if (a === 'undo') this.undo(); if (a === 'redo') this.redo();
      if (a === 'play') this.play(); if (a === 'save') this.save(); if (a === 'publish') this.publishDialog(); if (a === 'exit') this.exit();
    });
    q('.rb-color').oninput = e => { if (this.sel) { this.pushUndo(); this.sel.c = e.target.value; this.refresh(this.sel); } };
    q('.rb-mat').onchange = e => { if (this.sel) { this.pushUndo(); this.sel.m = e.target.value; this.refresh(this.sel); } };
    q('.rb-snap').onchange = e => { this.snap = e.target.checked; this.applySnap(); };
    q('.rb-sky').oninput = e => { this.world.sky = e.target.value; this.scene.background.set(e.target.value); this.scene.fog.color.set(e.target.value); this.markDirty(); };
    const aiBtn = q('.ai-gen');
    if (aiBtn) aiBtn.onclick = async () => {
      const promptEl = q('.ai-prompt');
      const resultEl = q('.ai-result');
      const prompt = (promptEl.value || '').trim();
      if (!prompt) { resultEl.innerHTML = '<div class="st-empty">Describe what to build first.</div>'; return; }
      resultEl.innerHTML = '<div class="st-empty">Generating...</div>';
      try {
        const token = localStorage.getItem('ff_token');
        const r = await fetch('/api/ai/coder', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
          body: JSON.stringify({ prompt })
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error || 'Generation failed');
        this._aiParts = data.parts || [];
        this._aiHtml = data.html || '';
        this._aiScripts = data.scripts || [];
        const escHtml = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        // Automatically add parts to the world
        this.pushUndo();
        for (const part of this._aiParts) {
          part.id = this.newId();
          this.world.parts.push(part);
        }
        // Automatically add scripts to the world
        if (!Array.isArray(this.world.scripts)) this.world.scripts = [];
        for (const script of this._aiScripts) {
          script.id = 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
          this.world.scripts.push(script);
        }
        this.rebuildAll();
        this.renderExplorer();
        this.markDirty();
        const scriptNames = this._aiScripts.map(s => escHtml(s.name)).join(', ');
        resultEl.innerHTML = `<div class="ai-msg">Done! Added ${this._aiParts.length} parts${this._aiScripts.length ? ` and ${this._aiScripts.length} script${this._aiScripts.length > 1 ? 's' : ''} (${scriptNames})` : ''} automatically. <button class="rb-btn ai-undo" style="margin-left:8px">Undo</button></div>
          ${this._aiScripts.length ? `<div class="ai-sec">Scripts</div>
          ${this._aiScripts.map(s => `<div class="ai-script-item"><span>📝 ${escHtml(s.name)}</span><button class="rb-btn ai-view-script" data-sid="${s.id}">Edit</button></div>`).join('')}` : ''}
          ${this._aiHtml ? `<div class="ai-sec">HTML Script</div>
          <pre class="ai-code">${escHtml(this._aiHtml.slice(0, 2000))}</pre>
          <button class="rb-btn ai-copy">Copy HTML</button>` : ''}`;
        resultEl.querySelector('.ai-undo').onclick = () => {
          this.undo();
          resultEl.querySelector('.ai-msg').textContent = 'Undid AI insertion.';
        };
        resultEl.querySelectorAll('.ai-view-script').forEach(btn => {
          btn.onclick = () => this.openScriptEditor(btn.dataset.sid);
        });
        const copyBtn = resultEl.querySelector('.ai-copy');
        if (copyBtn) copyBtn.onclick = async () => {
          try { await navigator.clipboard.writeText(this._aiHtml); copyBtn.textContent = 'Copied!'; }
          catch { copyBtn.textContent = 'Copy failed'; }
        };
      } catch (e) {
        resultEl.innerHTML = '<div class="st-empty">Error: ' + promptEl.value.replace(/[<>&]/g, '') + ' - ' + String(e.message).replace(/[<>&]/g, '') + '</div>';
      }
    };
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
    if (t === 'select') this.tc.detach(); else { this.tc.setMode(t === 'move' ? 'translate' : t === 'rotate' ? 'rotate' : 'scale'); if (this.sel) this.tc.attach(this.meshes.get(this.sel.id)); }
  }
  applySnap() { this.tc.setTranslationSnap(this.snap ? 1 : null); this.tc.setScaleSnap(this.snap ? 0.25 : null); this.tc.setRotationSnap(this.snap ? Math.PI / 12 : null); }

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
    const folders = this.world.folders || [];
    const scripts = this.world.scripts || [];
    const parts = this.world.parts || [];
    const folderMap = {};
    folders.forEach(f => folderMap[f.id] = f);
    // Parts grouped by folder
    const partsByFolder = { '': [] };
    parts.forEach(p => { const fid = p.folder || ''; if (!partsByFolder[fid]) partsByFolder[fid] = []; partsByFolder[fid].push(p); });
    const scriptsByFolder = { '': [] };
    scripts.forEach(s => { const fid = s.folder || ''; if (!scriptsByFolder[fid]) scriptsByFolder[fid] = []; scriptsByFolder[fid].push(s); });

    const renderFolder = (fid, depth) => {
      const f = fid ? folderMap[fid] : null;
      const isOpen = fid ? !this.closedFolders.has(fid) : true;
      let html = '';
      if (f) {
        html += `<div class="ex-folder" data-fid="${f.id}" style="padding-left:${depth * 12}px">
          <span class="ex-toggle">${isOpen ? '&#x25BE;' : '&#x25B8;'}</span>
          <span class="ex-fico">&#x1F4C1;</span>
          <span class="ex-fname">${esc(f.name)}</span>
          <span class="ex-actions">
            <button class="ex-act" data-act="rename-folder" title="Rename">✎</button>
            <button class="ex-act" data-act="del-folder" title="Delete">✕</button>
          </span>
        </div>`;
      }
      if (isOpen) {
        // Subfolders
        folders.filter(sf => (sf.parent || '') === fid).forEach(sf => { html += renderFolder(sf.id, depth + 1); });
        // Scripts in this folder
        (scriptsByFolder[fid] || []).forEach(s => {
          html += `<div class="ex-item ex-script" data-sid="${s.id}" style="padding-left:${(depth + 1) * 12 + 16}px">
            <span class="ex-sico">&#x1F4DD;</span>${esc(s.name)}
            <span class="ex-actions"><button class="ex-act" data-act="del-script" title="Delete">✕</button></span>
          </div>`;
        });
        // Parts in this folder
        (partsByFolder[fid] || []).forEach(p => {
          html += `<div class="ex-item" data-id="${p.id}" style="padding-left:${(depth + 1) * 12 + 16}px"><i class="sw" style="background:${p.c}"></i>${esc(p.name)}</div>`;
        });
      }
      return html;
    };

    this.explorer.innerHTML = `
      <div class="ex-toolbar">
        <button class="ex-tbtn" data-act="new-folder" title="New Folder">📁+</button>
        <button class="ex-tbtn" data-act="new-script" title="New Script">📝+</button>
      </div>
      <div class="ex-root">&#x25B8; Workspace</div>` + renderFolder('', 0);

    this.explorer.onclick = e => {
      const actBtn = e.target.closest('.ex-act, .ex-tbtn');
      if (actBtn) { this.explorerAction(actBtn.dataset.act, actBtn); return; }
      const folderEl = e.target.closest('.ex-folder');
      if (folderEl && !e.target.closest('.ex-actions')) {
        const fid = folderEl.dataset.fid;
        if (this.closedFolders.has(fid)) this.closedFolders.delete(fid); else this.closedFolders.add(fid);
        this.renderExplorer(); return;
      }
      const scriptEl = e.target.closest('.ex-script');
      if (scriptEl && !e.target.closest('.ex-actions')) { this.openScriptEditor(scriptEl.dataset.sid); return; }
      const it = e.target.closest('.ex-item');
      if (it) this.select(this.world.parts.find(p => p.id === it.dataset.id));
    };
  }
  explorerAction(act, btn) {
    if (act === 'new-folder') {
      const name = prompt('Folder name:', 'New Folder');
      if (!name) return;
      const id = 'f' + Date.now().toString(36);
      this.world.folders.push({ id, name: name.trim(), parent: '' });
      this.markDirty(); this.renderExplorer();
    } else if (act === 'new-script') {
      const name = prompt('Script name:', 'script.js');
      if (!name) return;
      const id = 's' + Date.now().toString(36);
      this.world.scripts.push({ id, name: name.trim().endsWith('.js') ? name.trim() : name.trim() + '.js', folder: '', code: '// Write your script here\n// Available: onStart(fn), onTouch(partName, fn), giveTix(player, n), teleport(player, x, y, z), say(player, msg)\n\nonStart(() => {\n  \n});\n' });
      this.markDirty(); this.renderExplorer(); this.openScriptEditor(id);
    } else if (act === 'rename-folder') {
      const fid = btn.closest('.ex-folder').dataset.fid;
      const f = this.world.folders.find(x => x.id === fid);
      const name = prompt('Rename folder:', f.name);
      if (name) { f.name = name.trim(); this.markDirty(); this.renderExplorer(); }
    } else if (act === 'del-folder') {
      const fid = btn.closest('.ex-folder').dataset.fid;
      if (!confirm('Delete this folder? Items inside will move to root.')) return;
      this.world.folders = this.world.folders.filter(x => x.id !== fid);
      this.world.parts.forEach(p => { if (p.folder === fid) p.folder = ''; });
      this.world.scripts.forEach(s => { if (s.folder === fid) s.folder = ''; });
      this.markDirty(); this.renderExplorer();
    } else if (act === 'del-script') {
      const sid = btn.closest('.ex-script').dataset.sid;
      if (!confirm('Delete this script?')) return;
      this.world.scripts = this.world.scripts.filter(x => x.id !== sid);
      this.markDirty(); this.renderExplorer();
    }
  }
  openScriptEditor(sid) {
    const s = this.world.scripts.find(x => x.id === sid);
    if (!s) return;
    const d = document.createElement('div'); d.className = 'modal-bg';
    d.innerHTML = `<div class="modal modal-wide"><h2>📝 ${esc(s.name)}</h2>
      <p class="muted small">Script API: <code>onStart(fn)</code> · <code>onTouch(partName, fn)</code> · <code>giveTix(player, n)</code> · <code>teleport(player, x, y, z)</code> · <code>say(player, msg)</code> · <code>kill(player)</code></p>
      <textarea class="script-code" spellcheck="false">${esc(s.code || '')}</textarea>
      <div class="modal-actions">
        <button type="button" class="btn-secondary">Close</button>
        <button type="button" class="btn-primary">Save Script</button>
      </div></div>`;
    document.body.appendChild(d);
    const ta = d.querySelector('.script-code');
    // Tab key inserts spaces
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); const st = ta.selectionStart; ta.value = ta.value.slice(0, st) + '  ' + ta.value.slice(ta.selectionEnd); ta.selectionStart = ta.selectionEnd = st + 2; }
    });
    d.querySelector('.btn-secondary').onclick = () => d.remove();
    d.onclick = e => { if (e.target === d) d.remove(); };
    d.querySelector('.btn-primary').onclick = () => {
      s.code = ta.value;
      this.markDirty(); d.remove();
      toast('Script saved');
    };
  }
  renderExplorerItem(p) { const el = this.explorer.querySelector(`[data-id="${p.id}"]`); if (el) el.innerHTML = `<i class="sw" style="background:${p.c}"></i>${esc(p.name)}`; }
  renderProps() {
    const p = this.sel;
    if (!p) { this.props.innerHTML = '<div class="st-empty">Select a part to see its properties</div>'; return; }
    const v3 = (k, label) => `<div class="pr-row"><span>${label}</span><div class="pr-v3">${[0, 1, 2].map(i => `<input type="number" step="0.5" data-v3="${k}" data-i="${i}" value="${+p[k][i].toFixed(2)}">`).join('')}</div></div>`;
    const script = p.script?.onTouch || { action: 'none' };
    const scriptActions = ['none', 'message', 'tix', 'teleport', 'kill'];
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
      <div class="pr-sec">Scripting — On Touch</div>
      <div class="pr-row"><span>Action</span><select data-script="action">${scriptActions.map(a => `<option value="${a}" ${script.action === a ? 'selected' : ''}>${a}</option>`).join('')}</select></div>
      <div class="pr-row"><span>Message</span><input data-script="text" placeholder="Hello!" value="${esc(script.text || '')}"></div>
      <div class="pr-row"><span>FunTix</span><input type="number" data-script="amount" min="1" max="100" value="${script.amount || 5}"></div>
      <div class="pr-row"><span>Teleport to</span><div class="pr-v3">${[0,1,2].map(i => `<input type="number" step="1" data-script-xyz="${i}" value="${[script.x ?? 0, script.y ?? 10, script.z ?? 0][i]}">`).join('')}</div></div>
      <div class="pr-sec">Transform</div>
      ${v3('p', 'Position')}${v3('s', 'Size')}`;
    this.props.querySelectorAll('input,select').forEach(inp => inp.addEventListener('change', () => {
      this.pushUndo();
      if (inp.dataset.script) {
        const key = inp.dataset.script;
        if (!p.script) p.script = { onTouch: { action: 'none' } };
        if (!p.script.onTouch) p.script.onTouch = { action: 'none' };
        if (key === 'action') {
          p.script.onTouch.action = inp.value;
          if (inp.value === 'none') delete p.script;
        } else if (key === 'text') {
          p.script.onTouch.text = String(inp.value).slice(0, 120);
        } else if (key === 'amount') {
          p.script.onTouch.amount = Math.max(1, Math.min(100, Math.floor(Number(inp.value) || 5)));
        }
        this.markDirty(); this.renderProps(); return;
      }
      if (inp.dataset.scriptXyz !== undefined) {
        const i = +inp.dataset.scriptXyz;
        if (!p.script) p.script = { onTouch: { action: 'teleport', x: 0, y: 10, z: 0 } };
        if (!p.script.onTouch) p.script.onTouch = { action: 'teleport', x: 0, y: 10, z: 0 };
        const v = parseFloat(inp.value) || 0;
        if (i === 0) p.script.onTouch.x = v; if (i === 1) p.script.onTouch.y = v; if (i === 2) p.script.onTouch.z = v;
        this.markDirty(); return;
      }
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
      else if (e.code === 'Digit3') this.setTool('scale');       else if (e.code === 'Digit4') this.setTool('rotate');
      else if (e.code === 'KeyF' && this.sel) { const p = new THREE.Vector3(...this.sel.p); const d = Math.max(...this.sel.s) * 1.5 + 8; this.camPos.copy(p).addScaledVector(this.forward(), -d); }
      else if (e.code === 'F5') { e.preventDefault(); this.play(); }
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
