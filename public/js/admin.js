export async function adminPage(D, q = '', gq = '') {
  const { api, mount, esc, avatarImgTag, toast, loadBadgeDefs, tix, CLUB, ADMIN } = D;
  const me = D.me, BADGE_DEFS = D.BADGE_DEFS;
  if (!me.admin) { location.hash = '#/home'; return; }
  const users = await api('GET', '/api/admin/users?q=' + encodeURIComponent(q));
  let games = [], gamesError = '';
  try { games = await api('GET', '/api/admin/games?q=' + encodeURIComponent(gq)); }
  catch (e) { gamesError = e.message || 'Could not load games'; }
  const badgeOpts = Object.values(BADGE_DEFS).map(b => `<option value="${esc(b.id)}">${esc(b.icon || '')} ${esc(b.name)}${b.custom ? ' (custom)' : ''}</option>`).join('');
  const status = u => u.admin ? 'Admin' : u.clubForever ? 'FriendClub (free)' : u.club ? `FriendClub (${Math.ceil((u.clubUntil - Date.now()) / 86400000)} days left)` : 'Not a member';
  mount('admin', `<h1>Admin Panel</h1>
    <p class="muted">Manage players: FriendClub, FunTix, badges and quick actions.</p>
    <form class="admin-search"><input name="q" placeholder="Search players" value="${esc(q)}"><button class="btn-primary">Search</button></form>
    <section class="admin-section"><h3>Create Badge</h3>
      <div class="badge-creator">
        <input class="badge-name" placeholder="Badge name" maxlength="30">
        <input class="badge-icon" placeholder="🏅" maxlength="4" title="Emoji icon (or upload image)">
        <label class="btn-secondary btn-small" style="cursor:pointer">Upload image<input type="file" class="badge-file" accept="image/*" hidden></label>
        <img class="badge-preview" style="display:none;width:32px;height:32px;border-radius:6px;vertical-align:middle">
        <input type="color" class="badge-color" value="#888888" title="Color">
        <input class="badge-desc" placeholder="Description" maxlength="100">
        <button class="btn-primary badge-create">Create</button>
      </div>
      <div class="custom-badges">${Object.values(BADGE_DEFS).filter(b => b.custom).map(b => `
        <span class="custom-badge-chip">${b.image ? `<img src="${b.image}" style="width:20px;height:20px;border-radius:4px;vertical-align:-4px">` : `<span style="font-size:20px">${b.icon}</span>`} ${esc(b.name)}
        <button class="btn-danger btn-small badge-delete" data-id="${esc(b.id)}" title="Delete badge">×</button></span>`).join('') || '<span class="muted small">No custom badges yet</span>'}
      </div>
    </section>
    ${me.owner ? `<section class="admin-section owner-tools"><h3>👑 Owner Tools <span class="muted small">site-wide</span></h3>
      <div class="owner-grid">
        <span class="admin-inline"><input class="announce-text" placeholder="Broadcast announcement..." maxlength="200" style="min-width:220px"><button class="btn-primary announce-send">📢 Broadcast</button><button class="btn-secondary announce-clear">Clear</button></span>
        <span class="admin-inline"><button class="btn-secondary maint-toggle">🔧 Maintenance: OFF</button></span>
        <span class="admin-inline"><button class="btn-danger kick-all">Kick all players</button></span>
        <span class="admin-inline"><input type="number" class="rain-amt" value="50" min="1" max="1000" title="FunTix per online player"><button class="btn-primary funtix-rain">🌧️ FunTix Rain</button></span>
      </div>
      <div class="site-state muted small"></div>
    </section>` : ''}
    <section class="admin-section"><h3>🎮 Games <span class="muted small">publish, feature & manage</span></h3>
      ${gamesError ? `<p style="color:#ff6b6b">⚠️ Games list unavailable: ${esc(gamesError)} — the rest of the panel still works.</p>` : ''}
      <form class="game-search admin-search"><input name="gq" placeholder="Search games" value="${esc(gq)}"><button class="btn-primary">Search</button></form>
      <div class="lbp">${games.map(g => `
      <div class="lbp-row admin-row-wrap">
        <a class="lbp-name" href="#/play/${encodeURIComponent(g.id)}">${esc(g.name)}</a>
        ${g.featured ? '<span class="feat-tag">⭐ FEATURED</span>' : ''}${g.unpublished ? '<span class="unpub-tag">HIDDEN</span>' : ''}
        <span class="admin-status">by ${esc(g.creator)} &middot; 👁 ${(g.visits ?? 0).toLocaleString()} &middot; 👍 ${g.likes ?? 0} 👎 ${g.dislikes ?? 0}</span>
        <div class="admin-controls">
          <button class="btn-secondary g-pub" data-id="${esc(g.id)}" title="Toggle Discover visibility">${g.unpublished ? 'Publish' : 'Unpublish'}</button>
          <button class="btn-secondary g-feat" data-id="${esc(g.id)}" title="Pin to top of Discover">${g.featured ? 'Unfeature' : '⭐ Feature'}</button>
          <button class="btn-secondary g-rename" data-id="${esc(g.id)}" title="Rename game">Rename</button>
          ${me.owner ? `<button class="btn-secondary g-resetv" data-id="${esc(g.id)}" title="Reset visit count">Reset visits</button>
          <button class="btn-danger g-del" data-id="${esc(g.id)}" title="Permanently delete">Delete</button>` : ''}
        </div>
      </div>`).join('') || '<p class="muted">No games found.</p>'}</div>
    </section>
    <div class="lbp">${users.map(u => `
      <div class="lbp-row admin-row-wrap">
        ${avatarImgTag(u.avatar)}<a class="lbp-name" href="#/users/${encodeURIComponent(u.name)}">${u.club ? CLUB : ''}${esc(u.name)}${u.admin ? ADMIN : ''}</a>
        <span class="role-tag role-${u.role || 'player'}">${esc((u.role || 'player').toUpperCase())}</span>
        <span class="admin-status">${status(u)} &middot; ${tix} ${(u.funtix ?? 0).toLocaleString()}</span>
        <div class="admin-controls">
          ${u.admin ? '' : u.club
            ? `<button class="btn-secondary club-toggle" data-name="${esc(u.name)}" data-on="0">Remove FriendClub</button>`
            : `<button class="btn-primary club-toggle" data-name="${esc(u.name)}" data-on="1">Give FriendClub</button>`}
          <span class="admin-inline">
            <input type="number" class="tix-amt" data-name="${esc(u.name)}" value="100" min="1" max="10000" title="FunTix amount">
            <button class="btn-secondary tix-give" data-name="${esc(u.name)}">Give FunTix</button>
          </span>
          <span class="admin-inline">
            <select class="badge-sel" data-name="${esc(u.name)}">${badgeOpts}</select>
            <button class="btn-secondary badge-grant" data-name="${esc(u.name)}">Grant badge</button>
            <button class="btn-secondary badge-revoke" data-name="${esc(u.name)}">Revoke</button>
          </span>
          <span class="admin-inline">
            <button class="btn-secondary items-give" data-name="${esc(u.name)}" title="Give every marketplace item">Give all items</button>
            <button class="btn-secondary daily-reset" data-name="${esc(u.name)}" title="Reset daily reward">Reset daily</button>
          </span>
          <span class="admin-inline">
            ${u.aiAccess
              ? `<button class="btn-secondary ai-revoke" data-name="${esc(u.name)}" title="Remove AI coder access">Revoke AI</button>`
              : `<button class="btn-primary ai-grant" data-name="${esc(u.name)}" title="Grant AI coder access">Grant AI</button>`}
          </span>
          <span class="admin-inline">
            ${u.admin ? '' : u.banned
              ? `<button class="btn-primary ban-revoke" data-name="${esc(u.name)}" title="Unban this user">Unban</button><span class="banned-tag" title="${esc(u.banReason || 'Banned')}">🚫 BANNED${u.bannedUntil ? ' until ' + new Date(u.bannedUntil).toLocaleDateString() : ''}</span>`
              : `<button class="btn-danger ban-btn" data-name="${esc(u.name)}" title="Ban this user">Ban</button>`}
          </span>
          ${me.owner ? `<span class="admin-inline">
            ${u.owner ? '<span class="muted small">Owner</span>' : u.admin
              ? `<button class="btn-secondary admin-revoke" data-name="${esc(u.name)}" title="Remove admin">Remove Admin</button>`
              : `<button class="btn-danger admin-grant" data-name="${esc(u.name)}" title="Grant full admin powers">Make Admin</button>`}
            ${!u.owner && u.name.toLowerCase() !== 'fun' ? `<button class="btn-primary owner-grant" data-name="${esc(u.name)}" title="Make them an owner (with AI access)">Make Owner</button>` : ''}
            ${u.owner && u.name.toLowerCase() !== 'fun' && !u.envAdmin ? `<button class="btn-secondary owner-revoke" data-name="${esc(u.name)}" title="Remove owner">Remove Owner</button>` : ''}
          </span>` : (u.admin ? '<span class="muted small">Admin</span>' : '')}
        </div>
        ${me.owner ? `<div class="admin-controls owner-controls"><span class="owner-label">👑 Owner</span>
          <span class="admin-inline"><input type="number" class="tix-take-amt" data-name="${esc(u.name)}" value="100" min="1" title="FunTix amount"><button class="btn-secondary tix-take" data-name="${esc(u.name)}" title="Take FunTix">Take FunTix</button></span>
          <button class="btn-secondary mod-toggle" data-name="${esc(u.name)}" data-on="${u.role === 'moderator' ? '0' : '1'}" title="Toggle moderator">${u.role === 'moderator' ? 'Remove Mod' : 'Make Mod'}</button>
          ${u.funpanel ? `<button class="btn-secondary funpanel-toggle" data-name="${esc(u.name)}" data-on="0" title="Take back their FunPanel">Revoke FunPanel</button>` : (u.admin || u.owner || u.role === 'moderator' ? '' : `<button class="btn-primary funpanel-toggle" data-name="${esc(u.name)}" data-on="1" title="Give them the in-game FunPanel">🎁 Gift FunPanel</button>`)}
          <span class="admin-inline"><input class="item-id" data-name="${esc(u.name)}" placeholder="item id" title="Catalog item id"><button class="btn-secondary item-grant" data-name="${esc(u.name)}" title="Give item">Grant Item</button><button class="btn-secondary item-revoke" data-name="${esc(u.name)}" title="Remove item">Remove Item</button></span>
          <button class="btn-secondary inv-view" data-name="${esc(u.name)}" title="See everything they own">View Items</button>
          <button class="btn-secondary club2-toggle" data-name="${esc(u.name)}" data-on="${u.clubForever ? '0' : '1'}" title="Toggle Club">${u.clubForever ? 'Revoke Club' : 'Give Club'}</button>
          <button class="btn-secondary pw-reset" data-name="${esc(u.name)}" title="Temp password">Reset Password</button>
          <button class="btn-secondary rename-btn" data-name="${esc(u.name)}" title="Rename user">Rename</button>
          <button class="btn-secondary avatar-reset" data-name="${esc(u.name)}" title="Reset avatar">Reset Avatar</button>
          <button class="btn-secondary unmute-btn" data-name="${esc(u.name)}" title="Unmute">Unmute</button>
          <button class="btn-secondary sysdm-btn" data-name="${esc(u.name)}" title="System DM">System DM</button>
          <button class="btn-danger wipe-games" data-name="${esc(u.name)}" title="Delete games">Wipe Games</button>
          <button class="btn-secondary clear-friends" data-name="${esc(u.name)}" title="Clear friends">Clear Friends</button>
          <button class="btn-secondary clear-badges" data-name="${esc(u.name)}" title="Clear badges">Clear Badges</button>
        </div>` : ''}
      </div>`).join('') || '<p class="muted">No players found.</p>'}</div>`, () => {
    app.querySelector('form.admin-search:not(.game-search)').onsubmit = e => { e.preventDefault(); adminPage(D, e.target.q.value.trim(), gq); };
    app.querySelector('form.game-search').onsubmit = e => { e.preventDefault(); adminPage(D, q, e.target.gq.value.trim()); };
    const gcmd = async (id, command, extra = {}) => {
      try {
        const r = await api('POST', '/api/admin/games/' + encodeURIComponent(id) + '/command', { command, ...extra });
        toast(r.message || 'Done'); adminPage(D, q, gq);
      } catch (e) { toast(e.message, true); }
    };
    app.querySelectorAll('.g-pub').forEach(b => b.onclick = () => gcmd(b.dataset.id, 'toggle_publish'));
    app.querySelectorAll('.g-feat').forEach(b => b.onclick = () => gcmd(b.dataset.id, b.textContent.includes('Unfeature') ? 'unfeature' : 'feature'));
    app.querySelectorAll('.g-rename').forEach(b => b.onclick = () => {
      const v = prompt('Rename game to:');
      if (v && v.trim()) gcmd(b.dataset.id, 'rename', { name: v.trim() });
    });
    app.querySelectorAll('.g-resetv').forEach(b => b.onclick = () => { if (confirm('Reset visit count to 0?')) gcmd(b.dataset.id, 'reset_visits'); });
    app.querySelectorAll('.g-del').forEach(b => b.onclick = () => { if (confirm('PERMANENTLY delete this game? This cannot be undone.')) gcmd(b.dataset.id, 'delete'); });
    const cmd = async (name, command, extra = {}) => {
      try {
        const r = await api('POST', '/api/admin/users/' + encodeURIComponent(name) + '/command', { command, ...extra });
        toast(r.message || 'Done'); adminPage(D, q, gq);
      } catch (e) { toast(e.message, true); }
    };
    app.querySelectorAll('.club-toggle').forEach(b => b.onclick = async () => {
      const on = b.dataset.on === '1';
      try {
        await api('POST', '/api/admin/club/' + encodeURIComponent(b.dataset.name), { on });
        toast(on ? `Gave FriendClub to ${b.dataset.name}` : `Removed FriendClub from ${b.dataset.name}`); adminPage(D, q, gq);
      } catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('.tix-give').forEach(b => b.onclick = () => {
      const inp = app.querySelector(`.tix-amt[data-name="${CSS.escape(b.dataset.name)}"]`);
      const amount = Math.max(1, Math.min(10000, Math.floor(Number(inp?.value) || 100)));
      cmd(b.dataset.name, 'grant_tix', { amount });
    });
    app.querySelectorAll('.items-give').forEach(b => b.onclick = () => cmd(b.dataset.name, 'give_all_items'));
    app.querySelectorAll('.daily-reset').forEach(b => b.onclick = () => cmd(b.dataset.name, 'reset_daily'));
    let badgeImageData = '';
    const bcFile = app.querySelector('.badge-file');
    const bcPreview = app.querySelector('.badge-preview');
    if (bcFile) bcFile.onchange = () => {
      const f = bcFile.files[0];
      if (!f) return;
      const img = new Image();
      img.onload = () => {
        const max = 128;
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        badgeImageData = c.toDataURL('image/png');
        bcPreview.src = badgeImageData; bcPreview.style.display = '';
        URL.revokeObjectURL(img.src);
      };
      img.src = URL.createObjectURL(f);
    };
    const bcBtn = app.querySelector('.badge-create');
    if (bcBtn) bcBtn.onclick = async () => {
      const name = app.querySelector('.badge-name').value.trim();
      const icon = app.querySelector('.badge-icon').value.trim() || '🏅';
      const color = app.querySelector('.badge-color').value;
      const desc = app.querySelector('.badge-desc').value.trim();
      if (!name) { toast('Enter a badge name', true); return; }
      try {
        await api('POST', '/api/admin/badges', { name, icon, color, desc, image: badgeImageData });
        toast('Badge created'); await loadBadgeDefs(); adminPage(D, q, gq);
      } catch (e) { toast(e.message, true); }
    };
    app.querySelectorAll('.badge-delete').forEach(b => b.onclick = async () => {
      if (!confirm('Delete this badge? It will be removed from all players.')) return;
      try {
        await api('DELETE', '/api/admin/badges/' + encodeURIComponent(b.dataset.id));
        toast('Badge deleted'); await loadBadgeDefs(); adminPage(D, q, gq);
      } catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('.badge-grant').forEach(b => b.onclick = () => {
      const sel = app.querySelector(`.badge-sel[data-name="${CSS.escape(b.dataset.name)}"]`);
      cmd(b.dataset.name, 'grant_badge', { badge: sel?.value });
    });
    app.querySelectorAll('.badge-revoke').forEach(b => b.onclick = () => {
      const sel = app.querySelector(`.badge-sel[data-name="${CSS.escape(b.dataset.name)}"]`);
      cmd(b.dataset.name, 'revoke_badge', { badge: sel?.value });
    });
    app.querySelectorAll('.ai-grant').forEach(b => b.onclick = () => cmd(b.dataset.name, 'grant_ai', {}));
    app.querySelectorAll('.ai-revoke').forEach(b => b.onclick = () => cmd(b.dataset.name, 'revoke_ai', {}));
    app.querySelectorAll('.ban-btn').forEach(b => b.onclick = async () => {
      const reason = prompt(`Ban ${b.dataset.name}? Enter reason:`) || '';
      if (reason === null) return;
      const daysStr = prompt('Ban duration in days (0 = permanent):', '0');
      if (daysStr === null) return;
      const days = Math.max(0, parseInt(daysStr) || 0);
      if (!confirm(`STEP 1 of 2: start a ban of ${b.dataset.name}${days ? ` for ${days} days` : ' permanently'}? A DIFFERENT moderator or admin must confirm on the Moderation page before it takes effect.`)) return;
      try {
        await api('POST', '/api/mod/ban/initiate', { name: b.dataset.name, reason, days });
        toast('First confirmation recorded. A different moderator or admin must confirm in Moderation.');
      } catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('.ban-revoke').forEach(b => b.onclick = () => {
      if (!confirm(`Unban ${b.dataset.name}?`)) return;
      cmd(b.dataset.name, 'unban', {});
    });
    app.querySelectorAll('.admin-grant').forEach(b => b.onclick = () => {
      if (!confirm(`Grant FULL ADMIN to ${b.dataset.name}? They will have complete control.`)) return;
      if (!confirm(`Are you REALLY sure? ${b.dataset.name} will be able to ban, grant admin, and more.`)) return;
      cmd(b.dataset.name, 'grant_admin', {});
    });
    app.querySelectorAll('.admin-revoke').forEach(b => b.onclick = () => {
      if (!confirm(`Remove admin from ${b.dataset.name}?`)) return;
      cmd(b.dataset.name, 'revoke_admin', {});
    });
    app.querySelectorAll('.owner-grant').forEach(b => b.onclick = () => {
      if (!confirm(`Make ${b.dataset.name} an OWNER? They will have complete control including AI access.`)) return;
      if (!confirm(`Are you REALLY sure? Owners can grant admin, manage the site, and use the AI.`)) return;
      cmd(b.dataset.name, 'grant_owner', {});
    });
    app.querySelectorAll('.owner-revoke').forEach(b => b.onclick = () => {
      if (!confirm(`Remove owner from ${b.dataset.name}?`)) return;
      cmd(b.dataset.name, 'revoke_owner', {});
    });
    const ownerCmd = (sel, command, extraFn, confirmMsg) => app.querySelectorAll(sel).forEach(b => b.onclick = () => {
      if (confirmMsg && !confirm(typeof confirmMsg === 'function' ? confirmMsg(b) : confirmMsg)) return;
      const extra = extraFn ? extraFn(b) : {};
      if (extra === null) return;
      cmd(b.dataset.name, command, extra);
    });
    ownerCmd('.tix-take', 'take_tix', b => {
      const inp = app.querySelector(`.tix-take-amt[data-name="${CSS.escape(b.dataset.name)}"]`);
      return { amount: Math.max(1, Math.floor(Number(inp?.value) || 100)) };
    });
    app.querySelectorAll('.mod-toggle').forEach(b => b.onclick = () => {
      const on = b.dataset.on === '1';
      cmd(b.dataset.name, on ? 'grant_moderator' : 'revoke_moderator', {});
    });
    app.querySelectorAll('.funpanel-toggle').forEach(b => b.onclick = () => {
      const on = b.dataset.on === '1';
      if (!on && !confirm(`Revoke FunPanel from ${b.dataset.name}?`)) return;
      cmd(b.dataset.name, on ? 'grant_funpanel' : 'revoke_funpanel', {});
    });
    ownerCmd('.item-grant', 'grant_item', b => {
      const inp = app.querySelector(`.item-id[data-name="${CSS.escape(b.dataset.name)}"]`);
      const item = (inp?.value || '').trim();
      if (!item) { toast('Enter an item id', true); return null; }
      return { item };
    });
    ownerCmd('.item-revoke', 'revoke_item', b => {
      const inp = app.querySelector(`.item-id[data-name="${CSS.escape(b.dataset.name)}"]`);
      const item = (inp?.value || '').trim();
      if (!item) { toast('Enter an item id', true); return null; }
      return { item };
    });
    app.querySelectorAll('.inv-view').forEach(b => b.onclick = async () => {
      try {
        const r = await api('GET', '/api/admin/users/' + encodeURIComponent(b.dataset.name) + '/inventory');
        toast(`${r.name} owns ${r.items.length} items`, false);
        alert(`${r.name}'s inventory (${r.items.length}):\n` + (r.items.map(i => `• ${i.name} (${i.id})`).join('\n') || 'Empty'));
      } catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('.club2-toggle').forEach(b => b.onclick = () => cmd(b.dataset.name, b.dataset.on === '1' ? 'give_club' : 'revoke_club', {}));
    app.querySelectorAll('.pw-reset').forEach(b => b.onclick = async () => {
      if (!confirm(`Reset ${b.dataset.name}'s password?`)) return;
      try { const r = await api('POST', '/api/admin/users/' + encodeURIComponent(b.dataset.name) + '/command', { command: 'reset_password' }); alert(r.message); } catch (e) { toast(e.message, true); }
    });
    app.querySelectorAll('.rename-btn').forEach(b => b.onclick = () => {
      const v = prompt(`Rename ${b.dataset.name} to:`, b.dataset.name);
      if (v && v.trim()) cmd(b.dataset.name, 'rename', { newName: v.trim() });
    });
    ownerCmd('.avatar-reset', 'reset_avatar', null, b => `Reset ${b.dataset.name}'s avatar to default?`);
    ownerCmd('.unmute-btn', 'unmute', null);
    app.querySelectorAll('.sysdm-btn').forEach(b => b.onclick = () => {
      const v = prompt(`System DM to ${b.dataset.name}:`);
      if (v && v.trim()) cmd(b.dataset.name, 'system_dm', { text: v.trim() });
    });
    ownerCmd('.wipe-games', 'wipe_games', null, b => `DELETE ALL games by ${b.dataset.name}? This cannot be undone.`);
    ownerCmd('.clear-friends', 'clear_friends', null, b => `Clear all friends of ${b.dataset.name}?`);
    ownerCmd('.clear-badges', 'clear_badges', null, b => `Clear all badges of ${b.dataset.name}?`);
    const siteCmd = async (command, extra = {}) => {
      try { const r = await api('POST', '/api/admin/site/command', { command, ...extra }); toast(r.message || 'Done'); refreshSiteState(); }
      catch (e) { toast(e.message, true); }
    };
    const refreshSiteState = async () => {
      const el = app.querySelector('.site-state'); if (!el) return;
      try {
        const s = await api('GET', '/api/site');
        el.textContent = `Announcement: ${s.announce ? `"${s.announce.text}" (by ${s.announce.by})` : 'none'} · Maintenance: ${s.maintenance ? 'ON' : 'OFF'}`;
        const mt = app.querySelector('.maint-toggle'); if (mt) mt.textContent = `🔧 Maintenance: ${s.maintenance ? 'ON' : 'OFF'}`;
      } catch {}
    };
    refreshSiteState();
    const announceBtn = app.querySelector('.announce-send');
    if (announceBtn) announceBtn.onclick = () => {
      const v = app.querySelector('.announce-text')?.value.trim();
      if (!v) { toast('Type an announcement first', true); return; }
      siteCmd('announce', { text: v });
    };
    const announceClear = app.querySelector('.announce-clear');
    if (announceClear) announceClear.onclick = () => siteCmd('clear_announce');
    const maintBtn = app.querySelector('.maint-toggle');
    if (maintBtn) maintBtn.onclick = async () => {
      try {
        const s = await api('GET', '/api/site');
        if (s.maintenance || confirm('Turn ON maintenance mode? Only owners will be able to log in.')) siteCmd('maintenance', { on: !s.maintenance });
      } catch (e) { toast(e.message, true); }
    };
    const kickAll = app.querySelector('.kick-all');
    if (kickAll) kickAll.onclick = () => { if (confirm('Kick EVERYONE out of all games right now?')) siteCmd('kick_all'); };
    const rainBtn = app.querySelector('.funtix-rain');
    if (rainBtn) rainBtn.onclick = () => {
      const amount = Math.max(1, Math.min(1000, Math.floor(Number(app.querySelector('.rain-amt')?.value) || 50)));
      siteCmd('funtix_rain', { amount });
    };
  });
}
