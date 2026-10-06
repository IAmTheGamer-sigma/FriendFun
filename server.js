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

// ---- Custom badges (admin-created) ----
let CUSTOM_BADGES = {};
async function loadCustomBadges() {
  try {
    const { data } = await supabase.from('badges').select('*');
    CUSTOM_BADGES = {};
    (data || []).forEach(b => { CUSTOM_BADGES[b.id] = b; });
  } catch (e) { console.error('Failed to load custom badges:', e.message); }
}
function badgeDefs() {
  const defs = {};
  for (const [id, b] of Object.entries(BADGES)) defs[id] = { id, name: b.name, desc: b.desc, color: b.color, path: b.path, custom: false };
  for (const [id, b] of Object.entries(CUSTOM_BADGES)) defs[id] = { id, name: b.name, desc: b.desc || '', color: b.color || '#888', icon: b.icon || '🏅', image: b.image || '', custom: true };
  return defs;
}

// ---------- helper functions ----------
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const key = n => n.toLowerCase();
const money = u => ({ funtix: Number(u.funtix) || 0 });
const list = (u, field) => Array.isArray(u?.[field]) ? u[field] : [];

// ---------- add-ons ----------
const ADDONS = [
  {
    id: 'funworx',
    name: 'FunWorx',
    description: 'Connect your Funtopia identity to FunWorx. Share your avatar, name, and live game activity.',
    permissions: [
      { id: 'avatar', label: 'Avatar', description: 'Your Funtopia avatar' },
      { id: 'name', label: 'Name', description: 'Your Funtopia username' },
      { id: 'presence', label: 'Game Activity', description: 'What game you are currently playing' },
    ],
  },
];
const getAddonSettings = u => (u.addons && typeof u.addons === 'object') ? u.addons : {};

async function seed() {
  const now = Date.now();
  const g = (id, name, creator, desc, tpl, visits, likes, dislikes, max_players = 30) =>
    ({ id, name, creator, description: desc, world: templates[tpl](), visits, likes, dislikes, max_players, created: now, updated: now, thumbnail: null });
  
  const games = [
    g('g1', 'Mega Fun Obby', 'Funtopia', 'Jump, dodge and bounce through 10 stages of obstacles!', 'obby', 1543210, 8912, 412),
    g('g2', 'Hangout Town', 'Funtopia', 'Chill with friends in a little town.', 'hangout', 987654, 5321, 210),
    g('g3', 'Sky Tower Climb', 'Funtopia', 'Climb the spiral around the giant tower.', 'tower', 654321, 4210, 380),
    g('g4', 'Coin Rush Islands', 'Funtopia', 'Hop between floating islands and grab every coin!', 'coinRush', 432100, 3999, 155),
    g('g5', 'Classic Baseplate', 'Funtopia', 'The classic. A big grey baseplate.', 'baseplate', 210987, 1500, 90),
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
function isAdmin(u) { return ADMINS.includes(u.name.toLowerCase()) || !!u.admin; }
function isClub(u) { return isAdmin(u) || !!u.clubForever || (u.clubUntil || 0) > Date.now(); }
function badgesOf(u) {
  const has = {
    admin: isAdmin(u), club: isClub(u), champ: !!u.champ, newcomer: true,
    tix_100: (Number(u.funtix) || 0) >= 100, tix_500: (Number(u.funtix) || 0) >= 500,
    tix_1000: (Number(u.funtix) || 0) >= 1000, tix_5000: (Number(u.funtix) || 0) >= 5000,
    friend_1: list(u, 'friends').length >= 1, friend_5: list(u, 'friends').length >= 5, friend_10: list(u, 'friends').length >= 10,
    collector_5: list(u, 'inventory').length >= 5, collector_15: list(u, 'inventory').length >= 15,
    collector_all: CATALOG.every(item => list(u, 'inventory').includes(item.id)), creator: false,
  };
  const earned = list(u, 'earnedBadges').filter(id => BADGES[id] || CUSTOM_BADGES[id]);
  return [...new Set([...Object.keys(BADGES).filter(b => has[b]), ...earned])];
}
function badgeOf(u) {
  if (u.badge === 'none') return null;
  const list = badgesOf(u);
  return list.includes(u.badge) ? u.badge : list[0] || null;
}
async function publicUser(u) {
  const { data: publishedGames } = await supabase.from('games').select('id, visits').eq('creator', key(u.name)).eq('unpublished', false);
  const games = publishedGames || [], visits = games.reduce((total, game) => total + (Number(game.visits) || 0), 0);
  const badges = [...new Set([...badgesOf(u), ...(games.length ? ['creator'] : []), ...(games.length >= 5 ? ['builder_5'] : []), ...(games.length >= 10 ? ['builder_10'] : []), ...(visits >= 100 ? ['popular_100'] : []), ...(visits >= 1000 ? ['popular_1000'] : [])])];
  const badge = u.badge === 'none' ? null : (badges.includes(u.badge) ? u.badge : badges[0] || null);
  
  return { 
    name: u.name, club: isClub(u), admin: isAdmin(u), badges, badge, 
    avatar: u.avatar, created: u.created, bio: u.bio || '', friends: list(u, 'friends').length, 
    ...(await statusOf(u.name)) 
  };
}
function gameSummary(g) {
  return { id: g.id, name: g.name, creator: g.creator, visits: g.visits, likes: g.likes, dislikes: g.dislikes, playing: rooms.get(g.id)?.players.size || 0, thumbnail: g.thumbnail, updated: g.updated, sky: g.world?.sky, maxPlayers: g.max_players || 30 };
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
app.use(express.static(path.join(__dirname, 'public'), { maxAge: '1h' }));
app.use('/three', express.static(path.join(__dirname, 'node_modules/three'), { maxAge: '1y', immutable: true }));
app.get('/health', (req, res) => res.json({ ok: true }));

async function auth(req, res, next) {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: session, error: sErr } = await supabase.from('sessions').select('username').eq('token', tok).single();
  if (sErr || !session) return res.status(401).json({ error: 'Not logged in' });
  const { data: user, error: uErr } = await supabase.from('users').select('*').eq('name', session.username).single();
  if (uErr || !user) return res.status(401).json({ error: 'User not found' });
  if (user.banned && (!user.bannedUntil || user.bannedUntil > Date.now())) {
    await supabase.from('sessions').delete().eq('token', tok);
    return res.status(403).json({ error: 'Your account is banned' });
  }
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
    friends: [], requests: [], favorites: [], recent: [], earnedBadges: [], bio: '',
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
  if (u.banned && (!u.bannedUntil || u.bannedUntil > Date.now())) {
    const msg = u.banReason ? `Banned: ${u.banReason}` : 'Your account is banned';
    return res.status(403).json({ error: msg });
  }
  
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
  if (u.tixDay === day) return { amount: 0, user: u };
  const amt = ECON.DAILY_TIX + (isClub(u) ? ECON.CLUB_DAILY : 0);
  const { data: updated, error } = await supabase.from('users').update({ tixDay: day, funtix: (Number(u.funtix) || 0) + amt }).eq('name', u.name).select().single();
  if (error) throw new Error(error.message);
  Object.assign(u, updated);
  return { amount: amt, user: updated };
}

app.get('/api/me', auth, async (req, res) => {
  const u = req.user;
  // Repair corrupted FunTix balance (null/NaN from old coin-pickup bug)
  if (typeof u.funtix !== 'number' || isNaN(u.funtix)) {
    const { data: repaired } = await supabase.from('users').update({ funtix: 0 }).eq('name', u.name).select().single();
    if (repaired) u.funtix = repaired.funtix;
  }
  u.inventory = list(u, 'inventory'); u.requests = list(u, 'requests'); u.friends = list(u, 'friends'); u.favorites = list(u, 'favorites'); u.recent = list(u, 'recent');
  if (isClub(u)) { 
    const entitledItems = isAdmin(u) ? CATALOG : CATALOG.filter(it => it.club);
    const miss = entitledItems.filter(it => !u.inventory.includes(it.id)); 
    if (miss.length) { 
      const updatedInv = [...u.inventory, ...miss.map(it => it.id)];
      await supabase.from('users').update({ inventory: updatedInv }).eq('name', u.name);
      u.inventory = updatedInv;
    } 
  }
  const { amount: daily } = await dailyTix(u);
  if (u.name === 'fun') {
    const missItems = LOONEY_EVENT.items.filter(id => !u.inventory.includes(id));
    if (missItems.length) {
      u.inventory = [...u.inventory, ...missItems];
      await supabase.from('users').update({ inventory: u.inventory }).eq('name', u.name);
    }
    if (!list(u, 'earnedBadges').includes(LOONEY_EVENT.badge)) {
      const badges = [...list(u, 'earnedBadges'), LOONEY_EVENT.badge];
      await supabase.from('users').update({ earnedBadges: badges }).eq('name', u.name);
    }
  }
  res.json({ ...await publicUser(u), daily, funtix: u.funtix, inventory: u.inventory, requests: u.requests, friendList: u.friends, favorites: u.favorites, recent: u.recent, clubUntil: u.clubUntil || 0, clubForever: isAdmin(u) || !!u.clubForever, aiAccess: isAdmin(u) || !!u.aiAccess });
});

app.post('/api/ping', auth, async (req, res) => { 
  touch(req.user.name, null); 
  const { amount: daily } = await dailyTix(req.user);
  res.json({ funtix: req.user.funtix, daily, requests: list(req.user, 'requests').length }); 
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
    const profile = await publicUser(req.user);
    if (!profile.badges.includes(b)) return res.status(400).json({ error: "You don't have that badge" });
  }
  await supabase.from('users').update({ badge: b }).eq('name', req.user.name);
  res.json({ badge: badgeOf({ ...req.user, badge: b }) });
});

app.put('/api/me/bio', auth, async (req, res) => { 
  const bio = filter(req.body?.bio || '').slice(0, 300); 
  await supabase.from('users').update({ bio }).eq('name', req.user.name);
  res.json({ ok: true }); 
});

// ---------- add-ons ----------
app.get('/api/addons', auth, async (req, res) => {
  const settings = getAddonSettings(req.user);
  res.json({ addons: ADDONS.map(a => ({ ...a, settings: { enabled: false, avatar: true, name: true, presence: true, ...(settings[a.id] || {}) } })) });
});

app.post('/api/addons/:id', auth, async (req, res) => {
  const addon = ADDONS.find(a => a.id === req.params.id);
  if (!addon) return res.status(404).json({ error: 'No such add-on' });
  const body = req.body || {};
  const s = {
    enabled: !!body.enabled,
    avatar: body.avatar !== false,
    name: body.name !== false,
    presence: body.presence !== false,
  };
  const addons = { ...getAddonSettings(req.user), [addon.id]: s };
  const { error } = await supabase.from('users').update({ addons }).eq('name', req.user.name);
  if (error) return res.status(500).json({ error: 'Could not save add-on settings' });
  res.json({ ok: true, settings: s });
});

// FunWorx reads the authenticated user's shared Funtopia identity.
// Only returns what the user enabled in the FunWorx add-on settings.
app.get('/api/addons/funworx/me', auth, async (req, res) => {
  const u = req.user;
  const s = getAddonSettings(u).funworx || {};
  if (!s.enabled) return res.status(403).json({ error: 'FunWorx add-on is not enabled' });
  const out = {};
  if (s.name !== false) out.name = u.name;
  if (s.avatar !== false) out.avatar = u.avatar || null;
  if (s.presence !== false) {
    const st = await statusOf(u.name);
    out.online = !!st.online;
    if (st.gameId) { out.gameId = st.gameId; out.gameName = st.gameName || ''; }
  }
  res.json(out);
});

app.post('/api/buy/:item', auth, async (req, res) => {
  const it = ITEM[req.params.item];
  if (!it) return res.status(404).json({ error: 'No such item' });
  if (it.limited) return res.status(403).json({ error: 'This item is event-only' });
  if (req.user.inventory.includes(it.id)) return res.status(400).json({ error: 'You already own this' });
  if (it.club && !isClub(req.user)) return res.status(403).json({ error: 'FriendClub members only' });
  const price = it.free ? 0 : it.price;
  if (req.user.funtix < price) return res.status(400).json({ error: 'Not enough FunTix' });
  
  const updatedInv = [...list(req.user, 'inventory'), it.id];
  const { data: updated, error } = await supabase.from('users').update({ funtix: req.user.funtix - price, inventory: updatedInv }).eq('name', req.user.name).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ funtix: updated.funtix, inventory: updated.inventory });
});

app.post('/api/club/join', auth, async (req, res) => {
  const u = req.user;
  if (isAdmin(u) || u.clubForever) return res.status(400).json({ error: 'You already have free FriendClub' });
  if (u.funtix < ECON.CLUB_PRICE) return res.status(400).json({ error: 'Not enough FunTix' });
  
  const clubUntil = Math.max(Date.now(), u.clubUntil || 0) + ECON.CLUB_DAYS * 86400000;
  const updatedInv = [...list(u, 'inventory'), ...CATALOG.filter(it => it.club && !list(u, 'inventory').includes(it.id)).map(it => it.id)];
  
  const { data: updated, error } = await supabase.from('users').update({ funtix: u.funtix - ECON.CLUB_PRICE, clubUntil, inventory: updatedInv }).eq('name', u.name).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ funtix: updated.funtix, club: true, clubUntil, inventory: updated.inventory });
});

