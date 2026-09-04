import type { WeaponDef, WeaponStats } from './types';

/**
 * Dried Fish Boomerang — thrown outward, curves back to the cat and hits
 * everything on both legs of the trip. Rewards lining enemies up.
 */
export const FISH: WeaponDef = {
  id: 'fish',
  name: 'Fish Boomerang',
  jp: '魚投',
  desc: 'ขว้างปลาแล้ววนกลับ โดนทั้งขาไปขากลับ',
  maxLevel: 8,

  stats(level: number): WeaponStats {
    const l = level - 1;
    return {
      damage: 14 + l * 5,
      cooldown: Math.max(0.7, 2.2 - l * 0.16),
      range: 12,
      count: 1 + Math.floor(l / 3),
      speed: 13 + l * 0.5,
    };
  },

  update(game, state, _slot, dt) {
    state.cooldown -= dt;
    if (state.cooldown > 0) return;

    const s = this.stats(state.level);
    state.cooldown = s.cooldown * game.player.cooldownMul;

    const targets = game.nearestEnemies(game.player.x, game.player.z, s.range, s.count);
    const base = targets.length
      ? Math.atan2(game.enemies.z[targets[0]] - game.player.z, game.enemies.x[targets[0]] - game.player.x)
      : game.player.facing;

    for (let n = 0; n < s.count; n++) {
      // Extra fish fan out so a stack does not fly as one blob.
      const ang = base + (n - (s.count - 1) / 2) * 0.5;
      game.spawnProjectile(
        game.player.x,
        game.player.z,
        Math.cos(ang) * s.speed!,
        Math.sin(ang) * s.speed!,
        s.damage * game.player.damageMul,
        0.45 * game.player.areaMul,
        3.5,
        0,
        1,
        1,
      );
    }
  },
};
