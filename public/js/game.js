import * as THREE from 'three';
import { setupLighting, buildWorld, findSpawn } from './three-util.js?v=6bc4de5a';
import { buildCharacter, animateCharacter, makeNameTag, avatarImage, CLUB_PATH } from './avatar3d.js?v=e0564f57';
import { sfx } from './sound.js?v=89850e26';
import { ECON, BADGES, PET_MODELS, GEAR_MODELS, CATALOG, ITEM } from './catalog.js?v=31ccb953';

const GRAVITY = 196.2, WALK = 16, JUMP = 50, HW = 0.9, H = 5.2;
const ANIMS = ['idle', 'walk', 'jump', 'fall', 'wave', 'dance', 'dead', 'sit'];

// ---------- Halloween in-game decor (Oct 24 - Nov 2) ----------
const HALLOWEEN_DATES = { starts: Date.parse('2026-10-06T00:00:00Z'), ends: Date.parse('2026-11-02T00:00:00Z') };
const halloweenNow = () => { const n = Date.now(); return n >= HALLOWEEN_DATES.starts && n <= HALLOWEEN_DATES.ends; };

// ---------- pets ----------
// boxes: [x, y, z, w, h, d, color, rotZ?]. Origin at ground, faces +z.

function buildPet(petId) {
  const spec = PET_MODELS[petId];
  if (!spec) return null;
  const g = new THREE.Group();
  const body = new THREE.Group();
  for (const b of spec.boxes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b[3], b[4], b[5]), new THREE.MeshStandardMaterial({ color: b[6], roughness: 0.75 }));
    m.position.set(b[0], b[1], b[2]);
    if (b[7]) m.rotation.z = b[7];
    m.castShadow = true;
    body.add(m);
  }
  g.add(body);
  g.userData.body = body;
  return g;
}
function buildGear(gearId) {
  const spec = GEAR_MODELS[gearId];
  if (!spec) return null;
  const g = new THREE.Group();
  for (const b of spec.boxes) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(b[3], b[4], b[5]), new THREE.MeshStandardMaterial({ color: b[6], roughness: 0.6 }));
    m.position.set(b[0], b[1], b[2]);
    if (b[7]) m.rotation.z = b[7];
    m.castShadow = true;
    g.add(m);
  }
  g.scale.setScalar(0.5);
  return g;
}
const GEAR_COOLDOWN = { gear_sword: 0.8, gear_slingshot: 0.6, gear_grapple: 1.5, gear_rocket: 2.2,
  gear_blaster: 0.5, gear_raygun: 0.7, gear_crossbow: 0.9, gear_freezeray: 1.0,
  gear_hammer: 1.0, gear_axe: 0.9, gear_katana: 0.6, gear_spear: 0.9, gear_mace: 1.1,
  gear_lasersword: 0.7, gear_cannon: 2.5, gear_bazooka: 2.8 };
