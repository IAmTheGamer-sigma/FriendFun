import express from 'express';
import { WebSocketServer } from 'ws';
import http from 'http';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { templates } from './public/js/worlds.js';
import { ITEM, CATALOG, DEFAULT_AVATAR, ECON, BADGES } from './public/js/catalog.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ADMINS = (process.env.FF_ADMINS || 'fun').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('ERROR: SUPABASE_URL or SUPABASE_KEY environment variable is not set!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ---------- helper functions ----------
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const key = n => n.toLowerCase();

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
    await supabase.from('games').upsert({ id: game.id, ...game });
  }
}

seed().catch(console.error);

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
    const { data: g } = await supabase.from('games').select('name').eq('id', p.gameId).single();
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
  const { data: gameExists } = await supabase.from('games').select('id', { count: 'exact', head: true }).eq('creator', key(u.name)).eq('unpublished', false);
  const isCreator = gameExists?.count > 0;
  const has = {
    admin: isAdmin(u), club: isClub(u), champ: !!u.champ,
    creator: isCreator,
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
  return { id: g.id, name: g.name, creator: g.creator, visits: g.visits, likes: g.likes, dislikes: g.dislikes, playing: rooms.get(g.id)?.players.size || 0, thumbnail: g.thumbnail, updated: g.updated, sky: g.world?.sky };
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
  const { data: session, error: sErr } = await supabase.from('sessions').select('username').eq('token', tok).single();
  if (sErr || !session) return res.status(401).json({ error: 'Not logged in' });
  const { data: user, error: uErr } = await supabase.from('users').select('*').eq('name', session.username).single();
  if (uErr || !user) return res.status(401).json({ error: 'User not found' });
  req.user = user;
  touch(req.user.name);
  next();
}

app.post('/api/signup', async (req, res) => {
  const { username, password } = req.body || {};
  if (!/^[A-Za-z0-9_]{3,20}$/.test(username || '')) return res.status(400).json({ error: 'Username must be 3-20 letters, numbers or _' });
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const { data: existing } = await supabase.from('users').select('name').eq('name', key(username)).maybeSingle();
  if (existing) return res.status(400).json({ error: 'That username is taken' });
  
  const salt = crypto.randomBytes(8).toString('hex');
  const userData = {
    name: key(username), salt, pw: hash(password, salt), created: Date.now(), funtix: ECON.START_TIX,
    avatar: structuredClone(DEFAULT_AVATAR), inventory: CATALOG.filter(i => i.free).map(i => i.id),
    friends: [], requests: [], favorites: [], recent: [], bio: '',
  };
  const { data: user, error: uErr } = await supabase.from('users').insert(userData).select().single();
  if (uErr) return res.status(500).json({ error: uErr.message });
  
  const tok = crypto.randomBytes(24).toString('hex');
  await supabase.from('sessions').insert({ token: tok, username: user.name });
  res.json({ token: tok });
});

app.post('/api/login', async (req, res) => {
  const { username, password } = req.body || {};
  const { data: u, error: uErr } = await supabase.from('users').select('*').eq('name', key(username || '')).single();
  if (uErr || !u || hash(password || '', u.salt) !== u.pw) return res.status(400).json({ error: 'Incorrect username or password' });
  
  const tok = crypto.randomBytes(24).toString('hex');
  await supabase.from('sessions').insert({ token: tok, username: u.name });
  res.json({ token: tok });
});

app.post('/api/logout', auth, async (req, res) => {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  await supabase.from('sessions').delete().eq('token', tok);
  res.json({ ok: true });
});

async function dailyTix(u) {
  const day = new Date().toISOString().slice(0, 10);
  if (u.tixDay === day) return 0;
  const amt = ECON.DAILY_TIX + (isClub(u) ? ECON.CLUB_DAILY : 0);
  const updatedUser = { ...u, tixDay: day, funtix: u.funtix + amt };
  await supabase.from('users').update(updatedUser).eq('name', u.name);
  return amt;
}

