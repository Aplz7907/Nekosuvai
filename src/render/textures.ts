import * as THREE from 'three';
import type { EnemyKind } from '../data/enemies';

/**
 * All art is generated at runtime so the scaffold runs with zero asset files.
 * Swap these functions for loaded atlases when real sprites exist — nothing
 * else in the renderer needs to change.
 */

const SIZE = 128;

function canvas(): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = SIZE;
  c.height = SIZE;
  const ctx = c.getContext('2d')!;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  return [c, ctx];
}

function toTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  return tex;
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number): void {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

/** Cat body in pure white — instance tint multiplies this into the chosen fur colour. */
export function catFurTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#ffffff';
  // tail
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(38, 92);
  ctx.quadraticCurveTo(14, 84, 20, 58);
  ctx.stroke();
  // body + head
  ellipse(ctx, 66, 88, 27, 24);
  ellipse(ctx, 66, 54, 25, 23);
  // ears
  ctx.beginPath();
  ctx.moveTo(46, 40);
  ctx.lineTo(50, 14);
  ctx.lineTo(68, 33);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(86, 40);
  ctx.lineTo(84, 14);
  ctx.lineTo(65, 33);
  ctx.closePath();
  ctx.fill();
  // paws
  ellipse(ctx, 54, 108, 9, 7);
  ellipse(ctx, 80, 108, 9, 7);
  return toTexture(c);
}

/** Outline, eyes and muzzle drawn on top of the tinted fur so they never shift hue. */
export function catDetailTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  // inner ears
  ctx.fillStyle = 'rgba(240,160,175,0.95)';
  ctx.beginPath();
  ctx.moveTo(51, 37);
  ctx.lineTo(53, 22);
  ctx.lineTo(64, 34);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(81, 37);
  ctx.lineTo(80, 22);
  ctx.lineTo(69, 34);
  ctx.closePath();
  ctx.fill();
  // eyes
  ctx.fillStyle = '#2b2118';
  ellipse(ctx, 57, 54, 4.2, 5.4);
  ellipse(ctx, 76, 54, 4.2, 5.4);
  ctx.fillStyle = '#ffffff';
  ellipse(ctx, 58.4, 52, 1.6, 1.8);
  ellipse(ctx, 77.4, 52, 1.6, 1.8);
  // nose + mouth
  ctx.fillStyle = '#e08a9a';
  ctx.beginPath();
  ctx.moveTo(63, 62);
  ctx.lineTo(70, 62);
  ctx.lineTo(66.5, 66);
  ctx.closePath();
  ctx.fill();
  // whiskers
  ctx.strokeStyle = 'rgba(45,35,28,0.55)';
  ctx.lineWidth = 1.6;
  for (const [x1, y1, x2, y2] of [
    [50, 62, 33, 58],
    [50, 65, 33, 67],
    [83, 62, 100, 58],
    [83, 65, 100, 67],
  ]) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  return toTexture(c);
}

