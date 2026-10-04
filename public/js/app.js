import { Game, nameColor, bux } from './game.js';
import { Studio } from './studio.js';
import { avatarImage, buildCharacter } from './avatar3d.js';
import { worldThumbnail } from './three-util.js';
import { CATALOG, ITEM } from './catalog.js';
import { templates } from './worlds.js';
import * as THREE from 'three';

const app = document.getElementById('app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = localStorage.getItem('ff_token');
let me = null;
let cleanup = null;

async function api(method, url, body) {
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && url !== '/api/login') { logout(true); throw new Error('Please log in'); }
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}
export function toast(msg, err = false) {
  const t = document.createElement('div'); t.className = 'toast' + (err ? ' err' : ''); t.textContent = msg;
  document.getElementById('toasts').appendChild(t); setTimeout(() => t.classList.add('out'), 2600); setTimeout(() => t.remove(), 3000);
}
function logout(silent) { if (!silent && token) api('POST', '/api/logout').catch(() => {}); token = null; me = null; localStorage.removeItem('ff_token'); location.hash = '#/login'; route(); }
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n);
const rating = g => (g.likes + g.dislikes) ? Math.round(g.likes / (g.likes + g.dislikes) * 100) + '%' : '--';
const icons = {
  home: '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.5"/><path d="M3 21c0-5 4-8 9-8s9 3 9 8z"/></svg>',
  friends: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5"/><circle cx="17" cy="9" r="3"/><path d="M1 20c0-4 3-7 7-7s7 3 7 7zM14 20c0-2-.6-4-2-5.5 1.5-1 3-1.5 5-1.5 3.5 0 6 2.5 6 7z"/></svg>',
  avatar: '<svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="6" rx="1"/><rect x="7" y="9" width="10" height="7"/><rect x="3" y="9" width="3.5" height="7"/><rect x="17.5" y="9" width="3.5" height="7"/><rect x="7" y="16.5" width="4.5" height="6"/><rect x="12.5" y="16.5" width="4.5" height="6"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M4 7h16l-1.5 13h-13zM8 7a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  create: '<svg viewBox="0 0 24 24"><path d="M3 17l11-11 4 4-11 11H3zM15 5l2-2 4 4-2 2z"/></svg>',
  discover: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  thumb: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M2 10h4v11H2zM8 21V10l5-8c1.5 0 2.5 1 2.2 2.6L14.5 9H21c1 0 2 1 1.7 2.2l-2 8.3c-.2.9-1 1.5-2 1.5z"/></svg>',
  people: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM0 20c0-4 3.5-7 8-7s8 3 8 7zm17 0c0-2-.7-4-2-5.3 4.5-.8 9 1 9 5.3z"/></svg>',
};

// ---------- thumbnails ----------
const thumbCache = new Map();
async function fillThumbs(root = app) {
  for (const img of root.querySelectorAll('img[data-thumb]')) {
    const id = img.dataset.thumb;
    if (thumbCache.has(id)) { img.src = thumbCache.get(id); continue; }
    try {
      const g = await api('GET', '/api/games/' + id);
      const url = worldThumbnail(g.world); thumbCache.set(id, url);
      root.querySelectorAll(`img[data-thumb="${id}"]`).forEach(i => (i.src = url));
      api('POST', `/api/games/${id}/thumbnail`, { thumbnail: url }).catch(() => {});
    } catch {}
  }
}
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 9"><rect width="16" height="9" fill="#393b3d"/></svg>');
function gameCard(g) {
  return `<a class="game-card" href="#/games/${g.id}">
    <div class="gc-thumb"><img ${g.thumbnail ? `src="${g.thumbnail}"` : `src="${PLACEHOLDER}" data-thumb="${g.id}"`} alt=""></div>
    <div class="gc-name">${esc(g.name)}</div>
    <div class="gc-stats"><span>${icons.thumb} ${rating(g)}</span><span>${icons.people} ${fmt(g.playing)}</span></div>
  </a>`;
}
function userTile(u) {
  const st = u.gameId ? 'ingame' : u.online ? 'online' : '';
  return `<a class="user-tile" href="#/users/${encodeURIComponent(u.name)}" title="${u.gameName ? 'Playing ' + esc(u.gameName) : ''}">
    <div class="ut-img ${st}"><img src="${avatarImage(u.avatar)}"></div><div class="ut-name">${esc(u.name)}</div>
    ${u.gameName ? `<div class="ut-game">${esc(u.gameName)}</div>` : ''}</a>`;
}

