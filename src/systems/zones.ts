import type { Game } from '../game';

/** How often a zone applies its damage, in seconds. */
const TICK = 0.35;

/**
 * Ground hazards: ember trails the cat leaves behind, poison the snakes drip.
 * Damage is applied in ticks rather than per frame so it is framerate independent.
 */
export function updateZones(game: Game, dt: number): void {
  const z = game.zones;

  for (let i = 0; i < z.count; i++) {
    z.life[i] -= dt;
    if (z.life[i] <= 0) {
      z.remove(i);
      i--;
      continue;
    }

    z.tick[i] -= dt;
    if (z.tick[i] > 0) continue;
    z.tick[i] = TICK;

    const damage = z.dps[i] * TICK;
    if (z.hostile[i]) {
      const dx = game.player.x - z.x[i];
      const dz = game.player.z - z.z[i];
      const r = z.radius[i] + game.player.radius;
      if (dx * dx + dz * dz <= r * r) game.damagePlayer(damage);
    } else {
      game.circleAttack(z.x[i], z.z[i], z.radius[i], damage, z.lane[i], TICK * 0.9, 0);
    }
  }
}