const ENEMY_DRAW: Record<EnemyKind, (ctx: CanvasRenderingContext2D) => void> = {
  nezumi: (ctx) => {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(44, 92);
    ctx.quadraticCurveTo(18, 96, 22, 74);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 70, 84, 26, 20);
    ellipse(ctx, 68, 54, 20, 18);
    ellipse(ctx, 53, 40, 11, 11);
    ellipse(ctx, 84, 40, 11, 11);
    ctx.fillStyle = '#3a2c26';
    ellipse(ctx, 62, 54, 3.2, 3.6);
    ellipse(ctx, 76, 54, 3.2, 3.6);
    ctx.fillStyle = '#e58ba0';
    ellipse(ctx, 69, 64, 3, 2.4);
  },
  inu: (ctx) => {
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 64, 88, 33, 26);
    ellipse(ctx, 64, 48, 27, 24);
    // floppy ears
    ellipse(ctx, 40, 44, 9, 17);
    ellipse(ctx, 88, 44, 9, 17);
    ellipse(ctx, 64, 62, 15, 11);
    ctx.fillStyle = '#33261f';
    ellipse(ctx, 54, 44, 4.5, 5);
    ellipse(ctx, 74, 44, 4.5, 5);
    ellipse(ctx, 64, 58, 5, 4);
    ctx.strokeStyle = '#33261f';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(56, 68);
    ctx.quadraticCurveTo(64, 74, 72, 68);
    ctx.stroke();
  },
  karasu: (ctx) => {
    ctx.fillStyle = '#ffffff';
    // wings
    ctx.beginPath();
    ctx.moveTo(64, 62);
    ctx.lineTo(14, 44);
    ctx.lineTo(30, 74);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(64, 62);
    ctx.lineTo(114, 44);
    ctx.lineTo(98, 74);
    ctx.closePath();
    ctx.fill();
    ellipse(ctx, 64, 70, 20, 26);
    ellipse(ctx, 64, 40, 16, 15);
    ctx.fillStyle = '#f0c25a';
    ctx.beginPath();
    ctx.moveTo(64, 42);
    ctx.lineTo(64, 54);
    ctx.lineTo(84, 46);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#241d1a';
    ellipse(ctx, 58, 38, 3.4, 3.8);
  },
  tanuki: (ctx) => {
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 13;
    ctx.beginPath();
    ctx.moveTo(36, 94);
    ctx.quadraticCurveTo(12, 88, 18, 66);
    ctx.stroke();
    ellipse(ctx, 66, 88, 32, 27);
    ellipse(ctx, 66, 48, 26, 23);
    ellipse(ctx, 46, 28, 10, 9);
    ellipse(ctx, 86, 28, 10, 9);
    ctx.fillStyle = '#2f251f';
    // mask markings around the eyes
    ellipse(ctx, 55, 46, 9, 7);
    ellipse(ctx, 77, 46, 9, 7);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 55, 46, 3.4, 3.4);
    ellipse(ctx, 77, 46, 3.4, 3.4);
    ctx.fillStyle = '#2f251f';
    ellipse(ctx, 66, 60, 5, 4);
  },
  hebi: (ctx) => {
    // Coiled snake: an S-curve body reads clearly from the top-down camera.
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 18;
    ctx.beginPath();
    ctx.moveTo(24, 108);
    ctx.bezierCurveTo(70, 104, 20, 62, 62, 46);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 72, 40, 20, 16);
    ctx.fillStyle = '#2f2a24';
    ellipse(ctx, 66, 36, 3.6, 4);
    ellipse(ctx, 80, 36, 3.6, 4);
    ctx.strokeStyle = '#d0455c';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(88, 44);
    ctx.lineTo(106, 48);
    ctx.moveTo(106, 48);
    ctx.lineTo(114, 42);
    ctx.moveTo(106, 48);
    ctx.lineTo(114, 54);
    ctx.stroke();
  },
  kaeru: (ctx) => {
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 64, 84, 34, 26);
    ellipse(ctx, 64, 52, 28, 22);
    // hind legs folded for the leap
    ellipse(ctx, 30, 92, 12, 18);
    ellipse(ctx, 98, 92, 12, 18);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 48, 36, 12, 12);
    ellipse(ctx, 80, 36, 12, 12);
    ctx.fillStyle = '#26301f';
    ellipse(ctx, 48, 36, 5, 5);
    ellipse(ctx, 80, 36, 5, 5);
    ctx.strokeStyle = '#26301f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(46, 62);
    ctx.quadraticCurveTo(64, 74, 82, 62);
    ctx.stroke();
  },
  hachi: (ctx) => {
    // Blurred wings behind a striped body.
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ellipse(ctx, 40, 44, 22, 12);
    ellipse(ctx, 88, 44, 22, 12);
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 64, 70, 26, 22);
    ellipse(ctx, 64, 42, 17, 15);
    ctx.fillStyle = '#33291c';
    ctx.fillRect(44, 62, 40, 6);
    ctx.fillRect(46, 76, 36, 6);
    ellipse(ctx, 58, 40, 3.4, 3.8);
    ellipse(ctx, 70, 40, 3.4, 3.8);
    ctx.beginPath();
    ctx.moveTo(64, 92);
    ctx.lineTo(60, 106);
    ctx.lineTo(68, 106);
    ctx.closePath();
    ctx.fill();
  },
  inoshishi: (ctx) => {
    ctx.fillStyle = '#ffffff';
    ellipse(ctx, 62, 84, 40, 30);
    ellipse(ctx, 70, 48, 30, 25);
    // bristles along the spine
    ctx.beginPath();
    for (let i = 0; i < 6; i++) {
      ctx.moveTo(30 + i * 12, 58);
      ctx.lineTo(34 + i * 12, 40);
      ctx.lineTo(40 + i * 12, 58);
    }
    ctx.fill();
    ctx.fillStyle = '#efe6cf';
    // tusks
    ctx.beginPath();
    ctx.moveTo(86, 62);
    ctx.quadraticCurveTo(102, 58, 100, 42);
    ctx.lineTo(94, 44);
    ctx.quadraticCurveTo(96, 56, 84, 58);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2b231c';
    ellipse(ctx, 66, 42, 4.6, 5);
    ellipse(ctx, 84, 44, 4.6, 5);
    ellipse(ctx, 94, 62, 6, 5);
  },
  bossInu: (ctx) => {
    ENEMY_DRAW.inu(ctx);
    // Armour collar and war banner mark the pack leader.
    ctx.fillStyle = '#2f4a6b';
    ctx.fillRect(34, 74, 60, 12);
    ctx.fillStyle = '#d8a94a';
    ellipse(ctx, 64, 80, 9, 9);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(100, 12, 8, 52);
    ctx.beginPath();
    ctx.moveTo(100, 12);
    ctx.lineTo(72, 20);
    ctx.lineTo(100, 30);
    ctx.closePath();
    ctx.fill();
  },
  boss: (ctx) => {
    ENEMY_DRAW.tanuki(ctx);
    // straw hat marks the boss silhouette at a glance
    ctx.fillStyle = '#f2e2b8';
    ctx.beginPath();
    ctx.moveTo(24, 26);
    ctx.lineTo(66, 2);
    ctx.lineTo(108, 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#c94f4f';
    ctx.fillRect(28, 26, 76, 5);
  },
};