// ---------- layout ----------
function shell(active, content) {
  return `
  <header class="topbar">
    <button class="tb-burger" onclick="document.body.classList.toggle('nav-open')">&#9776;</button>
    <a class="logo" href="#/home"><span class="logo-icon"></span><span class="logo-text">FriendFun</span></a>
    <nav class="tb-nav"><a href="#/discover">Discover</a><a href="#/catalog">Marketplace</a><a href="#/create">Create</a><a href="#/funbux">FunBux</a></nav>
    <form class="tb-search" onsubmit="event.preventDefault(); location.hash='#/discover?q='+encodeURIComponent(this.q.value)"><input name="q" placeholder="Search"></form>
    <div class="tb-right">
      <a class="tb-user" href="#/users/${encodeURIComponent(me.name)}"><img src="${avatarImage(me.avatar)}"><span>${esc(me.name)}</span></a>
      <a class="tb-bux" href="#/funbux">${bux}<span class="me-bux">${fmt(me.funbux)}</span></a>
      <button class="tb-logout" title="Log out">Log Out</button>
    </div>
  </header>
  <aside class="sidebar">
    ${[['home', 'Home', icons.home], ['users/' + encodeURIComponent(me.name), 'Profile', icons.profile], ['friends', 'Friends', icons.friends, me.requests?.length], ['avatar', 'Avatar', icons.avatar], ['catalog', 'Marketplace', icons.shop], ['discover', 'Discover', icons.discover], ['create', 'Create', icons.create]]
      .map(([h, l, i, badge]) => `<a href="#/${h}" class="${active === h.split('/')[0] ? 'active' : ''}"><span class="sb-ico">${i}</span>${l}${badge ? `<span class="badge">${badge}</span>` : ''}</a>`).join('')}
  </aside>
  <main class="content">${content}</main>`;
}
function mount(active, html, after) {
  app.className = ''; app.innerHTML = shell(active, html);
  app.querySelector('.tb-logout').onclick = () => logout();
  document.body.classList.remove('nav-open');
  after?.(); fillThumbs();
}
function setBux(n) { if (me) me.funbux = n; document.querySelectorAll('.me-bux').forEach(e => (e.textContent = fmt(n))); }

// ---------- pages ----------
function loginPage() {
  app.className = 'landing';
  app.innerHTML = `
  <div class="landing-bg"></div>
  <div class="landing-inner">
    <div class="landing-hero"><div class="logo big"><span class="logo-icon"></span><span class="logo-text">FriendFun</span></div>
      <h1>Play, build and hang out with friends.</h1><p>Join millions of blocky adventurers. Jump into games, customize your avatar, and build your own worlds in FriendFun Studio.</p></div>
    <div class="auth-card">
      <div class="auth-tabs"><button data-m="signup" class="active">Sign Up</button><button data-m="login">Log In</button></div>
      <form class="auth-form">
        <label>Username<input name="username" autocomplete="username" placeholder="Don't use your real name" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" placeholder="At least 4 characters" required></label>
        <div class="auth-err"></div>
        <button class="btn-primary big" type="submit">Sign Up</button>
        <p class="auth-fine">Start with 100 FunBux free!</p>
      </form>
    </div>
  </div>`;
  let mode = 'signup';
  const form = app.querySelector('.auth-form');
  app.querySelectorAll('.auth-tabs button').forEach(b => b.onclick = () => {
    mode = b.dataset.m; app.querySelectorAll('.auth-tabs button').forEach(x => x.classList.toggle('active', x === b));
    form.querySelector('button[type=submit]').textContent = mode === 'signup' ? 'Sign Up' : 'Log In';
  });
  form.onsubmit = async e => {
    e.preventDefault();
    try {
      const r = await api('POST', mode === 'signup' ? '/api/signup' : '/api/login', { username: form.username.value.trim(), password: form.password.value });
      token = r.token; localStorage.setItem('ff_token', token);
      me = await api('GET', '/api/me');
      location.hash = '#/home';
    } catch (err) { form.querySelector('.auth-err').textContent = err.message; }
  };
}