const GEAR_BEHAVIOR = { gear_sword: 'melee', gear_slingshot: 'pellet', gear_rocket: 'rocket', gear_grapple: 'grapple',
  gear_blaster: 'pellet', gear_raygun: 'pellet', gear_crossbow: 'pellet', gear_freezeray: 'pellet',
  gear_hammer: 'melee', gear_axe: 'melee', gear_katana: 'melee', gear_spear: 'melee', gear_mace: 'melee',
  gear_lasersword: 'melee', gear_cannon: 'rocket', gear_bazooka: 'rocket' };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export class Game {
  constructor(container, opts) {
    this.c = container; this.o = opts;
    this.world = opts.world; this.me = opts.me;
    this.keys = {}; this.joy = { x: 0, y: 0 }; this.touchJump = false; this.t = 0; this.players = new Map();
    this.projectiles = []; this.effects = []; this.gearSwingT = 0; this.lastGearUse = -9;
    this.camYaw = Math.PI; this.camPitch = 0.35; this.camDist = 18;
    this.health = 100; this.dead = false; this.emote = null; this.speedTimer = 0; this.kills = 0;
    this.collected = new Set(); this.won = false;
    this.buildDom(); this.build3D(); this.bind();
    this.spawn(true);
    if (!opts.test) this.connect(); else this.sys('Test mode - press Stop to return to Studio.');
    this.last = performance.now();
    this.loop = this.loop.bind(this); this.raf = requestAnimationFrame(this.loop);
  }

  // ---------- DOM / HUD ----------
  buildDom() {
    const touch = localStorage.ff_touch ? localStorage.ff_touch === '1' : matchMedia('(pointer: coarse)').matches;
    this.c.innerHTML = `
    <div class="game-root${touch ? ' touch' : ''}">
      <canvas class="game-canvas"></canvas>
      <div class="hud-topleft">
        <button class="hud-btn menu-btn" title="Menu (Esc)"><span class="ff-mini">${LOGO}</span></button>
        <button class="hud-btn chat-toggle" title="Chat">${chatIcon}</button>
      </div>
      <div class="chat-box"><div class="chat-log"></div><input class="chat-input" maxlength="200" placeholder="To chat click here or press &quot;/&quot; key"></div>
      <div class="hud-topright">
        <div class="lb"><div class="lb-head"><span>${esc(this.o.gameName || 'Game')}</span></div><div class="lb-list"></div></div>
        <div class="health"><div class="health-fill"></div></div>
      </div>
      <div class="touch-ui"><div class="joy-zone"><div class="joy"><div class="joy-knob"></div></div></div><button class="jump-btn" aria-label="Jump"><svg viewBox="0 0 24 24" width="42" height="42"><path fill="currentColor" d="M12 4l8 9h-5v7H9v-7H4z"/></svg></button></div>
      <div class="hud-bottom"><div class="funbux-hud" title="FunTix">${tix} <span class="tx-count">${this.o.funtix ?? ''}</span></div>${this.o.test ? '<button class="stop-btn">Stop</button>' : ''}</div>
      <div class="inv-bar" title="Your gear inventory (click or press 1-9)"></div>
      <div class="kill-feed"></div>
      <div class="big-msg"></div>
      <div class="esc-menu hidden">
        <div class="esc-panel">
          <div class="esc-tabs"><b>${esc(this.o.gameName || 'Game')}</b></div>
          <div class="esc-players"></div>
          <div class="esc-actions">
            <button data-a="reset" class="btn-secondary">Reset Character <kbd>R</kbd></button>
            <button data-a="leave" class="btn-secondary">Leave <kbd>L</kbd></button>
            <button data-a="resume" class="btn-primary">Resume Game <kbd>Esc</kbd></button>
          </div>
          <label class="esc-opt"><input type="checkbox" data-o="shadows" checked> Shadows</label>
          <label class="esc-opt"><input type="checkbox" data-o="sound" ${sfx.enabled ? 'checked' : ''}> Sound</label>
          <label class="esc-opt"><input type="checkbox" data-o="touch" ${touch ? 'checked' : ''}> Touch controls</label>
          <div class="esc-help">WASD / arrows: move &middot; Space: jump &middot; Right-drag: rotate camera &middot; Wheel: zoom &middot; Shift: shift-lock &middot; /: chat &middot; /e wave, /e dance<br>Touch: left thumbstick to move &middot; jump button &middot; drag to look &middot; pinch to zoom</div>
        </div>
      </div>
      <div class="loading"><div class="loading-card"><div class="ff-logo-big">${LOGO}Funtopia</div><div class="loading-name">${esc(this.o.gameName || '')}</div><div class="loading-sub">${this.o.test ? 'Starting test...' : 'Joining server...'}</div><div class="spinner"></div></div></div>
    </div>`;
    const q = s => this.c.querySelector(s);
    this.canvas = q('.game-canvas'); this.chatLog = q('.chat-log'); this.chatInput = q('.chat-input');
    this.lbList = q('.lb-list'); this.escMenu = q('.esc-menu'); this.bigMsg = q('.big-msg');
    this.healthFill = q('.health-fill'); this.txCount = q('.tx-count'); this.root = q('.game-root');
    q('.menu-btn').onclick = () => this.toggleMenu();
    q('.chat-toggle').onclick = () => q('.chat-box').classList.toggle('hidden');
    if (q('.stop-btn')) q('.stop-btn').onclick = () => this.exit();
    this.escMenu.onclick = (e) => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'reset') { this.toggleMenu(false); this.die(); }
      if (a === 'leave') this.exit();
      if (a === 'resume') this.toggleMenu(false);
      if (e.target === this.escMenu) this.toggleMenu(false);
    };
    this.escMenu.querySelector('[data-o=shadows]').onchange = (e) => { this.renderer.shadowMap.enabled = e.target.checked; this.scene.traverse(o => { if (o.material) o.material.needsUpdate = true; }); };
    this.escMenu.querySelector('[data-o=sound]').onchange = (e) => { sfx.enabled = e.target.checked; };
    this.escMenu.querySelector('[data-o=touch]').onchange = (e) => { localStorage.ff_touch = e.target.checked ? '1' : '0'; this.root.classList.toggle('touch', e.target.checked); };
    this.chatInput.addEventListener('keydown', (e) => {
      e.stopPropagation();
      if (e.key === 'Enter') { this.sendChat(this.chatInput.value); this.chatInput.value = ''; this.chatInput.blur(); }
      if (e.key === 'Escape') this.chatInput.blur();
    });
    this.updateLeaderboard();
    this.renderInv();
  }
  // ---------- in-game inventory (owned gear) ----------
  ownedGears() {
    const inv = this.me.inventory || [];
    return CATALOG.filter(i => i.type === 'gear' && i.id !== 'gear_none' && inv.includes(i.id));
  }
  toolbarGears() {
    const gears = this.ownedGears().map(g => ({ id: g.id, name: g.name, emoji: g.emoji || '📦', temp: false }));
    for (const id of (this.o.gameGears || [])) {
      const it = ITEM[id];
      if (it && it.type === 'gear' && !gears.some(x => x.id === id))
        gears.push({ id, name: it.name, emoji: it.emoji || '📦', temp: true });
    }
    if (this.o.shooter && !gears.some(x => x.id === 'gear_blaster'))
      gears.unshift({ id: 'gear_blaster', name: 'Arena Blaster', emoji: '🔫', temp: true });
    return gears;
  }
  renderInv() {
    const bar = this.c.querySelector('.inv-bar');
    if (!bar) return;
    const gears = this.toolbarGears();
    const cur = this.me.avatar?.gear;
    bar.innerHTML = gears.length ? gears.map((g, i) => `<button class="inv-item${g.id === cur ? ' active' : ''}" data-id="${g.id}" data-temp="${g.temp ? 1 : 0}" title="${esc(g.name)}${i < 9 ? ' (' + (i + 1) + ')' : ''}">${i < 9 ? `<span class="inv-key">${i + 1}</span>` : ''}<span class="inv-emoji">${g.emoji}</span><span class="inv-name">${esc(g.name)}</span></button>`).join('')
      : `<div class="inv-empty">No gears yet — <a href="#/catalog/gear">get some in the Marketplace</a></div>`;
    bar.querySelectorAll('.inv-item').forEach(b => b.onclick = () => this.equipGear(b.dataset.id, b.dataset.temp === '1'));
    bar.style.display = 'flex';
  }
  equipGearByIndex(i) {
    const g = this.toolbarGears()[i];
    if (g) this.equipGear(g.id, g.temp);
  }
  async equipGear(id, temp = false) {
    const it = ITEM[id];
    if (!it || it.type !== 'gear' || this.o.test) return;
    this.me.avatar = this.me.avatar || {};
    this.me.avatar.gear = id;
    this.setGear();
    this.renderInv();
    sfx.click?.();
    if (temp) return; // arena loaner: don't save an unowned gear to the avatar
    try {
      await fetch('/api/me/avatar', { method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.o.token },
        body: JSON.stringify(this.me.avatar) });
    } catch {}
  }
  onKill(name) {
    this.kills++;
    const feed = this.c.querySelector('.kill-feed');
    if (feed) {
      const d = document.createElement('div');
      d.className = 'kill-item';
      d.innerHTML = `<b>${esc(this.me.name)}</b> 💥 ${esc(name)}`;
      feed.prepend(d);
      while (feed.children.length > 5) feed.lastChild.remove();
      setTimeout(() => d.remove(), 6000);
    }
    this.updateLeaderboard();
  }
  toggleMenu(v) {
    const show = v ?? this.escMenu.classList.contains('hidden');
    this.escMenu.classList.toggle('hidden', !show);
    if (show) { if (document.pointerLockElement) document.exitPointerLock(); this.keys = {}; this.renderEscPlayers(); }
  }
  renderEscPlayers() {
    const list = [this.me, ...this.players.values()];
    this.c.querySelector('.esc-players').innerHTML = list.map(p => `<div class="esc-player"><img src="${avatarImage(p.avatar)}"><span>${badgeIcon(p.badge)}${esc(p.name)}</span></div>`).join('');
  }
  updateLeaderboard() {
    const list = [this.me, ...this.players.values()];
    this.lbList.innerHTML = list.map((p, i) => `<div class="lb-row ${i === 0 ? 'me' : ''}">${badgeIcon(p.badge)}${esc(p.name)}${i === 0 && this.kills ? ` <span class="lb-kills">💀${this.kills}</span>` : ''}</div>`).join('');
  }
  addChat(html) {
    const d = document.createElement('div'); d.className = 'chat-line'; d.innerHTML = html;
    this.chatLog.appendChild(d);
    while (this.chatLog.children.length > 80) this.chatLog.firstChild.remove();
    this.chatLog.scrollTop = this.chatLog.scrollHeight;
  }
  sys(text) { this.addChat(`<span class="chat-sys">${esc(text)}</span>`); }
  showBig(text, ms = 2000) {
    this.bigMsg.textContent = text; this.bigMsg.classList.add('show');
    clearTimeout(this.bigT); this.bigT = setTimeout(() => this.bigMsg.classList.remove('show'), ms);
  }
  sendChat(text) {
    text = text.trim(); if (!text) return;
    const em = text.match(/^\/e\s+(\w+)/i);
    if (em) { const e = em[1].toLowerCase(); if (['wave', 'dance'].includes(e)) { this.emote = e; this.emoteT = e === 'wave' ? 2.5 : 999; this.send({ t: 'emote', e }); } return; }
    if (this.o.test || !this.ws) { this.onChat({ id: 0, name: this.me.name, text, badge: this.me.badge }); return; }
    this.send({ t: 'chat', text });
  }
  onChat(m) {
    if (!m.system) for (const fn of (this._scriptState?.chatFns || [])) { try { fn(m.name, m.text); } catch (e) { console.warn('onChat script error:', e); } }
    if (m.system) return this.sys(m.text);
    const color = nameColor(m.name);
    this.addChat(`<b style="color:${color}">${badgeIcon(m.badge)}${esc(m.name)}:</b> ${esc(m.text)}`);
    sfx.chat();
    const ch = m.id === this.myId || m.id === 0 ? this.char : this.players.get(m.id)?.char;
    if (ch) this.bubble(ch, m.text);
  }
  bubble(ch, text) {
    if (ch.userData.bubble) ch.remove(ch.userData.bubble);
    const c = document.createElement('canvas'); c.width = 512; c.height = 160;
    const g = c.getContext('2d');
    g.font = '36px Arial'; const lines = wrap(g, text, 460).slice(0, 3);
    const h = 30 + lines.length * 40;
    g.fillStyle = 'rgba(255,255,255,0.95)'; g.beginPath(); g.roundRect(6, 160 - h - 20, 500, h, 22); g.fill();
    g.beginPath(); g.moveTo(240, 140); g.lineTo(256, 158); g.lineTo(272, 140); g.fill();
    g.fillStyle = '#222'; g.textAlign = 'center';
    lines.forEach((l, i) => g.fillText(l, 256, 160 - h - 20 + 46 + i * 40));
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
    s.scale.set(9, 2.8, 1); s.position.y = 8.6; s.renderOrder = 1000;
    ch.add(s); ch.userData.bubble = s; ch.userData.bubbleT = 8;
  }

  // ---------- 3D ----------
  build3D() {
    const r = this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
    r.setPixelRatio(Math.min(devicePixelRatio, 2));
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
    r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.sun = setupLighting(this.scene, this.world.sky || '#8fc8ff', this.world.light);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 3000);
    this.meshes = buildWorld(this.scene, this.world);
    this.solids = []; this.triggers = [];
    for (const p of this.world.parts) {
      const box = { p, min: [p.p[0] - p.s[0] / 2, p.p[1] - p.s[1] / 2, p.p[2] - p.s[2] / 2], max: [p.p[0] + p.s[0] / 2, p.p[1] + p.s[1] / 2, p.p[2] + p.s[2] / 2], _arrs: [] };
      const addBox = arr => { arr.push(box); box._arrs.push(arr); };
      (p._boxes ||= []).push(box);
      if (p.k === 'coin') { box.min = box.min.map(v => v - 0.3); box.max = box.max.map(v => v + 0.3); addBox(this.triggers); continue; }
      if (p.cc !== false) addBox(this.solids);
      if (p.k !== 'part' && p.k !== 'spawn' || p.script?.onTouch) addBox(this.triggers);
    }
    this.camMeshes = [...this.meshes.values()].filter(m => m.userData.part.k !== 'coin' && m.userData.part.cc !== false && !(m.userData.part.tr > 0.5));
    this.char = buildCharacter(this.me.avatar, { pet: false, gear: false });
    this.scene.add(this.char);
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.setPet(); this.setGear();
    this.ray = new THREE.Raycaster();
    this.resize();
    this.runWorldScripts();
    if (halloweenNow()) this.addHalloweenDecor();
  }
  runWorldScripts() {
    const scripts = this.world.scripts || [];
    if (!scripts.length) return;
    if (!this._scriptState) this._scriptState = { score: 0, tickFns: [], deathFns: [], chatFns: [] };
    const st = this._scriptState;
    const findMesh = name => {
      const nm = String(name).toLowerCase();
      for (const [id, m] of this.meshes) {
        if ((m.userData.part.name || '').toLowerCase() === nm) return m;
      }
      return null;
    };
    // Script API available to world scripts
    const api = {
      onStart: fn => { try { fn(); } catch (e) { console.warn('Script onStart error:', e); } },
      onTouch: (partName, fn) => {
        if (!this._scriptTouch) this._scriptTouch = [];
        this._scriptTouch.push({ partName: String(partName), fn });
      },
      onDeath: fn => { st.deathFns.push(fn); },
      onChat: fn => { st.chatFns.push(fn); },
      onTick: fn => { st.tickFns.push(fn); },
      giveTix: (player, n) => {
        const amt = Math.max(1, Math.min(100, Math.floor(Number(n) || 5)));
        this.showBig(`+${amt} FunTix!`, 2000);
        this.send({ t: 'scriptTix', amount: amt });
      },
      teleport: (player, x, y, z) => { this.pos.set(Number(x) || 0, Number(y) || 10, Number(z) || 0); this.vel.set(0, 0, 0); },
      say: (player, msg) => this.showBig(String(msg).slice(0, 120), 2500),
      sayAll: msg => { this.sendChat(String(msg).slice(0, 200)); },
      kill: player => this.die(),
      heal: (player, n) => { this.health = Math.min(100, this.health + (Number(n) || 25)); this.updateHud(); },
      damage: (player, n) => {
        this.health -= Number(n) || 10; this.updateHud();
        if (this.health <= 0) this.die();
      },
      setCheckpoint: (x, y, z) => {
        this.checkpoint = new THREE.Vector3(Number(x) || 0, Number(y) || 10, Number(z) || 0);
        this.showBig('Checkpoint set!', 1500); sfx.checkpoint();
      },
      spawnPart: props => {
        const p = {
          id: 'dyn_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
          name: String(props.name || 'Part'), k: 'part',
          s: props.size || [4, 1, 4], c: props.color || '#a3a2a5',
          p: [Number(props.x) || 0, Number(props.y) || 10, Number(props.z) || 0],
        };
        this.world.parts.push(p);
        const geo = new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]);
        const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.c), roughness: 0.8 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(p.p[0], p.p[1], p.p[2]);
        mesh.castShadow = mesh.receiveShadow = true;
        mesh.userData.part = p;
        this.scene.add(mesh);
        this.meshes.set(p.id, mesh);
        const sbox = { p, min: [p.p[0] - p.s[0] / 2, p.p[1] - p.s[1] / 2, p.p[2] - p.s[2] / 2], max: [p.p[0] + p.s[0] / 2, p.p[1] + p.s[1] / 2, p.p[2] + p.s[2] / 2], _arrs: [this.solids] };
        this.solids.push(sbox);
        (p._boxes ||= []).push(sbox);
        return p.id;
      },
      movePart: (name, x, y, z) => {
        const m = findMesh(name);
        if (!m) return;
        const p = m.userData.part;
        p.p = [Number(x), Number(y), Number(z)];
        m.position.set(p.p[0], p.p[1], p.p[2]);
        this.syncPartBoxes(p);
      },
      hidePart: name => { const m = findMesh(name); if (m) { m.visible = false; this.setPartActive(m.userData.part, false); } },
      showPart: name => { const m = findMesh(name); if (m) { m.visible = true; this.setPartActive(m.userData.part, true); } },
      playSound: name => { if (sfx[name]) sfx[name](); },
      setScore: n => { st.score = Number(n) || 0; },
      getScore: () => st.score,
      addScore: n => { st.score += Number(n) || 0; return st.score; },
      getPos: () => ({ x: this.pos.x, y: this.pos.y, z: this.pos.z }),
      getHealth: () => this.health,
      getPlayers: () => {
        const list = [{ name: this.me.name, x: this.pos.x, y: this.pos.y, z: this.pos.z, me: true }];
        for (const pl of this.players.values()) list.push({ name: pl.name, x: pl.char.position.x, y: pl.char.position.y, z: pl.char.position.z });
        return list;
      },
      world: this.world,
      game: this,
    };
    const names = Object.keys(api);
    for (const s of scripts) {
      if (s.kind === 'visual') {
        try { this.runVisualScript(s, api); } catch (e) { console.warn('Visual script error in ' + s.name + ':', e); }
        continue;
      }
      try {
        const fn = new Function(...names, s.code || '');
        fn(...names.map(k => api[k]));
      } catch (e) { console.warn('Script error in ' + s.name + ':', e); }
    }
  }
  // Visual (no-code) scripts built with the Studio HTML builder
  runVisualScript(s, api) {
    const t = s.trigger || {};
    const run = () => {
      for (const a of (s.actions || [])) {
        try { this.runVisualAction(a, api); } catch (e) { console.warn('Visual action error:', e); }
      }
    };
    if (t.type === 'touch') api.onTouch(t.part || '', run);
    else if (t.type === 'death') api.onDeath(run);
    else if (t.type === 'chat') api.onChat((name, text) => {
      if (!t.word || String(text).toLowerCase().includes(String(t.word).toLowerCase())) run();
    });
    else if (t.type === 'tick') api.onTick(run);
    else api.onStart(run);
  }
  runVisualAction(a, api) {
    const P = a.params || {};
    const N = (v, d) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
    const T = v => String(v ?? '');
    switch (a.type) {
      case 'giveTix': api.giveTix(null, Math.max(1, Math.min(100, Math.floor(N(P.amount, 5))))); break;
      case 'say': api.say(null, T(P.text).slice(0, 120)); break;
      case 'sayAll': api.sayAll(T(P.text).slice(0, 200)); break;
      case 'teleport': api.teleport(null, N(P.x, 0), N(P.y, 10), N(P.z, 0)); break;
      case 'kill': api.kill(); break;
      case 'heal': api.heal(null, N(P.amount, 25)); break;
      case 'damage': api.damage(null, N(P.amount, 10)); break;
      case 'setCheckpoint': api.setCheckpoint(N(P.x, 0), N(P.y, 10), N(P.z, 0)); break;
      case 'movePart': api.movePart(T(P.part), N(P.x, 0), N(P.y, 0), N(P.z, 0)); break;
      case 'hidePart': api.hidePart(T(P.part)); break;
      case 'showPart': api.showPart(T(P.part)); break;
      case 'spawnPart': api.spawnPart({ name: T(P.name) || 'Part', size: [N(P.sx, 4), N(P.sy, 1), N(P.sz, 4)], color: T(P.color) || '#a3a2a5', x: N(P.x, 0), y: N(P.y, 10), z: N(P.z, 0) }); break;
      case 'playSound': api.playSound(T(P.sound) || 'coin'); break;
      case 'setScore': api.setScore(N(P.n, 0)); break;
      case 'addScore': api.addScore(N(P.n, 1)); break;
    }
  }
  syncPartBoxes(p) {
    for (const b of (p._boxes || [])) {
      b.min = [p.p[0] - p.s[0] / 2, p.p[1] - p.s[1] / 2, p.p[2] - p.s[2] / 2];
      b.max = [p.p[0] + p.s[0] / 2, p.p[1] + p.s[1] / 2, p.p[2] + p.s[2] / 2];
    }
  }
  setPartActive(p, on) {
    for (const b of (p._boxes || [])) for (const arr of (b._arrs || [])) {
      const i = arr.indexOf(b);
      if (on && i === -1) arr.push(b);
      if (!on && i !== -1) arr.splice(i, 1);
    }
  }
  fireScriptTouch(partName) {
    for (const t of (this._scriptTouch || [])) {
      if (t.partName.toLowerCase() === String(partName).toLowerCase()) {
        try { t.fn(); } catch (e) { console.warn('Script onTouch error:', e); }
      }
    }
  }
  resize() {
    const w = this.c.clientWidth || innerWidth, h = this.c.clientHeight || innerHeight;
    this.renderer.setSize(w, h, false); this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
  }

  setPet() {
    if (this.pet) { this.scene.remove(this.pet); this.pet = null; }
    const pet = buildPet(this.me.avatar?.pet);
    if (pet) { this.pet = pet; pet.position.copy(this.pos); this.scene.add(pet); }
  }
  updatePet(pet, ownerPos, yaw, dt) {
    if (!pet || !ownerPos) return;
    const u = pet.userData;
    const tx = ownerPos.x + Math.sin(yaw + 2.6) * 1.9;
    const tz = ownerPos.z + Math.cos(yaw + 2.6) * 1.9;
    const k = 1 - Math.exp(-6 * dt);
    pet.position.x += (tx - pet.position.x) * k;
    pet.position.z += (tz - pet.position.z) * k;
    pet.position.y += (ownerPos.y - pet.position.y) * k;
    if (!u.last) u.last = pet.position.clone();
    const dx = pet.position.x - u.last.x, dz = pet.position.z - u.last.z;
    const moving = Math.hypot(dx, dz) > 0.02;
    u.last.copy(pet.position);
    if (moving) {
      let dy = Math.atan2(dx, dz) - pet.rotation.y;
      dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      pet.rotation.y += dy * Math.min(1, dt * 10);
    }
    u.body.position.y = moving ? Math.abs(Math.sin(this.t * 11)) * 0.5 : Math.sin(this.t * 2.5) * 0.06 + 0.06;
  }
  setGear() {
    if (this.gearMesh) { this.gearMesh.parent?.remove(this.gearMesh); this.gearMesh = null; }
    const g = buildGear(this.me.avatar?.gear);
    if (g) {
      const rarm = this.char.userData.limbs?.rarm;
      g.position.set(0, -2, 0.5);
      (rarm || this.char).add(g);
      this.gearMesh = g;
    }
  }
  useGear() {
    const id = this.me.avatar?.gear;
    if (!id || id === 'gear_none' || this.dead || this.o.test) return;
    const now = this.t;
    if (now - (this.lastGearUse || -9) < (GEAR_COOLDOWN[id] || 1)) return;
    this.lastGearUse = now;
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    const bh = GEAR_BEHAVIOR[id] || 'melee';
    if (bh === 'melee') this.swingSword();
    else if (bh === 'pellet') this.fireProjectile('pellet', dir, 70, 1.4);
    else if (bh === 'rocket') this.fireProjectile('rocket', dir, 38, 5);
    else if (bh === 'grapple') this.fireGrapple(dir);
  }
  swingSword() {
    this.gearSwingT = 0.35;
    sfx.swing?.() || sfx.click?.();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.char.quaternion);
    for (const p of this.players.values()) {
      const d = p.char.position.clone().sub(this.pos); d.y = 0;
      if (d.length() < 5.5 && d.normalize().dot(fwd) > 0.4) { this.send({ t: 'gearHit', id: p.id }); this.onKill(p.name); break; }
    }
  }
  fireProjectile(kind, dir, speed, radius) {
    const isRocket = kind === 'rocket';
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(isRocket ? 0.55 : 0.28, 10, 8),
      new THREE.MeshStandardMaterial({ color: isRocket ? '#e53935' : '#a1887f', emissive: isRocket ? '#ff5722' : '#000000', emissiveIntensity: 0.7, roughness: 0.5 }));
    const start = this.pos.clone(); start.y += 3.2;
    start.addScaledVector(dir, 1.5);
    mesh.position.copy(start);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, vel: dir.clone().multiplyScalar(speed), life: 3, kind, radius });
    sfx.shoot?.() || sfx.click?.();
  }
  fireGrapple(dir) {
    const ray = new THREE.Raycaster(this.camera.position.clone(), dir.clone(), 0.5, 70);
    const hits = ray.intersectObjects([...this.meshes.values()], false);
    if (!hits.length) return;
    const pt = hits[0].point;
    const pull = new THREE.Vector3(pt.x - this.pos.x, 0, pt.z - this.pos.z);
    const dist = pull.length();
    if (dist < 4) return;
    pull.normalize().multiplyScalar(Math.min(dist * 5, 70));
    this.vel.x = pull.x; this.vel.z = pull.z;
    this.vel.y = Math.max(this.vel.y + 8, 22);
    sfx.grapple?.() || sfx.click?.();
    // visual: quick line flash
    const lg = new THREE.BufferGeometry().setFromPoints([this.pos.clone().add(new THREE.Vector3(0, 3, 0)), pt]);
    const line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: '#90a4ae' }));
    this.scene.add(line);
    setTimeout(() => this.scene.remove(line), 350);
  }
  explode(at, radius) {
    const flash = new THREE.Mesh(new THREE.SphereGeometry(radius, 14, 10),
      new THREE.MeshBasicMaterial({ color: '#ff9800', transparent: true, opacity: 0.85 }));
    flash.position.copy(at); this.scene.add(flash);
    const t0 = this.t;
    this.effects.push({ mesh: flash, until: t0 + 0.35, kind: 'flash' });
    sfx.boom?.() || sfx.click?.();
    for (const p of this.players.values()) {
      const d = p.char.position.clone().sub(at); d.y *= 0.4;
      if (d.length() < radius + 1) { this.send({ t: 'gearHit', id: p.id }); this.onKill(p.name); break; }
    }
  }
  addHalloweenDecor() {
    const hw = this.hwDecor = { bats: [], ghosts: [], pumpkins: [] };
    const spawn = findSpawn(this.world);
    const M = c => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85 });
    this.scene.fog = new THREE.Fog(0x1a0f2e, 45, 170);
    const glow = new THREE.MeshBasicMaterial({ color: '#ffca28' });
    // jack-o-lanterns ringing the spawn
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4, r = 9 + (i % 3) * 4;
      const g = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.9, 18, 14), M('#e67e22'));
      body.scale.set(1, 0.9, 0.9); body.position.y = 0.85; body.castShadow = true; g.add(body);
      const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.14, 0.35, 8), M('#2e7d32'));
      stem.position.y = 1.7; g.add(stem);
      for (const sx of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.28, 3), glow);
        e.position.set(sx * 0.3, 1.05, 0.76); g.add(e);
      }
      const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.16, 0.05), glow);
      mouth.position.set(0, 0.55, 0.8); g.add(mouth);
      g.position.set(spawn.x + Math.cos(a) * r, spawn.y, spawn.z + Math.sin(a) * r);
      g.rotation.y = Math.atan2(-(Math.cos(a) * r), -(Math.sin(a) * r));
      this.scene.add(g); hw.pumpkins.push(g);
    }
    // bats circling overhead
    for (let i = 0; i < 5; i++) {
      const b = new THREE.Group();
      const bm = new THREE.MeshStandardMaterial({ color: '#2a2138', roughness: 0.9 });
      b.add(new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.5), bm));
      const wings = [];
      for (const sx of [-1, 1]) {
        const pivot = new THREE.Group(); pivot.position.set(sx * 0.15, 0.1, 0);
        const w = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.5), bm);
        w.position.set(sx * 0.45, 0, 0); pivot.add(w); b.add(pivot); wings.push(pivot);
      }
      this.scene.add(b);
      hw.bats.push({ g: b, wings, cx: spawn.x, cz: spawn.z, cy: spawn.y + 14 + (i % 3) * 3, r: 10 + i * 3, sp: 0.5 + Math.random() * 0.4, ph: Math.random() * 6.28 });
    }
    // floating ghosts
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      const gm = new THREE.MeshStandardMaterial({ color: '#f5f5f5', roughness: 0.9, transparent: true, opacity: 0.92 });
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 12), gm); head.position.y = 0.6; g.add(head);
      const skirt = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 16, 1, true), gm); skirt.position.y = -0.05; g.add(skirt);
      const dm = new THREE.MeshBasicMaterial({ color: '#212121' });
      for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 8), dm); e.position.set(sx * 0.2, 0.7, 0.48); g.add(e); }
      const mo = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 8), dm); mo.scale.set(1, 1.5, 0.5); mo.position.set(0, 0.38, 0.5); g.add(mo);
      const a = (i / 3) * Math.PI * 2 + 1.2;
      g.position.set(spawn.x + Math.cos(a) * 14, spawn.y + 4, spawn.z + Math.sin(a) * 14);
      this.scene.add(g);
      hw.ghosts.push({ g, baseY: spawn.y + 4, ph: Math.random() * 6.28 });
    }
  }
  spawn(first = false) {
    const p = this.checkpoint ? this.checkpoint.clone() : findSpawn(this.world);
    this.pos.copy(p).add(new THREE.Vector3((Math.random() - 0.5) * 2, 0.2, (Math.random() - 0.5) * 2));
    this.vel.set(0, 0, 0); this.dead = false; this.health = 100;
    this.jumpBuf = 0; this.coyote = 0; this.jumping = false;
    if (this.debris) { for (const d of this.debris) this.scene.remove(d.m); this.debris = null; }
    this.scene.remove(this.char);
    this.char = buildCharacter(this.me.avatar, { pet: false, gear: false }); this.scene.add(this.char);
    this.setGear();
    this.char.position.copy(this.pos);
    if (this.pet) { this.pet.position.copy(this.pos); this.pet.visible = true; }
    if (first) this.camYaw = Math.PI;
  }

  die() {
    if (this.dead) return;
    this.dead = true; this.health = 0; sfx.oof();
    for (const fn of (this._scriptState?.deathFns || [])) { try { fn(); } catch (e) { console.warn('onDeath error:', e); } }
    this.debris = breakApart(this.scene, this.char, this.vel);
    this.char.visible = false;
    if (this.pet) this.pet.visible = false;
    setTimeout(() => { if (!this.destroyed) this.spawn(); }, 3000);
  }

  // ---------- input ----------
  bind() {
    this.onKey = (e) => {
      if (document.activeElement === this.chatInput) return;
      const down = e.type === 'keydown';
      if (down && e.key === '/') { e.preventDefault(); this.chatInput.focus(); return; }
      if (down && e.key === 'Escape') { this.toggleMenu(); return; }
      if (!this.escMenu.classList.contains('hidden')) {
        if (down && e.key.toLowerCase() === 'r') { this.toggleMenu(false); this.die(); }
        if (down && e.key.toLowerCase() === 'l') this.exit();
        return;
      }
      if (down && e.key === 'Shift' && !e.repeat) this.toggleShiftLock();
      if (down && !e.repeat && /^Digit[1-9]$/.test(e.code)) { this.equipGearByIndex(+e.code.slice(5) - 1); return; }
      this.keys[e.code] = down;
      if (e.code === 'Space') {
        if (down) { if (!e.repeat) this.jumpBuf = 0.15; e.preventDefault(); }
        else this.cutJump();
      }
    };
    addEventListener('keydown', this.onKey); addEventListener('keyup', this.onKey);
    this.onResize = () => this.resize(); addEventListener('resize', this.onResize);
    const ptrs = new Map(); let pinch = 0;
    this.canvas.addEventListener('contextmenu', e => e.preventDefault());
    this.canvas.addEventListener('pointerdown', e => {
      this.chatInput.blur();
      if (e.button === 0 && e.pointerType !== 'touch' && !this.o.test) { this.useGear(); return; }
      if (e.button !== 2 && e.pointerType !== 'touch') return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY }); this.canvas.setPointerCapture(e.pointerId);
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = Math.hypot(a.x - b.x, a.y - b.y); }
    });
    const ptrUp = e => { ptrs.delete(e.pointerId); pinch = 0; };
    this.canvas.addEventListener('pointerup', ptrUp); this.canvas.addEventListener('pointercancel', ptrUp);
    this.canvas.addEventListener('pointermove', e => {
      if (document.pointerLockElement === this.canvas) { this.rotateCam(e.movementX, e.movementY); return; }
      const p = ptrs.get(e.pointerId); if (!p) return;
      if (ptrs.size >= 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinch && d) this.camDist = THREE.MathUtils.clamp(this.camDist * pinch / d, 0.5, 80);
        pinch = d; return;
      }
      const k = e.pointerType === 'touch' ? 1.3 : 1;
      this.rotateCam((e.clientX - p.x) * k, (e.clientY - p.y) * k); p.x = e.clientX; p.y = e.clientY;
    });
    this.bindTouch();
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.camDist = THREE.MathUtils.clamp(this.camDist * (e.deltaY > 0 ? 1.12 : 0.89), 0.5, 80); }, { passive: false });
  }
  bindTouch() {
    const zone = this.c.querySelector('.joy-zone'), base = this.c.querySelector('.joy'), knob = this.c.querySelector('.joy-knob');
    const R = 52; let id = null, cx = 0, cy = 0;
    zone.addEventListener('pointerdown', e => {
      if (id !== null) return; e.preventDefault(); this.chatInput.blur();
      id = e.pointerId; zone.setPointerCapture(id);
      const r = zone.getBoundingClientRect(); cx = e.clientX; cy = e.clientY;
      base.style.left = (cx - r.left) + 'px'; base.style.top = (cy - r.top) + 'px'; base.classList.add('active');
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy; const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const dead = l < 6 ? 0 : 1; this.joy.x = dead * dx / R; this.joy.y = dead * dy / R;
    });
    const end = e => {
      if (e.pointerId !== id) return; id = null; this.joy.x = this.joy.y = 0;
      knob.style.transform = ''; base.style.left = base.style.top = ''; base.classList.remove('active');
    };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
    const jb = this.c.querySelector('.jump-btn');
    jb.addEventListener('pointerdown', e => { e.preventDefault(); this.touchJump = true; this.jumpBuf = 0.15; jb.classList.add('down'); });
    const jup = () => { this.touchJump = false; this.cutJump(); jb.classList.remove('down'); };
    jb.addEventListener('pointerup', jup); jb.addEventListener('pointercancel', jup); jb.addEventListener('pointerleave', jup);
    jb.addEventListener('contextmenu', e => e.preventDefault());
  }
  rotateCam(dx, dy) { this.camYaw -= dx * 0.006; this.camPitch = THREE.MathUtils.clamp(this.camPitch + dy * 0.006, -1.35, 1.4); }
  toggleShiftLock() {
    this.shiftLock = !this.shiftLock;
    if (this.shiftLock) this.canvas.requestPointerLock?.(); else if (document.pointerLockElement) document.exitPointerLock();
  }

  // ---------- network ----------
  connect() {
    const ws = this.ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
    ws.onopen = () => ws.send(JSON.stringify({ t: 'join', token: this.o.token, gameId: this.o.gameId }));
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.t === 'welcome') {
        this.myId = m.id; this.me.club = !!m.club; this.me.badge = m.badge; this.hideLoading(); this.setMoney(m);
        for (const p of m.players) this.addPlayer(p);
        this.updateLeaderboard();
      } else if (m.t === 'joined') { this.addPlayer(m); this.updateLeaderboard(); }
      else if (m.t === 'left') { const p = this.players.get(m.id); if (p) { this.scene.remove(p.char); if (p.pet) this.scene.remove(p.pet); this.players.delete(m.id); } this.updateLeaderboard(); }
      else if (m.t === 'S') {
        for (const s of m.p) { if (s[0] === this.myId) continue; const p = this.players.get(s[0]); if (p) p.target = s; }
      } else if (m.t === 'chat') this.onChat(m);
      else if (m.t === 'money') { this.setMoney(m); if (m.reason === 'play') this.sys(`+${m.amount} FunTix for playing!`); if (m.looneyCoins != null) { this.showBig(`🪙 Looney Coin earned! (${m.looneyCoins}/20)`, 3500); sfx.win(); } }
      else if (m.t === 'emote') { const p = this.players.get(m.id); if (p) { p.emote = m.e; } }
      else if (m.t === 'gearHit') { if (!this.dead) this.die(); }
      else if (m.t === 'error') { this.hideLoading(); this.showBig(m.error, 6000); this.sys(m.error); }
    };
    ws.onclose = () => { if (!this.destroyed) { this.sys('Disconnected from server.'); this.showBig('Disconnected', 5000); } };
  }
  send(m) { if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m)); }
  setMoney(m) {
    if (m.funtix != null) this.txCount.textContent = m.funtix;
    this.o.onMoney?.({ funtix: m.funtix });
  }
  hideLoading() { const l = this.c.querySelector('.loading'); if (l) { l.classList.add('fade'); setTimeout(() => l.remove(), 500); } }
  addPlayer(p) {
    if (this.players.has(p.id)) return;
    const char = buildCharacter(p.avatar, { pet: false, gear: false }); char.add(makeNameTag(p.name, p.badge));
    this.scene.add(char);
    const pet = buildPet(p.avatar?.pet);
    if (pet) { pet.position.copy(char.position); this.scene.add(pet); }
    const gear = buildGear(p.avatar?.gear);
    if (gear) { const rarm = char.userData.limbs?.rarm; gear.position.set(0, -2, 0.5); (rarm || char).add(gear); }
    const pl = { id: p.id, name: p.name, avatar: p.avatar, club: p.club, badge: p.badge, char, pet: pet || null, target: p.s ? [p.id, ...p.s] : null, emote: null };
    if (pl.target) char.position.set(pl.target[1], pl.target[2], pl.target[3]);
    this.players.set(p.id, pl);
  }

  // ---------- physics ----------
  cutJump() {
    if (this.jumping && this.vel.y > 20) this.vel.y = 20;
    this.jumping = false;
  }
  overlaps(b, x, y, z) {
    return x + HW > b.min[0] && x - HW < b.max[0] && y + H > b.min[1] && y < b.max[1] && z + HW > b.min[2] && z - HW < b.max[2];
  }
  blockedAt(x, y, z) { for (const b of this.solids) if (this.overlaps(b, x, y, z)) return true; return false; }
  moveAxis(ax, d) {
    const P = this.pos; P.setComponent(ax, P.getComponent(ax) + d);
    for (const b of this.solids) {
      if (!this.overlaps(b, P.x, P.y, P.z)) continue;
      if (ax === 1) {
        if (d <= 0) { P.y = b.max[1]; if (this.vel.y < 0) this.vel.y = 0; this.onGround = true; this.ground = b; }
        else { P.y = b.min[1] - H; if (this.vel.y > 0) this.vel.y = 0; }
      } else {
        const step = b.max[1] - P.y;
        if (step > 0 && step <= 1.3 && this.wasGround && !this.blockedAt(P.x, b.max[1] + 0.01, P.z)) { P.y = b.max[1] + 0.01; continue; }
        if (d > 0) P.setComponent(ax, b.min[ax] - HW - 0.001); else P.setComponent(ax, b.max[ax] + HW + 0.001);
      }
    }
  }
  physics(dt) {
    const k = this.keys;
    const f = (k.KeyW || k.ArrowUp ? 1 : 0) - (k.KeyS || k.ArrowDown ? 1 : 0) - this.joy.y;
    const s = (k.KeyD ? 1 : 0) - (k.KeyA ? 1 : 0) + this.joy.x;
    if (k.ArrowLeft) this.camYaw += dt * 2.5; if (k.ArrowRight) this.camYaw -= dt * 2.5;
    const fwd = new THREE.Vector3(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
    const right = new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const move = fwd.multiplyScalar(f).add(right.multiplyScalar(s));
    if (move.lengthSq() > 1) move.normalize();
    const speed = this.speedTimer > 0 ? WALK * 2 : WALK;
    this.vel.x = move.x * speed; this.vel.z = move.z * speed;
    if (this.onGround) { this.coyote = 0.12; this.jumping = false; }
    else this.coyote = Math.max(0, (this.coyote || 0) - dt);
    this.jumpBuf = Math.max(0, (this.jumpBuf || 0) - dt);
    if (this.jumpBuf > 0 && (this.onGround || this.coyote > 0)) {
      this.vel.y = JUMP; this.onGround = false; this.coyote = 0; this.jumpBuf = 0; this.jumping = true; sfx.jump();
    }
    this.vel.y = Math.max(this.vel.y - GRAVITY * dt, -160);
    this.wasGround = this.onGround; this.onGround = false; this.ground = null;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z)) * dt / 0.4));
    const sdt = dt / steps;
    for (let i = 0; i < steps; i++) {
      this.moveAxis(0, this.vel.x * sdt); this.moveAxis(2, this.vel.z * sdt);
      this.moveAxis(1, this.vel.y * sdt);
    }
    if (move.lengthSq() > 0 && !this.shiftLock) this.facing = Math.atan2(move.x, move.z);
    if (this.shiftLock) this.facing = this.camYaw + Math.PI;
    if (move.lengthSq() > 0 && this.emote) this.emote = null;
    this.anim = this.emote || (!this.onGround ? (this.vel.y > 0 ? 'jump' : 'fall') : move.lengthSq() > 0 ? 'walk' : 'idle');
    if (this.pos.y < -300) this.die();
    this.triggersCheck();
  }
  triggersCheck() {
    const P = this.pos;
    for (const b of this.triggers) {
      const p = b.p;
      const touching = P.x + HW + 0.1 > b.min[0] && P.x - HW - 0.1 < b.max[0] && P.y + H > b.min[1] && P.y - 0.15 < b.max[1] && P.z + HW + 0.1 > b.min[2] && P.z - HW - 0.1 < b.max[2];
      if (!touching) continue;
      if (p.k === 'kill') { this.die(); return; }
      if (p.k === 'bounce' && this.vel.y <= 0.1) { this.vel.y = 110; this.onGround = false; sfx.bounce(); }
      if (p.k === 'speed') { if (this.speedTimer <= 0) this.showBig('Speed boost!', 1200); this.speedTimer = 5; }
      if (p.k === 'checkpoint') {
        const cp = new THREE.Vector3(p.p[0], p.p[1] + p.s[1] / 2, p.p[2]);
        if (!this.checkpoint || !this.checkpoint.equals(cp)) { this.checkpoint = cp; sfx.checkpoint(); this.showBig('Checkpoint reached!', 1500); }
      }
      if (p.k === 'win' && !this.won) { this.won = true; sfx.win(); this.showBig(this.o.test ? 'YOU WIN!' : `YOU WIN! +${ECON.WIN_TIX} FunTix`, 4000); this.send({ t: 'win' }); confetti(this.c); }
      if (p.k === 'coin' && !this.collected.has(p.id)) {
        this.collected.add(p.id); this.meshes.get(p.id).visible = false; sfx.coin();
        this.send({ t: 'coin', part: p.id });
        if (this.o.test) this.txCount.textContent = this.collected.size + ' coins';
      }
      this.fireScriptTouch(p.name);
      const sc = p.script?.onTouch;
      if (sc && sc.action && sc.action !== 'none') {
        const now = performance.now();
        if (!this._scriptCd) this._scriptCd = new Map();
        const last = this._scriptCd.get(p.id) || 0;
        if (now - last > 2000) {
          this._scriptCd.set(p.id, now);
          if (sc.action === 'message') this.showBig(String(sc.text || 'Hello!').slice(0, 120), 2000);
          else if (sc.action === 'kill') this.die();
          else if (sc.action === 'teleport') {
            this.pos.set(Number(sc.x) || 0, Number(sc.y) || 10, Number(sc.z) || 0);
            this.vel.set(0, 0, 0);
            this.showBig('Teleported!', 1500);
          } else if (sc.action === 'tix') {
            const amt = Math.max(1, Math.min(100, Math.floor(Number(sc.amount) || 5)));
            this.showBig(`+${amt} FunTix!`, 2000);
            this.send({ t: 'scriptTix', amount: amt });
          }
        }
      }
    }
  }

  // ---------- loop ----------
  loop(now) {
    if (this.destroyed) return;
    this.raf = requestAnimationFrame(this.loop);
    const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now; this.t += dt;
    if (this.o.test && !this.loadHidden) { this.loadHidden = true; this.hideLoading(); }
    if (this.speedTimer > 0) this.speedTimer -= dt;
    if (this.emote === 'wave' && (this.emoteT -= dt) <= 0) this.emote = null;
    for (const fn of (this._scriptState?.tickFns || [])) { try { fn(dt, this.t); } catch (e) { console.warn('onTick error:', e); } }
    if (!this.dead) {
      this.physics(dt);
      this.char.position.copy(this.pos);
      let dy = (this.facing ?? 0) - this.char.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      this.char.rotation.y += dy * Math.min(1, dt * 14);
      animateCharacter(this.char, this.anim, this.t, dt);
      this.updatePet(this.pet, this.pos, this.facing ?? 0, dt);
    } else if (this.debris) stepDebris(this.debris, dt, this.solids);
    // remote players
    for (const p of this.players.values()) {
      const s = p.target; if (!s) continue;
      const ch = p.char; const k = Math.min(1, dt * 12);
      const tgt = new THREE.Vector3(s[1], s[2], s[3]);
      if (ch.position.distanceTo(tgt) > 30) ch.position.copy(tgt); else ch.position.lerp(tgt, k);
      let dy = s[4] - ch.rotation.y; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); ch.rotation.y += dy * k;
      let anim = ANIMS[s[5]] || 'idle';
      if (anim === 'idle' && p.emote) anim = p.emote; else if (anim !== 'idle') p.emote = null;
      ch.visible = anim !== 'dead';
      if (p.pet) { p.pet.visible = ch.visible; if (ch.visible) this.updatePet(p.pet, ch.position, ch.rotation.y, dt); }
      animateCharacter(ch, anim, this.t, dt);
    }
    // gear swing animation
    if (this.gearSwingT > 0 && !this.dead) {
      this.gearSwingT -= dt;
      const rarm = this.char.userData.limbs?.rarm;
      if (rarm) rarm.rotation.x = -2.2 * Math.sin((0.35 - this.gearSwingT) / 0.35 * Math.PI);
      if (this.gearSwingT <= 0 && rarm) rarm.rotation.x = 0;
    }
    // projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.life -= dt;
      if (pr.kind === 'pellet') pr.vel.y -= 60 * dt;
      pr.mesh.position.addScaledVector(pr.vel, dt);
      let hit = pr.life <= 0;
      const mp = pr.mesh.position;
      if (!hit && this.blockedAt(mp.x, mp.y, mp.z)) hit = true;
      if (!hit) for (const p of this.players.values()) {
        const d = p.char.position.clone(); d.y += 2.5;
        if (d.distanceTo(mp) < 1.6 + (pr.kind === 'rocket' ? 0.8 : 0)) { this.send({ t: 'gearHit', id: p.id }); this.onKill(p.name); hit = true; break; }
      }
      if (hit) {
        this.scene.remove(pr.mesh);
        this.projectiles.splice(i, 1);
        if (pr.kind === 'rocket') this.explode(mp.clone(), pr.radius);
      }
    }
    // effects (explosion flashes)
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const ef = this.effects[i];
      if (this.t >= ef.until) { this.scene.remove(ef.mesh); this.effects.splice(i, 1); }
      else if (ef.kind === 'flash') ef.mesh.scale.setScalar(1 + (0.35 - (ef.until - this.t)) * 6);
    }
    // bubbles & coins
    this.scene.traverse(o => {
      if (o.userData.bubble) { o.userData.bubbleT -= dt; if (o.userData.bubbleT <= 0) { o.remove(o.userData.bubble); o.userData.bubble = null; } }
    });
    // halloween decor animation
    const hw = this.hwDecor;
    if (hw) {
      for (const b of hw.bats) {
        const a = this.t * b.sp + b.ph;
        b.g.position.set(b.cx + Math.cos(a) * b.r, b.cy + Math.sin(this.t * 1.3 + b.ph) * 1.2, b.cz + Math.sin(a) * b.r);
        b.g.rotation.y = -a;
        const flap = Math.sin(this.t * 10 + b.ph) * 0.55;
        b.wings[0].rotation.z = flap; b.wings[1].rotation.z = -flap;
      }
      for (const gh of hw.ghosts) {
        gh.g.position.y = gh.baseY + Math.sin(this.t * 1.8 + gh.ph) * 0.9;
        gh.g.rotation.y = Math.sin(this.t * 0.6 + gh.ph) * 0.6;
      }
      hw.pumpkins.forEach((p, i) => p.scale.setScalar(1 + Math.sin(this.t * 3 + i * 1.7) * 0.025));
    }
    for (const m of this.meshes.values()) if (m.userData.spin) m.rotation.y += dt * 2.5;
    // network
    this.netT = (this.netT || 0) + dt;
    if (this.netT > 0.066) { this.netT = 0; this.send({ t: 's', s: [+this.pos.x.toFixed(2), +this.pos.y.toFixed(2), +this.pos.z.toFixed(2), +this.char.rotation.y.toFixed(3), this.dead ? 6 : ANIMS.indexOf(this.anim)] }); }
    this.updateCamera(dt);
    this.healthFill.style.width = this.health + '%';
    this.renderer.render(this.scene, this.camera);
  }
  updateCamera() {
    const head = (this.dead && this.debris ? this.debris[0].m.position.clone() : this.pos.clone().add(new THREE.Vector3(0, 4.5, 0)));
    const off = new THREE.Vector3(Math.sin(this.camYaw) * Math.cos(this.camPitch), Math.sin(this.camPitch), Math.cos(this.camYaw) * Math.cos(this.camPitch));
    let dist = this.camDist;
    if (dist > 1) {
      this.ray.set(head, off); this.ray.far = dist;
      const hit = this.ray.intersectObjects(this.camMeshes, false)[0];
      if (hit) dist = Math.max(0.5, hit.distance - 0.4);
    }
    this.camera.position.copy(head).addScaledVector(off, dist);
    this.camera.lookAt(head);
    const fp = this.camDist < 1.2;
    if (!this.dead) this.char.visible = !fp;
    if (this.shiftLock && !fp) this.camera.position.addScaledVector(new THREE.Vector3(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw)), 1.75);
    this.sun.position.copy(this.pos).add(new THREE.Vector3(60, 120, 40)); this.sun.target.position.copy(this.pos);
  }

  exit() {
    for (const pr of this.projectiles) this.scene.remove(pr.mesh);
    this.projectiles = []; this.destroy(); this.o.onExit?.(); }
  destroy() {
    this.destroyed = true; cancelAnimationFrame(this.raf);
    removeEventListener('keydown', this.onKey); removeEventListener('keyup', this.onKey); removeEventListener('resize', this.onResize);
    if (document.pointerLockElement) document.exitPointerLock();
    this.ws?.close(); this.renderer.dispose();
    this.scene.traverse(o => o.geometry?.dispose?.());
    this.c.innerHTML = '';
  }
}

