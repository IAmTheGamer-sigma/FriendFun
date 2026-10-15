import { nameColor, tix, LOGO, CLUB, badgeIcon } from './ui.js?v=4afa3277';

// Badge definitions
let BADGE_DEFS = {};
async function loadBadgeDefs() {
  try {
    BADGE_DEFS = await api('GET', '/api/badges') || {};
  } catch (e) { BADGE_DEFS = {}; }
}
const badgeDef = id => BADGE_DEFS[id] || (BADGES[id] ? { id, ...BADGES[id], custom: false } : null);
const badgeIcon2 = (id, size = 18) => {
  const b = badgeDef(id);
  if (!b) return '';
  if (b.image) return `<img src="${b.image}" width="${size}" height="${size}" style="border-radius:6px;vertical-align:-4px" title="${esc(b.name)}" alt="${esc(b.name)}">`;
  if (b.custom || b.icon) return `<span style="font-size:${size}px" title="${esc(b.name)}">${b.icon || '🏅'}</span>`;
  return badgeIcon(id, size);
};
import { worldThumbnail } from './three-util.js?v=ac3e6f2b';
import * as THREE from 'three';
// avatar3d loads lazily after login
let _avatar3d = null;
let _avatar3dLoading = null;
async function ensureAvatar3d() {
  if (_avatar3d) return _avatar3d;
  if (!_avatar3dLoading) {
    _avatar3dLoading = import('./avatar3d.js?v=4b390e65').then(m => {
      _avatar3d = m;
      refreshAvatars(); // swap placeholders for real avatars
      return m;
    });
  }
  return _avatar3dLoading;
}
function refreshAvatars() {
  if (!_avatar3d) return;
  document.querySelectorAll('img[data-av]').forEach(img => {
    try {
      const av = JSON.parse(img.dataset.av);
      img.src = _avatar3d.avatarImage(av, img.dataset.mode || 'headshot');
      img.removeAttribute('data-av');
    } catch {}
  });
}
function avatarImage(avatar, mode = 'headshot') {
  if (_avatar3d) return _avatar3d.avatarImage(avatar, mode);
  // Placeholder; real avatar swaps in after load
  ensureAvatar3d().catch(() => {});
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="35" r="20" fill="#888"/><rect x="25" y="60" width="50" height="35" rx="10" fill="#888"/></svg>');
  // Placeholder; refreshAvatars swaps when 3D loads
  // Embed avatar data for refreshAvatars queue
  _pendingAvatars.push({ avatar, mode });
  return placeholder;
}
const _pendingAvatars = [];
// Patch: intercept img creation
function avatarImgTag(avatar, mode = 'headshot', cls = '', style = '') {
  if (_avatar3d) return `<img class="${cls}"${style ? ` style="${style}"` : ''} src="${_avatar3d.avatarImage(avatar, mode)}">`;
  ensureAvatar3d().catch(() => {});
  const avJson = JSON.stringify(avatar || {}).replace(/"/g, '&quot;');
  const placeholder = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="35" r="20" fill="#888"/><rect x="25" y="60" width="50" height="35" rx="10" fill="#888"/></svg>');
  return `<img class="${cls}"${style ? ` style="${style}"` : ''} src="${placeholder}" data-av="${avJson}" data-mode="${mode}">`;
}
function buildCharacter(avatar) {
  if (!_avatar3d) throw new Error('avatar3d not loaded yet');
  return _avatar3d.buildCharacter(avatar);
}
import { CATALOG, ITEM, ECON, BADGES, PET_MODELS, GEAR_MODELS, UGC_TEMPLATES, UGC_CREATOR_CUT } from './catalog.js?v=94017c68';
import { templates } from './worlds.js?v=a0431b48';
import { startSpooky, stopSpooky, sfx } from './sound.js?v=89850e26';
try { sfx.enabled = localStorage.getItem('ff_sfx') !== '0'; } catch {}

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
  puzzle: '<svg viewBox="0 0 24 24"><path d="M10 2h4v3a2 2 0 1 0 3 0h3v4h-3a2 2 0 1 0 0 3v3h-4v-3a2 2 0 1 0-3 0H7v-4h3a2 2 0 1 0 0-3z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  chat: '<svg viewBox="0 0 24 24"><path d="M4 3h16a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H8l-4 4V4a1 1 0 0 1 1-1z"/></svg>',
  news: '<svg viewBox="0 0 24 24"><path d="M4 4h13v12H6l-2 2zm15 1h3v13l-3-2M7 8h8M7 11h8M7 14h5" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.2"/><path d="M19.4 13a7.6 7.6 0 0 0 0-2l2-1.5-2-3.4-2.3 1a7.6 7.6 0 0 0-1.7-1L15 3h-6l-.4 2.6a7.6 7.6 0 0 0-1.7 1l-2.3-1-2 3.4L4.6 11a7.6 7.6 0 0 0 0 2l-2 1.5 2 3.4 2.3-1a7.6 7.6 0 0 0 1.7 1L9 21h6l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.3 1 2-3.4z"/></svg>',
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
    <div class="gc-name">${esc(g.name || "Untitled Game")}</div>
    <div class="gc-stats"><span>${icons.thumb} ${rating(g)}</span><span>${icons.people} ${fmt(g.playing)}</span></div>
  </a>`;
}
function userTile(u) {
  const st = u.gameId ? 'ingame' : u.online ? 'online' : '';
  return `<a class="user-tile" href="#/users/${encodeURIComponent(u.name)}" title="${u.gameName ? 'Playing ' + esc(u.gameName) : ''}">
    <div class="ut-img ${st}">${avatarImgTag(u.avatar)}</div><div class="ut-name">${esc(u.name)}${u.moderator ? ' 🛡️' : ''}</div>
    ${u.gameName ? `<div class="ut-game">${esc(u.gameName)}</div>` : ''}</a>`;
}

// ---------- layout ----------
const UPDATES = [
  { id: 'u8', date: 'Oct 7, 2026', title: 'Owner tier + FunPanel', items: [
    'Owners get 20 extra controls: take FunTix, make mods, grant items, reset passwords, system DMs, broadcasts, maintenance mode, FunTix rain, more',
    'Admins keep the classic panel; moderators keep the Moderation page',
    'In-game FunPanel (🛡️ button or F4) for staff: teleport to players, mute, kick, bans, fly mode, server announcements',
  ]},
  { id: 'u7', date: 'Oct 7, 2026', title: 'Admin levels', items: [
    'Staff now has three levels: Owner, Admin, and Moderator',
    'Owners can grant and remove admins; admins keep full panel powers otherwise',
    'Everyone\'s level shows as a tag in the Admin panel',
  ]},
  { id: 'u6', date: 'Oct 7, 2026', title: 'Moderator team is live', items: [
    'Funtopia has its first moderators: @bro, @fun, @nsc9510alt and @nsc9510ft',
    'New Moderation page: report players from their profile, moderators get a review queue',
    'Every report gets an automated first-pass label (clear / needs review / urgent) — humans make all decisions',
    'Bans now need two separate confirmations from two different moderators or admins',
  ]},
  { id: 'u5', date: 'Oct 6, 2026', title: 'Shooter games & gear hotbar', items: [
    'Three new PvP shooter arenas: Block Arena, Fort Battle, Rooftop Rumble — shoot other players!',
    'Roblox-style gear hotbar in every game (click or press 1-9)',
    'Free Arena Blaster for everyone in shooter games — no gear needed',
    'Your equipped gear now stays on after you respawn',
    'New Shooter Arena template in Create — build your own battleground',
  ]},
  { id: 'u4', date: 'Oct 6, 2026', title: 'Marketplace mega-drop', items: [
    '200+ new items: hats, faces, shirts and heads — all render in 3D',
    '15 pets including the three-headed Hydra, now with full 3D models',
    '12 new gears: blasters, swords, hammers, cannons and more',
  ]},
  { id: 'u3', date: 'Oct 6, 2026', title: 'Gears are here', items: [
    'Classic gears (sword, slingshot, grapple, rocket) in the Marketplace',
    'Equip a gear on your avatar and use it in any game with left-click',
  ]},
  { id: 'u2', date: 'Oct 6, 2026', title: 'Halloween in Funtopia', items: [
    'Halloween event runs Oct 6 - Nov 2: spooky site theme + double daily FunTix',
    'Five original spooky games: haunted mansion escape, pumpkin patch hunt, witch tower climb, ghost town, spooky baseplate',
    'Halloween costumes, pets and creepy menu music',
  ]},
  { id: 'u1', date: 'Oct 5, 2026', title: 'Pets arrive', items: [
    'Pets follow you in games and appear on your avatar',
    'Pet tab in the Avatar Editor and Marketplace',
  ]},
];
function hasNewUpdates() { try { return localStorage.getItem('updatesSeen') !== UPDATES[0].id; } catch { return true; } }
function markUpdatesSeen() { try { localStorage.setItem('updatesSeen', UPDATES[0].id); } catch {} }
function settingsPage() {
  const sfxOn = localStorage.getItem('ff_sfx') !== '0';
  const musicOn = localStorage.getItem('ff_music') !== '0';
  mount('settings', `<h1>⚙️ Settings</h1>
    <p class="muted">Make Funtopia yours.</p>
    <section class="admin-section"><h3>🔊 Sound</h3>
      <label class="set-row"><span>Sound effects</span><input type="checkbox" class="set-sfx" ${sfxOn ? 'checked' : ''}></label>
      <label class="set-row"><span>Music</span><input type="checkbox" class="set-music" ${musicOn ? 'checked' : ''}></label>
    </section>
    <section class="admin-section"><h3>🔒 Account</h3>
      <div class="set-row"><span>Change password</span></div>
      <input type="password" class="set-curpw" placeholder="Current password" maxlength="64" autocomplete="current-password">
      <input type="password" class="set-newpw" placeholder="New password (4+ characters)" maxlength="64" autocomplete="new-password">
      <button class="btn-primary set-pw-btn">Update password</button>
    </section>
    <section class="admin-section"><h3>More</h3>
      <a class="set-row set-link" href="#/addons"><span>🧩 Add-ons</span><span class="muted">›</span></a>
      <a class="set-row set-link" href="#/updates"><span>📰 Updates</span>${hasNewUpdates() ? '<span class="badge">NEW</span>' : '<span class="muted">›</span>'}</a>
    </section>`, () => {
    app.querySelector('.set-sfx').onchange = e => {
      const on = e.target.checked;
      try { localStorage.setItem('ff_sfx', on ? '1' : '0'); } catch {}
      sfx.enabled = on;
      toast(on ? 'Sound effects on' : 'Sound effects off');
    };
    app.querySelector('.set-music').onchange = e => {
      const on = e.target.checked;
      try { localStorage.setItem('ff_music', on ? '1' : '0'); } catch {}
      if (!on) { try { stopSpooky(); } catch {} }
      toast(on ? 'Music on' : 'Music off');
    };
    app.querySelector('.set-pw-btn').onclick = async () => {
      const cur = app.querySelector('.set-curpw').value, nw = app.querySelector('.set-newpw').value;
      if (!cur || !nw) { toast('Fill in both password fields', true); return; }
      try {
        await api('POST', '/api/me/password', { current: cur, password: nw });
        toast('Password updated'); settingsPage();
      } catch (e) { toast(e.message, true); }
    };
  });
}

function updatesPage() {
  markUpdatesSeen();
  mount('updates', `<h1>Updates</h1><p class="muted">What's new in Funtopia.</p>
    <div class="update-log">${UPDATES.map(u => `
      <section class="update"><div class="update-date">${esc(u.date)}</div>
        <h2>${esc(u.title)}</h2>
        <ul>${u.items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>
      </section>`).join('')}</div>`);
}
function shell(active, content) {
  return `
  <header class="topbar">
    <button class="tb-burger" onclick="document.body.classList.toggle('nav-open')">&#9776;</button>
    <a class="logo" href="#/home"><span class="logo-icon">${LOGO}</span><span class="logo-text">Funtopia</span></a>
    <nav class="tb-nav"><a href="#/discover">Discover</a><a href="#/catalog">Marketplace</a><a href="#/create">Create</a><a href="#/funtix">FunTix</a><a href="#/club">FriendClub</a><a href="https://muse.ai/s/puzzlevision-dxl6dxbqxe67xoj" target="_blank" rel="noopener">📺 Puzzlevision</a></nav>
    <form class="tb-search" onsubmit="event.preventDefault(); location.hash='#/discover?q='+encodeURIComponent(this.q.value)"><input name="q" placeholder="Search"></form>
    <div class="tb-right">
      <div class="tb-user-wrap">
        <button class="tb-user" title="Account menu">${avatarImgTag(me.avatar)}<span>${esc(me.name)}</span><span class="tb-caret">&#9662;</span></button>
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
      <span class="tb-online" title="Total players">👥<b class="player-count">–</b></span>
      <a class="tb-bux" href="#/funtix" title="FunTix">${tix}<span class="me-tix">${fmt(me.funtix ?? 0)}</span></a>
    </div>
  </header>
  <aside class="sidebar">
    ${[['home', 'Home', icons.home], ['discover', 'Discover', icons.discover], ['avatar', 'Avatar', icons.avatar], ['catalog', 'Marketplace', icons.shop], ['create', 'Create', icons.create], ['friends', 'Friends', icons.friends, me.requests?.length], ['groups', 'Groups', icons.groups], ['users/' + encodeURIComponent(me.name), 'Profile', icons.profile], ['club', 'FriendClub', icons.club], ['moderation', 'Moderation', icons.shield], ['settings', 'Settings', icons.gear], ...(me.admin && !me.owner ? [['admin', 'Admin', icons.shield]] : []), ...(me.owner ? [['owner', '👑 Owner', icons.shield]] : [])]
      .map(([h, l, i, badge]) => h.startsWith('http') ? `<a href="${h}" target="_blank" rel="noopener"><span class="sb-ico">${i}</span>${l}<span class="badge">↗</span></a>` : `<a href="#/${h}" class="${active === h.split('/')[0] ? 'active' : ''}"><span class="sb-ico">${i}</span>${l}${badge ? `<span class="badge">${badge}</span>` : ''}</a>`).join('')}
    <button class="sidebar-logout"><span class="sb-ico">&#9094;</span>Log Out</button>
  </aside>
  <main class="content">${content}</main>`;
}
async function refreshPartyBar() {
  document.querySelector('.party-bar')?.remove();
  if (app.className === 'fullscreen') return;
  try {
    const p = await api('GET', '/api/party');
    if (!p || !p.members.length) return;
    const bar = document.createElement('div');
    bar.className = 'party-bar';
    bar.innerHTML = `<b>🎉 Party (${p.members.length})</b><span class="party-members">${p.members.map(m => `${esc(m)}${m === p.leader ? ' 👑' : ''}`).join(', ')}</span><button class="link party-leave">Leave</button>`;
    bar.querySelector('.party-leave').onclick = async () => { try { await api('POST', '/api/party/leave'); } catch {} refreshPartyBar(); toast('Left the party'); };
    app.querySelector('.topbar')?.after(bar);
  } catch {}
}
let onlineTimer = null;
async function refreshPlayerCount() {
  try {
    const r = await api('GET', '/api/player-count');
    document.querySelectorAll('.player-count').forEach(el => el.textContent = fmt(r.count));
  } catch {}
}
let siteStateCache = null, siteStateAt = 0;
async function refreshSiteBanner() {
  try {
    if (!siteStateCache || Date.now() - siteStateAt > 60000) {
      siteStateCache = await api('GET', '/api/site');
      siteStateAt = Date.now();
    }
    document.querySelector('.site-banner')?.remove();
    if (siteStateCache?.announce) {
      const bar = document.createElement('div');
      bar.className = 'site-banner';
      bar.innerHTML = `📢 <b>Funtopia:</b> ${esc(siteStateCache.announce.text)}`;
      app.querySelector('.topbar')?.after(bar);
    }
  } catch {}
}
// ============ EASTER EGGS ============
function eggConfetti(n = 120) {
  for (let i = 0; i < n; i++) {
    const d = document.createElement('div');
    d.className = 'egg-confetti';
    d.textContent = ['🎉', '🥚', '🎃', '⭐', '🍬'][Math.floor(Math.random() * 5)];
    d.style.left = Math.random() * 100 + 'vw';
    d.style.animationDelay = (Math.random() * 0.8) + 's';
    d.style.fontSize = (16 + Math.random() * 24) + 'px';
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 3200);
  }
}
// ============ NEWS BROADCAST ============
async function showNewsBroadcast(b) {
  const m = await import('./news-player.js?v=00b6573e');
  return m.showNewsBroadcast({ esc, me, ensureAvatar3d }, b);
}
async function checkNews() {
  if (!token || !me || document.querySelector('.news-overlay')) return;
  try {
    const r = await api('GET', '/api/news');
    const b = r.broadcast;
    if (!b) return;
    const seen = +(localStorage.newsSeenAt || 0);
    if (b.at > seen) { localStorage.newsSeenAt = b.at; showNewsBroadcast(b); }
  } catch {}
}
setInterval(checkNews, 5000);
// hacker panel events
let hackMod = null;
async function checkHack() {
  if (!token || !me || document.querySelector('.news-overlay')) return;
  try {
    if (!hackMod) hackMod = await import('./hacker.js?v=bbfe7e93');
    await hackMod.pollHackEvent(api);
  } catch {}
}
setInterval(checkHack, 5000);
// type "hack" outside a text field to summon (owners only)
let hkSeq = '';
addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) { hkSeq = ''; return; }
  hkSeq = (hkSeq + (e.key.length === 1 ? e.key.toLowerCase() : '')).slice(-4);
  if (hkSeq === 'hack' && me && (me.owner || String(me.name || '').toLowerCase() === 'bro')) {
    hkSeq = '';
    (async () => { try { if (!hackMod) hackMod = await import('./hacker.js?v=bbfe7e93'); hackMod.openHackerPanel({ api, toast, me }); } catch {} })();
  }
});


function initEasterEggs() {
  // 1. Konami code
  const seq = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  let ki = 0;
  addEventListener('keydown', e => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    ki = (k === seq[ki]) ? ki + 1 : (k === seq[0] ? 1 : 0);
    if (ki === seq.length) { ki = 0; eggConfetti(); toast('🥚 KONAMI! You found an Easter egg!'); }
  });
  // 2. Logo 5 clicks
  let clicks = 0, ct = null;
  document.addEventListener('click', e => {
    if (!e.target.closest('.logo')) return;
    clicks++; clearTimeout(ct); ct = setTimeout(() => clicks = 0, 1500);
    if (clicks === 5) { clicks = 0; document.querySelector('.logo')?.classList.add('egg-spin'); eggConfetti(60); toast('👀 The logo approves.'); setTimeout(() => document.querySelector('.logo')?.classList.remove('egg-spin'), 1200); }
  });
  // 3. Secret chat word
  const origSend = null; // hooked via chat observer below
  new MutationObserver(muts => {
    for (const m of muts) for (const n of m.addedNodes) {
      if (n.nodeType === 1 && n.textContent && /\bxyzzy\b/i.test(n.textContent) && n.classList?.contains('chat-msg')) {
        eggConfetti(40); toast('✨ XYZZY! A hollow voice says "plugh".');
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}
setTimeout(initEasterEggs, 1000);

function mount(active, html, after) {
  document.body.classList.toggle('halloween', halloweenActive());
  app.className = ''; app.innerHTML = shell(active, html);
  refreshPartyBar();
  refreshSiteBanner();
  refreshPlayerCount();
  clearInterval(onlineTimer);
  onlineTimer = setInterval(refreshPlayerCount, 60000);
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
      ? accs.map(a => `<button class="tb-menu-item tb-switch" data-name="${esc(a.name)}">${avatarImgTag(me.avatar, "headshot", "", "width:24px;height:24px;border-radius:50%")}${esc(a.name)}</button>`).join('')
      : '<div class="tb-menu-empty">No other accounts</div>';
    listEl.querySelectorAll('.tb-switch').forEach(b => b.onclick = () => switchAccount(b.dataset.name));
  };
  renderAccountList();
  app.querySelector('.tb-add-account').onclick = () => showAddAccountModal();
  app.querySelector('.tb-logout').onclick = () => logout();
  app.querySelector('.tb-logout-all').onclick = () => { if (confirm('Log out of all accounts?')) logoutAll(); };
  const sbLogout = app.querySelector('.sidebar-logout');
  if (sbLogout) sbLogout.onclick = () => logout();
  const bell = app.querySelector('.tb-bell'), panel = app.querySelector('.tb-notif');
  if (bell && panel) {
    bell.onclick = async e => {
      e.stopPropagation();
      if (panel.classList.contains('hidden')) {
        try {
          const n = await api('GET', '/api/notifications');
          panel.innerHTML = `<div class="tb-notif-head"><b>Notifications</b><button class="link notif-clear">Mark all read</button></div>` +
            (n.list.length ? n.list.map(x => `<a class="tb-notif-item ${x.read ? '' : 'unread'}" data-id="${x.id}" href="${esc(x.link || '#/home')}"><span>${esc(x.text)}</span><i>${timeAgo(x.created)}</i></a>`).join('') : '<p class="muted small" style="padding:10px">Nothing yet.</p>');
          panel.querySelector('.notif-clear').onclick = async ev => { ev.stopPropagation(); await api('POST', '/api/notifications/read'); refreshNotif(); bell.onclick(e); };
          panel.querySelectorAll('.tb-notif-item').forEach(a => a.onclick = () => { api('POST', '/api/notifications/read', { ids: [+a.dataset.id] }).catch(() => {}); });
        } catch { panel.innerHTML = '<p class="muted small" style="padding:10px">Could not load.</p>'; }
      }
      panel.classList.toggle('hidden');
    };
    panel.onclick = e => e.stopPropagation();
    document.addEventListener('click', () => panel.classList.add('hidden'), { once: true });
  }
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
  document.body.classList.toggle('halloween', halloweenActive());
  app.className = 'landing';
  app.innerHTML = `
  <div class="landing-bg"></div>
  <div class="landing-inner">
    <div class="landing-hero"><div class="logo big"><span class="logo-icon">${LOGO}</span><span class="logo-text">Funtopia</span></div>
      <h1>Play, build and hang out with friends.</h1><p>Join millions of blocky adventurers. Jump into games, customize your avatar, and build your own worlds in Funtopia Studio.</p></div>
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
      ensureAvatar3d().catch(() => {}); // preload 3D avatars in background
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
  mount('home', `    ${halloweenActive() ? `<a class="halloween-banner" href="#/halloween">🎃 <b>Halloween is here!</b> Spooky games, costumes & double daily FunTix &rsaquo;</a>` : ''}
    <div class="home-head">${avatarImgTag(me.avatar, "headshot", "home-avatar")}<h1>Hello, ${esc(me.name)}!</h1></div>
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

async function tourneyPage() {
  let t = null;
  try { t = await api('GET', '/api/tourney'); } catch (e) { t = { error: e.message }; }
  const ends = t && t.endsAt ? t.endsAt : 0;
  const board = (t && t.board) || [];
  mount('tourney', `
    <h1>🎃 Spooky Rivals Tournament</h1>
    <p class="muted">1v1 shooter in the haunted arena. Most match wins by <b>Wednesday night</b> takes the exclusive <b>Champion Pumpkin Head</b> 👑</p>
    ${t && t.error ? `<p class="err">${esc(t.error)}</p>` : `
    <div class="tourney-hero">
      <div class="tourney-prize"><span class="tp-emoji">🎃</span><b>Champion Pumpkin Head</b><em>Exclusive prize — only the tournament winner gets it</em></div>
      <div class="tourney-countdown"><span>${t.finalized ? 'Tournament over' : 'Ends in'}</span><b class="tourney-timer">–</b>${t.finalized && t.winner ? `<div>👑 Winner: <b>${esc(t.winner)}</b></div>` : ''}</div>
    </div>
    ${t.finalized ? '' : `<div class="tourney-loadout"><span class="muted">Loadout:</span><div class="loadout-picks">
      ${[['rifle', '🔫 Rifle'], ['smg', '🔫 SMG'], ['shotgun', '🔫 Shotgun'], ['sniper', '🔫 Sniper']].map(([id, label]) => `<button class="loadout-pick" data-w="${id}">${label}</button>`).join('')}
      </div><span class="muted small">+ 🔫 Pistol secondary</span></div>`}
    <div class="tourney-actions">${t.finalized ? '<span class="muted">The tournament has ended.</span>' : '<button class="btn-primary tourney-join">Join the Tournament</button><button class="btn-secondary tourney-leave" hidden>Leave Queue</button><span class="muted tourney-status"></span>'}</div>
    <section><div class="sec-h"><h2>🏆 Leaderboard <span class="muted small">most match wins</span></h2></div>
      <div class="tourney-board">${board.map((r, i) => `<div class="tourney-row${r.name === me.name ? ' me' : ''}"><span class="tourney-rank">${i + 1}</span><span class="tourney-name">${i === 0 ? '👑 ' : ''}${esc(r.name)}</span><span class="tourney-wins">${r.wins} win${r.wins === 1 ? '' : 's'}</span></div>`).join('') || '<p class="muted">No wins yet — be the first!</p>'}</div></section>`}`,
  async () => {
    if (!t || t.error || t.finalized) return;
    let alive = true;
    const timer = setInterval(() => {
      if (!alive) return;
      const ms = ends - Date.now();
      const el = app.querySelector('.tourney-timer');
      if (!el) return;
      if (ms <= 0) { el.textContent = 'Over!'; return; }
      const d = Math.floor(ms / 86400000), h = Math.floor(ms % 86400000 / 3600000), m = Math.floor(ms % 3600000 / 60000), s = Math.floor(ms % 60000 / 1000);
      el.textContent = (d ? d + 'd ' : '') + h + 'h ' + m + 'm ' + s + 's';
    }, 1000);
    const joinBtn = app.querySelector('.tourney-join'), leaveBtn = app.querySelector('.tourney-leave'), status = app.querySelector('.tourney-status');
    const sync = async () => {
      if (!alive) return;
      try {
        const s = await api('GET', '/api/tourney');
        if (s.myMatch) { alive = false; location.hash = '#/play/g_spookyrivals?server=' + s.myMatch.code; return; }
        const inQ = !!s.inQueue;
        joinBtn.hidden = inQ; leaveBtn.hidden = !inQ;
        status.textContent = inQ ? 'In queue — waiting for an opponent…' : '';
        if (s.finalized) { alive = false; tourneyPage(); }
      } catch {}
    };
    const picks = app.querySelectorAll('.loadout-pick');
    const markPick = id => picks.forEach(b => b.classList.toggle('active', b.dataset.w === id));
    try { const lo = await api('GET', '/api/tourney/loadout'); markPick(lo.primary); } catch {}
    picks.forEach(b => b.onclick = async () => { try { const r = await api('POST', '/api/tourney/loadout', { primary: b.dataset.w }); markPick(r.primary); toast('Loadout: ' + r.primary); } catch (e) { toast(e.message, true); } });
    joinBtn.onclick = async () => { try { const r = await api('POST', '/api/tourney/join'); if (r.matched) { alive = false; location.hash = '#/play/g_spookyrivals?server=' + r.code; } else sync(); } catch (e) { toast(e.message, true); } };
    leaveBtn.onclick = async () => { try { await api('POST', '/api/tourney/leave'); sync(); } catch (e) { toast(e.message, true); } };
    const poll = setInterval(sync, 5000);
    sync();
    cleanup = () => { alive = false; clearInterval(timer); clearInterval(poll); };
  });
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
      <div class="gp-private"><h3>Private Servers</h3><p class="muted small">Create your own server — only people with the link can join.</p>
        <button class="btn-secondary ps-create">Create Private Server</button><div class="ps-result"></div></div>
      <div class="gp-tabs"><b>About</b></div>
      <h3>Description</h3><p class="gp-desc">${esc(g.description || 'No description.').replace(/\n/g, '<br>')}</p>
      <div class="gp-stats">
        <div><span>Active</span><b>${fmt(g.playing)}</b></div><div><span>Favorites</span><b>${fmt(g.favorites)}</b></div><div><span>Visits</span><b>${fmt(g.visits)}</b></div>
        <div><span>Created</span><b>${new Date(g.created).toLocaleDateString()}</b></div><div><span>Updated</span><b>${new Date(g.updated).toLocaleDateString()}</b></div><div><span>Server Size</span><b>${g.maxPlayers}</b></div>
      </div>
    </div>`, () => {
    app.querySelector('.play-btn').onclick = () => (location.hash = '#/play/' + g.id);
    api('GET', '/api/party').then(p => {
      if (p && p.leader === me.name) {
        const b = document.createElement('button');
        b.className = 'btn-primary'; b.innerHTML = '🎉 Start Party Game';
        b.onclick = async () => {
          b.disabled = true;
          try { const r = await api('POST', '/api/party/play', { gameId: g.id }); location.hash = '#/play/' + g.id + '?server=' + r.code; }
          catch (err) { toast(err.message, true); b.disabled = false; }
        };
        app.querySelector('.gp-actions')?.append(b);
      }
    }).catch(() => {});
    const vote = async v => { const r = await api('POST', `/api/games/${g.id}/vote`, { vote: v }); g.vote = r.vote; route(); };
    app.querySelector('.vote-up').onclick = () => vote(1); app.querySelector('.vote-down').onclick = () => vote(-1);
    app.querySelector('.gp-fav').onclick = async () => { const r = await api('POST', `/api/games/${g.id}/favorite`); me.favorites = r.favorited ? [...me.favorites, g.id] : me.favorites.filter(x => x !== g.id); route(); };
    app.querySelector('.ps-create').onclick = async e => {
      e.target.disabled = true;
      try {
        const r = await api('POST', `/api/games/${g.id}/private`);
        const link = location.origin + '/#/play/' + g.id + '?server=' + r.code;
        app.querySelector('.ps-result').innerHTML = `<div class="ps-code">Code: <b>${r.code}</b></div>
          <div class="ps-link"><input readonly value="${esc(link)}"><button class="btn-secondary ps-copy">Copy</button>
          <a class="btn-primary" href="#/play/${g.id}?server=${r.code}">Join</a></div>`;
        const inp = app.querySelector('.ps-link input');
        app.querySelector('.ps-copy').onclick = () => { inp.select(); document.execCommand('copy'); navigator.clipboard?.writeText(link); toast('Link copied!'); };
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    };
  });
}

async function playPage(id, server) {
  const g = await api('GET', '/api/games/' + id);
  me = await api('GET', '/api/me');
  app.className = 'fullscreen'; app.innerHTML = '<div class="play-container"></div>';
  const { Game } = await import('./game.js?v=92b178c6');
  const game = new Game(app.querySelector('.play-container'), {
    world: g.world, gameId: g.id, gameName: g.name, server, shooter: g.event === 'shooter' || g.world?.shooter === true, gameGears: g.world?.gears || [], me, token, funtix: me.funtix,
    onMoney: r => setMoney(r), onExit: () => { cleanup = null; history.length > 1 ? history.back() : (location.hash = '#/games/' + g.id); },
  });
  cleanup = () => game.destroy();
}

// ---------- avatar editor ----------
const SKIN = ['#f5cd30', '#ffcc99', '#e8b98a', '#c68e5b', '#8d5524', '#5c3a1e', '#ffffff', '#a3a2a5', '#1b2a35', '#0d69ac', '#6e99ca', '#2f8cff', '#a4bd47', '#4b974b', '#287f47', '#c4281c', '#ff66cc', '#8a4bd8', '#da8541', '#ffd400', '#000000', '#7c5c46'];
async function avatarPage(tab = 'body') {
  try { await ensureAvatar3d(); } catch {}
  const av = structuredClone(me.avatar); av.head ??= 'head_classic';
  let part = 'all';
  mount('avatar', `
    <h1>Avatar Editor</h1>
    <div class="av-wrap">
      <div class="av-preview"><canvas class="av-canvas"></canvas><div class="muted small">Drag to rotate</div></div>
      <div class="av-panel">
        <div class="av-tabs">${['body', 'head', 'hat', 'face', 'shirt', 'pet', 'gear', 'vehicle'].map(t => `<button data-tab="${t}" class="${t === tab ? 'active' : ''}">${{ body: 'Body Colors', head: 'Heads', hat: 'Hats', face: 'Faces', shirt: 'Shirts', pet: 'Pets', gear: 'Gears', vehicle: 'Vehicles' }[t]}</button>`).join('')}</div>
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
        const owned = CATALOG.filter(i => i.type === tab && (me.inventory.includes(i.id) || i.id === tab + '_none'))
          .concat(UGC_LIST.filter(u => u.type === tab && me.inventory.includes(u.id)));
        body.innerHTML = `<div class="item-grid">${owned.map(i => `<button class="item ${av[tab] === i.id ? 'worn' : ''}" data-id="${i.id}">${i.type === 'pet' ? (PET_MODELS[i.id] ? `<canvas class="pet-voxel" width="120" height="120" data-pet="${i.id}"></canvas>` : `<span class="pet-emoji">${i.emoji}</span>`) : i.type === 'gear' ? (GEAR_MODELS[i.id] ? `<canvas class="gear-voxel" width="120" height="120" data-gear="${i.id}"></canvas>` : `<span class="pet-emoji">${i.emoji}</span>`) : `<img src="${itemImage(i)}">`}<span>${esc(i.name)}</span></button>`).join('')}
          <a class="item more" href="#/catalog/${tab}"><span class="plus">+</span><span>Get More</span></a></div>`;
        body.querySelectorAll('[data-id]').forEach(b => b.onclick = () => { av[tab] = b.dataset.id; rebuild(); render(); save(); });
        paintPetVoxels(body);
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

// ---------- UGC (player-created avatar items) ----------
let UGC_LIST = [];
async function loadUgc() {
  try {
    const items = await api('GET', '/api/ugc');
    UGC_LIST = Array.isArray(items) ? items : [];
    for (const u of UGC_LIST) ITEM[u.id] = { id: u.id, type: u.type, name: u.name, price: u.price, color: u.color, template: u.template, model_url: u.model_url || null, model_transform: u.model_transform || null, creator: u.creator, ugc: true };
  } catch { UGC_LIST = []; }
}

async function catalogPage(filter = 'all') {
  const filters = ['all', 'head', 'hat', 'face', 'shirt', 'pet', 'gear', 'vehicle', 'ugc'];
  const labels = { all: 'All', head: 'Heads', hat: 'Hats', face: 'Faces', shirt: 'Shirts', pet: 'Pets', gear: 'Gears', vehicle: 'Vehicles', ugc: 'UGC 🎨' };
  const list = filter === 'ugc' ? UGC_LIST : CATALOG.filter(i => !i.limited && (filter === 'all' || i.type === filter));
  mount('catalog', `
    <h1>Marketplace</h1>
    <div class="cat-filters">${filters.map(f => `<a href="#/catalog/${f}" class="${f === filter ? 'active' : ''}">${labels[f]}</a>`).join('')}</div>
    ${filter === 'ugc' ? '<p class="muted small">Player-created items. Creators earn 70% of every sale. <a href="#/ugc">Make your own →</a></p>' : ''}
    <div class="cat-grid">${list.map(i => `
      <div class="cat-item">${i.type === 'pet' ? (PET_MODELS[i.id] ? `<div class="cat-img pet-img"><canvas class="pet-voxel" width="120" height="120" data-pet="${i.id}"></canvas></div>` : `<div class="cat-img pet-img">${i.emoji}</div>`) : i.type === 'gear' ? (GEAR_MODELS[i.id] ? `<div class="cat-img pet-img"><canvas class="gear-voxel" width="120" height="120" data-gear="${i.id}"></canvas></div>` : `<div class="cat-img pet-img">${i.emoji}</div>`) : (i.ugc && i.model_url ? `<div class="cat-img">${glbCardImg()}</div>` : `<div class="cat-img"><img src="${itemImage(i)}"></div>`)}</div><div class="cat-name">${esc(i.name)}</div>
        ${i.ugc ? `<div class="muted small">by ${esc(i.creator)} · ${i.sales} sold</div>` : ''}
        <div class="cat-price">${priceHtml(i)}</div>
        ${me.inventory.includes(i.id) ? '<button class="btn-owned" disabled>Owned</button>' : i.club && !me.club ? '<a class="btn-club" href="#/club">Members Only</a>' : `<button class="btn-buy" data-id="${i.id}"${i.ugc ? ' data-ugc="1"' : ''}>Buy</button>`}</div>`).join('') || '<p class="muted">Nothing here yet.</p>'}</div>`, () => {
    paintPetVoxels(app);
    app.querySelectorAll('.btn-buy').forEach(b => b.onclick = () => {
      const it = ITEM[b.dataset.id];
      if (b.dataset.ugc) ugcBuyModal(it, () => catalogPage(filter));
      else buyModal(it, () => catalogPage(filter));
    });
  });
}
function ugcBuyModal(it, onDone) {
  const cut = Math.floor(it.price * UGC_CREATOR_CUT);
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<div class="modal"><h2>Buy UGC Item</h2>
    <div class="buy-row">${it.model_url ? glbCardImg() : `<img src="${itemImage(it)}">`}<div><p>Buy <b>${esc(it.name)}</b> by <b>${esc(it.creator)}</b>?</p>
    <p class="muted small">${tix} ${fmt(cut)} goes to the creator</p>
    <p class="muted small">You have ${tix} ${fmt(me.funtix ?? 0)}</p></div></div>
    <div class="modal-actions"><button class="btn-secondary">Cancel</button><button class="btn-primary" ${(me.funtix ?? 0) < it.price ? 'disabled title="Not enough"' : ''}>Buy for ${tix} ${it.price}</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector('.btn-secondary').onclick = () => d.remove();
  d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('.btn-primary').onclick = async () => {
    d.remove();
    try { const r = await api('POST', '/api/ugc/' + it.id + '/buy'); me.inventory = r.inventory; setMoney(r); toast(`You bought ${it.name}!`); onDone(); }
    catch (e) { toast(e.message, true); }
  };
}

// ---------- UGC Studio (player item creator) ----------
// GLB card placeholder (3D loads async)
const glbCardImg = () => '<div class="glb-ph">📦<span>3D</span></div>';
const ugcCardImg = u => u.model_url ? glbCardImg() : `<img src="${itemImage(u)}">`;
function priceHtml(i) {
  if (i.club) return `<span class="club-price">${CLUB} FriendClub</span>`;
  return i.free ? '<span class="free">Free</span>' : `<span class="pc">${tix} ${i.price}</span>`;
}
function buyModal(it, onDone) {
  const opts = [['tix', tix, it.price, me.funtix ?? 0]];
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<div class="modal"><h2>Buy Item</h2>
    <div class="buy-row">${it.type === 'pet' ? (PET_MODELS[it.id] ? `<div class="pet-img-lg"><canvas class="pet-voxel" width="160" height="160" data-pet="${it.id}"></canvas></div>` : `<div class="pet-img-lg">${it.emoji}</div>`) : it.type === 'gear' ? (GEAR_MODELS[it.id] ? `<div class="pet-img-lg"><canvas class="gear-voxel" width="160" height="160" data-gear="${it.id}"></canvas></div>` : `<div class="pet-img-lg">${it.emoji}</div>`) : `<img src="${itemImage(it)}"`}><div><p>Would you like to buy <b>${esc(it.name)}</b>?</p>
    <p class="muted small">You have ${tix} ${fmt(me.funtix ?? 0)}</p></div></div>
    <div class="modal-actions"><button class="btn-secondary">Cancel</button>${opts.map(([c, ic, p, bal]) => `<button class="btn-primary buy-with" data-c="${c}" ${bal < p ? 'disabled title="Not enough"' : ''}>Buy for ${ic} ${p}</button>`).join('')}</div></div>`;
  document.body.appendChild(d);
  paintPetVoxels(d);
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

async function messagesPage() {
  const convos = await api('GET', '/api/dms');
  mount('messages', `<h1>Messages</h1>
    <div class="dm-list">${convos.map(c => `
      <a class="dm-convo" href="#/messages/${encodeURIComponent(c.name)}">
        <b>${esc(c.name)}</b>
        <span class="muted small dm-snip">${esc(c.lastText.slice(0, 60))}</span>
        <span class="muted small">${timeAgo(c.lastCreated)}</span>
        ${c.unread ? `<span class="badge">${c.unread}</span>` : ''}
      </a>`).join('') || '<p class="muted">No messages yet. Visit a friend\'s profile to say hi!</p>'}</div>`);
}
async function dmPage(name) {
  let msgs = await api('GET', '/api/dm/' + encodeURIComponent(name));
  mount('messages', `<h1 class="dm-head"><a href="#/messages">&larr; Messages</a> &middot; ${esc(name)}</h1>
    <div class="dm-thread"></div>
    <form class="dm-form"><input maxlength="500" placeholder="Message ${esc(name)}..." autocomplete="off"><button class="btn-primary">Send</button></form>`, () => {
    const thread = app.querySelector('.dm-thread');
    const render = () => {
      thread.innerHTML = msgs.map(m => `<div class="dm-msg ${m.sender === me.name ? 'me' : ''}"><span>${esc(m.text)}</span><i>${timeAgo(m.created)}</i>${m.sender === me.name ? `<button class="dm-del" data-id="${m.id}" title="Delete message">&times;</button>` : ''}</div>`).join('');
      thread.scrollTop = thread.scrollHeight;
      thread.querySelectorAll('.dm-del').forEach(b => b.onclick = async e => {
        e.stopPropagation();
        if (!confirm('Delete this message?')) return;
        try { await api('DELETE', '/api/dm/' + b.dataset.id); msgs = msgs.filter(m => String(m.id) !== b.dataset.id); render(); }
        catch (err) { toast(err.message, true); }
      });
    };
    render();
    const t = setInterval(async () => {
      try { const nm = await api('GET', '/api/dm/' + encodeURIComponent(name)); if (nm.length !== msgs.length || (nm[nm.length - 1]?.id !== msgs[msgs.length - 1]?.id)) { msgs = nm; render(); } } catch {}
    }, 5000);
    cleanup = () => clearInterval(t);
    app.querySelector('.dm-form').onsubmit = async e => {
      e.preventDefault();
      const inp = e.target.querySelector('input');
      const text = inp.value.trim(); if (!text) return;
      inp.value = '';
      try { const m = await api('POST', '/api/dm/' + encodeURIComponent(name), { text }); msgs.push(m); render(); }
      catch (err) { toast(err.message, true); }
    };
  });
  refreshNotif();
}
const HALLOWEEN_DATES = { starts: Date.parse('2026-10-06T00:00:00Z'), ends: Date.parse('2026-11-02T00:00:00Z') };
function shadeHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const cl = v => Math.max(0, Math.min(255, v));
  const r = cl((n >> 16) + amt), g = cl(((n >> 8) & 255) + amt), b = cl((n & 255) + amt);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}
function drawVoxel(canvas, boxes) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  const corners = b => {
    const out = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1])
      out.push([b[0] + sx * b[3] / 2, b[1] + sy * b[4] / 2, b[2] + sz * b[5] / 2]);
    return out;
  };
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
  for (const b of boxes) for (const c of corners(b)) {
    const px = c[0] - c[2], py = (c[0] + c[2]) * 0.5 - c[1];
    if (px < minX) minX = px; if (px > maxX) maxX = px;
    if (py < minY) minY = py; if (py > maxY) maxY = py;
  }
  const pad = 6;
  const s = Math.min((W - pad * 2) / Math.max(1, maxX - minX), (H - pad * 2) / Math.max(1, maxY - minY));
  const ox = W / 2 - (minX + maxX) / 2 * s, oy = H / 2 - (minY + maxY) / 2 * s;
  const P2 = (x, y, z) => [ox + (x - z) * s, oy + ((x + z) * 0.5 - y) * s];
  const poly = pts => { ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])); ctx.closePath(); ctx.fill(); };
  const sorted = [...boxes].sort((a, b) => ((a[0] + a[2]) - (b[0] + b[2])) || (a[1] - b[1]));
  for (const b of sorted) {
    const x0 = b[0] - b[3] / 2, x1 = b[0] + b[3] / 2;
    const y0 = b[1] - b[4] / 2, y1 = b[1] + b[4] / 2;
    const z0 = b[2] - b[5] / 2, z1 = b[2] + b[5] / 2;
    const col = b[6];
    ctx.fillStyle = shadeHex(col, -30);
    poly([P2(x1, y0, z0), P2(x1, y1, z0), P2(x1, y1, z1), P2(x1, y0, z1)]);
    ctx.fillStyle = shadeHex(col, -12);
    poly([P2(x0, y0, z1), P2(x1, y0, z1), P2(x1, y1, z1), P2(x0, y1, z1)]);
    ctx.fillStyle = shadeHex(col, 26);
    poly([P2(x0, y1, z0), P2(x1, y1, z0), P2(x1, y1, z1), P2(x0, y1, z1)]);
  }
}
function paintPetVoxels(root) {
  (root || document).querySelectorAll('canvas.pet-voxel').forEach(cv => {
    const m = PET_MODELS[cv.dataset.pet];
    if (m) drawVoxel(cv, m.boxes);
  });
  (root || document).querySelectorAll('canvas.gear-voxel').forEach(cv => {
    const m = GEAR_MODELS[cv.dataset.gear];
    if (m) drawVoxel(cv, m.boxes);
  });
}
const halloweenActive = () => { const n = Date.now(); return n >= HALLOWEEN_DATES.starts && n <= HALLOWEEN_DATES.ends; };
const HALLOWEEN_EMOJI = { g_halloween01: '👻', g_halloween02: '🎃', g_halloween03: '🧙', g_halloween04: '💀', g_halloween05: '🦇' };
async function halloweenPage() {
  let ev = null;
  try { ev = await api('GET', '/api/event/halloween'); } catch { ev = { games: [], active: halloweenActive() }; }
  const daysLeft = Math.max(0, Math.ceil((HALLOWEEN_DATES.ends - Date.now()) / 86400000));
  mount('halloween', `
    <div class="hw-hero">
      <div class="hw-hero-emoji">🎃</div>
      <div class="hw-hero-text">
        <h1>Halloween in Funtopia</h1>
        <p class="muted">${ev.active ? `Spooky games, creepy costumes & <b>double daily FunTix</b> — ends in ${daysLeft} day${daysLeft === 1 ? '' : 's'}!` : 'The spirits have returned to their graves. See you next year!'}</p>
      </div>
    </div>
    <section><div class="sec-h"><h2>Spooky Games (${ev.games.length})</h2></div>
      <div class="game-row">${ev.games.map(g => `
        <a class="game-card" href="#/play/${g.id}">
          <div class="gc-thumb hw-thumb">${HALLOWEEN_EMOJI[g.id] || '🎃'}</div>
          <b>${esc(g.name)}</b><span class="muted small">${fmt(g.visits)} plays</span>
        </a>`).join('') || '<p class="muted">The spirits are still preparing the games…</p>'}</div></section>
    <section><div class="sec-h"><h2>Costumes</h2><a href="#/catalog">Shop all &rsaquo;</a></div>
      <p class="muted">Witch hats, vampire fangs, pumpkin heads and more — find them in the <a href="#/catalog">Marketplace</a> and the Avatar Editor's new looks.</p></section>`);
}
async function friendsPage() {
  const fr = await api('GET', '/api/friends');
  mount('friends', `
    <h1>Friends</h1>
    <form class="user-search"><input name="q" placeholder="Search for people by username"><button class="btn-primary">Search</button></form>
    <div class="search-results"></div>
    ${fr.requests.length ? `<section><div class="sec-h"><h2>Friend Requests (${fr.requests.length})</h2></div><div class="req-list">${fr.requests.map(u => `
      <div class="req">${avatarImgTag(u.avatar)}<a href="#/users/${encodeURIComponent(u.name)}">${esc(u.name)}</a><button class="btn-primary" data-accept="${esc(u.name)}">Accept</button><button class="btn-secondary" data-decline="${esc(u.name)}">Ignore</button></div>`).join('')}</div></section>` : ''}
    <section><div class="sec-h"><h2>My Friends (${fr.friends.length})</h2></div>
      <div class="friend-grid">${fr.friends.map(u => `<div class="friend-card">${userTile(u)}<div class="friend-card-actions"><a class="btn-secondary btn-small" href="#/messages/${encodeURIComponent(u.name)}">Message</a><button class="btn-secondary btn-small" data-party="${esc(u.name)}">🎉</button>${u.gameId ? `<a class="btn-join" href="#/play/${u.gameId}">Join</a>` : `<span class="muted small">${u.online ? 'Online' : 'Offline'}</span>`}</div></div>`).join('') || '<p class="muted">No friends yet. Search for people above!</p>'}</div></section>`, () => {
    app.querySelectorAll('[data-accept]').forEach(b => b.onclick = async () => { await api('POST', '/api/friends/' + encodeURIComponent(b.dataset.accept)); toast('You are now friends with ' + b.dataset.accept); me = await api('GET', '/api/me'); friendsPage(); });
    app.querySelectorAll('[data-decline]').forEach(b => b.onclick = async () => { await api('DELETE', '/api/friends/' + encodeURIComponent(b.dataset.decline)); me = await api('GET', '/api/me'); friendsPage(); });
    app.querySelectorAll('[data-party]').forEach(b => b.onclick = async () => {
      try {
        let p = await api('GET', '/api/party');
        if (!p) p = await api('POST', '/api/party');
        await api('POST', `/api/party/${p.id}/invite`, { user: b.dataset.party });
        toast('Party invite sent to ' + b.dataset.party + '!');
      } catch (err) { toast(err.message, true); }
    });
    app.querySelector('.user-search').onsubmit = async e => {
      e.preventDefault();
      const r = await api('GET', '/api/search/users?q=' + encodeURIComponent(e.target.q.value));
      app.querySelector('.search-results').innerHTML = `<div class="friends-row">${r.map(userTile).join('') || '<p class="muted">No users found.</p>'}</div>`;
    };
  });
}

