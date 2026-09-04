import { CONFIG } from '../data/config';
import type { EnemyKind } from '../data/enemies';

/** Weapons the cat can carry at once; each owns one per-enemy hit-cooldown lane. */
export const MAX_WEAPON_SLOTS = 6;
/** Projectiles get their own lane so a pierce shot never shares a weapon's timer. */
export const PROJECTILE_LANE = MAX_WEAPON_SLOTS;
export const HIT_LANES = MAX_WEAPON_SLOTS + 1;

export const KIND_ORDER: EnemyKind[] = [
  'nezumi',
  'inu',
  'karasu',
  'tanuki',
  'hebi',
  'kaeru',
  'hachi',
  'inoshishi',
  'boss',
  'bossInu',
];

export const KIND_INDEX = Object.fromEntries(
  KIND_ORDER.map((k, i) => [k, i]),
) as Record<EnemyKind, number>;

/**
 * Struct-of-arrays pools. Entities are kept densely packed: removing index i
 * swaps the last live entity into i, so iteration is always 0..count-1 with no holes.
 */
export class EnemyPool {
  readonly cap = CONFIG.capacity.enemies;
  count = 0;

  readonly x = new Float32Array(this.cap);
  readonly z = new Float32Array(this.cap);
  readonly vx = new Float32Array(this.cap);
  readonly vz = new Float32Array(this.cap);
  readonly hp = new Float32Array(this.cap);
  readonly maxHp = new Float32Array(this.cap);
  readonly speed = new Float32Array(this.cap);
  readonly radius = new Float32Array(this.cap);
  readonly damage = new Float32Array(this.cap);
  readonly xp = new Float32Array(this.cap);
  readonly size = new Float32Array(this.cap);
  readonly kind = new Uint8Array(this.cap);
  readonly behavior = new Uint8Array(this.cap); // 0 seek, 1 strafe, 2 charge
  readonly state = new Uint8Array(this.cap);
  readonly timer = new Float32Array(this.cap);
  readonly flash = new Float32Array(this.cap);
  readonly facing = new Int8Array(this.cap);
  /** Boss only: 0/1/2 as HP crosses the two phase thresholds. */
  readonly phase = new Uint8Array(this.cap);
  /** Boss only: seconds until the next special attack. */
  readonly attackCd = new Float32Array(this.cap);
  readonly isBoss = new Uint8Array(this.cap);
  /** Per-weapon-slot cooldown so an orbital cannot hit the same enemy every frame. */
  readonly hitCd = new Float32Array(this.cap * HIT_LANES);

  spawn(): number {
    if (this.count >= this.cap) return -1;
    return this.count++;
  }

  remove(i: number): void {
    const last = --this.count;
    if (i !== last) {
      this.x[i] = this.x[last];
      this.z[i] = this.z[last];
      this.vx[i] = this.vx[last];
      this.vz[i] = this.vz[last];
      this.hp[i] = this.hp[last];
      this.maxHp[i] = this.maxHp[last];
      this.speed[i] = this.speed[last];
      this.radius[i] = this.radius[last];
      this.damage[i] = this.damage[last];
      this.xp[i] = this.xp[last];
      this.size[i] = this.size[last];
      this.kind[i] = this.kind[last];
      this.behavior[i] = this.behavior[last];
      this.state[i] = this.state[last];
      this.timer[i] = this.timer[last];
      this.flash[i] = this.flash[last];
      this.facing[i] = this.facing[last];
      this.phase[i] = this.phase[last];
      this.attackCd[i] = this.attackCd[last];
      this.isBoss[i] = this.isBoss[last];
      for (let s = 0; s < HIT_LANES; s++) {
        this.hitCd[i * HIT_LANES + s] = this.hitCd[last * HIT_LANES + s];
      }
    }
  }

  clear(): void {
    this.count = 0;
  }
}

export class ProjectilePool {
  readonly cap = CONFIG.capacity.projectiles;
  count = 0;