function breakApart(scene, char, vel) {
  const parts = [];
  char.updateMatrixWorld(true);
  const meshes = [];
  char.traverse(o => { if (o.isMesh && o.geometry.type !== 'PlaneGeometry') meshes.push(o); });
  for (const m of meshes) {
    const c = m.clone(); m.getWorldPosition(c.position); m.getWorldQuaternion(c.quaternion); c.scale.set(1, 1, 1);
    scene.add(c);
    parts.push({ m: c, v: new THREE.Vector3(vel.x * 0.5 + (Math.random() - 0.5) * 18, 10 + Math.random() * 18, vel.z * 0.5 + (Math.random() - 0.5) * 18), av: new THREE.Vector3(Math.random() * 8, Math.random() * 8, Math.random() * 8) });
  }
  // head first so the camera follows it
  parts.sort((a, b) => b.m.position.y - a.m.position.y);
  return parts;
}
function stepDebris(debris, dt, solids) {
  for (const d of debris) {
    d.v.y -= GRAVITY * dt * 0.6;
    d.m.position.addScaledVector(d.v, dt);
    for (const b of solids) {
      const p = d.m.position;
      if (p.x > b.min[0] && p.x < b.max[0] && p.z > b.min[2] && p.z < b.max[2] && p.y - 0.5 < b.max[1] && p.y > b.min[1]) { p.y = b.max[1] + 0.5; d.v.y *= -0.3; d.v.x *= 0.7; d.v.z *= 0.7; d.av.multiplyScalar(0.8); }
    }
    d.m.rotation.x += d.av.x * dt; d.m.rotation.y += d.av.y * dt; d.m.rotation.z += d.av.z * dt;
  }
}
function wrap(g, text, max) {
  const words = text.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (g.measureText(t).width > max && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur); return lines;
}
export function nameColor(name) {
  const cols = ['#fd2943', '#01a2ff', '#02b857', '#a75eb8', '#f58225', '#f5cd30', '#e8bac8', '#d7c59a'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return cols[h % cols.length];
}
function confetti(root) {
  const box = document.createElement('div'); box.className = 'confetti';
  for (let i = 0; i < 120; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.background = `hsl(${Math.random() * 360},90%,60%)`; s.style.animationDelay = Math.random() * 1.5 + 's'; s.style.animationDuration = 2 + Math.random() * 2 + 's'; box.appendChild(s); }
  root.querySelector('.game-root').appendChild(box); setTimeout(() => box.remove(), 5000);
}
const chatIcon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';
export const LOGO = '<svg class="ff-logo" viewBox="0 0 40 32" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-10 12 15)"><rect x="3" y="6" width="18" height="18" rx="4" fill="#fff"/><circle cx="9" cy="13" r="1.7" fill="#1b1d1f"/><circle cx="15" cy="13" r="1.7" fill="#1b1d1f"/><path d="M8 17.5q4 4 8 0" fill="none" stroke="#1b1d1f" stroke-width="1.8" stroke-linecap="round"/></g><g transform="rotate(10 28 17)"><rect x="19" y="8" width="18" height="18" rx="4" fill="#ffd400" stroke="#1b1d1f" stroke-width="1.5"/><circle cx="25" cy="15" r="1.7" fill="#1b1d1f"/><circle cx="31" cy="15" r="1.7" fill="#1b1d1f"/><path d="M24 19.5q4 4 8 0" fill="none" stroke="#1b1d1f" stroke-width="1.8" stroke-linecap="round"/></g></svg>';
export const CLUB = `<svg class="club-badge" viewBox="0 0 24 24" width="18" height="18"><title>FriendClub member</title><path fill="#ffd400" d="${CLUB_PATH}"/></svg>`;
export const tix = '<svg class="tix" viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="#1b1d1f" stroke-width="1.4" opacity=".35"/><path fill="#1b1d1f" d="M7.5 7h9v2.6h-3.2V18h-2.6V9.6H7.5z"/></svg>';
export const badgeIcon = (id, size = 18) => { const b = BADGES[id]; return b ? `<svg class="club-badge" viewBox="0 0 24 24" width="${size}" height="${size}"><title>${b.name}</title><path fill="${b.color}" d="${b.path}"/></svg>` : ''; };
