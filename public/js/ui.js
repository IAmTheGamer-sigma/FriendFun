import { BADGES } from './catalog.js';
const CLUB_PATH = 'M2 17h20v3H2zM4 16a8 8 0 0 1 16 0zM10.5 7h3v5h-3z';

export function nameColor(name) {
  const cols = ['#fd2943', '#01a2ff', '#02b857', '#a75eb8', '#f58225', '#f5cd30', '#e8bac8', '#d7c59a'];
  let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return cols[h % cols.length];
}
function confetti(root) {
  const box = document.createElement('div'); box.className = 'confetti';
  for (let i = 0; i < 120; i++) { const s = document.createElement('i'); s.style.left = Math.random() * 100 + '%'; s.style.background = `hsl(${Math.random() * 360},90%,60%)`; s.style.animationDelay = Math.random() * 1.5 + 's'; s.style.animationDuration = 2 + Math.random() * 2 + 's'; box.appendChild(s); }
  root.querySelector('.game-root').appendChild(box); setTimeout(() => box.remove(), 5000);
}
const chatIcon = '<svg viewBox="0 0 24 24" width="22" height="22" fill="#fff"><path d="M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/></svg>';

export const LOGO = '<svg class="ff-logo" viewBox="0 0 40 32" xmlns="http://www.w3.org/2000/svg"><g transform="rotate(-10 12 15)"><rect x="3" y="6" width="18" height="18" rx="4" fill="#fff"/><circle cx="9" cy="13" r="1.7" fill="#1b1d1f"/><circle cx="15" cy="13" r="1.7" fill="#1b1d1f"/><path d="M8 17.5q4 4 8 0" fill="none" stroke="#1b1d1f" stroke-width="1.8" stroke-linecap="round"/></g><g transform="rotate(10 28 17)"><rect x="19" y="8" width="18" height="18" rx="4" fill="#ffd400" stroke="#1b1d1f" stroke-width="1.5"/><circle cx="25" cy="15" r="1.7" fill="#1b1d1f"/><circle cx="31" cy="15" r="1.7" fill="#1b1d1f"/><path d="M24 19.5q4 4 8 0" fill="none" stroke="#1b1d1f" stroke-width="1.8" stroke-linecap="round"/></g></svg>';

export const CLUB = `<svg class="club-badge" viewBox="0 0 24 24" width="18" height="18"><title>FriendClub member</title><path fill="#ffd400" d="${CLUB_PATH}"/></svg>`;

export const tix = '<svg class="tix" viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="11" fill="currentColor"/><circle cx="12" cy="12" r="8" fill="none" stroke="#1b1d1f" stroke-width="1.4" opacity=".35"/><path fill="#1b1d1f" d="M7.5 7h9v2.6h-3.2V18h-2.6V9.6H7.5z"/></svg>';

export const badgeIcon = (id, size = 18) => { const b = BADGES[id]; return b ? `<svg class="club-badge" viewBox="0 0 24 24" width="${size}" height="${size}"><title>${b.name}</title><path fill="${b.color}" d="${b.path}"/></svg>` : ''; };