async function homePage() {
  const [games, fr] = await Promise.all([api('GET', '/api/games'), api('GET', '/api/friends')]);
  const byId = Object.fromEntries(games.map(g => [g.id, g]));
  const recent = me.recent.map(id => byId[id]).filter(Boolean);
  const favs = me.favorites.map(id => byId[id]).filter(Boolean);
  const friends = fr.friends.sort((a, b) => (b.online - a.online) || (!!b.gameId - !!a.gameId));
  mount('home', `
    <div class="home-head"><img class="home-avatar" src="${avatarImage(me.avatar)}"><h1>Hello, ${esc(me.name)}!</h1></div>
    <section><div class="sec-h"><h2>Friends (${friends.length})</h2><a href="#/friends">See All &rsaquo;</a></div>
      <div class="friends-row">${friends.length ? friends.map(userTile).join('') : `<a class="add-friends" href="#/friends"><span>+</span>Add Friends</a>`}</div></section>
    ${recent.length ? `<section><div class="sec-h"><h2>Continue</h2></div><div class="game-row">${recent.map(gameCard).join('')}</div></section>` : ''}
    <section><div class="sec-h"><h2>Recommended For You</h2><a href="#/discover">See All &rsaquo;</a></div><div class="game-row">${games.slice(0, 12).map(gameCard).join('')}</div></section>
    ${favs.length ? `<section><div class="sec-h"><h2>Favorites</h2></div><div class="game-row">${favs.map(gameCard).join('')}</div></section>` : ''}
  `);
}

async function discoverPage(q) {
  const games = await api('GET', '/api/games' + (q ? '?q=' + encodeURIComponent(q) : ''));
  const top = [...games].sort((a, b) => (b.likes / (b.likes + b.dislikes || 1)) - (a.likes / (a.likes + a.dislikes || 1)));
  const fresh = [...games].sort((a, b) => b.updated - a.updated);
  mount('discover', q ? `<h1>Results for "${esc(q)}"</h1><div class="game-grid">${games.map(gameCard).join('') || '<p class="muted">No games found.</p>'}</div>`
    : `<h1>Discover</h1>
    <section><div class="sec-h"><h2>Most Popular</h2></div><div class="game-grid">${games.map(gameCard).join('')}</div></section>
    <section><div class="sec-h"><h2>Top Rated</h2></div><div class="game-row">${top.map(gameCard).join('')}</div></section>
    <section><div class="sec-h"><h2>Recently Updated</h2></div><div class="game-row">${fresh.map(gameCard).join('')}</div></section>`);
}

