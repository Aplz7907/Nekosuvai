import { HIT_LANES, PROJECTILE_LANE } from '../ecs/entities';
import type { Game } from '../game';

const HITS = new Int32Array(256);
/** Pull that curves a boomerang back to the cat, in units per second squared. */
const RETURN_ACCEL = 26;

export function updateProjectiles(game: Game, dt: number): void {
  const p = game.projectiles;
  const e = game.enemies;

  for (let i = 0; i < p.count; i++) {
    p.age[i] += dt;

    if (p.mode[i] === 1) {
      // Boomerang: constant pull toward the cat bends the flight into a loop
      // and brings the fish home instead of expiring in the distance.
      const dx = game.player.x - p.x[i];
      const dz = game.player.z - p.z[i];
      const d = Math.hypot(dx, dz) || 1e-4;
      p.vx[i] += (dx / d) * RETURN_ACCEL * dt;
      p.vz[i] += (dz / d) * RETURN_ACCEL * dt;
      if (p.age[i] > 0.5 && d < 0.7) {
        p.remove(i);
        i--;
        continue;
      }
    }

    p.x[i] += p.vx[i] * dt;
    p.z[i] += p.vz[i] * dt;
    p.spin[i] += dt * 14;
    p.life[i] -= dt;

    if (p.life[i] <= 0) {
      p.remove(i);
      i--;
      continue;
    }

    const n = game.grid.query(p.x[i], p.z[i], p.radius[i] + 1, HITS);
    let dead = false;
    for (let q = 0; q < n; q++) {
      const j = HITS[q];
      if (j >= e.count) continue;
      const dx = e.x[j] - p.x[i];
      const dz = e.z[j] - p.z[i];
      const reach = p.radius[i] + e.radius[j];
      if (dx * dx + dz * dz > reach * reach) continue;
      // Shared projectile lane stops a pierce shot from tickling the same
      // enemy on consecutive frames.
      const cdIdx = j * HIT_LANES + PROJECTILE_LANE;
      if (e.hitCd[cdIdx] > 0) continue;
      e.hitCd[cdIdx] = 0.15;

      const before = e.count;
      game.hitEnemy(j, p.damage[i], 3, p.x[i], p.z[i]);
      if (e.count < before) q--;

      // A boomerang keeps flying no matter how many it clips.
      if (p.mode[i] !== 1 && --p.pierce[i] < 0) {
        dead = true;
        break;
      }
    }

    if (dead) {
      game.effects.push({ kind: 'spark', x: p.x[i], z: p.z[i], t: 0, dur: 0.16 });
      p.remove(i);
      i--;
    }
  }
}
