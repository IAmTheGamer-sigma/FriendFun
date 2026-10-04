import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import mongoose from 'mongoose';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { templates } from './public/js/worlds.js';
import { ITEM, CATALOG, DEFAULT_AVATAR, ECON, BADGES } from './public/js/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMINS = (process.env.FF_ADMINS || 'fun').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI;

// ---------- database schemas ----------
const UserSchema = new mongoose.Schema({
  name: { type: String, unique: true, lowercase: true, required: true },
  salt: String,
  pw: String,
  created: { type: Number, default: Date.now },
  funtix: { type: Number, default: ECON.START_TIX },
  avatar: { type: Object, default: DEFAULT_AVATAR },
  inventory: [String],
  friends: [String],
  requests: [String],
  favorites: [String],
  recent: [String],
  bio: { type: String, default: '' },
  clubUntil: { type: Number, default: 0 },
  clubForever: { type: Boolean, default: false },
  champ: { type: Boolean, default: false },
  tixDay: String,
  badge: { type: String, default: 'none' }
});

const GameSchema = new mongoose.Schema({
  id: { type: String, unique: true },
  name: String,
  creator: String,
  description: String,
  world: Object,
  visits: { type: Number, default: 0 },
  likes: { type: Number, default: 0 },
  dislikes: { type: Number, default: 0 },
  maxPlayers: { type: Number, default: 30 },
  created: { type: Number, default: Date.now },
  updated: { type: Number, default: Date.now },
  thumbnail: String,
  unpublished: { type: Boolean, default: false },
  votes: { type: Map, of: Number, default: {} }
});

const SessionSchema = new mongoose.Schema({
  token: { type: String, unique: true },
  username: String,
  expires: { type: Date, default: () => Date.now() + 7 * 24 * 60 * 60 * 1000 }
});

const User = mongoose.model('User', UserSchema);
const Game = mongoose.model('Game', GameSchema);
const Session = mongoose.model('Session', SessionSchema);

// ---------- connection ----------
if (!MONGODB_URI) {
  console.error('ERROR: MONGODB_URI environment variable is not set!');
} else {
  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch(err => console.error('MongoDB connection error:', err));
}

async function seed() {
  const now = Date.now();
  const g = (id, name, creator, desc, tpl, visits, likes, dislikes, maxPlayers = 30) =>
    ({ id, name, creator, description: desc, world: templates[tpl](), visits, likes, dislikes, maxPlayers, created: now, updated: now, thumbnail: null });
  
  const games = [
    g('g1', 'Mega Fun Obby', 'FriendFun', 'Jump, dodge and bounce through 10 stages of obstacles!', 'obby', 1543210, 8912, 412),
    g('g2', 'Hangout Town', 'FriendFun', 'Chill with friends in a little town.', 'hangout', 987654, 5321, 210),
    g('g3', 'Sky Tower Climb', 'FriendFun', 'Climb the spiral around the giant tower.', 'tower', 654321, 4210, 380),
    g('g4', 'Coin Rush Islands', 'FriendFun', 'Hop between floating islands and grab every coin!', 'coinRush', 432100, 3999, 155),
    g('g5', 'Classic Baseplate', 'FriendFun', 'The classic. A big grey baseplate.', 'baseplate', 210987, 1500, 90),
  ];
  
  for (const game of games) {
    await Game.updateOne({ id: game.id }, { $set: game }, { upsert: true });
  }
}

seed().catch(console.error);

const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const key = n => n.toLowerCase();

// ---------- presence ----------
const presence = new Map();
function touch(name, gameId) {
  const p = presence.get(key(name)) || {};
  presence.set(key(name), { gameId: gameId === undefined ? (p.gameId ?? null) : gameId, lastSeen: Date.now() });
}
async function statusOf(name) {
  const p = presence.get(key(name));
  if (!p || Date.now() - p.lastSeen > 60000) return { online: false };
  if (p.gameId) {
    const g = await Game.findOne({ id: p.gameId });
    if (g) return { online: true, gameId: p.gameId, gameName: g.name };
  }
  return { online: true };
}

