import { SpatialHash } from './core/spatialHash';
import { Rng } from './core/rng';
import { CONFIG } from './data/config';
import { BOSS_KINDS, ENEMIES, type EnemyKind, difficultyScale } from './data/enemies';
import { EnemyPool, GemPool, HIT_LANES, KIND_INDEX, MAX_WEAPON_SLOTS, ProjectilePool, ZonePool } from './ecs/entities';
import { emptyBonuses, type Bonuses } from './data/progression';
import { WEAPONS } from './weapons/registry';
import type { WeaponId, WeaponState } from './weapons/types';
import { SpawnDirector } from './systems/spawn';
import { updateEnemies } from './systems/enemyAi';
import { updateProjectiles } from './systems/projectiles';
import { updateGems } from './systems/pickup';
import { updateZones } from './systems/zones';
import { BEHAVIOR } from './systems/enemyAi';

export interface Player {
  x: number;
  z: number;
  vx: number;
  vz: number;
  hp: number;
  maxHp: number;
  speed: number;
  radius: number;
  facing: number;
  invuln: number;
  damageMul: number;
  areaMul: number;
  cooldownMul: number;
  pickupRadius: number;
  crit: number;
  critMul: number;
  regen: number;
  luck: number;
  furColor: number;
  hurtFlash: number;
}

export type Effect =
  | { kind: 'slash'; x: number; z: number; angle: number; arc: number; range: number; t: number; dur: number }
  | { kind: 'spark'; x: number; z: number; t: number; dur: number }
  | { kind: 'beam'; x: number; z: number; x2: number; z2: number; t: number; dur: number };

/** Sound/feedback hooks. Kept as a plain callback so headless runs cost nothing. */
export type GameEvent =
  | 'hit'
  | 'crit'
  | 'kill'
  | 'pickup'
  | 'levelup'
  | 'hurt'
  | 'revive'
  | 'bossSpawn'
  | 'bossPhase'
  | 'gameover';

export interface Orbital {
  x: number;
  z: number;
  r: number;
}

const QUERY_BUF = new Int32Array(2048);

export class Game {
  readonly enemies = new EnemyPool();
  readonly projectiles = new ProjectilePool();
  readonly gems = new GemPool();
  readonly zones = new ZonePool();
  readonly grid = new SpatialHash(1.5, CONFIG.capacity.enemies);
  readonly rng: Rng;
  readonly spawner = new SpawnDirector();

  readonly effects: Effect[] = [];
  readonly orbitals: Orbital[] = [];
  readonly weapons: WeaponState[] = [];
  readonly passives = new Map<string, number>();

  private readonly timers: { t: number; fn: () => void }[] = [];

  time = 0;
  level = 1;
  xp = 0;
  xpNeeded = 8;
  kills = 0;
  pendingLevelUps = 0;
  bossActive = false;
  over = false;
  /** Deaths left to shrug off, from the Ninth Life node. */
  revives = 0;
  readonly unlocked: Set<string>;
  onEvent: ((kind: GameEvent, x?: number, z?: number) => void) | null = null;
  /** Input direction for this step, set by the controller. Need not be normalised. */
  input = { x: 0, z: 0 };

  readonly player: Player;

  constructor(furColor: number, seed?: number, bonuses: Bonuses = emptyBonuses()) {
    this.rng = new Rng(seed);
    this.revives = bonuses.revives;
    this.unlocked = new Set(bonuses.unlocked);
    const p = CONFIG.player;
    this.player = {
      x: 0,
      z: 0,
      vx: 0,
      vz: 0,
      hp: p.maxHp + bonuses.maxHp,
      maxHp: p.maxHp + bonuses.maxHp,
      speed: p.speed * bonuses.speedMul,
      radius: p.radius,
      facing: 0,
      invuln: 0,
      damageMul: bonuses.damageMul,
      areaMul: bonuses.areaMul,
      cooldownMul: bonuses.cooldownMul,
      pickupRadius: p.pickupRadius * bonuses.pickupMul,
      crit: 0.05 + bonuses.crit,
      critMul: 2,
      regen: p.regen + bonuses.regen,
      luck: 0,
      furColor,
      hurtFlash: 0,
    };
    this.addWeapon('claw');
  }

  // ---------------------------------------------------------------- lifecycle

