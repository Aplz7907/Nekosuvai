import type { WeaponDef, WeaponStats } from './types';

/**
 * Ember Trail — kitsune-fire dropped in the cat's footsteps. Area denial that
 * pays off while kiting, and the only weapon that damages what is behind you.
 */
export const EMBER: WeaponDef = {
  id: 'ember',
  name: 'Ember Trail',
  jp: '狐火',
  desc: 'ทิ้งไฟตามรอยเท้า เผาศัตรูที่เดินตาม',
  maxLevel: 8,

  stats(level: number): WeaponStats {
    const l = level - 1;
    return {
      damage: 11 + l * 6, // damage per second inside the flame
      cooldown: Math.max(0.35, 0.9 - l * 0.07),
      range: 1.5 + l * 0.11, // flame radius
      count: 1,
      // Doubles as flame lifetime in seconds.
      speed: 3 + l * 0.3,
    };
  },

  update(game, state, slot, dt) {
    state.cooldown -= dt;
    if (state.cooldown > 0) return;

    const s = this.stats(state.level);
    state.cooldown = s.cooldown * game.player.cooldownMul;

    game.spawnZone(
      game.player.x,
      game.player.z,
      s.range * game.player.areaMul,
      s.damage * game.player.damageMul,
      s.speed!,
      false,
      slot,
    );
  },
};
