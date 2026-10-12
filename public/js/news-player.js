// 📡 News broadcast player (glitch + live anchor / video). Lazy-loaded on broadcast.
export function showNewsBroadcast(D, b) {
  const { esc, me, ensureAvatar3d } = D;

  if (document.querySelector('.news-overlay')) return;
  const ov = document.createElement('div');
  ov.className = 'news-overlay news-glitch';
  ov.innerHTML = `<div class="news-static"></div><div class="news-glitch-text">📡 SIGNAL INTERRUPTED</div>`;
  document.body.appendChild(ov);
  const close = () => { speechSynthesis.cancel(); ov.remove(); };
  setTimeout(async () => {
    ov.classList.remove('news-glitch');
    if (b.type === 'live') {
      ov.innerHTML = `
        <div class="news-frame">
          <div class="news-banner">📡 FUNTOPIA NEWS LIVE</div>
          <div class="news-live-stage"><canvas class="news-anchor-canvas"></canvas></div>
          <div class="news-lower3rd"><b>${esc(b.title)}</b><div class="news-script">${esc(b.script)}</div></div>
          <button class="news-close">✕</button>
        </div>`;
      ov.querySelector('.news-close').onclick = close;
      // 3D anchor
      try {
        const A3 = await ensureAvatar3d().catch(() => null);
        if (A3 && !ov.isConnected) return;
        const canvas = ov.querySelector('.news-anchor-canvas');
        const av = b.anchor === 'bot'
          ? { skin: '#c0c0c0', shirt: '#1a1a2e', pants: '#0f0f1a', hat: 'hat_tophat' }
          : (b.avatar || me.avatar);
        const { THREE } = await import('./three-util.js?v=ac3e6f2b');
        const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        r.setSize(400, 400);
        const sc = new THREE.Scene();
        const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100); cam.position.set(0, 4.2, 15); cam.lookAt(0, 3, 0);
        sc.add(new THREE.AmbientLight(0xffffff, 1.3));
        const key = new THREE.DirectionalLight(0xffffff, 0.8); key.position.set(5, 10, 7); sc.add(key);
        const ch = A3.buildCharacter(av); sc.add(ch);
        let talking = true;
        const tick = () => {
          if (!ov.isConnected) return;
          requestAnimationFrame(tick);
          const t = Date.now();
          ch.rotation.y = Math.sin(t / 2500) * 0.15;
          if (talking) ch.position.y = Math.abs(Math.sin(t / 180)) * 0.12;
          r.render(sc, cam);
        };
        tick();
        // AI voice
        const u = new SpeechSynthesisUtterance(b.script);
        const v = speechSynthesis.getVoices().find(v => v.name === b.voice);
        if (v) u.voice = v;
        u.onend = () => { talking = false; };
        speechSynthesis.cancel(); speechSynthesis.speak(u);
      } catch {}
    } else {
      ov.innerHTML = `
        <div class="news-frame">
          <div class="news-banner">📡 FUNTOPIA NEWS</div>
          <video class="news-video-el" src="${esc(b.video)}" controls autoplay playsinline></video>
          <div class="news-lower3rd"><b>${esc(b.title)}</b></div>
          <button class="news-close">✕</button>
        </div>`;
      ov.querySelector('.news-close').onclick = close;
      const v = ov.querySelector('video');
      v.onended = close;
      v.play().catch(() => {});
    }
  }, 2600);
}
async function checkNews() {
  if (!token || !me || document.querySelector('.news-overlay')) return;
  try {
    const r = await api('GET', '/api/news');
    const b = r.broadcast;
    if (!b) return;
    const seen = +(localStorage.newsSeenAt || 0);
    if (b.at > seen) { localStorage.newsSeenAt = b.at; showNewsBroadcast(b); }
  } catch {}
}
setInterval(checkNews, 5000);