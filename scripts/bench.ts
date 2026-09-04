/**
 * Headless balance harness: the autopilot plays N full runs with no renderer,
 * so a balance change can be judged in seconds instead of by hand.
 *
 *   npm run bench            5 runs, every weapon unlocked
 *   npm run bench -- 20      20 runs
 *   npm run bench -- 20 base only the three starting weapons
 */
import { AutoPilot } from '../src/ai/agent';
import { STEP } from '../src/core/loop';
import { CONFIG } from '../src/data/config';
import { rollUpgrades } from '../src/data/upgrades';
import { Game } from '../src/game';
import { emptyBonuses } from '../src/data/progression';
import { WEAPON_IDS } from '../src/weapons/registry';

interface RunResult {
  seed: number;
  time: number;
  level: number;
  kills: number;
  peakEnemies: number;
  worstStepMs: number;
  weapons: string;
}

const unlockAll = process.argv[3] !== 'base';

function playRun(seed: number): RunResult {
  const bonuses = emptyBonuses();
  if (unlockAll) bonuses.unlocked = [...WEAPON_IDS];
  const game = new Game(0xf2a153, seed, bonuses);
  const agent = new AutoPilot();
  const maxSteps = Math.ceil(CONFIG.runSeconds / STEP);
  let peakEnemies = 0;
  let worstStepMs = 0;

  for (let i = 0; i < maxSteps; i++) {
    game.input = agent.direction(game);
    const t = performance.now();
    game.step(STEP);
    worstStepMs = Math.max(worstStepMs, performance.now() - t);
    peakEnemies = Math.max(peakEnemies, game.enemies.count);

    while (game.pendingLevelUps > 0) {
      game.pendingLevelUps--;
      const options = rollUpgrades(game);
      if (options.length) agent.pickUpgrade(game, options).apply(game);
    }
    if (game.over) break;
  }

  return {
    seed,
    time: game.time,
    level: game.level,
    kills: game.kills,
    peakEnemies,
    worstStepMs,
    weapons: game.weapons.map((w) => `${w.def.id}:${w.level}`).join(' '),
  };
}

function mmss(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

const runs = Number(process.argv[2] ?? 5);
const results: RunResult[] = [];
const wall = Date.now();

for (let n = 0; n < runs; n++) {
  const r = playRun(1000 + n * 7);
  results.push(r);
  console.log(
    `seed ${String(r.seed).padEnd(5)} ${mmss(r.time).padStart(5)}  Lv.${String(r.level).padEnd(3)}` +
      ` kills ${String(r.kills).padEnd(6)} peak ${String(r.peakEnemies).padEnd(4)}` +
      ` step ${r.worstStepMs.toFixed(2)}ms  ${r.weapons}`,
  );
}

const avg = (pick: (r: RunResult) => number) => results.reduce((a, r) => a + pick(r), 0) / results.length;
const survivals = results.filter((r) => r.time >= CONFIG.runSeconds - 0.5).length;

console.log('-'.repeat(72));
console.log(unlockAll ? 'weapons: all unlocked' : 'weapons: base three only');
console.log(
  `runs ${runs}  survived ${survivals}/${runs}  avg ${mmss(avg((r) => r.time))}` +
    `  avg Lv.${avg((r) => r.level).toFixed(1)}  avg kills ${Math.round(avg((r) => r.kills))}` +
    `  worst step ${Math.max(...results.map((r) => r.worstStepMs)).toFixed(2)}ms` +
    `  wall ${((Date.now() - wall) / 1000).toFixed(1)}s`,
);
