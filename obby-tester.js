// 🤖 Obby Test Bot — verifies obstacle courses are completable.
// Analyzes checkpoint-to-checkpoint jumps for impossibility.
export function validateObby(world) {
  const parts = world.parts || [];
  const checkpoints = parts
    .filter(p => p.k === 'checkpoint')
    .sort((a, b) => {
      const na = parseInt((a.name || '').replace('Checkpoint', '')) || 0;
      const nb = parseInt((b.name || '').replace('Checkpoint', '')) || 0;
      return na - nb;
    });
  const spawn = parts.find(p => p.k === 'spawn');
  const issues = [];

  if (!spawn) issues.push('No spawn point found');
  if (checkpoints.length === 0) issues.push('No checkpoints found');

  // Check jumps between consecutive points
  const points = [];
  if (spawn) points.push({ name: 'Spawn', p: spawn.p });
  for (const c of checkpoints) points.push({ name: c.name, p: c.p });

  const MAX_JUMP_DIST = 12; // max horizontal distance for a jump
  const MAX_JUMP_UP = 4;    // max vertical up for a jump

  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i], b = points[i + 1];
    const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1], dz = b.p[2] - a.p[2];
    const hDist = Math.hypot(dx, dz);
    if (hDist > MAX_JUMP_DIST) {
      issues.push(`${a.name} → ${b.name}: gap too wide (${hDist.toFixed(1)}m, max ${MAX_JUMP_DIST}m)`);
    }
    if (dy > MAX_JUMP_UP) {
      issues.push(`${a.name} → ${b.name}: too high (${dy.toFixed(1)}m up, max ${MAX_JUMP_UP}m)`);
    }
  }

  // Check for kill parts overlapping checkpoints
  for (const c of checkpoints) {
    for (const p of parts) {
      if (p.k === 'kill') {
        const d = Math.hypot(c.p[0] - p.p[0], c.p[1] - p.p[1], c.p[2] - p.p[2]);
        if (d < 3) issues.push(`${c.name} is too close to a kill brick`);
      }
    }
  }

  return {
    ok: issues.length === 0,
    checkpoints: checkpoints.length,
    issues
  };
}
