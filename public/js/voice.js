// 🎤 Proximity voice chat (WebRTC P2P + WS signaling).
export class VoiceChat {
  constructor(game) {
    this.game = game;
    this.peers = new Map(); // name -> { pc, audio, gain }
    this.localStream = null;
    this.enabled = false;
    this.muted = false;
  }
  async toggle() {
    if (this.enabled) { this.leave(); return false; }
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
      this.enabled = true;
      this.muted = false;
      this.game.send({ t: 'voice_join' });
      this.game.sys('🎤 Voice chat on — nearby players can hear you');
      return true;
    } catch (e) {
      this.game.sys('🎤 Microphone blocked — allow mic access to use voice chat', true);
      return false;
    }
  }
  leave() {
    this.enabled = false;
    if (this.localStream) { this.localStream.getTracks().forEach(t => t.stop()); this.localStream = null; }
    for (const [, p] of this.peers) { try { p.pc.close(); } catch {} if (p.audio) p.audio.remove(); }
    this.peers.clear();
    try { this.game.send({ t: 'voice_leave' }); } catch {}
    this.game.sys('🎤 Voice chat off');
  }
  toggleMute() {
    this.muted = !this.muted;
    if (this.localStream) this.localStream.getAudioTracks().forEach(t => t.enabled = !this.muted);
    return this.muted;
  }
  async onPeer(m) {
    if (!this.enabled) return;
    const name = m.peer;
    if (m.action === 'leave') {
      const p = this.peers.get(name);
      if (p) { try { p.pc.close(); } catch {} if (p.audio) p.audio.remove(); this.peers.delete(name); }
      return;
    }
    if (this.peers.has(name)) return;
    // Create peer connection (we initiate if our name < peer name to avoid glare)
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
    const audio = document.createElement('audio');
    audio.autoplay = true; audio.playsInline = true;
    const gain = new (window.AudioContext || window.webkitAudioContext)().createGain();
    // Note: connecting via MediaStreamAudioDestinationNode would be cleaner, but
    // direct audio element + gain via setSinkId isn't universal. Use volume on element.
    document.body.appendChild(audio);
    const peer = { pc, audio, name };
    this.peers.set(name, peer);
    if (this.localStream) for (const track of this.localStream.getTracks()) pc.addTrack(track, this.localStream);
    pc.ontrack = e => { audio.srcObject = e.streams[0]; };
    pc.onicecandidate = e => {
      if (e.candidate) this.game.send({ t: 'voice_signal', to: name, data: { ice: e.candidate } });
    };
    // Glare avoidance: higher name initiates
    if (this.game.me.name < name) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.game.send({ t: 'voice_signal', to: name, data: { offer } });
    }
  }
  async onSignal(m) {
    if (!this.enabled) return;
    let peer = this.peers.get(m.from);
    if (!peer) {
      // Incoming offer from unknown peer — create connection
      await this.onPeer({ peer: m.from, action: 'join' });
      peer = this.peers.get(m.from);
      if (!peer) return;
    }
    const pc = peer.pc;
    try {
      if (m.data.offer) {
        await pc.setRemoteDescription(new RTCSessionDescription(m.data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.game.send({ t: 'voice_signal', to: m.from, data: { answer } });
      } else if (m.data.answer) {
        await pc.setRemoteDescription(new RTCSessionDescription(m.data.answer));
      } else if (m.data.ice) {
        await pc.addIceCandidate(new RTCIceCandidate(m.data.ice));
      }
    } catch {}
  }
  // Proximity: update volumes based on distance (call every ~500ms)
  updateVolumes() {
    if (!this.enabled) return;
    const VOICE_RANGE = 30;
    for (const [name, peer] of this.peers) {
      let vol = 0;
      for (const p of this.game.players.values()) {
        if (p.name === name && p.char) {
          const cp = p.char.position;
          const d = Math.hypot(cp.x - this.game.pos.x, cp.y - this.game.pos.y, cp.z - this.game.pos.z);
          vol = d >= VOICE_RANGE ? 0 : 1 - (d / VOICE_RANGE);
          break;
        }
      }
      peer.audio.volume = Math.max(0, Math.min(1, vol * 1.5));
      peer.audio.muted = vol <= 0.01;
    }
  }
}
