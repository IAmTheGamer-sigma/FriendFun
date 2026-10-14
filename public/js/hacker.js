// 💀 HACKER PANEL (client) — owner-only c00l-style terminal for Funtopia.
// Hidden: type "hack" anywhere (outside text fields) to summon a floating
// terminal. No sidebar link, no route. openHackerPanel(D) opens the window;
// pollHackEvent(api) is the global 5s poll applying site-wide events.
export function openHackerPanel(D) {
  const { api, toast, me } = D;
  const hackerAllowed = me && (me.owner || String(me.name || '').toLowerCase() === 'bro');
  if (!hackerAllowed) { toast('owners only', true); return; }
  const existing = document.querySelector('.hk-panel');
  if (existing) { existing.querySelector('.hk-in')?.focus(); return; }
  const w = document.createElement('div');
  w.className = 'hk-panel';
  w.innerHTML = `<div class="hk-panel-bar"><span>💀 HACKER PANEL</span><button class="hk-x" aria-label="close">✕</button></div>
    <div class="hk-quick">
      <button class="btn-danger" data-ev="corrupt">💥 Corrupt</button>
      <button class="btn-secondary" data-ev="matrix">🟩 Matrix</button>
      <button class="btn-secondary" data-ev="invert">🙃 Invert</button>
      <button class="btn-secondary" data-ev="shake">📳 Shake</button>
      <button class="btn-secondary" data-ev="images">🖼️ Img swap</button>
      <button class="btn-secondary" data-ev="fakehack">🚨 Takeover</button>
      <button class="btn-secondary" data-ev="jumpscare">😱 Scare</button>
      <button class="btn-danger" data-game="killall">☠ Kill all</button>
      <button class="btn-secondary" data-game="freeze">❄️ Freeze</button>
      <button class="btn-secondary" data-stop="1">🛑 STOP</button>
    </div>`;
  const term = buildTerminal(api, toast, me);
  w.appendChild(term);
  document.body.appendChild(w);
  w.querySelector('.hk-x').onclick = () => w.remove();
  const fireEv = async (type, text = '', seconds = 60) => {
    term.querySelector('.hk-out').dispatchEvent(new CustomEvent('hk-fire', { detail: { type, text, seconds } }));
  };
  w.querySelectorAll('[data-ev]').forEach(b => b.onclick = async () => {
    const type = b.dataset.ev;
    let text = '';
    if (type === 'fakehack') { text = prompt('HACKED BY... (name)', 'c00lkid'); if (!text) return; }
    if (type === 'images') { text = prompt('Image URL to put EVERYWHERE', 'https://'); if (!text) return; }
    fireEv(type, text, type === 'jumpscare' ? 5 : 60);
  });
  w.querySelectorAll('[data-game]').forEach(b => b.onclick = async () => {
    try { const r = await api('POST', '/api/hacker/game', { command: b.dataset.game }); toast(r.message || 'Done'); }
    catch (e) { toast(e.message, true); }
  });
  w.querySelector('[data-stop]').onclick = async () => {
    try { await api('POST', '/api/hacker/clear'); toast('🛑 event cleared'); } catch (e) { toast(e.message, true); }
  };
  term.querySelector('.hk-in').focus();
  toast('💀 hacker panel summoned');
}

