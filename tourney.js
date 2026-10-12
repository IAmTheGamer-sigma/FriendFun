// Spooky Rivals tournament (server side). Wired into server.js via tourneyDeps.
export const TOURNEY_GAME = 'g_spookyrivals';
export const TOURNEY_ENDS = Date.UTC(2026, 9, 15, 3, 59, 0); // Wed Oct 14 2026, 11:59pm ET
export const RIVALS_ROUNDS = 5; // first to 5 rounds (real Rivals rules)
export const TOURNEY_PRIZE = 'hat_pumpkin_champ';

export function createTourney(D) {
  const { app, auth, supabase, privateServers, rooms, notify, key, list, broadcast, send } = D;
  const tourney = { queue: [], matches: new Map(), wins: new Map(), loadouts: new Map(), finalized: false, winner: null, tableOk: true };
  const RIVALS_WEAPONS = ['rifle', 'smg', 'shotgun', 'sniper']; // primary pool (pistol is always secondary)
  function tourneyCode() {
    const ABC = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let code; do { code = Array.from({ length: 6 }, () => ABC[Math.floor(Math.random() * ABC.length)]).join(''); } while (privateServers.has(code));
    return code;
  }
  async function tourneyLoad() {
    try {
      const { data, error } = await supabase.from('tourney_wins').select('*');
      if (error) throw error;
      for (const r of data || []) tourney.wins.set(key(r.name), { name: r.name, wins: r.wins || 0 });
    } catch (e) { tourney.tableOk = false; console.warn('tourney_wins table missing:', e.message); }
  }
  async function tourneyAddWin(name) {
    const k = key(name);
    const cur = tourney.wins.get(k) || { name, wins: 0 };
    cur.wins++; tourney.wins.set(k, cur);
    if (!tourney.tableOk) return;
    try {
      const { error } = await supabase.from('tourney_wins').upsert({ name, wins: cur.wins }, { onConflict: 'name' });
      if (error) throw error;
    } catch (e) { tourney.tableOk = false; console.warn('tourney_wins write failed'); }
  }
  async function tourneyFinalizeIfDue() {
    if (tourney.finalized || Date.now() < TOURNEY_ENDS) return;
    tourney.finalized = true;
    const board = [...tourney.wins.values()].sort((a, b) => b.wins - a.wins);
    const winner = board.length && board[0].wins > 0 ? board[0].name : null;
    tourney.winner = winner;
    console.log('Tournament finalized. Winner:', winner);
    if (!winner) return;
    try {
      const { data: u } = await supabase.from('users').select('inventory').eq('name', winner).maybeSingle();
      if (u && !list(u, 'inventory').includes(TOURNEY_PRIZE)) {
        await supabase.from('users').update({ inventory: [...list(u, 'inventory'), TOURNEY_PRIZE] }).eq('name', winner);
        notify(winner, 'tourney', `👑 You won the Spooky Rivals Tournament! The Champion Pumpkin Head is yours!`, '#/avatar');
      }
    } catch (e) { console.warn('tourney prize failed:', e.message); }
  }
  function matchOfRoom(room) {
    const tcode = room.private?.split(':')[1];
    const tm = tcode && tourney.matches.get(tcode);
    return (tm && tm.state !== 'done') ? { tm, tcode } : null;
  }
  function roomFor(tm) {
    return rooms.get(tm.code ? TOURNEY_GAME + ':' + tm.code : TOURNEY_GAME);
  }
  function startRound(tm) {
    tm.state = 'round'; tm.round++;
    const room = roomFor(tm);
    if (room) broadcast(room, { t: 'rivalsRound', round: tm.round, rounds: tm.rounds, p1: tm.p1, p2: tm.p2 });
  }
  // called on WS join — sends rivals match info; starts round 1 when both are in
  function tourneyJoin(player, room, ws) {
    const found = matchOfRoom(room);
    if (!found) return;
    const { tm } = found;
    if (tm.p1 !== player.name && tm.p2 !== player.name) return;
    const opp = tm.p1 === player.name ? tm.p2 : tm.p1;
    const myLoadout = tourney.loadouts.get(key(player.name)) || { primary: 'rifle', secondary: 'pistol' };
    send(ws, { t: 'rivals', opponent: opp, loadout: myLoadout, rounds: tm.rounds, round: tm.round, p1: tm.p1, p2: tm.p2, roundsToWin: RIVALS_ROUNDS });
    // both in? start round 1
    if (tm.state === 'waiting') {
      const names = new Set([...room.players.values()].map(p => p.name));
      if (names.has(tm.p1) && names.has(tm.p2)) startRound(tm);
    }
  }
  // called on { t: 'rivalsDeath', by } — victim reports elimination (Rivals rules)
  function rivalsDeath(player, room, killer) {
    const found = matchOfRoom(room);
    if (!found || typeof killer !== 'string') return;
    const { tm, tcode } = found;
    if (tm.state !== 'round') return;
    const opp = tm.p1 === player.name ? tm.p2 : tm.p2 === player.name ? tm.p1 : null;
    if (!opp || killer !== opp) return;
    const now = Date.now();
    if (now - (tm.lastDeath || 0) < 2000) return;
    tm.lastDeath = now;
    tm.state = 'intermission'; tm.rounds[killer]++;
    broadcast(room, { t: 'rivalsRoundEnd', winner: killer, rounds: tm.rounds, p1: tm.p1, p2: tm.p2, roundsToWin: RIVALS_ROUNDS });
    if (tm.rounds[killer] >= RIVALS_ROUNDS) {
      tm.state = 'done';
      setTimeout(() => {
        const r2 = roomFor(tm);
        if (r2) broadcast(r2, { t: 'tourneyEnd', winner: killer, rounds: tm.rounds });
        tourneyAddWin(killer).catch(() => {});
        if (tcode) setTimeout(() => tourney.matches.delete(tcode), 60000);
      }, 3500);
    } else {
      setTimeout(() => { if (tm.state === 'intermission') startRound(tm); }, 3500);
    }
  }
  // called on WS close — handles forfeit / cancel
  function tourneyLeave(player, room) {
    const found = matchOfRoom(room);
    if (!found) return;
    const { tm, tcode } = found;
    if (tm.p1 !== player.name && tm.p2 !== player.name) return;
    const opp = tm.p1 === player.name ? tm.p2 : tm.p1;
    const oppIn = [...room.players.values()].some(p => p.name === opp && p.id !== player.id);
    if ((tm.state === 'round' || tm.state === 'intermission') && oppIn) {
      tm.state = 'done'; tm.rounds[opp] = RIVALS_ROUNDS;
      broadcast(room, { t: 'tourneyEnd', winner: opp, forfeit: true, rounds: tm.rounds });
      tourneyAddWin(opp).catch(() => {});
      setTimeout(() => tourney.matches.delete(tcode), 60000);
    } else if (tm.state === 'waiting') {
      tm.state = 'done'; tourney.matches.delete(tcode);
      if (oppIn && !tourney.queue.includes(opp)) tourney.queue.push(opp);
    }
  }
  setInterval(() => {
    const now = Date.now();
    for (const [code, m] of tourney.matches) {
      if (m.state === 'waiting' && now - m.started > 5 * 60 * 1000) {
        tourney.matches.delete(code);
        for (const p of [m.p1, m.p2]) if (!tourney.queue.includes(p)) tourney.queue.push(p);
      }
    }
  }, 60000);
  app.get('/api/tourney', auth, async (req, res) => {
    await tourneyFinalizeIfDue();
    const board = [...tourney.wins.values()].sort((a, b) => b.wins - a.wins).slice(0, 20);
    let myMatch = null;
    for (const m of tourney.matches.values())
      if (m.state !== 'done' && (m.p1 === req.user.name || m.p2 === req.user.name)) myMatch = { code: m.code };
    res.json({ endsAt: TOURNEY_ENDS, finalized: tourney.finalized, winner: tourney.winner,
      board, roundsToWin: RIVALS_ROUNDS, prize: TOURNEY_PRIZE,
      inQueue: tourney.queue.includes(req.user.name), myMatch });
  });
  app.post('/api/tourney/join', auth, async (req, res) => {
    await tourneyFinalizeIfDue();
    if (tourney.finalized || Date.now() > TOURNEY_ENDS) return res.status(400).json({ error: 'The tournament is over' });
    const name = req.user.name;
    for (const m of tourney.matches.values())
      if (m.state !== 'done' && (m.p1 === name || m.p2 === name)) return res.json({ matched: true, code: m.code });
    if (!tourney.queue.includes(name)) tourney.queue.push(name);
    if (tourney.queue.length >= 2) {
      const p1 = tourney.queue.shift(), p2 = tourney.queue.shift();
      const code = tourneyCode();
      privateServers.set(code, { gameId: TOURNEY_GAME, owner: p1, created: Date.now() });
      const match = { p1, p2, code, rounds: { [p1]: 0, [p2]: 0 }, round: 0, state: 'waiting', started: Date.now() };
      tourney.matches.set(code, match);
      const link = `#/play/${TOURNEY_GAME}?server=${code}`;
      notify(p1, 'tourney', `🎃 Tournament match vs ${p2} — join now!`, link);
      notify(p2, 'tourney', `🎃 Tournament match vs ${p1} — join now!`, link);
      if (name === p1 || name === p2) return res.json({ matched: true, code });
    }
    return res.json({ queued: true });
  });
  app.post('/api/tourney/loadout', auth, (req, res) => {
    const primary = RIVALS_WEAPONS.includes(req.body?.primary) ? req.body.primary : 'rifle';
    tourney.loadouts.set(key(req.user.name), { primary, secondary: 'pistol' });
    res.json({ ok: true, primary, secondary: 'pistol' });
  });
  app.get('/api/tourney/loadout', auth, (req, res) => {
    res.json(tourney.loadouts.get(key(req.user.name)) || { primary: 'rifle', secondary: 'pistol' });
  });
  app.post('/api/tourney/leave', auth, (req, res) => {
    tourney.queue = tourney.queue.filter(n => n !== req.user.name);
    res.json({ ok: true });
  });
  tourneyLoad().then(() => console.log('Tourney wins loaded:', tourney.wins.size));
  return { tourney, tourneyJoin, rivalsDeath, tourneyLeave, tourneyFinalizeIfDue };
}
