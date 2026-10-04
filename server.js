import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { templates } from './public/js/worlds.js';
import { ITEM, CATALOG, DEFAULT_AVATAR, ECON, BADGES } from './public/js/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const ADMINS = (process.env.FF_ADMINS || 'fun').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const DB_FILE = path.join(DATA_DIR, 'db.json');
const PORT = process.env.PORT || 3000;

// ---------- persistence ----------
let db;
function seed() {
  const now = Date.now();
  const g = (id, name, creator, desc, tpl, visits, likes, dislikes, maxPlayers = 30) =>
    ({ id, name, creator, description: desc, world: templates[tpl](), visits: 0, likes: 0, dislikes: 0, maxPlayers, created: now, updated: now, thumbnail: null });
  const games = [
    g('g1', 'Mega Fun Obby', 'FriendFun', 'Jump, dodge and bounce through 10 stages of obstacles! Touch the blue checkpoints to save your progress. Reach the golden platform to win!', 'obby', 1543210, 8912, 412),
    g('g2', 'Hangout Town', 'FriendFun', 'Chill with friends in a little town. Explore houses, sit on benches, collect coins and chat with everyone.', 'hangout', 987654, 5321, 210),
    g('g3', 'Sky Tower Climb', 'FriendFun', 'Climb the spiral around the giant tower. Don\'t touch the red bricks! Can you reach the top?', 'tower', 654321, 4210, 380),
    g('g4', 'Coin Rush Islands', 'FriendFun', 'Hop between floating islands and grab every coin. Every coin = 1 FunTix!', 'coinRush', 432100, 3999, 155),
    g('g5', 'Classic Baseplate', 'FriendFun', 'The classic. A big grey baseplate. Hang out and do whatever you want.', 'baseplate', 210987, 1500, 90),
  ];
  return { users: {}, sessions: {}, games: Object.fromEntries(games.map(x => [x.id, x])), nextGame: 6 };
}
function load() {
  try { db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')); }
  catch { db = seed(); save(true); }
  if (!db.statsReset) {
    for (const g of Object.values(db.games)) { g.visits = 0; g.likes = 0; g.dislikes = 0; g.votes = {}; }
    db.statsReset = true; save();
  }
  const free = CATALOG.filter(i => i.free).map(i => i.id);
  for (const u of Object.values(db.users)) {
    u.funtix ??= ECON.START_TIX; delete u.funbux;
    for (const id of free) if (!u.inventory.includes(id)) u.inventory.push(id);
    u.avatar.head ??= DEFAULT_AVATAR.head;
    if (isClub(u)) for (const it of CATALOG) if (it.club && !u.inventory.includes(it.id)) u.inventory.push(it.id);
  }
}
let saveTimer = null;
function save(now = false) {
  const write = () => { fs.mkdirSync(DATA_DIR, { recursive: true }); fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); saveTimer = null; };
  if (now) return write();
  if (!saveTimer) saveTimer = setTimeout(write, 500);
}
load();

const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const key = n => n.toLowerCase();

// ---------- presence ----------
const presence = new Map(); // username key -> { gameId|null, lastSeen }
function touch(name, gameId) {
  const p = presence.get(key(name)) || {};
  presence.set(key(name), { gameId: gameId === undefined ? (p.gameId ?? null) : gameId, lastSeen: Date.now() });
}
function statusOf(name) {
  const p = presence.get(key(name));
  if (!p || Date.now() - p.lastSeen > 60000) return { online: false };
  if (p.gameId && db.games[p.gameId]) return { online: true, gameId: p.gameId, gameName: db.games[p.gameId].name };
  return { online: true };
}