async function showGroupDetail(id, reload) {
  try {
    const g = await api('GET', '/api/groups/' + encodeURIComponent(id));
    const isOwner = g.isCreator || me.admin;
    const d = document.createElement('div'); d.className = 'modal-bg';
    const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    d.innerHTML = `<div class="modal modal-wide"><h2>${g.icon ? esc(g.icon) + ' ' : ''}${esc(g.name)}</h2>
      <p class="muted">${esc(g.description || 'No description yet.')}</p>
      <div class="group-meta"><span>${g.members} member${g.members === 1 ? '' : 's'}</span><span>by ${esc(g.creator)}</span></div>
      ${isOwner ? `<div class="group-edit"><label>Icon (emoji)<input class="group-icon-input" maxlength="4" value="${esc(g.icon || '')}" placeholder="🎮"></label>
      <label>Description<textarea class="group-desc-input" maxlength="240" rows="2">${esc(g.description || '')}</textarea></label>
      <button class="btn-primary btn-sm group-save">Save</button></div>` : ''}
      <div class="group-tabs">
        <button class="group-tab active" data-tab="ann">📢 Announcements (${(g.announcements || []).length})</button>
        <button class="group-tab" data-tab="games">🎮 Games (${(g.games || []).length})</button>
        <button class="group-tab" data-tab="members">👥 Members (${g.memberList.length})</button>
      </div>
      <div class="group-tabpane" data-pane="ann">
        ${isOwner ? `<button class="btn-primary btn-sm group-ann-new">+ New Announcement</button>` : ''}
        <div class="group-anns">${(g.announcements || []).length ? g.announcements.map(a => `
          <div class="group-ann"><div class="group-ann-head"><b>${esc(a.title)}</b>${isOwner ? `<button class="btn-danger btn-sm ann-del" data-aid="${esc(a.id)}">Delete</button>` : ''}</div>
          <p>${esc(a.content)}</p><div class="muted small">by ${esc(a.author)} · ${fmtDate(a.created)}</div></div>`).join('') : '<p class="muted">No announcements yet.</p>'}</div>
      </div>
      <div class="group-tabpane hidden" data-pane="games">
        ${isOwner ? `<button class="btn-primary btn-sm group-game-add">+ Add Game</button>` : ''}
        <div class="group-games">${(g.games || []).length ? g.games.map(gm => `
          <a class="group-game" href="#/games/${esc(gm.id)}"><b>${esc(gm.name)}</b><span class="muted small">by ${esc(gm.creator)} · ${gm.visits} plays</span>${isOwner ? `<button class="btn-danger btn-sm game-rm" data-gid="${esc(gm.id)}">Remove</button>` : ''}</a>`).join('') : '<p class="muted">No games yet.</p>'}</div>
      </div>
      <div class="group-tabpane hidden" data-pane="members">
        <div class="group-members">${g.memberList.map(m => `<div class="group-member"><span>${esc(m)}</span>${isOwner && m !== g.creator ? `<button class="btn-danger btn-sm group-kick" data-name="${esc(m)}">Kick</button>` : ''}${m === g.creator ? '<span class="owner-badge">Owner</span>' : ''}</div>`).join('')}</div>
      </div>
      <div class="modal-actions"><button class="btn-secondary group-close">Close</button></div></div>`;
    document.body.appendChild(d);
    const refresh = () => { d.remove(); showGroupDetail(id, reload); reload(); };
    d.querySelector('.group-close').onclick = () => d.remove();
    d.onclick = e => { if (e.target === d) d.remove(); };
    // Tabs
    d.querySelectorAll('.group-tab').forEach(t => t.onclick = () => {
      d.querySelectorAll('.group-tab').forEach(x => x.classList.toggle('active', x === t));
      d.querySelectorAll('.group-tabpane').forEach(p => p.classList.toggle('hidden', p.dataset.pane !== t.dataset.tab));
    });
    // Kick
    d.querySelectorAll('.group-kick').forEach(b => b.onclick = async () => {
      if (!confirm(`Kick ${b.dataset.name}?`)) return;
      try { await api('POST', `/api/groups/${encodeURIComponent(id)}/kick`, { name: b.dataset.name }); toast('Kicked.'); refresh(); }
      catch (e) { toast(e.message, true); }
    });
    // Save edits
    const saveBtn = d.querySelector('.group-save');
    if (saveBtn) saveBtn.onclick = async () => {
      try {
        await api('PUT', `/api/groups/${encodeURIComponent(id)}`, { icon: d.querySelector('.group-icon-input').value, description: d.querySelector('.group-desc-input').value });
        toast('Group updated.'); refresh();
      } catch (e) { toast(e.message, true); }
    };
    // New announcement
    const annBtn = d.querySelector('.group-ann-new');
    if (annBtn) annBtn.onclick = () => {
      const title = prompt('Announcement title:');
      if (!title) return;
      const content = prompt('Announcement content:');
      if (!content) return;
      api('POST', `/api/groups/${encodeURIComponent(id)}/announcements`, { title, content })
        .then(() => { toast('Posted!'); refresh(); })
        .catch(e => toast(e.message, true));
    };
    // Delete announcement
    d.querySelectorAll('.ann-del').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this announcement?')) return;
      try { await api('DELETE', `/api/groups/${encodeURIComponent(id)}/announcements/${encodeURIComponent(b.dataset.aid)}`); toast('Deleted.'); refresh(); }
      catch (e) { toast(e.message, true); }
    });
    // Add game
    const addGameBtn = d.querySelector('.group-game-add');
    if (addGameBtn) addGameBtn.onclick = async () => {
      try {
        const myGames = await api('GET', '/api/mygames');
        if (!myGames.length) { toast('You have no games to add. Create one first!', true); return; }
        const pick = prompt('Enter the number of the game to add:\n' + myGames.map((gm, i) => `${i + 1}. ${gm.name}`).join('\n'));
        const idx = parseInt(pick) - 1;
        if (isNaN(idx) || idx < 0 || idx >= myGames.length) return;
        await api('POST', `/api/groups/${encodeURIComponent(id)}/games`, { gameId: myGames[idx].id });
        toast('Game added!'); refresh();
      } catch (e) { toast(e.message, true); }
    };
    // Remove game
    d.querySelectorAll('.game-rm').forEach(b => b.onclick = async e => {
      e.preventDefault(); e.stopPropagation();
      if (!confirm('Remove this game from the group?')) return;
      try { await api('DELETE', `/api/groups/${encodeURIComponent(id)}/games/${encodeURIComponent(b.dataset.gid)}`); toast('Removed.'); refresh(); }
      catch (e2) { toast(e2.message, true); }
    });
  } catch (e) { toast(e.message, true); }
}
function groupsPage() {
  const load = async () => {
    const groups = await api('GET', '/api/groups');
    const q = String(app.querySelector('.groups-search')?.value || '').trim().toLowerCase();
    const filtered = q ? groups.filter(g => g.name.toLowerCase().includes(q) || g.description.toLowerCase().includes(q)) : groups;
    const list = app.querySelector('.group-grid');
    if (!list) return;
    list.innerHTML = filtered.length ? filtered.map(g => `
      <article class="group-card">
        <div class="group-icon">${g.icon ? esc(g.icon) : esc(g.name.slice(0, 1).toUpperCase())}</div>
        <div class="group-card-body">
          <h3>${esc(g.name)}</h3>
          <p>${esc(g.description || 'No description yet.')}</p>
          <div class="group-meta"><span>${g.members} member${g.members === 1 ? '' : 's'}</span><span>by ${esc(g.creator || 'Unknown')}</span></div>
          <div class="group-btns">
            <button class="${g.joined ? 'btn-secondary' : 'btn-primary'} group-action" data-id="${esc(g.id)}" data-action="${g.joined ? 'leave' : 'join'}" ${g.isCreator ? 'disabled title="The creator cannot leave their group"' : ''}>
              ${g.joined ? 'Leave' : 'Join'}
            </button>
            <button class="btn-secondary group-view" data-id="${esc(g.id)}">View</button>
            ${(g.isCreator || me.admin) ? `<button class="btn-danger group-delete" data-id="${esc(g.id)}" data-name="${esc(g.name)}">Delete</button>` : ''}
          </div>
        </div>
      </article>`).join('') : '<p class="muted">No groups found. Create the first one!</p>';
    list.querySelectorAll('.group-action').forEach(btn => btn.onclick = async () => {
      try {
        await api('POST', `/api/groups/${encodeURIComponent(btn.dataset.id)}/${btn.dataset.action}`);
        toast(btn.dataset.action === 'join' ? 'Joined group!' : 'Left group.');
        await load();
      } catch (e) { toast(e.message, true); }
    });
    list.querySelectorAll('.group-view').forEach(btn => btn.onclick = () => showGroupDetail(btn.dataset.id, load));
    list.querySelectorAll('.group-delete').forEach(btn => btn.onclick = async () => {
      if (!confirm(`Delete "${btn.dataset.name}"? This cannot be undone.`)) return;
      try {
        await api('DELETE', `/api/groups/${encodeURIComponent(btn.dataset.id)}`);
        toast('Group deleted.');
        await load();
      } catch (e) { toast(e.message, true); }
    });
  };

  mount('groups', `
    <div class="groups-head">
      <div><h1>Groups</h1><p class="muted">Find people who like the same games and create communities on Funtopia.</p></div>
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
          <label>Icon (emoji, optional)<input name="icon" maxlength="4" placeholder="🎮"></label>
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
          await api('POST', '/api/groups', { name: form.name.value.trim(), icon: form.icon.value.trim(), description: form.description.value.trim() });
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
      <div class="ph-img ${u.gameId ? 'ingame' : u.online ? 'online' : ''}">${avatarImgTag(u.avatar)}</div>
      <div class="ph-info"><h1>${esc(u.name)}${badgeIcon2(u.badge)}</h1><div class="muted">@${esc(u.name)}</div>
        <div class="ph-stats"><div><b>${u.friends}</b> Friends</div><div><b>${u.games.length}</b> Creations</div><div>${u.gameName ? `Playing <a href="#/games/${u.gameId}">${esc(u.gameName)}</a>` : u.online ? 'Online' : 'Offline'}</div></div>
      </div>
      <div class="ph-actions">${isMe ? '<a class="btn-secondary" href="#/avatar">Edit Avatar</a>' : u.isFriend ? `<a class="btn-secondary" href="#/messages/${encodeURIComponent(u.name)}">Message</a>${u.gameId ? `<a class="btn-primary" href="#/play/${u.gameId}">Join Game</a>` : ''}<button class="btn-secondary unfriend">Unfriend</button><button class="btn-secondary report-btn">Report</button>` : u.requested ? '<button class="btn-secondary" disabled>Request Sent</button>' : `<button class="btn-primary add-friend">Add Friend</button><button class="btn-secondary report-btn">Report</button>`}</div>
    </div>
    <section><div class="sec-h"><h2>About</h2>${isMe ? '<button class="link edit-bio">Edit</button>' : ''}</div><p class="bio">${esc(u.bio || (isMe ? 'Tell people about yourself!' : 'This user has no bio.'))}</p></section>
    <section><div class="sec-h"><h2>Badges (${u.badges.length})</h2></div>
      ${isMe && u.badges.length ? '<p class="muted small">Click a badge to show it next to your name.</p>' : ''}
      <div class="badge-grid">${u.badges.map(id => { const bd = badgeDef(id); if (!bd) return ''; return `<${isMe ? 'button' : 'div'} class="badge-card ${u.badge === id ? 'on' : ''}" data-badge="${id}">${badgeIcon2(id, 44)}<b>${esc(bd.name)}</b><span class="muted small">${esc(bd.desc || '')}</span>${u.badge === id ? '<span class="badge-feat">Shown</span>' : ''}</${isMe ? 'button' : 'div'}>`; }).join('')}
        ${isMe && u.badges.length ? `<button class="badge-card none ${u.badge ? '' : 'on'}" data-badge="none"><b>None</b><span class="muted small">Don't show a badge</span>${u.badge ? '' : '<span class="badge-feat">Shown</span>'}</button>` : ''}</div>
      ${u.badges.length ? '' : '<p class="muted">No badges yet.</p>'}</section>
    <section class="profile-grid">
      <div class="profile-avatar"><h2>Currently Wearing</h2>${avatarImgTag(u.avatar, "full")}</div>
      <div><h2>Friends (${u.friendsList.length})</h2><div class="friends-row wrap">${u.friendsList.map(userTile).join('') || '<p class="muted">No friends yet.</p>'}</div></div>
    </section>
    <section><div class="sec-h"><h2>Creations</h2></div><div class="game-row">${u.games.map(gameCard).join('') || '<p class="muted">No creations yet.</p>'}</div></section>`, () => {
    app.querySelector('.add-friend')?.addEventListener('click', async () => { const r = await api('POST', '/api/friends/' + encodeURIComponent(u.name)); toast(r.status === 'friends' ? 'You are now friends!' : 'Friend request sent'); profilePage(name); });
    app.querySelector('.report-btn')?.addEventListener('click', () => reportModal(u.name, 'user'));
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
  const tpls = [['baseplate', 'Baseplate', 'An empty grey baseplate. A blank canvas.'], ['obby', 'Obby', 'A 10-stage obstacle course to remix.'], ['hangout', 'Town', 'A small town with houses and trees.'], ['tower', 'Tower Climb', 'A spiral climbing challenge.'], ['coinRush', 'Islands', 'Floating islands full of coins.'], ['shooterArena', 'Shooter Arena', 'A PvP battle arena. Everyone gets a free blaster!'], ['soccerField', '⚽ Soccer', 'Kick the ball into the goal! First to score wins.'], ['mysteryMansion', '🔍 Mystery', 'Find all 5 clues hidden in the mansion!'], ['garden', '🌻 Garden', 'Plant seeds, grow crops, harvest for FunTix!']];
  mount('create', `
    <h1>Create</h1>
    <div class="av-tabs"><button class="active">🎮 Experiences</button><button data-goto="#/ugc">🎨 UGC Studio</button></div>
    <section><div class="sec-h"><h2>Start a New Experience</h2></div><div class="tpl-grid">${tpls.map(([k, n, d]) => `
      <a class="tpl" href="#/studio/new/${k}"><div class="gc-thumb"><img data-tpl="${k}" src="${PLACEHOLDER}"></div><b>${n}</b><span class="muted small">${d}</span></a>`).join('')}</div></section>
    <section><div class="sec-h"><h2>My Experiences (${mine.length})</h2></div>
      <div class="my-games">${mine.map(g => `<div class="my-game"><img ${g.thumbnail ? `src="${g.thumbnail}"` : `src="${PLACEHOLDER}" data-thumb="${g.id}"`}><div class="mg-info"><b>${esc(g.name)}</b><span class="muted small">${g.unpublished ? 'Private (not published)' : 'Public'} &middot; ${fmt(g.visits)} visits &middot; ${fmt(g.playing)} playing</span></div>
        <a class="btn-secondary" href="#/studio/${g.id}">Edit</a><a class="btn-secondary" href="#/games/${g.id}">View</a><button class="btn-danger" data-del="${g.id}">Delete</button></div>`).join('') || '<p class="muted">You haven\'t made anything yet. Pick a template above to open Funtopia Studio!</p>'}</div></section>`, () => {
    app.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => location.hash = b.dataset.goto);
    setTimeout(() => app.querySelectorAll('img[data-tpl]').forEach(img => { img.src = tplThumb(img.dataset.tpl); }), 30);
    app.querySelectorAll('[data-del]').forEach(b => b.onclick = () => confirmModal('Delete Experience', 'This cannot be undone. Delete it?', 'Delete', async () => { await api('DELETE', '/api/games/' + b.dataset.del); createPage(); }));
  });
}
const tplCache = {};
function tplThumb(k) { return tplCache[k] ||= worldThumbnail(templates[k]()); }

async function studioPage(id, tpl) {
  let g;
  if (id === 'new') g = { id: null, name: 'My ' + ({ baseplate: 'Baseplate', obby: 'Obby', hangout: 'Town', tower: 'Tower', coinRush: 'Islands', shooterArena: 'Shooter Arena', soccerField: 'Soccer', mysteryMansion: 'Mystery', garden: 'Garden' }[tpl] || 'Game'), description: '', world: (templates[tpl] || templates.baseplate)() };
  else { g = await api('GET', '/api/games/' + id); if (g.creator.toLowerCase() !== me.name.toLowerCase()) { toast('You can only edit your own games', true); location.hash = '#/games/' + id; return; } }
  app.className = 'fullscreen'; app.innerHTML = '<div class="studio-container"></div>';
  let game = null;
  const { Studio } = await import('./studio.js?v=5bfe0508');
  const studio = new Studio(app.querySelector('.studio-container'), {
    gameId: g.id, name: g.name, description: g.description, world: g.world, api, toast, aiAccess: me.aiAccess,
    onCreated: newId => history.replaceState(null, '', '#/studio/' + newId),
    onExit: gid => { cleanup = null; location.hash = gid ? '#/create' : '#/create'; },
    playTest: async (box, world, name, done) => {
      const { Game: GameClass } = await import('./game.js?v=92b178c6');
      game = new GameClass(box, { world, gameName: name + ' (Test)', me, token, test: true, onExit: () => { game = null; done(); } });
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
        <span class="lbp-rank">${i + 1}</span>${avatarImgTag(u.avatar)}
        <span class="lbp-name">${badgeIcon(u.badge)}${esc(u.name)}${u.online ? '<i class="dot" title="Online"></i>' : ''}</span>
        <span class="lbp-tix">${tix}${u.funtix.toLocaleString()}</span></a>`).join('')}</div>`);
}
// ---------- Moderation ----------
const MOD_POLICY = `
<h3>Admin levels</h3>
<p><b>Owner</b> — full control, including granting and removing admins. <b>Admin</b> — everything except managing other admins. <b>Moderator</b> — mute, kick, review the report queue, and start bans (which still need a second person to confirm). @fun is the site owner — the highest level; no one can outrank or demote the owner. No level can take action against someone at the same level or higher.</p>
<h3>What moderators do</h3>
<p>Review content players report, mute disruptive players (up to 24 hours), remove players from game sessions, and escalate serious cases. Moderators never get extra FunTix, items, or admin powers — just safety tools.</p>
<h3>Automated first pass</h3>
<p>Every report is scanned automatically and labeled <b>clear</b>, <b>needs review</b>, or <b>urgent</b>. Threats and shared personal info (phone numbers, emails) are always urgent. The automated pass never mutes, kicks, or bans anyone — it only decides what humans look at first.</p>
<h3>Bans need two people</h3>
<p>No ban takes effect until two different moderators or admins confirm it separately. One person can never ban alone.</p>
<h3>What moderators see</h3>
<p>Only content players reported. Moderators do not get a feed of everyone's activity — no surveillance, just the report queue.</p>
<h3>Safety basics</h3>
<p>Never share personal info (phone, email, address, school) in chat, messages, or game names. Threats and targeted harassment are treated as urgent. If someone is bothering you, report them from their profile.</p>`;

function reportModal(target, type = 'user') {
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<div class="modal"><h2>Report ${esc(target)}</h2>
    <p class="muted small">Reports go to the moderator review queue. An automated first pass labels it, then a human reviews it.</p>
    <label>Reason<select class="rp-reason">${['Harassment', 'Spam', 'Cheating', 'Inappropriate content', 'Sharing personal info', 'Threats', 'Other'].map(r => `<option>${r}</option>`).join('')}</select></label>
    <label>Details<textarea class="rp-details" maxlength="500" rows="3" placeholder="What happened? (optional)"></textarea></label>
    <div class="modal-actions"><button class="btn-secondary rp-cancel">Cancel</button><button class="btn-primary rp-send">Send Report</button></div></div>`;
  document.body.appendChild(d);
  d.querySelector('.rp-cancel').onclick = () => d.remove();
  d.onclick = e => { if (e.target === d) d.remove(); };
  d.querySelector('.rp-send').onclick = async () => {
    const reason = d.querySelector('.rp-reason').value;
    const details = d.querySelector('.rp-details').value.trim();
    try {
      const r = await api('POST', '/api/report', { type, target, reason, details });
      d.remove(); toast(r.message || 'Report sent');
    } catch (e) { toast(e.message, true); }
  };
}

