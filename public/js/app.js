import { Game, nameColor, tix, LOGO, CLUB, badgeIcon } from './game.js';
import { Studio } from './studio.js';
import { avatarImage, buildCharacter } from './avatar3d.js';
import { worldThumbnail } from './three-util.js';
import { CATALOG, ITEM, ECON, BADGES } from './catalog.js';
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
function logout(silent) { if (!silent && token) api('POST', '/api/logout').catch(() => {}); removeAccount(me?.name); token = null; me = null; localStorage.removeItem('ff_token'); location.hash = '#/login'; route(); }
function logoutAll() { const accs = getAccounts(); for (const a of accs) { try { fetch('/api/logout', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + a.token } }); } catch {} } localStorage.removeItem('ff_accounts'); localStorage.removeItem('ff_token'); token = null; me = null; location.hash = '#/login'; route(); }
function getAccounts() { try { return JSON.parse(localStorage.getItem('ff_accounts') || '[]'); } catch { return []; } }
function saveAccounts(accs) { localStorage.setItem('ff_accounts', JSON.stringify(accs)); }
function addAccount(name, tok) { const accs = getAccounts().filter(a => a.name.toLowerCase() !== name.toLowerCase()); accs.push({ name, token: tok }); saveAccounts(accs); }
function removeAccount(name) { if (!name) return; saveAccounts(getAccounts().filter(a => a.name.toLowerCase() !== String(name).toLowerCase())); }
function switchAccount(name) { const acc = getAccounts().find(a => a.name.toLowerCase() === String(name).toLowerCase()); if (!acc) return; token = acc.token; localStorage.setItem('ff_token', token); me = null; location.hash = '#/home'; route(); }
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace('.0', '') + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1).replace('.0', '') + 'K' : String(n);
const rating = g => (g.likes + g.dislikes) ? Math.round(g.likes / (g.likes + g.dislikes) * 100) + '%' : '--';
const icons = {
  home: '<svg viewBox="0 0 24 24"><path d="M12 3l9 8h-3v9h-5v-6h-2v6H6v-9H3z"/></svg>',
  profile: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.5"/><path d="M3 21c0-5 4-8 9-8s9 3 9 8z"/></svg>',
  friends: '<svg viewBox="0 0 24 24"><circle cx="8" cy="8" r="3.5"/><circle cx="17" cy="9" r="3"/><path d="M1 20c0-4 3-7 7-7s7 3 7 7zM14 20c0-2-.6-4-2-5.5 1.5-1 3-1.5 5-1.5 3.5 0 6 2.5 6 7z"/></svg>',
  groups: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 20c0-4 2.5-6 6-6s6 2 6 6M15 14c3 0 5 2 5 6"/></svg>',
  avatar: '<svg viewBox="0 0 24 24"><rect x="8" y="2" width="8" height="6" rx="1"/><rect x="7" y="9" width="10" height="7"/><rect x="3" y="9" width="3.5" height="7"/><rect x="17.5" y="9" width="3.5" height="7"/><rect x="7" y="16.5" width="4.5" height="6"/><rect x="12.5" y="16.5" width="4.5" height="6"/></svg>',
  shop: '<svg viewBox="0 0 24 24"><path d="M4 7h16l-1.5 13h-13zM8 7a4 4 0 0 1 8 0" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  create: '<svg viewBox="0 0 24 24"><path d="M3 17l11-11 4 4-11 11H3zM15 5l2-2 4 4-2 2z"/></svg>',
  discover: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
  club: '<svg viewBox="0 0 24 24"><path d="M2 17h20v3H2zM4 16a8 8 0 0 1 16 0zM10.5 7h3v5h-3z"/></svg>',
  shield: '<svg viewBox="0 0 24 24"><path d="M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z"/></svg>',
  trophy: '<svg viewBox="0 0 24 24"><path d="M6 3h12v2h3v3a5 5 0 0 1-4.6 5A6 6 0 0 1 13 16.9V19h4v2H7v-2h4v-2.1A6 6 0 0 1 7.6 13 5 5 0 0 1 3 8V5h3zM5 7v1a3 3 0 0 0 1.3 2.5C6.1 9.7 6 8.9 6 8V7zm13 0v1c0 .9-.1 1.7-.3 2.5A3 3 0 0 0 19 8V7z"/></svg>',
  thumb: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M2 10h4v11H2zM8 21V10l5-8c1.5 0 2.5 1 2.2 2.6L14.5 9H21c1 0 2 1 1.7 2.2l-2 8.3c-.2.9-1 1.5-2 1.5z"/></svg>',
  people: '<svg viewBox="0 0 24 24" width="14" height="14"><path fill="currentColor" d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM0 20c0-4 3.5-7 8-7s8 3 8 7zm17 0c0-2-.7-4-2-5.3 4.5-.8 9 1 9 5.3z"/></svg>',
};

