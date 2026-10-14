// 🔌 Fun Plugin Scripts page — code scripting with the `fun` API + GitHub sync.
import { FUN_PLUGIN, createFunAPI, syncScriptsToGitHub, loadScriptsFromGitHub } from './fun-plugin.js?v=5e1bcf37';
import { compileFunScript, FUNSCRIPT_EXAMPLE } from './funscript.js?v=6cad5c05';

const FUN_API_DOCS = `// 🔌 Fun Plugin API by @fun
// Available as 'fun' in your scripts:

fun.say(text)              // Show message in chat
fun.shout(text)            // Big announcement
fun.giveTix(player, amt)   // Give FunTix
fun.teleport(player,x,y,z) // Teleport player
fun.players()              // List players [{name, pos}]
fun.me()                   // Your info {name, pos}
fun.spawnPart({name,x,y,z})// Spawn a part
fun.findPart(name)         // Find part by name
fun.onTouch("part", fn)    // fn(player) when YOU touch a part
fun.onJoin(fn)             // fn(player) when someone joins
await fun.wait(ms)         // Wait
fun.random(a,b)            // Random number
fun.log(...args)           // Console log

// Example:
fun.shout('Hello from my script!');
for (const p of fun.players()) {
  fun.say('Hi ' + p.name);
}`;

export function scriptsPage(D) {
  const { esc, me, api, toast } = D;
  const app = document.getElementById('app');
  let scripts = JSON.parse(localStorage.getItem('funScripts') || '[]');
  let active = 0;

  const save = () => localStorage.setItem('funScripts', JSON.stringify(scripts));

  function render() {
    app.innerHTML = `
      <div class="page scripts-page">
        <h1>🔌 Fun Plugin <span class="muted small">by @fun v${FUN_PLUGIN.version}</span></h1>
        <p class="muted">${esc(FUN_PLUGIN.description)}</p>
        <div class="scripts-layout">
          <div class="scripts-list">
            <button class="btn-primary" id="newScript">+ New Script</button>
            <div id="scriptItems">${scripts.map((s, i) => `
              <div class="script-item ${i === active ? 'active' : ''}" data-i="${i}">
                <span>📜 ${esc(s.name)}</span>
                <button class="icon-btn del" data-i="${i}" title="Delete">🗑️</button>
              </div>`).join('')}</div>
            <div class="github-sync">
              <h3>GitHub Sync</h3>
              <input id="ghRepo" placeholder="owner/repo" value="${esc(localStorage.getItem('funGhRepo') || '')}">
              <input id="ghToken" type="password" placeholder="GitHub token (paste once)">
              <div class="row">
                <button class="btn-secondary" id="ghPull">⬇️ Pull</button>
                <button class="btn-secondary" id="ghPush">⬆️ Push</button>
              </div>
              <p class="muted small">Scripts sync to <code>fun-scripts/</code> in your repo.</p>
            </div>
          </div>
          <div class="scripts-editor">
            ${scripts.length ? `
              <input id="scriptName" value="${esc(scripts[active].name)}" placeholder="Script name">
              <textarea id="scriptCode" spellcheck="false">${esc(scripts[active].code)}</textarea>
              <div class="row">
                <button class="btn-primary" id="runScript">▶️ Run</button>
                <button class="btn-secondary" id="saveScript">💾 Save</button>
                <button class="btn-secondary" id="showApi">📖 API Docs</button>
              </div>
              <pre id="apiDocs" class="hidden">${esc(FUN_API_DOCS)}</pre>
            ` : '<p class="muted">Create a script to get started.</p>'}
          </div>
        </div>
      </div>`;
    bind();
  }

  function bind() {
    app.querySelector('#newScript').onclick = () => {
      const name = 'script' + (scripts.length + 1);
      scripts.push({ name, code: '// Your script here\nfun.shout("Hello!");' });
      active = scripts.length - 1; save(); render();
    };
    app.querySelectorAll('.script-item').forEach(el => {
      el.onclick = e => {
        if (e.target.classList.contains('del')) {
          if (confirm('Delete this script?')) { scripts.splice(+e.target.dataset.i, 1); active = 0; save(); render(); }
        } else { active = +el.dataset.i; render(); }
      };
    });
    const nameInput = app.querySelector('#scriptName');
    const codeInput = app.querySelector('#scriptCode');
    if (nameInput) {
      app.querySelector('#saveScript').onclick = () => {
        scripts[active].name = nameInput.value || 'untitled';
        scripts[active].code = codeInput.value;
        save(); toast('Script saved'); render();
      };
      app.querySelector('#showApi').onclick = () => app.querySelector('#apiDocs').classList.toggle('hidden');
      app.querySelector('#runScript').onclick = () => {
        toast('Run scripts in a game via Studio test mode (coming soon)');
      };
    }
    // GitHub sync
    const repoInput = app.querySelector('#ghRepo');
    const tokenInput = app.querySelector('#ghToken');
    app.querySelector('#ghPush').onclick = async () => {
      const repo = repoInput.value.trim(), token = tokenInput.value.trim() || localStorage.getItem('funGhToken');
      if (!repo || !token) { toast('Enter repo and token', true); return; }
      localStorage.setItem('funGhRepo', repo);
      if (tokenInput.value.trim()) localStorage.setItem('funGhToken', token);
      try { await syncScriptsToGitHub(scripts, repo, token); toast(`Pushed ${scripts.length} scripts to ${repo}`); }
      catch (e) { toast('Push failed: ' + e.message, true); }
    };
    app.querySelector('#ghPull').onclick = async () => {
      const repo = repoInput.value.trim(), token = tokenInput.value.trim() || localStorage.getItem('funGhToken');
      if (!repo || !token) { toast('Enter repo and token', true); return; }
      try {
        const pulled = await loadScriptsFromGitHub(repo, token);
        scripts = pulled; active = 0; save(); render();
        toast(`Pulled ${pulled.length} scripts`);
      } catch (e) { toast('Pull failed: ' + e.message, true); }
    };
  }

  render();
}