// ---------- helpers ----------
function isAdmin(u) { return ADMINS.includes(u.name.toLowerCase()); }
function isClub(u) { return isAdmin(u) || !!u.clubForever || (u.clubUntil || 0) > Date.now(); }
function badgesOf(u) {
  const has = {
    admin: isAdmin(u), club: isClub(u), champ: !!u.champ,
    creator: Object.values(db.games).some(g => !g.unpublished && key(g.creator) === key(u.name)),
  };
  return Object.keys(BADGES).filter(b => has[b]);
}
function badgeOf(u) {
  if (u.badge === 'none') return null;
  const list = badgesOf(u);
  return list.includes(u.badge) ? u.badge : list[0] || null;
}
function publicUser(u) {
  return { name: u.name, club: isClub(u), admin: isAdmin(u), badges: badgesOf(u), badge: badgeOf(u), avatar: u.avatar, created: u.created, bio: u.bio || '', friends: u.friends.length, ...statusOf(u.name) };
}
function gameSummary(g) {
  return { id: g.id, name: g.name, creator: g.creator, visits: g.visits, likes: g.likes, dislikes: g.dislikes, playing: rooms.get(g.id)?.players.size || 0, thumbnail: g.thumbnail, updated: g.updated, sky: g.world.sky };
}
const BAD = ['damn', 'hell', 'stupid', 'idiot', 'dumb', 'crap', 'shut up', 'loser'];
function filter(text) {
  let t = String(text).slice(0, 200);
  for (const w of BAD) t = t.replace(new RegExp('\\b' + w + '\\b', 'gi'), m => '#'.repeat(m.length));
  return t;
}

// ---------- http ----------
const app = express();
app.use(express.json({ limit: '8mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three')));

function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const name = db.sessions[tok];
  if (!name || !db.users[name]) return res.status(401).json({ error: 'Not logged in' });
  req.user = db.users[name];
  touch(req.user.name);
  next();
}

app.post('/api/signup', (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username || '')) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (db.users[key(username)]) return res.status(400).json({ error: 'That username is taken' });
  const salt = crypto.randomBytes(8).toString('hex');
  db.users[key(username)] = {
    name: username, salt, pw: hash(password, salt), created: Date.now(), funtix: ECON.START_TIX,
    avatar: structuredClone(DEFAULT_AVATAR), inventory: CATALOG.filter(i => i.free).map(i => i.id),
    friends: [], requests: [], favorites: [], recent: [], bio: '',
  };
  const tok = crypto.randomBytes(24).toString('hex');
  db.sessions[tok] = key(username); save();
  res.json({ token: tok });
});
app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const u = db.users[key(username || '')];
  if (!u || hash(password || '', u.salt) !== u.pw) return res.status(400).json({ error: 'Incorrect username or password' });
  const tok = crypto.randomBytes(24).toString('hex');
  db.sessions[tok] = key(username); save();
  res.json({ token: tok });
});
app.post('/api/logout', auth, (req, res) => {
  delete db.sessions[(req.headers.authorization || '').replace('Bearer ', '')]; save(); res.json({ ok: true });
});
function dailyTix(u) {
  const day = new Date().toISOString().slice(0, 10);
  if (u.tixDay === day) return 0;
  const amt = ECON.DAILY_TIX + (isClub(u) ? ECON.CLUB_DAILY : 0);
  u.tixDay = day; u.funtix += amt; save();
  return amt;
}
const money = u => ({ funtix: u.funtix });
app.get('/api/me', auth, (req, res) => {
  const u = req.user;
  if (isClub(u)) { const miss = CATALOG.filter(it => it.club && !u.inventory.includes(it.id)); if (miss.length) { u.inventory.push(...miss.map(it => it.id)); save(); } }
  const daily = dailyTix(u);
  res.json({ ...publicUser(u), daily, funtix: u.funtix, inventory: u.inventory, requests: u.requests, friendList: u.friends, favorites: u.favorites, recent: u.recent, clubUntil: u.clubUntil || 0, clubForever: isAdmin(u) || !!u.clubForever });
});
app.post('/api/ping', auth, (req, res) => { touch(req.user.name, null); res.json({ ...money(req.user), daily: dailyTix(req.user), requests: req.user.requests.length }); });

