// 📡 Funtopia News broadcast — owner triggers a glitch-then-video on everyone's screen.
export function createNews(D) {
  const { app, auth, rooms, broadcast, isOwner } = D;
  let newsBC = null; // { video, title, at, by }

  app.post('/api/owner/news', auth, (req, res) => {
    if (!isOwner(req.user)) return res.status(403).json({ error: 'Owners only' });
    const video = String(req.body?.video || '').trim().slice(0, 500);
    if (!/^https?:\/\/.+\.(mp4|webm|mov)(\?.*)?$/i.test(video)) return res.status(400).json({ error: 'Video URL must end in .mp4, .webm or .mov' });
    const title = String(req.body?.title || 'Breaking News').trim().slice(0, 80) || 'Breaking News';
    newsBC = { video, title, at: Date.now(), by: req.user.name };
    for (const room of rooms.values()) broadcast(room, { t: 'news', video, title });
    res.json({ ok: true });
  });
  app.get('/api/news', auth, (req, res) => res.json({ broadcast: newsBC }));
  app.post('/api/owner/news/clear', auth, (req, res) => {
    if (!isOwner(req.user)) return res.status(403).json({ error: 'Owners only' });
    newsBC = null;
    res.json({ ok: true });
  });
  // auto-expire after 30 min
  setInterval(() => { if (newsBC && Date.now() - newsBC.at > 30 * 60 * 1000) newsBC = null; }, 60000);
  return { getBroadcast: () => newsBC };
}
