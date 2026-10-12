// UGC (player-created avatar items). Wired into server.js via ugcDeps.
import crypto from 'crypto';
export const ugcState = { items: {}, tableOk: true, bucketOk: false };
export function createUgc(D) {
  const { app, auth, modOnly, supabase, supabaseAdmin, SUPABASE_URL, ITEM, UGC_TEMPLATES, UGC_MAX_PRICE, UGC_CREATOR_CUT, UGC_BUCKET, UGC_GLB_MAX, filter, key, list, ugcDef, validUgcTransform, ensureUgcBucket } = D;
  const ugcPublic = u => ({ id: u.id, type: u.type, name: u.name, price: u.price, color: u.color, template: u.template, model_url: u.model_url || null, model_transform: u.model_transform || null, creator: u.creator, sales: u.sales });
  // Upload a .glb model file (base64). Returns a public URL; the item is created separately.
  app.post('/api/ugc/model', auth, async (req, res) => {
    try {
      const data = String(req.body?.data || '');
      if (!data) return res.status(400).json({ error: 'No file data' });
      const buf = Buffer.from(data, 'base64');
      if (buf.length > UGC_GLB_MAX) return res.status(400).json({ error: 'Model must be under 4MB' });
      if (buf.length < 12 || buf.readUInt32LE(0) !== 0x46546C67) return res.status(400).json({ error: 'Not a valid .glb file' });
      if (!ugcState.bucketOk) await ensureUgcBucket();
      if (!ugcState.bucketOk) return res.status(500).json({ error: 'Storage not ready' });
      const key = `ugc/${crypto.randomUUID()}.glb`;
      const { error } = await supabaseAdmin.storage.from(UGC_BUCKET).upload(key, buf, { contentType: 'model/gltf-binary', upsert: false });
      if (error) throw error;
      const { data: pub } = supabaseAdmin.storage.from(UGC_BUCKET).getPublicUrl(key);
      res.json({ url: pub.publicUrl });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/ugc', async (req, res) => {
    res.json(Object.values(ugcState.items).map(ugcPublic));
  });
  app.post('/api/ugc', auth, async (req, res) => {
    if (!ugcState.tableOk) return res.status(500).json({ error: 'UGC not set up' });
    const b = req.body || {};
    const type = String(b.type || '');
    if (!['hat', 'shirt', 'gear'].includes(type)) return res.status(400).json({ error: 'Type must be hat, shirt, or gear' });
    let template = null, color = null, model_url = null, model_transform = null;
    if (b.model_url) {
      // Custom 3D model (.glb) path — must be a URL from our own upload endpoint
      model_url = String(b.model_url);
      const okPrefix = SUPABASE_URL.replace(/\/$/, '') + '/storage/v1/object/public/' + UGC_BUCKET + '/';
      if (!model_url.startsWith(okPrefix)) return res.status(400).json({ error: 'Invalid model URL' });
      model_transform = validUgcTransform(b.transform);
      if (typeof model_transform === 'string') return res.status(400).json({ error: model_transform });
    } else {
      // Remix path (hats and shirts only)
      if (!['hat', 'shirt'].includes(type)) return res.status(400).json({ error: 'Remix only supports hats and shirts — use a 3D model for gears' });
      template = String(b.template || '');
      const t = ITEM[template];
      if (!t || t.type !== type || t.limited || !(UGC_TEMPLATES[type] || []).includes(template)) return res.status(400).json({ error: 'Invalid template' });
      color = String(b.color || '');
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Invalid color' });
    }
    const name = filter(String(b.name || '').trim()).slice(0, 40);
    if (name.length < 3) return res.status(400).json({ error: 'Name must be at least 3 characters' });
    const price = Math.floor(Number(b.price));
    if (!Number.isFinite(price) || price < 0 || price > UGC_MAX_PRICE) return res.status(400).json({ error: 'Price must be 0–' + UGC_MAX_PRICE });
    try {
      const { data: mine } = await supabase.from('ugc_items').select('id,status').eq('creator', req.user.name);
      if ((mine || []).filter(r => r.status === 'pending').length >= 5) return res.status(400).json({ error: 'You have 5 items awaiting review already' });
      if ((mine || []).length >= 50) return res.status(400).json({ error: 'Item limit reached (50)' });
      const id = crypto.randomBytes(4).toString('hex');
      const row = { id, creator: req.user.name, type, template, color, model_url, model_transform, name, price, status: 'pending', sales: 0 };
      const { data, error } = await supabase.from('ugc_items').insert(row).select().single();
      if (error) {
        if (/model_url|model_transform/i.test(error.message)) return res.status(500).json({ error: '3D models need the updated SQL — run supabase_ugc.sql' });
        throw error;
      }
      res.json({ ok: true, item: { ...ugcPublic(ugcDef(data)), status: 'pending' } });
    } catch (e) { res.status(500).json({ error: e.message }); }
  });
  app.get('/api/ugc/status', auth, (req, res) => res.json({ table: ugcState.tableOk, bucket: ugcState.bucketOk }));
  app.get('/api/ugc/mine', auth, async (req, res) => {
    if (!ugcState.tableOk) return res.json([]);
    const { data } = await supabase.from('ugc_items').select('*').eq('creator', req.user.name).order('created_at', { ascending: false });
    res.json((data || []).map(r => ({ ...ugcPublic(ugcDef(r)), status: r.status })));
  });
  app.get('/api/ugc/pending', modOnly, async (req, res) => {
    if (!ugcState.tableOk) return res.json([]);
    const { data } = await supabase.from('ugc_items').select('*').eq('status', 'pending').order('created_at', { ascending: true });
    res.json((data || []).map(r => ({ ...ugcPublic(ugcDef(r)), status: r.status })));
  });
  app.post('/api/ugc/:id/approve', modOnly, async (req, res) => {
    const raw = String(req.params.id).replace(/^ugc_/, '');
    const { data, error } = await supabase.from('ugc_items').update({ status: 'approved' }).eq('id', raw).eq('status', 'pending').select().single();
    if (error || !data) return res.status(404).json({ error: 'Not found or already reviewed' });
    try {
      const { data: cu } = await supabase.from('users').select('inventory').eq('name', data.creator).single();
      const inv = Array.isArray(cu?.inventory) ? cu.inventory : [];
      if (!inv.includes('ugc_' + data.id)) await supabase.from('users').update({ inventory: [...inv, 'ugc_' + data.id] }).eq('name', data.creator);
    } catch {}
    await loadUgcItems();
    logMod(req.user.name, 'ugc_approve', data.name, data.creator);
    res.json({ ok: true });
  });
  app.post('/api/ugc/:id/reject', modOnly, async (req, res) => {
    const raw = String(req.params.id).replace(/^ugc_/, '');
    const { data, error } = await supabase.from('ugc_items').update({ status: 'rejected' }).eq('id', raw).eq('status', 'pending').select().single();
    if (error || !data) return res.status(404).json({ error: 'Not found or already reviewed' });
    logMod(req.user.name, 'ugc_reject', data.name, data.creator);
    res.json({ ok: true });
  });
  app.post('/api/ugc/:id/buy', auth, async (req, res) => {
    const id = 'ugc_' + String(req.params.id).replace(/^ugc_/, '');
    const it = ugcState.items[id];
    if (!it) return res.status(404).json({ error: 'No such item' });
    if (list(req.user, 'inventory').includes(id)) return res.status(400).json({ error: 'You already own this' });
    if ((Number(req.user.funtix) || 0) < it.price) return res.status(400).json({ error: 'Not enough FunTix' });
    const cut = Math.floor(it.price * UGC_CREATOR_CUT);
    const buyerInv = [...list(req.user, 'inventory'), id];
    const { error: e1 } = await supabase.from('users').update({ funtix: (Number(req.user.funtix) || 0) - it.price, inventory: buyerInv }).eq('name', req.user.name);
    if (e1) return res.status(500).json({ error: e1.message });
    try {
      const { data: crow } = await supabase.from('users').select('funtix').eq('name', it.creator).single();
      if (crow) await supabase.from('users').update({ funtix: (Number(crow.funtix) || 0) + cut }).eq('name', it.creator);
      await supabase.from('ugc_items').update({ sales: it.sales + 1 }).eq('id', id.replace(/^ugc_/, ''));
    } catch {}
    ugcState.items[id] = { ...it, sales: it.sales + 1 };
    res.json({ funtix: (Number(req.user.funtix) || 0) - it.price, inventory: buyerInv });
  });

  return { getUgcStatus: () => ({ table: ugcState.tableOk, bucket: ugcState.bucketOk }) };
}
