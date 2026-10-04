let ctx = null;
function ac() { if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)(); if (ctx.state === 'suspended') ctx.resume(); return ctx; }
function tone(freq, dur, type = 'sine', vol = 0.15, slideTo = null, delay = 0) {
  const a = ac(), t = a.currentTime + delay;
  const o = a.createOscillator(), g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}
export const sfx = {
  enabled: true,
  oof() { if (this.enabled) { tone(420, 0.28, 'square', 0.12, 140); tone(300, 0.25, 'sawtooth', 0.05, 110); } },
  coin() { if (this.enabled) { tone(988, 0.08, 'square', 0.07); tone(1319, 0.25, 'square', 0.07, null, 0.08); } },
  jump() { if (this.enabled) tone(300, 0.12, 'sine', 0.05, 600); },
  checkpoint() { if (this.enabled) [523, 659, 784].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, null, i * 0.09)); },
  win() { if (this.enabled) [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.25, 'triangle', 0.12, null, i * 0.12)); },
  bounce() { if (this.enabled) tone(200, 0.3, 'sine', 0.12, 900); },
  click() { if (this.enabled) tone(700, 0.05, 'square', 0.04); },
  chat() { if (this.enabled) tone(880, 0.06, 'sine', 0.04); },
};