async function gamePage(id) {
  const g = await api('GET', '/api/games/' + id);
  const mine = g.creator.toLowerCase() === me.name.toLowerCase();
  const total = g.likes + g.dislikes;
  mount('discover', `
    <div class="gp">
      <div class="gp-top">
        <div class="gp-thumb"><img ${g.thumbnail ? `src="${g.thumbnail}"` : `src="${PLACEHOLDER}" data-thumb="${g.id}"`}></div>
        <div class="gp-info">
          <h1>${esc(g.name)}</h1>
          <div class="gp-by">By <a href="#/users/${encodeURIComponent(g.creator)}">@${esc(g.creator)}</a>${g.unpublished ? ' <span class="tag">Private</span>' : ''}</div>
          <button class="play-btn" title="Play"><svg viewBox="0 0 24 24" width="40" height="40"><path fill="#fff" d="M7 4l13 8-13 8z"/></svg></button>
          <div class="gp-actions">
            <button class="gp-fav ${g.favorited ? 'on' : ''}">&#9733; <span>${fmt(g.favorites)}</span></button>
            <div class="gp-vote"><button class="vote-up ${g.vote === 1 ? 'on' : ''}">${icons.thumb} <span>${fmt(g.likes)}</span></button><div class="vote-bar"><i style="width:${total ? g.likes / total * 100 : 0}%"></i></div><button class="vote-down ${g.vote === -1 ? 'on' : ''}"><span style="display:inline-block;transform:rotate(180deg)">${icons.thumb}</span> <span>${fmt(g.dislikes)}</span></button></div>
            ${mine ? `<a class="btn-secondary" href="#/studio/${g.id}">Edit in Studio</a>` : ''}
          </div>
        </div>
      </div>
      <div class="gp-tabs"><b>About</b></div>
      <h3>Description</h3><p class="gp-desc">${esc(g.description || 'No description.').replace(/\n/g, '<br>')}</p>
      <div class="gp-stats">
        <div><span>Active</span><b>${fmt(g.playing)}</b></div><div><span>Favorites</span><b>${fmt(g.favorites)}</b></div><div><span>Visits</span><b>${fmt(g.visits)}</b></div>
        <div><span>Created</span><b>${new Date(g.created).toLocaleDateString()}</b></div><div><span>Updated</span><b>${new Date(g.updated).toLocaleDateString()}</b></div><div><span>Server Size</span><b>${g.maxPlayers}</b></div>
      </div>
    </div>`, () => {
    app.querySelector('.play-btn').onclick = () => (location.hash = '#/play/' + g.id);
    const vote = async v => { const r = await api('POST', `/api/games/${g.id}/vote`, { vote: v }); g.vote = r.vote; route(); };
    app.querySelector('.vote-up').onclick = () => vote(1); app.querySelector('.vote-down').onclick = () => vote(-1);
    app.querySelector('.gp-fav').onclick = async () => { const r = await api('POST', `/api/games/${g.id}/favorite`); me.favorites = r.favorited ? [...me.favorites, g.id] : me.favorites.filter(x => x !== g.id); route(); };
  });
}

async function playPage(id) {
  const g = await api('GET', '/api/games/' + id);
  me = await api('GET', '/api/me');
  app.className = 'fullscreen'; app.innerHTML = '<div class="play-container"></div>';
  const game = new Game(app.querySelector('.play-container'), {
    world: g.world, gameId: g.id, gameName: g.name, me, token, funbux: me.funbux,
    onFunbux: n => (me.funbux = n), onExit: () => { cleanup = null; history.length > 1 ? history.back() : (location.hash = '#/games/' + g.id); },
  });
  cleanup = () => game.destroy();
}