// ---------- helpers ----------
function isAdmin(u) { return ADMINS.includes(u.name.toLowerCase()); }
function isClub(u) { return isAdmin(u) || !!u.clubForever || (u.clubUntil || 0) > Date.now(); }
function badgesOf(u) {
  const has = {
    admin: isAdmin(u), club: isClub(u), champ: !!u.champ,
    creator: false,
  };
  return Object.keys(BADGES).filter(b => has[b]);
}
function badgeOf(u) {
  if (u.badge === 'none') return null;
  const list = badgesOf(u);
  return list.includes(u.badge) ? u.badge : list[0] || null;
}
async function publicUser(u) {
  const isCreator = await Game.exists({ creator: key(u.name), unpublished: false });
  const has = {
    admin: isAdmin(u), club: isClub(u), champ: !!u.champ,
    creator: !!isCreator,
  };
  const badges = Object.keys(BADGES).filter(b => has[b]);
  const badge = u.badge === 'none' ? null : (badges.includes(u.badge) ? u.badge : badges[0] || null);
  
  return { 
    name: u.name, club: isClub(u), admin: isAdmin(u), badges, badge, 
    avatar: u.avatar, created: u.created, bio: u.bio || '', friends: u.friends.length, 
    ...(await statusOf(u.name)) 
  };
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
app.get('/health', (req, res) => res.json({ ok: true }));

async function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const session = await Session.findOne({ token: tok });
  if (!session) return res.status(401).json({ error: 'Not logged in' });
  const user = await User.findOne({ name: session.username });
  if (!user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  touch(req.user.name);
  next();
}

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username || '')) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  if (await User.exists({ name: key(username) })) return res.status(400).json({ error: 'That username is taken' });
  
  const salt = crypto.randomBytes(8).toString('hex');
  const user = await User.create({
    name: key(username), salt, pw: hash(password, salt), created: Date.now(), funtix: ECON.START_TIX,
    avatar: structuredClone(DEFAULT_AVATAR), inventory: CATALOG.filter(i => i.free).map(i => i.id),
    friends: [], requests: [], favorites: [], recent: [], bio: '',
  });
  
  const tok = crypto.randomBytes(24).toString('hex');
  await Session.create({ token: tok, username: user.name });
  res.json({ token: tok });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const u = await User.findOne({ name: key(username || '') });
  if (!u || hash(password || '', u.salt) !== u.pw) return res.status(400).json({ error: 'Incorrect username or password' });
  
  const tok = crypto.randomBytes(24).toString('hex');
  await Session.create({ token: tok, username: u.name });
  res.json({ token: tok });
});

app.post('/api/logout', auth, async (req, res) => {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  await Session.deleteOne({ token: tok });
  res.json({ ok: true });
});

async function dailyTix(u) {
  const day = new Date().toISOString().slice(0, 10);
  if (u.tixDay === day) return 0;
  const amt = ECON.DAILY_TIX + (isClub(u) ? ECON.CLUB_DAILY : 0);
  u.tixDay = day; 
  u.funtix += amt; 
  await u.save();
  return amt;
}

app.get('/api/me', auth, async (req, res) => {
  const u = req.user;
  if (isClub(u)) { 
    const miss = CATALOG.filter(it => it.club && !u.inventory.includes(it.id)); 
    if (miss.length) { u.inventory.push(...miss.map(it => it.id)); await u.save(); } 
  }
  const daily = await dailyTix(u);
  res.json({ ...await publicUser(u), daily, funtix: u.funtix, inventory: u.inventory, requests: u.requests, friendList: u.friends, favorites: u.favorites, recent: u.recent, clubUntil: u.clubUntil || 0, clubForever: isAdmin(u) || !!u.clubForever });
});

app.post('/api/ping', auth, async (req, res) => { 
  touch(req.user.name, null); 
  res.json({ funtix: req.user.funtix, daily: await dailyTix(req.user), requests: req.user.requests.length }); 
});

