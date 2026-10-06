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

// ---- Spooky Halloween menu music (procedural Web Audio, no files needed) ----
let spookyTimer = null;
let spookyNodes = [];
const midiHz = m => 440 * Math.pow(2, (m - 69) / 12);
// Creepy music-box waltz in D minor: [midi note, beats]
const SPOOKY_MELODY = [
  [74,1],[76,1],[77,1],[76,1],[74,1],[72,1],[74,2],[69,1],
  [74,1],[76,1],[77,1],[81,1],[79,1],[77,1],[76,2],[74,1],
  [76,1],[77,1],[76,1],[74,1],[72,1],[71,1],[72,2],[69,1],
  [62,2],[69,1],[68,1],[69,2],[62,2], // low dissonant turn
];
function spookyNote(midi, t, dur, vol) {
  const a = ac();
  const o = a.createOscillator(), g = a.createGain();
  o.type = 'triangle'; o.frequency.value = midiHz(midi);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.05);
  spookyNodes.push(o);
  // detuned shimmer an octave up for eeriness
  const o2 = a.createOscillator(), g2 = a.createGain();
  o2.type = 'sine'; o2.frequency.value = midiHz(midi) * 2.01;
  g2.gain.setValueAtTime(vol * 0.22, t);
  g2.gain.exponentialRampToValueAtTime(0.0001, t + dur * 0.7);
  o2.connect(g2); g2.connect(a.destination);
  o2.start(t); o2.stop(t + dur + 0.05);
  spookyNodes.push(o2);
}
export function startSpooky() {
  if (spookyTimer) return;
  const a = ac();
  const beat = 0.55;
  let step = 0, nextT = a.currentTime + 0.15;
  // low D/A drone
  const droneG = a.createGain(); droneG.gain.value = 0.03; droneG.connect(a.destination);
  for (const m of [38, 45]) {
    const o = a.createOscillator(); o.type = 'sine'; o.frequency.value = midiHz(m);
    o.connect(droneG); o.start(); spookyNodes.push(o);
  }
  spookyNodes.push(droneG);
  // wind noise with slow swell
  const buf = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < ch.length; i++) ch[i] = Math.random() * 2 - 1;
  const noise = a.createBufferSource(); noise.buffer = buf; noise.loop = true;
  const filt = a.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 380;
  const ng = a.createGain(); ng.gain.value = 0.012;
  const lfo = a.createOscillator(); lfo.frequency.value = 0.07;
  const lfoG = a.createGain(); lfoG.gain.value = 0.008;
  lfo.connect(lfoG); lfoG.connect(ng.gain); lfo.start();
  noise.connect(filt); filt.connect(ng); ng.connect(a.destination); noise.start();
  spookyNodes.push(noise, filt, ng, lfo, lfoG);
  spookyTimer = setInterval(() => {
    if (!sfx.enabled) return;
    while (nextT < a.currentTime + 1.2) {
      const [midi, beats] = SPOOKY_MELODY[step % SPOOKY_MELODY.length];
      spookyNote(midi, nextT, beat * beats * 2.4, 0.055);
      if (step % 7 === 3) spookyNote(midi - 24, nextT, beat * 3, 0.035);
      nextT += beat * beats;
      step++;
    }
  }, 250);
}
export function stopSpooky() {
  if (spookyTimer) { clearInterval(spookyTimer); spookyTimer = null; }
  for (const n of spookyNodes) { try { n.stop ? n.stop() : n.disconnect(); } catch (e) {} }
  spookyNodes = [];
}