app.put('/api/me/avatar', auth, (req, res) => {
  const a = req.body || {};
  const hex = /^#[0-9a-fA-F]{6}$/;
  const colors = {};
  for (const k of Object.keys(DEFAULT_AVATAR.colors)) colors[k] = hex.test(a.colors?.[k]) ? a.colors[k] : req.user.avatar.colors[k];
  const pick = (slot) => (a[slot] && req.user.inventory.includes(a[slot]) && ITEM[a[slot]]?.type === slot) ? a[slot] : req.user.avatar[slot];
  req.user.avatar = { colors, hat: pick('hat'), face: pick('face'), shirt: pick('shirt'), head: pick('head') || DEFAULT_AVATAR.head };
  save(); res.json(req.user.avatar);
});
app.put('/api/me/badge', auth, (req, res) => {
  const b = String(req.body?.badge || '');
  if (b !== 'none' && !badgesOf(req.user).includes(b)) return res.status(400).json({ error: "You don't have that badge" });
  req.user.badge = b; save(); res.json({ badge: badgeOf(req.user) });
});
app.put('/api/me/bio', auth, (req, res) => { req.user.bio = filter(req.body?.bio || '').slice(0, 300); save(); res.json({ ok: true }); });
app.post('/api/buy/:item', auth, (req, res) => {
  const it = ITEM[req.params.item];
  if (!it) return res.status(404).json({ error: 'No such item' });
  if (req.user.inventory.includes(it.id)) return res.status(400).json({ error: 'You already own this' });
  if (it.club && !isClub(req.user)) return res.status(403).json({ error: 'FriendClub members only' });
  const price = it.free ? 0 : it.price;
  if (req.user.funtix < price) return res.status(400).json({ error: 'Not enough FunTix' });
  req.user.funtix -= price; req.user.inventory.push(it.id); save();
  res.json({ ...money(req.user), inventory: req.user.inventory });
});

app.post('/api/club/join', auth, (req, res) => {
  const u = req.user;
  if (isAdmin(u) || u.clubForever) return res.status(400).json({ error: 'You already have free FriendClub' });
  if (u.funtix < ECON.CLUB_PRICE) return res.status(400).json({ error: 'Not enough FunTix' });
  u.funtix -= ECON.CLUB_PRICE;
  u.clubUntil = Math.max(Date.now(), u.clubUntil || 0) + ECON.CLUB_DAYS * 86400000;
  for (const it of CATALOG) if (it.club && !u.inventory.includes(it.id)) u.inventory.push(it.id);
  save();
  res.json({ ...money(u), club: true, clubUntil: u.clubUntil, inventory: u.inventory });
});

