import type { WeaponId } from '../weapons/types';

/**
 * Meta progression: what catnip buys between runs.
 *
 * The shop sells repeatable stat levels; the skill tree sells one-time nodes
 * that gate the three advanced weapons behind a branch choice.
 */

export interface Bonuses {
  maxHp: number;
  speedMul: number;
  damageMul: number;
  cooldownMul: number;
  areaMul: number;
  pickupMul: number;
  crit: number;
  regen: number;
  /** Extra lives: death restores half HP instead of ending the run. */
  revives: number;
  catnipMul: number;
  unlocked: WeaponId[];
}

/** Weapons available before any skill tree node is bought. */
export const BASE_WEAPONS: WeaponId[] = ['claw', 'hairball', 'yarn'];

export function emptyBonuses(): Bonuses {
  return {
    maxHp: 0,
    speedMul: 1,
    damageMul: 1,
    cooldownMul: 1,
    areaMul: 1,
    pickupMul: 1,
    crit: 0,
    regen: 0,
    revives: 0,
    catnipMul: 1,
    unlocked: [...BASE_WEAPONS],
  };
}

// ------------------------------------------------------------------- shop

export interface ShopItem {
  id: string;
  name: string;
  jp: string;
  desc: string;
  max: number;
  /** Cost of the next level, given how many are already owned. */
  cost(level: number): number;
  apply(b: Bonuses): void;
}

export const SHOP_ITEMS: ShopItem[] = [
  {
    id: 'hp',
    name: 'Stout Body',
    jp: '体力',
    desc: 'HP สูงสุด +12 ต่อระดับ',
    max: 8,
    cost: (l) => 20 * (l + 1),
    apply: (b) => {
      b.maxHp += 12;
    },
  },
  {
    id: 'speed',
    name: 'Light Step',
    jp: '疾走',
    desc: 'ความเร็ววิ่ง +4% ต่อระดับ',
    max: 6,
    cost: (l) => 25 * (l + 1),
    apply: (b) => {
      b.speedMul *= 1.04;
    },
  },
  {
    id: 'damage',
    name: 'Honed Fang',
    jp: '牙',
    desc: 'ดาเมจ +5% ต่อระดับ',
    max: 8,
    cost: (l) => 30 * (l + 1),
    apply: (b) => {
      b.damageMul *= 1.05;
    },
  },
  {
    id: 'magnet',
    name: 'Nose for Fish',
    jp: '魚感',
    desc: 'ระยะดูดปลาแห้ง +12% ต่อระดับ',
    max: 5,
    cost: (l) => 18 * (l + 1),
    apply: (b) => {
      b.pickupMul *= 1.12;
    },
  },
  {
    id: 'crit',
    name: 'Lucky Paw',
    jp: '幸運',
    desc: 'คริติคอล +2% ต่อระดับ',
    max: 5,
    cost: (l) => 28 * (l + 1),
    apply: (b) => {
      b.crit += 0.02;
    },
  },
  {
    id: 'catnip',
    name: 'Fortune Cat',
    jp: '招福',
    desc: 'ได้แคทนิปท้ายรัน +10% ต่อระดับ',
    max: 5,
    cost: (l) => 35 * (l + 1),
    apply: (b) => {
      b.catnipMul *= 1.1;
    },
  },
];

// ------------------------------------------------------------- skill tree

export type TreeBranch = 'claw' | 'arts' | 'life';

export interface TreeNode {
  id: string;
  branch: TreeBranch;
  name: string;
  jp: string;
  desc: string;
  cost: number;
  /** Node ids that must be owned first. */
  requires: string[];
  apply(b: Bonuses): void;
}

export const BRANCH_LABEL: Record<TreeBranch, string> = {
  claw: '爪 — สายเล็บ',
  arts: '術 — สายเวทย์',
  life: '命 — สายชีวิต',
};

