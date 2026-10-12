// 💀 HACKER PANEL (server) — owner-only site-wide visual "corruption" events,
// c00l-style. Events are prank/visual only: glitch overlays, fake-hack banners,
// matrix rain, screen shake, color invert, jumpscare flash. Every endpoint is
// gated to owners server-side; events auto-expire.
export function createHacker(D) {
  const { app, auth, rooms, broadcast, isOwner } = D;
  let hackEvent = null; // { type, text, at, until, by }
  const TYPES = ['corrupt', 'matrix', 'invert', 'shake', 'fakehack', 'jumpscare'];
  const clean = () => { if (hackEvent && Date.now() > hackEvent.until) hackEvent = null; };

  app.post('/api/hacker/event', auth, (req, res) => {
    if (!isOwner(req.user)) return res.status(403).json({ error: 'Owners only' });
    const type = String(req.body?.type || '').toLowerCase();
    if (!TYPES.includes(type)) return res.status(400).json({ error: 'Unknown event type' });
    const text = String(req.body?.text || '').replace(/[<>&"]/g, '').slice(0, 40);
    if (type === 'fakehack' && !text) return res.status(400).json({ error: 'fakehack needs a name' });
    const seconds = Math.max(5, Math.min(1800, Math.floor(Number(req.body?.seconds) || 60)));
    hackEvent = { type, text, at: Date.now(), until: Date.now() + seconds * 1000, by: req.user.name };
    for (const room of rooms.values()) broadcast(room, { t: 'hack', ...hackEvent });
    res.json({ ok: true, event: hackEvent });
  });

  app.get('/api/hacker/event', auth, (req, res) => { clean(); res.json({ event: hackEvent }); });

  app.post('/api/hacker/clear', auth, (req, res) => {
    if (!isOwner(req.user)) return res.status(403).json({ error: 'Owners only' });
    hackEvent = null;
    for (const room of rooms.values()) broadcast(room, { t: 'hack', clear: true });
    res.json({ ok: true });
  });

  // Online (in-game) player names, for the terminal `players` command.
  app.get('/api/hacker/online', auth, (req, res) => {
    if (!isOwner(req.user)) return res.status(403).json({ error: 'Owners only' });
    const names = [];
    for (const room of rooms.values()) for (const p of room.players.values()) names.push(p.name);
    res.json({ names: [...new Set(names)] });
  });

  setInterval(clean, 60000);
}