function buildTerminal(api, toast, me) {
  const term = document.createElement('div');
  term.className = 'hk-term';
  term.innerHTML = `<div class="hk-out"></div>
    <div class="hk-inrow"><span class="hk-prompt">fun@funtopia:~$</span><input class="hk-in" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="type 'help'"></div>`;
  const out = term.querySelector('.hk-out');
  const inp = term.querySelector('.hk-in');
  const hist = []; let hi = -1;
  const print = (t, cls = '') => {
    const d = document.createElement('div');
    d.className = 'hk-line ' + cls; d.textContent = t;
    out.appendChild(d); out.scrollTop = out.scrollHeight;
  };
  const ok = t => print('✔ ' + t, 'hk-ok');
  const err = t => print('✖ ' + t, 'hk-err');
  print('FUNTOPIA HACKER PANEL v2.0 — c00l edition', 'hk-ok');
  print("Type 'help'. Everything here hits the LIVE site.", 'hk-warn');

  const fire = async (type, text = '', seconds = 60) => {
    try { await api('POST', '/api/hacker/event', { type, text, seconds }); ok(`${type} event is LIVE for ${seconds}s`); }
    catch (e) { err(e.message); }
  };
  const game = async (command, extra = {}) => {
    try { const r = await api('POST', '/api/hacker/game', { command, ...extra }); ok(r.message || 'Done'); }
    catch (e) { err(e.message); }
  };
  const site = async (command, extra = {}) => {
    try { const r = await api('POST', '/api/admin/site/command', { command, ...extra }); ok(r.message || 'Done'); }
    catch (e) { err(e.message); }
  };
  out.addEventListener('hk-fire', e => { const { type, text, seconds } = e.detail; print(`fun@funtopia:~$ ${type}${text ? ' ' + text : ''}`, 'hk-echo'); fire(type, text, seconds); });

  const help = () => print(
`site corruption:
  corrupt [secs]          💥 full site corruption
  matrix [secs]           🟩 matrix rain over everything
  invert [secs]           🙃 invert all colors
  shake [secs]            📳 shake everyone's screen
  images <url> [secs]     🖼️ replace EVERY image site-wide
  fakehack <name> [secs]  🚨 "HACKED BY <name>" full takeover
  jumpscare [secs]        😱 fullscreen scare flash
  stop                    🛑 end the current event
game hacking:
  killall                 ☠ eliminate everyone in every game
  freeze | unfreeze       ❄️ freeze everyone in every game
  tpall [x y z]           🌀 teleport everyone in every game
  sayall <text>           💬 system message in every game
  nuke                    ☢ killall + corrupt combo
site control:
  kick <name> | kick all  ·  mute <name> [mins] | unmute <name>
  broadcast <text>  ·  rain <n>  ·  news <mp4url> | <title>
  maintenance on|off  ·  shutdown
info: players · count · status · whoami · clear · help`);

  const run = async raw => {
    const line = raw.trim();
    print('fun@funtopia:~$ ' + line, 'hk-echo');
    if (!line) return;
    const sp = line.split(/\s+/);
    const cmd = sp[0].toLowerCase();
    const arg = line.slice(sp[0].length).trim();
    const secs = d => { const n = Math.floor(Number(sp[sp.length - 1])); return (Number.isFinite(n) && n > 0) ? Math.min(n, 1800) : d; };
    try {
      switch (cmd) {
        case 'help': help(); break;
        case 'clear': out.innerHTML = ''; break;
        case 'whoami': ok(`${me.name} — OWNER. respect.`); break;
        case 'players': { const r = await api('GET', '/api/hacker/online'); print(r.names.length ? r.names.join(', ') : '(nobody in-game right now)'); break; }
        case 'count': { const r = await api('GET', '/api/player-count'); print(`👥 ${r.count} total players`); break; }
        case 'status': {
          const [ev, st] = await Promise.all([api('GET', '/api/hacker/event'), api('GET', '/api/site')]);
          print(ev.event ? `ACTIVE: ${ev.event.type}${ev.event.text ? ` ("${ev.event.text.slice(0, 40)}")` : ''} by ${ev.event.by}, ends in ${Math.max(0, Math.round((ev.event.until - Date.now()) / 1000))}s` : 'no hack event active');
          print(`maintenance: ${st.maintenance ? 'ON' : 'OFF'} · announcement: ${st.announce ? '"' + st.announce.text + '"' : 'none'}`);
          break;
        }
        case 'corrupt': case 'matrix': case 'invert': case 'shake':
          await fire(cmd, '', secs(60)); break;
        case 'images': {
          const url = sp[1]; if (!url || !/^https?:\/\//i.test(url)) { err('usage: images <http(s) url> [secs]'); break; }
          await fire('images', url, secs(60)); break;
        }
        case 'fakehack': {
          const name = sp[1]; if (!name) { err('usage: fakehack <name> [secs]'); break; }
          await fire('fakehack', name, secs(60)); break;
        }
        case 'jumpscare': await fire('jumpscare', '', secs(5)); break;
        case 'stop': case 'uncorrupt': await api('POST', '/api/hacker/clear'); ok('event cleared'); break;
        case 'killall': await game('killall'); break;
        case 'freeze': await game('freeze'); break;
        case 'unfreeze': await game('unfreeze'); break;
        case 'tpall': {
          const x = Number(sp[1]) || 0, y = Number(sp[2]) || 30, z = Number(sp[3]) || 0;
          await game('tpall', { x, y, z }); break;
        }
        case 'sayall':
          if (!arg) { err('usage: sayall <text>'); break; }
          await game('sayall', { text: arg.slice(0, 200) }); break;
        case 'nuke':
          await game('killall'); await fire('corrupt', '', 30); ok('☢ NUKE COMPLETE'); break;
        case 'kick':
          if (sp[1] && sp[1].toLowerCase() === 'all') {
            if (confirm('Kick EVERYONE out of all games right now?')) await site('kick_all');
          } else if (sp[1]) {
            const r = await api('POST', '/api/mod/kick', { name: sp[1], reason: 'Kicked via HACKER PANEL' });
            ok(`kicked ${sp[1]} (${r.sessions} session${r.sessions === 1 ? '' : 's'})`);
          } else err('usage: kick <name>  |  kick all');
          break;
        case 'mute': {
          if (!sp[1]) { err('usage: mute <name> [mins]'); break; }
          const m = Math.floor(Number(sp[2])) || 30;
          await api('POST', '/api/mod/mute', { name: sp[1], minutes: m, reason: 'Muted via HACKER PANEL' });
          ok(`muted ${sp[1]} for ${m} min`); break;
        }
        case 'unmute':
          if (!sp[1]) { err('usage: unmute <name>'); break; }
          await api('POST', '/api/mod/unmute', { name: sp[1] }); ok(`unmuted ${sp[1]}`); break;
        case 'broadcast':
          if (!arg) { err('usage: broadcast <text>'); break; }
          await site('announce', { text: arg.slice(0, 200) }); break;
        case 'rain': { const n = Math.max(1, Math.min(1000, Math.floor(Number(sp[1])) || 50)); await site('funtix_rain', { amount: n }); break; }
        case 'news': {
          const [url, title] = arg.split('|').map(s => s.trim());
          if (!url) { err('usage: news <mp4url> | <title>'); break; }
          await api('POST', '/api/owner/news', { type: 'video', video: url, title: title || 'Breaking News' });
          ok('📡 video broadcast sent'); break;
        }
        case 'maintenance':
          if (sp[1] === 'on' || sp[1] === 'off') await site('maintenance', { on: sp[1] === 'on' });
          else err('usage: maintenance on|off');
          break;
        case 'shutdown':
          if (confirm('SHUTDOWN? Turn ON maintenance mode — only owners will be able to log in.')) await site('maintenance', { on: true });
          else print('aborted.');
          break;
        case 'sudo': print('nice try.', 'hk-warn'); break;
        case 'hack': print('this panel only hacks Funtopia 😎', 'hk-warn'); break;
        case 'exit': case 'quit': print('there is no escape.'); break;
        default: err(`unknown command: ${cmd}  (try 'help')`);
      }
    } catch (e) { err(e.message || 'failed'); }
  };

  inp.addEventListener('keydown', e => {
    e.stopPropagation();
    if (e.key === 'Enter') { const v = inp.value; inp.value = ''; if (v.trim()) { hist.unshift(v); hi = -1; } run(v); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (hi < hist.length - 1) { hi++; inp.value = hist[hi] || ''; } }
    else if (e.key === 'ArrowDown') { e.preventDefault(); if (hi > 0) { hi--; inp.value = hist[hi]; } else { hi = -1; inp.value = ''; } }
  });
  term.addEventListener('click', () => inp.focus());
  return term;
}

// ---------- global event poll (called from app.js every 5s) ----------
let activeHack = 0, matrixRaf = 0;
export async function pollHackEvent(api) {
  try {
    const r = await api('GET', '/api/hacker/event');
    const ev = r.event;
    if (!ev) { if (activeHack) clearHackFx(); return; }
    if (ev.at === activeHack) { if (ev.type === 'images') swapImages(ev.text); return; }
    clearHackFx();
    activeHack = ev.at;
    applyHackFx(ev);
  } catch {}
}
function clearHackFx() {
  activeHack = 0;
  document.body.classList.remove('hk-corrupt', 'hk-invert', 'hk-shake');
  document.querySelectorAll('.hk-fx').forEach(e => e.remove());
  document.querySelectorAll('img[data-hk-orig]').forEach(im => { im.src = im.dataset.hkOrig; delete im.dataset.hkOrig; });
  if (matrixRaf) { cancelAnimationFrame(matrixRaf); matrixRaf = 0; }
}
function fxEl(cls, html) {
  const d = document.createElement('div');
  d.className = 'hk-fx ' + cls;
  if (html != null) d.innerHTML = html;
  document.body.appendChild(d);
  return d;
}
function swapImages(url) {
  if (!url) return;
  document.querySelectorAll('img').forEach(im => {
    if (!im.dataset.hkOrig) im.dataset.hkOrig = im.src;
    if (im.src !== url) im.src = url;
  });
}
function applyHackFx(ev) {
  switch (ev.type) {
    case 'corrupt':
      document.body.classList.add('hk-corrupt');
      fxEl('hk-corrupt-ov', `<div class="hk-corrupt-msg">⚠ SYSTEM CORRUPTED ⚠<br><span>fun@funtopia:~$ inject payload... done</span></div>`);
      break;
    case 'matrix': startMatrix(); break;
    case 'invert': document.body.classList.add('hk-invert'); break;
    case 'shake': document.body.classList.add('hk-shake'); break;
    case 'images': swapImages(ev.text); break;
    case 'fakehack': {
      document.body.classList.add('hk-shake');
      const d = fxEl('hk-takeover');
      const t = document.createElement('div');
      t.className = 'hk-takeover-title'; t.textContent = `⚠ HACKED BY ${ev.text || '???'} ⚠`;
      const s = document.createElement('div');
      s.className = 'hk-takeover-sub'; s.textContent = 'THIS SITE HAS BEEN TAKEN OVER';
      const log = document.createElement('div');
      log.className = 'hk-takeover-log';
      d.append(t, s, log);
      ['> injecting payload...', '> bypassing firewall... OK', '> escalating privileges... OK', '> wiping logs... OK', '> takeover complete.'].forEach((ln, i) =>
        setTimeout(() => { if (d.isConnected) { const p = document.createElement('div'); p.textContent = ln; log.appendChild(p); } }, 600 * (i + 1)));
      break;
    }
    case 'jumpscare':
      document.body.classList.add('hk-shake');
      fxEl('hk-jump', '<div class="hk-jump-face">👹</div>');
      break;
  }
}
function startMatrix() {
  const c = document.createElement('canvas');
  c.className = 'hk-fx hk-matrix';
  c.width = innerWidth; c.height = innerHeight;
  document.body.appendChild(c);
  const x = c.getContext('2d');
  const chars = 'アイウエオカキクケコサシスセソ0123456789$#@%&';
  const fs = 16, cols = Math.ceil(c.width / fs), drops = new Array(cols).fill(0);
  x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
  const draw = () => {
    x.fillStyle = 'rgba(0,0,0,0.08)'; x.fillRect(0, 0, c.width, c.height);
    x.fillStyle = '#0f0'; x.font = fs + 'px monospace';
    for (let i = 0; i < cols; i++) {
      x.fillText(chars[(Math.random() * chars.length) | 0], i * fs, drops[i] * fs);
      if (drops[i] * fs > c.height && Math.random() > 0.975) drops[i] = 0;
      drops[i]++;
    }
    matrixRaf = requestAnimationFrame(draw);
  };
  draw();
}