app.put('/api/me/avatar', auth, async (req, res) => {
  const a = req.body || {};
  const hex = /^#[0-9a-fA-F]{6}$/;
  const colors = {};
  for (const k of Object.keys(DEFAULT_AVATAR.colors)) colors[k] = hex.test(a.colors?.[k]) ? a.colors[k] : req.user.avatar.colors[k];
  const pick = (slot) => (a[slot] && req.user.inventory.includes(a[slot]) && ITEM[a[slot]]?.type === slot) ? a[slot] : req.user.avatar[slot];
  req.user.avatar = { colors, hat: pick('hat'), face: pick('face'), shirt: pick('shirt'), head: pick('head') || DEFAULT_AVATAR.head };
  await req.user.save(); 
  res.json(req.user.avatar);
});

app.put('/api/me/badge', auth, async (req, res) => {
  const b = String(req.body?.badge || '');
  if (b !== 'none') {
    const isCreator = await Game.exists({ creator: key(req.user.name), unpublished: false });
    const has = { admin: isAdmin(req.user), club: isClub(req.user), champ: !!req.user.champ, creator: !!isCreator };
    const badges = Object.keys(BADGES).filter(badge => has[badge]);
    if (!badges.includes(b)) return res.status(400).json({ error: "You don't have that badge" });
  }
  req.user.badge = b; 
  await req.user.save(); 
  res.json({ badge: badgeOf(req.user) });
});

app.put('/api/me/bio', auth, async (req, res) => { 
  req.user.bio = filter(req.body?.bio || '').slice(0, 300); 
  await req.user.save(); 
  res.json({ ok: true }); 
});

app.post('/api/buy/:item', auth, async (req, res) => {
  const it = ITEM[req.params.item];
  if (!it) return res.status(404).json({ error: 'No such item' });
  if (req.user.inventory.includes(it.id)) return res.status(400).json({ error: 'You already own this' });
  if (it.club && !isClub(req.user)) return res.status(403).json({ error: 'FriendClub members only' });
  const price = it.free ? 0 : it.price;
  if (req.user.funtix < price) return res.status(400).json({ error: 'Not enough FunTix' });
  req.user.funtix -= price; req.user.inventory.push(it.id); 
  await req.user.save();
  res.json({ funtix: req.user.funtix, inventory: req.user.inventory });
});

app.post('/api/club/join', auth, async (req, res) => {
  const u = req.user;
  if (isAdmin(u) || u.clubForever) return res.status(400).json({ error: 'You already have free FriendClub' });
  if (u.funtix < ECON.CLUB_PRICE) return res.status(400).json({ error: 'Not enough FunTix' });
  u.funtix -= ECON.CLUB_PRICE;
  u.clubUntil = Math.max(Date.now(), u.clubUntil || 0) + ECON.CLUB_DAYS * 86400000;
  for (const it of CATALOG) if (it.club && !u.inventory.includes(it.id)) u.inventory.push(it.id);
  await u.save();
  res.json({ funtix: u.funtix, club: true, clubUntil: u.clubUntil, inventory: u.inventory });
});

app.get('/api/leaderboard', auth, async (req, res) => {
  const all = await User.find().sort({ funtix: -1, created: 1 });
  const userIndex = all.findIndex(u => u._id.equals(req.user._id));
  res.json({
    top: all.slice(0, 50).map(u => ({ 
      name: u.name, avatar: u.avatar, funtix: u.funtix, club: isClub(u), badge: badgeOf(u), 
      ...statusOf(u.name) 
    })),
    rank: userIndex + 1, total: all.length, funtix: req.user.funtix,
  });
});

app.get('/api/users/:name', auth, async (req, res) => {
  const u = await User.findOne({ name: key(req.params.name) });
  if (!u) return res.status(404).json({ error: 'User not found' });
  const games = await Game.find({ creator: key(u.name) }).then(list => list.map(gameSummary));
  const friends = await User.find({ name: { $in: u.friends } }).then(list => list.map(publicUser));
  res.json({ 
    ...await publicUser(u), games, friendsList: await Promise.all(friends), 
    isFriend: req.user.friends.includes(key(u.name)), requested: u.requests.includes(key(req.user.name)) 
  });
});

app.get('/api/search/users', auth, async (req, res) => {
  const q = key(String(req.query.q || ''));
  const users = await User.find({ name: { $regex: q, $options: 'i' } }).limit(30);
  res.json(await Promise.all(users.map(publicUser)));
});

