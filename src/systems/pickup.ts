import type { Game } from '../game';

const MAGNET_ACCEL = 34;
const COLLECT_RADIUS = 0.55;

/** Dried-fish XP pickups: drift, then home in once inside the magnet radius. */
export function updateGems(game: Game, dt: number): void {
  const g = game.gems;
  const px = game.player.x;
  const pz = game.player.z;
  const magnet = game.player.pickupRadius;

  for (let i = 0; i < g.count; i++) {
    const dx = px - g.x[i];
    const dz = pz - g.z[i];
    const d2 = dx * dx + dz * dz;

    if (!g.homing[i] && d2 < magnet * magnet) g.homing[i] = 1;

    if (g.homing[i]) {
      const d = Math.sqrt(d2) || 1e-4;
      g.vx[i] += (dx / d) * MAGNET_ACCEL * dt;
      g.vz[i] += (dz / d) * MAGNET_ACCEL * dt;
    } else {
      // Idle scatter settles quickly so gems do not slide off screen.
      g.vx[i] *= Math.max(0, 1 - 6 * dt);
      g.vz[i] *= Math.max(0, 1 - 6 * dt);
    }

    g.x[i] += g.vx[i] * dt;
    g.z[i] += g.vz[i] * dt;
    g.bob[i] += dt * 6;

    if (d2 < COLLECT_RADIUS * COLLECT_RADIUS) {
      game.addXp(g.value[i]);
      game.emit('pickup', g.x[i], g.z[i]);
      g.remove(i);
      i--;
    }
  }
}
