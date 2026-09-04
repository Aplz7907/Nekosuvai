import * as THREE from 'three';
import { CONFIG } from '../data/config';
import { KIND_ORDER } from '../ecs/entities';
import type { Game } from '../game';
import {
  beamTexture,
  catDetailTexture,
  catFurTexture,
  driedFishTexture,
  enemyTexture,
  fishTexture,
  groundTexture,
  hairballTexture,
  propTexture,
  shadowTexture,
  yarnTexture,
  zoneTexture,
  type PropKind,
} from './textures';

const ELEVATION = CONFIG.camera.elevation;
/** Rotation that makes an upright quad face the fixed tilted camera. */
const BILLBOARD_TILT = -ELEVATION;

const GROUND_TILE = 8;
/**
 * The scene renders at 1/PIXEL_SCALE of the window and the canvas is stretched
 * back up by CSS with nearest sampling — the low-res buffer is what gives the
 * whole image its pixel look, not just the sprites.
 */
const PIXEL_SCALE = 3;
/** Must not be smaller than ZonePool.cap or hazards would go unrendered. */
const ZONE_CAPACITY = 512;
const PROP_CELL = 14;
const PROP_RANGE = 3;
const PROP_KINDS: PropKind[] = ['torii', 'lantern', 'tree'];

/** Cheap deterministic hash so the prop field is identical every frame. */
function hash2(x: number, z: number): number {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function billboardGeometry(): THREE.PlaneGeometry {
  const g = new THREE.PlaneGeometry(1, 1);
  // Pivot at the base so a sprite's feet sit exactly on the ground plane.
  g.translate(0, 0.5, 0);
  return g;
}

function spriteMaterial(map: THREE.Texture, color = 0xffffff): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    map,
    color,
    transparent: false,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
    fog: true,
  });
}

export class View {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.OrthographicCamera;

  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();

  private readonly ground: THREE.Mesh;
  private readonly enemyMeshes: THREE.InstancedMesh[] = [];
  private readonly propMeshes = new Map<PropKind, THREE.InstancedMesh>();
  private readonly shadows: THREE.InstancedMesh;
  private readonly shadowCapacity = CONFIG.capacity.enemies + 16;
  private readonly gemMesh: THREE.InstancedMesh;
  /** One mesh per projectile sprite: 0 hairball, 1 dried fish. */
  private readonly projectileMeshes: THREE.InstancedMesh[] = [];
  private readonly zoneMesh: THREE.InstancedMesh;
  private readonly beamPool: THREE.Mesh[] = [];
  private readonly orbitMesh: THREE.InstancedMesh;

  private readonly catFur: THREE.Mesh;
  private readonly catDetail: THREE.Mesh;
  private readonly catGroup = new THREE.Group();