app.get('/api/me', auth, async (req, res) => {
  const u = req.user;
  if (isClub(u)) { 
    const miss = CATALOG.filter(it => it.club && !u.inventory.includes(it.id)); 
    if (miss.length) { 
      const updatedInv = [...u.inventory, ...miss.map(it => it.id)];
      await supabase.from('users').update({ inventory: updatedInv }).eq('name', u.name);
      u.inventory = updatedInv;
    } 
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
  const avatar = { colors, hat: pick('hat'), face: pick('face'), shirt: pick('shirt'), head: pick('head') || DEFAULT_AVATAR.head };
  await supabase.from('users').update({ avatar }).eq('name', req.user.name);
  res.json(avatar);
});

app.put('/api/me/badge', auth, async (req, res) => {
  const b = String(req.body?.badge || '');
  if (b !== 'none') {
    const { data: isCreator } = await supabase.from('games').select('id', { count: 'exact', head: true }).eq('creator', key(req.user.name)).eq('unpublished', false);
    const has = { admin: isAdmin(req.user), club: isClub(req.user), champ: !!req.user.champ, creator: isCreator?.count > 0 };
    const badges = Object.keys(BADGES).filter(badge => has[badge]);
    if (!badges.includes(b)) return res.status(400).json({ error: "You don't have that badge" });
  }
  await supabase.from('users').update({ badge: b }).eq('name', req.user.name);
  res.json({ badge: badgeOf({ ...req.user, badge: b }) });
});

app.put('/api/me/bio', auth, async (req, res) => { 
  const bio = filter(req.body?.bio || '').slice(0, 300); 
  await supabase.from('users').update({ bio }).eq('name', req.user.name);
  res.json({ ok: true }); 
});

app.post('/api/buy/:item', auth, async (req, res) => {
  const it = ITEM[req.params.item];
  if (!it) return res.status(404).json({ error: 'No such item' });
  if (req.user.inventory.includes(it.id)) return res.status(400).json({ error: 'You already own this' });
  if (it.club && !isClub(req.user)) return res.status(403).json({ error: 'FriendClub members only' });
  const price = it.free ? 0 : it.price;
  if (req.user.funtix < price) return res.status(400).json({ error: 'Not enough FunTix' });
  
  const updatedInv = [...req.user.inventory, it.id];
  await supabase.from('users').update({ funtix: req.user.funtix - price, inventory: updatedInv }).eq('name', req.user.name);
  res.json({ funtix: req.user.funtix - price, inventory: updatedInv });
});

app.post('/api/club/join', auth, async (req, res) => {
  const u = req.user;
  if (isAdmin(u) || u.clubForever) return res.status(400).json({ error: 'You already have free FriendClub' });
  if (u.funtix < ECON.CLUB_PRICE) return res.status(400).json({ error: 'Not enough FunTix' });
  
  const clubUntil = Math.max(Date.now(), u.clubUntil || 0) + ECON.CLUB_DAYS * 86400000;
  const updatedInv = [...u.inventory, ...CATALOG.filter(it => it.club && !u.inventory.includes(it.id)).map(it => it.id)];
  
  await supabase.from('users').update({ funtix: u.funtix - ECON.CLUB_PRICE, clubUntil, inventory: updatedInv }).eq('name', u.name);
  res.json({ funtix: u.funtix - ECON.CLUB_PRICE, club: true, clubUntil, inventory: updatedInv });
});

app.get('/api/leaderboard', auth, async (req, res) => {
  const { data: all, error } = await supabase.from('users').select('*').order('funtix', { ascending: false }).order('created', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const userIndex = all.findIndex(u => u.name === req.user.name);
  res.json({
    top: all.slice(0, 50).map(u => ({ 
      name: u.name, avatar: u.avatar, funtix: u.funtix, club: isClub(u), badge: badgeOf(u), 
      ...statusOf(u.name) 
    })),
    rank: userIndex + 1, total: all.length, funtix: req.user.funtix,
  });
});

app.get('/api/users/:name', auth, async (req, res) => {
  const { data: u, error: uErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  if (uErr || !u) return res.status(404).json({ error: 'User not found' });
  const { data: games } = await supabase.from('games').select('*').eq('creator', key(u.name)).then(r => r.data.map(gameSummary));
  const { data: friends } = await supabase.from('users').select('*').in('name', u.friends).then(r => Promise.all(r.data.map(publicUser)));
  res.json({ 
    ...await publicUser(u), games, friendsList: await friends, 
    isFriend: req.user.friends.includes(key(u.name)), requested: u.requests.includes(key(req.user.name)) 
  });
});

app.get('/api/search/users', auth, async (req, res) => {
  const q = key(String(req.query.q || ''));
  const { data: users } = await supabase.from('users').select('*').ilike('name', `%${q}%`).limit(30);
  res.json(await Promise.//FIXED a typo here
Promise.all(users.map(publicUser)));
});

function adminOnly(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admins only' });
  next();
}

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  const q = key(String(req.query.q || ''));
  const { data: users } = await supabase.from('users').select('*').ilike('name', `%${q}%`).order('name').limit(100);
  res.json(await Promise.all(users.map(async u => ({ ...await publicUser(u), clubForever: isAdmin(u) || !!u.clubForever, clubUntil: u.clubUntil || 0, funtix: u.funtix }))));
});

app.post('/api/admin/club/:name', auth, adminOnly, async (req, res) => {
  const { data: u, error: uErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  if (uErr || !u) return res.status(404).json({ error: 'User not found' });
  if (isAdmin(u)) return res.status(400).json({ error: 'Admins always have FriendClub' });
  if (req.body?.on) {
    const updatedInv = [...u.inventory, ...CATALOG.filter(it => it.club && !u.inventory.includes(it.id)).map(it => it.id)];
    await supabase.from('users').update({ clubFirestore: true, inventory: updatedInv }).eq('name', u.name);
  } else { 
    await supabase.from('users').update({ clubFirestore: false, clubUntil: 0 }).eq('name', u.name); 
  }
  res.json({ ...await publicUser(u), clubForever: isAdmin(u) || !!u.clubForever, clubUntil: u.clubUntil || 0, funtix: u.funtix });
});

app.get('/api/friends', auth, async (req, res) => {
  const { data: friends } = await supabase.from('users').select('*').in('name', req.user.friends);
  const { data: requests } = await supabase.from('users').select('*').in('name', req.user.requests);
  res.json({
    friends: await Promise.all(friends.map(publicUser)),
    requests: await Promise.all(requests.map(publicUser)),
  });
});

app.post('/api/friends/:name', auth, async (req, res) => {
  const { data: other, error: oErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  const me = req.user, mk = key(me.name);
  if (oErr || !other || other.name === me.name) return res.status(400).json({ error: 'Invalid user' });
  const ok = other.name;
  if (me.friends.includes(ok)) return res.json({ status: 'friends' });
  if (me.requests.includes(ok)) {
    const updatedMe = { friends: [...me.friends, ok], requests: me.requests.filter(x => x !== ok) };
    await supabase.from('users').update(updatedMe).eq('name', me.name);
    await supabase.from('users').update({ friends: [...other.friends, mk] }).eq('name', ok);
    return res.json({ status: 'friends' });
  }
  const updatedOther = { requests: [...other.requests, mk] };
  await supabase.from('users').update(updatedOther).eq('name', ok);
  res.json({ status: 'requested' });
});

app.delete('/api/friends/:name', auth, async (req, res) => {
  const { data: other, error: oErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  if (oErr || !other) return res.status(404).json({ error: 'User not found' });
  const ok = other.name, mk = me.name;
  const updatedMe = { friends: me.friends.filter(x => x !== ok), requests: me.requests.filter(x => x !== ok) };
  await supabase.from('users').update(updatedMe).eq('name', me.name);
  await supabase.from('users').update({ friends: other.friends.filter(x => x !== mk) }).eq('name', ok);
  res.json({ ok: true });
});

app.get('/api/games', auth, async (req, res) => {
  const q = key(String(req.query.q || ''));
  let query = supabase.from('games').select('*').eq('unpublished', false);
  if (q) query = query.or(`name.ilike.%${q}%,creator.ilike.%${q}%`);
  const { data: games } = await query;
  const list = games.map(gameSummary);
  list.sort((a, b) => (b.playing - a.playing) || (b.visits - a.visits));
  res.json(list);
});

app.get('/api/mygames', auth, async (req, res) => {
  const { data: games } = await supabase.from('games').select('*').eq('creator', key(req.user.name));
  res.json(games.map(g => ({ ...gameSummary(g), unpublished: !!g.unpublished })));
});

app.get('/api/games/:id', auth, async (req, res) => {
  const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (gErr || !g) return res.status(404).json({ error: 'Game not found' });
  const vote = g.votes?.[key(req.user.name)] || 0;
  res.json({ ...gameSummary(g), description: g.description, maxPlayers: g.maxPlayers, created: g.created, world: g.world, unpublished: !!g.unpublished, vote, favorited: req.user.favorites.includes(g.id), favorites: g.favoriteCount || 0 });
});

app.post('/api/games', auth, async (req, res) => {
  const { name, description, world, thumbnail, publish } = req.body || {};
  const { count } = await supabase.from('games').select('*', { count: 'exact', head: true });
  const id = 'g' + (count + 1);
  const game = {
    id, name: filter(name || 'Untitled Game').slice(0, 50), creator: req.user.name, description: filter(description || '').slice(0, 1000), world: sanitizeWorld(world), visits: 0, likes: 0, dislikes: 0, maxPlayers: 30, created: Date.now(), updated: Date.now(), thumbnail: validThumb(thumbnail), unpublished: !publish
  };
  const { data, error } = await supabase.from('games').insert(game).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ id: data.id });
});

app.put('/api/games/:id', auth, async (req, res) => {
  const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (gErr || !g) return res.status(404).json({ error: 'Game not found' });
  if (key(g.creator) !== key(req.user.name)) return res.status(403).json({ error: 'Not your game' });
  const { name, description, world, thumbnail, publish } = req.body || {};
  const updates = {};
  if (name !== undefined) updates.name = filter(name).slice(0, 50) || 'Untitled Game';
  if (description !== undefined) updates.description = filter(description).slice(0, 1000);
  if (world) updates.world = sanitizeWorld(world);
  if (thumbnail) updates.thumbnail = validThumb(thumbnail);
  if (publish !== undefined) updates.unpublished = !publish;
  updates.updated = Date.now();
  await supabase.from('games').update(updates).eq('id', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/games/:id', auth, async (req, res) => {
  const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (gErr || !g || key(g.creator) !== key(req.user.name)) return res.status(403).json({ error: 'Not your game' });
  await supabase.from('games').delete().eq('id', g.id);
  res.json({ ok: true });
});

app.post('/api/games/:id/vote', auth, async (req, res) => {
  const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (gErr || !g) return res.status(404).json({ error: 'Game not found' });
  const k = key(req.user.name), old = g.votes?.[k] || 0, v = Math.sign(Number(req.body?.vote) || 0);
  const nv = old === v ? 0 : v;
  let likes = g.likes || 0, dislikes = g.dislikes || 0;
  if (old === 1) likes--; if (old === -1) dislikes--;
  if (nv === 1) likes++; if (nv === -1) dislikes++;
  const newVotes = { ...g.votes, [k]: nv };
  await supabase.from('games').update({ likes, dislikes, votes: newVotes }).eq('id', g.id);
  res.json({ likes, dislikes, vote: nv });
});

app.post('/api/games/:id/favorite', auth, async (req, res) => {
  const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (gErr || !g) return res.status(404).json({ error: 'Game not found' });
  const f = req.user.favorites;
  let favoriteCount = g.favoriteCount || 0;
  if (f.includes(g.id)) { 
    const updatedF = f.filter(x => x !== g.id);
    await supabase.from('users').update({ favorites: updatedF }).eq('name', req.user.name);
    favoriteCount--;
  } else { 
    const updatedF = [...f, g.id];
    await supabase.from('users').update({ favorites: updatedF }).eq('name', req.user.name);
    favoriteCount++;
  }
  await supabase.from('games').update({ favoriteCount }).eq('id', g.id);
  res.json({ favorited: !f.includes(g.id), favorites: favoriteCount });
});

app.post('/api/games/:id/thumbnail', auth, async (req, res) => {
  const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (gErr || !g) return res.status(404).json({ error: 'Game not found' });
  if (!g.thumbnail || key(g.creator) === key(req.user.name)) { 
    const thumb = validThumb(req.body?.thumbnail);
    await supabase.from('games').update({ thumbnail: thumb }).eq('id', g.id);
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
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });

function send(ws, msg) { if (ws.readyState === 1) ws.send(JSON.stringify(msg)); }
function broadcast(room, msg, except) { const s = JSON.stringify(msg); for (const p of room.players.values()) if (p.ws !== except && p.ws.readyState === 1) p.ws.send(s); }

wss.on('connection', (ws) => {
  let player = null, room = null;
  ws.on('message', async (raw) => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.t === 'join' && !player) {
      const { data: session } = await supabase.from('sessions').select('username').eq('token', m.token).single();
      const uname = session?.username;
      const { data: u } = await supabase.from('users').select('*').eq('name', uname).maybeSingle();
      const { data: g } = await supabase.from('games').select('*').eq('id', m.gameId).maybeSingle();
      if (!u || !g) return send(ws, { t: 'error', error: 'Could not join' });
      if (!rooms.has(g.id)) rooms.set(g.id, { players: new Map() });
      room = rooms.get(g.id);
      if (room.players.size >= g.maxPlayers) return send(ws, { t: 'error', error: 'Server is full' });
      for (const p of room.players.values()) if (p.user === u) { send(p.ws, { t: 'error', error: 'You joined from another window' }); p.ws.close(); }
      player = { id: nextPid++, gameId: g.id, ws, user: u, name: u.name, avatar: u.avatar, s: null, coins: new Set(), lastCoin: 0, lastTix: Date.now() };
      
      await supabase.from('games').update({ visits: (g.visits || 0) + 1 }).eq('id', g.id);
      const updatedRecent = [g.id, ... (u.recent || []).filter(x => x !== g.id)].slice(0, 12);
      await supabase.from('users').update({ recent: updatedRecent }).eq('name', u.name);
      
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
        player.lastTix = now; 
        await supabase.from('users').update({ funtix: player.user.funtix + amt }).eq('name', player.user.name);
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
      await supabase.from('users').update({ funtix: player.user.funtix + ECON.COIN_TIX }).eq('name', player.user.name);
      send(ws, { t: 'money', ...money(player.user) });
    }
    else if (m.t === 'win') {
      if (player.won) return; player.won = true;
      await supabase.from('users').update({ funtix: player.user.funtix + ECON.WIN_TIX, champ: true }).eq('name', player.user.name);
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

export default app;
