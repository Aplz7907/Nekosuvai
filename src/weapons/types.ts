import type { Game } from '../game';

export type WeaponId = 'claw' | 'hairball' | 'yarn' | 'fish' | 'kaminari' | 'ember';

export interface WeaponStats {
  damage: number;
  cooldown: number;
  /** Meaning depends on the weapon: arc range, projectile reach, orbit radius. */
  range: number;
  /** Projectiles per shot / claw swings / orbiting balls. */
  count: number;
  /** Radians, arc weapons only. */
  arc?: number;
  pierce?: number;
  speed?: number;
}

export interface WeaponDef {
  id: WeaponId;
  name: string;
  jp: string;
  desc: string;
  maxLevel: number;
  stats(level: number): WeaponStats;
  /** Called every sim step. `slot` identifies this weapon's per-enemy hit cooldown lane. */
  update(game: Game, state: WeaponState, slot: number, dt: number): void;
}

export interface WeaponState {
  def: WeaponDef;
  level: number;
  cooldown: number;
  /** Free-form per-weapon runtime data (orbit phase, etc). */
  phase: number;
}