export function enemyTexture(kind: EnemyKind): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  ENEMY_DRAW[kind](ctx);
  return toTexture(c);
}

/** Dried fish — the XP pickup. */
export function fishTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#9fe3ff';
  ellipse(ctx, 60, 64, 34, 20);
  ctx.beginPath();
  ctx.moveTo(92, 64);
  ctx.lineTo(118, 44);
  ctx.lineTo(118, 84);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#2b4d63';
  ellipse(ctx, 44, 58, 4, 4);
  ctx.strokeStyle = 'rgba(43,77,99,0.5)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(60 + i * 12, 64, 14, -0.9, 0.9);
    ctx.stroke();
  }
  return toTexture(c);
}

export function hairballTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#d8c7a8';
  ellipse(ctx, 64, 64, 40, 38);
  ctx.strokeStyle = 'rgba(120,96,64,0.7)';
  ctx.lineWidth = 3;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.arc(64, 64, 12 + i * 6, i * 0.7, i * 0.7 + 2.6);
    ctx.stroke();
  }
  return toTexture(c);
}

export function yarnTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#e8657f';
  ellipse(ctx, 64, 64, 38, 38);
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 4;
  for (let i = -2; i <= 2; i++) {
    ctx.beginPath();
    ctx.ellipse(64, 64, 36, 14, i * 0.6, 0, Math.PI * 2);
    ctx.stroke();
  }
  return toTexture(c);
}

/** Soft blob shadow that grounds every billboard on the 2.5D plane. */
export function shadowTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 62);
  g.addColorStop(0, 'rgba(0,0,0,0.45)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return toTexture(c);
}

/** Tiled ground: grass with faint stone paths and scattered sakura petals. */
export function groundTexture(repeat: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#6f8f5c';
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 900; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 256;
    ctx.fillStyle = `rgba(${90 + Math.random() * 40 | 0},${120 + Math.random() * 40 | 0},${70 + Math.random() * 30 | 0},0.6)`;
    ctx.fillRect(x, y, 3, 3);
  }
  ctx.fillStyle = 'rgba(214,169,190,0.75)';
  for (let i = 0; i < 40; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * 256, Math.random() * 256, 3, 2, Math.random() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  return tex;
}

export type PropKind = 'torii' | 'lantern' | 'tree';

export function propTexture(kind: PropKind): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  if (kind === 'torii') {
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(30, 40, 12, 84);
    ctx.fillRect(86, 40, 12, 84);
    ctx.fillRect(16, 26, 96, 12);
    ctx.fillRect(24, 50, 80, 9);
    ctx.fillStyle = '#8e2b20';
    ctx.fillRect(16, 38, 96, 4);
  } else if (kind === 'lantern') {
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(58, 70, 12, 54);
    ctx.fillStyle = '#e8dcc0';
    ellipse(ctx, 64, 52, 26, 30);
    ctx.fillStyle = '#c0392b';
    ctx.font = 'bold 30px serif';
    ctx.textAlign = 'center';
    ctx.fillText('猫', 64, 62);
  } else {
    ctx.fillStyle = '#6b4b32';
    ctx.fillRect(58, 72, 13, 52);
    ctx.fillStyle = '#f0b7cb';
    ellipse(ctx, 64, 50, 40, 30);
    ellipse(ctx, 38, 62, 20, 16);
    ellipse(ctx, 92, 62, 20, 16);
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ellipse(ctx, 52, 40, 14, 10);
  }
  return toTexture(c);
}

/** Warm dried fish used by the boomerang, distinct from the cool XP fish. */
export function driedFishTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  ctx.fillStyle = '#e8b45c';
  ellipse(ctx, 60, 64, 36, 20);
  ctx.beginPath();
  ctx.moveTo(94, 64);
  ctx.lineTo(120, 42);
  ctx.lineTo(120, 86);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(120,74,26,0.65)';
  ctx.lineWidth = 4;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(56 + i * 12, 64, 15, -0.9, 0.9);
    ctx.stroke();
  }
  ctx.fillStyle = '#5c3a16';
  ellipse(ctx, 40, 58, 4, 4);
  return toTexture(c);
}

/** Soft disc for ground hazards; tinted per instance (ember vs poison). */
export function zoneTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.65, 'rgba(255,255,255,0.35)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return toTexture(c);
}

/** Horizontal gradient strip stretched between two points for lightning arcs. */
export function beamTexture(): THREE.CanvasTexture {
  const [c, ctx] = canvas();
  const g = ctx.createLinearGradient(0, 0, 0, SIZE);
  g.addColorStop(0, 'rgba(255,255,255,0)');
  g.addColorStop(0.5, 'rgba(255,255,255,1)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
  return toTexture(c);
}