  step(dt: number): void {
    if (this.over) return;
    this.time += dt;

    this.runTimers(dt);
    this.movePlayer(dt);
    this.rebuildGrid();
    this.spawner.update(this, dt);
    updateEnemies(this, dt);

    for (let s = 0; s < this.weapons.length; s++) {
      this.weapons[s].def.update(this, this.weapons[s], s, dt);
    }
    if (!this.hasWeapon('yarn')) this.orbitals.length = 0;

    updateProjectiles(this, dt);
    updateZones(this, dt);
    updateGems(this, dt);
    this.tickCooldowns(dt);
    this.updateEffects(dt);

    if (this.player.regen > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.regen * dt);
    }
    if (this.time >= CONFIG.runSeconds) this.over = true;
  }

  emit(kind: GameEvent, x?: number, z?: number): void {
    this.onEvent?.(kind, x, z);
  }

  schedule(delay: number, fn: () => void): void {
    if (delay <= 0) {
      fn();
      return;
    }
    this.timers.push({ t: delay, fn });
  }

  private runTimers(dt: number): void {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const timer = this.timers[i];
      timer.t -= dt;
      if (timer.t <= 0) {
        this.timers.splice(i, 1);
        timer.fn();
      }
    }
  }

  private movePlayer(dt: number): void {
    const p = this.player;
    let ix = this.input.x;
    let iz = this.input.z;
    const len = Math.hypot(ix, iz);
    if (len > 1e-4) {
      ix /= len;
      iz /= len;
      p.facing = Math.atan2(iz, ix);
    } else {
      ix = 0;
      iz = 0;
    }
    p.vx = ix * p.speed;
    p.vz = iz * p.speed;
    p.x += p.vx * dt;
    p.z += p.vz * dt;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.hurtFlash > 0) p.hurtFlash -= dt;
  }

  private rebuildGrid(): void {
    this.grid.clear();
    const e = this.enemies;
    for (let i = 0; i < e.count; i++) this.grid.insert(i, e.x[i], e.z[i]);
  }

  private tickCooldowns(dt: number): void {
    const cd = this.enemies.hitCd;
    const n = this.enemies.count * HIT_LANES;
    for (let i = 0; i < n; i++) if (cd[i] > 0) cd[i] -= dt;
    const flash = this.enemies.flash;
    for (let i = 0; i < this.enemies.count; i++) if (flash[i] > 0) flash[i] -= dt;
  }

  private updateEffects(dt: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i];
      fx.t += dt;
      if (fx.t >= fx.dur) this.effects.splice(i, 1);
    }
  }

  // ------------------------------------------------------------------ spawning

  spawnEnemy(kind: EnemyKind, x: number, z: number): number {
    const i = this.enemies.spawn();
    if (i < 0) return -1;
    const def = ENEMIES[kind];
    const scale = difficultyScale(this.time);
    const e = this.enemies;
    e.x[i] = x;
    e.z[i] = z;
    e.vx[i] = 0;
    e.vz[i] = 0;
    e.hp[i] = def.hp * scale;
    e.maxHp[i] = e.hp[i];
    e.speed[i] = def.speed;
    e.radius[i] = def.radius;
    e.damage[i] = def.damage * Math.min(scale, 2.2);
    e.xp[i] = def.xp;
    e.size[i] = def.size;
    e.kind[i] = KIND_INDEX[kind];
    e.behavior[i] = BEHAVIOR[def.behavior];
    e.state[i] = 0;
    e.timer[i] = this.rng.range(0, 2);
    e.flash[i] = 0;
    e.facing[i] = 1;
    e.phase[i] = 0;
    e.attackCd[i] = 4;
    e.isBoss[i] = BOSS_KINDS.includes(kind) ? 1 : 0;
    for (let s = 0; s < HIT_LANES; s++) e.hitCd[i * HIT_LANES + s] = 0;
    if (e.isBoss[i]) {
      this.bossActive = true;
      this.emit('bossSpawn', x, z);
    }
    return i;
  }

  spawnProjectile(
    x: number,
    z: number,
    vx: number,
    vz: number,
    damage: number,
    radius: number,
    life: number,
    pierce: number,
    mode = 0,
    art = 0,
  ): void {
    const i = this.projectiles.spawn();
    if (i < 0) return;
    const p = this.projectiles;
    p.x[i] = x;
    p.z[i] = z;
    p.vx[i] = vx;
    p.vz[i] = vz;
    p.damage[i] = damage;
    p.radius[i] = radius;
    p.life[i] = life;
    p.pierce[i] = pierce;
    p.spin[i] = this.rng.range(0, Math.PI * 2);
    p.mode[i] = mode;
    p.age[i] = 0;
    p.art[i] = art;
  }

  /** Places a lingering ground hazard. `lane` is only used for friendly zones. */
  spawnZone(
    x: number,
    z: number,
    radius: number,
    dps: number,
    life: number,
    hostile: boolean,
    lane: number,
  ): void {
    const i = this.zones.spawn();
    const zn = this.zones;
    zn.x[i] = x;
    zn.z[i] = z;
    zn.radius[i] = radius;
    zn.dps[i] = dps;
    zn.life[i] = life;
    zn.maxLife[i] = life;
    zn.tick[i] = 0;
    zn.hostile[i] = hostile ? 1 : 0;
    zn.lane[i] = lane;
  }

  spawnGem(x: number, z: number, value: number): void {
    const i = this.gems.spawn();
    const g = this.gems;
    g.x[i] = x;
    g.z[i] = z;
    g.vx[i] = this.rng.range(-1.2, 1.2);
    g.vz[i] = this.rng.range(-1.2, 1.2);
    g.value[i] = value;
    g.bob[i] = this.rng.range(0, Math.PI * 2);
    g.homing[i] = 0;
  }

  // -------------------------------------------------------------------- combat

  /** Damages one enemy, applying crit and death handling. Returns damage dealt. */
  hitEnemy(i: number, damage: number, knockback: number, fromX: number, fromZ: number): number {
    const crit = this.rng.next() < this.player.crit;
    const dealt = crit ? damage * this.player.critMul : damage;
    const e = this.enemies;
    e.hp[i] -= dealt;
    e.flash[i] = 0.09;
    this.emit(crit ? 'crit' : 'hit', e.x[i], e.z[i]);

    if (knockback > 0) {
      const dx = e.x[i] - fromX;
      const dz = e.z[i] - fromZ;
      const d = Math.hypot(dx, dz) || 1;
      // Big enemies shrug off knockback in proportion to their size.
      const k = knockback / (1 + e.radius[i] * 2);
      e.vx[i] += (dx / d) * k;
      e.vz[i] += (dz / d) * k;
    }

    if (e.hp[i] <= 0) this.killEnemy(i);
    return dealt;
  }

  killEnemy(i: number): void {
    const e = this.enemies;
    const isBoss = BOSS_KINDS.some((k) => e.kind[i] === KIND_INDEX[k]);
    const value = e.xp[i];
    const x = e.x[i];
    const z = e.z[i];
    this.effects.push({ kind: 'spark', x, z, t: 0, dur: 0.2 });
    this.enemies.remove(i);
    this.kills++;
    this.emit('kill', x, z);
    if (isBoss) {
      this.bossActive = false;
      // Split the boss reward so the magnet pull reads as a shower of fish.
      for (let n = 0; n < 12; n++) {
        this.spawnGem(x + this.rng.range(-1.5, 1.5), z + this.rng.range(-1.5, 1.5), value / 12);
      }
    } else {
      this.spawnGem(x, z, value);
    }
  }

  coneAttack(
    x: number,
    z: number,
    angle: number,
    arc: number,
    range: number,
    damage: number,
    slot: number,
    reHit: number,
    knockback: number,
  ): void {
    const e = this.enemies;
    const n = this.grid.query(x, z, range + 1, QUERY_BUF);
    const half = arc / 2;
    const full = arc >= Math.PI * 1.99;
    for (let q = 0; q < n; q++) {
      const i = QUERY_BUF[q];
      if (i >= e.count) continue;
      const cdIdx = i * HIT_LANES + slot;
      if (e.hitCd[cdIdx] > 0) continue;
      const dx = e.x[i] - x;
      const dz = e.z[i] - z;
      const reach = range + e.radius[i];
      if (dx * dx + dz * dz > reach * reach) continue;
      if (!full) {
        let d = Math.atan2(dz, dx) - angle;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        if (Math.abs(d) > half) continue;
      }
      e.hitCd[cdIdx] = reHit;
      const before = e.count;
      this.hitEnemy(i, damage, knockback, x, z);
      // A kill swaps a different enemy into slot i, so re-test that slot.
      if (e.count < before) q--;
    }
  }

  circleAttack(x: number, z: number, radius: number, damage: number, slot: number, reHit: number, knockback: number): void {
    this.coneAttack(x, z, 0, Math.PI * 2, radius, damage, slot, reHit, knockback);
  }

  /**
   * Hits one enemy then arcs to the nearest unhit neighbour, `jumps` times.
   * Returns how many enemies were struck.
   */
  chainAttack(
    startX: number,
    startZ: number,
    range: number,
    jumpRange: number,
    jumps: number,
    damage: number,
    falloff: number,
  ): number {
    const e = this.enemies;
    const hit = new Set<number>();
    let fromX = startX;
    let fromZ = startZ;
    let dmg = damage;
    let struck = 0;

    for (let j = 0; j <= jumps; j++) {
      const candidates = this.nearestEnemies(fromX, fromZ, j === 0 ? range : jumpRange, 6);
      let target = -1;
      for (const c of candidates) {
        if (!hit.has(c)) {
          target = c;
          break;
        }
      }
      if (target < 0) break;

      const tx = e.x[target];
      const tz = e.z[target];
      hit.add(target);
      struck++;
      this.effects.push({ kind: 'beam', x: fromX, z: fromZ, x2: tx, z2: tz, t: 0, dur: 0.16 });
      this.hitEnemy(target, dmg, 0, fromX, fromZ);
      // Indices shift when an enemy dies, so the visited set is only valid
      // for this cast — that is fine, the chain never revisits a corpse.
      fromX = tx;
      fromZ = tz;
      dmg *= falloff;
    }
    return struck;
  }

  damagePlayer(amount: number): void {
    const p = this.player;
    if (p.invuln > 0) return;
    p.hp -= amount;
    p.invuln = CONFIG.player.iframes;
    p.hurtFlash = 0.18;
    this.emit('hurt', p.x, p.z);
    if (p.hp <= 0) {
      if (this.revives > 0) {
        // Ninth Life: back up at half HP with a breather to escape the pile.
        this.revives--;
        p.hp = p.maxHp * 0.5;
        p.invuln = 2.5;
        this.emit('revive', p.x, p.z);
        return;
      }
      p.hp = 0;
      this.over = true;
      this.emit('gameover', p.x, p.z);
    }
  }

  /** Indices of up to `count` enemies within `range`, nearest first. */
  nearestEnemies(x: number, z: number, range: number, count: number): number[] {
    const e = this.enemies;
    const found: { i: number; d: number }[] = [];
    const n = this.grid.query(x, z, range, QUERY_BUF);
    for (let q = 0; q < n; q++) {
      const i = QUERY_BUF[q];
      if (i >= e.count) continue;
      const dx = e.x[i] - x;
      const dz = e.z[i] - z;
      const d = dx * dx + dz * dz;
      if (d <= range * range) found.push({ i, d });
    }
    found.sort((a, b) => a.d - b.d);
    return found.slice(0, count).map((f) => f.i);
  }

  // ---------------------------------------------------------------- progression

  addXp(amount: number): void {
    this.xp += amount;
    while (this.xp >= this.xpNeeded) {
      this.xp -= this.xpNeeded;
      this.level++;
      this.xpNeeded = Math.floor(4 + this.level * 3 + Math.pow(this.level, 1.35));
      this.pendingLevelUps++;
      this.emit('levelup', this.player.x, this.player.z);
    }
  }

  hasWeapon(id: WeaponId): boolean {
    return this.weapons.some((w) => w.def.id === id);
  }

  weaponLevel(id: WeaponId): number {
    return this.weapons.find((w) => w.def.id === id)?.level ?? 0;
  }

  addWeapon(id: WeaponId): void {
    const existing = this.weapons.find((w) => w.def.id === id);
    if (existing) {
      if (existing.level < existing.def.maxLevel) existing.level++;
      return;
    }
    if (this.weapons.length >= MAX_WEAPON_SLOTS) return;
    this.weapons.push({ def: WEAPONS[id], level: 1, cooldown: 0, phase: 0 });
  }
}