app.get('/api/leaderboard', auth, (req, res) => {
  const all = Object.values(db.users).sort((a, b) => b.funtix - a.funtix || a.created - b.created);
  res.json({
    top: all.slice(0, 50).map(u => ({ name: u.name, avatar: u.avatar, funtix: u.funtix, club: isClub(u), badge: badgeOf(u), ...statusOf(u.name) })),
    rank: all.indexOf(req.user) + 1, total: all.length, funtix: req.user.funtix,
  });
});
app.get('/api/users/:name', auth, (req, res) => {
  const u = db.users[key(req.params.name)];
  if (!u) return res.status(404).json({ error: 'User not found' });
  const games = Object.values(db.games).filter(g => key(g.creator) === key(u.name)).map(gameSummary);
  const friends = u.friends.map(f => db.users[f]).filter(Boolean).map(publicUser);
  res.json({ ...publicUser(u), games, friendsList: friends, isFriend: req.user.friends.includes(key(u.name)), requested: u.requests.includes(key(req.user.name)) });
});
app.get('/api/search/users', auth, (req, res) => {
  const q = key(String(req.query.q || ''));
  res.json(Object.values(db.users).filter(u => key(u.name).includes(q)).slice(0, 30).map(publicUser));
});
function adminOnly(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admins only' });
  next();
}
const adminUser = u => ({ ...publicUser(u), clubForever: isAdmin(u) || !!u.clubForever, clubUntil: u.clubUntil || 0, funtix: u.funtix });
app.get('/api/admin/users', auth, adminOnly, (req, res) => {
  const q = key(String(req.query.q || ''));
  res.json(Object.values(db.users).filter(u => key(u.name).includes(q)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, 100).map(adminUser));
});
app.post('/api/admin/club/:name', auth, adminOnly, (req, res) => {
  const u = db.users[key(req.params.name)];
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (isAdmin(u)) return res.status(400).json({ error: 'Admins always have FriendClub' });
  if (req.body?.on) {
    u.clubForever = true;
    for (const it of CATALOG) if (it.club && !u.inventory.includes(it.id)) u.inventory.push(it.id);
  } else { u.clubForever = false; u.clubUntil = 0; }
  save(); res.json(adminUser(u));
});
app.get('/api/friends', auth, (req, res) => {
  res.json({
    friends: req.user.friends.map(f => db.users[f]).filter(Boolean).map(publicUser),
    requests: req.user.requests.map(f => db.users[f]).filter(Boolean).map(publicUser),
  });
});
app.post('/api/friends/:name', auth, (req, res) => {
  const other = db.users[key(req.params.name)], me = req.user, mk = key(me.name);
  if (!other || other === me) return res.status(400).json({ error: 'Invalid user' });
  const ok = key(other.name);
  if (me.friends.includes(ok)) return res.json({ status: 'friends' });
  if (me.requests.includes(ok)) { // accept
    me.requests = me.requests.filter(x => x !== ok);
    me.friends.push(ok); other.friends.push(mk); save();
    return res.json({ status: 'friends' });
  }
  if (!other.requests.includes(mk)) other.requests.push(mk);
  save(); res.json({ status: 'requested' });
});
app.delete('/api/friends/:name', auth, (req, res) => {
  const other = db.users[key(req.params.name)], me = req.user;
  if (!other) return res.status(404).json({ error: 'User not found' });
  const ok = key(other.name), mk = key(me.name);
  me.friends = me.friends.filter(x => x !== ok); other.friends = other.friends.filter(x => x !== mk);
  me.requests = me.requests.filter(x => x !== ok); save();
  res.json({ ok: true });
});