app.get('/api/leaderboard', auth, async (req, res) => {
  const { data: all, error } = await supabase.from('users').select('*').order('funtix', { ascending: false }).order('created', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  const userIndex = all.findIndex(u => u.name === req.user.name);
  res.json({
    top: await Promise.all(all.slice(0, 50).map(async u => ({ 
      name: u.name, avatar: u.avatar, funtix: u.funtix, club: isClub(u), badge: badgeOf(u), 
      ...await statusOf(u.name) 
    }))),
    rank: userIndex + 1, total: all.length, funtix: req.user.funtix,
  });
});

app.get('/api/users/:name', auth, async (req, res) => {
  const { data: u, error: uErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  if (uErr || !u) return res.status(404).json({ error: 'User not found' });
  
  const { data: gamesData } = await supabase.from('games').select('*').eq('creator', key(u.name));
  const games = (gamesData || []).map(gameSummary);
  
  const { data: friendsData } = await supabase.from('users').select('*').in('name', u.friends || []);
  const friends = await Promise.all((friendsData || []).map(publicUser));
  
  res.json({ 
    ...await publicUser(u), games: games || [], friendsList: friends || [], 
    isFriend: (req.user.friends || []).includes(key(u.name)), requested: (u.requests || []).includes(key(req.user.name)) 
  });
});

app.get('/api/search/users', auth, async (req, res) => {
  const q = key(String(req.query.q || ''));
  const { data: users } = await supabase.from('users').select('*').ilike('name', `%${q}%`).limit(30);
  res.json(await Promise.all((users || []).map(publicUser)));
});

function adminOnly(req, res, next) {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admins only' });
  next();
}

app.get('/api/admin/users', auth, adminOnly, async (req, res) => {
  const q = key(String(req.query.q || ''));
  const { data: users, error } = await supabase.from('users').select('*').ilike('name', `%${q}%`).order('name').limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json(await Promise.all((users || []).map(async u => ({ ...await publicUser(u), clubForever: isAdmin(u) || !!u.clubForever, clubUntil: u.clubUntil || 0, funtix: u.funtix, aiAccess: isAdmin(u) || !!u.aiAccess, banned: !!u.banned && (!u.bannedUntil || u.bannedUntil > Date.now()), banReason: u.banReason || '', bannedUntil: u.bannedUntil || 0, admin: isAdmin(u), envAdmin: ADMINS.includes(u.name.toLowerCase()) }))));
});

app.post('/api/admin/club/:name', auth, adminOnly, async (req, res) => {
  const { data: u, error: uErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  if (uErr || !u) return res.status(400).json({ error: 'User not found' });
  if (isAdmin(u)) return res.status(400).json({ error: 'Admins always have FriendClub' });
  let changes;
  if (req.body?.on) {
    const updatedInv = [...(u.inventory || []), ...CATALOG.filter(it => it.club && !u.inventory?.includes(it.id)).map(it => it.id)];
    changes = { clubForever: true, inventory: updatedInv };
  } else { 
    changes = { clubForever: false, clubUntil: 0 };
  }
  const { data: updated, error } = await supabase.from('users').update(changes).eq('name', u.name).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ...await publicUser(updated), clubForever: isAdmin(updated) || !!updated.clubForever, clubUntil: updated.clubUntil || 0, funtix: updated.funtix });
});

// ---- Custom badges ----
app.get('/api/badges', async (req, res) => {
  res.json(badgeDefs());
});
app.post('/api/admin/badges', auth, adminOnly, async (req, res) => {
  const name = String(req.body?.name || '').trim().slice(0, 30);
  const icon = String(req.body?.icon || '🏅').slice(0, 4);
  const color = String(req.body?.color || '#888888').slice(0, 7);
  const desc = String(req.body?.desc || '').trim().slice(0, 100);
  let image = String(req.body?.image || '').slice(0, 300000);
  if (image && !image.startsWith('data:image/')) image = '';
  if (!name) return res.status(400).json({ error: 'Name required' });
  const id = 'custom_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const badge = { id, name, icon, color, desc, image, createdBy: req.user.name, created: Date.now() };
  const { error } = await supabase.from('badges').insert(badge);
  if (error) return res.status(500).json({ error: 'Failed to create badge' });
  await loadCustomBadges();
  res.json({ ok: true, badge: badgeDefs()[id] });
});
app.delete('/api/admin/badges/:id', auth, adminOnly, async (req, res) => {
  const id = req.params.id;
  if (!CUSTOM_BADGES[id]) return res.status(404).json({ error: 'Custom badge not found' });
  await supabase.from('badges').delete().eq('id', id);
  // Remove from all users
  const { data: users } = await supabase.from('users').select('name, earnedBadges, badge').neq('earnedBadges', null);
  for (const u of (users || [])) {
    const earned = (Array.isArray(u.earnedBadges) ? u.earnedBadges : []).filter(b => b !== id);
    const upd = { earnedBadges: earned };
    if (u.badge === id) upd.badge = 'none';
    if (earned.length !== (u.earnedBadges || []).length || u.badge === id) {
      await supabase.from('users').update(upd).eq('name', u.name);
    }
  }
  await loadCustomBadges();
  res.json({ ok: true });
});
app.post('/api/admin/users/:name/command', auth, adminOnly, async (req, res) => {
  const { data: user, error: findError } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  if (findError || !user) return res.status(404).json({ error: 'User not found' });
  const command = String(req.body?.command || '');
  let updates, message;
  if (command === 'grant_tix') {
    const amount = Math.max(1, Math.min(10000, Math.floor(Number(req.body?.amount) || 100)));
    updates = { funtix: (Number(user.funtix) || 0) + amount };
    message = `Gave ${amount} FunTix to ${user.name}`;
  } else if (command === 'give_all_items') {
    updates = { inventory: CATALOG.map(item => item.id) };
    message = `Gave every marketplace item to ${user.name}`;
  } else if (command === 'reset_daily') {
    updates = { tixDay: null };
    message = `Reset ${user.name}'s daily reward`;
  } else if (command === 'grant_badge') {
    const badgeId = String(req.body?.badge || '').trim();
    const def = badgeDefs()[badgeId];
    if (!def) return res.status(400).json({ error: 'Unknown badge' });
    const earned = [...new Set([...(Array.isArray(user.earnedBadges) ? user.earnedBadges : []), badgeId])];
    updates = { earnedBadges: earned };
    message = `Gave ${def.name} badge to ${user.name}`;
  } else if (command === 'revoke_badge') {
    const badgeId = String(req.body?.badge || '').trim();
    const def = badgeDefs()[badgeId];
    if (!def) return res.status(400).json({ error: 'Unknown badge' });
    const earned = (Array.isArray(user.earnedBadges) ? user.earnedBadges : []).filter(id => id !== badgeId);
    updates = { earnedBadges: earned };
    message = `Removed ${def.name} badge from ${user.name}`;
  } else if (command === 'grant_ai') {
    updates = { aiAccess: true };
    message = `Granted AI coder access to ${user.name}`;
  } else if (command === 'revoke_ai') {
    updates = { aiAccess: false };
    message = `Revoked AI coder access from ${user.name}`;
  } else if (command === 'ban') {
    if (isAdmin(user)) return res.status(400).json({ error: 'Cannot ban an admin' });
    const reason = String(req.body?.reason || '').slice(0, 200);
    const days = Math.max(0, Math.min(365, Math.floor(Number(req.body?.days) || 0)));
    updates = { banned: true, banReason: reason, bannedUntil: days > 0 ? Date.now() + days * 864e5 : 0 };
    message = `Banned ${user.name}${days ? ` for ${days} days` : ' permanently'}${reason ? `: ${reason}` : ''}`;
    // Kill their sessions
    await supabase.from('sessions').delete().eq('username', user.name);
  } else if (command === 'unban') {
    updates = { banned: false, banReason: '', bannedUntil: 0 };
    message = `Unbanned ${user.name}`;
  } else if (command === 'grant_admin') {
    if (isAdmin(user)) return res.status(400).json({ error: 'Already an admin' });
    updates = { admin: true };
    message = `Granted full admin to ${user.name}`;
  } else if (command === 'revoke_admin') {
    if (ADMINS.includes(user.name.toLowerCase())) return res.status(400).json({ error: 'Cannot revoke env-based admin' });
    updates = { admin: false };
    message = `Revoked admin from ${user.name}`;
  } else {
    return res.status(400).json({ error: 'Unknown admin command' });
  }
  const { data: updated, error } = await supabase.from('users').update(updates).eq('name', user.name).select().single();
  if (error) return res.status(500).json({ error: error.message });
  const isBanned = !!updated.banned && (!updated.bannedUntil || updated.bannedUntil > Date.now());
  res.json({ ok: true, message, user: { ...await publicUser(updated), funtix: updated.funtix, clubForever: isAdmin(updated) || !!updated.clubForever, aiAccess: isAdmin(updated) || !!updated.aiAccess, banned: isBanned, banReason: updated.banReason || '', bannedUntil: updated.bannedUntil || 0, admin: isAdmin(updated) } });
});

function groupView(group, username) {
  const members = Array.isArray(group.members) ? group.members : [];
  const creator = group.creator || group.owner || 'Unknown';
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
    icon: group.icon || '',
    creator,
    created: group.created,
    members: members.length,
    joined: members.includes(username),
    isCreator: creator === username,
  };
}

app.get('/api/groups', auth, async (req, res) => {
  const { data: groups, error } = await supabase.from('groups').select('*').order('created', { ascending: false }).limit(100);
  if (error) return res.status(500).json({ error: error.message });
  res.json((groups || []).map(group => groupView(group, req.user.name)));
});

app.post('/api/groups', auth, async (req, res) => {
  const name = filter(req.body?.name || '').trim().slice(0, 40);
  const description = filter(req.body?.description || '').trim().slice(0, 240);
  if (name.length < 3) return res.status(400).json({ error: 'Group name must be at least 3 characters' });
  const { data: existing } = await supabase.from('groups').select('id').ilike('name', name).maybeSingle();
  if (existing) return res.status(400).json({ error: 'That group name is already taken' });
  const icon = String(req.body?.icon || '').slice(0, 4);
  const group = { id: `group_${crypto.randomUUID()}`, name, description, icon, creator: req.user.name, members: [req.user.name], created: Date.now() };
  const { data, error } = await supabase.from('groups').insert(group).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(groupView(data, req.user.name));
});

app.post('/api/groups/:id/:action(join|leave)', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const members = Array.isArray(group.members) ? group.members : [];
  let updatedMembers;
  if (req.params.action === 'join') {
    if (members.includes(req.user.name)) return res.json(groupView(group, req.user.name));
    if (members.length >= 100) return res.status(400).json({ error: 'This group is full' });
    updatedMembers = [...members, req.user.name];
  } else {
    if ((group.creator || group.owner) === req.user.name) return res.status(400).json({ error: 'The creator cannot leave their own group' });
    updatedMembers = members.filter(name => name !== req.user.name);
  }
  const { data, error } = await supabase.from('groups').update({ members: updatedMembers }).eq('id', group.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(groupView(data, req.user.name));
});

// Delete group (owner or admin only)
app.delete('/api/groups/:id', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const creator = group.creator || group.owner;
  if (creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'Only the group owner can delete it' });
  const { error } = await supabase.from('groups').delete().eq('id', group.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, message: 'Group deleted' });
});

// Kick member (owner only)
app.post('/api/groups/:id/kick', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const creator = group.creator || group.owner;
  if (creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'Only the group owner can kick members' });
  const target = key(String(req.body?.name || ''));
  if (!target) return res.status(400).json({ error: 'Member name required' });
  if (target === key(creator)) return res.status(400).json({ error: 'Cannot kick the owner' });
  const members = (Array.isArray(group.members) ? group.members : []).filter(m => key(m) !== target);
  const { error } = await supabase.from('groups').update({ members }).eq('id', group.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, message: 'Member kicked' });
});

// Get group details with member list
app.get('/api/groups/:id', auth, async (req, res) => {
  const { data: group, error } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (error || !group) return res.status(404).json({ error: 'Group not found' });
  const members = Array.isArray(group.members) ? group.members : [];
  const gameIds = Array.isArray(group.games) ? group.games : [];
  let games = [];
  if (gameIds.length) {
    const { data: gameRows } = await supabase.from('games').select('id, name, creator, visits').in('id', gameIds);
    games = (gameRows || []).map(g => ({ id: g.id, name: g.name, creator: g.creator, visits: g.visits || 0 }));
  }
  const announcements = (Array.isArray(group.announcements) ? group.announcements : []).slice(0, 50);
  res.json({ ...groupView(group, req.user.name), memberList: members, icon: group.icon || '', games, announcements });
});

// Add game to group (owner only)
app.post('/api/groups/:id/games', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const creator = group.creator || group.owner;
  if (creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'Only the group owner can add games' });
  const gameId = String(req.body?.gameId || '').trim();
  if (!gameId) return res.status(400).json({ error: 'Game ID required' });
  // Verify game exists and user owns it (or is admin)
  const { data: game } = await supabase.from('games').select('id, creator').eq('id', gameId).single();
  if (!game) return res.status(404).json({ error: 'Game not found' });
  if (game.creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'You can only add your own games' });
  const games = Array.isArray(group.games) ? group.games : [];
  if (games.includes(gameId)) return res.status(400).json({ error: 'Game already in group' });
  if (games.length >= 20) return res.status(400).json({ error: 'Group already has 20 games' });
  const { error } = await supabase.from('groups').update({ games: [...games, gameId] }).eq('id', group.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Remove game from group (owner only)
app.delete('/api/groups/:id/games/:gameId', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const creator = group.creator || group.owner;
  if (creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'Only the group owner can remove games' });
  const games = (Array.isArray(group.games) ? group.games : []).filter(g => g !== req.params.gameId);
  const { error } = await supabase.from('groups').update({ games }).eq('id', group.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Post announcement (owner only)
app.post('/api/groups/:id/announcements', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const creator = group.creator || group.owner;
  if (creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'Only the group owner can post announcements' });
  const title = filter(String(req.body?.title || '')).trim().slice(0, 80);
  const content = filter(String(req.body?.content || '')).trim().slice(0, 1000);
  if (!title || !content) return res.status(400).json({ error: 'Title and content required' });
  const announcements = Array.isArray(group.announcements) ? group.announcements : [];
  if (announcements.length >= 50) return res.status(400).json({ error: 'Too many announcements, delete some first' });
  const ann = { id: 'a' + Date.now().toString(36), title, content, author: req.user.name, created: Date.now() };
  const { error } = await supabase.from('groups').update({ announcements: [ann, ...announcements] }).eq('id', group.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, announcement: ann });
});

// Delete announcement (owner only)
app.delete('/api/groups/:id/announcements/:annId', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const creator = group.creator || group.owner;
  if (creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'Only the group owner can delete announcements' });
  const announcements = (Array.isArray(group.announcements) ? group.announcements : []).filter(a => a.id !== req.params.annId);
  const { error } = await supabase.from('groups').update({ announcements }).eq('id', group.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true });
});