  private readonly arcPool: THREE.Mesh[] = [];
  private readonly arcGeometries = new Map<number, THREE.RingGeometry>();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene.background = new THREE.Color(0x9fc7d8);
    this.scene.fog = new THREE.Fog(0x9fc7d8, 22, 40);

    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);
    this.resize();

    // Ground: one big tiled quad that is snapped along with the player, which
    // keeps the world visually infinite without any streaming.
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(160, 160),
      new THREE.MeshBasicMaterial({ map: groundTexture(160 / GROUND_TILE), fog: true }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.scene.add(this.ground);

    const shadowGeo = new THREE.PlaneGeometry(1, 1);
    shadowGeo.rotateX(-Math.PI / 2);
    this.shadows = new THREE.InstancedMesh(
      shadowGeo,
      new THREE.MeshBasicMaterial({ map: shadowTexture(), transparent: true, depthWrite: false, fog: true }),
      this.shadowCapacity,
    );
    this.shadows.frustumCulled = false;
    this.shadows.renderOrder = 1;
    this.scene.add(this.shadows);

    const geo = billboardGeometry();
    for (const kind of KIND_ORDER) {
      const mesh = new THREE.InstancedMesh(geo, spriteMaterial(enemyTexture(kind)), CONFIG.capacity.enemies);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      this.enemyMeshes.push(mesh);
    }

    this.gemMesh = new THREE.InstancedMesh(geo, spriteMaterial(fishTexture()), CONFIG.capacity.gems);
    this.gemMesh.frustumCulled = false;
    this.gemMesh.count = 0;
    this.scene.add(this.gemMesh);

    for (const tex of [hairballTexture(), driedFishTexture()]) {
      const mesh = new THREE.InstancedMesh(geo, spriteMaterial(tex), CONFIG.capacity.projectiles);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      this.projectileMeshes.push(mesh);
    }

    const zoneGeo = new THREE.PlaneGeometry(1, 1);
    zoneGeo.rotateX(-Math.PI / 2);
    this.zoneMesh = new THREE.InstancedMesh(
      zoneGeo,
      new THREE.MeshBasicMaterial({
        map: zoneTexture(),
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        fog: true,
      }),
      ZONE_CAPACITY,
    );
    this.zoneMesh.frustumCulled = false;
    this.zoneMesh.count = 0;
    this.zoneMesh.renderOrder = 2;
    this.scene.add(this.zoneMesh);

    const beamGeo = new THREE.PlaneGeometry(1, 1);
    beamGeo.rotateX(-Math.PI / 2);
    const beamMap = beamTexture();
    for (let i = 0; i < 10; i++) {
      const mesh = new THREE.Mesh(
        beamGeo,
        new THREE.MeshBasicMaterial({
          map: beamMap,
          color: 0xbfe6ff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.visible = false;
      mesh.renderOrder = 4;
      this.scene.add(mesh);
      this.beamPool.push(mesh);
    }

    this.orbitMesh = new THREE.InstancedMesh(geo, spriteMaterial(yarnTexture()), 16);
    this.orbitMesh.frustumCulled = false;
    this.orbitMesh.count = 0;
    this.scene.add(this.orbitMesh);

    for (const kind of PROP_KINDS) {
      const count = (PROP_RANGE * 2 + 1) ** 2;
      const mesh = new THREE.InstancedMesh(geo, spriteMaterial(propTexture(kind)), count);
      mesh.frustumCulled = false;
      mesh.count = 0;
      this.scene.add(mesh);
      this.propMeshes.set(kind, mesh);
    }

    this.catFur = new THREE.Mesh(geo, spriteMaterial(catFurTexture()));
    this.catDetail = new THREE.Mesh(geo, spriteMaterial(catDetailTexture()));
    // Detail sits a hair in front of the fur so it always wins the depth test.
    this.catDetail.position.z = 0.01;
    this.catGroup.add(this.catFur, this.catDetail);
    this.catGroup.rotation.x = BILLBOARD_TILT;
    this.catGroup.scale.setScalar(1.15);
    this.scene.add(this.catGroup);

    for (let i = 0; i < 16; i++) {
      const mesh = new THREE.Mesh(
        this.arcGeometry(Math.PI),
        new THREE.MeshBasicMaterial({
          color: 0xffffff,
          transparent: true,
          opacity: 0,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
        }),
      );
      mesh.rotation.x = -Math.PI / 2;
      mesh.visible = false;
      mesh.renderOrder = 3;
      this.scene.add(mesh);
      this.arcPool.push(mesh);
    }

    addEventListener('resize', () => this.resize());
  }

  setFurColor(color: number): void {
    (this.catFur.material as THREE.MeshBasicMaterial).color.setHex(color);
  }

  resize(): void {
    const w = innerWidth;
    const h = innerHeight;
    // `false` leaves the CSS size alone: the element stays full-window while the
    // drawing buffer stays small.
    this.renderer.setSize(Math.ceil(w / PIXEL_SCALE), Math.ceil(h / PIXEL_SCALE), false);
    const half = CONFIG.camera.viewHeight / 2;
    const aspect = w / h;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
  }

  /** Arc meshes are bucketed so a slash never allocates geometry mid-fight. */
  private arcGeometry(arc: number): THREE.RingGeometry {
    const bucket = Math.round((arc * 180) / Math.PI / 15) * 15;
    let geo = this.arcGeometries.get(bucket);
    if (!geo) {
      const theta = (bucket * Math.PI) / 180;
      geo = new THREE.RingGeometry(0.55, 1, 32, 1, -theta / 2, theta);
      this.arcGeometries.set(bucket, geo);
    }
    return geo;
  }

  render(game: Game): void {
    const p = game.player;

    const d = CONFIG.camera.distance;
    // Snap the camera to whole screen pixels, otherwise every sprite crawls
    // against the pixel grid as the player walks.
    const unitsPerPixel = CONFIG.camera.viewHeight / Math.max(this.renderer.domElement.height, 1);
    const camX = Math.round(p.x / unitsPerPixel) * unitsPerPixel;
    const camZ = Math.round(p.z / unitsPerPixel) * unitsPerPixel;
    this.camera.position.set(camX, Math.sin(ELEVATION) * d, camZ + Math.cos(ELEVATION) * d);
    this.camera.lookAt(camX, 0.8, camZ);

    // Snap the ground by whole tiles so the texture never appears to slide.
    this.ground.position.x = Math.round(p.x / GROUND_TILE) * GROUND_TILE;
    this.ground.position.z = Math.round(p.z / GROUND_TILE) * GROUND_TILE;

    this.catGroup.position.set(p.x, 0.02, p.z);
    // Sprites are drawn facing right; mirror when the cat walks left.
    this.catGroup.scale.x = p.facing > Math.PI / 2 || p.facing < -Math.PI / 2 ? -1.15 : 1.15;
    const fur = this.catFur.material as THREE.MeshBasicMaterial;
    if (p.hurtFlash > 0) fur.color.setHex(0xff5a5a);
    else fur.color.setHex(p.furColor);

    this.updateEnemies(game);
    this.updateShadows(game);
    this.updateGems(game);
    this.updateZones(game);
    this.updateProjectiles(game);
    this.updateOrbitals(game);
    this.updateProps(p.x, p.z);
    this.updateEffects(game);

    this.renderer.render(this.scene, this.camera);
  }

  private updateEnemies(game: Game): void {
    const e = game.enemies;
    const counts = new Array(this.enemyMeshes.length).fill(0);

    for (let i = 0; i < e.count; i++) {
      const k = e.kind[i];
      const mesh = this.enemyMeshes[k];
      const slot = counts[k]++;
      const size = e.size[i];
      this.dummy.position.set(e.x[i], 0.02, e.z[i]);
      this.dummy.rotation.set(BILLBOARD_TILT, 0, 0);
      this.dummy.scale.set(e.facing[i] < 0 ? -size : size, size, size);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(slot, this.dummy.matrix);

      // White flash on hit; charging enemies glow red as a telegraph.
      if (e.flash[i] > 0) this.color.setHex(0xffffff).multiplyScalar(2);
      else if (e.behavior[i] === 2 && e.state[i] === 1) this.color.setHex(0xff9a7a);
      else this.color.setHex(0xffffff);
      mesh.setColorAt(slot, this.color);
    }

    for (let k = 0; k < this.enemyMeshes.length; k++) {
      const mesh = this.enemyMeshes[k];
      mesh.count = counts[k];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  private updateShadows(game: Game): void {
    const e = game.enemies;
    // Reserve the last slot for the player's own shadow.
    const cap = this.shadowCapacity - 1;
    let n = 0;
    this.dummy.rotation.set(0, 0, 0);
    for (let i = 0; i < e.count && n < cap; i++) {
      const s = e.radius[i] * 2.6;
      this.dummy.position.set(e.x[i], 0.01, e.z[i]);
      this.dummy.scale.set(s, 1, s * 0.6);
      this.dummy.updateMatrix();
      this.shadows.setMatrixAt(n++, this.dummy.matrix);
    }
    this.dummy.position.set(game.player.x, 0.011, game.player.z);
    this.dummy.scale.set(1.1, 1, 0.66);
    this.dummy.updateMatrix();
    this.shadows.setMatrixAt(n++, this.dummy.matrix);

    this.shadows.count = n;
    this.shadows.instanceMatrix.needsUpdate = true;
  }

  private updateGems(game: Game): void {
    const g = game.gems;
    for (let i = 0; i < g.count; i++) {
      const bob = Math.sin(g.bob[i]) * 0.07;
      this.dummy.position.set(g.x[i], 0.25 + bob, g.z[i]);
      this.dummy.rotation.set(BILLBOARD_TILT, 0, 0);
      this.dummy.scale.setScalar(0.42);
      this.dummy.updateMatrix();
      this.gemMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.gemMesh.count = g.count;
    this.gemMesh.instanceMatrix.needsUpdate = true;
  }

  private updateProjectiles(game: Game): void {
    const p = game.projectiles;
    const counts = [0, 0];
    for (let i = 0; i < p.count; i++) {
      const art = p.art[i] < this.projectileMeshes.length ? p.art[i] : 0;
      const mesh = this.projectileMeshes[art];
      this.dummy.position.set(p.x[i], 0.55, p.z[i]);
      this.dummy.rotation.set(BILLBOARD_TILT, 0, p.spin[i]);
      const s = p.radius[i] * 2.4;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      mesh.setMatrixAt(counts[art]++, this.dummy.matrix);
    }
    for (let a = 0; a < this.projectileMeshes.length; a++) {
      this.projectileMeshes[a].count = counts[a];
      this.projectileMeshes[a].instanceMatrix.needsUpdate = true;
    }
  }

  private updateZones(game: Game): void {
    const z = game.zones;
    for (let i = 0; i < z.count; i++) {
      // Additive blending means dimming the colour is what fades the patch out.
      const fade = Math.min(1, z.life[i] / Math.max(z.maxLife[i], 0.001));
      const s = z.radius[i] * 2.4;
      this.dummy.position.set(z.x[i], 0.03, z.z[i]);
      this.dummy.rotation.set(0, 0, 0);
      this.dummy.scale.set(s, 1, s);
      this.dummy.updateMatrix();
      this.zoneMesh.setMatrixAt(i, this.dummy.matrix);
      if (z.hostile[i]) this.color.setRGB(0.25, 0.85, 0.35);
      else this.color.setRGB(1.0, 0.55, 0.2);
      this.color.multiplyScalar(0.35 + fade * 0.65);
      this.zoneMesh.setColorAt(i, this.color);
    }
    this.zoneMesh.count = z.count;
    this.zoneMesh.instanceMatrix.needsUpdate = true;
    if (this.zoneMesh.instanceColor) this.zoneMesh.instanceColor.needsUpdate = true;
  }

  private updateOrbitals(game: Game): void {
    const o = game.orbitals;
    for (let i = 0; i < o.length && i < 16; i++) {
      this.dummy.position.set(o[i].x, 0.5, o[i].z);
      this.dummy.rotation.set(BILLBOARD_TILT, 0, game.time * 6);
      const s = o[i].r * 2.2;
      this.dummy.scale.set(s, s, s);
      this.dummy.updateMatrix();
      this.orbitMesh.setMatrixAt(i, this.dummy.matrix);
    }
    this.orbitMesh.count = Math.min(o.length, 16);
    this.orbitMesh.instanceMatrix.needsUpdate = true;
  }

  private updateProps(px: number, pz: number): void {
    const counts = new Map<PropKind, number>();
    for (const kind of PROP_KINDS) counts.set(kind, 0);

    const cx = Math.round(px / PROP_CELL);
    const cz = Math.round(pz / PROP_CELL);
    for (let z = cz - PROP_RANGE; z <= cz + PROP_RANGE; z++) {
      for (let x = cx - PROP_RANGE; x <= cx + PROP_RANGE; x++) {
        const h = hash2(x, z);
        if (h > 0.34) continue;
        const kind = PROP_KINDS[Math.floor(hash2(x + 7331, z) * PROP_KINDS.length)];
        const mesh = this.propMeshes.get(kind)!;
        const slot = counts.get(kind)!;
        counts.set(kind, slot + 1);
        const ox = (hash2(x, z + 991) - 0.5) * PROP_CELL * 0.7;
        const oz = (hash2(x + 991, z) - 0.5) * PROP_CELL * 0.7;
        const size = kind === 'torii' ? 4.5 : kind === 'tree' ? 3.6 : 2.2;
        this.dummy.position.set(x * PROP_CELL + ox, 0, z * PROP_CELL + oz);
        this.dummy.rotation.set(BILLBOARD_TILT, 0, 0);
        this.dummy.scale.setScalar(size);
        this.dummy.updateMatrix();
        mesh.setMatrixAt(slot, this.dummy.matrix);
      }
    }

    for (const kind of PROP_KINDS) {
      const mesh = this.propMeshes.get(kind)!;
      mesh.count = counts.get(kind)!;
      mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private updateEffects(game: Game): void {
    for (const mesh of this.arcPool) mesh.visible = false;
    for (const mesh of this.beamPool) mesh.visible = false;
    let slot = 0;
    let beamSlot = 0;

    for (const fx of game.effects) {
      if (fx.kind === 'beam') {
        if (beamSlot >= this.beamPool.length) continue;
        const beam = this.beamPool[beamSlot++];
        const mat = beam.material as THREE.MeshBasicMaterial;
        const dx = fx.x2 - fx.x;
        const dz = fx.z2 - fx.z;
        const len = Math.hypot(dx, dz) || 0.01;
        beam.visible = true;
        beam.position.set((fx.x + fx.x2) / 2, 0.5, (fx.z + fx.z2) / 2);
        // Flat quad on the ground: yaw is the only rotation that matters.
        beam.rotation.set(0, -Math.atan2(dz, dx), 0);
        beam.scale.set(len, 1, 0.45);
        mat.opacity = 1 - fx.t / fx.dur;
        continue;
      }

      if (slot >= this.arcPool.length) continue;
      const mesh = this.arcPool[slot++];
      const mat = mesh.material as THREE.MeshBasicMaterial;
      const k = fx.t / fx.dur;
      mesh.visible = true;
      mat.opacity = (1 - k) * 0.75;

      if (fx.kind === 'slash') {
        mesh.geometry = this.arcGeometry(fx.arc);
        mesh.position.set(fx.x, 0.06, fx.z);
        // Ring geometry lies in XY before the -90 X rotation, so screen-space
        // angle needs its sign flipped to match world heading.
        mesh.rotation.z = -fx.angle;
        const s = fx.range * (0.75 + k * 0.35);
        mesh.scale.set(s, s, 1);
        mat.color.setHex(0xfff0c0);
      } else {
        mesh.geometry = this.arcGeometry(Math.PI * 2);
        mesh.position.set(fx.x, 0.06, fx.z);
        mesh.rotation.z = 0;
        const s = 0.35 + k * 0.7;
        mesh.scale.set(s, s, 1);
        mat.color.setHex(0xffd6d6);
      }
    }
  }
}