app.get('/api/games', auth, (req, res) => {
  const q = key(String(req.query.q || ''));
  let list = Object.values(db.games).filter(g => !g.unpublished && (!q || key(g.name).includes(q) || key(g.creator).includes(q))).map(gameSummary);
  list.sort((a, b) => (b.playing - a.playing) || (b.visits - a.visits));
  res.json(list);
});
app.get('/api/mygames', auth, (req, res) => {
  res.json(Object.values(db.games).filter(g => key(g.creator) === key(req.user.name)).map(g => ({ ...gameSummary(g), unpublished: !!g.unpublished })));
});
app.get('/api/games/:id', auth, (req, res) => {
  const g = db.games[req.params.id];
  if (!g) return res.status(404).json({ error: 'Game not found' });
  const vote = g.votes?.[key(req.user.name)] || 0;
  res.json({ ...gameSummary(g), description: g.description, maxPlayers: g.maxPlayers, created: g.created, world: g.world, unpublished: !!g.unpublished, vote, favorited: req.user.favorites.includes(g.id), favorites: g.favoriteCount || 0 });
});
app.post('/api/games', auth, (req, res) => {
  const { name, description, world, thumbnail, publish } = req.body || {};
  const id = 'g' + db.nextGame++;
  db.games[id] = { id, name: filter(name || 'Untitled Game').slice(0, 50), creator: req.user.name, description: filter(description || '').slice(0, 1000), world: sanitizeWorld(world), visits: 0, likes: 0, dislikes: 0, maxPlayers: 30, created: Date.now(), updated: Date.now(), thumbnail: validThumb(thumbnail), unpublished: !publish };
  save(); res.json({ id });
});
app.put('/api/games/:id', auth, (req, res) => {
  const g = db.games[req.params.id];
  if (!g) return res.status(404).json({ error: 'Game not found' });
  if (key(g.creator) !== key(req.user.name)) return res.status(403).json({ error: 'Not your game' });
  const { name, description, world, thumbnail, publish } = req.body || {};
  if (name !== undefined) g.name = filter(name).slice(0, 50) || 'Untitled Game';
  if (description !== undefined) g.description = filter(description).slice(0, 1000);
  if (world) g.world = sanitizeWorld(world);
  if (thumbnail) g.thumbnail = validThumb(thumbnail);
  if (publish !== undefined) g.unpublished = !publish;
  g.updated = Date.now(); save(); res.json({ ok: true });
});
app.delete('/api/games/:id', auth, (req, res) => {
  const g = db.games[req.params.id];
  if (!g || key(g.creator) !== key(req.user.name)) return res.status(403).json({ error: 'Not your game' });
  delete db.games[req.params.id]; save(); res.json({ ok: true });
});
app.post('/api/games/:id/vote', auth, (req, res) => {
  const g = db.games[req.params.id];
  if (!g) return res.status(404).json({ error: 'Game not found' });
  g.votes ||= {};
  const k = key(req.user.name), old = g.votes[k] || 0, v = Math.sign(Number(req.body?.vote) || 0);
  const nv = old === v ? 0 : v;
  if (old === 1) g.likes--; if (old === -1) g.dislikes--;
  if (nv === 1) g.likes++; if (nv === -1) g.dislikes++;
  g.votes[k] = nv; save();
  res.json({ likes: g.likes, dislikes: g.dislikes, vote: nv });
});
app.post('/api/games/:id/favorite', auth, (req, res) => {
  const g = db.games[req.params.id];
  if (!g) return res.status(404).json({ error: 'Game not found' });
  const f = req.user.favorites;
  if (f.includes(g.id)) { req.user.favorites = f.filter(x => x !== g.id); g.favoriteCount = Math.max(0, (g.favoriteCount || 0) - 1); }
  else { f.push(g.id); g.favoriteCount = (g.favoriteCount || 0) + 1; }
  save(); res.json({ favorited: req.user.favorites.includes(g.id), favorites: g.favoriteCount });
});
app.post('/api/games/:id/thumbnail', auth, (req, res) => {
  const g = db.games[req.params.id];
  if (!g) return res.status(404).json({ error: 'Game not found' });
  if (!g.thumbnail || key(g.creator) === key(req.user.name)) { g.thumbnail = validThumb(req.body?.thumbnail); save(); }
  res.json({ ok: true });
});

