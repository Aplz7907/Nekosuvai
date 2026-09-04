import type { Game } from '../game';
import { MAX_WEAPON_SLOTS } from '../ecs/entities';
import { WEAPON_IDS, WEAPONS } from '../weapons/registry';

export interface UpgradeOption {
  id: string;
  name: string;
  jp: string;
  desc: string;
  /** 'weapon' cards are tinted differently from passives in the level-up UI. */
  kind: 'weapon' | 'passive';
  apply(game: Game): void;
}

interface PassiveDef {
  id: string;
  name: string;
  jp: string;
  desc: string;
  max: number;
  apply(game: Game): void;
}

const PASSIVES: PassiveDef[] = [
  {
    id: 'speed',
    name: 'Swift Paws',
    jp: '疾足',
    desc: 'ความเร็ววิ่ง +12%',
    max: 5,
    apply: (g) => {
      g.player.speed *= 1.12;
    },
  },
  {
    id: 'hp',
    name: 'Nine Lives',
    jp: '九命',
    desc: 'HP สูงสุด +25 และฟื้นเท่ากัน',
    max: 5,
    apply: (g) => {
      g.player.maxHp += 25;
      g.player.hp = Math.min(g.player.maxHp, g.player.hp + 25);
    },
  },
  {
    id: 'cooldown',
    name: 'Quick Reflex',
    jp: '早業',
    desc: 'คูลดาวน์อาวุธ -10%',
    max: 5,
    apply: (g) => {
      g.player.cooldownMul *= 0.9;
    },
  },
  {
    id: 'area',
    name: 'Long Whiskers',
    jp: '長髭',
    desc: 'ขอบเขตโจมตี +12%',
    max: 5,
    apply: (g) => {
      g.player.areaMul *= 1.12;
    },
  },
  {
    id: 'damage',
    name: 'Sharp Fang',
    jp: '鋭牙',
    desc: 'ดาเมจทุกอาวุธ +15%',
    max: 6,
    apply: (g) => {
      g.player.damageMul *= 1.15;
    },
  },
  {
    id: 'magnet',
    name: 'Fish Sense',
    jp: '魚感',
    desc: 'ระยะดูดปลาแห้ง +45%',
    max: 4,
    apply: (g) => {
      g.player.pickupRadius *= 1.45;
    },
  },
  {
    id: 'crit',
    name: 'Hunter Eye',
    jp: '猟眼',
    desc: 'โอกาสคริติคอล +6%',
    max: 5,
    apply: (g) => {
      g.player.crit = Math.min(0.85, g.player.crit + 0.06);
    },
  },
  {
    id: 'regen',
    name: 'Sunny Nap',
    jp: '日向寝',
    desc: 'ฟื้น HP 0.6 ต่อวินาที',
    max: 4,
    apply: (g) => {
      g.player.regen += 0.6;
    },
  },
];

/** Three distinct offers, weighted toward weapons early so builds come online fast. */
export function rollUpgrades(game: Game, count = 3): UpgradeOption[] {
  const pool: UpgradeOption[] = [];

  for (const id of WEAPON_IDS) {
    // Advanced weapons stay out of the pool until the skill tree unlocks them.
    if (!game.unlocked.has(id)) continue;
    const def = WEAPONS[id];
    const level = game.weaponLevel(id);
    if (level === 0) {
      if (game.weapons.length >= MAX_WEAPON_SLOTS) continue;
      pool.push({
        id: `weapon-${id}`,
        name: `${def.name} — ใหม่`,
        jp: def.jp,
        desc: def.desc,
        kind: 'weapon',
        apply: (g) => g.addWeapon(id),
      });
    } else if (level < def.maxLevel) {
      pool.push({
        id: `weapon-${id}`,
        name: `${def.name} Lv.${level + 1}`,
        jp: def.jp,
        desc: level + 1 === def.maxLevel ? 'ร่างสมบูรณ์! พลังสูงสุด' : def.desc,
        kind: 'weapon',
        apply: (g) => g.addWeapon(id),
      });
    }
  }

  for (const p of PASSIVES) {
    const stacks = game.passives.get(p.id) ?? 0;
    if (stacks >= p.max) continue;
    pool.push({
      id: `passive-${p.id}`,
      name: `${p.name} ${stacks + 1}/${p.max}`,
      jp: p.jp,
      desc: p.desc,
      kind: 'passive',
      apply: (g) => {
        p.apply(g);
        g.passives.set(p.id, (g.passives.get(p.id) ?? 0) + 1);
      },
    });
  }

  const picked: UpgradeOption[] = [];
  while (picked.length < count && pool.length > 0) {
    picked.push(pool.splice(game.rng.int(pool.length), 1)[0]);
  }
  return picked;
}