function adminOnly(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admins only' });
  next();
}

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  const q = key(String(req.query.q || ''));
  const users = await User.find({ name: { $regex: q, $options: 'i' } }).sort({ name: 1 }).limit(100);
  res.json(await Promise.all(users.map(async u => ({ ...await publicUser(u), clubForever: isAdmin(u) || !!u.clubForever, clubUntil: u.clubUntil || 0, funtix: u.funtix }))));
});

app.post('/api/admin/club/:name', auth, adminOnly, async (req, res) => {
  const u = await User.findOne({ name: key(req.params.name) });
  if (!u) return res.status(404).json({ error: 'User not found' });
  if (isAdmin(u)) return res.status(400).json({ error: 'Admins always have FriendClub' });
  if (req.body?.on) {
    u.clubForever = true;
    for (const it of CATALOG) if (it.club && !u.inventory.includes(it.id)) u.inventory.push(it.id);
  } else { u.clubForever = false; u.clubUntil = 0; }
  await u.save(); 
  res.json({ ...await publicUser(u), clubForever: isAdmin(u) || !!u.clubForever, clubUntil: u.clubUntil || 0, funtix: u.funtix });
});

app.get('/api/friends', auth, async (req, res) => {
  const friends = await User.find({ name: { $in: req.user.friends } });
  const requests = await User.find({ name: { $in: req.user.requests } });
  res.json({
    friends: await Promise.all(friends.map(publicUser)),
    requests: await Promise.all(requests.map(publicUser)),
  });
});

app.post('/api/friends/:name', auth, async (req, res) => {
  const other = await User.findOne({ name: key(req.params.name) }), me = req.user, mk = key(me.name);
  if (!other || other === me) return res.status(400).json({ error: 'Invalid user' });
  const ok = other.name;
  if (me.friends.includes(ok)) return res.json({ status: 'friends' });
  if (me.requests.includes(ok)) {
    me.requests = me.requests.filter(x => x !== ok);
    me.friends.push(ok); other.friends.push(mk); 
    await Promise.all([me.save(), other.save()]);
    return res.json({ status: 'friends' });
  }
  if (!other.requests.includes(mk)) other.requests.push(mk);
  await other.save(); 
  res.json({ status: 'requested' });
});

app.delete('/api/friends/:name', auth, async (req, res) => {
  const other = await User.findOne({ name: key(req.params.name) }), me = req.user;
  if (!other) return res.status(404).json({ error: 'User not found' });
  const ok = other.name, mk = me.name;
  me.friends = me.friends.filter(x => x !== ok); 
  other.friends = other.friends.filter(x => x !== mk);
  me.requests = me.requests.filter(x => x !== ok); 
  await Promise.all([me.save(), other.save()]);
  res.json({ ok: true });
});

app.get('/api/games', auth, async (req, res) => {
  const q = key(String(req.query.q || ''));
  const filter = { unpublished: false };
  if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { creator: { $regex: q, $options: 'i' } }];
  
  const games = await Game.find(filter);
  const list = games.map(gameSummary);
  list.sort((a, b) => (b.playing - a.playing) || (b.visits - a.visits));
  res.json(list);
});

app.get('/api/mygames', auth, async (req, res) => {
  const games = await Game.find({ creator: key(req.user.name) });
  res.json(games.map(g => ({ ...gameSummary(g), unpublished: !!g.unpublished })));
});

app.get('/api/games/:id', auth, async (req, res) => {
  const g = await Game.findOne({ id: req.params.id });
  if (!g) return res.status(404).json({ error: 'Game not found' });
  const vote = g.votes?.get(key(req.user.name)) || 0;
  res.json({ ...gameSummary(g), description: g.description, maxPlayers: g.maxPlayers, created: g.created, world: g.world, unpublished: !!g.unpublished, vote, favorited: req.user.favorites.includes(g.id), favorites: g.favoriteCount || 0 });
});