// ---------- avatar editor ----------
const SKIN = ['#f5cd30', '#ffcc99', '#e8b98a', '#c68e5b', '#8d5524', '#5c3a1e', '#ffffff', '#a3a2a5', '#1b2a35', '#0d69ac', '#6e99ca', '#2f8cff', '#a4bd47', '#4b974b', '#287f47', '#c4281c', '#ff66cc', '#8a4bd8', '#da8541', '#ffd400', '#000000', '#7c5c46'];
function avatarPage(tab = 'body') {
  const av = structuredClone(me.avatar);
  let part = 'all';
  mount('avatar', `
    <h1>Avatar Editor</h1>
    <div class="av-wrap">
      <div class="av-preview"><canvas class="av-canvas"></canvas><div class="muted small">Drag to rotate</div></div>
      <div class="av-panel">
        <div class="av-tabs">${['body', 'hat', 'face', 'shirt'].map(t => `<button data-tab="${t}" class="${t === tab ? 'active' : ''}">${{ body: 'Body Colors', hat: 'Hats', face: 'Faces', shirt: 'Shirts' }[t]}</button>`).join('')}</div>
        <div class="av-body"></div>
      </div>
    </div>`, () => {
    const canvas = app.querySelector('.av-canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff', '#888', 1.5)); const dl = new THREE.DirectionalLight('#fff', 1.6); dl.position.set(3, 6, 8); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 3.6, 14); cam.lookAt(0, 3, 0);
    let ch = null, rotY = -0.4, alive = true, dragging = false, lx = 0;
    const rebuild = () => { if (ch) sc.remove(ch); ch = buildCharacter(av); ch.rotation.y = rotY; sc.add(ch); };
    const size = () => { const w = canvas.parentElement.clientWidth; r.setSize(w, w, false); r.setPixelRatio(devicePixelRatio); };
    size(); rebuild();
    canvas.onpointerdown = e => { dragging = true; lx = e.clientX; canvas.setPointerCapture(e.pointerId); };
    canvas.onpointermove = e => { if (dragging) { rotY += (e.clientX - lx) * 0.01; lx = e.clientX; } };
    canvas.onpointerup = () => (dragging = false);
    const tick = () => { if (!alive) return; requestAnimationFrame(tick); if (ch) { ch.rotation.y = rotY; } r.render(sc, cam); };
    tick();
    cleanup = () => { alive = false; r.dispose(); };
    let saveT = null;
    const save = () => { clearTimeout(saveT); saveT = setTimeout(async () => { me.avatar = await api('PUT', '/api/me/avatar', av); app.querySelector('.tb-user img').src = avatarImage(me.avatar); }, 300); };
    const body = app.querySelector('.av-body');
    const render = () => {
      if (tab === 'body') {
        const parts = [['all', 'All'], ['head', 'Head'], ['torso', 'Torso'], ['larm', 'Left Arm'], ['rarm', 'Right Arm'], ['lleg', 'Left Leg'], ['rleg', 'Right Leg']];
        body.innerHTML = `<div class="part-pick">${parts.map(([k, l]) => `<button data-part="${k}" class="${k === part ? 'active' : ''}">${k !== 'all' ? `<i class="sw" style="background:${av.colors[k]}"></i>` : ''}${l}</button>`).join('')}</div>
          <div class="swatches">${SKIN.map(c => `<button class="swatch" data-c="${c}" style="background:${c}"></button>`).join('')}<label class="swatch custom" title="Custom color"><input type="color"></label></div>`;
        body.querySelectorAll('[data-part]').forEach(b => b.onclick = () => { part = b.dataset.part; render(); });
        const apply = c => { (part === 'all' ? Object.keys(av.colors) : [part]).forEach(k => (av.colors[k] = c)); rebuild(); render(); save(); };
        body.querySelectorAll('[data-c]').forEach(b => b.onclick = () => apply(b.dataset.c));
        body.querySelector('input[type=color]').onchange = e => apply(e.target.value);
      } else {
        const owned = CATALOG.filter(i => i.type === tab && me.inventory.includes(i.id));
        body.innerHTML = `<div class="item-grid">${owned.map(i => `<button class="item ${av[tab] === i.id ? 'worn' : ''}" data-id="${i.id}"><img src="${itemImage(i)}"><span>${esc(i.name)}</span></button>`).join('')}
          <a class="item more" href="#/catalog"><span class="plus">+</span><span>Get More</span></a></div>`;
        body.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { av[tab] = b.dataset.id; rebuild(); render(); save(); });
      }
    };
    app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { tab = b.dataset.tab; app.querySelectorAll('[data-tab]').forEach(x => x.classList.toggle('active', x === b)); render(); });
    render();
  });
}
const PREVIEW_BASE = { colors: { head: '#a3a2a5', torso: '#a3a2a5', larm: '#a3a2a5', rarm: '#a3a2a5', lleg: '#a3a2a5', rleg: '#a3a2a5' }, hat: 'hat_none', face: 'face_smile', shirt: 'shirt_none' };
function itemImage(item) {
  const a = structuredClone(me?.avatar || PREVIEW_BASE);
  a[item.type] = item.id;
  return avatarImage(a, item.type === 'shirt' ? 'full' : 'headshot');
}