export const TREE_NODES: TreeNode[] = [
  // 爪 — melee damage, opens the boomerang.
  {
    id: 'claw_mastery',
    branch: 'claw',
    name: 'Claw Mastery',
    jp: '爪術',
    desc: 'ดาเมจ +8%',
    cost: 40,
    requires: [],
    apply: (b) => {
      b.damageMul *= 1.08;
    },
  },
  {
    id: 'unlock_fish',
    branch: 'claw',
    name: 'Unlock: Fish Boomerang',
    jp: '魚投',
    desc: 'ปลดล็อกอาวุธ 魚投 ในทุกรัน',
    cost: 60,
    requires: ['claw_mastery'],
    apply: (b) => {
      b.unlocked.push('fish');
    },
  },
  {
    id: 'frenzy',
    branch: 'claw',
    name: 'Frenzy',
    jp: '狂爪',
    desc: 'ดาเมจ +10% และคูลดาวน์ -5%',
    cost: 90,
    requires: ['unlock_fish'],
    apply: (b) => {
      b.damageMul *= 1.1;
      b.cooldownMul *= 0.95;
    },
  },

  // 術 — cooldown and area, opens lightning and fire.
  {
    id: 'arts_basics',
    branch: 'arts',
    name: 'Fox Arts',
    jp: '狐術',
    desc: 'คูลดาวน์ -5%',
    cost: 40,
    requires: [],
    apply: (b) => {
      b.cooldownMul *= 0.95;
    },
  },
  {
    id: 'unlock_kaminari',
    branch: 'arts',
    name: 'Unlock: Kaminari',
    jp: '雷鳴',
    desc: 'ปลดล็อกอาวุธ 雷鳴 ในทุกรัน',
    cost: 60,
    requires: ['arts_basics'],
    apply: (b) => {
      b.unlocked.push('kaminari');
    },
  },
  {
    id: 'unlock_ember',
    branch: 'arts',
    name: 'Unlock: Ember Trail',
    jp: '狐火',
    desc: 'ปลดล็อกอาวุธ 狐火 ในทุกรัน',
    cost: 70,
    requires: ['arts_basics'],
    apply: (b) => {
      b.unlocked.push('ember');
    },
  },
  {
    id: 'overflow',
    branch: 'arts',
    name: 'Overflow',
    jp: '溢術',
    desc: 'ขอบเขตโจมตี +8%',
    cost: 90,
    requires: ['unlock_kaminari'],
    apply: (b) => {
      b.areaMul *= 1.08;
    },
  },

  // 命 — survivability, ends in an extra life.
  {
    id: 'tough',
    branch: 'life',
    name: 'Thick Fur',
    jp: '厚毛',
    desc: 'HP สูงสุด +15',
    cost: 40,
    requires: [],
    apply: (b) => {
      b.maxHp += 15;
    },
  },
  {
    id: 'nap',
    branch: 'life',
    name: 'Cat Nap',
    jp: '昼寝',
    desc: 'ฟื้น HP 0.4 ต่อวินาที',
    cost: 80,
    requires: ['tough'],
    apply: (b) => {
      b.regen += 0.4;
    },
  },
  {
    id: 'ninth_life',
    branch: 'life',
    name: 'Ninth Life',
    jp: '九生',
    desc: 'ฟื้นชีพ 1 ครั้งต่อรัน (HP ครึ่งเดียว)',
    cost: 120,
    requires: ['nap'],
    apply: (b) => {
      b.revives += 1;
    },
  },
];

/** Folds owned shop levels and tree nodes into the run's starting bonuses. */
export function computeBonuses(shop: Record<string, number>, tree: string[]): Bonuses {
  const b = emptyBonuses();
  for (const item of SHOP_ITEMS) {
    const level = shop[item.id] ?? 0;
    for (let i = 0; i < Math.min(level, item.max); i++) item.apply(b);
  }
  // Tree order matters only for `unlocked`, and duplicates are filtered below.
  for (const node of TREE_NODES) {
    if (tree.includes(node.id)) node.apply(b);
  }
  b.unlocked = [...new Set(b.unlocked)];
  return b;
}

export function nodeAvailable(node: TreeNode, owned: string[]): boolean {
  return node.requires.every((r) => owned.includes(r));
}
