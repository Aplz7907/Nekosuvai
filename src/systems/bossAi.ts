import { KIND_INDEX } from '../ecs/entities';
import type { Game } from '../game';

/** HP fractions where a boss flips to its next phase. */
const PHASE_THRESHOLDS = [0.66, 0.33];

/**
 * Boss phases sit on top of the normal steering behaviour: the base archetype
 * (charge or summon) keeps running, and this adds escalating special attacks.
 *
 *   phase 0  — slow slams the player can walk out of
 *   phase 1  — slams plus a ring of fire around the boss
 *   phase 2  — enraged: faster, adds on every attack, tighter timings
 *
 * Returns the speed multiplier the caller should apply this step.
 */
export function updateBossPhase(game: Game, i: number, dt: number): number {
  const e = game.enemies;
  const frac = e.hp[i] / Math.max(e.maxHp[i], 1);

  let phase = 0;
  if (frac <= PHASE_THRESHOLDS[1]) phase = 2;
  else if (frac <= PHASE_THRESHOLDS[0]) phase = 1;

  if (phase > e.phase[i]) {
    e.phase[i] = phase;
    // Phase change knocks the arena back: a burst of fire around the boss and
    // a moment of stillness so the change is readable.
    e.attackCd[i] = 1.2;
    e.vx[i] = 0;
    e.vz[i] = 0;
    shockwave(game, e.x[i], e.z[i], 3.2 + phase, e.damage[i] * 0.5);
    game.effects.push({ kind: 'spark', x: e.x[i], z: e.z[i], t: 0, dur: 0.5 });
    game.emit('bossPhase', e.x[i], e.z[i]);
  }

  e.attackCd[i] -= dt;
  if (e.attackCd[i] <= 0) {
    e.attackCd[i] = phase === 0 ? 5 : phase === 1 ? 3.6 : 2.4;

    // Slam lands where the player is now, so it rewards moving.
    game.spawnZone(game.player.x, game.player.z, 2.6, e.damage[i] * 0.55, 2.4, true, 0);
    game.effects.push({ kind: 'spark', x: game.player.x, z: game.player.z, t: 0, dur: 0.3 });

    if (phase >= 1) shockwave(game, e.x[i], e.z[i], 4.4, e.damage[i] * 0.45);
    if (phase >= 2) {
      const add = e.kind[i] === KIND_INDEX.bossInu ? 'inu' : 'nezumi';
      for (let n = 0; n < 2; n++) {
        const a = game.rng.range(0, Math.PI * 2);
        game.spawnEnemy(add, e.x[i] + Math.cos(a) * 3, e.z[i] + Math.sin(a) * 3);
      }
    }
  }

  return 1 + e.phase[i] * 0.2;
}

/** Ring of hostile patches around a point, leaving gaps to escape through. */
function shockwave(game: Game, x: number, z: number, radius: number, dps: number): void {
  // Six patches on a wide ring leave real gaps; eight walled the player in.
  const petals = 6;
  for (let n = 0; n < petals; n++) {
    const a = (n / petals) * Math.PI * 2;
    game.spawnZone(x + Math.cos(a) * radius, z + Math.sin(a) * radius, 1.4, dps, 2.2, true, 0);
  }
}
