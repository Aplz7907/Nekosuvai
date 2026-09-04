import type { WeaponDef, WeaponStats } from './types';

/**
 * Yarn Orbit — balls circling the cat. Passive defence, no aiming.
 */
export const YARN: WeaponDef = {
  id: 'yarn',
  name: 'Yarn Orbit',
  jp: '毛糸',
  desc: 'ลูกไหมหมุนรอบตัว โดนแล้วเจ็บ',
  maxLevel: 8,

  stats(level: number): WeaponStats {
    const l = level - 1;
    return {
      damage: 8 + l * 4.5,
      cooldown: Math.max(0.18, 0.4 - l * 0.03), // re-hit delay per enemy
      range: 2.0 + l * 0.16,
      count: 2 + Math.floor((l + 1) / 2),
      speed: 2.4 + l * 0.12, // rad/s
    };
  },

  update(game, state, slot, dt) {
    const s = this.stats(state.level);
    state.phase += s.speed! * dt;

    const radius = s.range * game.player.areaMul;
    const hitRadius = 0.55 * game.player.areaMul;
    const damage = s.damage * game.player.damageMul;
    const reHit = s.cooldown * game.player.cooldownMul;

    game.orbitals.length = 0;
    for (let n = 0; n < s.count; n++) {
      const a = state.phase + (n / s.count) * Math.PI * 2;
      const ox = game.player.x + Math.cos(a) * radius;
      const oz = game.player.z + Math.sin(a) * radius;
      game.orbitals.push({ x: ox, z: oz, r: hitRadius });
      game.circleAttack(ox, oz, hitRadius, damage, slot, reHit, 2);
    }
  },
};
