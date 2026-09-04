import type { WeaponDef, WeaponStats } from './types';

/**
 * Neko Claw — melee cone in the direction the cat is facing.
 * Highest damage per hit, shortest reach. Evolves at level 8 into a full 360 sweep.
 */
export const CLAW: WeaponDef = {
  id: 'claw',
  name: 'Neko Claw',
  jp: '猫爪',
  desc: 'ฟันโค้งด้านหน้า ดาเมจสูง ระยะสั้น',
  maxLevel: 8,

  stats(level: number): WeaponStats {
    const l = level - 1;
    return {
      damage: 12 + l * 5,
      cooldown: Math.max(0.34, 0.8 - l * 0.06),
      range: 2.4 + l * 0.16,
      count: level >= 6 ? 3 : level >= 2 ? 2 : 1,
      arc: level >= 8 ? Math.PI * 2 : ((110 + l * 12) * Math.PI) / 180,
    };
  },

  update(game, state, slot, dt) {
    state.cooldown -= dt;
    if (state.cooldown > 0) return;

    const s = this.stats(state.level);
    const cd = s.cooldown * game.player.cooldownMul;
    state.cooldown = cd;

    const range = s.range * game.player.areaMul;
    const arc = (s.arc ?? Math.PI) * Math.min(game.player.areaMul, 2);
    const damage = s.damage * game.player.damageMul;

    // Extra swings in one activation are staggered so the arcs read as separate slashes.
    for (let n = 0; n < s.count; n++) {
      game.schedule(n * 0.11, () => {
        // Swing at whatever is closest, falling back to the walking direction
        // when nothing is in reach — the player steers, the claw finds targets.
        const near = game.nearestEnemies(game.player.x, game.player.z, range * 1.6, 1);
        const aim =
          near.length > 0
            ? Math.atan2(game.enemies.z[near[0]] - game.player.z, game.enemies.x[near[0]] - game.player.x)
            : game.player.facing;
        const angle = aim + (n % 2 === 0 ? 0 : 0.35) * (n > 1 ? -1 : 1);
        game.coneAttack(game.player.x, game.player.z, angle, arc, range, damage, slot, 0.25, 6);
        game.effects.push({
          kind: 'slash',
          x: game.player.x,
          z: game.player.z,
          angle,
          arc,
          range,
          t: 0,
          dur: 0.22,
        });
      });
    }
  },
};
