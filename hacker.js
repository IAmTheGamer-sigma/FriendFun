// 💀 HACKER PANEL (server) — owner-only site + game hacking, c00l-style.
// Site events: visual/prank takeovers (glitch, matrix, invert, shake, image
// swap, fake-hack takeover, jumpscare). Game commands: kill/freeze/teleport/
// message everyone mid-game. Every endpoint is gated to owners; events expire.
export function createHacker(D) {
  const { app, auth, rooms, broadcast, isOwner } = D;
  let hackEvent = null; // { type, text, at, until, by }
  const TYPES = ['corrupt', 'matrix', 'invert', 'shake', 'images', 'fakehack', 'jumpscare'];
  const clean = () => { if (hackEvent && Date.now() > hackEvent.until) hackEvent = null; };
  const ownerOnly = (req, res) => {
    if (!isOwner(req.user)) { res.status(403).json({ error: 'Owners only' }); return false; }
    return true;
  };

  app.post('/api/hacker/event', auth, (req, res) => {
    if (!ownerOnly(req, res)) return;
    const type = String(req.body?.type || '').toLowerCase();
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Unknown event type' });
    let text = String(req.body?.text || '').replace(/[<>&"]/g, '').slice(0, 500);
    if (type === 'fakehack') {
      text = text.slice(0, 40);
      if (!text) return res.status(400).json({ error: 'fakehack needs a name' });
    }
    if (type === 'images') {
      if (!/^https?:\/\/.+/i.test(text)) return res.status(400).json({ error: 'images needs an http(s) image URL' });
    }
    const seconds = Math.max(5, Math.min(1800, Math.floor(Number(req.body?.seconds) || 60)));
    hackEvent = { type, text, at: Date.now(), until: Date.now() + seconds * 1000, by: req.user.name };
    for (const room of rooms.values()) broadcast(room, { t: 'hack', ...hackEvent });
    res.json({ ok: true, event: hackEvent });
  });

  app.get('/api/hacker/event', auth, (req, res) => { clean(); res.json({ event: hackEvent }); });

  app.post('/api/hacker/clear', auth, (req, res) => {
    if (!ownerOnly(req, res)) return;
    hackEvent = null;
    for (const room of rooms.values()) broadcast(room, { t: 'hack', clear: true });
    res.json({ ok: true });
  });

  app.get('/api/hacker/online', auth, (req, res) => {
    if (!ownerOnly(req, res)) return;
    const names = [];
    for (const room of rooms.values()) for (const p of room.players.values()) names.push(p.name);
    res.json({ names: [...new Set(names)] });
  });

  // ---- game hacking: hit every live game session at once ----
  app.post('/api/hacker/game', auth, (req, res) => {
    if (!ownerOnly(req, res)) return;
    const command = String(req.body?.command || '').toLowerCase();
    let n = 0;
    const each = fn => { for (const room of rooms.values()) { fn(room); n += room.players.size; } };
    if (command === 'killall') {
      each(room => broadcast(room, { t: 'gearHit' }));
      return res.json({ ok: true, message: `☠ Eliminated ${n} players mid-game` });
    } else if (command === 'freeze' || command === 'unfreeze') {
      const on = command === 'freeze';
      each(room => broadcast(room, { t: 'freeze', on }));
      return res.json({ ok: true, message: `${on ? '❄️ Froze' : '🔥 Unfroze'} ${n} players` });
    } else if (command === 'tpall') {
      const x = Number(req.body?.x) || 0, y = Number(req.body?.y) || 30, z = Number(req.body?.z) || 0;
      each(room => broadcast(room, { t: 'tp', x, y, z }));
      return res.json({ ok: true, message: `🌀 Teleported ${n} players` });
    } else if (command === 'sayall') {
      const text = String(req.body?.text || '').slice(0, 200);
      if (!text) return res.status(400).json({ error: 'Empty text' });
      each(room => broadcast(room, { t: 'sys', text }));
      return res.json({ ok: true, message: `💬 Message sent to ${n} players` });
    }
    return res.status(400).json({ error: 'Unknown game command' });
  });

  setInterval(clean, 60000);
}
