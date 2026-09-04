import type { Game } from '../game';
import { updateBossPhase } from './bossAi';

const NEIGHBOURS = new Int32Array(64);

/** Separation keeps the horde from collapsing into one point on top of the player. */
const SEPARATION_FORCE = 9;
/** Contact knockback and leap momentum decay at this rate per second. */
const DRAG = 6;

/** Numeric encoding of EnemyBehavior, kept in sync with Game.spawnEnemy. */
export const BEHAVIOR = {
  seek: 0,
  strafe: 1,
  charge: 2,
  hop: 3,
  trail: 4,
  summon: 5,
} as const;

/**
 * Steering-only AI: seek the player plus local separation, with a small state
 * machine per archetype. The map is open, so no pathfinding is needed and every
 * enemy costs a handful of flops.
 */
export function updateEnemies(game: Game, dt: number): void {
  const e = game.enemies;
  const px = game.player.x;
  const pz = game.player.z;

  for (let i = 0; i < e.count; i++) {
    const dx = px - e.x[i];
    const dz = pz - e.z[i];
    const dist = Math.hypot(dx, dz) || 1e-4;
    const nx = dx / dist;
    const nz = dz / dist;

    let desiredX = nx;
    let desiredZ = nz;
    let speed = e.speed[i];
    // Bosses layer phase attacks on top of whatever archetype they use.
    const bossMul = e.isBoss[i] ? updateBossPhase(game, i, dt) : 1;

    switch (e.behavior[i]) {
      case BEHAVIOR.strafe: {
        // Crow / bee: circles at a stand-off distance, then dives in bursts.
        e.timer[i] -= dt;
        if (e.timer[i] <= 0) {
          e.state[i] = e.state[i] === 0 ? 1 : 0;
          e.timer[i] = e.state[i] === 1 ? 1.1 : 2.2;
        }
        if (e.state[i] === 0 && dist < 6) {
          desiredX = -nz;
          desiredZ = nx;
          speed *= 0.9;
        } else {
          speed *= 1.5;
        }
        break;
      }

      case BEHAVIOR.charge: {
        // Tanuki / boar: telegraph, then charge in a straight line.
        e.timer[i] -= dt;
        if (e.state[i] === 0 && dist < 9 && e.timer[i] <= 0) {
          e.state[i] = 1;
          e.timer[i] = 0.7;
          e.vx[i] = 0;
          e.vz[i] = 0;
        } else if (e.state[i] === 1 && e.timer[i] <= 0) {
          e.state[i] = 2;
          e.timer[i] = 0.85;
          // Direction locks at launch, so a sidestep beats the charge.
          e.vx[i] = nx * e.speed[i] * 6;
          e.vz[i] = nz * e.speed[i] * 6;
        } else if (e.state[i] === 2 && e.timer[i] <= 0) {
          e.state[i] = 0;
          e.timer[i] = 1.6;
        }
        if (e.state[i] === 1) speed = 0;
        if (e.state[i] === 2) {
          desiredX = 0;
          desiredZ = 0;
          speed = 0;
        }
        break;
      }

      case BEHAVIOR.hop: {
        // Frog: crouch, then leap. Covers ground in bursts and is easy to bait.
        e.timer[i] -= dt;
        if (e.state[i] === 0 && e.timer[i] <= 0) {
          e.state[i] = 1;
          e.timer[i] = 0.5;
          e.vx[i] = nx * e.speed[i] * 5;
          e.vz[i] = nz * e.speed[i] * 5;
        } else if (e.state[i] === 1 && e.timer[i] <= 0) {
          e.state[i] = 0;
          e.timer[i] = 0.75;
        }
        speed = 0;
        desiredX = 0;
        desiredZ = 0;
        break;
      }

      case BEHAVIOR.trail: {
        // Snake: crawls in and drips poison that lingers on the ground.
        e.timer[i] -= dt;
        if (e.timer[i] <= 0) {
          e.timer[i] = 1.6;
          game.spawnZone(e.x[i], e.z[i], 1.25, e.damage[i] * 0.8, 4.5, true, 0);
        }
        break;
      }

      case BEHAVIOR.summon: {
        // Akita boss: keeps its distance and calls in pups.
        e.timer[i] -= dt;
        if (e.timer[i] <= 0) {
          e.timer[i] = 7;
          for (let n = 0; n < 4; n++) {
            const a = (n / 4) * Math.PI * 2 + game.rng.next();
            game.spawnEnemy('inu', e.x[i] + Math.cos(a) * 2.5, e.z[i] + Math.sin(a) * 2.5);
          }
          game.effects.push({ kind: 'spark', x: e.x[i], z: e.z[i], t: 0, dur: 0.35 });
        }
        if (dist < 4) speed *= 0.3;
        break;
      }

      default:
        break;
    }

    // Separation from nearby enemies.
    let sepX = 0;
    let sepZ = 0;
    const n = game.grid.query(e.x[i], e.z[i], e.radius[i] * 2.2, NEIGHBOURS);
    for (let q = 0; q < n; q++) {
      const j = NEIGHBOURS[q];
      if (j === i || j >= e.count) continue;
      const ox = e.x[i] - e.x[j];
      const oz = e.z[i] - e.z[j];
      const minD = e.radius[i] + e.radius[j];
      const d2 = ox * ox + oz * oz;
      if (d2 > minD * minD || d2 < 1e-6) continue;
      const d = Math.sqrt(d2);
      const push = (minD - d) / minD;
      sepX += (ox / d) * push;
      sepZ += (oz / d) * push;
    }

    e.vx[i] += sepX * SEPARATION_FORCE * dt;
    e.vz[i] += sepZ * SEPARATION_FORCE * dt;
    const decay = Math.max(0, 1 - DRAG * dt);
    e.vx[i] *= decay;
    e.vz[i] *= decay;

    e.x[i] += (desiredX * speed * bossMul + e.vx[i]) * dt;
    e.z[i] += (desiredZ * speed * bossMul + e.vz[i]) * dt;
    e.facing[i] = dx >= 0 ? 1 : -1;

    // Contact damage.
    if (dist < e.radius[i] + game.player.radius) {
      game.damagePlayer(e.damage[i]);
    }
  }
}