const ADMIN = '<span class="admin-badge">ADMIN</span>';

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
    <a class="logo" href="#/home"><span class="logo-icon">${LOGO}</span><span class="logo-text">FriendFun</span></a>
    <nav class="tb-nav"><a href="#/discover">Discover</a><a href="#/catalog">Marketplace</a><a href="#/create">Create</a><a href="#/funtix">FunTix</a><a href="#/club">FriendClub</a></nav>
    <form class="tb-search" onsubmit="event.preventDefault(); location.hash='#/discover?q='+encodeURIComponent(this.q.value)"><input name="q" placeholder="Search"></form>
    <div class="tb-right">
      <div class="tb-user-wrap">
        <button class="tb-user" title="Account menu"><img src="${avatarImage(me.avatar)}"><span>${esc(me.name)}</span><span class="tb-caret">&#9662;</span></button>
        <div class="tb-menu hidden">
          <a href="#/users/${encodeURIComponent(me.name)}" class="tb-menu-item"><span class="sb-ico">${icons.profile}</span>View Profile</a>
          <div class="tb-menu-sep"></div>
          <div class="tb-menu-head">Switch account</div>
          <div class="tb-accounts"></div>
          <button class="tb-menu-item tb-add-account"><span class="sb-ico">+</span>Add account</button>
          <div class="tb-menu-sep"></div>
          <button class="tb-menu-item tb-logout"><span class="sb-ico">&#9094;</span>Log out</button>
          <button class="tb-menu-item tb-logout-all"><span class="sb-ico">&#10006;</span>Log out all</button>
        </div>
      </div>
      <a class="tb-bux" href="#/funtix" title="FunTix">${tix}<span class="me-tix">${fmt(me.funtix ?? 0)}</span></a>
    </div>
  </header>
  <aside class="sidebar">
    ${[['home', 'Home', icons.home], ['users/' + encodeURIComponent(me.name), 'Profile', icons.profile], ['friends', 'Friends', icons.friends, me.requests?.length], ['groups', 'Groups', icons.groups], ['avatar', 'Avatar', icons.avatar], ['catalog', 'Marketplace', icons.shop], ['leaderboard', 'Leaderboard', icons.trophy], ['club', 'FriendClub', icons.club], ['discover', 'Discover', icons.discover], ['create', 'Create', icons.create], ...(me.admin ? [['admin', 'Admin', icons.shield]] : [])]
      .map(([h, l, i, badge]) => `<a href="#/${h}" class="${active === h.split('/')[0] ? 'active' : ''}"><span class="sb-ico">${i}</span>${l}${badge ? `<span class="badge">${badge}</span>` : ''}</a>`).join('')}
    <button class="sidebar-logout"><span class="sb-ico">&#9094;</span>Log Out</button>
  </aside>
  <main class="content">${content}</main>`;
}
function mount(active, html, after) {
  app.className = ''; app.innerHTML = shell(active, html);
  const userBtn = app.querySelector('.tb-user');
  const menu = app.querySelector('.tb-menu');
  if (userBtn && menu) {
    userBtn.onclick = e => { e.stopPropagation(); menu.classList.toggle('hidden'); renderAccountList(); };
    document.addEventListener('click', () => menu.classList.add('hidden'), { once: true });
    menu.onclick = e => e.stopPropagation();
  }
  const renderAccountList = () => {
    const listEl = app.querySelector('.tb-accounts');
    if (!listEl) return;
    const accs = getAccounts().filter(a => a.name.toLowerCase() !== me.name.toLowerCase());
    listEl.innerHTML = accs.length
      ? accs.map(a => `<button class="tb-menu-item tb-switch" data-name="${esc(a.name)}"><img src="${avatarImage(me.avatar)}" style="width:24px;height:24px;border-radius:50%">${esc(a.name)}</button>`).join('')
      : '<div class="tb-menu-empty">No other accounts</div>';
    listEl.querySelectorAll('.tb-switch').forEach(b => b.onclick = () => switchAccount(b.dataset.name));
  };
  renderAccountList();
  app.querySelector('.tb-add-account').onclick = () => showAddAccountModal();
  app.querySelector('.tb-logout').onclick = () => logout();
  app.querySelector('.tb-logout-all').onclick = () => { if (confirm('Log out of all accounts?')) logoutAll(); };
  const sbLogout = app.querySelector('.sidebar-logout');
  if (sbLogout) sbLogout.onclick = () => logout();
  document.body.classList.remove('nav-open');
  after?.(); fillThumbs();
}
function showAddAccountModal() {
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<div class="modal"><h2>Add Account</h2>
    <p class="muted small">Log in with another account. Your current session stays saved.</p>
    <form class="auth-form">
      <label>Username<input name="username" placeholder="Username" required></label>
      <label>Password<input name="password" type="password" placeholder="Password" required></label>
      <div class="auth-err"></div>
      <div class="modal-actions"><button type="button" class="btn-secondary">Cancel</button><button class="btn-primary" type="submit">Add Account</button></div>
    </form></div>`;
  document.body.appendChild(d);
  d.querySelector('.btn-secondary').onclick = () => d.remove();
  d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('form').onsubmit = async e => {
    e.preventDefault();
    const form = e.target;
    try {
      const r = await api('POST', '/api/login', { username: form.username.value.trim(), password: form.password.value });
      const newMe = await fetch('/api/me', { headers: { Authorization: 'Bearer ' + r.token } }).then(x => x.json());
      addAccount(newMe.name, r.token);
      d.remove();
      switchAccount(newMe.name);
      toast('Switched to ' + newMe.name);
    } catch (err) { d.querySelector('.auth-err').textContent = err.message; }
  };
}
function setMoney(r) {
  if (r.funtix != null) { if (me) me.funtix = r.funtix; document.querySelectorAll('.me-tix').forEach(e => (e.textContent = fmt(r.funtix))); }
}
function dailyToast(r) { if (r?.daily) toast(`Daily reward: +${r.daily} FunTix!`); }

