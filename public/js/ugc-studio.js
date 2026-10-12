import * as THREE from 'three';
import { ITEM, UGC_TEMPLATES, UGC_CREATOR_CUT } from './catalog.js?v=d76f1cb9';

// Transform editor spec: [key, label, min, max, step, default]
const XF = [
  ['dx', '\u2194 Left / Right', -2, 2, 0.1, 0],
  ['dy', '\u2195 Up / Down', -2, 2, 0.1, 0],
  ['dz', '\u2922 Forward / Back', -2, 2, 0.1, 0],
  ['ry', '\ud83d\udd04 Spin', 0, 360, 5, 0],
  ['s', '\ud83d\udd0d Size', 0.3, 2.5, 0.05, 1],
];

const UGC_PALETTE = ['#e53935', '#ff6d00', '#ffeb3b', '#43a047', '#26c6da', '#1e88e5', '#7b1fa2', '#f48fb1', '#ffffff', '#9e9e9e', '#212121', '#795548'];
const UGC_MODEL_SLOTS = ['hat', 'shirt', 'gear'];
const UGC_GLB_MAX = 4 * 1024 * 1024;
// GLB card placeholder (3D loads async)
const glbCardImg = () => '<div class="glb-ph">📦<span>3D</span></div>';
const ugcCardImg = u => u.model_url ? glbCardImg() : `<img src="${D.itemImage(u)}">`;
export async function ugcPage(D) {
  const app = document.getElementById('app');
  const A3 = await D.ensureAvatar3d().catch(() => null);
  let mode = 'remix';
  let type = 'hat', template = UGC_TEMPLATES.hat[0], color = '#e53935';
  let slot = 'hat', glbFile = null, glbObjUrl = null;
  let xf = { dx: 0, dy: 0, dz: 0, ry: 0, s: 1 };
  let mine = [], ugcStatus = { table: true, bucket: true };
  try { mine = await D.api('GET', '/api/ugc/mine'); } catch {}
  try { ugcStatus = await D.api('GET', '/api/ugc/status'); } catch {}
  for (const m of mine) if (!ITEM[m.id]) ITEM[m.id] = { id: m.id, type: m.type, name: m.name, price: m.price, color: m.color, template: m.template, model_url: m.model_url || null, model_transform: m.model_transform || null, creator: m.creator, ugc: true };
  D.mount('create', `
    <h1>Create</h1>
    <div class="av-tabs"><button data-goto="#/create">🎮 Experiences</button><button class="active">🎨 UGC Studio</button></div>
    ${!ugcStatus.table ? '<p class="ugc-warn">⚠️ UGC database not set up — run supabase_ugc.sql in Supabase, then refresh.</p>' : !ugcStatus.bucket ? '<p class="ugc-warn">⚠️ Model storage not ready — add SUPABASE_SERVICE_KEY on Render, then refresh.</p>' : ''}
    <p class="muted">Remix a template or upload your own .glb 3D model, pick where it goes, set a price. A moderator reviews every item before it goes on sale — you earn <b>${Math.round(UGC_CREATOR_CUT * 100)}%</b> of every sale.</p>
    <div class="av-wrap">
      <div class="av-preview"><canvas class="av-canvas"></canvas><div class="muted small">Live preview</div></div>
      <div class="av-panel">
        <div class="av-tabs">${[['remix', 'Remix'], ['model', '3D Model']].map(([k, l]) => `<button data-ugcmode="${k}" class="${k === mode ? 'active' : ''}">${l}</button>`).join('')}</div>
        <div class="ugc-remix">
          <div class="av-tabs">${['hat', 'shirt'].map(t => `<button data-ugctype="${t}" class="${t === type ? 'active' : ''}">${t === 'hat' ? 'Hats' : 'Shirts'}</button>`).join('')}</div>
          <div class="ugc-templates"></div>
          <div class="swatches">${UGC_PALETTE.map(c => `<button class="swatch" data-c="${c}" style="background:${c}"></button>`).join('')}<label class="swatch custom" title="Custom color"><input type="color" value="${color}"></label></div>
        </div>
        <div class="ugc-model" hidden>
          <p class="muted small" style="margin:8px 0 4px">Where should it go?</p>
          <div class="av-tabs">${UGC_MODEL_SLOTS.map(s => `<button data-ugcsSlot="${s}" class="${s === slot ? 'active' : ''}">${s[0].toUpperCase() + s.slice(1)}</button>`).join('')}</div>
          <div class="ugc-drop">
            <label class="btn-secondary btn-small">Choose .glb file<input type="file" class="ugc-glb" accept=".glb,model/gltf-binary" hidden></label>
            <span class="muted small ugc-filename">No file chosen</span>
          </div>
          <p class="muted small">GLB up to 4MB. Uncompressed exports work best.</p>
          <div class="ugc-model-err"></div>
          <p class="muted small" style="margin:8px 0 4px">Fine-tune where it sits</p>
          <div class="ugc-xform">${XF.map(([k, label, min, max, step, def]) => `
            <label class="xf-row"><span>${label}</span><input type="range" data-xf="${k}" min="${min}" max="${max}" step="${step}" value="${def}"><b data-xfval="${k}">${def}</b></label>`).join('')}</div>
        </div>
        <label>Item name<input class="ugc-name" maxlength="40" placeholder="My cool hat"></label>
        <label>Price (FunTix)<input class="ugc-price" type="number" min="0" max="10000" value="100"></label>
        <button class="btn-primary ugc-submit">Submit for review</button>
      </div>
    </div>
    <section><div class="sec-h"><h2>My creations (${mine.length})</h2></div>
      <div class="cat-grid">${mine.map(m => `<div class="cat-item"><div class="cat-img">${D.ugcCardImg(m)}</div><div class="cat-name">${D.esc(m.name)}</div><div class="muted small">${m.type}${m.model_url ? ' · 3D' : ''} · ${D.tix} ${m.price} · ${m.sales || 0} sold</div><span class="ugc-status ${m.status}">${m.status}</span></div>`).join('') || '<p class="muted">Nothing yet — create your first item above!</p>'}</div></section>`,
  () => {
    app.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => location.hash = b.dataset.goto);
    const tplBox = app.querySelector('.ugc-templates');
    let ch = null, alive = true, r = null, sc = null;
    const rebuild = () => {
      if (!A3 || !sc) return;
      if (ch) sc.remove(ch);
      ch = null;
      const av = structuredClone(D.me.avatar);
      if (mode === 'model') {
        if (!glbObjUrl) return;
        ITEM['ugc_preview'] = { id: 'ugc_preview', type: slot, model_url: glbObjUrl, model_transform: { ...xf }, ugc: true };
        av[slot] = 'ugc_preview';
      } else {
        ITEM['ugc_preview'] = { id: 'ugc_preview', type, color, template };
        av[type] = 'ugc_preview';
      }
      ch = A3.buildCharacter(av); sc.add(ch);
    };
    if (A3) {
      const canvas = app.querySelector('.av-canvas');
      r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); r.outputColorSpace = THREE.SRGBColorSpace;
      sc = new THREE.Scene(); sc.add(new THREE.HemisphereLight('#fff', '#888', 1.5));
      const dl = new THREE.DirectionalLight('#fff', 1.6); dl.position.set(3, 6, 8); sc.add(dl);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100); cam.position.set(0, 3.6, 14); cam.lookAt(0, 3, 0);
      const size = () => { const w = canvas.parentElement.clientWidth; r.setSize(w, w, false); };
      size(); rebuild();
      const tick = () => { if (!alive) return; requestAnimationFrame(tick); r.render(sc, cam); }; tick();
      D.setCleanup(() => { alive = false; r.dispose(); delete ITEM['ugc_preview']; });
    }
    // Remix tab
    const renderTpls = () => {
      tplBox.innerHTML = `<div class="item-grid">${UGC_TEMPLATES[type].map(tid => { const t = ITEM[tid]; return `<button class="item ${tid === template ? 'worn' : ''}" data-tpl="${tid}"><img src="${D.itemImage(t)}"><span>${D.esc(t.name)}</span></button>`; }).join('')}</div>`;
      tplBox.querySelectorAll('[data-tpl]').forEach(b => b.onclick = () => { template = b.dataset.tpl; renderTpls(); rebuild(); });
    };
    renderTpls();
    app.querySelectorAll('[data-ugctype]').forEach(b => b.onclick = () => {
      type = b.dataset.ugctype; template = UGC_TEMPLATES[type][0];
      app.querySelectorAll('[data-ugctype]').forEach(x => x.classList.toggle('active', x === b));
      renderTpls(); rebuild();
    });
    app.querySelectorAll('.swatch[data-c]').forEach(b => b.onclick = () => { color = b.dataset.c; rebuild(); });
    app.querySelector('.swatch.custom input[type=color]').onchange = e => { color = e.target.value; rebuild(); };
    // Mode tabs
    app.querySelectorAll('[data-ugcmode]').forEach(b => b.onclick = () => {
      mode = b.dataset.ugcmode;
      app.querySelectorAll('[data-ugcmode]').forEach(x => x.classList.toggle('active', x === b));
      app.querySelector('.ugc-remix').hidden = mode !== 'remix';
      app.querySelector('.ugc-model').hidden = mode !== 'model';
      rebuild();
    });
    // 3D model tab
    app.querySelectorAll('[data-ugcsSlot]').forEach(b => b.onclick = () => {
      slot = b.dataset.ugcsSlot;
      app.querySelectorAll('[data-ugcsSlot]').forEach(x => x.classList.toggle('active', x === b));
      rebuild();
    });
    app.querySelectorAll('[data-xf]').forEach(inp => inp.oninput = () => {
      xf[inp.dataset.xf] = Number(inp.value);
      app.querySelector(`[data-xfval="${inp.dataset.xf}"]`).textContent = inp.value;
      rebuild();
    });
    const errBox = app.querySelector('.ugc-model-err');
    const showErr = msg => { errBox.textContent = msg || ''; errBox.classList.toggle('show', !!msg); };
    app.querySelector('.ugc-glb').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      if (!/\.glb$/i.test(f.name)) { showErr('File must be a .glb'); return; }
      if (f.size > UGC_GLB_MAX) { showErr('Model must be under 4MB'); return; }
      showErr('');
      glbFile = f;
      if (glbObjUrl) URL.revokeObjectURL(glbObjUrl);
      glbObjUrl = URL.createObjectURL(f);
      app.querySelector('.ugc-filename').textContent = f.name;
      rebuild();
    };
    app.querySelector('.ugc-submit').onclick = async () => {
      const nm = app.querySelector('.ugc-name').value.trim();
      const pr = Math.floor(Number(app.querySelector('.ugc-price').value));
      try {
        if (mode === 'model') {
          if (!glbFile) throw new Error('Choose a .glb file first');
          D.toast('Uploading model…');
          const b64 = await new Promise((res, rej) => {
            const rd = new FileReader();
            rd.onload = () => res(String(rd.result).split(',')[1]);
            rd.onerror = () => rej(new Error('Could not read file'));
            rd.readAsDataURL(glbFile);
          });
          const up = await D.api('POST', '/api/ugc/model', { data: b64 });
          await D.api('POST', '/api/ugc', { type: slot, model_url: up.url, transform: xf, name: nm, price: pr });
        } else {
          await D.api('POST', '/api/ugc', { type, template, color, name: nm, price: pr });
        }
        D.toast('Submitted for review! 🎨');
        await D.loadUgc();
        ugcPage(D);
      } catch (e) { D.toast(e.message, true); }
    };
  });
}
