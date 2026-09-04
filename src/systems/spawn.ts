import { CONFIG } from '../data/config';
import { BOSS_SCHEDULE, WAVES, type EnemyKind } from '../data/enemies';
import type { Game } from '../game';

/**
 * Drives enemy population from the wave table: every entry whose `at` has passed
 * contributes its spawn rate, so pressure accumulates over the run.
 */
export class SpawnDirector {
  private readonly accum = new Map<EnemyKind, number>();
  private nextBoss = 0;

  update(game: Game, dt: number): void {
    const active = new Map<EnemyKind, number>();
    for (const w of WAVES) {
      if (game.time < w.at) break;
      active.set(w.kind, w.rate);
    }

    for (const [kind, rate] of active) {
      const a = (this.accum.get(kind) ?? 0) + rate * dt;
      let n = Math.floor(a);
      this.accum.set(kind, a - n);
      while (n-- > 0) this.spawnOnRing(game, kind);
    }

    if (this.nextBoss < BOSS_SCHEDULE.length && game.time >= BOSS_SCHEDULE[this.nextBoss].at) {
      this.spawnOnRing(game, BOSS_SCHEDULE[this.nextBoss].kind);
      this.nextBoss++;
    }

    this.recycleStrays(game);
  }

  private spawnOnRing(game: Game, kind: EnemyKind): void {
    const a = game.rng.range(0, Math.PI * 2);
    const r = CONFIG.spawn.ringRadius + game.rng.range(0, 3);
    game.spawnEnemy(kind, game.player.x + Math.cos(a) * r, game.player.z + Math.sin(a) * r);
  }

  /** Enemies left far behind are teleported to the far side instead of being deleted. */
  private recycleStrays(game: Game): void {
    const e = game.enemies;
    const limit = CONFIG.spawn.despawnRadius;
    for (let i = 0; i < e.count; i++) {
      const dx = e.x[i] - game.player.x;
      const dz = e.z[i] - game.player.z;
      if (dx * dx + dz * dz < limit * limit) continue;
      const a = game.rng.range(0, Math.PI * 2);
      const r = CONFIG.spawn.ringRadius + game.rng.range(0, 2);
      e.x[i] = game.player.x + Math.cos(a) * r;
      e.z[i] = game.player.z + Math.sin(a) * r;
      e.vx[i] = 0;
      e.vz[i] = 0;
    }
  }
}
