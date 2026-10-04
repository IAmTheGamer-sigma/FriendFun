export const CATALOG = [
  { id: 'hat_none', type: 'hat', name: 'No Hat', price: 0, free: true },
  { id: 'hat_cap', type: 'hat', name: 'Red Cap', price: 0, free: true, color: '#e53935' },
  { id: 'hat_tophat', type: 'hat', name: 'Fancy Top Hat', price: 50, color: '#212121' },
  { id: 'hat_crown', type: 'hat', name: 'Golden Crown', price: 250, color: '#ffd400' },
  { id: 'hat_horns', type: 'hat', name: 'Devil Horns', price: 120, color: '#c62828' },
  { id: 'hat_halo', type: 'hat', name: 'Angel Halo', price: 150, color: '#fff59d' },
  { id: 'hat_headphones', type: 'hat', name: 'Beat Headphones', price: 80, color: '#7c4dff' },
  { id: 'hat_cone', type: 'hat', name: 'Traffic Cone', price: 30, color: '#ff6d00' },
  { id: 'hat_beanie', type: 'hat', name: 'Cozy Beanie', price: 40, color: '#00897b' },
  { id: 'face_smile', type: 'face', name: 'Classic Smile', price: 0, free: true },
  { id: 'face_grin', type: 'face', name: 'Big Grin', price: 25 },
  { id: 'face_cool', type: 'face', name: 'Cool Shades', price: 75 },
  { id: 'face_wink', type: 'face', name: 'Winky', price: 35 },
  { id: 'face_shock', type: 'face', name: 'Shocked', price: 20 },
  { id: 'face_mad', type: 'face', name: 'Grumpy', price: 20 },
  { id: 'shirt_none', type: 'shirt', name: 'Plain', price: 0, free: true },
  { id: 'shirt_star', type: 'shirt', name: 'Star Tee', price: 15, color: '#ffeb3b' },
  { id: 'shirt_heart', type: 'shirt', name: 'Heart Tee', price: 15, color: '#ff4081' },
  { id: 'shirt_ff', type: 'shirt', name: 'FriendFun Logo Tee', price: 0, free: true, color: '#ffffff' },
  { id: 'shirt_stripes', type: 'shirt', name: 'Striped Sweater', price: 45, color: '#ffffff' },
  { id: 'shirt_suit', type: 'shirt', name: 'Business Suit', price: 100, color: '#263238' },
];
export const ITEM = Object.fromEntries(CATALOG.map(i => [i.id, i]));
export const DEFAULT_AVATAR = {
  colors: { head: '#f5cd30', torso: '#0d69ac', larm: '#f5cd30', rarm: '#f5cd30', lleg: '#a4bd47', rleg: '#a4bd47' },
  hat: 'hat_none', face: 'face_smile', shirt: 'shirt_none',
};
