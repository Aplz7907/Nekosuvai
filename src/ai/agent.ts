import type { UpgradeOption } from '../data/upgrades';
import type { Game } from '../game';

/**
 * Autopilot: a hand-written policy that plays the cat.
 *
 * Movement is a direction-sampling controller — it scores a ring of candidate
 * headings against a local threat field and picks the best one. That handles
 * "kite the horde, thread the gap, grab the fish" without any pathfinding, and
 * it is deterministic, so the bench harness can compare balance changes.
 */

export interface AgentWeights {
  /** How strongly enemies in the chosen direction are avoided. */
  danger: number;
  /** Extra weight for enemies that are winding up or mid-charge. */
  charge: number;
  /** Pull toward XP pickups. */
  greed: number;
  /** Penalty for hostile ground hazards. */
  hazard: number;
  /** Resistance to changing heading, which stops direction jitter. */
  momentum: number;
}

export const DEFAULT_WEIGHTS: AgentWeights = {
  danger: 1,
  charge: 2.2,
  greed: 1.2,
  hazard: 3,
  momentum: 0.45,
};

const DIRECTIONS = 24;
/** Enemies further than this are ignored by the movement policy. */
const AWARENESS = 9;
const GEM_AWARENESS = 11;

const NEARBY = new Int32Array(512);

/** Upgrade preference, tuned by hand against the bench harness. */
const PASSIVE_SCORE: Record<string, number> = {
  damage: 58,
  cooldown: 52,
  area: 44,
  speed: 40,
  crit: 34,
  hp: 30,
  magnet: 26,
  regen: 22,
};

export class AutoPilot {
  private dirX = 1;
  private dirZ = 0;
  /** Last computed threat level, handy for a debug readout. */
  threat = 0;

  constructor(private readonly weights: AgentWeights = DEFAULT_WEIGHTS) {}

  direction(game: Game): { x: number; z: number } {
    const p = game.player;
    const e = game.enemies;
    const desperate = p.hp / p.maxHp < 0.35 ? 1.8 : 1;

    const count = game.grid.query(p.x, p.z, AWARENESS, NEARBY);
    let best = -Infinity;
    let bestX = this.dirX;
    let bestZ = this.dirZ;
    let threat = 0;

    for (let d = 0; d < DIRECTIONS; d++) {
      const a = (d / DIRECTIONS) * Math.PI * 2;
      const cx = Math.cos(a);
      const cz = Math.sin(a);
      let score = 0;

      // Threat: an enemy only matters if we would be running toward it.
      for (let q = 0; q < count; q++) {
        const i = NEARBY[q];
        if (i >= e.count) continue;
        const dx = e.x[i] - p.x;
        const dz = e.z[i] - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > AWARENESS || dist < 1e-3) continue;
        const align = (dx / dist) * cx + (dz / dist) * cz;
        // Sitting still next to an enemy is nearly as bad as walking into it.
        const facing = 0.4 + Math.max(0, align) * 1.6;
        let w = (e.damage[i] / (dist * dist)) * facing;
        // Charging enemies threaten the whole line they are locked onto.
        if (e.behavior[i] === 2 && e.state[i] >= 1) w *= this.weights.charge;
        score -= w * this.weights.danger * desperate;
        if (d === 0) threat += e.damage[i] / (dist * dist);
      }

      // Hazards on the ground.
      const z = game.zones;
      for (let i = 0; i < z.count; i++) {
        if (!z.hostile[i]) continue;
        const dx = z.x[i] - p.x;
        const dz = z.z[i] - p.z;
        const dist = Math.hypot(dx, dz);
        const reach = z.radius[i] + 1.5;
        if (dist > reach || dist < 1e-3) continue;
        const align = (dx / dist) * cx + (dz / dist) * cz;
        score -= Math.max(0, align) * z.dps[i] * this.weights.hazard * 0.05;
      }

      // Fish pull, scaled down so greed never overrides survival.
      const g = game.gems;
      for (let i = 0; i < g.count; i++) {
        const dx = g.x[i] - p.x;
        const dz = g.z[i] - p.z;
        const dist = Math.hypot(dx, dz);
        if (dist > GEM_AWARENESS || dist < 1e-3) continue;
        const align = (dx / dist) * cx + (dz / dist) * cz;
        score += (Math.max(0, align) * g.value[i] * this.weights.greed) / (dist + 2);
      }

      score += (cx * this.dirX + cz * this.dirZ) * this.weights.momentum;

      if (score > best) {
        best = score;
        bestX = cx;
        bestZ = cz;
      }
    }

    this.threat = threat;
    this.dirX = bestX;
    this.dirZ = bestZ;
    return { x: bestX, z: bestZ };
  }

  /** Picks a level-up card: fill weapon slots first, then scale what is held. */
  pickUpgrade(game: Game, options: UpgradeOption[]): UpgradeOption {
    let best = options[0];
    let bestScore = -Infinity;

    for (const option of options) {
      let score: number;
      if (option.kind === 'weapon') {
        const id = option.id.slice('weapon-'.length);
        const level = game.weaponLevel(id as never);
        // Breadth first, but only up to three weapons: past that, a wide
        // spread of level-1 weapons loses to a focused build.
        score = level === 0 ? (game.weapons.length < 3 ? 96 : 40) : 74 - level * 2;
      } else {
        const id = option.id.slice('passive-'.length);
        score = PASSIVE_SCORE[id] ?? 20;
        if (id === 'hp' && game.player.hp / game.player.maxHp < 0.5) score += 40;
        if (id === 'regen' && game.player.regen === 0) score += 15;
      }
      // Small deterministic jitter breaks ties without making runs unrepeatable.
      score += game.rng.next() * 4;
      if (score > bestScore) {
        bestScore = score;
        best = option;
      }
    }
    return best;
  }
}