app.post('/api/games', auth, async (req, res) => {
  const { name, description, world, thumbnail, publish } = req.body || {};
  const count = await Game.countDocuments();
  const id = 'g' + (count + 1);
  const game = await Game.create({
    id, name: filter(name || 'Untitled Game').slice(0, 50), creator: req.user.name, description: filter(description || '').slice(0, 1000), world: sanitizeWorld(world), visits: 0, likes: 0, dislikes: 0, maxPlayers: 30, created: Date.now(), updated: Date.now(), thumbnail: validThumb(thumbnail), unpublished: !publish
  });
  res.json({ id: game.id });
});

app.put('/api/games/:id', auth, async (req, res) => {
  const g = await Game.findOne({ id: req.params.id });
  if (!g) return res.status(404).json({ error: 'Game not found' });
  if (key(g.creator) !== key(req.user.name)) return res.status(403).json({ error: 'Not your game' });
  const { name, description, world, thumbnail, publish } = req.body || {};
  if (name !== undefined) g.name = filter(name).slice(0, 50) || 'Untitled Game';
  if (description !== undefined) g.description = filter(description).slice(0, 1000);
  if (world) g.world = sanitizeWorld(world);
  if (thumbnail) g.thumbnail = validThumb(thumbnail);
  if (publish !== undefined) g.unpublished = !publish;
  g.updated = Date.now(); 
  await g.save(); 
  res.json({ ok: true });
});

app.delete('/api/games/:id', auth, async (req, res) => {
  const g = await Game.findOne({ id: req.params.id });
  if (!g || key(g.creator) !== key(req.user.name)) return res.status(403).json({ error: 'Not your game' });
  await Game.deleteOne({ _id: g._id }); 
  res.json({ ok: true });
});

app.post('/api/games/:id/vote', auth, async (req, res) => {
  const g = await Game.findOne({ id: req.params.id });
  if (!g) return res.status(404).json({ error: 'Game not found' });
  const k = key(req.user.name), old = g.votes.get(k) || 0, v = Math.sign(Number(req.body?.vote) || 0);
  const nv = old === v ? 0 : v;
  if (old === 1) g.likes--; if (old === -1) g.dislikes--;
  if (nv === 1) g.likes++; if (nv === -1) g.dislikes++;
  g.votes.set(k, nv); 
  await g.save();
  res.json({ likes: g.likes, dislikes: g.dislikes, vote: nv });
});

app.post('/api/games/:id/favorite', auth, async (req, res) => {
  const g = await Game.findOne({ id: req.params.id });
  if (!g) return res.status(404).json({ error: 'Game not found' });
  const f = req.user.favorites;
  if (f.includes(g.id)) { 
    req.user.favorites = f.filter(x => x !== g.id); 
    g.favoriteCount = Math.max(0, (g.favoriteCount || 0) - 1); 
  } else { 
    f.push(g.id); 
    g.favoriteCount = (g.favoriteCount || 0) + 1; 
  }
  await Promise.all([req.user.save(), g.save()]);
  res.json({ favorited: req.user.favorites.includes(g.id), favorites: g.favoriteCount });
});

app.post('/api/games/:id/thumbnail', auth, async (req, res) => {
  const g = await Game.findOne({ id: req.params.id });
  if (!g) return res.status(404).json({ error: 'Game not found' });
  if (!g.thumbnail || key(g.creator) === key(req.user.name)) { 
    g.thumbnail = validThumb(req.body?.thumbnail); 
    await g.save(); 
  }
  res.json({ ok: true });
});

