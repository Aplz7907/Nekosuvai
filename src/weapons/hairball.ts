import type { WeaponDef, WeaponStats } from './types';

/**
 * Hairball — auto-aims the nearest enemy and pierces. Covers the range slot.
 */
export const HAIRBALL: WeaponDef = {
  id: 'hairball',
  name: 'Hairball',
  jp: '毛玉',
  desc: 'ยิงอัตโนมัติหาศัตรูใกล้สุด ทะลุได้',
  maxLevel: 8,

  stats(level: number): WeaponStats {
    const l = level - 1;
    return {
      damage: 9 + l * 4,
      cooldown: Math.max(0.32, 1.2 - l * 0.1),
      range: 14,
      count: 1 + Math.floor(l / 2),
      pierce: level >= 8 ? 99 : 1 + Math.floor(l / 3),
      speed: 12 + l * 0.6,
    };
  },

  update(game, state, _slot, dt) {
    state.cooldown -= dt;
    if (state.cooldown > 0) return;

    const s = this.stats(state.level);
    state.cooldown = s.cooldown * game.player.cooldownMul;

    const targets = game.nearestEnemies(game.player.x, game.player.z, s.range, s.count);
    if (targets.length === 0) return;

    for (let n = 0; n < s.count; n++) {
      const target = targets[Math.min(n, targets.length - 1)];
      let ang = Math.atan2(game.enemies.z[target] - game.player.z, game.enemies.x[target] - game.player.x);
      // Duplicate shots at the same target fan out instead of stacking.
      if (n >= targets.length) ang += (n - targets.length + 1) * 0.22;
      game.spawnProjectile(
        game.player.x,
        game.player.z,
        Math.cos(ang) * s.speed!,
        Math.sin(ang) * s.speed!,
        s.damage * game.player.damageMul,
        0.34 * game.player.areaMul,
        1.6,
        s.pierce!,
      );
    }
  },
};
