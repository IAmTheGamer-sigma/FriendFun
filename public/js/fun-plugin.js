// 🔌 Fun Plugin by @fun — official Studio scripting plugin.
// Provides the `fun` API for world scripts + GitHub sync.
export const FUN_PLUGIN = {
  id: 'fun-plugin',
  name: 'Fun Plugin',
  author: '@fun',
  version: '1.0.0',
  description: 'Official scripting plugin by @fun. Write JavaScript to control your world.',
};

// The `fun` API available in scripts
export function createFunAPI(ctx) {
  const { game, world } = ctx;
  return {
    // Players
    players: () => [...game.players.values()].map(p => ({ name: p.name, pos: { x: p.char.position.x, y: p.char.position.y, z: p.char.position.z } })),
    me: () => ({ name: game.me.name, pos: { x: game.pos.x, y: game.pos.y, z: game.pos.z } }),
    // Actions
    say: (text) => game.sys(String(text)),
    shout: (text) => game.showBig(String(text), 3000),
    giveTix: (playerName, amount) => game.send({ t: 'scriptTix', to: playerName, amount }),
    teleport: (playerName, x, y, z) => game.send({ t: 'scriptTp', to: playerName, x, y, z }),
    // World
    spawnPart: (opts) => game.spawnScriptPart(opts),
    findPart: (name) => game.findPartByName(name),
    // Utils
    wait: (ms) => new Promise(r => setTimeout(r, ms)),
    random: (a, b) => a + Math.random() * (b - a),
    log: (...args) => console.log('[Fun Script]', ...args),
  };
}

// GitHub sync for scripts
export async function syncScriptsToGitHub(scripts, repo, token) {
  // scripts: [{ name, code }]
  // Uses GitHub API to push to repo
  const headers = { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'Accept': 'application/vnd.github.v3+json' };
  for (const s of scripts) {
    const path = `fun-scripts/${s.name}.js`;
    const url = `https://api.github.com/repos/${repo}/contents/${path}`;
    // Get existing SHA (if any)
    let sha;
    try {
      const r = await fetch(url, { headers });
      if (r.ok) { const j = await r.json(); sha = j.sha; }
    } catch {}
    const body = { message: `Update ${s.name} via Fun Plugin`, content: btoa(unescape(encodeURIComponent(s.code))) };
    if (sha) body.sha = sha;
    await fetch(url, { method: 'PUT', headers, body: JSON.stringify(body) });
  }
  return true;
}

export async function loadScriptsFromGitHub(repo, token) {
  const headers = { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github.v3+json' };
  const url = `https://api.github.com/repos/${repo}/contents/fun-scripts`;
  const r = await fetch(url, { headers });
  if (!r.ok) return [];
  const files = await r.json();
  const scripts = [];
  for (const f of files) {
    if (!f.name.endsWith('.js')) continue;
    const cr = await fetch(f.download_url);
    const code = await cr.text();
    scripts.push({ name: f.name.replace('.js', ''), code });
  }
  return scripts;
}
