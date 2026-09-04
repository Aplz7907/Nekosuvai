import { SHOP_ITEMS, TREE_NODES, computeBonuses, nodeAvailable, type Bonuses } from './data/progression';

const KEY = 'nekosuvai.meta.v2';

export interface Meta {
  /** Longest run in seconds. */
  bestTime: number;
  /** Persistent currency earned from runs. */
  catnip: number;
  runs: number;
  lastFur: number;
  muted: boolean;
  /** Shop item id to owned level. */
  shop: Record<string, number>;
  /** Owned skill tree node ids. */
  tree: string[];
}

const DEFAULT_META: Meta = {
  bestTime: 0,
  catnip: 0,
  runs: 0,
  lastFur: 0xf2a153,
  muted: false,
  shop: {},
  tree: [],
};

export function loadMeta(): Meta {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_META, shop: {}, tree: [] };
    const parsed = JSON.parse(raw) as Partial<Meta>;
    return {
      ...DEFAULT_META,
      ...parsed,
      shop: { ...(parsed.shop ?? {}) },
      tree: [...(parsed.tree ?? [])],
    };
  } catch {
    // Private windows and blocked site data both land here.
    return { ...DEFAULT_META, shop: {}, tree: [] };
  }
}

export function saveMeta(meta: Meta): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(meta));
  } catch {
    /* progression is a nicety, not a requirement */
  }
}

export function bonusesFor(meta: Meta): Bonuses {
  return computeBonuses(meta.shop, meta.tree);
}

/** Folds one finished run into the stored meta progression. Returns it saved. */
export function recordRun(time: number, kills: number, level: number, fur: number): Meta {
  const meta = loadMeta();
  const earned = Math.floor((Math.floor(kills / 10) + level * 2) * bonusesFor(meta).catnipMul);
  meta.bestTime = Math.max(meta.bestTime, time);
  meta.catnip += earned;
  meta.runs += 1;
  meta.lastFur = fur;
  saveMeta(meta);
  return meta;
}

/** Catnip a finished run would pay out, for showing on the end screen. */
export function runPayout(meta: Meta, kills: number, level: number): number {
  return Math.floor((Math.floor(kills / 10) + level * 2) * bonusesFor(meta).catnipMul);
}

export function buyShopItem(meta: Meta, id: string): boolean {
  const item = SHOP_ITEMS.find((s) => s.id === id);
  if (!item) return false;
  const level = meta.shop[id] ?? 0;
  if (level >= item.max) return false;
  const price = item.cost(level);
  if (meta.catnip < price) return false;
  meta.catnip -= price;
  meta.shop[id] = level + 1;
  saveMeta(meta);
  return true;
}

export function buyTreeNode(meta: Meta, id: string): boolean {
  const node = TREE_NODES.find((n) => n.id === id);
  if (!node || meta.tree.includes(id)) return false;
  if (!nodeAvailable(node, meta.tree)) return false;
  if (meta.catnip < node.cost) return false;
  meta.catnip -= node.cost;
  meta.tree.push(id);
  saveMeta(meta);
  return true;
}

export function setMuted(muted: boolean): void {
  const meta = loadMeta();
  meta.muted = muted;
  saveMeta(meta);
}