  readonly x = new Float32Array(this.cap);
  readonly z = new Float32Array(this.cap);
  readonly vx = new Float32Array(this.cap);
  readonly vz = new Float32Array(this.cap);
  readonly damage = new Float32Array(this.cap);
  readonly radius = new Float32Array(this.cap);
  readonly life = new Float32Array(this.cap);
  readonly pierce = new Int16Array(this.cap);
  readonly spin = new Float32Array(this.cap);
  /** 0 = straight flight, 1 = boomerang that turns around and comes back. */
  readonly mode = new Uint8Array(this.cap);
  readonly age = new Float32Array(this.cap);
  /** Sprite index: 0 hairball, 1 fish. */
  readonly art = new Uint8Array(this.cap);

  spawn(): number {
    if (this.count >= this.cap) return -1;
    return this.count++;
  }

  remove(i: number): void {
    const last = --this.count;
    if (i !== last) {
      this.x[i] = this.x[last];
      this.z[i] = this.z[last];
      this.vx[i] = this.vx[last];
      this.vz[i] = this.vz[last];
      this.damage[i] = this.damage[last];
      this.radius[i] = this.radius[last];
      this.life[i] = this.life[last];
      this.pierce[i] = this.pierce[last];
      this.spin[i] = this.spin[last];
      this.mode[i] = this.mode[last];
      this.age[i] = this.age[last];
      this.art[i] = this.art[last];
    }
  }

  clear(): void {
    this.count = 0;
  }
}

export class GemPool {
  readonly cap = CONFIG.capacity.gems;
  count = 0;

  readonly x = new Float32Array(this.cap);
  readonly z = new Float32Array(this.cap);
  readonly vx = new Float32Array(this.cap);
  readonly vz = new Float32Array(this.cap);
  readonly value = new Float32Array(this.cap);
  readonly bob = new Float32Array(this.cap);
  readonly homing = new Uint8Array(this.cap);

  spawn(): number {
    if (this.count >= this.cap) {
      // Oldest gem is sacrificed rather than dropping the newest kill's reward.
      this.remove(0);
    }
    return this.count++;
  }

  remove(i: number): void {
    const last = --this.count;
    if (i !== last) {
      this.x[i] = this.x[last];
      this.z[i] = this.z[last];
      this.vx[i] = this.vx[last];
      this.vz[i] = this.vz[last];
      this.value[i] = this.value[last];
      this.bob[i] = this.bob[last];
      this.homing[i] = this.homing[last];
    }
  }

  clear(): void {
    this.count = 0;
  }
}

/**
 * Ground areas that damage whoever stands in them: ember trails left by the cat,
 * poison puddles left by snakes. `hostile` decides which side takes the hit.
 */
export class ZonePool {
  /** Bosses in phase 2 plus a field of snakes can hold a few hundred at once. */
  readonly cap = 512;
  count = 0;

  readonly x = new Float32Array(this.cap);
  readonly z = new Float32Array(this.cap);
  readonly radius = new Float32Array(this.cap);
  /** Damage per second inside the radius. */
  readonly dps = new Float32Array(this.cap);
  readonly life = new Float32Array(this.cap);
  readonly maxLife = new Float32Array(this.cap);
  readonly tick = new Float32Array(this.cap);
  readonly hostile = new Uint8Array(this.cap);
  /** Hit-cooldown lane used when damaging enemies. */
  readonly lane = new Uint8Array(this.cap);

  spawn(): number {
    if (this.count >= this.cap) this.remove(0);
    return this.count++;
  }

  remove(i: number): void {
    const last = --this.count;
    if (i !== last) {
      this.x[i] = this.x[last];
      this.z[i] = this.z[last];
      this.radius[i] = this.radius[last];
      this.dps[i] = this.dps[last];
      this.life[i] = this.life[last];
      this.maxLife[i] = this.maxLife[last];
      this.tick[i] = this.tick[last];
      this.hostile[i] = this.hostile[last];
      this.lane[i] = this.lane[last];
    }
  }

  clear(): void {
    this.count = 0;
  }
}
