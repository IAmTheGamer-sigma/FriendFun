// 📡 News studio: 3D newsboy anchor + studio set.
export const NEWSBOY_AVATAR = {
  colors: { head: '#f1c27d', torso: '#ffffff', larm: '#f1c27d', rarm: '#f1c27d', lleg: '#1a1a2e', rleg: '#1a1a2e' },
  hat: 'hat_tophat', face: 'face_smile', shirt: 'shirt_suit', head: 'head_classic', pet: 'pet_none', gear: 'gear_none',
};

export function buildNewsStudio(THREE) {
  const g = new THREE.Group();
  const mat = (c, e = 0, ei = 0) => new THREE.MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: ei, roughness: 0.6 });
  // Floor
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mat('#0d0d1a'));
  floor.rotation.x = -Math.PI / 2; floor.position.y = 0; g.add(floor);
  // Backdrop wall (curved illusion via segments)
  for (let i = -3; i <= 3; i++) {
    const panel = new THREE.Mesh(new THREE.BoxGeometry(4.4, 10, 0.4), mat(i % 2 ? '#1a1a4e' : '#23235e'));
    panel.position.set(i * 4.5, 5, -8 - Math.abs(i) * 0.7);
    panel.rotation.y = -i * 0.12;
    g.add(panel);
    // Glowing strip on each panel
    const strip = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 0.1), mat('#000000', '#7c6cf5', 2));
    strip.position.set(i * 4.5, 8.5, -7.7 - Math.abs(i) * 0.7);
    strip.rotation.y = -i * 0.12;
    g.add(strip);
  }
  // Center screen (behind anchor)
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(10, 5.5), mat('#000000', '#0a2a6e', 1.2));
  screen.position.set(0, 5.5, -7.5); g.add(screen);
  const screenFrame = new THREE.Mesh(new THREE.BoxGeometry(10.6, 6.1, 0.3), mat('#111'));
  screenFrame.position.set(0, 5.5, -7.7); g.add(screenFrame);
  // LIVE bug (top right of screen)
  const live = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.9), mat('#000000', '#ff1744', 2.5));
  live.position.set(3.8, 7.4, -7.4); g.add(live);
  // Desk
  const deskTop = new THREE.Mesh(new THREE.BoxGeometry(9, 0.5, 3), mat('#1e1e3a'));
  deskTop.position.set(0, 2.2, 2.5); g.add(deskTop);
  const deskFront = new THREE.Mesh(new THREE.BoxGeometry(9, 2.2, 0.4), mat('#2a2a5e', '#7c6cf5', 0.4));
  deskFront.position.set(0, 1.1, 3.9); g.add(deskFront);
  // Desk logo strip
  const logoStrip = new THREE.Mesh(new THREE.BoxGeometry(7, 0.6, 0.1), mat('#000000', '#e056fd', 1.8));
  logoStrip.position.set(0, 1.4, 4.15); g.add(logoStrip);
  // Side monitors
  const monitors = [];
  for (const sx of [-1, 1]) {
    const mon = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 2), mat('#000000', '#0a4a8e', 1.5));
    mon.position.set(sx * 8.5, 4.5, -4); mon.rotation.y = -sx * 0.5;
    g.add(mon); monitors.push(mon);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4.5, 0.3), mat('#111'));
    stand.position.set(sx * 8.5, 2.2, -4.2); g.add(stand);
  }
  // Studio lights (visible glow spheres)
  for (const sx of [-1, 1]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), mat('#ffffff', '#ffffff', 3));
    lamp.position.set(sx * 6, 9, 2); g.add(lamp);
  }
  // Animated elements
  let t = 0;
  return {
    group: g,
    update(dt) {
      t += dt;
      // Pulse the LIVE bug and screens
      live.material.emissiveIntensity = 2 + Math.sin(t * 4) * 0.8;
      monitors.forEach((m, i) => { m.material.emissiveIntensity = 1.2 + Math.sin(t * 2 + i * 2) * 0.4; });
      logoStrip.material.emissiveIntensity = 1.5 + Math.sin(t * 3) * 0.5;
    }
  };
}