async function moderationPage() {
  const mods = await api('GET', '/api/moderators').catch(() => []);
  const isMod = !!(me?.moderator || me?.admin);
  let queue = [], pending = [], log = [], ugcPending = [];
  if (isMod) {
    queue = await api('GET', '/api/mod/queue').catch(() => []);
    pending = await api('GET', '/api/mod/ban/pending').catch(() => []);
    log = await api('GET', '/api/mod/log').catch(() => []);
    ugcPending = await api('GET', '/api/ugc/pending').catch(() => []);
    for (const u of ugcPending) if (!ITEM[u.id]) ITEM[u.id] = { id: u.id, type: u.type, name: u.name, price: u.price, color: u.color, template: u.template, model_url: u.model_url || null, model_transform: u.model_transform || null, creator: u.creator, ugc: true };
  }
  const badge = l => l === 'urgent' ? '<span class="mod-urgent">URGENT</span>' : l === 'review' ? '<span class="mod-review">REVIEW</span>' : '<span class="mod-clear">CLEAR</span>';
  const reload = () => moderationPage();
  mount('moderation', `<h1>🛡️ Moderation</h1>
    <section><div class="sec-h"><h2>Policy</h2></div><div class="mod-policy">${MOD_POLICY}</div></section>
    <section><div class="sec-h"><h2>Staff (${mods.length})</h2></div>
      <div class="friends-row">${mods.map(m => `<a class="user-tile" href="#/users/${encodeURIComponent(m.name)}"><div class="ut-name">🛡️ ${esc(m.name)}</div><div class="ut-game">${esc((m.role || 'moderator').toUpperCase())}</div></a>`).join('')}</div></section>
    ${isMod ? `
    <section><div class="sec-h"><h2>Review Queue (${queue.length})</h2></div>
      ${queue.map(r => `<div class="mod-report">${badge(r.label)}
        <div class="mod-report-body"><b>${esc(r.type)}: ${r.type === 'user' ? `<a href="#/users/${encodeURIComponent(r.target)}">${esc(r.target)}</a>` : esc(r.target)}</b><div>${esc(r.reason)}</div>
        ${r.details ? `<div class="muted small">${esc(r.details)}</div>` : ''}
        <div class="muted small">Reported by ${esc(r.by)} · ${new Date(r.t).toLocaleString()}${r.flags.length ? ' · ' + r.flags.map(esc).join(', ') : ''}</div></div>
        <div class="mod-report-actions">
          <button class="btn-secondary btn-small" data-dismiss="${r.id}">Dismiss</button>
          ${r.type === 'user' ? `<button class="btn-secondary btn-small" data-mute="${esc(r.target)}">Mute</button>
          <button class="btn-secondary btn-small" data-kick="${esc(r.target)}">Kick</button>
          <button class="btn-danger btn-small" data-ban="${esc(r.target)}">Ban…</button>` : ''}
        </div></div>`).join('') || '<p class="muted">Queue is clear. 🎉</p>'}</section>
    <section><div class="sec-h"><h2>Bans awaiting second confirmation (${pending.length})</h2></div>
      ${pending.map(p => `<div class="mod-report"><div class="mod-report-body"><b>${esc(p.name)}</b>
        <div>${esc(p.reason)}${p.days ? ` (${p.days}d)` : ' (permanent)'}</div>
        <div class="muted small">Started by ${esc(p.by)} · expires ${new Date(p.expires).toLocaleTimeString()}</div></div>
        <div class="mod-report-actions">${p.by.toLowerCase() === me.name.toLowerCase()
          ? '<span class="muted small">Waiting for someone else to confirm</span>'
          : `<button class="btn-danger btn-small" data-confirm-ban="${p.token}" data-name="${esc(p.name)}">Confirm ban (2/2)</button>`}</div></div>`).join('') || '<p class="muted">None pending.</p>'}</section>
    <section><div class="sec-h"><h2>UGC Review (${ugcPending.length})</h2></div>
      ${ugcPending.map(u => `<div class="mod-report"><div class="cat-img">${u.model_url ? glbCardImg() : `<img src="${itemImage(u)}">`}</div>
        <div class="mod-report-body"><b>${esc(u.name)}</b><div>${u.type} · ${tix} ${u.price}</div>
        <div class="muted small">by ${esc(u.creator)}</div></div>
        <div class="mod-report-actions">
          ${u.model_url ? `<button class="btn-secondary btn-small" data-ugc-view="${u.id}">View 3D</button>` : ''}
          <button class="btn-primary btn-small" data-ugc-ok="${u.id}">Approve</button>
          <button class="btn-danger btn-small" data-ugc-no="${u.id}">Reject</button>
        </div></div>`).join('') || '<p class="muted">No UGC awaiting review.</p>'}</section>
    <section><div class="sec-h"><h2>Action Log</h2></div>
      <div>${log.map(e => `<div class="mod-log-row"><span class="muted small">${new Date(e.t).toLocaleString()}</span><b>${esc(e.by)}</b><span class="mod-act">${esc(e.action)}</span><span>${esc(e.target)}</span><span class="muted small">${esc(e.reason || '')}</span></div>`).join('') || '<p class="muted">No actions yet.</p>'}</div></section>` : ''}`,
  () => {
    app.querySelectorAll('[data-dismiss]').forEach(b => b.onclick = async () => {
      try { await api('POST', '/api/mod/reports/' + b.dataset.dismiss, { action: 'dismiss' }); toast('Report dismissed'); reload(); }
      catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('[data-mute]').forEach(b => b.onclick = async () => {
      const minutes = parseInt(prompt(`Mute ${b.dataset.mute} for how many minutes? (max 1440)`, '30') || '0', 10);
      if (!minutes) return;
      const reason = prompt('Mute reason:', 'Disruptive behavior') || '';
      if (reason === null) return;
      try { await api('POST', '/api/mod/mute', { name: b.dataset.mute, minutes, reason }); toast(`Muted ${b.dataset.mute}`); reload(); }
      catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('[data-kick]').forEach(b => b.onclick = () => confirmModal('Kick player', `Kick ${esc(b.dataset.kick)} from their game session?`, 'Kick', async () => {
      try { await api('POST', '/api/mod/kick', { name: b.dataset.kick, reason: 'Kicked by a moderator' }); toast('Kicked'); reload(); }
      catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('[data-ban]').forEach(b => b.onclick = async () => {
      const reason = prompt(`Ban ${b.dataset.ban}? Enter reason:`) || '';
      if (reason === null) return;
      const days = Math.max(0, parseInt(prompt('Ban duration in days (0 = permanent):', '0') || '0', 10));
      if (!confirm(`STEP 1 of 2: start a ban of ${b.dataset.ban}${days ? ` for ${days} days` : ' permanently'}? A DIFFERENT moderator or admin must confirm before it takes effect.`)) return;
      try { await api('POST', '/api/mod/ban/initiate', { name: b.dataset.ban, reason, days }); toast('First confirmation recorded — waiting for a second person.'); reload(); }
      catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('[data-confirm-ban]').forEach(b => b.onclick = () => confirmModal('Confirm ban (2/2)', `You are the SECOND confirmation. Ban ${esc(b.dataset.name)}? This takes effect immediately.`, 'Ban', async () => {
      try { const r = await api('POST', '/api/mod/ban/confirm', { token: b.dataset.confirmBan }); toast(r.message || 'Banned'); reload(); }
      catch (e) { toast(e.message, true); }
    }));
    app.querySelectorAll('[data-ugc-ok]').forEach(b => b.onclick = async () => {
      try { await api('POST', '/api/ugc/' + b.dataset.ugcOk + '/approve'); await loadUgc(); toast('UGC item approved'); reload(); }
      catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('[data-ugc-no]').forEach(b => b.onclick = async () => {
      try { await api('POST', '/api/ugc/' + b.dataset.ugcNo + '/reject'); toast('UGC item rejected'); reload(); }
      catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('[data-ugc-view]').forEach(b => b.onclick = () => {
      const u = ugcPending.find(x => x.id === b.dataset.ugcView);
      if (u) ugcGlbModal(u);
    });
  });
}

// Moderator 3D preview for GLB UGC items
async function ugcGlbModal(u) {
  const A3 = await ensureAvatar3d().catch(() => null);
  const d = document.createElement('div'); d.className = 'modal-bg';
  d.innerHTML = `<div class="modal"><h2>${esc(u.name)}</h2>
    <canvas class="glb-canvas" width="360" height="360"></canvas>
    <p class="muted small">by ${esc(u.creator)} · ${u.type} · ${tix} ${u.price}</p>
    <div class="modal-actions"><button class="btn-secondary">Close</button><button class="btn-primary" data-ok>Approve</button><button class="btn-danger" data-no>Reject</button></div></div>`;
  document.body.appendChild(d);
  let alive = true;
  const close = () => { alive = false; d.remove(); };
  const decide = async (kind) => {
    try { await api('POST', '/api/ugc/' + u.id + '/' + kind); await loadUgc(); toast(kind === 'approve' ? 'Approved' : 'Rejected'); }
    catch (e) { toast(e.message, true); }
    close(); route();
  };
  d.querySelector('.btn-secondary').onclick = close;
  d.onclick = e => { if (e.target === d) close(); };
  d.querySelector('[data-ok]').onclick = () => decide('approve');
  d.querySelector('[data-no]').onclick = () => decide('reject');
  if (A3) {
    const canvas = d.querySelector('.glb-canvas');
    const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.outputColorSpace = THREE.SRGBColorSpace;
    const sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff', '#888', 1.5));
    const dl = new THREE.DirectionalLight('#fff', 1.6); dl.position.set(3, 6, 8); sc.add(dl);
    const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 0.5, 7); cam.lookAt(0, 0, 0);
    const holder = new THREE.Group(); sc.add(holder);
    A3.loadUgcGlb(u.model_url, 2.4, u.model_transform).then(g => { if (alive) holder.add(g); }).catch(() => toast('Could not load model', true));
    const tick = () => { if (!alive) { r.dispose(); return; } requestAnimationFrame(tick); holder.rotation.y += 0.012; r.render(sc, cam); };
    tick();
  }
}

const adminDeps = { api, mount, esc, avatarImgTag, toast, loadBadgeDefs, tix, CLUB, ADMIN, ensureAvatar3d, get me() { return me; }, get BADGE_DEFS() { return BADGE_DEFS; } };
const ugcDeps = { api, mount, esc, tix, fmt, toast, itemImage, loadUgc, ensureAvatar3d, ugcCardImg, setCleanup: fn => { cleanup = fn; }, get me() { return me; } };
const horrorDeps = { avatarImgTag, esc, route, get me() { return me; }, getCleanup: () => cleanup, setCleanup: fn => { cleanup = fn; } };
async function adminPage(q = '') {
  const m = await import('./admin.js?v=9cb46cb7');
  return m.adminPage(adminDeps, q);
}
async function ownerPage(q = '') {
  const m = await import('./admin.js?v=9cb46cb7');
  return m.ownerPage(adminDeps, q);
}

function clubPage() {
  const bal = me.funtix ?? 0, active = me.club, short = ECON.CLUB_PRICE - bal;
  const days = Math.ceil(((me.clubUntil || 0) - Date.now()) / 86400000);
  mount('club', `
    <div class="club-hero">
      <div class="club-logo">${LOGO}${CLUB}</div>
      <div class="club-info"><h1>FriendClub</h1><p class="muted">The membership for true Funtopia fans.</p>
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

async function addonsPage() {
  const { addons } = await api('GET', '/api/addons');
  mount('addons', `<h1>Add-ons</h1><p class="muted">Connect Funtopia to other apps. You control exactly what each add-on can see.</p>
    <div class="addon-list">${addons.map(a => `
      <div class="addon-card" data-addon="${esc(a.id)}">
        <div class="addon-head">
          <div><h2>${esc(a.name)}</h2><p class="muted">${esc(a.description)}</p></div>
          <label class="switch"><input type="checkbox" class="addon-enabled" ${a.settings.enabled ? 'checked' : ''}><span></span></label>
        </div>
        <div class="addon-perms ${a.settings.enabled ? '' : 'disabled'}">
          ${a.permissions.map(p => `
            <label class="addon-perm"><input type="checkbox" data-perm="${esc(p.id)}" ${a.settings[p.id] !== false ? 'checked' : ''} ${a.settings.enabled ? '' : 'disabled'}>
              <div><strong>${esc(p.label)}</strong><div class="muted small">${esc(p.description)}</div></div>
            </label>`).join('')}
        </div>
      </div>`).join('') || '<p class="muted">No add-ons available yet.</p>'}
    </div>`, () => {
      document.querySelectorAll('.addon-card').forEach(card => {
        const id = card.dataset.addon;
        const enabledEl = card.querySelector('.addon-enabled');
        const save = async () => {
          const settings = { enabled: enabledEl.checked };
          card.querySelectorAll('[data-perm]').forEach(cb => { settings[cb.dataset.perm] = cb.checked; });
          const r = await api('POST', '/api/addons/' + encodeURIComponent(id), settings);
          if (r.ok) { toast(esc(id) + (settings.enabled ? ' enabled' : ' disabled')); addonsPage(); }
          else toast('Could not save');
        };
        enabledEl.addEventListener('change', save);
        card.querySelectorAll('[data-perm]').forEach(cb => cb.addEventListener('change', save));
      });
    });
}

// ---------- spooky menu music ----------
let audioUnlocked = false;
function maybeSpooky() {
  const seg = (location.hash.slice(1).split('?')[0] || '/home').split('/').filter(Boolean);
  const inGame = seg[0] === 'play' || seg[0] === 'studio';
  if (inGame || !halloweenActive()) { try { stopSpooky(); } catch {} return; }
  if (localStorage.getItem('ff_music') === '0') { try { stopSpooky(); } catch {} return; }
  if (audioUnlocked) { try { startSpooky(); } catch {} }
}
function unlockAudio() {
  if (audioUnlocked) return;
  audioUnlocked = true;
  maybeSpooky();
}
addEventListener('pointerdown', unlockAudio);
addEventListener('keydown', unlockAudio);

// ---------- router ----------
let routing = 0;
async function route() {
  const my = ++routing;
  if (cleanup) { const c = cleanup; cleanup = null; c(); }
  const [path, query] = location.hash.slice(1).split('?');
  const seg = (path || '/home').split('/').filter(Boolean);
  if (!token && seg[0] !== 'horror') { if (seg[0] !== 'login') history.replaceState(null, '', '#/login'); return loginPage(); }
  try {
    if (!me) { me = await api('GET', '/api/me'); dailyToast(me); await loadUgc(); }
    if (my !== routing) return;
    const qp = new URLSearchParams(query || '');
    switch (seg[0]) {
      case 'login': location.hash = '#/home'; return;
      case 'discover': return await discoverPage(qp.get('q'));
      case 'games': return await gamePage(seg[1]);
      case 'play': return await playPage(seg[1], qp.get('server'));
      case 'avatar': return avatarPage();
      case 'catalog': return await catalogPage(seg[1]);
      case 'ugc': { const m = await import('./ugc-studio.js?v=07967ed1'); return m.ugcPage(ugcDeps); }
      case 'studio': return await studioPage(seg[1], seg[2]);
      case 'scripts': { const m = await import('./scripts-page.js?v=e67b220b'); return m.scriptsPage(D); }
      case 'leaderboard': return await leaderboardPage();
      case 'club': return clubPage();
      case 'admin': if (me && me.owner) { location.hash = '#/owner'; return; } return await adminPage();
      case 'settings': return settingsPage();
      case 'owner': return await ownerPage();
      case 'hacker': if (me && me.owner) { try { if (!hackMod) hackMod = await import('./hacker.js?v=bbfe7e93'); hackMod.openHackerPanel({ api, toast, me }); } catch {} } history.replaceState(null, '', '#/home'); return await homePage(); // phone alt to typing "hack" (unlinked; non-owners land on home)

      case 'moderation': return await moderationPage();
      case 'funtix': case 'funbux': return funtixPage();
      case 'horror': { const m = await import('./horror.js?v=HORROR_SHA'); return m.horrorPage(horrorDeps); }
      case 'addons': return await addonsPage();
      default: return await homePage();
    }
  } catch (e) {
    if (!token) return;
    mount('', `<div class="error-page"><h1>Oops!</h1><p>${esc(e.message)}</p><a class="btn-primary" href="#/home">Go Home</a></div>`);
  }
}
addEventListener('hashchange', () => { route(); maybeSpooky(); });


loadBadgeDefs();
async function refreshNotif() {
  if (!token || !me) return;
  try {
    const n = await api('GET', '/api/notifications');
    const b = document.querySelector('.tb-bell-n');
    if (b) { b.textContent = n.unread > 99 ? '99+' : n.unread; b.classList.toggle('hidden', !n.unread); }
  } catch {}
}
setInterval(async () => {
  if (!token || !me) return;
  try { const r = await api('POST', '/api/ping'); setMoney(r); dailyToast(r); if (r.requests !== me.requests.length) { me = await api('GET', '/api/me'); } } catch {}
  refreshNotif();
}, 20000);
refreshNotif();

// ---------- IKNOW GLITCH MODE ----------
if (location.pathname.startsWith('/iknow')) {
  window.__iknowTimers = [];
  const gs = document.createElement('style');
  gs.textContent = `
  @keyframes gshake { 0%{transform:translate(0)} 20%{transform:translate(-4px,3px) skewX(2deg)} 40%{transform:translate(5px,-2px)} 60%{transform:translate(-3px,-4px) skewX(-3deg)} 80%{transform:translate(4px,2px)} 100%{transform:translate(0)} }
  @keyframes grgb { 0%,100%{text-shadow:2px 0 #f0f,-2px 0 #0ff} 25%{text-shadow:-3px 0 #f0f,3px 0 #0ff} 50%{text-shadow:1px 2px #f0f,-1px -2px #0ff} 75%{text-shadow:-2px -1px #f0f,2px 1px #0ff} }
  @keyframes ghue { 0%,100%{filter:hue-rotate(0)} 50%{filter:hue-rotate(180deg)} }
  @keyframes gflick { 0%,100%{opacity:1} 92%{opacity:1} 93%{opacity:.3} 94%{opacity:1} 97%{opacity:.6} 98%{opacity:1} }
  @keyframes gslice { 0%,100%{clip-path:inset(0 0 0 0)} 10%{clip-path:inset(20% 0 60% 0)} 20%{clip-path:inset(0 0 0 0)} 35%{clip-path:inset(60% 0 10% 0)} 50%{clip-path:inset(0 0 0 0)} 70%{clip-path:inset(10% 0 70% 0)} 85%{clip-path:inset(0 0 0 0)} }
  body.glitching #app { animation: gshake .25s infinite, gflick 3s infinite; }
  body.glitching h1, body.glitching h2, body.glitching h3, body.glitching p, body.glitching a, body.glitching button, body.glitching span { animation: grgb .4s infinite !important; }
  body.glitching img, body.glitching canvas { animation: ghue 2s infinite, gslice 1.5s infinite !important; }
  body.glitching::after { content:''; position:fixed; inset:0; pointer-events:none; z-index:99999;
    background:repeating-linear-gradient(0deg, rgba(0,0,0,.15) 0 1px, transparent 1px 3px); mix-blend-mode:overlay; }
  body.glitching::before { content:'I KNOW'; position:fixed; top:40%; left:50%; transform:translate(-50%,-50%) rotate(-8deg);
    font-size:15vw; font-weight:900; color:#f0f; z-index:100000; pointer-events:none; opacity:.12;
    text-shadow:4px 0 #0ff, -4px 0 #ff0; animation:gflick .8s infinite; }`;
  document.head.appendChild(gs);
  document.body.classList.add('glitching');
  // Flashing TV static overlay
  const sc = document.createElement('canvas');
  sc.id = 'iknow-static';
  sc.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:99998;pointer-events:none;opacity:0;mix-blend-mode:screen';
  document.body.appendChild(sc);
  const sctx = sc.getContext('2d');
  sc.width = 160; sc.height = 90;
  const sdata = sctx.createImageData(160, 90);
  function drawStatic() {
    const d = sdata.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.random() * 255 | 0;
      d[i] = v; d[i+1] = v; d[i+2] = v; d[i+3] = 255;
    }
    sctx.putImageData(sdata, 0, 0);
  }
  drawStatic();
  (function staticLoop() {
    if (window.__iknowDead) return;
    drawStatic();
    const r = Math.random();
    sc.style.opacity = r < .12 ? (.5 + Math.random() * .5) : r < .4 ? (Math.random() * .25) : 0;
    window.__iknowTimers.push(setTimeout(staticLoop, 60 + Math.random() * 120));
  })();
  const glyphs = '█▓▒░<>/\\|#@$%&?!01';
  window.__iknowTimers.push(setInterval(() => {
    const els = document.querySelectorAll('#app p, #app span, #app a, #app h1, #app h2, #app h3, #app button');
    for (let i = 0; i < 6 && els.length; i++) {
      const el = els[Math.floor(Math.random() * els.length)];
      if (el.children.length || !el.textContent.trim()) continue;
      const t = el.textContent;
      const idx = Math.floor(Math.random() * t.length);
      el.textContent = t.slice(0, idx) + glyphs[Math.floor(Math.random() * glyphs.length)] + t.slice(idx + 1);
    }
    if (Math.random() < .3 && els.length) {
      const el = els[Math.floor(Math.random() * els.length)];
      el.style.transform = `translate(${(Math.random() - .5) * 30}px, ${(Math.random() - .5) * 30}px)`;
      setTimeout(() => el.style.transform = '', 180);
    }
  }, 400));
  console.log('%cI KNOW', 'font-size:60px;color:#f0f;text-shadow:3px 0 #0ff');
  // After 5 seconds... it takes you somewhere else
  window.__iknowTimers.push(setTimeout(() => {
    if (location.pathname.startsWith('/iknow')) location.hash = '#/horror';
  }, 5000));
}

route(); maybeSpooky();
