import type { WeaponDef, WeaponStats } from './types';

/**
 * Kaminari — instant chain lightning. Hits hardest on the first target and
 * arcs outward with falloff, so it thins packs rather than deleting one enemy.
 */
export const KAMINARI: WeaponDef = {
  id: 'kaminari',
  name: 'Kaminari',
  jp: '雷鳴',
  desc: 'ฟ้าผ่าเด้งต่อเป็นทอด ดาเมจลดลงทีละเด้ง',
  maxLevel: 8,

  stats(level: number): WeaponStats {
    const l = level - 1;
    return {
      damage: 16 + l * 7,
      cooldown: Math.max(0.8, 2.6 - l * 0.2),
      range: 7 + l * 0.3,
      // count doubles as the number of arcs after the first strike.
      count: 2 + Math.floor(l / 2),
    };
  },

  update(game, state, _slot, dt) {
    state.cooldown -= dt;
    if (state.cooldown > 0) return;

    const s = this.stats(state.level);
    state.cooldown = s.cooldown * game.player.cooldownMul;

    const struck = game.chainAttack(
      game.player.x,
      game.player.z,
      s.range * game.player.areaMul,
      4.5 * game.player.areaMul,
      s.count,
      s.damage * game.player.damageMul,
      // Level 8 keeps full damage across the whole chain.
      state.level >= 8 ? 1 : 0.82,
    );

    // Nothing in range: retry soon instead of burning the full cooldown.
    if (struck === 0) state.cooldown = Math.min(state.cooldown, 0.25);
  },
};