async function catalogPage(filter = 'all') {
  mount('catalog', `
    <h1>Marketplace</h1>
    <div class="cat-filters">${['all', 'hat', 'face', 'shirt'].map(f => `<a href="#/catalog/${f}" class="${f === filter ? 'active' : ''}">${{ all: 'All', hat: 'Hats', face: 'Faces', shirt: 'Shirts' }[f]}</a>`).join('')}</div>
    <div class="cat-grid">${CATALOG.filter(i => filter === 'all' || i.type === filter).map(i => `
      <div class="cat-item"><div class="cat-img"><img src="${itemImage(i)}"></div><div class="cat-name">${esc(i.name)}</div>
        <div class="cat-price">${i.price ? `${bux} ${i.price}` : '<span class="free">Free</span>'}</div>
        ${me.inventory.includes(i.id) ? '<button class="btn-owned" disabled>Owned</button>' : `<button class="btn-buy" data-id="${i.id}">Buy</button>`}</div>`).join('')}</div>`, () => {
    app.querySelectorAll('.btn-buy').forEach(b => b.onclick = () => {
      const it = ITEM[b.dataset.id];
      confirmModal('Buy Item', `Would you like to buy <b>${esc(it.name)}</b> for ${it.price ? bux + ' ' + it.price : 'free'}?`, 'Buy Now', async () => {
        try { const r = await api('POST', '/api/buy/' + it.id); me.inventory = r.inventory; setBux(r.funbux); toast(`You bought ${it.name}!`); catalogPage(filter); }
        catch (e) { toast(e.message, true); }
      });
    });
  });
}
function confirmModal(title, html, ok, onOk) {
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<div class="modal"><h2>${title}</h2><p>${html}</p><div class="modal-actions"><button class="btn-secondary">Cancel</button><button class="btn-primary">${ok}</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector('.btn-secondary').onclick = () => d.remove();
  d.querySelector('.btn-primary').onclick = () => { d.remove(); onOk(); };
  d.onclick = e => { if (e.target === d) d.remove(); };
}

async function friendsPage() {
  const fr = await api('GET', '/api/friends');
  mount('friends', `
    <h1>Friends</h1>
    <form class="user-search"><input name="q" placeholder="Search for people by username"><button class="btn-primary">Search</button></form>
    <div class="search-results"></div>
    ${fr.requests.length ? `<section><div class="sec-h"><h2>Friend Requests (${fr.requests.length})</h2></div><div class="req-list">${fr.requests.map(u => `
      <div class="req"><img src="${avatarImage(u.avatar)}"><a href="#/users/${encodeURIComponent(u.name)}">${esc(u.name)}</a><button class="btn-primary" data-accept="${esc(u.name)}">Accept</button><button class="btn-secondary" data-decline="${esc(u.name)}">Ignore</button></div>`).join('')}</div></section>` : ''}
    <section><div class="sec-h"><h2>My Friends (${fr.friends.length})</h2></div>
      <div class="friend-grid">${fr.friends.map(u => `<div class="friend-card">${userTile(u)}${u.gameId ? `<a class="btn-join" href="#/play/${u.gameId}">Join</a>` : `<span class="muted small">${u.online ? 'Online' : 'Offline'}</span>`}</div>`).join('') || '<p class="muted">No friends yet. Search for people above!</p>'}</div></section>`, () => {
    app.querySelectorAll('[data-accept]').forEach(b => b.onclick = async () => { await api('POST', '/api/friends/' + encodeURIComponent(b.dataset.accept)); toast('You are now friends with ' + b.dataset.accept); me = await api('GET', '/api/me'); friendsPage(); });
    app.querySelectorAll('[data-decline]').forEach(b => b.onclick = async () => { await api('DELETE', '/api/friends/' + encodeURIComponent(b.dataset.decline)); me = await api('GET', '/api/me'); friendsPage(); });
    app.querySelector('.user-search').onsubmit = async e => {
      e.preventDefault();
      const r = await api('GET', '/api/search/users?q=' + encodeURIComponent(e.target.q.value));
      app.querySelector('.search-results').innerHTML = `<div class="friends-row">${r.map(userTile).join('') || '<p class="muted">No users found.</p>'}</div>`;
    };
  });
}