// Update group (owner: icon, description)
app.put('/api/groups/:id', auth, async (req, res) => {
  const { data: group, error: findError } = await supabase.from('groups').select('*').eq('id', req.params.id).single();
  if (findError || !group) return res.status(404).json({ error: 'Group not found' });
  const creator = group.creator || group.owner;
  if (creator !== req.user.name && !req.user.admin) return res.status(403).json({ error: 'Only the group owner can edit it' });
  const updates = {};
  if (req.body?.description !== undefined) updates.description = filter(String(req.body.description)).trim().slice(0, 240);
  if (req.body?.icon !== undefined) updates.icon = String(req.body.icon).slice(0, 4);
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
  const { data, error } = await supabase.from('groups').update(updates).eq('id', group.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(groupView(data, req.user.name));
});

app.get('/api/friends', auth, async (req, res) => {
  const { data: friends } = await supabase.from('users').select('*').in('name', req.user.friends || []);
  const { data: requests } = await supabase.from('users').select('*').in('name', req.user.requests || []);
  res.json({
    friends: await Promise.all((friends || []).map(publicUser)),
    requests: await Promise.all((requests || []).map(publicUser)),
  });
});

app.post('/api/friends/:name', auth, async (req, res) => {
  const { data: other, error: oErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  const me = req.user, mk = key(me.name);
  if (oErr || !other || other.name === me.name) return res.status(400).json({ error: 'Invalid user' });
  const ok = other.name;
  if ((me.friends || []).includes(ok)) return res.json({ status: 'friends' });
  if ((me.requests || []).includes(ok)) {
    const updatedMe = { friends: [...(me.friends || []), ok], requests: (me.requests || []).filter(x => x !== ok) };
    await supabase.from('users').update(updatedMe).eq('name', me.name);
    await supabase.from('users').update({ friends: [...(other.friends || []), mk] }).eq('name', ok);
    notify(ok, 'friend', `${me.name} accepted your friend request`, '#/friends');
    return res.json({ status: 'friends' });
  }
  const updatedOther = { requests: [...(other.requests || []), mk] };
  await supabase.from('users').update(updatedOther).eq('name', ok);
  notify(ok, 'friend', `${me.name} sent you a friend request`, '#/friends');
  res.json({ status: 'requested' });
});

app.delete('/api/friends/:name', auth, async (req, res) => {
  const { data: other, error: oErr } = await supabase.from('users').select('*').eq('name', key(req.params.name)).single();
  if (oErr || !other) return res.status(404).json({ error: 'User not found' });
  const ok = other.name, mk = req.user.name;
  const updatedMe = { friends: (req.user.friends || []).filter(x => x !== ok), requests: (req.user.requests || []).filter(x => x !== ok) };
  await supabase.from('users').update(updatedMe).eq('name', req.user.name);
  await supabase.from('users').update({ friends: (other.friends || []).filter(x => x !== mk) }).eq('name', ok);
  res.json({ ok: true });
});

app.get('/api/games', auth, async (req, res) => {
  const q = key(String(req.query.q || ''));
  let query = supabase.from('games').select('*').eq('unpublished', false);
  if (q) query = query.or(`name.ilike.%${q}%,creator.ilike.%${q}%`);
  const { data: games } = await query;
  const list = (games || []).map(gameSummary);
  list.sort((a, b) => (b.playing - a.playing) || (b.visits - a.visits));
  res.json(list);
});

app.get('/api/mygames', auth, async (req, res) => {
  const { data: games } = await supabase.from('games').select('*').eq('creator', key(req.user.name));
  res.json((games || []).map(g => ({ ...gameSummary(g), unpublished: !!g.unpublished })));
});

app.get('/api/games/:id', auth, async (req, res) => {
  const { data: g, error: gErr } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (gErr || !g) return res.status(404).json({ error: 'Game not found' });
  const vote = g.votes?.[key(req.user.name)] || 0;
  res.json({ ...gameSummary(g), description: g.description, max_players: g.max_players || 30, created: g.created, world: g.world, unpublished: !!g.unpublished, vote, favorited: (req.user.favorites || []).includes(g.id), favorites: g.favorite_count || 0 });
});

app.post('/api/games', auth, async (req, res) => {
  const { name, description, world, thumbnail, publish } = req.body || {};
  const id = `g_${crypto.randomUUID()}`;
  const game = {
    id, name: filter(name || 'Untitled Game').slice(0, 50), creator: req.user.name, description: filter(description || '').slice(0, 1000), world: sanitizeWorld(world), visits: 0, likes: 0, dislikes: 0, max_players: 30, created: Date.now(), updated: Date.now(), thumbnail: validThumb(thumbnail), unpublished: !publish
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
  const { error } = await supabase.from('games').update(updates).eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
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
  const f = req.user.favorites || [];
  let favoriteCount = g.favorite_count || 0;
  if (f.includes(g.id)) { 
    const updatedF = f.filter(x => x !== g.id);
    await supabase.from('users').update({ favorites: updatedF }).eq('name', req.user.name);
    favoriteCount--;
  } else { 
    const updatedF = [...f, g.id];
    await supabase.from('users').update({ favorites: updatedF }).eq('name', req.user.name);
    favoriteCount++;
  }
  await supabase.from('games').update({ favorite_count: favoriteCount }).eq('id', g.id);
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
function sanitizeScript(s) {
  if (!s || typeof s !== 'object') return undefined;
  const onTouch = s.onTouch;
  if (!onTouch || typeof onTouch !== 'object') return undefined;
  const action = String(onTouch.action || 'none');
  if (!['message', 'tix', 'teleport', 'kill'].includes(action)) return undefined;
  const out = { onTouch: { action } };
  if (action === 'message') out.onTouch.text = String(onTouch.text || '').slice(0, 120);
  if (action === 'tix') out.onTouch.amount = Math.max(1, Math.min(100, Math.floor(Number(onTouch.amount) || 5)));
  if (action === 'teleport') {
    const num = v => (Number.isFinite(+v) ? +v : 0);
    out.onTouch.x = Math.max(-2000, Math.min(2000, num(onTouch.x)));
    out.onTouch.y = Math.max(-2000, Math.min(2000, num(onTouch.y)));
    out.onTouch.z = Math.max(-2000, Math.min(2000, num(onTouch.z)));
  }
  return out;
}
function sanitizeWorld(w) {
  const num = v => (Number.isFinite(+v) ? +v : 0);
  const parts = (Array.isArray(w?.parts) ? w.parts : []).slice(0, 5000).map((p, i) => ({
    id: String(p.id || 'p' + i).slice(0, 20), name: String(p.name || 'Part').slice(0, 40),
    p: [0, 1, 2].map(j => num(p.p?.[j])), s: [0, 1, 2].map(j => Math.max(0.05, Math.min(2048, num(p.s?.[j]) || 1))),
    c: /^(#[0-9a-fA-F]{6}|hsl\(\d+,\d+%\,\d+%\))$/.test(p.c) ? p.c : '#a3a2a5',
    k: ['part', 'spawn', 'kill', 'checkpoint', 'win', 'bounce', 'coin', 'speed'].includes(p.k) ? p.k : 'part',
    m: ['plastic', 'neon', 'grass', 'wood', 'brick', 'glass', 'concrete', 'sand', 'baseplate', 'spawn', 'metal'].includes(p.m) ? p.m : 'plastic',
    ...(p.cc === false ? { cc: false } : {}), ...(p.tr ? { tr: Math.max(0, Math.min(1, num(p.tr))) } : {}),
    ...(sanitizeScript(p.script) ? { script: sanitizeScript(p.script) } : {}),
    ...(p.folder ? { folder: String(p.folder).slice(0, 20) } : {}),
  }));
  const htmlScripts = Array.isArray(w?.htmlScripts) ? w.htmlScripts.slice(0, 20).map((s, i) => ({
    id: String(s.id || 'hs' + i).slice(0, 20),
    name: String(s.name || 'Script').slice(0, 40),
    code: String(s.code || '').slice(0, 20000),
  })) : [];
  const folders = Array.isArray(w?.folders) ? w.folders.slice(0, 100).map((f, i) => ({
    id: String(f.id || 'f' + i).slice(0, 20),
    name: String(f.name || 'Folder').slice(0, 40),
    parent: String(f.parent || '').slice(0, 20),
  })) : [];
  const scripts = Array.isArray(w?.scripts) ? w.scripts.slice(0, 50).map((s, i) => ({
    id: String(s.id || 's' + i).slice(0, 20),
    name: String(s.name || 'script.js').slice(0, 40),
    folder: String(s.folder || '').slice(0, 20),
    code: String(s.code || '').slice(0, 20000),
  })) : [];
  return { sky: /^#[0-9a-fA-F]{6}$/.test(w?.sky) ? w.sky : '#8fc8ff', parts,
    ...(htmlScripts.length ? { htmlScripts } : {}),
    ...(folders.length ? { folders } : {}),
    ...(scripts.length ? { scripts } : {}) };
}

function winBadges(game) {
  const kinds = new Set((game?.world?.parts || []).map(part => part.k));
  return [
    'game_first_win',
    ...(kinds.has('coin') ? ['game_coin_hunter'] : []),
    ...(kinds.has('speed') ? ['game_speedster'] : []),
    ...(kinds.has('bounce') ? ['game_bouncer'] : []),
    ...(kinds.has('checkpoint') ? ['game_checkpoint'] : []),
    ...(kinds.has('kill') ? ['game_survivor'] : []),
    ...((game?.world?.parts || []).length >= 50 ? ['game_explorer'] : []),
  ];
}

app.get('/api/catalog', (req, res) => res.json(CATALOG));

// ---------- direct messages & notifications ----------
async function notify(username, type, text, link = '') {
  try { await supabase.from('notifications').insert({ username, type, text, link, created: Date.now() }); }
  catch (e) { console.warn('notify failed:', e.message); }
}

app.get('/api/dms', auth, async (req, res) => {
  const me = req.user.name;
  const { data } = await supabase.from('dms').select('*').or(`sender.eq.${me},recipient.eq.${me}`).order('created', { ascending: false }).limit(500);
  const convos = new Map();
  for (const m of (data || [])) {
    const other = m.sender === me ? m.recipient : m.sender;
    if (!convos.has(other)) convos.set(other, { name: other, lastText: m.text, lastCreated: m.created, unread: 0 });
    if (m.recipient === me && !m.read) convos.get(other).unread++;
  }
  res.json([...convos.values()]);
});

app.get('/api/dm/:name', auth, async (req, res) => {
  const me = req.user.name;
  const { data: u } = await supabase.from('users').select('name').eq('name', key(req.params.name)).maybeSingle();
  if (!u) return res.status(404).json({ error: 'User not found' });
  const other = u.name;
  const { data } = await supabase.from('dms').select('*')
    .or(`and(sender.eq.${me},recipient.eq.${other}),and(sender.eq.${other},recipient.eq.${me})`)
    .order('created', { ascending: true }).limit(200);
  await supabase.from('dms').update({ read: true }).eq('recipient', me).eq('sender', other).eq('read', false);
  res.json(data || []);
});

app.post('/api/dm/:name', auth, async (req, res) => {
  const me = req.user.name;
  const text = String(req.body?.text || '').trim().slice(0, 500);
  if (!text) return res.status(400).json({ error: 'Empty message' });
  const { data: u } = await supabase.from('users').select('name').eq('name', key(req.params.name)).maybeSingle();
  if (!u || u.name === me) return res.status(400).json({ error: 'Invalid user' });
  const { data, error } = await supabase.from('dms').insert({ sender: me, recipient: u.name, text, created: Date.now() }).select().single();
  if (error) return res.status(500).json({ error: 'Could not send' });
  notify(u.name, 'dm', `${me} sent you a message`, `#/messages/${encodeURIComponent(me)}`);
  res.json(data);
});

app.get('/api/notifications', auth, async (req, res) => {
  const me = req.user.name;
  const { data } = await supabase.from('notifications').select('*').eq('username', me).order('created', { ascending: false }).limit(30);
  const list = data || [];
  res.json({ list, unread: list.filter(n => !n.read).length });
});

app.post('/api/notifications/read', auth, async (req, res) => {
  const me = req.user.name;
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isFinite) : null;
  let q = supabase.from('notifications').update({ read: true }).eq('username', me).eq('read', false);
  if (ids && ids.length) q = q.in('id', ids);
  await q;
  res.json({ ok: true });
});

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
      if (!session) return send(ws, { t: 'error', error: 'Could not join' });
      
      const uname = session.username;
      const [userRes, gameRes] = await Promise.all([
        supabase.from('users').select('*').eq('name', uname).maybeSingle(),
        supabase.from('games').select('*').eq('id', m.gameId).maybeSingle(),
      ]);
      
      const u = userRes.data;
      const g = gameRes.data;

      if (!u || !g) return send(ws, { t: 'error', error: 'Could not join' });
      if (!rooms.has(g.id)) rooms.set(g.id, { players: new Map(), coins: new Set((g.world?.parts || []).filter(p => p.k === 'coin').map(p => p.id)) });
      room = rooms.get(g.id);
      if (room.players.size >= (g.max_players || 30)) return send(ws, { t: 'error', error: 'Server is full' });
      for (const p of room.players.values()) if (p.user === u) { send(p.ws, { t: 'error', error: 'You joined from another window' }); p.ws.close(); }
      player = { id: nextPid++, gameId: g.id, game: g, ws, user: u, name: u.name, avatar: u.avatar, s: null, coins: new Set(), lastCoin: 0, lastTix: Date.now() };
      
      // SPEED UP: Background updates (no await)
      supabase.from('games').update({ visits: (g.visits || 0) + 1 }).eq('id', g.id).then(res => {
        if (res.error) console.error('Visit update failed:', res.error);
      });
      
      const updatedRecent = [g.id, ... (u.recent || []).filter(x => x !== g.id)].slice(0, 12);
      supabase.from('users').update({ recent: updatedRecent }).eq('name', u.name).then(res => {
        if (res.error) console.error('Recent games update failed:', res.error);
      });
      
      touch(u.name, g.id);
      send(ws, { t: 'welcome', id: player.id, players: [...room.players.values()].map(p => ({ id: p.id, name: p.name, avatar: p.avatar, s: p.s, club: isClub(p.user), badge: badgeOf(p.user) })), ...money(u), club: isClub(u), badge: badgeOf(u) });
      room.players.set(player.id, player);
      broadcast(room, { t: 'joined', id: player.id, name: player.name, avatar: player.avatar, club: isClub(u), badge: badgeOf(u) }, ws);
      broadcast(room, { t: 'chat', system: true, text: `${player.name} has joined the game.` });
      return;
    }
    if (!player) return;
    if (m.t === 's' && Array.isArray(m.s)) { player.s = m.s.slice(0, 6).map(Number); touch(player.name, player.gameId);
      // REMOVED: Repetitive FunTix add (playtime reward)
    }
    else if (m.t === 'chat' && typeof m.text === 'string' && m.text.trim()) {
      const text = filter(m.text.trim());
      broadcast(room, { t: 'chat', id: player.id, name: player.name, text, club: isClub(player.user), badge: badgeOf(player.user) });
    }
    else if (m.t === 'coin' && typeof m.part === 'string') {
      const now = Date.now();
      if (!room.coins.has(m.part) || player.coins.has(m.part) || now - player.lastCoin < 150) return;
      const coinId = m.part;
      player.coins.add(coinId); player.lastCoin = now;
      const earned = ECON.COIN_TIX + (isClub(player.user) ? (Number(ECON.CLUB_COIN_BONUS) || 0) : 0);
      const { data: updated, error } = await supabase.from('users').update({ funtix: (Number(player.user.funtix) || 0) + earned }).eq('name', player.user.name).select().single();
      if (error || !updated) return send(ws, { t: 'error', error: 'Could not add FunTix' });
      player.user = updated;
      send(ws, { t: 'money', ...money(updated), earned });
    }
    else if (m.t === 'scriptTix') {
      const now = Date.now();
      const amt = Math.max(1, Math.min(100, Math.floor(Number(m.amount) || 0)));
      if (!amt) return;
      const st = player.scriptTix || (player.scriptTix = { last: 0, total: 0 });
      if (now - st.last < 5000 || st.total + amt > 500) return;
      st.last = now; st.total += amt;
      const { data: updated, error } = await supabase.from('users').update({ funtix: (Number(player.user.funtix) || 0) + amt }).eq('name', player.user.name).select().single();
      if (error || !updated) return send(ws, { t: 'error', error: 'Could not add FunTix' });
      player.user = updated;
      send(ws, { t: 'money', ...money(updated), earned: amt });
    }
    else if (m.t === 'win') {
      if (player.won) return; player.won = true;
      let earnedBadges = [...new Set([...list(player.user, 'earnedBadges'), ...winBadges(player.game)])];
      let inventory = list(player.user, 'inventory');
      let looneyWins = Array.isArray(player.user.looneyWins) ? [...player.user.looneyWins] : [];
      let looneyComplete = false, looneyCoin = false;
      if (player.game.event === 'looney' && looneyActive() && !looneyWins.includes(player.game.id)) {
        looneyWins.push(player.game.id); looneyCoin = true;
        if (looneyWins.length >= LOONEY_EVENT.need && !earnedBadges.includes(LOONEY_EVENT.badge)) {
          earnedBadges.push(LOONEY_EVENT.badge);
          inventory = [...new Set([...inventory, ...LOONEY_EVENT.items])];
          looneyComplete = true;
        }
      }
      const winUpdate = { funtix: (Number(player.user.funtix) || 0) + ECON.WIN_TIX, champ: true, earnedBadges, inventory, looneyWins };
      let { data: updated, error } = await supabase.from('users').update(winUpdate).eq('name', player.user.name).select().single();
      if (error) {
        // If the looneyWins column is missing (migration not run), still grant the win reward
        console.log('win update failed, retrying without looneyWins:', error.message);
        looneyCoin = false; looneyComplete = false;
        const retry = await supabase.from('users').update({ funtix: winUpdate.funtix, champ: true, earnedBadges, inventory }).eq('name', player.user.name).select().single();
        updated = retry.data; error = retry.error;
      }
      if (error || !updated) return send(ws, { t: 'error', error: 'Could not add FunTix' });
      player.user = updated;
      send(ws, { t: 'money', ...money(updated), earned: ECON.WIN_TIX, ...(looneyCoin ? { looneyCoins: looneyWins.length } : {}) });
      broadcast(room, { t: 'chat', system: true, text: `${player.name} beat the game! (+${ECON.WIN_TIX} FunTix, ${winBadges(player.game).length} badge${winBadges(player.game).length === 1 ? '' : 's'} earned)` });
      if (looneyComplete) {
        notify(player.name, 'event', 'You collected all 20 Looney Coins! Bugs Bunny, Daffy Duck and the Looney Tunes badge are yours!', '#/looney');
        broadcast(room, { t: 'chat', system: true, text: `🎉 ${player.name} collected all 20 Looney Coins and earned Bugs Bunny, Daffy Duck and the Looney Tunes badge!` });
      }
    }
    else if (m.t === 'emote' && ['wave', 'dance', 'sit'].includes(m.e)) broadcast(room, { t: 'emote', id: player.id, e: m.e }, ws);
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

// ---------- AI Coder (rule-based generator, swap for LLM later) ----------
function aiGenerateParts(prompt) {
  const p = String(prompt || '').toLowerCase().slice(0, 500);
  const parts = [];
  let n = 1;
  const nid = () => 'ai' + (n++) + '_' + Math.random().toString(36).slice(2, 6);
  const add = (name, k, s, c, m, x, y, z, extra = {}) => {
    parts.push({ id: nid(), name: String(name).slice(0, 40), k, s, c, m, p: [x, y, z], ...extra });
  };
  const has = (...words) => words.some(w => p.includes(w));
  if (has('obby', 'obstacle', 'course', 'parkour')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', 0, 10.8, 0);
    for (let i = 0; i < 5; i++) {
      const x = (i + 1) * 10;
      add('Platform ' + (i + 1), 'part', [6, 1, 6], '#a3a2a5', 'plastic', x, 10, 0);
      add('Checkpoint ' + (i + 1), 'checkpoint', [5, 0.5, 5], '#2ec4ff', 'neon', x, 10.8, 0);
      if (i % 2 === 1) add('Coin ' + (i + 1), 'coin', [1.2, 1.2, 1.2], '#ffd400', 'plastic', x, 12, 3);
    }
    add('Lava Pit', 'kill', [30, 1, 16], '#ff4500', 'neon', 30, 5, 0);
    add('Win Pad', 'win', [8, 0.5, 8], '#ffffff', 'neon', 60, 10.8, 0,
      { script: { onTouch: { action: 'message', text: 'You win!' } } });
  }
  if (has('tower', 'climb')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', 20, 10.8, 0);
    for (let i = 0; i < 6; i++) {
      add('Tower Level ' + (i + 1), 'part', [10 - i, 1, 10 - i], '#c0c0c0', 'concrete', 0, 10 + i * 5, 0);
    }
    add('Win Pad', 'win', [8, 0.5, 8], '#ffffff', 'neon', 0, 41, 0);
  }
  if (has('lava')) {
    add('Lava', 'kill', [12, 1, 12], '#ff4500', 'neon', 0, 10, 0,
      { script: { onTouch: { action: 'message', text: 'Ouch! Lava!' } } });
  }
  if (has('coin', 'collect', 'treasure')) {
    for (let i = 0; i < 6; i++) {
      add('Coin ' + (i + 1), 'coin', [1.2, 1.2, 1.2], '#ffd400', 'plastic', i * 4 - 10, 12, 5);
    }
    add('Gem', 'coin', [1.5, 1.5, 1.5], '#00ffcc', 'neon', 0, 12, -5,
      { script: { onTouch: { action: 'tix', amount: 10 } } });
  }
  if (has('bounce', 'trampoline')) {
    for (let i = 0; i < 3; i++) add('Bounce ' + (i + 1), 'bounce', [6, 1, 6], '#22ff88', 'neon', i * 12, 10, 0);
  }
  if (has('speed', 'race')) {
    for (let i = 0; i < 3; i++) add('Speed ' + (i + 1), 'speed', [4, 0.5, 4], '#ff9800', 'neon', i * 12, 10.5, 0);
  }
  if (has('teleport', 'portal')) {
    add('Portal', 'part', [4, 6, 1], '#8a4bd8', 'neon', 0, 13, 0,
      { script: { onTouch: { action: 'teleport', x: 20, y: 15, z: 0 } } });
    add('Portal Exit', 'part', [4, 1, 4], '#8a4bd8', 'neon', 20, 10, 0);
  }
  if (has('message', 'sign', 'text')) {
    const msg = String(prompt).slice(0, 60);
    add('Message Sign', 'part', [6, 3, 1], '#ffffff', 'plastic', 0, 12, 0,
      { script: { onTouch: { action: 'message', text: msg || 'Hello!' } } });
  }
  if (has('house', 'home', 'cabin')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', 0, 10.8, 12);
    add('Floor', 'part', [14, 1, 12], '#8b6f4e', 'plastic', 0, 10, 0);
    add('Wall Back', 'part', [14, 8, 1], '#c9a96a', 'plastic', 0, 14, -6);
    add('Wall Left', 'part', [1, 8, 12], '#c9a96a', 'plastic', -7, 14, 0);
    add('Wall Right', 'part', [1, 8, 12], '#c9a96a', 'plastic', 7, 14, 0);
    add('Roof', 'part', [16, 1, 14], '#a33d2e', 'plastic', 0, 18.5, 0);
    add('Door', 'part', [4, 6, 0.5], '#5b3a1e', 'plastic', 0, 13, 6);
  }
  if (has('maze')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', -18, 10.8, -18);
    const walls = [[0,-10,20,1],[10,0,1,20],[-10,5,1,15],[0,10,15,1],[-5,-5,10,1]];
    walls.forEach(([x, z, sx, sz], i) => add('Maze Wall ' + (i+1), 'part', [sx, 6, sz], '#7a7a8a', 'concrete', x, 13, z));
    add('Win Pad', 'win', [6, 0.5, 6], '#ffffff', 'neon', 18, 10.8, 18);
  }
  if (has('bridge')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', -20, 10.8, 0);
    for (let i = 0; i < 8; i++) add('Plank ' + (i+1), 'part', [4, 0.5, 6], '#8b6f4e', 'plastic', -16 + i * 4.5, 10, 0);
    add('Win Pad', 'win', [8, 0.5, 8], '#ffffff', 'neon', 22, 10.8, 0);
    add('Lava Below', 'kill', [50, 1, 20], '#ff4500', 'neon', 0, 4, 0);
  }
  if (has('stairs', 'staircase')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', 0, 10.8, 10);
    for (let i = 0; i < 8; i++) add('Step ' + (i+1), 'part', [8, 1, 4], '#a3a2a5', 'concrete', 0, 10 + i * 1.2, 6 - i * 4);
    add('Win Pad', 'win', [8, 0.5, 8], '#ffffff', 'neon', 0, 20, -24);
  }
  if (has('castle', 'fort')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', 0, 10.8, 20);
    for (const [x, z] of [[-10,-10],[10,-10],[-10,10],[10,10]])
      add('Tower', 'part', [6, 20, 6], '#9a9aa5', 'concrete', x, 18, z);
    add('Wall N', 'part', [26, 10, 2], '#9a9aa5', 'concrete', 0, 15, -10);
    add('Wall S', 'part', [26, 10, 2], '#9a9aa5', 'concrete', 0, 15, 10);
    add('Gate', 'part', [8, 8, 1], '#5b3a1e', 'plastic', 0, 14, 10);
    add('Win Pad', 'win', [8, 0.5, 8], '#ffd400', 'neon', 0, 10.8, 0);
  }
  if (has('shop', 'store')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', 0, 10.8, 15);
    add('Shop Floor', 'part', [20, 1, 16], '#d4c5a0', 'plastic', 0, 10, 0);
    add('Counter', 'part', [10, 3, 2], '#8b6f4e', 'plastic', 0, 11.5, -4,
      { script: { onTouch: { action: 'message', text: 'Welcome to the shop!' } } });
  }
  if (has('race', 'track') && !has('speed')) {
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', -25, 10.8, 0);
    for (let i = 0; i < 10; i++) {
      add('Track ' + (i+1), 'part', [6, 0.5, 10], i % 2 ? '#cc3333' : '#eeeeee', 'plastic', -22 + i * 6, 10, 0);
      if (i % 3 === 1) add('Boost ' + (i+1), 'speed', [4, 0.5, 4], '#ff9800', 'neon', -22 + i * 6, 10.5, 0);
    }
    add('Win Pad', 'win', [8, 0.5, 8], '#ffffff', 'neon', 38, 10.8, 0);
  }
  if (!parts.length) {
    // Default: a starter platform with a message script
    add('Spawn', 'spawn', [6, 0.5, 6], '#6b6b6b', 'spawn', 0, 10.8, 0);
    add('Starter Platform', 'part', [12, 1, 12], '#8b9a6b', 'grass', 0, 10, 0);
    add('Welcome Sign', 'part', [6, 3, 1], '#ffffff', 'plastic', 0, 13, -5,
      { script: { onTouch: { action: 'message', text: 'Welcome to my game!' } } });
  }
  return parts.slice(0, 50);
}
function aiGenerateHtml(prompt) {
  const p = String(prompt || '').toLowerCase();
  const has = (...words) => words.some(w => p.includes(w));
  if (has('shop', 'store', 'buy')) {
    return `<!-- AI-generated Shop UI - paste into your game's HTML -->
<div id="ai-shop" style="position:fixed;top:20px;right:20px;background:#1b1d1f;color:#fff;padding:16px;border-radius:12px;min-width:200px;z-index:9999">
  <h3 style="margin:0 0 12px">Shop</h3>
  <button onclick="buyItem('sword')" style="display:block;width:100%;margin:6px 0;padding:8px;background:#2f8cff;border:none;border-radius:8px;color:#fff;cursor:pointer">Buy Sword (100 Tix)</button>
  <button onclick="buyItem('shield')" style="display:block;width:100%;margin:6px 0;padding:8px;background:#2f8cff;border:none;border-radius:8px;color:#fff;cursor:pointer">Buy Shield (150 Tix)</button>
</div>
<script>
function buyItem(item) {
  console.log('Buying', item);
  // Connect to Funtopia API: POST /api/buy/<item-id>
  alert('Added ' + item + ' to cart!');
}
</script>`;
  }
  if (has('dialog', 'npc', 'talk', 'chat')) {
    return `<!-- AI-generated Dialog Box -->
<div id="ai-dialog" style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:#fff;color:#111;padding:16px 24px;border-radius:12px;max-width:400px;box-shadow:0 4px 20px rgba(0,0,0,0.3);z-index:9999;display:none">
  <b id="ai-dialog-name">NPC</b>
  <p id="ai-dialog-text" style="margin:8px 0"></p>
  <button onclick="document.getElementById('ai-dialog').style.display='none'" style="padding:6px 16px;background:#2f8cff;color:#fff;border:none;border-radius:8px;cursor:pointer">Close</button>
</div>
<script>
function showDialog(name, text) {
  document.getElementById('ai-dialog-name').textContent = name;
  document.getElementById('ai-dialog-text').textContent = text;
  document.getElementById('ai-dialog').style.display = 'block';
}
// Example: showDialog('Merchant', 'Welcome to my shop!');
</script>`;
  }
  if (has('hud', 'leaderboard', 'score')) {
    return `<!-- AI-generated HUD -->
<div id="ai-hud" style="position:fixed;top:20px;left:20px;background:rgba(0,0,0,0.7);color:#fff;padding:12px 16px;border-radius:12px;z-index:9999;font-family:system-ui">
  <div>Score: <b id="ai-score">0</b></div>
  <div>Coins: <b id="ai-coins">0</b></div>
</div>
<script>
let aiScore = 0, aiCoins = 0;
function addScore(n) { aiScore += n; document.getElementById('ai-score').textContent = aiScore; }
function addCoins(n) { aiCoins += n; document.getElementById('ai-coins').textContent = aiCoins; }
</script>`;
  }
  if (has('button', 'teleport')) {
    return `<!-- AI-generated Teleport Buttons -->
<div style="position:fixed;bottom:20px;right:20px;z-index:9999;display:flex;gap:8px">
  <button onclick="teleportTo(0,20,0)" style="padding:10px 16px;background:#8a4bd8;color:#fff;border:none;border-radius:8px;cursor:pointer">Spawn</button>
  <button onclick="teleportTo(50,20,0)" style="padding:10px 16px;background:#8a4bd8;color:#fff;border:none;border-radius:8px;cursor:pointer">Arena</button>
</div>
<script>
function teleportTo(x, y, z) {
  console.log('Teleport to', x, y, z);
  // In Funtopia: set player position via game API
}
</script>`;
  }
  return `<!-- AI-generated HTML snippet -->
<!-- Prompt: ${String(prompt).slice(0, 80).replace(/</g, '&lt;')} -->
<div style="padding:16px;background:#f0f0f0;border-radius:8px">
  <p>Custom HTML for your Funtopia game. Edit me!</p>
</div>
<script>
console.log('Funtopia AI script loaded');
</script>`;
}
function aiGenerateScripts(prompt) {
  const p = String(prompt || '').toLowerCase().slice(0, 500);
  const scripts = [];
  let n = 1;
  const nid = () => 'ais' + (n++) + '_' + Math.random().toString(36).slice(2, 6);
  const has = (...words) => words.some(w => p.includes(w));
  const add = (name, code) => scripts.push({ id: nid(), name, folder: '', code });

  if (has('welcome', 'greeting', 'hello', 'intro')) {
    add('welcome.js',
`// Welcome message when the game starts
onStart(() => {
  say(null, 'Welcome to the game! Have fun!');
});`);
  }
  if (has('kill', 'lava', 'death', 'damage', 'die')) {
    add('killOnTouch.js',
`// Kill the player when they touch lava
onTouch('Lava', () => {
  say(null, 'Ouch! That was hot!');
  kill();
});`);
  }
  if (has('teleport', 'portal')) {
    add('teleport.js',
`// Teleport when touching the portal
onTouch('Portal', () => {
  teleport(null, 20, 15, 0);
  say(null, 'Teleported!');
});`);
  }
  if (has('tix', 'coin', 'reward', 'money', 'prize')) {
    add('reward.js',
`// Give FunTix when touching a coin
onTouch('Coin', () => {
  giveTix(null, 10);
  say(null, '+10 FunTix!');
});`);
  }
  if (has('message', 'say', 'announce', 'dialog')) {
    add('announce.js',
`// Show a message when touching the sign
onTouch('Sign', (player) => {
  say(player, 'Hello traveler!');
});`);
  }
  if (has('win', 'victory', 'finish')) {
    add('win.js',
`// Celebrate when reaching the win pad
onTouch('Win Pad', () => {
  say(null, 'You win! Congratulations!');
  giveTix(null, 50);
});`);
  }
  if (has('score', 'points', 'counter')) {
    add('score.js',
`// Score system - touch coins to score points
let target = 100;
onStart(() => {
  setScore(0);
  say(null, 'Score 100 points to win!');
});
onTouch('Coin', () => {
  const s = addScore(10);
  say(null, 'Score: ' + s);
  if (s >= target) {
    say(null, 'You reached ' + target + ' points!');
    giveTix(null, 50);
  }
});`);
  }
  if (has('checkpoint')) {
    add('checkpoints.js',
`// Custom checkpoint logic
onTouch('Checkpoint', () => {
  const pos = getPos();
  setCheckpoint(pos.x, pos.y + 1, pos.z);
});`);
  }
  if (has('health', 'damage', 'heal', 'poison')) {
    add('hazard.js',
`// Damage zone - standing in poison hurts
onTick((dt) => {
  const pos = getPos();
  // Damage if below y=5 (in the poison zone)
  if (pos.y < 5 && getHealth() > 0) {
    damage(null, 20 * dt);
  }
});
onTouch('Medkit', () => {
  heal(null, 50);
  say(null, '+50 health!');
  hidePart('Medkit');
});`);
  }
  if (has('chat', 'command')) {
    add('chatCommands.js',
`// Chat commands - type !tix or !spawn in chat
onChat((name, text) => {
  if (text === '!tix') {
    giveTix(null, 5);
    sayAll(name + ' used !tix');
  } else if (text === '!spawn') {
    teleport(null, 0, 15, 0);
    say(null, 'Teleported to spawn!');
  }
});
onStart(() => {
  say(null, 'Type !tix or !spawn in chat!');
});`);
  }
  if (has('day', 'night', 'sky')) {
    add('skyCycle.js',
`// Day/night sky cycle
let time = 0;
onTick((dt) => {
  time += dt * 0.05;
  // Note: sky color API coming soon - for now show time
  if (Math.floor(time) !== Math.floor(time - dt * 0.05)) {
    // Every second update
  }
});
onStart(() => {
  say(null, 'Survive the night!');
});`);
  }
  if (has('hide', 'seek', 'secret', 'door')) {
    add('secretDoor.js',
`// Secret door - say the password in chat
onChat((name, text) => {
  if (text.toLowerCase() === 'open sesame') {
    showPart('Secret Door');
    sayAll(name + ' opened the secret door!');
    hidePart('Secret Door');
  }
});
onStart(() => {
  say(null, 'Say "open sesame" in chat...');
});`);
  }
  // Generic script request
  if (has('script') && !scripts.length) {
    add('custom.js',
`// Custom script - edit me!
onStart(() => {
  console.log('Script loaded!');
});

// Uncomment to run when touching a part:
// onTouch('PartName', () => {
//   say(null, 'Touched!');
// });`);
  }
  return scripts;
}
app.post('/api/ai/coder', auth, async (req, res) => {
  if (!req.user.admin && !req.user.aiAccess) return res.status(403).json({ error: 'AI coder is restricted. Ask an admin for access.' });
  const prompt = String(req.body?.prompt || '').trim().slice(0, 500);
  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });
  try {
    const parts = aiGenerateParts(prompt);
    const html = aiGenerateHtml(prompt);
    const scripts = aiGenerateScripts(prompt);
    res.json({ parts, html, scripts, message: `Generated ${parts.length} parts, ${scripts.length} scripts + HTML snippet.` });
  } catch (e) {
    res.status(500).json({ error: 'AI coder failed: ' + e.message });
  }
});

// ---------- HTML export for games ----------
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
app.get('/g/:id.html', async (req, res) => {
  const { data: g } = await supabase.from('games').select('*').eq('id', req.params.id).single();
  if (!g || g.unpublished) return res.status(404).send('Game not found');
  const world = g.world || { sky: '#8fc8ff', parts: [] };
  const worldJson = JSON.stringify(world).replace(/</g, '\\u003c');
  const title = escapeHtml(g.name || 'Funtopia Game');
  const desc = escapeHtml(g.description || '');
  const creator = escapeHtml(g.creator || 'Unknown');
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title} - Funtopia</title>
<style>
body { margin: 0; font-family: system-ui, sans-serif; background: #111; color: #fff; }
#hdr { padding: 12px 16px; background: #1b1d1f; display: flex; align-items: center; gap: 12px; }
#hdr h1 { font-size: 18px; margin: 0; }
#hdr .meta { color: #aaa; font-size: 13px; }
#c { display: block; width: 100vw; height: calc(100vh - 53px); }
</style>
<script type="importmap">{ "imports": { "three": "https://unpkg.com/three@0.160.0/build/three.module.min.js", "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/" } }</script>
</head>
<body>
<div id="hdr"><h1>${title}</h1><span class="meta">by ${creator} &middot; ${desc}</span><span class="meta" style="margin-left:auto">Exported from Funtopia</span></div>
<canvas id="c"></canvas>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const WORLD = ${worldJson};
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setSize(innerWidth, innerHeight - 53);
renderer.shadowMap.enabled = true;
const scene = new THREE.Scene();
scene.background = new THREE.Color(WORLD.sky || '#8fc8ff');
scene.add(new THREE.HemisphereLight(0xffffff, 0x444444, 1.2));
const sun = new THREE.DirectionalLight(0xffffff, 1.5);
sun.position.set(50, 80, 30); sun.castShadow = true;
scene.add(sun);
const camera = new THREE.PerspectiveCamera(70, innerWidth / (innerHeight - 53), 0.1, 3000);
camera.position.set(30, 30, 30);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 10, 0); controls.update();
for (const p of (WORLD.parts || [])) {
  const geo = new THREE.BoxGeometry(p.s[0], p.s[1], p.s[2]);
  const mat = new THREE.MeshStandardMaterial({ color: new THREE.Color(p.c || '#a3a2a5'), roughness: 0.8 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(p.p[0], p.p[1], p.p[2]);
  mesh.castShadow = mesh.receiveShadow = true;
  scene.add(mesh);
}
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();
addEventListener('resize', () => {
  camera.aspect = innerWidth / (innerHeight - 53);
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight - 53);
});
</script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
});

// ---------- Looney Tunes event ----------
const LOONEY_EVENT = {
  id: 'looney',
  name: 'Looney Tunes Event',
  starts: Date.parse('2026-10-06T00:00:00Z'),
  ends: Date.parse('2026-10-27T00:00:00Z'),
  need: 20,
  badge: 'looney',
  items: ['hat_bunnyears', 'face_buckteeth', 'hat_ducktuft', 'face_beak', 'head_bugs', 'head_daffy'],
};
const looneyActive = () => { const n = Date.now(); return n >= LOONEY_EVENT.starts && n <= LOONEY_EVENT.ends; };

const LOONEY_GAMES = [
  { name: "Bugs' Burrow Dash", desc: "Find all 12 hidden carrots in Bugs' burrow!", sky: '#9fd6ff', cols: ['#8ac926', '#ffca3a', '#ff924c'] },
  { name: "Daffy's Duck Season", desc: "Tag 8 runaway ducks in the autumn forest!", sky: '#ffb74d', cols: ['#ff9800', '#212121', '#ffca3a'] },
  { name: "Porky's Perilous Path", desc: "Escape the pigpen maze!", sky: '#f8bbd0', cols: ['#f48fb1', '#ce93d8', '#ffffff'] },
  { name: "Tweety's Cage Escape", desc: "A golden key is hidden in the giant birdcage... follow the hints!", sky: '#fff9c4', cols: ['#ffee58', '#29b6f6', '#ffffff'] },
  { name: "Sylvester's Alley Chase", desc: "Dodge the alley cats for 45 seconds!", sky: '#b0bec5', cols: ['#78909c', '#ef5350', '#37474f'] },
  { name: "Road Runner's Canyon Run", desc: "Sprint the canyon in under 60 seconds!", sky: '#ffcc80', cols: ['#e65100', '#ffb74d', '#a1887f'] },
  { name: "Wile E.'s Rocket Ride", desc: "Dodge falling anvils for 60 seconds!", sky: '#90caf9', cols: ['#78909c', '#e53935', '#eceff1'] },
  { name: "Taz's Tornado Spin", desc: "Bonk Taz 5 times... if you dare!", sky: '#d7ccc8', cols: ['#8d6e63', '#a1887f', '#ffca3a'] },
  { name: "Elmer's Forest Frolic", desc: "Find your way out of Elmer's forest maze!", sky: '#a5d6a7', cols: ['#2e7d32', '#66bb6a', '#8d6e63'] },
  { name: "Marvin's Martian Maze", desc: "Find the hidden Illudium Q-36 on Mars!", sky: '#1a237e', cols: ['#00e676', '#212121', '#76ff03'] },
  { name: "Foghorn's Farmyard Frenzy", desc: "Tag 10 runaway chickens in the farmyard!", sky: '#fff59d', cols: ['#e53935', '#ffffff', '#8d6e63'] },
  { name: "Pepe's Parisian Promenade", desc: "Find 10 hidden flowers on the streets of Paris!", sky: '#ce93d8', cols: ['#7b1fa2', '#f48fb1', '#212121'] },
  { name: "Speedy Gonzales Sprint", desc: "Sprint to the fiesta in under 45 seconds!", sky: '#ffe082', cols: ['#d32f2f', '#ffca3a', '#ffffff'] },
  { name: "Yosemite Sam's Showdown", desc: "Bonk Yosemite Sam 5 times in a rootin' tootin' showdown!", sky: '#ffab91', cols: ['#b71c1c', '#0d47a1', '#ffca3a'] },
  { name: "Granny's House Hijinks", desc: "Find 8 hidden cookies in Granny's house!", sky: '#d1c4e9', cols: ['#7e57c2', '#ffb74d', '#ffffff'] },
  { name: "Acme Factory Floor", desc: "Dodge the Acme crushers for 60 seconds!", sky: '#b0bec5', cols: ['#546e7a', '#ffc107', '#37474f'] },
  { name: "Looney Star Summit", desc: "Hold the golden summit for 30 seconds!", sky: '#9fd6ff', cols: ['#ff595e', '#ffca3a', '#8ac926', '#1982c4', '#6a4c93'] },
  { name: "Carrot Patch Capers", desc: "Find 12 golden carrots hidden in the patch!", sky: '#c5e1a5', cols: ['#ff9800', '#33691e', '#8ac926'] },
  { name: "Duck Dodgers' Space Station", desc: "Navigate the space station maze to the bridge!", sky: '#0d1b2a', cols: ['#00e5ff', '#3a506b', '#ffffff'] },
  { name: "That's All, Folks! Finale", desc: "Pop 12 golden stars on the big stage!", sky: '#ffd54f', cols: ['#ffd700', '#e53935', '#ffffff'] },
];

// ---------- Looney Tunes event: real mini-games (not obbies) ----------
// Each game is a distinct genre, driven by world scripts:
// hunt (treasure hunt), blitz (tag moving targets), maze, survival,
// anvil rain, hot/cold seeker, boss battle, sprint time trial, king of the hill.
function scrHunt(n, item) {
  return "onStart(()=>{hidePart('WinPad');setScore(0);say('Find all " + n + " " + item + "!');});"
    + "onTouch('Coin',()=>{var c=addScore(1);if(c>=" + n + "){showPart('WinPad');say('All found! Touch the golden pad!');playSound('win');}else{say(c+' / " + n + " " + item + " found!');}});";
}
function scrBlitz(targets, label) {
  var code = "onStart(()=>{hidePart('WinPad');setScore(0);say('Tag all " + targets.length + " " + label + "! They move!');});";
  targets.forEach(function (t) {
    code += "onTouch('" + t.name + "',()=>{var c=addScore(1);playSound('coin');if(c>=" + targets.length + "){showPart('WinPad');say('All tagged! Touch the golden pad!');playSound('win');}else{say('Tagged! '+c+' / " + targets.length + "');}});";
  });
  code += "onTick((dt,t)=>{";
  targets.forEach(function (t) {
    code += "movePart('" + t.name + "'," + t.x + "+Math.sin(t*" + t.sp + "+" + t.ph + ")*" + t.rg + "," + t.y + "," + t.z + "+Math.cos(t*" + t.sp + "*0.7+" + t.ph + ")*" + t.rg + ");";
  });
  return code + "});";
}
function scrSurvival(secs, hazards) {
  var code = "onStart(()=>{hidePart('WinPad');say('Survive " + secs + " seconds!');});"
    + "var survT=0,survDone=false,wA=false,wB=false;"
    + "onTick((dt,t)=>{";
  hazards.forEach(function (h) {
    code += "movePart('" + h.name + "'," + h.x + "+Math.sin(t*" + h.sp + ")*" + h.ax + "," + h.y + "," + h.z + "+Math.cos(t*" + h.sp + ")*" + h.az + ");";
  });
  code += "if(!survDone&&!game.won){survT+=dt;var left=Math.ceil(" + secs + "-survT);"
    + "if(left<=30&&!wA){wA=true;say('30 seconds left!');}"
    + "if(left<=10&&!wB){wB=true;say('10 seconds left!');}"
    + "if(survT>=" + secs + "){survDone=true;showPart('WinPad');say('You survived! Touch the golden pad!');playSound('win');}}});";
  return code;
}
function scrAnvilRain(secs, n, cx, cz, w, topY, spd) {
  return "onStart(()=>{hidePart('WinPad');say('Dodge the falling anvils for " + secs + " seconds!');});"
    + "var survT=0,survDone=false,wB=false;var ax=[],ay=[];"
    + "for(var i=0;i<" + n + ";i++){ax.push(" + cx + "+(Math.random()-0.5)*" + w + ");ay.push(" + topY + "+Math.random()*25);}"
    + "onTick((dt,t)=>{"
    + "for(var i=0;i<" + n + ";i++){ay[i]-=" + spd + "*dt;if(ay[i]<1){ay[i]=" + topY + ";ax[i]=" + cx + "+(Math.random()-0.5)*" + w + ";}movePart('Anvil'+i,ax[i],ay[i]," + cz + ");}"
    + "if(!survDone&&!game.won){survT+=dt;var left=Math.ceil(" + secs + "-survT);"
    + "if(left<=10&&!wB){wB=true;say('10 seconds left!');}"
    + "if(survT>=" + secs + "){survDone=true;showPart('WinPad');say('You survived! Touch the golden pad!');playSound('win');}}});";
}
function scrHotCold(tx, tz, label) {
  return "onStart(()=>{hidePart('WinPad');hidePart('HiddenItem');say('A " + label + " is hidden nearby... follow the hints!');});"
    + "var lastHint=0,lastD=99999,found=false;"
    + "onTick((dt,t)=>{if(found||game.won)return;var p=getPos();"
    + "var d=Math.sqrt((p.x-(" + tx + "))*(p.x-(" + tx + "))+(p.z-(" + tz + "))*(p.z-(" + tz + ")));"
    + "if(t-lastHint>2.5){lastHint=t;"
    + "if(d<14){found=true;showPart('HiddenItem');say('You found it! Touch it!');playSound('win');}"
    + "else if(d<lastD-2){say('Warmer!');}else if(d>lastD+2){say('Colder...');}"
    + "lastD=d;}});"
    + "onTouch('HiddenItem',()=>{showPart('WinPad');say('Touch the golden pad to win!');});";
}
function scrBoss(label, hits, dmg, cx, cz, range, by) {
  return "onStart(()=>{hidePart('WinPad');say('Bonk " + label + " " + hits + " times! Careful, it fights back!');});"
    + "var hp=" + hits + ",bx=" + cx + ",bz=" + cz + ",lastBonk=-9,bossDone=false;"
    + "onTouch('Boss',()=>{var now=Date.now()/1000;if(now-lastBonk<1.5||bossDone||game.won)return;lastBonk=now;"
    + "hp--;damage(null," + dmg + ");playSound('coin');"
    + "bx=" + cx + "+(Math.random()-0.5)*" + range + ";bz=" + cz + "+(Math.random()-0.5)*" + range + ";movePart('Boss',bx," + by + ",bz);"
    + "if(hp<=0){bossDone=true;showPart('WinPad');say('" + label + " defeated! Touch the golden pad!');playSound('win');}"
    + "else{say('" + label + ": '+hp+' bonks left!');}});"
    + "onTick((dt,t)=>{if(!bossDone&&!game.won)movePart('Boss',bx+Math.sin(t*1.3)*6," + by + ",bz+Math.cos(t)*6);});";
}
function scrNPC(bodyName, intro, lines) {
  var code = "onStart(()=>{setTimeout(()=>{say(" + JSON.stringify(intro) + ");},1500);});";
  code += "var npcI=0,npcLast=0;onTouch('" + bodyName + "',()=>{var n=Date.now();if(n-npcLast<3000)return;npcLast=n;say(" + JSON.stringify(lines) + "[npcI++%" + lines.length + "]);playSound('coin');});";
  return code;
}
function scrBossChar(label, hits, dmg, cx, cz, range, parts) {
  var code = "onStart(()=>{hidePart('WinPad');say(" + JSON.stringify('Bonk ' + label + ' ' + hits + ' times! Careful, it fights back!') + ");});"
    + "var hp=" + hits + ",bx=" + cx + ",bz=" + cz + ",lastBonk=-9,bossDone=false;";
  code += "function placeBoss(px,pz){";
  parts.forEach(function (p) { code += "movePart('" + p.n + "',px+(" + p.ox + "),(" + p.oy + "),pz+(" + p.oz + "));"; });
  code += "}placeBoss(bx,bz);";
  code += "onTouch('Boss',()=>{var now=Date.now()/1000;if(now-lastBonk<1.5||bossDone||game.won)return;lastBonk=now;"
    + "hp--;damage(null," + dmg + ");playSound('coin');"
    + "bx=" + cx + "+(Math.random()-0.5)*" + range + ";bz=" + cz + "+(Math.random()-0.5)*" + range + ";placeBoss(bx,bz);"
    + "if(hp<=0){bossDone=true;showPart('WinPad');say(" + JSON.stringify(label + ' defeated! Touch the golden pad!') + ");playSound('win');}"
    + "else{say(" + JSON.stringify(label + ': ') + "+hp+" + JSON.stringify(' bonks left!') + ");}});";
  code += "onTick((dt,t)=>{if(!bossDone&&!game.won)placeBoss(bx+Math.sin(t*1.3)*6,bz+Math.cos(t)*6);});";
  return code;
}
function scrSprint(secs) {
  return "onStart(()=>{say('Reach the finish arch in " + secs + " seconds! Green pads = speed!');});"
    + "var raceT=0,raceDone=false,wB=false;"
    + "onTick((dt)=>{if(raceDone||game.won)return;raceT+=dt;var left=Math.ceil(" + secs + "-raceT);"
    + "if(left<=10&&!wB){wB=true;say('10 seconds left!');}"
    + "if(raceT>=" + secs + "){raceDone=true;say('Too slow! Try again!');kill();}});"
    + "onDeath(()=>{raceT=0;raceDone=false;wB=false;say('Go!');});";
}
function scrKoth(cx, cy, cz, rad, secs) {
  return "onStart(()=>{hidePart('WinPad');say('Hold the golden summit for " + secs + " seconds!');});"
    + "var holdT=0,holdDone=false,lastSay=-9;"
    + "onTick((dt,t)=>{if(holdDone||game.won)return;var p=getPos();"
    + "var d=Math.sqrt((p.x-(" + cx + "))*(p.x-(" + cx + "))+(p.z-(" + cz + "))*(p.z-(" + cz + ")));"
    + "if(d<" + rad + "&&Math.abs(p.y-(" + cy + "))<5){holdT+=dt;"
    + "if(t-lastSay>5){lastSay=t;say('Holding... '+Math.floor(holdT)+' / " + secs + "s');}"
    + "if(holdT>=" + secs + "){holdDone=true;showPart('WinPad');say('Summit held! Touch the golden pad!');playSound('win');}}});";
}
function scrMaze(sx, sz, label) {
  return "onStart(()=>{teleport(null," + sx + ",3," + sz + ");say('" + label + "');});";
}

function looneyHelpers(P, r) {
  const H = {};
  H.fig = (x, y, z, s, pre, boxes) => {
    for (const b of boxes) P([x + b[0] * s, y + b[1] * s, z + b[2] * s], [b[3] * s, b[4] * s, b[5] * s], b[6], { name: pre + b[7] });
  };
  H.bugs = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2, 0, 3, 4, 2, "#9e9e9e", "Body"], [0, 5.2, 0, 2.8, 2.8, 2.6, "#9e9e9e", "Head"], [0, 4.9, 1.4, 1.6, 1, 0.5, "#ffffff", "Muzzle"], [-0.35, 4.3, 1.45, 0.5, 0.7, 0.3, "#ffffff", "ToothL"], [0.35, 4.3, 1.45, 0.5, 0.7, 0.3, "#ffffff", "ToothR"], [-0.7, 8, 0, 0.9, 3.2, 0.7, "#9e9e9e", "EarL"], [0.7, 8, 0, 0.9, 3.2, 0.7, "#9e9e9e", "EarR"], [-0.7, 8, 0.28, 0.45, 2.2, 0.25, "#f8bbd0", "InnerL"], [0.7, 8, 0.28, 0.45, 2.2, 0.25, "#f8bbd0", "InnerR"], [-0.7, 5.7, 1.32, 0.55, 0.7, 0.2, "#212121", "EyeL"], [0.7, 5.7, 1.32, 0.55, 0.7, 0.2, "#212121", "EyeR"], [0, 2.2, -1.35, 1.3, 1.3, 0.8, "#ffffff", "Tail"], [-0.9, 0.4, 0.3, 1.1, 0.8, 2, "#9e9e9e", "FootL"], [0.9, 0.4, 0.3, 1.1, 0.8, 2, "#9e9e9e", "FootR"], [-1.75, 2.5, 0, 0.8, 2.4, 0.8, "#9e9e9e", "ArmL"], [1.75, 2.5, 0, 0.8, 2.4, 0.8, "#9e9e9e", "ArmR"]]);
  H.daffy = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2, 0, 3, 4, 2.2, "#212121", "Body"], [0, 3.9, 0, 3.2, 0.7, 2.4, "#ffffff", "Ring"], [0, 5.3, 0, 2.6, 2.6, 2.4, "#212121", "Head"], [0, 5.0, 1.5, 1.7, 0.9, 1.0, "#ff9800", "Bill"], [-0.65, 5.9, 1.15, 0.6, 0.8, 0.25, "#ffffff", "EyeL"], [0.65, 5.9, 1.15, 0.6, 0.8, 0.25, "#ffffff", "EyeR"], [-0.65, 5.9, 1.28, 0.25, 0.35, 0.1, "#212121", "PupilL"], [0.65, 5.9, 1.28, 0.25, 0.35, 0.1, "#212121", "PupilR"], [0, 7.1, 0, 1.2, 1.0, 1.2, "#212121", "Tuft"], [-0.9, 0.35, 0.4, 1.2, 0.7, 2.2, "#ff9800", "FootL"], [0.9, 0.35, 0.4, 1.2, 0.7, 2.2, "#ff9800", "FootR"], [-1.7, 2.6, 0, 0.7, 2.2, 2.6, "#212121", "WingL"], [1.7, 2.6, 0, 0.7, 2.2, 2.6, "#212121", "WingR"]]);
  H.tweety = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 1.8, 0, 2.6, 3.2, 2.2, "#ffeb3b", "Body"], [0, 4.6, 0, 3.4, 3.2, 3.0, "#ffeb3b", "Head"], [-0.8, 5.2, 1.5, 0.9, 1.1, 0.25, "#ffffff", "EyeL"], [0.8, 5.2, 1.5, 0.9, 1.1, 0.25, "#ffffff", "EyeR"], [-0.8, 5.2, 1.62, 0.4, 0.5, 0.1, "#1565c0", "PupilL"], [0.8, 5.2, 1.62, 0.4, 0.5, 0.1, "#1565c0", "PupilR"], [0, 4.3, 1.6, 1.0, 0.7, 0.7, "#ff9800", "Beak"], [0, 6.6, 0, 1.6, 0.9, 1.6, "#ffeb3b", "Tuft"], [-0.7, 0.3, 0.3, 1.0, 0.6, 1.8, "#ff9800", "FootL"], [0.7, 0.3, 0.3, 1.0, 0.6, 1.8, "#ff9800", "FootR"], [-1.5, 2.2, 0, 0.6, 1.8, 1.2, "#ffeb3b", "WingL"], [1.5, 2.2, 0, 0.6, 1.8, 1.2, "#ffeb3b", "WingR"]]);
  H.sylvester = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2, 0, 3, 4, 2.2, "#212121", "Body"], [0, 2, 1.15, 1.8, 2.6, 0.4, "#ffffff", "Belly"], [0, 5.3, 0, 2.8, 2.8, 2.6, "#212121", "Head"], [0, 4.8, 1.35, 1.7, 1.2, 0.5, "#ffffff", "Muzzle"], [0, 5.15, 1.6, 0.5, 0.4, 0.3, "#e53935", "Nose"], [-1.1, 7, 0, 0.9, 1.4, 0.8, "#212121", "EarL"], [1.1, 7, 0, 0.9, 1.4, 0.8, "#212121", "EarR"], [-0.7, 5.8, 1.32, 0.55, 0.7, 0.2, "#ffffff", "EyeL"], [0.7, 5.8, 1.32, 0.55, 0.7, 0.2, "#ffffff", "EyeR"], [0, 2.2, -1.4, 1.0, 1.0, 1.6, "#212121", "Tail"], [-0.9, 0.4, 0.3, 1.1, 0.8, 2, "#212121", "FootL"], [0.9, 0.4, 0.3, 1.1, 0.8, 2, "#212121", "FootR"]]);
  H.porky = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2, 0, 3.2, 4, 2.4, "#f48fb1", "Body"], [0, 5.2, 0, 2.8, 2.6, 2.6, "#f48fb1", "Head"], [0, 4.9, 1.4, 1.4, 1.1, 0.7, "#f06292", "Snout"], [-0.35, 4.9, 1.78, 0.25, 0.25, 0.15, "#4e342e", "NostrilL"], [0.35, 4.9, 1.78, 0.25, 0.25, 0.15, "#4e342e", "NostrilR"], [-1, 6.9, 0, 0.8, 1.2, 0.6, "#f48fb1", "EarL"], [1, 6.9, 0, 0.8, 1.2, 0.6, "#f48fb1", "EarR"], [-0.75, 5.7, 1.32, 0.55, 0.7, 0.2, "#ffffff", "EyeL"], [0.75, 5.7, 1.32, 0.55, 0.7, 0.2, "#ffffff", "EyeR"], [-0.9, 0.4, 0.3, 1.1, 0.8, 1.8, "#f48fb1", "FootL"], [0.9, 0.4, 0.3, 1.1, 0.8, 1.8, "#f48fb1", "FootR"], [0, 2.2, -1.5, 0.4, 0.4, 1.2, "#f06292", "Tail"]]);
  H.elmer = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2, 0, 3, 4, 2, "#6d4c41", "Body"], [0, 5.2, 0, 2.6, 2.6, 2.4, "#ffcc99", "Head"], [-0.65, 5.7, 1.22, 0.5, 0.6, 0.2, "#ffffff", "EyeL"], [0.65, 5.7, 1.22, 0.5, 0.6, 0.2, "#ffffff", "EyeR"], [0, 4.7, 1.25, 1.2, 0.35, 0.25, "#8d6e63", "Mouth"], [0, 6.9, 0, 3.4, 0.7, 3.2, "#4e342e", "HatBrim"], [0, 7.9, 0, 2.0, 1.6, 2.0, "#4e342e", "HatTop"], [-0.9, 0.4, 0.2, 1.1, 0.8, 1.8, "#3e2723", "BootL"], [0.9, 0.4, 0.2, 1.1, 0.8, 1.8, "#3e2723", "BootR"], [2.2, 3.2, 0.6, 0.7, 3.4, 0.7, "#5d4037", "Rifle"]]);
  H.marvin = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2, 0, 3, 3.6, 2, "#2e7d32", "Body"], [0, 4.9, 0, 2.6, 2.6, 2.4, "#212121", "Head"], [-0.6, 5.3, 1.22, 0.7, 0.9, 0.2, "#ffffff", "EyeL"], [0.6, 5.3, 1.22, 0.7, 0.9, 0.2, "#ffffff", "EyeR"], [0, 6.6, 0, 3.0, 1.2, 2.8, "#9e9e9e", "Helmet"], [0, 7.6, 0, 1.8, 1.2, 1.8, "#9e9e9e", "HelmetTop"], [0, 8.5, -0.2, 0.7, 0.9, 2.2, "#e53935", "Plume"], [-0.9, 0.35, 0.2, 1.0, 0.7, 1.6, "#212121", "FootL"], [0.9, 0.35, 0.2, 1.0, 0.7, 1.6, "#212121", "FootR"], [-1.7, 2.4, 0, 0.7, 1.8, 0.7, "#2e7d32", "ArmL"], [1.7, 2.4, 0, 0.7, 1.8, 0.7, "#2e7d32", "ArmR"]]);
  H.foghorn = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2.2, 0, 3.4, 4.4, 2.6, "#ffffff", "Body"], [0, 5.6, 0, 2.6, 2.6, 2.4, "#ffffff", "Head"], [0, 6.3, 1.3, 1.2, 0.9, 0.9, "#ff9800", "Beak"], [-0.65, 6.1, 1.22, 0.55, 0.7, 0.2, "#212121", "EyeL"], [0.65, 6.1, 1.22, 0.55, 0.7, 0.2, "#212121", "EyeR"], [0, 7.3, 0, 1.8, 1.0, 0.6, "#e53935", "Comb"], [0, 4.9, 1.35, 0.8, 1.2, 0.4, "#e53935", "Wattle"], [-1.9, 2.8, 0, 0.8, 2.6, 1.4, "#ffffff", "WingL"], [1.9, 2.8, 0, 0.8, 2.6, 1.4, "#ffffff", "WingR"], [0, 2.6, -1.8, 1.6, 2.4, 1.0, "#2e7d32", "TailF"], [-0.8, 0.35, 0.3, 1.0, 0.7, 2.0, "#ff9800", "FootL"], [0.8, 0.35, 0.3, 1.0, 0.7, 2.0, "#ff9800", "FootR"]]);
  H.pepe = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2, 0, 3, 4, 2.2, "#212121", "Body"], [0, 2, 1.2, 1.4, 3.4, 0.35, "#ffffff", "Stripe"], [0, 5.2, 0, 2.6, 2.6, 2.4, "#212121", "Head"], [0, 6.2, 0.6, 1.2, 1.6, 1.4, "#ffffff", "HeadStripe"], [0, 4.9, 1.3, 0.9, 0.7, 0.6, "#212121", "Nose"], [-0.65, 5.7, 1.22, 0.5, 0.6, 0.2, "#ffffff", "EyeL"], [0.65, 5.7, 1.22, 0.5, 0.6, 0.2, "#ffffff", "EyeR"], [0, 3, -2.2, 2.4, 3.4, 1.6, "#212121", "Tail"], [0, 3, -2.2, 1.2, 2.6, 1.7, "#ffffff", "TailStripe"], [-0.9, 0.4, 0.3, 1.1, 0.8, 1.8, "#212121", "FootL"], [0.9, 0.4, 0.3, 1.1, 0.8, 1.8, "#212121", "FootR"]]);
  H.speedy = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 1.2, 0, 1.8, 2.2, 1.4, "#8d6e63", "Body"], [0, 2.9, 0, 1.6, 1.6, 1.4, "#8d6e63", "Head"], [0, 2.7, 0.75, 0.7, 0.5, 0.4, "#d7ccc8", "Snout"], [-0.4, 3.2, 0.72, 0.3, 0.35, 0.15, "#212121", "EyeL"], [0.4, 3.2, 0.72, 0.3, 0.35, 0.15, "#212121", "EyeR"], [-0.9, 3.6, 0, 0.5, 0.7, 0.3, "#8d6e63", "EarL"], [0.9, 3.6, 0, 0.5, 0.7, 0.3, "#8d6e63", "EarR"], [0, 4.1, 0, 5.5, 0.5, 5.5, "#ffca3a", "Sombrero"], [0, 5.0, 0, 2.2, 1.8, 2.2, "#ffb300", "SombreroTop"], [-0.5, 0.25, 0.2, 0.6, 0.5, 1.2, "#8d6e63", "FootL"], [0.5, 0.25, 0.2, 0.6, 0.5, 1.2, "#8d6e63", "FootR"], [0, 1.2, -1.0, 0.3, 0.3, 1.4, "#d7ccc8", "TailM"]]);
  H.granny = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 1.8, 0, 3.2, 3.6, 2.4, "#5c6bc0", "Dress"], [0, 4.6, 0, 2.4, 2.4, 2.2, "#ffcc99", "Head"], [0, 6.0, -0.3, 1.4, 1.2, 1.4, "#9e9e9e", "Bun"], [-0.6, 5.0, 1.12, 0.45, 0.55, 0.2, "#212121", "EyeL"], [0.6, 5.0, 1.12, 0.45, 0.55, 0.2, "#212121", "EyeR"], [-0.9, 5.9, 0.6, 1.2, 0.5, 0.5, "#eeeeee", "HairL"], [0.9, 5.9, 0.6, 1.2, 0.5, 0.5, "#eeeeee", "HairR"], [0, 4.3, 1.15, 0.9, 0.3, 0.2, "#8d6e63", "Mouth"], [-1.8, 2.6, 0, 0.7, 2.0, 0.7, "#5c6bc0", "ArmL"], [1.8, 2.6, 0, 0.7, 2.0, 0.7, "#5c6bc0", "ArmR"]]);
  H.wile = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2.2, 0, 2.8, 4.4, 2.0, "#8d6e63", "Body"], [0, 5.4, 0.2, 2.4, 2.4, 2.2, "#8d6e63", "Head"], [0, 5.0, 1.6, 1.2, 1.0, 1.2, "#a1887f", "Snout"], [0, 5.0, 2.25, 0.4, 0.3, 0.2, "#212121", "NoseTip"], [-1.0, 7.0, 0, 0.8, 1.6, 0.7, "#8d6e63", "EarL"], [1.0, 7.0, 0, 0.8, 1.6, 0.7, "#8d6e63", "EarR"], [-0.6, 5.9, 1.15, 0.5, 0.65, 0.2, "#ffffff", "EyeL"], [0.6, 5.9, 1.15, 0.5, 0.65, 0.2, "#ffffff", "EyeR"], [0, 2.4, -1.6, 1.0, 1.0, 1.8, "#8d6e63", "Tail"], [-0.8, 0.4, 0.3, 1.0, 0.8, 1.8, "#8d6e63", "FootL"], [0.8, 0.4, 0.3, 1.0, 0.8, 1.8, "#8d6e63", "FootR"]]);
  H.roadrunner = (x, y, z, s, pre) => H.fig(x, y, z, s, pre, [[0, 2.4, 0, 2.2, 3.6, 1.8, "#1976d2", "Body"], [0, 5.0, 0.2, 2.0, 2.0, 1.8, "#1976d2", "Head"], [0, 4.8, 1.3, 0.9, 0.6, 0.9, "#ff9800", "Beak"], [-0.5, 5.4, 0.95, 0.4, 0.5, 0.2, "#ffffff", "EyeL"], [0.5, 5.4, 0.95, 0.4, 0.5, 0.2, "#ffffff", "EyeR"], [0, 6.3, -0.2, 0.5, 1.2, 1.8, "#0d47a1", "Crest"], [-0.7, 1.0, 0, 0.5, 2.0, 0.5, "#ff9800", "LegL"], [0.7, 1.0, 0, 0.5, 2.0, 0.5, "#ff9800", "LegR"], [-0.7, 0.2, 0.3, 0.7, 0.4, 1.4, "#ff9800", "FootL"], [0.7, 0.2, 0.3, 0.7, 0.4, 1.4, "#ff9800", "FootR"], [0, 2.8, -1.4, 1.2, 1.6, 1.2, "#0d47a1", "Tail"], [-1.3, 3.0, 0, 0.5, 1.6, 1.0, "#1976d2", "WingL"], [1.3, 3.0, 0, 0.5, 1.6, 1.0, "#1976d2", "WingR"]]);

  H.finish = (x, y, z) => {
    P([x, y, z], [20, 1, 20], '#ffd700', { name: 'WinPlatform', m: 'neon' });
    P([x, y + 0.75, z], [8, 0.5, 8], '#ffffff', { name: 'WinPad', k: 'win', m: 'neon' });
    return [x, y, z];
  };
  H.speedPad = (x, y, z) => P([x, y, z], [5, 0.5, 5], '#22ff88', { name: 'SpeedPad', k: 'speed', m: 'neon' });
  H.coinAt = (x, y, z, name, col, s) => P([x, y, z], s || [1.2, 1.2, 1.2], col || '#ffd400', { name: name || 'Coin', k: 'coin' });
  H.maze = (ox, oz, n, cell, h, col, floorCol) => {
    const vis = Array.from({ length: n }, () => Array(n).fill(false));
    const W = Array.from({ length: n }, () => Array.from({ length: n }, () => [true, true, true, true]));
    const stack = [[0, 0]]; vis[0][0] = true;
    const dirs = [[0, -1, 0, 2], [1, 0, 1, 3], [0, 1, 2, 0], [-1, 0, 3, 1]];
    while (stack.length) {
      const top = stack[stack.length - 1], cx = top[0], cz = top[1];
      const opts = [];
      for (const d of dirs) {
        const nx = cx + d[0], nz = cz + d[1];
        if (nx >= 0 && nz >= 0 && nx < n && nz < n && !vis[nz][nx]) opts.push([nx, nz, d[2], d[3]]);
      }
      if (!opts.length) { stack.pop(); continue; }
      const o = opts[Math.floor(r() * opts.length)];
      W[cz][cx][o[2]] = false; W[o[1]][o[0]][o[3]] = false; vis[o[1]][o[0]] = true; stack.push([o[0], o[1]]);
    }
    W[0][0][3] = false; W[n - 1][n - 1][1] = false;
    const x0 = ox - (n * cell) / 2, z0 = oz - (n * cell) / 2;
    P([ox, -0.5, oz], [n * cell + 8, 1, n * cell + 8], floorCol, { name: 'MazeFloor' });
    const wall = (x, z, w, d) => P([x, h / 2, z], [w, h, d], col, { name: 'MazeWall' });
    for (let cz = 0; cz < n; cz++) for (let cx = 0; cx < n; cx++) {
      const x = x0 + cx * cell, z = z0 + cz * cell;
      if (W[cz][cx][0]) wall(x + cell / 2, z, cell + 1.5, 1.5);
      if (W[cz][cx][3]) wall(x, z + cell / 2, 1.5, cell + 1.5);
      if (cz === n - 1 && W[cz][cx][2]) wall(x + cell / 2, z + cell, cell + 1.5, 1.5);
      if (cx === n - 1 && W[cz][cx][1]) wall(x + cell, z + cell / 2, 1.5, cell + 1.5);
    }
    return {
      sx: x0 - 4, sz: z0 + cell / 2,
      ex: x0 + n * cell + 4, ez: z0 + (n - 1) * cell + cell / 2,
      x0: x0, z0: z0, n: n, cell: cell,
    };
  };
  H.carrot = (x, y, z) => { P([x, y + 0.6, z], [0.7, 1.2, 0.7], '#ff9800', { name: 'Carrot' }); P([x, y + 1.5, z], [0.5, 0.6, 0.5], '#33691e', { name: 'CarrotTop' }); };
  H.carrotPatch = (x, y, z) => { P([x, y - 0.4, z], [10, 0.8, 10], '#5d4037', { name: 'Dirt' }); for (let i = 0; i < 5; i++) H.carrot(x + (r() - 0.5) * 8, y, z + (r() - 0.5) * 8); };
  H.cactus = (x, y, z, s = 1) => { P([x, y + 2 * s, z], [1.2 * s, 4 * s, 1.2 * s], '#2e7d32', { name: 'Cactus' }); P([x - 1 * s, y + 2.2 * s, z], [1.6 * s, 1 * s, 1 * s], '#2e7d32', { name: 'CactusArm' }); P([x + 1 * s, y + 2.8 * s, z], [1.6 * s, 1 * s, 1 * s], '#2e7d32', { name: 'CactusArm' }); };
  H.tree = (x, y, z, leaf = '#2e7d32') => { P([x, y + 2, z], [1.5, 4, 1.5], '#5d4037', { name: 'Trunk' }); P([x, y + 5.5, z], [5, 4, 5], leaf, { name: 'Leaves' }); };
  H.barn = (x, y, z) => { P([x, y + 3, z], [14, 6, 10], '#c62828', { name: 'Barn' }); P([x, y + 7.5, z], [10, 3, 8], '#eceff1', { name: 'BarnRoof' }); P([x, y + 9.2, z], [6, 1.5, 5], '#eceff1', { name: 'BarnRoof2' }); P([x, y + 1.5, z + 5.1], [4, 3, 0.3], '#ffffff', { name: 'BarnDoor' }); };
  H.fence = (x, y, z, len, axis = 'x') => { const n = Math.floor(len / 4); for (let i = 0; i <= n; i++) { const o = -len / 2 + i * 4; P(axis === 'x' ? [x + o, y + 1, z] : [x, y + 1, z + o], [0.5, 2, 0.5], '#8d6e63', { name: 'FencePost' }); } P([x, y + 1.6, z], axis === 'x' ? [len, 0.3, 0.3] : [0.3, 0.3, len], '#a1887f', { name: 'FenceRail' }); };
  H.crate = (x, y, z, s = 2) => { P([x, y + s / 2, z], [s, s, s], '#8d6e63', { name: 'Crate', m: 'wood' }); };
  H.acmeCrate = (x, y, z) => { H.crate(x, y, z, 2.5); P([x, y + 2.5, z], [2.6, 0.5, 2.6], '#e53935', { name: 'AcmeBand' }); };
  H.anvil = (x, y, z) => { P([x, y + 0.5, z], [2.4, 1, 1.4], '#37474f', { name: 'Anvil', m: 'metal' }); P([x, y + 1.3, z], [1.2, 0.6, 1], '#455a64', { name: 'AnvilTop', m: 'metal' }); };
  H.lamppost = (x, y, z) => { P([x, y + 2.5, z], [0.5, 5, 0.5], '#212121', { name: 'LampPost', m: 'metal' }); P([x, y + 5.4, z], [1.4, 1, 1.4], '#fff59d', { name: 'Lamp', m: 'neon' }); };
  H.mesa = (x, y, z, w = 16, h = 10) => { P([x, y + h / 2, z], [w, h, w], '#bf6b30', { name: 'Mesa' }); P([x, y + h + 1.5, z], [w * 0.7, 3, w * 0.7], '#d98e4a', { name: 'MesaTop' }); };
  H.rock = (x, y, z, s = 2) => P([x, y + s / 2, z], [s, s, s], '#8d6e63', { name: 'Rock' });
  H.tnt = (x, y, z) => { P([x, y + 1, z], [2, 2, 2], '#d32f2f', { name: 'TNT' }); P([x, y + 1, z], [2.1, 0.6, 2.1], '#ffffff', { name: 'TNTBand' }); };
  H.haybale = (x, y, z) => P([x, y + 1, z], [3, 2, 2], '#ffca3a', { name: 'Hay' });
  H.house = (x, y, z, wall = '#90a4ae') => { P([x, y + 3, z], [12, 6, 10], wall, { name: 'House' }); P([x, y + 7, z], [9, 2.5, 8], '#6d4c41', { name: 'Roof' }); P([x, y + 8.6, z], [5, 1.6, 4.5], '#6d4c41', { name: 'Roof2' }); P([x, y + 1.5, z + 5.1], [2.5, 3, 0.3], '#4e342e', { name: 'Door' }); P([x - 3.5, y + 3.5, z + 5.1], [2, 2, 0.3], '#fff9c4', { name: 'Window', m: 'neon' }); P([x + 3.5, y + 3.5, z + 5.1], [2, 2, 0.3], '#fff9c4', { name: 'Window', m: 'neon' }); };
  H.eiffel = (x, y, z) => { P([x, y + 2, z], [14, 4, 14], '#78909c', { name: 'Tower', m: 'metal' }); P([x, y + 7, z], [10, 6, 10], '#78909c', { name: 'Tower', m: 'metal' }); P([x, y + 12, z], [6, 4, 6], '#78909c', { name: 'Tower', m: 'metal' }); P([x, y + 15, z], [2, 4, 2], '#78909c', { name: 'Tower', m: 'metal' }); P([x, y + 17.5, z], [1, 1, 1], '#fff59d', { name: 'Beacon', m: 'neon' }); };
  H.star = (x, y, z) => P([x, y, z], [0.8, 0.8, 0.8], '#ffffff', { name: 'Star', m: 'neon' });
  H.rocket = (x, y, z) => { P([x, y + 1.5, z], [2, 3, 2], '#eceff1', { name: 'Rocket', m: 'metal' }); P([x, y + 3.6, z], [1.2, 1.2, 1.2], '#e53935', { name: 'RocketNose' }); P([x - 1.2, y + 0.6, z], [0.6, 1.4, 1.6], '#e53935', { name: 'Fin' }); P([x + 1.2, y + 0.6, z], [0.6, 1.4, 1.6], '#e53935', { name: 'Fin' }); };
  H.sombrero = (x, y, z) => { P([x, y + 0.3, z], [6, 0.5, 6], '#ffca3a', { name: 'Sombrero' }); P([x, y + 1.5, z], [2.5, 2.5, 2.5], '#ffb300', { name: 'SombreroTop' }); };
  return H;
}

