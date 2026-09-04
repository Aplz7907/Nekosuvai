export type EnemyKind =
  | 'nezumi'
  | 'inu'
  | 'karasu'
  | 'tanuki'
  | 'hebi'
  | 'kaeru'
  | 'hachi'
  | 'inoshishi'
  | 'boss'
  | 'bossInu';

export type EnemyBehavior = 'seek' | 'strafe' | 'charge' | 'hop' | 'trail' | 'summon';

export interface EnemyDef {
  kind: EnemyKind;
  /** Japanese label shown in the boss banner. */
  label: string;
  hp: number;
  speed: number;
  radius: number;
  damage: number;
  xp: number;
  /** Sprite world height in units. */
  size: number;
  /** Extra behaviour on top of seek + separation. */
  behavior: EnemyBehavior;
}

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  nezumi: { kind: 'nezumi', label: '鼠', hp: 8, speed: 3.4, radius: 0.32, damage: 4, xp: 1, size: 0.7, behavior: 'seek' },
  inu: { kind: 'inu', label: '犬', hp: 46, speed: 1.9, radius: 0.6, damage: 12, xp: 5, size: 1.25, behavior: 'seek' },
  karasu: { kind: 'karasu', label: '烏', hp: 18, speed: 3.0, radius: 0.44, damage: 8, xp: 3, size: 0.95, behavior: 'strafe' },
  tanuki: { kind: 'tanuki', label: '狸', hp: 74, speed: 1.5, radius: 0.7, damage: 16, xp: 8, size: 1.35, behavior: 'charge' },
  hebi: { kind: 'hebi', label: '蛇', hp: 34, speed: 1.7, radius: 0.5, damage: 9, xp: 6, size: 1.0, behavior: 'trail' },
  kaeru: { kind: 'kaeru', label: '蛙', hp: 26, speed: 2.2, radius: 0.48, damage: 10, xp: 4, size: 0.9, behavior: 'hop' },
  hachi: { kind: 'hachi', label: '蜂', hp: 12, speed: 4.6, radius: 0.3, damage: 6, xp: 3, size: 0.65, behavior: 'strafe' },
  inoshishi: { kind: 'inoshishi', label: '猪', hp: 130, speed: 1.6, radius: 0.85, damage: 22, xp: 14, size: 1.7, behavior: 'charge' },
  boss: { kind: 'boss', label: '大狸', hp: 1500, speed: 1.7, radius: 1.8, damage: 26, xp: 120, size: 3.4, behavior: 'charge' },
  bossInu: { kind: 'bossInu', label: '番犬大将', hp: 2200, speed: 1.5, radius: 2.0, damage: 30, xp: 160, size: 3.6, behavior: 'summon' },
};

export const BOSS_KINDS: EnemyKind[] = ['boss', 'bossInu'];

export interface WaveEntry {
  /** Seconds into the run when this entry becomes active. */
  at: number;
  kind: EnemyKind;
  /** Spawns per second. */
  rate: number;
}

export const WAVES: WaveEntry[] = [
  { at: 0, kind: 'nezumi', rate: 1.2 },
  { at: 45, kind: 'nezumi', rate: 2.2 },
  { at: 60, kind: 'inu', rate: 0.5 },
  { at: 90, kind: 'kaeru', rate: 0.6 },
  { at: 120, kind: 'karasu', rate: 0.8 },
  { at: 150, kind: 'nezumi', rate: 3.6 },
  { at: 170, kind: 'hebi', rate: 0.4 },
  { at: 180, kind: 'inu', rate: 1.1 },
  { at: 210, kind: 'hachi', rate: 1.2 },
  { at: 240, kind: 'tanuki', rate: 0.35 },
  { at: 270, kind: 'kaeru', rate: 1.2 },
  { at: 300, kind: 'karasu', rate: 1.6 },
  { at: 330, kind: 'hebi', rate: 0.9 },
  { at: 360, kind: 'inu', rate: 2.0 },
  { at: 390, kind: 'inoshishi', rate: 0.25 },
  { at: 420, kind: 'tanuki', rate: 0.8 },
  { at: 450, kind: 'hachi', rate: 2.4 },
  { at: 480, kind: 'nezumi', rate: 5.5 },
  { at: 540, kind: 'karasu', rate: 2.4 },
  { at: 600, kind: 'inoshishi', rate: 0.7 },
  { at: 660, kind: 'hebi', rate: 1.6 },
  { at: 720, kind: 'tanuki', rate: 1.4 },
  { at: 840, kind: 'inoshishi', rate: 1.2 },
  { at: 960, kind: 'inu', rate: 3.2 },
];

/** Boss appearances: time in seconds paired with which boss shows up. */
export const BOSS_SCHEDULE: { at: number; kind: EnemyKind }[] = [
  { at: 300, kind: 'boss' },
  { at: 600, kind: 'bossInu' },
  { at: 900, kind: 'boss' },
  { at: 1200, kind: 'bossInu' },
];

/** Enemy HP/damage multiplier as the run goes on. */
export function difficultyScale(time: number): number {
  return 1 + time / 200;
}