async function profilePage(name) {
  const u = await api('GET', '/api/users/' + encodeURIComponent(name));
  const isMe = u.name.toLowerCase() === me.name.toLowerCase();
  mount('users', `
    <div class="profile-head">
      <div class="ph-img ${u.gameId ? 'ingame' : u.online ? 'online' : ''}"><img src="${avatarImage(u.avatar)}"></div>
      <div class="ph-info"><h1>${esc(u.name)}</h1><div class="muted">@${esc(u.name)}</div>
        <div class="ph-stats"><div><b>${u.friends}</b> Friends</div><div><b>${u.games.length}</b> Creations</div><div>${u.gameName ? `Playing <a href="#/games/${u.gameId}">${esc(u.gameName)}</a>` : u.online ? 'Online' : 'Offline'}</div></div>
      </div>
      <div class="ph-actions">${isMe ? '<a class="btn-secondary" href="#/avatar">Edit Avatar</a>' : u.isFriend ? `${u.gameId ? `<a class="btn-primary" href="#/play/${u.gameId}">Join Game</a>` : ''}<button class="btn-secondary unfriend">Unfriend</button>` : u.requested ? '<button class="btn-secondary" disabled>Request Sent</button>' : '<button class="btn-primary add-friend">Add Friend</button>'}</div>
    </div>
    <section><div class="sec-h"><h2>About</h2>${isMe ? '<button class="link edit-bio">Edit</button>' : ''}</div><p class="bio">${esc(u.bio || (isMe ? 'Tell people about yourself!' : 'This user has no bio.'))}</p></section>
    <section class="profile-grid">
      <div class="profile-avatar"><h2>Currently Wearing</h2><img src="${avatarImage(u.avatar, 'full')}"></div>
      <div><h2>Friends (${u.friendsList.length})</h2><div class="friends-row wrap">${u.friendsList.map(userTile).join('') || '<p class="muted">No friends yet.</p>'}</div></div>
    </section>
    <section><div class="sec-h"><h2>Creations</h2></div><div class="game-row">${u.games.map(gameCard).join('') || '<p class="muted">No creations yet.</p>'}</div></section>`, () => {
    app.querySelector('.add-friend')?.addEventListener('click', async () => { const r = await api('POST', '/api/friends/' + encodeURIComponent(u.name)); toast(r.status === 'friends' ? 'You are now friends!' : 'Friend request sent'); profilePage(name); });
    app.querySelector('.unfriend')?.addEventListener('click', () => confirmModal('Unfriend', `Unfriend ${esc(u.name)}?`, 'Unfriend', async () => { await api('DELETE', '/api/friends/' + encodeURIComponent(u.name)); profilePage(name); }));
    app.querySelector('.edit-bio')?.addEventListener('click', () => {
      const p = app.querySelector('.bio'); p.outerHTML = `<div class="bio-edit"><textarea maxlength="300" rows="3">${esc(u.bio)}</textarea><button class="btn-primary">Save</button></div>`;
      app.querySelector('.bio-edit button').onclick = async () => { await api('PUT', '/api/me/bio', { bio: app.querySelector('.bio-edit textarea').value }); profilePage(name); };
    });
  });
}

async function createPage() {
  const mine = await api('GET', '/api/mygames');
  const tpls = [['baseplate', 'Baseplate', 'An empty grey baseplate. A blank canvas.'], ['obby', 'Obby', 'A 10-stage obstacle course to remix.'], ['hangout', 'Town', 'A small town with houses and trees.'], ['tower', 'Tower Climb', 'A spiral climbing challenge.'], ['coinRush', 'Islands', 'Floating islands full of coins.']];
  mount('create', `
    <h1>Create</h1>
    <section><div class="sec-h"><h2>Start a New Experience</h2></div><div class="tpl-grid">${tpls.map(([k, n, d]) => `
      <a class="tpl" href="#/studio/new/${k}"><div class="gc-thumb"><img data-tpl="${k}" src="${PLACEHOLDER}"></div><b>${n}</b><span class="muted small">${d}</span></a>`).join('')}</div></section>
    <section><div class="sec-h"><h2>My Experiences (${mine.length})</h2></div>
      <div class="my-games">${mine.map(g => `<div class="my-game"><img ${g.thumbnail ? `src="${g.thumbnail}"` : `src="${PLACEHOLDER}" data-thumb="${g.id}"`}><div class="mg-info"><b>${esc(g.name)}</b><span class="muted small">${g.unpublished ? 'Private (not published)' : 'Public'} &middot; ${fmt(g.visits)} visits &middot; ${fmt(g.playing)} playing</span></div>
        <a class="btn-secondary" href="#/studio/${g.id}">Edit</a><a class="btn-secondary" href="#/games/${g.id}">View</a><button class="btn-danger" data-del="${g.id}">Delete</button></div>`).join('') || '<p class="muted">You haven\'t made anything yet. Pick a template above to open FriendFun Studio!</p>'}</div></section>`, () => {
    setTimeout(() => app.querySelectorAll('img[data-tpl]').forEach(img => { img.src = tplThumb(img.dataset.tpl); }), 30);
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmModal('Delete Experience', 'This cannot be undone. Delete it?', 'Delete', async () => { await api('DELETE', '/api/games/' + b.dataset.del); createPage(); }));
  });
}
const tplCache = {};
function tplThumb(k) { return tplCache[k] ||= worldThumbnail(templates[k]()); }