const LOONEY_BUILDERS = [
  (P, r, H, S, x, y, z) => { // 1. Bugs' Burrow Dash — TREASURE HUNT (12 carrots)
    P([0, -0.5, -50], [100, 1, 100], '#7a5c3e', { name: 'BurrowFloor' });
    for (let i = 0; i < 6; i++) P([-35 + r() * 70, 2, -15 - r() * 70], [14 + r() * 10, 4, 2], '#5d4037', { name: 'TunnelWall' });
    H.carrotPatch(-25, 0, -30); H.carrotPatch(25, 0, -45); H.carrotPatch(-20, 0, -70); H.carrotPatch(20, 0, -80);
    for (let i = 0; i < 12; i++) H.coinAt(-40 + r() * 80, 1.2, -15 - r() * 70, 'Coin', '#ff9800', [1.2, 1.6, 1.2]);
    H.bugs(7, 1, -8, 1, 'Bugs');
    S('Burrow Hunt', scrHunt(12, 'carrots'));
    S('NPC Talk', scrNPC("BugsBody", "Bugs: What's up, doc? Find all 12 carrots!", ["What's up, doc?", "This hunt is gonna be a carrot cakewalk!", "Ain't I a stinker?"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 2. Daffy's Duck Season — TARGET BLITZ (8 ducks)
    P([0, -0.5, -45], [90, 1, 90], '#3e5c2e', { name: 'ForestFloor' });
    for (let i = 0; i < 10; i++) H.tree(-38 + r() * 76, 0, -10 - r() * 70, ['#ef6c00', '#e65100', '#f9a825'][i % 3]);
    const targets = [];
    for (let i = 0; i < 8; i++) {
      const tx = -30 + r() * 60, tz = -15 - r() * 60, nm = 'Duck' + i;
      P([tx, 1.5, tz], [3, 2.5, 3], i % 2 ? '#212121' : '#ff9800', { name: nm, k: 'coin' });
      targets.push({ name: nm, x: tx.toFixed(1), y: 1.5, z: tz.toFixed(1), sp: (0.5 + r() * 0.5).toFixed(2), rg: (5 + r() * 4).toFixed(1), ph: (r() * 6).toFixed(2) });
    }
    H.daffy(7, 1, -8, 1, 'Daffy');
    S('Duck Tag', scrBlitz(targets, 'ducks'));
    S('NPC Talk', scrNPC("DaffyBody", "Daffy: You're despicable! Tag all 8 ducks!", ["You're despicable!", "Woo-hoo! Woo-hoo!", "I'm not like other ducks!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 3. Porky's Perilous Path — MAZE
    const mz = H.maze(0, -60, 7, 10, 5, '#8d6e63', '#f8bbd0');
    H.barn(mz.ex + 20, 0, mz.ez);
    for (let i = 0; i < 4; i++) H.coinAt(mz.x0 + Math.floor(r() * 7) * 10 + 5, 1.2, mz.z0 + Math.floor(r() * 7) * 10 + 5, 'Coin', '#ffd400');
    H.porky(mz.sx + 1, 0, mz.sz + 8, 1, 'Porky');
    S('Pigpen Maze', scrMaze(mz.sx.toFixed(1), mz.sz.toFixed(1), 'Find your way out of the pigpen!'));
    S('NPC Talk', scrNPC("PorkyBody", "Porky: Th-th-the exit is through the maze!", ["Th-th-that's the way out!", "Be vewy vewy careful!"]));
    H.finish(mz.ex + 12, 0, mz.ez);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 4. Tweety's Cage Escape — HOT/COLD SEEKER
    P([0, -0.5, -45], [80, 1, 80], '#90caf9', { name: 'CageFloor' });
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      P([Math.cos(a) * 38, 10, -45 + Math.sin(a) * 38], [1.5, 20, 1.5], '#fdd835', { name: 'CageBar', m: 'metal' });
    }
    P([0, 21, -45], [78, 2, 78], '#fdd835', { name: 'CageTop', m: 'metal' });
    P([-20, 3, -30], [8, 6, 8], '#8d6e63', { name: 'Birdhouse', m: 'wood' });
    P([20, 1, -60], [6, 2, 6], '#a1887f', { name: 'Perch', m: 'wood' });
    const hx = 12 + r() * 16, hz = -58 - r() * 12;
    P([hx, 1.5, hz], [3, 3, 1], '#ffd400', { name: 'HiddenItem', k: 'coin', m: 'neon' });
    H.tweety(7, 1, -8, 1, 'Tweety');
    S('Hidden Key', scrHotCold(hx.toFixed(1), hz.toFixed(1), 'golden key'));
    S('NPC Talk', scrNPC("TweetyBody", "Tweety: I tawt I taw a golden key! Follow the hints!", ["I tawt I taw a golden key!", "The poor puddy tat will never find it!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 5. Sylvester's Alley Chase — SURVIVAL (45s)
    P([0, -0.5, -55], [36, 1, 110], '#616161', { name: 'AlleyFloor' });
    for (let s = 0; s < 5; s++) {
      P([19, 4, -20 - s * 20], [2, 8, 24], '#6d4c41', { name: 'BrickWall', m: 'brick' });
      P([-19, 4, -20 - s * 20], [2, 8, 24], '#6d4c41', { name: 'BrickWall', m: 'brick' });
    }
    for (let i = 0; i < 5; i++) P([-12 + (i % 2) * 24, 1, -25 - i * 15], [2, 2, 2], '#78909c', { name: 'TrashCan', m: 'metal' });
    const hazards = [];
    for (let i = 0; i < 4; i++) {
      const nm = 'Cat' + i, hz = -25 - i * 18;
      P([0, 1.5, hz], [3, 3, 3], '#212121', { name: nm, k: 'kill' });
      hazards.push({ name: nm, x: 0, y: 1.5, z: hz, ax: 13, az: 0, sp: (0.6 + i * 0.15).toFixed(2) });
    }
    H.sylvester(7, 1, -8, 1, 'Sylvester');
    S('Alley Survival', scrSurvival(45, hazards));
    S('NPC Talk', scrNPC("SylvesterBody", "Sylvester: Sufferin' succotash! Dodge the cats for 45 seconds!", ["Sufferin' succotash!", "Those cats are tough customers!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 6. Road Runner's Canyon Run — SPRINT TIME TRIAL (60s)
    const len = 220, cx = 0, cz = -12 - len / 2;
    P([cx, -0.5, cz], [18, 1, len], '#e65100', { name: 'Track' });
    for (let d = 30; d < len; d += 30) H.speedPad(cx + (d % 60 ? -4 : 4), 0.25, -12 - d);
    H.mesa(cx + 25, -2, -60, 20, 14); H.mesa(cx - 28, -2, -120, 24, 18); H.mesa(cx + 26, -2, -170, 18, 12);
    H.cactus(cx + 14, 0, -40); H.cactus(cx - 14, 0, -90, 1.4); H.cactus(cx + 14, 0, -140); H.cactus(cx - 13, 0, -190);
    P([cx - 8, 4, -12 - len], [2, 8, 2], '#ffffff', { name: 'Arch' });
    P([cx + 8, 4, -12 - len], [2, 8, 2], '#ffffff', { name: 'Arch' });
    P([cx, 8.5, -12 - len], [18, 2, 2], '#ffffff', { name: 'Arch' });
    H.roadrunner(7, 1, -8, 1, 'RoadRunner');
    S('Canyon Sprint', scrSprint(60));
    S('NPC Talk', scrNPC("RoadRunnerBody", "Road Runner: Meep meep! Reach the finish in 60 seconds!", ["Meep meep!", "Beep beep!"]));
    H.finish(cx, 0, -12 - len - 16);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 7. Wile E.'s Rocket Ride — ANVIL RAIN SURVIVAL (60s)
    P([0, -0.5, -45], [70, 1, 70], '#d98e4a', { name: 'DesertFloor' });
    H.rocket(12, 0, -20); H.acmeCrate(-10, 0, -25); H.acmeCrate(8, 0, -60); H.tnt(-12, 0, -55);
    H.cactus(20, 0, -40); H.cactus(-22, 0, -65, 1.3);
    for (let i = 0; i < 8; i++) P([0, 55, -45], [3, 2, 2], '#37474f', { name: 'Anvil' + i, k: 'kill', m: 'metal' });
    H.wile(7, 1, -8, 1, 'Wile');
    S('Anvil Rain', scrAnvilRain(60, 8, 0, -45, 56, 55, 26));
    S('NPC Talk', scrNPC("WileBody", "Wile E.: My anvil storm never misses! Survive 60 seconds!", ["...", "My genius is unmatched! (The anvils disagree.)"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 8. Taz's Tornado Spin — BOSS BATTLE
    P([0, -0.5, -50], [70, 1, 70], '#8d6e63', { name: 'ArenaFloor' });
    for (let i = 0; i < 6; i++) P([-24, 2 + i * 3, -30], [10 - i * 1.2, 3, 10 - i * 1.2], '#a1887f', { name: 'Tornado' });
    for (let i = 0; i < 6; i++) P([24, 2 + i * 3, -70], [10 - i * 1.2, 3, 10 - i * 1.2], '#a1887f', { name: 'Tornado' });
    H.fig(0, 0, -50, 1, 'Boss', [[0,3,0, 6,6,5, '#6d4c41', ''],[0,7.2,0, 4.6,3.2,4.2, '#6d4c41', 'Head'],[0,6.6,2.15, 3.0,1.6,0.5, '#3e2723', 'Mouth'],[0,2.6,2.55, 3.4,3.4,0.4, '#d7ccc8', 'Belly'],[-1.6,9.2,0, 0.9,1.2,0.9, '#6d4c41', 'EarL'],[1.6,9.2,0, 0.9,1.2,0.9, '#6d4c41', 'EarR'],[-3.4,3.4,0, 1.0,2.6,1.0, '#6d4c41', 'ArmL'],[3.4,3.4,0, 1.0,2.6,1.0, '#6d4c41', 'ArmR']]);
    const tazParts = [{ n: 'Boss', ox: 0, oy: 3, oz: 0 },{ n: 'BossHead', ox: 0, oy: 7.2, oz: 0 },{ n: 'BossMouth', ox: 0, oy: 6.6, oz: 2.15 },{ n: 'BossBelly', ox: 0, oy: 2.6, oz: 2.55 },{ n: 'BossEarL', ox: -1.6, oy: 9.2, oz: 0 },{ n: 'BossEarR', ox: 1.6, oy: 9.2, oz: 0 },{ n: 'BossArmL', ox: -3.4, oy: 3.4, oz: 0 },{ n: 'BossArmR', ox: 3.4, oy: 3.4, oz: 0 }];
    S('Taz Battle', scrBossChar('Taz', 5, 10, 0, -50, 40, tazParts));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 9. Elmer's Forest Frolic — MAZE
    const mz = H.maze(0, -60, 7, 10, 6, '#1b5e20', '#2e7d32');
    for (let i = 0; i < 12; i++) H.tree(-45 + r() * 90, 0, -105 - r() * 15, '#1b5e20');
    for (let i = 0; i < 4; i++) H.coinAt(mz.x0 + Math.floor(r() * 7) * 10 + 5, 1.2, mz.z0 + Math.floor(r() * 7) * 10 + 5, 'Coin', '#ffd400');
    H.elmer(mz.sx + 1, 0, mz.sz + 8, 1, 'Elmer');
    S('Forest Maze', scrMaze(mz.sx.toFixed(1), mz.sz.toFixed(1), 'Find your way out of the forest!'));
    S('NPC Talk', scrNPC("ElmerBody", "Elmer: Be vewy vewy quiet! Find the exit!", ["Be vewy vewy quiet!", "I'm hunting exits!"]));
    H.finish(mz.ex + 12, 0, mz.ez);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 10. Marvin's Martian Maze — HOT/COLD SEEKER
    P([0, -0.5, -50], [90, 1, 90], '#b3402a', { name: 'MarsFloor' });
    for (let i = 0; i < 50; i++) H.star((r() - 0.5) * 160, 25 + r() * 50, -10 - r() * 120);
    for (let i = 0; i < 8; i++) P([-35 + r() * 70, 0.1, -15 - r() * 70], [8 + r() * 6, 0.4, 8 + r() * 6], '#7a2a1a', { name: 'Crater' });
    P([-20, 4, -30], [6, 8, 6], '#00e676', { name: 'Martian' });
    const hx = -30 + r() * 60, hz = -20 - r() * 55;
    P([hx, 1.5, hz], [3, 3, 3], '#00e676', { name: 'HiddenItem', k: 'coin', m: 'neon' });
    H.marvin(7, 1, -8, 1, 'Marvin');
    S('Hidden Orb', scrHotCold(hx.toFixed(1), hz.toFixed(1), 'Illudium Q-36'));
    S('NPC Talk', scrNPC("MarvinBody", "Marvin: Find my Illudium Q-36! Where's the kaboom?!", ["Where's the kaboom?", "You are making me very angry."]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 11. Foghorn's Farmyard Frenzy — TARGET BLITZ (10 chickens)
    P([0, -0.5, -45], [80, 1, 80], '#7ec850', { name: 'FarmFloor' });
    H.barn(-22, 0, -25); H.fence(15, 0, -20, 30); H.haybale(10, 0, -60); H.haybale(-12, 0, -70);
    const targets = [];
    for (let i = 0; i < 10; i++) {
      const tx = -30 + r() * 60, tz = -15 - r() * 60, nm = 'Chicken' + i;
      P([tx, 1.25, tz], [2.5, 2.5, 2.5], '#ffffff', { name: nm, k: 'coin' });
      targets.push({ name: nm, x: tx.toFixed(1), y: 1.25, z: tz.toFixed(1), sp: (0.6 + r() * 0.6).toFixed(2), rg: (4 + r() * 4).toFixed(1), ph: (r() * 6).toFixed(2) });
    }
    H.foghorn(7, 1, -8, 1, 'Foghorn');
    S('Chicken Roundup', scrBlitz(targets, 'chickens'));
    S('NPC Talk', scrNPC("FoghornBody", "Foghorn: Tag those chickens, I say, tag 'em all!", ["That's a joke, son!", "Pay attention, boy!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 12. Pepe's Parisian Promenade — TREASURE HUNT (10 flowers)
    P([0, -0.5, -50], [90, 1, 90], '#b0a89f', { name: 'ParisStreet' });
    H.eiffel(24, 0, -60);
    H.lamppost(-14, 0, -25); H.lamppost(14, 0, -45); H.lamppost(-14, 0, -65); H.lamppost(14, 0, -85);
    for (let i = 0; i < 10; i++) H.coinAt(-35 + r() * 70, 1.4, -15 - r() * 70, 'Coin', '#f48fb1', [1.4, 1.4, 1.4]);
    H.pepe(7, 1, -8, 1, 'Pepe');
    S('Flower Hunt', scrHunt(10, 'flowers'));
    S('NPC Talk', scrNPC("PepeBody", "Pepe: Come wiz me, cherie! Find 10 flowers!", ["Come wiz me!", "Ahh, l'amour!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 13. Speedy Gonzales Sprint — SPRINT TIME TRIAL (45s)
    const len = 180, cx = 0, cz = -12 - len / 2;
    P([cx, -0.5, cz], [16, 1, len], '#d32f2f', { name: 'Track' });
    for (let d = 25; d < len; d += 25) H.speedPad(cx + (d % 50 ? -3.5 : 3.5), 0.25, -12 - d);
    H.sombrero(cx + 12, 0, -30); H.cactus(cx - 12, 0, -55); H.sombrero(cx - 12, 0, -95); H.cactus(cx + 12, 0, -130, 1.3);
    P([cx - 7, 4, -12 - len], [2, 8, 2], '#ffca3a', { name: 'Arch' });
    P([cx + 7, 4, -12 - len], [2, 8, 2], '#ffca3a', { name: 'Arch' });
    P([cx, 8.5, -12 - len], [16, 2, 2], '#ffca3a', { name: 'Arch' });
    H.speedy(7, 1, -8, 1, 'Speedy');
    S('Fiesta Sprint', scrSprint(45));
    S('NPC Talk', scrNPC("SpeedyBody", "Speedy: \u00a1\u00c1ndale! Reach the fiesta in 45 seconds!", ["\u00a1\u00c1ndale! \u00a1\u00c1ndale!", "\u00a1Arriba! \u00a1Arriba!"]));
    H.finish(cx, 0, -12 - len - 16);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 14. Yosemite Sam's Showdown — BOSS BATTLE
    P([0, -0.5, -50], [64, 1, 64], '#c49a6c', { name: 'StreetFloor' });
    H.house(20, 0, -35, '#8d6e63'); H.house(-20, 0, -60, '#a1887f');
    P([14, 7, -75], [3, 14, 3], '#6d4c41', { name: 'WaterLeg' });
    P([14, 15, -75], [8, 5, 8], '#8d6e63', { name: 'WaterTank' });
    H.fig(0, 0, -50, 1, 'Boss', [[0,3,0, 5,6,4, '#b71c1c', ''],[0,7.4,0, 3,3,2.8, '#ffcc99', 'Head'],[0,9.1,0, 5.6,0.8,5.2, '#4e342e', 'Hat'],[0,10.3,0, 3,2.4,3, '#4e342e', 'HatTop'],[-0.8,6.9,1.5, 1.2,0.5,0.3, '#ffffff', 'MusL'],[0.8,6.9,1.5, 1.2,0.5,0.3, '#ffffff', 'MusR'],[0,7.4,1.55, 0.6,0.7,0.5, '#e53935', 'Nose'],[-3,4,0, 0.9,2.6,0.9, '#b71c1c', 'ArmL'],[3,4,0, 0.9,2.6,0.9, '#b71c1c', 'ArmR']]);
    const samParts = [{ n: 'Boss', ox: 0, oy: 3, oz: 0 },{ n: 'BossHead', ox: 0, oy: 7.4, oz: 0 },{ n: 'BossHat', ox: 0, oy: 9.1, oz: 0 },{ n: 'BossHatTop', ox: 0, oy: 10.3, oz: 0 },{ n: 'BossMusL', ox: -0.8, oy: 6.9, oz: 1.5 },{ n: 'BossMusR', ox: 0.8, oy: 6.9, oz: 1.5 },{ n: 'BossNose', ox: 0, oy: 7.4, oz: 1.55 },{ n: 'BossArmL', ox: -3, oy: 4, oz: 0 },{ n: 'BossArmR', ox: 3, oy: 4, oz: 0 }];
    S('Showdown', scrBossChar('Yosemite Sam', 5, 15, 0, -50, 36, samParts));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 15. Granny's House Hijinks — TREASURE HUNT (8 cookies)
    P([0, -0.5, -45], [56, 1, 46], '#a1887f', { name: 'HouseFloor' });
    const W = (wx, wz, ww, wd) => P([wx, 3, wz], [ww, 6, wd], '#8d6e63', { name: 'Wall', m: 'wood' });
    W(-16, -23, 24, 2); W(16, -23, 24, 2);
    W(0, -67, 56, 2); W(-28, -45, 2, 46); W(28, -45, 2, 46);
    W(-14, -45, 2, 18); W(14, -52, 2, 20);
    P([-18, 1.5, -32], [8, 3, 4], '#6d4c41', { name: 'Sofa', m: 'wood' });
    P([18, 2, -58], [6, 4, 6], '#5d4037', { name: 'Table', m: 'wood' });
    P([0, 1, -40], [10, 2, 6], '#d7ccc8', { name: 'Rug' });
    const spots = [[-20, -30], [-8, -38], [8, -30], [20, -38], [-20, -55], [-5, -60], [12, -52], [22, -62]];
    for (const sp of spots) H.coinAt(sp[0], 1.2, sp[1], 'Coin', '#d2a679', [1.6, 0.7, 1.6]);
    H.granny(7, 1, -8, 1, 'Granny');
    S('Cookie Hunt', scrHunt(8, 'cookies'));
    S('NPC Talk', scrNPC("GrannyDress", "Granny: Someone hid my 8 cookies! Find them, dearie!", ["Find my cookies, dearie!", "Have some tea when you're done!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 16. Acme Factory Floor — SURVIVAL (60s)
    P([0, -0.5, -50], [64, 1, 64], '#78909c', { name: 'FactoryFloor' });
    for (let i = 0; i < 6; i++) H.crate(-20 + (i % 3) * 20, 0, -25 - Math.floor(i / 3) * 40);
    H.anvil(15, 0, -40); H.tnt(-15, 0, -60);
    P([0, -0.4, -50], [20, 0.2, 4], '#ffc107', { name: 'Hazard', m: 'neon' });
    const hazards = [];
    for (let i = 0; i < 5; i++) {
      const nm = 'Crusher' + i, hz = -25 - i * 12;
      P([0, 2, hz], [6, 4, 2], '#e53935', { name: nm, k: 'kill', m: 'metal' });
      hazards.push({ name: nm, x: 0, y: 2, z: hz, ax: 24, az: 0, sp: (0.5 + i * 0.12).toFixed(2) });
    }
    H.wile(7, 1, -8, 1, 'Wile');
    S('Factory Survival', scrSurvival(60, hazards));
    S('NPC Talk', scrNPC("WileBody", "Wile E.: Acme crushers, the finest! Survive 60 seconds!", ["...", "Acme: quality you can trust! (Do not trust.)"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 17. Looney Star Summit — KING OF THE HILL (30s)
    P([0, -0.5, -50], [80, 1, 80], '#4a7c59', { name: 'HillFloor' });
    P([0, 1, -50], [30, 2, 30], '#5d8a66', { name: 'Hill1' });
    P([0, 3, -50], [22, 2, 22], '#6b9a76', { name: 'Hill2' });
    P([0, 5, -50], [14, 2, 14], '#ffd700', { name: 'Summit', m: 'neon' });
    H.tree(-25, 0, -30); H.tree(25, 0, -70); H.rock(-20, 0, -65, 3); H.rock(22, 0, -35, 2);
    P([0, 1.5, -50], [3, 3, 3], '#e53935', { name: 'Guard', k: 'kill' });
    H.bugs(7, 1, -8, 1, 'Bugs');
    S('Summit Hold', scrKoth(0, 6, -50, 8, 30)
      + "onTick((dt,t)=>{if(!game.won)movePart('Guard',Math.sin(t*0.8)*28,1.5,-50+Math.cos(t*0.5)*28);});");
    S('NPC Talk', scrNPC("BugsBody", "Bugs: Hold that summit 30 seconds, doc!", ["What's up, doc?", "That guard is one tough customer!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 18. Carrot Patch Capers — TREASURE HUNT (12 golden carrots)
    P([0, -0.5, -50], [90, 1, 90], '#6a9a4e', { name: 'FieldFloor' });
    H.house(-28, 0, -25, '#d7ccc8');
    for (let i = 0; i < 8; i++) H.carrotPatch(-35 + r() * 70, 0, -20 - r() * 60);
    for (let i = 0; i < 12; i++) H.coinAt(-38 + r() * 76, 1.2, -15 - r() * 70, 'Coin', '#ffd400', [1.2, 1.6, 1.2]);
    H.bugs(-7, 1, -8, 1, 'Bugs');
    S('Golden Carrot Hunt', scrHunt(12, 'golden carrots'));
    S('NPC Talk', scrNPC("BugsBody", "Bugs: Find 12 GOLDEN carrots, doc! Not the regular ones!", ["Golden ones, doc!", "My carrots! Well, the golden ones anyway."]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 19. Duck Dodgers' Space Station — MAZE
    const mz = H.maze(0, -60, 7, 10, 6, '#3a506b', '#1a2b3c');
    for (let i = 0; i < 30; i++) H.star((r() - 0.5) * 160, 25 + r() * 45, -20 - r() * 110);
    P([mz.ex + 24, 25, mz.ez], [12, 12, 1], '#0d47a1', { name: 'Earth', m: 'neon' });
    P([mz.ex + 12, 1, mz.ez + 12], [6, 2, 8], '#546e7a', { name: 'Bridge', m: 'metal' });
    H.daffy(mz.sx + 1, 0, mz.sz + 8, 1, 'Dodgers');
    S('Station Maze', scrMaze(mz.sx.toFixed(1), mz.sz.toFixed(1), 'Navigate to the bridge!'));
    S('NPC Talk', scrNPC("DodgersBody", "Duck Dodgers: To the bridge! In the 24th and a half century!", ["Duck Dodgers, away!", "You're despicable... in space!"]));
    H.finish(mz.ex + 12, 0, mz.ez);
    return [x, y, z];
  },
  (P, r, H, S, x, y, z) => { // 20. That's All, Folks! Finale — TARGET BLITZ (12 stars)
    P([0, -0.5, -50], [76, 1, 76], '#4e342e', { name: 'StageFloor' });
    P([-30, 8, -80], [12, 16, 2], '#b71c1c', { name: 'Curtain' });
    P([30, 8, -80], [12, 16, 2], '#b71c1c', { name: 'Curtain' });
    P([0, 15, -80], [72, 4, 2], '#7f0000', { name: 'Valance' });
    for (const sx of [-18, 18]) {
      P([sx, 3, -30], [1, 6, 1], '#212121', { name: 'SpotPole' });
      P([sx, 6.5, -30], [1.6, 1, 1.6], '#fff59d', { name: 'Spotlight', m: 'neon' });
    }
    const targets = [];
    for (let i = 0; i < 12; i++) {
      const tx = -28 + r() * 56, tz = -20 - r() * 50, nm = 'Star' + i;
      P([tx, 1.5, tz], [2.5, 2.5, 2.5], '#ffd400', { name: nm, k: 'coin', m: 'neon' });
      targets.push({ name: nm, x: tx.toFixed(1), y: 1.5, z: tz.toFixed(1), sp: (0.3 + r() * 0.3).toFixed(2), rg: (3 + r() * 3).toFixed(1), ph: (r() * 6).toFixed(2) });
    }
    H.bugs(7, 1, -8, 1, 'Bugs');
    S('Star Pop', scrBlitz(targets, 'stars'));
    S('NPC Talk', scrNPC("BugsBody", "Bugs: Pop 12 stars! That's almost all, folks!", ["What's up, doc?", "That's almost all, folks!"]));
    H.finish(0, 0, 26);
    return [x, y, z];
  },
];

function looneyWorld(idx) {
  const cfg = LOONEY_GAMES[idx];
  const w = { sky: cfg.sky, parts: [], scripts: [] };
  let pid = 1;
  const P = (p, s, c, extra = {}) => w.parts.push({ id: 'p' + (pid++), name: extra.name || 'Part', p, s, c, k: 'part', m: 'plastic', ...extra });
  let sd = 1234 + idx * 999;
  const r = () => ((sd = (sd * 1664525 + 1013904223) >>> 0) / 4294967296);
  const H = looneyHelpers(P, r);
  const S = (name, code) => w.scripts.push({ id: 's' + (w.scripts.length + 1), name, code });
  P([0, -40, 0], [2000, 1, 2000], '#ff3b1f', { name: 'Lava', k: 'kill', m: 'neon' });
  P([0, 0, 0], [24, 2, 24], '#d9d9d9', { name: 'StartPlatform' });
  P([0, 1.25, 0], [6, 0.5, 6], '#3a7bd5', { name: 'SpawnLocation', k: 'spawn', m: 'spawn' });
  LOONEY_BUILDERS[idx](P, r, H, S, 0, 0, -12);
  return w;
}

async function seedLooneyGames() {
  try {
    const { data: existing } = await supabase.from('games').select('id').eq('event', 'looney');
    const have = new Set((existing || []).map(g => g.id));
    // Detect old (generic) worlds: new themed worlds contain decor parts like 'Carrot'
    let isThemed = false;
    if (have.size >= LOONEY_GAMES.length) {
      const { data: sample } = await supabase.from('games').select('world').eq('id', 'g_looney01').maybeSingle();
      isThemed = (sample?.world?.scripts || []).length > 0;
    }
    if (have.size >= LOONEY_GAMES.length && isThemed && !process.env.LOONEY_RESEED) return { created: 0 };
    await supabase.from('games').delete().eq('event', 'looney');
    let created = 0;
    for (let i = 0; i < LOONEY_GAMES.length; i++) {
      const id = 'g_looney' + String(i + 1).padStart(2, '0');
      const cfg = LOONEY_GAMES[i];
      const game = {
        id, name: cfg.name, creator: 'Funtopia', description: '🥕 ' + cfg.desc,
        world: sanitizeWorld(looneyWorld(i)), event: 'looney',
        visits: 0, likes: 0, dislikes: 0, max_players: 30,
        created: Date.now(), updated: Date.now(), thumbnail: '', unpublished: false,
      };
      const { error } = await supabase.from('games').insert(game);
      if (error) console.warn('looney seed failed for', id, error.message);
      else { created++; console.log('looney seed: created', id); }
    }
    return { created };
  } catch (e) { console.warn('looney seed error:', e.message); return { created: 0 }; }
}

app.post('/api/admin/event/seed', auth, async (req, res) => {
  if (!isAdmin(req.user)) return res.status(403).json({ error: 'Admin only' });
  res.json(await seedLooneyGames());
});

app.get('/api/event/looney', auth, async (req, res) => {
  const { data: games } = await supabase.from('games').select('id,name,description,visits,thumbnail').eq('event', 'looney').order('id');
  const wins = Array.isArray(req.user.looneyWins) ? req.user.looneyWins : [];
  res.json({
    id: LOONEY_EVENT.id, name: LOONEY_EVENT.name, need: LOONEY_EVENT.need,
    starts: LOONEY_EVENT.starts, ends: LOONEY_EVENT.ends, active: looneyActive(),
    games: games || [], wins, coins: wins.length, claimed: wins.length >= LOONEY_EVENT.need,
  });
});

loadCustomBadges().then(() => console.log('Custom badges loaded:', Object.keys(CUSTOM_BADGES).length));
seedLooneyGames().then(r => console.log('Looney games seeded:', r.created));
// Unlock the limited-edition Looney rewards for @fun
(async () => {
  try {
    const { data: u } = await supabase.from('users').select('earnedBadges,inventory').eq('name', 'fun').maybeSingle();
    if (u) {
      const badges = [...new Set([...(Array.isArray(u.earnedBadges) ? u.earnedBadges : []), LOONEY_EVENT.badge])];
      const inv = [...new Set([...(Array.isArray(u.inventory) ? u.inventory : []), ...LOONEY_EVENT.items])];
      await supabase.from('users').update({ earnedBadges: badges, inventory: inv }).eq('name', 'fun');
      console.log('Looney rewards unlocked for @fun');
    }
  } catch (e) { console.log('Looney @fun unlock failed:', e.message); }
})();
server.listen(PORT, () => console.log(`Funtopia running on http://localhost:${PORT}`));

export default app;
