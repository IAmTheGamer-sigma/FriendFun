// 📡 News Maker studio (owner only). Lazy-loaded by app.js.
export async function newsMakerPage(D) {
  const { mount, api, toast, esc, me, ensureAvatar3d, app } = D;

  if (!me || !me.owner) { toast('Owners only', true); location.hash = '#/home'; return; }
  const A3 = await ensureAvatar3d().catch(() => null);
  mount('owner', `<h1>📡 News Maker</h1>
    <p class="muted">Write a script, pick a voice and an anchor. Preview it, then broadcast it live — everyone's screen glitches, then your anchor announces it with an AI voice.</p>
    <div class="nm-status"></div>
    <div class="news-maker">
      <div class="nm-preview"><canvas class="nm-canvas"></canvas><div class="muted small">Anchor preview</div></div>
      <div class="nm-panel">
        <label>Headline<input class="nm-title" maxlength="80" placeholder="Breaking News..."></label>
        <label>Script<textarea class="nm-script" rows="5" maxlength="500" placeholder="Hello Funtopia! This is your news anchor..."></textarea></label>
        <label>AI Voice<select class="nm-voice"></select></label>
        <label>Anchor<select class="nm-anchor"><option value="me">My avatar</option><option value="bot">Newsbot</option></select></label>
        <div class="nm-actions"><button class="btn-secondary nm-preview-btn">▶ Preview</button><button class="btn-primary nm-broadcast">📡 Broadcast Live</button></div>
      </div>
    </div>`,
  () => {
    const voiceSel = app.querySelector('.nm-voice');
    const loadVoices = () => {
      const vs = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'));
      voiceSel.innerHTML = vs.map(v => `<option value="${esc(v.name)}">${esc(v.name)} (${v.lang})</option>`).join('') || '<option>Default</option>';
    };
    loadVoices(); speechSynthesis.onvoiceschanged = loadVoices;
    // 3D anchor preview
    let alive = true, anchorAv = null;
    const canvas = app.querySelector('.nm-canvas');
    const anchorSel = app.querySelector('.nm-anchor');
    const buildPreview = async () => {
      if (!A3 || !alive) return;
      anchorAv = anchorSel.value === 'bot'
        ? { skin: '#c0c0c0', shirt: '#1a1a2e', pants: '#0f0f1a', hat: 'hat_tophat' }
        : me.avatar;
      try {
        const { THREE } = await import('./three-util.js?v=ac3e6f2b');
        const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        r.setSize(300, 300);
        const sc = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 4, 14); cam.lookAt(0, 3, 0);
        sc.add(new THREE.AmbientLight(0xffffff, 1.2));
        const ch = A3.buildCharacter(anchorAv); sc.add(ch);
        const tick = () => { if (!alive) return; requestAnimationFrame(tick); ch.rotation.y = Math.sin(Date.now() / 2000) * 0.2; ch.position.y = Math.sin(Date.now() / 500) * 0.05; r.render(sc, cam); };
        tick();
      } catch {}
    };
    buildPreview();
    anchorSel.onchange = () => { alive = false; setTimeout(() => { alive = true; buildPreview(); }, 50); };
    const speak = text => {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      const v = speechSynthesis.getVoices().find(v => v.name === voiceSel.value);
      if (v) u.voice = v;
      u.rate = 1; u.pitch = 1;
      speechSynthesis.speak(u);
    };
    app.querySelector('.nm-preview-btn').onclick = () => {
      const t = app.querySelector('.nm-script').value.trim();
      if (!t) { toast('Write a script first', true); return; }
      speak(t); toast('🔊 Previewing...');
    };
    const statusEl = app.querySelector('.nm-status');
    const refreshStatus = async () => {
      try {
        const r = await api('GET', '/api/news');
        if (r.broadcast) {
          statusEl.innerHTML = `<p>📡 <b>Live now:</b> ${esc(r.broadcast.title)} <button class="btn-secondary btn-sm nm-replay">👁 View</button> <button class="btn-secondary btn-sm nm-unbroadcast">Stop</button></p>`;
          statusEl.querySelector('.nm-replay').onclick = async () => {
            const m = await import('./news-player.js?v=227ee6a3');
            m.showNewsBroadcast({ esc, me, ensureAvatar3d }, r.broadcast);
          };
          statusEl.querySelector('.nm-unbroadcast').onclick = async () => {
            await api('POST', '/api/owner/news/clear'); refreshStatus(); toast('Broadcast stopped');
          };
        } else statusEl.innerHTML = '<p class="muted small">No broadcast live right now.</p>';
      } catch {}
    };
    refreshStatus(); setInterval(() => { if (document.body.contains(statusEl)) refreshStatus(); }, 10000);
    app.querySelector('.nm-broadcast').onclick = async () => {
      const title = app.querySelector('.nm-title').value.trim() || 'Breaking News';
      const script = app.querySelector('.nm-script').value.trim();
      if (!script) { toast('Write a script first', true); return; }
      if (!confirm('Broadcast this to EVERYONE online?')) return;
      try {
        await api('POST', '/api/owner/news', { type: 'live', title, script, voice: voiceSel.value, anchor: anchorSel.value });
        toast('📡 News broadcast sent!'); refreshStatus();
      } catch (e) { toast(e.message, true); }
    };
  });
}