async function studioPage(id, tpl) {
  let g;
  if (id === 'new') g = { id: null, name: 'My ' + ({ baseplate: 'Baseplate', obby: 'Obby', hangout: 'Town', tower: 'Tower', coinRush: 'Islands' }[tpl] || 'Game'), description: '', world: (templates[tpl] || templates.baseplate)() };
  else { g = await api('GET', '/api/games/' + id); if (g.creator.toLowerCase() !== me.name.toLowerCase()) { toast('You can only edit your own games', true); location.hash = '#/games/' + id; return; } }
  app.className = 'fullscreen'; app.innerHTML = '<div class="studio-container"></div>';
  let game = null;
  const studio = new Studio(app.querySelector('.studio-container'), {
    gameId: g.id, name: g.name, description: g.description, world: g.world, api, toast,
    onCreated: newId => history.replaceState(null, '', '#/studio/' + newId),
    onExit: gid => { cleanup = null; location.hash = gid ? '#/create' : '#/create'; },
    playTest: (box, world, name, done) => {
      game = new Game(box, { world, gameName: name + ' (Test)', me, token, test: true, onExit: () => { game = null; done(); } });
    },
  });
  cleanup = () => { game?.destroy(); studio.destroy(); };
}

function funbuxPage() {
  mount('funbux', `<h1>FunBux</h1>
    <div class="bux-hero">${bux}<div><div class="bux-big">${fmt(me.funbux)}</div><div class="muted">Your balance</div></div></div>
    <div class="bux-ways">
      <div class="bux-way"><h3>Collect Coins</h3><p>Every gold coin you pick up in a game gives you 1 FunBux.</p></div>
      <div class="bux-way"><h3>Beat Obbies</h3><p>Touch a Win Pad at the end of an obby for 25 FunBux (once per visit).</p></div>
      <div class="bux-way"><h3>Spend Them</h3><p>Visit the <a href="#/catalog">Marketplace</a> to buy hats, faces and shirts for your avatar.</p></div>
    </div>`);
}

// ---------- router ----------
let routing = 0;
async function route() {
  const my = ++routing;
  if (cleanup) { const c = cleanup; cleanup = null; c(); }
  const [path, query] = location.hash.slice(1).split('?');
  const seg = (path || '/home').split('/').filter(Boolean);
  if (!token) { if (seg[0] !== 'login') history.replaceState(null, '', '#/login'); return loginPage(); }
  try {
    if (!me) me = await api('GET', '/api/me');
    if (my !== routing) return;
    const qp = new URLSearchParams(query || '');
    switch (seg[0]) {
      case 'login': location.hash = '#/home'; return;
      case 'discover': return await discoverPage(qp.get('q'));
      case 'games': return await gamePage(seg[1]);
      case 'play': return await playPage(seg[1]);
      case 'avatar': return avatarPage();
      case 'catalog': return await catalogPage(seg[1]);
      case 'friends': return await friendsPage();
      case 'users': return await profilePage(decodeURIComponent(seg[1]));
      case 'create': return await createPage();
      case 'studio': return await studioPage(seg[1], seg[2]);
      case 'funbux': return funbuxPage();
      default: return await homePage();
    }
  } catch (e) {
    if (!token) return;
    mount('', `<div class="error-page"><h1>Oops!</h1><p>${esc(e.message)}</p><a class="btn-primary" href="#/home">Go Home</a></div>`);
  }
}
addEventListener('hashchange', route);
setInterval(async () => {
  if (!token || !me) return;
  try { const r = await api('POST', '/api/ping'); setBux(r.funbux); if (r.requests !== me.requests.length) { me = await api('GET', '/api/me'); } } catch {}
}, 20000);
route();