// ---------- pages ----------
function loginPage() {
  app.className = 'landing';
  app.innerHTML = `
  <div class="landing-bg"></div>
  <div class="landing-inner">
    <div class="landing-hero"><div class="logo big"><span class="logo-icon">${LOGO}</span><span class="logo-text">FriendFun</span></div>
      <h1>Play, build and hang out with friends.</h1><p>Join millions of blocky adventurers. Jump into games, customize your avatar, and build your own worlds in FriendFun Studio.</p></div>
    <div class="auth-card">
      <div class="auth-tabs"><button data-m="signup" class="active">Sign Up</button><button data-m="login">Log In</button></div>
      <form class="auth-form">
        <label>Username<input name="username" autocomplete="username" placeholder="Don't use your real name" required></label>
        <label>Password<input name="password" type="password" autocomplete="current-password" placeholder="At least 4 characters" required></label>
        <div class="auth-err"></div>
        <button class="btn-primary big" type="submit">Sign Up</button>
        <p class="auth-fine">Start with ${ECON.START_TIX} FunTix free!</p>
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
      addAccount(me.name, token);
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
            <a class="btn-secondary" href="/g/${g.id}.html" target="_blank" title="Open standalone HTML version">Export HTML</a>
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
    world: g.world, gameId: g.id, gameName: g.name, me, token, funtix: me.funtix,
    onMoney: r => setMoney(r), onExit: () => { cleanup = null; history.length > 1 ? history.back() : (location.hash = '#/games/' + g.id); },
  });
  cleanup = () => game.destroy();
}

// ---------- avatar editor ----------
const SKIN = ['#f5cd30', '#ffcc99', '#e8b98a', '#c68e5b', '#8d5524', '#5c3a1e', '#ffffff', '#a3a2a5', '#1b2a35', '#0d69ac', '#6e99ca', '#2f8cff', '#a4bd47', '#4b974b', '#287f47', '#c4281c', '#ff66cc', '#8a4bd8', '#da8541', '#ffd400', '#000000', '#7c5c46'];
function avatarPage(tab = 'body') {
  const av = structuredClone(me.avatar); av.head ??= 'head_classic';
  let part = 'all';
  mount('avatar', `
    <h1>Avatar Editor</h1>
    <div class="av-wrap">
      <div class="av-preview"><canvas class="av-canvas"></canvas><div class="muted small">Drag to rotate</div></div>
      <div class="av-panel">
        <div class="av-tabs">${['body', 'head', 'hat', 'face', 'shirt'].map(t => `<button data-tab="${t}" class="${t === tab ? 'active' : ''}">${{ body: 'Body Colors', head: 'Heads', hat: 'Hats', face: 'Faces', shirt: 'Shirts' }[t]}</button>`).join('')}</div>
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
    <div class="cat-filters">${['all', 'head', 'hat', 'face', 'shirt'].map(f => `<a href="#/catalog/${f}" class="${f === filter ? 'active' : ''}">${{ all: 'All', head: 'Heads', hat: 'Hats', face: 'Faces', shirt: 'Shirts' }[f]}</a>`).join('')}</div>
    <div class="cat-grid">${CATALOG.filter(i => filter === 'all' || i.type === filter).map(i => `
      <div class="cat-item"><div class="cat-img"><img src="${itemImage(i)}"></div><div class="cat-name">${esc(i.name)}</div>
        <div class="cat-price">${priceHtml(i)}</div>
        ${me.inventory.includes(i.id) ? '<button class="btn-owned" disabled>Owned</button>' : i.club && !me.club ? '<a class="btn-club" href="#/club">Members Only</a>' : `<button class="btn-buy" data-id="${i.id}">Buy</button>`}</div>`).join('')}</div>`, () => {
    app.querySelectorAll('.btn-buy').forEach(b => b.onclick = () => {
      buyModal(ITEM[b.dataset.id], () => catalogPage(filter));
    });
  });
}
function priceHtml(i) {
  if (i.club) return `<span class="club-price">${CLUB} FriendClub</span>`;
  return i.free ? '<span class="free">Free</span>' : `<span class="pc">${tix} ${i.price}</span>`;
}
function buyModal(it, onDone) {
  const opts = [['tix', tix, it.price, me.funtix ?? 0]];
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<div class="modal"><h2>Buy Item</h2>
    <div class="buy-row"><img src="${itemImage(it)}"><div><p>Would you like to buy <b>${esc(it.name)}</b>?</p>
    <p class="muted small">You have ${tix} ${fmt(me.funtix ?? 0)}</p></div></div>
    <div class="modal-actions"><button class="btn-secondary">Cancel</button>${opts.map(([c, ic, p, bal]) => `<button class="btn-primary buy-with" data-c="${c}" ${bal < p ? 'disabled title="Not enough"' : ''}>Buy for ${ic} ${p}</button>`).join('')}</div></div>`;
  document.body.appendChild(d);
  d.querySelector('.btn-secondary').onclick = () => d.remove();
  d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelectorAll('[data-c]').forEach(b => b.onclick = async () => {
    d.remove();
    try { const r = await api('POST', '/api/buy/' + it.id); me.inventory = r.inventory; setMoney(r); toast(`You bought ${it.name}!`); onDone(); }
    catch (e) { toast(e.message, true); }
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

async function groupsPage() {
  const load = async () => {
    const groups = await api('GET', '/api/groups');
    const q = String(app.querySelector('.groups-search')?.value || '').trim().toLowerCase();
    const filtered = q ? groups.filter(g => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)) : groups;
    const list = app.querySelector('.group-grid');
    if (!list) return;
    list.innerHTML = filtered.length ? filtered.map(g => `
      <article class="group-card">
        <div class="group-icon">${esc(g.name.slice(0, 1).toUpperCase())}</div>
        <div class="group-card-body">
          <h3>${esc(g.name)}</h3>
          <p>${esc(g.description || 'No description yet.')}</p>
          <div class="group-meta"><span>${g.members} member${g.members === 1 ? '' : 's'}</span><span>Creator: ${esc(g.creator || 'Unknown')}</span></div>
          <button class="${g.joined ? 'btn-secondary' : 'btn-primary'} group-action" data-id="${esc(g.id)}" data-action="${g.joined ? 'leave' : 'join'}" ${g.isCreator ? 'disabled title="The creator cannot leave their group"' : ''}>
            ${g.joined ? 'Leave Group' : 'Join Group'}
          </button>
        </div>
      </article>`).join('') : '<p class="muted">No groups found. Create the first one!</p>';
    list.querySelectorAll('.group-action').forEach(btn => btn.onclick = async () => {
      try {
        await api('POST', `/api/groups/${encodeURIComponent(btn.dataset.id)}/${btn.dataset.action}`);
        toast(btn.dataset.action === 'join' ? 'Joined group!' : 'Left group.');
        await load();
      } catch (e) { toast(e.message, true); }
    });
  };

  mount('groups', `
    <div class="groups-head">
      <div><h1>Groups</h1><p class="muted">Find people who like the same games and create communities on FriendFun.</p></div>
      <button class="btn-primary" id="create-group">Create Group</button>
    </div>
    <form class="groups-search-row">
      <input class="groups-search" placeholder="Search groups..." autocomplete="off">
      <button class="btn-secondary" type="submit">Search</button>
    </form>
    <div class="group-grid"></div>
  `, () => {
    app.querySelector('#create-group').onclick = () => {
      const d = document.createElement('div');
      d.className = 'modal-bg';
      d.innerHTML = `<div class="modal">
        <h2>Create a Group</h2>
        <form class="group-create-form">
          <label>Group name<input name="name" maxlength="40" minlength="3" placeholder="e.g. Obby Masters" required></label>
          <label>Description<textarea name="description" maxlength="240" rows="4" placeholder="What is your group about?"></textarea></label>
          <div class="modal-actions"><button type="button" class="btn-secondary cancel">Cancel</button><button class="btn-primary">Create</button></div>
        </form>
      </div>`;
      document.body.appendChild(d);
      d.querySelector('.cancel').onclick = () => d.remove();
      d.querySelector('.group-create-form').onsubmit = async e => {
        e.preventDefault();
        const form = e.currentTarget;
        try {
          await api('POST', '/api/groups', { name: form.name.value.trim(), description: form.description.value.trim() });
          d.remove();
          toast('Group created!');
          await load();
        } catch (err) { toast(err.message, true); }
      };
    };
    app.querySelector('.groups-search-row').onsubmit = e => { e.preventDefault(); load(); };
    app.querySelector('.groups-search').oninput = () => load();
    load();
  });
}

async function profilePage(name) {
  const u = await api('GET', '/api/users/' + encodeURIComponent(name));
  const isMe = u.name.toLowerCase() === me.name.toLowerCase();
  mount('users', `
    <div class="profile-head">
      <div class="ph-img ${u.gameId ? 'ingame' : u.online ? 'online' : ''}"><img src="${avatarImage(u.avatar)}"></div>
      <div class="ph-info"><h1>${esc(u.name)}${badgeIcon(u.badge)}</h1><div class="muted">@${esc(u.name)}</div>
        <div class="ph-stats"><div><b>${u.friends}</b> Friends</div><div><b>${u.games.length}</b> Creations</div><div>${u.gameName ? `Playing <a href="#/games/${u.gameId}">${esc(u.gameName)}</a>` : u.online ? 'Online' : 'Offline'}</div></div>
      </div>
      <div class="ph-actions">${isMe ? '<a class="btn-secondary" href="#/avatar">Edit Avatar</a>' : u.isFriend ? `${u.gameId ? `<a class="btn-primary" href="#/play/${u.gameId}">Join Game</a>` : ''}<button class="btn-secondary unfriend">Unfriend</button>` : u.requested ? '<button class="btn-secondary" disabled>Request Sent</button>' : '<button class="btn-primary add-friend">Add Friend</button>'}</div>
    </div>
    <section><div class="sec-h"><h2>About</h2>${isMe ? '<button class="link edit-bio">Edit</button>' : ''}</div><p class="bio">${esc(u.bio || (isMe ? 'Tell people about yourself!' : 'This user has no bio.'))}</p></section>
    <section><div class="sec-h"><h2>Badges (${u.badges.length})</h2></div>
      ${isMe && u.badges.length ? '<p class="muted small">Click a badge to show it next to your name.</p>' : ''}
      <div class="badge-grid">${u.badges.map(id => `<${isMe ? 'button' : 'div'} class="badge-card ${u.badge === id ? 'on' : ''}" data-badge="${id}">${badgeIcon(id, 44)}<b>${BADGES[id].name}</b><span class="muted small">${BADGES[id].desc}</span>${u.badge === id ? '<span class="badge-feat">Shown</span>' : ''}</${isMe ? 'button' : 'div'}>`).join('')}
        ${isMe && u.badges.length ? `<button class="badge-card none ${u.badge ? '' : 'on'}" data-badge="none"><b>None</b><span class="muted small">Don't show a badge</span>${u.badge ? '' : '<span class="badge-feat">Shown</span>'}</button>` : ''}</div>
      ${u.badges.length ? '' : '<p class="muted">No badges yet.</p>'}</section>
    <section class="profile-grid">
      <div class="profile-avatar"><h2>Currently Wearing</h2><img src="${avatarImage(u.avatar, 'full')}"></div>
      <div><h2>Friends (${u.friendsList.length})</h2><div class="friends-row wrap">${u.friendsList.map(userTile).join('') || '<p class="muted">No friends yet.</p>'}</div></div>
    </section>
    <section><div class="sec-h"><h2>Creations</h2></div><div class="game-row">${u.games.map(gameCard).join('') || '<p class="muted">No creations yet.</p>'}</div></section>`, () => {
    app.querySelector('.add-friend')?.addEventListener('click', async () => { const r = await api('POST', '/api/friends/' + encodeURIComponent(u.name)); toast(r.status === 'friends' ? 'You are now friends!' : 'Friend request sent'); profilePage(name); });
    app.querySelector('.unfriend')?.addEventListener('click', () => confirmModal('Unfriend', `Unfriend ${esc(u.name)}?`, 'Unfriend', async () => { await api('DELETE', '/api/friends/' + encodeURIComponent(u.name)); profilePage(name); }));
    app.querySelectorAll('button[data-badge]').forEach(b => b.onclick = async () => {
      try { await api('PUT', '/api/me/badge', { badge: b.dataset.badge }); toast('Badge updated'); profilePage(name); }
      catch (e) { toast(e.message, true); }
    });
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

async function leaderboardPage() {
  const lb = await api('GET', '/api/leaderboard');
  setMoney(lb);
  mount('leaderboard', `<h1>FunTix Leaderboard</h1>
    <div class="lb-me">${tix}<span>You have <b>${fmt(lb.funtix)}</b> FunTix</span><span class="lb-rank">Your rank <b>#${lb.rank}</b> of ${lb.total}</span></div>
    <div class="lbp">${lb.top.map((u, i) => `
      <a class="lbp-row${u.name === me.name ? ' me' : ''}${i < 3 ? ' top' + (i + 1) : ''}" href="#/users/${encodeURIComponent(u.name)}">
        <span class="lbp-rank">${i + 1}</span><img src="${avatarImage(u.avatar)}">
        <span class="lbp-name">${badgeIcon(u.badge)}${esc(u.name)}${u.online ? '<i class="dot" title="Online"></i>' : ''}</span>
        <span class="lbp-tix">${tix}${u.funtix.toLocaleString()}</span></a>`).join('')}</div>`);
}
async function adminPage(q = '') {
  if (!me.admin) { location.hash = '#/home'; return; }
  const users = await api('GET', '/api/admin/users?q=' + encodeURIComponent(q));
  const badgeOpts = Object.entries(BADGES).map(([id, b]) => `<option value="${esc(id)}">${esc(b.name)}</option>`).join('');
  const status = u => u.admin ? 'Admin' : u.clubForever ? 'FriendClub (free)' : u.club ? `FriendClub (${Math.ceil((u.clubUntil - Date.now()) / 86400000)} days left)` : 'Not a member';
  mount('admin', `<h1>Admin Panel</h1>
    <p class="muted">Manage players: FriendClub, FunTix, badges and quick actions.</p>
    <form class="admin-search"><input name="q" placeholder="Search players" value="${esc(q)}"><button class="btn-primary">Search</button></form>
    <div class="lbp">${users.map(u => `
      <div class="lbp-row admin-row-wrap">
        <img src="${avatarImage(u.avatar)}"><a class="lbp-name" href="#/users/${encodeURIComponent(u.name)}">${u.club ? CLUB : ''}${esc(u.name)}${u.admin ? ADMIN : ''}</a>
        <span class="admin-status">${status(u)} &middot; ${tix} ${(u.funtix ?? 0).toLocaleString()}</span>
        <div class="admin-controls">
          ${u.admin ? '' : u.club
            ? `<button class="btn-secondary club-toggle" data-name="${esc(u.name)}" data-on="0">Remove FriendClub</button>`
            : `<button class="btn-primary club-toggle" data-name="${esc(u.name)}" data-on="1">Give FriendClub</button>`}
          <span class="admin-inline">
            <input type="number" class="tix-amt" data-name="${esc(u.name)}" value="100" min="1" max="10000" title="FunTix amount">
            <button class="btn-secondary tix-give" data-name="${esc(u.name)}">Give FunTix</button>
          </span>
          <span class="admin-inline">
            <select class="badge-sel" data-name="${esc(u.name)}">${badgeOpts}</select>
            <button class="btn-secondary badge-grant" data-name="${esc(u.name)}">Grant badge</button>
            <button class="btn-secondary badge-revoke" data-name="${esc(u.name)}">Revoke</button>
          </span>
          <span class="admin-inline">
            <button class="btn-secondary items-give" data-name="${esc(u.name)}" title="Give every marketplace item">Give all items</button>
            <button class="btn-secondary daily-reset" data-name="${esc(u.name)}" title="Reset daily reward">Reset daily</button>
          </span>
        </div>
      </div>`).join('') || '<p class="muted">No players found.</p>'}</div>`, () => {
    app.querySelector('.admin-search').onsubmit = e => { e.preventDefault(); adminPage(e.target.q.value.trim()); };
    const cmd = async (name, command, extra = {}) => {
      try {
        const r = await api('POST', '/api/admin/users/' + encodeURIComponent(name) + '/command', { command, ...extra });
        toast(r.message || 'Done'); adminPage(q);
      } catch (e) { toast(e.message, true); }
    };
    app.querySelectorAll('.club-toggle').forEach(b => b.onclick = async () => {
      const on = b.dataset.on === '1';
      try {
        await api('POST', '/api/admin/club/' + encodeURIComponent(b.dataset.name), { on });
        toast(on ? `Gave FriendClub to ${b.dataset.name}` : `Removed FriendClub from ${b.dataset.name}`); adminPage(q);
      } catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('.tix-give').forEach(b => b.onclick = () => {
      const inp = app.querySelector(`.tix-amt[data-name="${CSS.escape(b.dataset.name)}"]`);
      const amount = Math.max(1, Math.min(10000, Math.floor(Number(inp?.value) || 100)));
      cmd(b.dataset.name, 'grant_tix', { amount });
    });
    app.querySelectorAll('.items-give').forEach(b => b.onclick = () => cmd(b.dataset.name, 'give_all_items'));
    app.querySelectorAll('.daily-reset').forEach(b => b.onclick = () => cmd(b.dataset.name, 'reset_daily'));
    app.querySelectorAll('.badge-grant').forEach(b => b.onclick = () => {
      const sel = app.querySelector(`.badge-sel[data-name="${CSS.escape(b.dataset.name)}"]`);
      cmd(b.dataset.name, 'grant_badge', { badge: sel?.value });
    });
    app.querySelectorAll('.badge-revoke').forEach(b => b.onclick = () => {
      const sel = app.querySelector(`.badge-sel[data-name="${CSS.escape(b.dataset.name)}"]`);
      cmd(b.dataset.name, 'revoke_badge', { badge: sel?.value });
    });
  });
}

function clubPage() {
  const bal = me.funtix ?? 0, active = me.club, short = ECON.CLUB_PRICE - bal;
  const days = Math.ceil(((me.clubUntil || 0) - Date.now()) / 86400000);
  mount('club', `
    <div class="club-hero">
      <div class="club-logo">${LOGO}${CLUB}</div>
      <div class="club-info"><h1>FriendClub</h1><p class="muted">The membership for true FriendFun fans.</p>
        <div class="club-status ${active ? 'on' : ''}">${me.clubForever ? `${CLUB} You have free FriendClub forever${me.admin ? ' (admin)' : ''}!` : active ? `${CLUB} You're a member! ${days} day${days === 1 ? '' : 's'} left` : 'You are not a member yet.'}</div>
        ${me.clubForever ? '' : `<button class="btn-primary club-join" ${short > 0 ? 'disabled' : ''}>${active ? 'Renew' : 'Join'} for ${tix} ${ECON.CLUB_PRICE} &middot; ${ECON.CLUB_DAYS} days</button>`}
        ${!me.clubForever && short > 0 ? `<div class="muted small">You need ${short} more FunTix. <a href="#/funtix">How to earn</a></div>` : ''}
      </div>
    </div>
    <h2>Member Benefits</h2>
    <div class="bux-ways">
      <div class="bux-way"><h3>${tix} +${ECON.CLUB_DAILY} Daily FunTix</h3><p>Get ${ECON.DAILY_TIX + ECON.CLUB_DAILY} FunTix every day instead of ${ECON.DAILY_TIX}.</p></div>
      <div class="bux-way"><h3>${tix} Double Playtime FunTix</h3><p>Earn ${ECON.PLAY_TIX * ECON.CLUB_PLAY_MULT} FunTix per minute of play instead of ${ECON.PLAY_TIX}.</p></div>
      <div class="bux-way"><h3>${CLUB} Member Badge</h3><p>A gold hard hat next to your name on your profile, the leaderboard, in chat and above your head in games.</p></div>
      <div class="bux-way"><h3>Exclusive Hard Hat</h3><p>The FriendClub Hard Hat goes straight into your inventory. Only members can get it.</p></div>
    </div>`, () => {
    const jb = app.querySelector('.club-join');
    if (jb) jb.onclick = () => confirmModal(active ? 'Renew FriendClub' : 'Join FriendClub',
      `Spend ${tix} ${ECON.CLUB_PRICE} FunTix for ${ECON.CLUB_DAYS} days of FriendClub?`, active ? 'Renew' : 'Join', async () => {
        try {
          const r = await api('POST', '/api/club/join');
          Object.assign(me, { club: true, clubUntil: r.clubUntil, inventory: r.inventory }); setMoney(r);
          toast(active ? 'FriendClub renewed!' : 'Welcome to FriendClub!'); clubPage();
        } catch (e) { toast(e.message, true); }
      });
  });
}
function funtixPage() {
  mount('funtix', `<h1>FunTix</h1>
    <div class="bux-hero">${tix}<div><div class="bux-big me-tix">${fmt(me.funtix ?? 0)}</div><div class="muted">Your balance</div></div></div>
    <h2>How to Earn FunTix</h2>
    <div class="bux-ways">
      <div class="bux-way"><h3>${tix} Daily Reward</h3><p>Log in every day to get ${ECON.DAILY_TIX} free FunTix.</p></div>
      <div class="bux-way"><h3>${tix} Play Games</h3><p>Earn ${ECON.PLAY_TIX} FunTix for every minute you spend playing.</p></div>
      <div class="bux-way"><h3>${tix} Collect Coins</h3><p>Every gold coin you pick up in a game gives you ${ECON.COIN_TIX} FunTix.</p></div>
      <div class="bux-way"><h3>${tix} Beat Obbies</h3><p>Touch a Win Pad at the end of an obby for ${ECON.WIN_TIX} FunTix (once per visit).</p></div>
      <div class="bux-way"><h3>${CLUB} FriendClub</h3><p>Members get ${ECON.CLUB_DAILY} extra FunTix every day and double playtime FunTix. <a href="#/club">Learn more</a></p></div>
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
    if (!me) { me = await api('GET', '/api/me'); dailyToast(me); }
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
      case 'groups': return await groupsPage();
      case 'users': return await profilePage(decodeURIComponent(seg[1]));
      case 'create': return await createPage();
      case 'studio': return await studioPage(seg[1], seg[2]);
      case 'leaderboard': return await leaderboardPage();
      case 'club': return clubPage();
      case 'admin': return await adminPage();
      case 'funtix': case 'funbux': return funtixPage();
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
  try { const r = await api('POST', '/api/ping'); setMoney(r); dailyToast(r); if (r.requests !== me.requests.length) { me = await api('GET', '/api/me'); } } catch {}
}, 20000);
route();
