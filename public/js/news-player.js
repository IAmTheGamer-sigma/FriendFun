// 📡 News broadcast player (glitch + live anchor / video). Lazy-loaded on broadcast.
import { NEWSBOY_AVATAR, buildNewsStudio } from './news-studio.js?v=9285cfef';
export function showNewsBroadcast(D, b) {
  const { esc, me, ensureAvatar3d } = D;

  if (document.querySelector('.news-overlay')) return;
  const ov = document.createElement('div');
  ov.className = 'news-overlay news-glitch';
  ov.innerHTML = `<div class="news-static"></div><div class="news-glitch-text">📡 SIGNAL INTERRUPTED</div>`;
  document.body.appendChild(ov);
  let unlockFn = null;
  const close = () => { try { speechSynthesis.cancel(); } catch {} if (unlockFn) document.removeEventListener('pointerdown', unlockFn); ov.remove(); };
  setTimeout(async () => {
    ov.classList.remove('news-glitch');
    if (b.type === 'live') {
      ov.innerHTML = `
        <div class="news-frame">
          <div class="news-banner">📡 FUNTOPIA NEWS LIVE</div>
          <div class="news-live-stage"><canvas class="news-anchor-canvas"></canvas></div>
          <div class="news-lower3rd"><b>${esc(b.title)}</b><div class="news-script">${esc(b.script)}</div></div>
        </div>`;
      // 3D news studio + autoplay voice (no exit button, no tap choice)
      const stage = ov.querySelector('.news-live-stage');
      let talking = true, spoken = false;
      const doSpeak = () => {
        if (spoken) return;
        spoken = true;
        try {
          speechSynthesis.cancel();
          const u = new SpeechSynthesisUtterance(b.script);
          const vs = speechSynthesis.getVoices();
          const v = vs.find(v => v.name === b.voice) || vs.find(v => v.lang.startsWith('en'));
          if (v) u.voice = v;
          u.rate = 1; u.pitch = 1;
          let closed = false;
          const finish = () => { if (closed) return; closed = true; talking = false; setTimeout(() => { if (ov.isConnected) close(); }, 1500); };
          u.onend = finish; u.onerror = finish;
          // Fallback: estimate duration (~14 chars/sec) + buffer, in case onend never fires
          const estMs = Math.max(8000, (b.script.length / 14) * 1000 + 4000);
          setTimeout(() => { if (ov.isConnected) finish(); }, estMs);
          speechSynthesis.speak(u);
        } catch {}
      };
      // Audio unlock: first tap anywhere triggers voice (iOS requirement)
      unlockFn = () => { doSpeak(); };
      document.addEventListener('pointerdown', unlockFn, { once: true });
      try {
        const A3 = await ensureAvatar3d().catch(() => null);
        if (!A3 || !ov.isConnected) throw new Error('3D unavailable');
        const canvas = ov.querySelector('.news-anchor-canvas');
        const av = b.anchor === 'bot' ? NEWSBOY_AVATAR : (b.avatar || (me && me.avatar) || NEWSBOY_AVATAR);
        const THREE = await import('three');
        const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
        r.setSize(420, 420);
        const sc = new THREE.Scene();
        // News studio set
        const studio = buildNewsStudio(THREE);
        sc.add(studio.group);
        // Anchor behind desk
        const ch = A3.buildCharacter(av);
        ch.position.set(0, 0, 0); ch.rotation.y = 0;
        sc.add(ch);
        // Camera: news framing
        const cam = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
        cam.position.set(0, 5.2, 13); cam.lookAt(0, 3.5, 0);
        sc.add(new THREE.AmbientLight(0xffffff, 0.9));
        const key = new THREE.DirectionalLight(0xffffff, 1.0); key.position.set(5, 10, 8); sc.add(key);
        const rim = new THREE.DirectionalLight(0x7c6cf5, 0.6); rim.position.set(-5, 6, -4); sc.add(rim);
        let last = performance.now();
        const tick = (now) => {
          if (!ov.isConnected) return;
          requestAnimationFrame(tick);
          const dt = Math.min(0.05, (now - last) / 1000); last = now;
          const t = now / 1000;
          studio.update(dt);
          ch.rotation.y = Math.sin(t * 0.6) * 0.12;
          if (talking) { ch.position.y = Math.abs(Math.sin(t * 9)) * 0.1; ch.rotation.z = Math.sin(t * 1.3) * 0.03; }
          r.render(sc, cam);
        };
        requestAnimationFrame(tick);
      } catch (e) {
        stage.innerHTML = '<div class="news-fallback-anchor">🧑‍💼</div>';
      }
      // Autoplay voice
      doSpeak();
    } else {
      // Video broadcast: anchor intro, then video with tap-for-audio (iOS needs a gesture)
      ov.innerHTML = `
        <div class="news-frame">
          <div class="news-banner">📡 FUNTOPIA NEWS</div>
          <div class="news-video-intro"><canvas class="news-anchor-canvas" width="400" height="400"></canvas>
            <div class="news-intro-text"><b>${esc(b.title)}</b><div class="muted">A special report…</div></div></div>
          
        </div>`;
      ov.querySelector('.news-close').onclick = close;
      try {
        const A3 = await ensureAvatar3d().catch(() => null);
        if (A3 && ov.isConnected) {
          const canvas = ov.querySelector('.news-anchor-canvas');
          const av = { skin: '#c0c0c0', shirt: '#1a1a2e', pants: '#0f0f1a', hat: 'hat_tophat' };
          const THREE = await import('three');
          const r = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
          const sc = new THREE.Scene();
          const cam = new THREE.PerspectiveCamera(28, 1, 0.1, 100); cam.position.set(0, 4.2, 15); cam.lookAt(0, 3, 0);
          sc.add(new THREE.AmbientLight(0xffffff, 1.3));
          const ch = A3.buildCharacter(av); sc.add(ch);
          const tick = () => { if (!ov.isConnected || !ov.querySelector('.news-video-intro')) return; requestAnimationFrame(tick); ch.rotation.y = Math.sin(Date.now() / 2500) * 0.15; r.render(sc, cam); };
          tick();
        }
      } catch {}
      setTimeout(() => {
        if (!ov.isConnected) return;
        const frame = ov.querySelector('.news-frame');
        frame.innerHTML = `
          <div class="news-banner">📡 FUNTOPIA NEWS</div>
          <div class="news-video-wrap">
            <video class="news-video-el" src="${esc(b.video)}" playsinline></video>
            <button class="news-unmute">🔊 Tap for sound</button>
          </div>
          <div class="news-lower3rd"><b>${esc(b.title)}</b></div>
          `;
        frame.querySelector('.news-close').onclick = close;
        const v = frame.querySelector('video');
        const unmute = frame.querySelector('.news-unmute');
        unmute.onclick = () => { v.muted = false; v.play().catch(() => {}); unmute.remove(); };
        v.muted = true; v.play().catch(() => {});
        v.onended = close;
      }, 4000);
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