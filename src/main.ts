import { AutoPilot } from './ai/agent';
import { Audio } from './audio/audio';
import { Loop } from './core/loop';
import { rollUpgrades } from './data/upgrades';
import { Game } from './game';
import { Input } from './input';
import { bonusesFor, loadMeta, recordRun, setMuted } from './meta';
import { View } from './render/view';
import { UI } from './ui/ui';

const canvas = document.getElementById('game') as HTMLCanvasElement;
const view = new View(canvas);
const ui = new UI();
const input = new Input(canvas);
const agent = new AutoPilot();
const audio = new Audio(loadMeta().muted);

let game: Game | null = null;
/** Set while a level-up or end screen owns the foreground. */
let paused = false;
let autoPlay = false;

addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'b' && game) {
    autoPlay = !autoPlay;
    ui.setAgentBadge(autoPlay);
  } else if (key === 'm') {
    audio.setMuted(!audio.muted);
    setMuted(audio.muted);
  }
});

const loop = new Loop(
  (dt) => {
    if (!game || paused) return;
    game.input = autoPlay ? agent.direction(game) : input.direction();
    game.step(dt);
    audio.setIntensity(game.bossActive ? 1 : 0);

    if (game.pendingLevelUps > 0) {
      game.pendingLevelUps--;
      openLevelUp(game);
    } else if (game.over) {
      endRun(game);
    }
  },
  () => {
    if (game) {
      view.render(game);
      ui.update(game);
    }
  },
);

function openLevelUp(current: Game): void {
  const options = rollUpgrades(current);
  if (options.length === 0) return; // everything is maxed
  paused = true;

  let resolved = false;
  const choose = (option: (typeof options)[number]) => {
    if (resolved) return;
    resolved = true;
    option.apply(current);
    paused = false;
  };

  ui.showLevelUp(current, options, choose);

  if (autoPlay) {
    // Show the cards briefly so an onlooker can see what the agent picked.
    setTimeout(() => {
      if (resolved) return;
      ui.clearScreen();
      choose(agent.pickUpgrade(current, options));
    }, 550);
  }
}

function endRun(current: Game): void {
  paused = true;
  audio.stopMusic();
  recordRun(current.time, current.kills, current.level, current.player.furColor);
  ui.showGameOver(current, () => {
    ui.setHudVisible(false);
    game = null;
    showTitle();
  });
}

function startRun(furColor: number): void {
  const meta = loadMeta();
  game = new Game(furColor, undefined, bonusesFor(meta));
  game.onEvent = (kind) => audio.play(kind);
  view.setFurColor(furColor);
  ui.setHudVisible(true);
  ui.setAgentBadge(autoPlay);
  paused = false;
  // Browsers only allow audio to start from a gesture — this runs on the click.
  audio.unlock();
  audio.startMusic();
}

function showTitle(): void {
  ui.showTitle({
    onStart: (furColor) => startRun(furColor),
    onShop: () => ui.showShop(showTitle),
    onTree: () => ui.showTree(showTitle),
  });
}

showTitle();
loop.start();
