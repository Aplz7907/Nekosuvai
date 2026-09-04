import { BOSS_KINDS, ENEMIES, type EnemyKind } from '../data/enemies';
import {
  BRANCH_LABEL,
  SHOP_ITEMS,
  TREE_NODES,
  nodeAvailable,
  type TreeBranch,
} from '../data/progression';
import { KIND_INDEX } from '../ecs/entities';
import type { UpgradeOption } from '../data/upgrades';
import type { Game } from '../game';
import { buyShopItem, buyTreeNode, loadMeta, runPayout, type Meta } from '../meta';

export const FUR_PRESETS: { name: string; hex: number }[] = [
  { name: 'ส้ม (三毛)', hex: 0xf2a153 },
  { name: 'ดำ (黒猫)', hex: 0x4a4550 },
  { name: 'ขาว (白猫)', hex: 0xf5efe3 },
  { name: 'เทา (灰猫)', hex: 0x9aa4b0 },
  { name: 'สยาม (暹羅)', hex: 0xdcc4a0 },
  { name: 'ครีม (茶虎)', hex: 0xc98b5e },
];

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  html?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (html !== undefined) node.innerHTML = html;
  return node;
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export class UI {
  private readonly root = document.getElementById('ui')!;
  private readonly hud: HTMLElement;
  private readonly hpFill: HTMLElement;
  private readonly xpFill: HTMLElement;
  private readonly clock: HTMLElement;
  private readonly stats: HTMLElement;
  private readonly weapons: HTMLElement;
  private readonly bossBar: HTMLElement;
  private readonly bossFill: HTMLElement;
  private readonly agentBadge: HTMLElement;
  private screen: HTMLElement | null = null;

  constructor() {
    this.hud = el('div');
    this.hud.id = 'hud';
    this.hud.innerHTML = `
      <div class="bar" id="xpBar"><i></i></div>
      <div class="hudRow">
        <div class="bar" id="hpBar"><i></i></div>
        <span id="lvl">Lv.1</span>
        <span id="revives"></span>
      </div>
      <div id="clock">0:00</div>
      <div id="stats"></div>
      <div id="weapons"></div>
      <div id="agentBadge">AI 自動操縦 — autopilot</div>
      <div id="bossBar">
        <div class="bossName">大狸 <span class="pips"></span></div>
        <div class="bar"><i></i></div>
      </div>
    `;
    this.root.appendChild(this.hud);

    this.hpFill = this.hud.querySelector('#hpBar > i')!;
    this.xpFill = this.hud.querySelector('#xpBar > i')!;
    this.clock = this.hud.querySelector('#clock')!;
    this.stats = this.hud.querySelector('#stats')!;
    this.weapons = this.hud.querySelector('#weapons')!;
    this.bossBar = this.hud.querySelector('#bossBar')!;
    this.bossFill = this.hud.querySelector('#bossBar .bar > i')!;
    this.agentBadge = this.hud.querySelector('#agentBadge')!;
  }

  private show(node: HTMLElement): void {
    this.clearScreen();
    this.screen = node;
    this.root.appendChild(node);
  }

  clearScreen(): void {
    this.screen?.remove();
    this.screen = null;
  }

  setHudVisible(on: boolean): void {
    this.hud.classList.toggle('on', on);
  }

  setAgentBadge(on: boolean): void {
    this.agentBadge.classList.toggle('on', on);
  }

  // ------------------------------------------------------------ title screen

  showTitle(handlers: { onStart: (fur: number) => void; onShop: () => void; onTree: () => void }): void {
    const meta = loadMeta();
    let selected = meta.lastFur;
    const screen = el('div', 'screen');

    screen.appendChild(el('h1', 'title', 'ネコスヴァイ'));
    screen.appendChild(el('div', 'subtitle', 'N E K O S U V A I'));

    const panel = el('div', 'panel');
    panel.appendChild(el('div', 'name', 'เลือกสีขนแมว'));
    const swatches = el('div', 'swatches');

    const custom = el('input');
    custom.type = 'color';
    custom.value = `#${meta.lastFur.toString(16).padStart(6, '0')}`;
    custom.className = 'swatch';

    const select = (hex: number, node: HTMLElement) => {
      selected = hex;
      swatches.querySelectorAll('.swatch').forEach((s) => s.classList.remove('selected'));
      node.classList.add('selected');
    };

    for (const preset of FUR_PRESETS) {
      const sw = el('div', 'swatch');
      sw.style.background = `#${preset.hex.toString(16).padStart(6, '0')}`;
      sw.title = preset.name;
      sw.onclick = () => select(preset.hex, sw);
      swatches.appendChild(sw);
    }
    custom.oninput = () => select(parseInt(custom.value.slice(1), 16), custom);
    swatches.appendChild(custom);
    (swatches.firstElementChild as HTMLElement).classList.add('selected');
    selected = FUR_PRESETS[0].hex;
    panel.appendChild(swatches);

    panel.appendChild(
      el(
        'div',
        'desc',
        `เดินด้วย <b>WASD</b> / ลูกศร / ลากนิ้ว &nbsp;·&nbsp; อาวุธยิงเอง<br>
         <b>B</b> = AI autopilot &nbsp;·&nbsp; <b>M</b> = เปิด/ปิดเสียง<br>
         เวลาสูงสุด: <b>${formatTime(meta.bestTime)}</b> &nbsp;·&nbsp; แคทนิป: <b>${meta.catnip} 🌿</b>`,
      ),
    );
    screen.appendChild(panel);

    const row = el('div', 'btnRow');
    const start = el('button', 'btn', '始める — เริ่มเกม');
    start.onclick = () => {
      this.clearScreen();
      handlers.onStart(selected);
    };
    const shop = el('button', 'btn ghost', '店 — ร้านค้า');
    shop.onclick = handlers.onShop;
    const tree = el('button', 'btn ghost', '技能樹 — สกิลทรี');
    tree.onclick = handlers.onTree;
    row.append(start, shop, tree);
    screen.appendChild(row);

    this.show(screen);
  }

  // -------------------------------------------------------------------- shop

  showShop(onBack: () => void): void {
    const render = () => {
      const meta = loadMeta();
      const screen = el('div', 'screen');
      screen.appendChild(el('h1', 'title', '店'));
      screen.appendChild(el('div', 'subtitle', `CATNIP SHOP — มี ${meta.catnip} 🌿`));

      const list = el('div', 'shopList');
      for (const item of SHOP_ITEMS) {
        const level = meta.shop[item.id] ?? 0;
        const maxed = level >= item.max;
        const price = maxed ? 0 : item.cost(level);
        const affordable = !maxed && meta.catnip >= price;

        const row = el('div', `shopRow${affordable ? '' : ' dim'}`);
        row.innerHTML = `
          <div class="jp">${item.jp}</div>
          <div class="grow">
            <div class="name">${item.name} <span class="lvl">${level}/${item.max}</span></div>
            <div class="desc">${item.desc}</div>
          </div>
          <div class="price">${maxed ? 'MAX' : `${price} 🌿`}</div>`;
        if (affordable) {
          row.onclick = () => {
            if (buyShopItem(meta, item.id)) render();
          };
        }
        list.appendChild(row);
      }
      screen.appendChild(list);

      const back = el('button', 'btn', '戻る — กลับ');
      back.onclick = () => {
        this.clearScreen();
        onBack();
      };
      screen.appendChild(back);
      this.show(screen);
    };
    render();
  }

  // -------------------------------------------------------------- skill tree

  showTree(onBack: () => void): void {
    const render = () => {
      const meta: Meta = loadMeta();
      const screen = el('div', 'screen');
      screen.appendChild(el('h1', 'title', '技能樹'));
      screen.appendChild(el('div', 'subtitle', `SKILL TREE — มี ${meta.catnip} 🌿`));

      const branches = el('div', 'branches');
      for (const branch of ['claw', 'arts', 'life'] as TreeBranch[]) {
        const col = el('div', 'branch');
        col.appendChild(el('div', 'branchName', BRANCH_LABEL[branch]));
        for (const node of TREE_NODES.filter((n) => n.branch === branch)) {
          const owned = meta.tree.includes(node.id);
          const open = nodeAvailable(node, meta.tree);
          const affordable = !owned && open && meta.catnip >= node.cost;
          const state = owned ? 'owned' : open ? (affordable ? 'open' : 'poor') : 'locked';

          const card = el('div', `node ${state}`);
          card.innerHTML = `
            <div class="jp">${node.jp}</div>
            <div class="name">${node.name}</div>
            <div class="desc">${node.desc}</div>
            <div class="price">${owned ? '取得済 ✓' : `${node.cost} 🌿`}</div>`;
          if (affordable) {
            card.onclick = () => {
              if (buyTreeNode(meta, node.id)) render();
            };
          }
          col.appendChild(card);
        }
        branches.appendChild(col);
      }
      screen.appendChild(branches);

      const back = el('button', 'btn', '戻る — กลับ');
      back.onclick = () => {
        this.clearScreen();
        onBack();
      };
      screen.appendChild(back);
      this.show(screen);
    };
    render();
  }

  // ------------------------------------------------------------- level up

  showLevelUp(game: Game, options: UpgradeOption[], onPick: (o: UpgradeOption) => void): void {
    const screen = el('div', 'screen');
    screen.appendChild(el('h1', 'title', `Lv.${game.level}`));
    screen.appendChild(el('div', 'subtitle', 'LEVEL UP — เลือก 1'));

    const cards = el('div', 'cards');
    for (const option of options) {
      const card = el('div', `card ${option.kind}`);
      card.appendChild(el('div', 'jp', option.jp));
      card.appendChild(el('div', 'name', option.name));
      card.appendChild(el('div', 'desc', option.desc));
      card.onclick = () => {
        this.clearScreen();
        onPick(option);
      };
      cards.appendChild(card);
    }
    screen.appendChild(cards);
    screen.appendChild(el('div', 'hint', 'กด 1 / 2 / 3 เพื่อเลือกด้วยคีย์บอร์ด'));
    this.show(screen);

    const onKey = (ev: KeyboardEvent) => {
      const idx = ['1', '2', '3'].indexOf(ev.key);
      if (idx >= 0 && idx < options.length) {
        removeEventListener('keydown', onKey);
        this.clearScreen();
        onPick(options[idx]);
      }
    };
    addEventListener('keydown', onKey);
  }

  // ------------------------------------------------------------ game over

  showGameOver(game: Game, onRestart: () => void): void {
    const survived = game.player.hp > 0;
    const meta = loadMeta();
    const screen = el('div', 'screen');
    screen.appendChild(el('h1', 'title', survived ? '生還' : '力尽きた'));
    screen.appendChild(el('div', 'subtitle', survived ? 'SURVIVED' : 'GAME OVER'));

    const panel = el('div', 'panel');
    panel.innerHTML = `
      <div class="desc">
        รอดได้ <b>${formatTime(game.time)}</b><br>
        เลเวล <b>${game.level}</b> &nbsp;·&nbsp; ฆ่า <b>${game.kills}</b> ตัว<br>
        อาวุธ: <b>${game.weapons.map((w) => `${w.def.jp} Lv.${w.level}`).join(' / ')}</b><br>
        ได้แคทนิป <b>+${runPayout(meta, game.kills, game.level)} 🌿</b> (รวม ${meta.catnip})
      </div>`;
    screen.appendChild(panel);

    const btn = el('button', 'btn', 'もう一度 — เล่นอีกครั้ง');
    btn.onclick = () => {
      this.clearScreen();
      onRestart();
    };
    screen.appendChild(btn);
    this.show(screen);
  }

  // ------------------------------------------------------------------- hud

  update(game: Game): void {
    const p = game.player;
    this.hpFill.style.width = `${(p.hp / p.maxHp) * 100}%`;
    this.xpFill.style.width = `${(game.xp / game.xpNeeded) * 100}%`;
    this.clock.textContent = formatTime(game.time);
    (this.hud.querySelector('#lvl') as HTMLElement).textContent = `Lv.${game.level}`;
    (this.hud.querySelector('#revives') as HTMLElement).textContent =
      game.revives > 0 ? `九生 ×${game.revives}` : '';
    this.stats.innerHTML = `撃破 ${game.kills}<br>敵 ${game.enemies.count}`;

    this.weapons.innerHTML = game.weapons
      .map((w) => `<div class="wchip">${w.def.jp} <b>Lv.${w.level}</b></div>`)
      .join('');

    // Boss bar tracks the first live boss in the pool.
    let boss = -1;
    let bossKind: EnemyKind = 'boss';
    for (let i = 0; i < game.enemies.count; i++) {
      const found = BOSS_KINDS.find((k) => KIND_INDEX[k] === game.enemies.kind[i]);
      if (found) {
        boss = i;
        bossKind = found;
        break;
      }
    }
    this.bossBar.classList.toggle('on', boss >= 0);
    if (boss >= 0) {
      this.bossFill.style.width = `${(game.enemies.hp[boss] / game.enemies.maxHp[boss]) * 100}%`;
      const phase = game.enemies.phase[boss];
      (this.bossBar.querySelector('.bossName') as HTMLElement).innerHTML =
        `${ENEMIES[bossKind].label} <span class="pips">${'◆'.repeat(phase + 1)}${'◇'.repeat(2 - phase)}</span>`;
    }
  }
}
