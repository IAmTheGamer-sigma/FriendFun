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
const money = u => ({ funtix: Number(u.funtix) || 0 });
const list = (u, field) => Array.isArray(u?.[field]) ? u[field] : [];

async function seed() {
  const now = Date.now();
  const g = (id, name, creator, desc, tpl, visits, likes, dislikes, max_players = 30) =>
    ({ id, name, creator, description: desc, world: templates[tpl](), visits, likes, dislikes, max_players, created: now, updated: now, thumbnail: null });
  
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
    admin: isAdmin(u), club: isClub(u), champ: !!u.champ, newcomer: true,
    tix_100: (Number(u.funtix) || 0) >= 100, tix_500: (Number(u.funtix) || 0) >= 500,
    tix_1000: (Number(u.funtix) || 0) >= 1000, tix_5000: (Number(u.funtix) || 0) >= 5000,
    friend_1: list(u, 'friends').length >= 1, friend_5: list(u, 'friends').length >= 5, friend_10: list(u, 'friends').length >= 10,
    collector_5: list(u, 'inventory').length >= 5, collector_15: list(u, 'inventory').length >= 15,
    collector_all: CATALOG.every(item => list(u, 'inventory').includes(item.id)), creator: false,
  };
  const earned = list(u, 'earnedBadges').filter(id => BADGES[id]);
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
  res.json({ ...await publicUser(u), daily, funtix: u.funtix, inventory: u.inventory, requests: u.requests, friendList: u.friends, favorites: u.favorites, recent: u.recent, clubUntil: u.clubUntil || 0, clubForever: isAdmin(u) || !!u.clubForever });
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

app.post('/api/buy/:item', auth, async (req, res) => {
  const it = ITEM[req.params.item];
  if (!it) return res.status(404).json({ error: 'No such item' });
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
  res.json(await Promise.all((users || []).map(async u => ({ ...await publicUser(u), clubForever: isAdmin(u) || !!u.clubForever, clubUntil: u.clubUntil || 0, funtix: u.funtix }))));
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
  } else {
    return res.status(400).json({ error: 'Unknown admin command' });
  }
  const { data: updated, error } = await supabase.from('users').update(updates).eq('name', user.name).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json({ ok: true, message, user: { ...await publicUser(updated), funtix: updated.funtix, clubForever: isAdmin(updated) || !!updated.clubForever } });
});

function groupView(group, username) {
  const members = Array.isArray(group.members) ? group.members : [];
  const creator = group.creator || group.owner || 'Unknown';
  return {
    id: group.id,
    name: group.name,
    description: group.description || '',
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
  const group = { id: `group_${crypto.randomUUID()}`, name, description, creator: req.user.name, members: [req.user.name], created: Date.now() };
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
    return res.json({ status: 'friends' });
  }
  const updatedOther = { requests: [...(other.requests || []), mk] };
  await supabase.from('users').update(updatedOther).eq('name', ok);
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
      if (!rooms.has(g.id)) rooms.set(g.id, { players: new Map() });
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
      if (player.coins.has(m.part) || now - player.lastCoin < 150) return;
      const coinId = m.part;
      player.coins.add(coinId); player.lastCoin = now;
      const earned = ECON.COIN_TIX + (isClub(player.user) ? ECON.CLUB_COIN_BONUS : 0);
      const { data: updated, error } = await supabase.from('users').update({ funtix: (Number(player.user.funtix) || 0) + earned }).eq('name', player.user.name).select().single();
      if (error || !updated) return send(ws, { t: 'error', error: 'Could not add FunTix' });
      player.user = updated;
      send(ws, { t: 'money', ...money(updated), earned });
    }
    else if (m.t === 'win') {
      if (player.won) return; player.won = true;
      const earnedBadges = [...new Set([...list(player.user, 'earnedBadges'), ...winBadges(player.game)])];
      const { data: updated, error } = await supabase.from('users').update({ funtix: (Number(player.user.funtix) || 0) + ECON.WIN_TIX, champ: true, earnedBadges }).eq('name', player.user.name).select().single();
      if (error || !updated) return send(ws, { t: 'error', error: 'Could not add FunTix' });
      player.user = updated;
      send(ws, { t: 'money', ...money(updated), earned: ECON.WIN_TIX });
      broadcast(room, { t: 'chat', system: true, text: `${player.name} beat the game! (+${ECON.WIN_TIX} FunTix, ${winBadges(player.game).length} badge${winBadges(player.game).length === 1 ? '' : 's'} earned)` });
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

server.listen(PORT, () => console.log(`FriendFun running on http://localhost:${PORT}`));

export default app;
