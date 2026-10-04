export const CATALOG = [
  { id: 'hat_none', type: 'hat', name: 'No Hat', price: 0, free: true },
  { id: 'hat_cap', type: 'hat', name: 'Red Cap', price: 0, free: true, color: '#e53935' },
  { id: 'hat_clubhat', type: 'hat', name: 'FriendClub Hard Hat', price: 0, club: true, color: '#ffd400' },
  { id: 'hat_clubcrown', type: 'hat', name: 'FriendClub Crown', price: 0, club: true, color: '#fff2a8' },
  { id: 'hat_tophat', type: 'hat', name: 'Fancy Top Hat', price: 150, color: '#212121' },
  { id: 'hat_crown', type: 'hat', name: 'Golden Crown', price: 750, color: '#ffd400' },
  { id: 'hat_horns', type: 'hat', name: 'Devil Horns', price: 350, color: '#c62828' },
  { id: 'hat_halo', type: 'hat', name: 'Angel Halo', price: 400, color: '#fff59d' },
  { id: 'hat_headphones', type: 'hat', name: 'Beat Headphones', price: 220, color: '#7c4dff' },
  { id: 'hat_cone', type: 'hat', name: 'Traffic Cone', price: 60, color: '#ff6d00' },
  { id: 'hat_beanie', type: 'hat', name: 'Cozy Beanie', price: 80, color: '#00897b' },
  { id: 'face_smile', type: 'face', name: 'Classic Smile', price: 0, free: true },
  { id: 'face_grin', type: 'face', name: 'Big Grin', price: 50 },
  { id: 'face_cool', type: 'face', name: 'Cool Shades', price: 200 },
  { id: 'face_wink', type: 'face', name: 'Winky', price: 70 },
  { id: 'face_shock', type: 'face', name: 'Shocked', price: 40 },
  { id: 'face_mad', type: 'face', name: 'Grumpy', price: 40 },
  { id: 'face_star', type: 'face', name: 'Star Eyes', price: 180 },
  { id: 'shirt_none', type: 'shirt', name: 'Plain', price: 0, free: true },
  { id: 'shirt_star', type: 'shirt', name: 'Star Tee', price: 30, color: '#ffeb3b' },
  { id: 'shirt_heart', type: 'shirt', name: 'Heart Tee', price: 30, color: '#ff4081' },
  { id: 'shirt_ff', type: 'shirt', name: 'FriendFun Logo Tee', price: 0, free: true, color: '#ffffff' },
  { id: 'shirt_stripes', type: 'shirt', name: 'Striped Sweater', price: 120, color: '#ffffff' },
  { id: 'head_classic', type: 'head', name: 'Classic Head', price: 0, free: true },
  { id: 'head_block', type: 'head', name: 'Block Head', price: 0, free: true },
  { id: 'head_round', type: 'head', name: 'Round Head', price: 40 },
  { id: 'head_tall', type: 'head', name: 'Tall Head', price: 60 },
  { id: 'head_wide', type: 'head', name: 'Wide Head', price: 60 },
  { id: 'shirt_suit', type: 'shirt', name: 'Business Suit', price: 300, color: '#263238' },
  { id: 'shirt_club', type: 'shirt', name: 'FriendClub Jacket', price: 0, club: true, color: '#ffd400' },
];
export const ECON = { START_TIX: 100, DAILY_TIX: 25, PLAY_TIX: 2, PLAY_TIX_EVERY: 60000, COIN_TIX: 1, WIN_TIX: 25,
  CLUB_PRICE: 300, CLUB_DAYS: 30, CLUB_DAILY: 25, CLUB_COIN_BONUS: 1, CLUB_PLAY_MULT: 2 };
export const ITEM = Object.fromEntries(CATALOG.map(i => [i.id, i]));
export const DEFAULT_AVATAR = {
  colors: { head: '#f5cd30', torso: '#0d69ac', larm: '#f5cd30', rarm: '#f5cd30', lleg: '#a4bd47', rleg: '#a4bd47' },
  hat: 'hat_none', face: 'face_smile', shirt: 'shirt_none', head: 'head_classic',
};

export const BADGES = {
  admin: { name: 'Admin', desc: 'Helps run FriendFun.', color: '#e2231a', path: 'M12 2l8 3v6c0 5-3.4 9.4-8 11-4.6-1.6-8-6-8-11V5z' },
  club: { name: 'FriendClub', desc: 'A FriendClub member.', color: '#ffd400', path: 'M2 17h20v3H2zM4 16a8 8 0 0 1 16 0zM10.5 7h3v5h-3z' },
  creator: { name: 'Creator', desc: 'Published a game.', color: '#00b06f', path: 'M3 17.25V21h3.75L17.8 9.94l-3.75-3.75zM20.7 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75z' },
  champ: { name: 'Obby Champ', desc: 'Beat an obby.', color: '#4aa3ff', path: 'M7 3h10v2h3v3a4 4 0 0 1-4 4h-.3A5 5 0 0 1 13 14.9V18h3v3H8v-3h3v-3.1A5 5 0 0 1 8.3 12H8a4 4 0 0 1-4-4V5h3zM6 7v1a2 2 0 0 0 2 2V7zm10 0v3a2 2 0 0 0 2-2V7z' },
};