function validThumb(t) { return typeof t === 'string' && t.startsWith('data:image/') && t.length < 600000 ? t : null; }
function sanitizeWorld(w) {
  const num = v => (Number.isFinite(+v) ? +v : 0);
  const parts = (Array.isArray(w?.parts) ? w.parts : []).slice(0, 5000).map((p, i) => ({
    id: String(p.id || 'p' + i).slice(0, 20), name: String(p.name || 'Part').slice(0, 40),
    p: [0, 1, 2].map(j => num(p.p?.[j])), s: [0, 1, 2].map(j => Math.max(0.05, Math.min(2048, num(p.s?.[j]) || 1))),
    c: /^(#[0-9a-fA-F]{6}|hsl\(\d+,\d+%\,\d+%\))$/.test(p.c) ? p.c : '#a3a2a5',
    k: ['part', 'spawn', 'kill', 'checkpoint', 'win', 'bounce', 'coin', 'speed'].includes(p.k) ? p.k : 'part',
    m: ['plastic', 'neon', 'grass', 'wood', 'brick', 'glass', 'concrete', 'sand', 'baseplate', 'spawn', 'metal'].includes(p.m) ? p.m : 'plastic',
    ...(p.cc === false ? { cc: false } : {}), ...(p.tr ? { tr: Math.max(0, Math.min(1, num(p.tr))) } : {}),
  }));
  return { sky: /^#[0-9a-fA-F]{6}$/.test(w?.sky) ? w.sky : '#8fc8ff', parts };
}

app.get('/api/catalog', (req, res) => res.json(CATALOG));

// ---------- realtime ----------
const rooms = new Map();
let nextPid = 1;
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const server = isDirectRun ? http.createServer(app) : null;
const wss = server ? new WebSocketServer({ server, path: '/ws' }) : null;

if (wss) {

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, except) { const s = JSON.stringify(msg); for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(s); }

wss.on('connection', (ws) => {
  let player = null, room = null;
  ws.on('message', async (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join' && !player) {
      const session = await Session.findOne({ token: m.token });
      const uname = session?.username;
      const u = uname ? await User.findOne({ name: uname }) : null;
      const g = await Game.findOne({ id: m.gameId });
      if (!u || !g) return send(ws, { t: 'error', error: 'Could not join' });
      if (!rooms.has(g.id)) rooms.set(g.id, { players: new Map() });
      room = rooms.get(g.id);
      if (room.players.size >= g.maxPlayers) return send(ws, { t: 'error', error: 'Server is full' });
      for (const p of room.players.values()) if (p.user === u) { send(p.ws, { t: 'error', error: 'You joined from another window' }); p.ws.close(); }
      player = { id: nextPid++, gameId: g.id, ws, user: u, name: u.name, avatar: u.avatar, s: null, coins: new Set(), lastCoin: 0, lastTix: Date.now() };
      g.visits++; 
      u.recent = [g.id, ...u.recent.filter(x => x !== g.id)].slice(0, 12); 
      await Promise.all([g.save(), u.save()]);
      touch(u.name, g.id);
      send(ws, { t: 'welcome', id: player.id, players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, s: p.s, club: isClub(p.user), badge: badgeOf(p.user) })), ...money(u), club: isClub(u), badge: badgeOf(u) });
      room.players.set(player.id, player);
      broadcast(room, { t: 'joined', id: player.id, name: player.name, avatar: player.avatar, club: isClub(u), badge: badgeOf(u) }, ws);
      broadcast(room, { t: 'chat', system: true, text:  `${player.name} has joined the game. ` });
      return;
    }
    if (!player) return;
    if (m.t === 's' && Array.isArray(m.s)) { player.s = m.s.slice(0, 6).map(Number); touch(player.name, player.gameId);
      const now = Date.now();
      if (now - player.lastTix >= ECON.PLAY_TIX_EVERY) {
        const amt = ECON.PLAY_TIX * (isClub(player.user) ? ECON.CLUB_PLAY_MULT : 1);
        player.lastTix = now; player.user.funtix += amt; await player.user.save();
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
      player.user.funtix += ECON.COIN_TIX; await player.user.save();
      send(ws, { t: 'money', ...money(player.user) });
    }
    else if (m.t === 'win') {
      if (player.won) return; player.won = true;
      player.user.funtix += ECON.WIN_TIX; player.user.champ = true; await player.user.save();
      send(ws, { t: 'money', ...money(player.user) });
      broadcast(room, { t: 'chat', system: true, text:  `${player.name} beat the game! (+${ECON.WIN_TIX} FunTix) ` });
    }
    else if (m.t === 'emote') broadcast(room, { t: 'emote', id: player.id, e: String(m.e).slice(0, 10) }, ws);
  });
  ws.on('close', () => {
    if (!player || !room) return;
    room.players.delete(player.id);
    broadcast(room, { t: 'left', id: player.id });
    broadcast(room, { t: 'chat', system: true, text:  `${player.name} has left the game. ` });
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
}

if (server) server.listen(PORT, () => console.log( `FriendFun running on http://localhost:\${PORT} `));

export default app;