function validThumb(t) { return typeof t === 'string' && t.startsWith('data:image/') && t.length < 600000 ? t : null; }
function sanitizeWorld(w) {
  const num = v => (Number.isFinite(+v) ? +v : 0);
  const parts = (Array.isArray(w?.parts) ? w.parts : []).slice(0, 5000).map((p, i) => ({
    id: String(p.id || 'p' + i).slice(0, 20), name: String(p.name || 'Part').slice(0, 40),
    p: [0, 1, 2].map(j => num(p.p?.[j])), s: [0, 1, 2].map(j => Math.max(0.05, Math.min(2048, num(p.s?.[j]) || 1))),
    c: /^(#[0-9a-fA-F]{6}|hsl\(\d+,\d+%,\d+%\))$/.test(p.c) ? p.c : '#a3a2a5',
    k: ['part', 'spawn', 'kill', 'checkpoint', 'win', 'bounce', 'coin', 'speed'].includes(p.k) ? p.k : 'part',
    m: ['plastic', 'neon', 'grass', 'wood', 'brick', 'glass', 'concrete', 'sand', 'baseplate', 'spawn', 'metal'].includes(p.m) ? p.m : 'plastic',
    ...(p.cc === false ? { cc: false } : {}), ...(p.tr ? { tr: Math.max(0, Math.min(1, num(p.tr))) } : {}),
  }));
  return { sky: /^#[0-9a-fA-F]{6}$/.test(w?.sky) ? w.sky : '#8fc8ff', parts };
}

app.get('/api/catalog', (req, res) => res.json(CATALOG));

// ---------- realtime ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const rooms = new Map(); // gameId -> { players: Map<id, player> }
let nextPid = 1;

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, except) { const s = JSON.stringify(msg); for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(s); }

wss.on('connection', (ws) => {
  let player = null, room = null;
  ws.on('message', (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join' && !player) {
      const uname = db.sessions[m.token], u = db.users[uname], g = db.games[m.gameId];
      if (!u || !g) return send(ws, { t: 'error', error: 'Could not join' });
      if (!rooms.has(g.id)) rooms.set(g.id, { players: new Map() });
      room = rooms.get(g.id);
      if (room.players.size >= g.maxPlayers) return send(ws, { t: 'error', error: 'Server is full' });
      // kick duplicate sessions of the same user in this room
      for (const p of room.players.values()) if (p.user === u) { send(p.ws, { t: 'error', error: 'You joined from another window' }); p.ws.close(); }
      player = { id: nextPid++, gameId: g.id, ws, user: u, name: u.name, avatar: u.avatar, s: null, coins: new Set(), lastCoin: 0, lastTix: Date.now() };
      g.visits++; u.recent = [g.id, ...u.recent.filter(x => x !== g.id)].slice(0, 12); save();
      touch(u.name, g.id);
      send(ws, { t: 'welcome', id: player.id, players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, s: p.s, club: isClub(p.user), badge: badgeOf(p.user) })), ...money(u), club: isClub(u), badge: badgeOf(u) });
      room.players.set(player.id, player);
      broadcast(room, { t: 'joined', id: player.id, name: player.name, avatar: player.avatar, club: isClub(u), badge: badgeOf(u) }, ws);
      broadcast(room, { t: 'chat', system: true, text: `${player.name} has joined the game.` });
      return;
    }
    if (!player) return;
    if (m.t === 's' && Array.isArray(m.s)) { player.s = m.s.slice(0, 6).map(Number); touch(player.name, player.gameId);
      const now = Date.now();
      if (now - player.lastTix >= ECON.PLAY_TIX_EVERY) {
        const amt = ECON.PLAY_TIX * (isClub(player.user) ? ECON.CLUB_PLAY_MULT : 1);
        player.lastTix = now; player.user.funtix += amt; save();
        send(ws, { t: 'money', ...money(player.user), reason: 'play', amount: amt });
      }
    }
    else if (m.t === 'chat' && typeof m.text === 'string' && m.text.trim()) {
      const text = filter(m.text.trim());
      broadcast(room, { t: 'chat', id: player.id, name: player.name, text, club: isClub(player.user), badge: badgeOf(player.user) });
    }
    else if (m.t === 'coin' && typeof m.part === 'string') {
      const now = Date.now();
      if (player.coins.has(m.part) || now - player.lastCoin < 150) return;
      player.coins.add(m.part); player.lastCoin = now;
      player.user.funtix += ECON.COIN_TIX; save();
      send(ws, { t: 'money', ...money(player.user) });
    }
    else if (m.t === 'win') {
      if (player.won) return; player.won = true;
      player.user.funtix += ECON.WIN_TIX; player.user.champ = true; save();
      send(ws, { t: 'money', ...money(player.user) });
      broadcast(room, { t: 'chat', system: true, text: `${player.name} beat the game! (+${ECON.WIN_TIX} FunTix)` });
    }
    else if (m.t === 'emote') broadcast(room, { t: 'emote', id: player.id, e: String(m.e).slice(0, 10) }, ws);
  });
  ws.on('close', () => {
    if (!player || !room) return;
    room.players.delete(player.id);
    broadcast(room, { t: 'left', id: player.id });
    broadcast(room, { t: 'chat', system: true, text: `${player.name} has left the game.` });
    touch(player.name, null);
  });
});

setInterval(() => {
  for (const room of rooms.values()) {
    if (!room.players.size) continue;
    const states = [];
    for (const p of room.players.values()) if (p.s) states.push([p.id, ...p.s]);
    broadcast(room, { t: 'S', p: states });
  }
}, 66);

server.listen(PORT, () => console.log(`FriendFun running on http://localhost:${PORT}`));
