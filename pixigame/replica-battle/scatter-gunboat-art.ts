import type Phaser from 'phaser';
import type { Enemy, Projectile, RecordData, Point } from './kernel/model';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

// This adapter owns pixels only. Never write back into the simulation or mounts.
export const SCATTER_GUNBOAT_MODEL = 120135;
const textureKey = 'owned-enemy:scatter-gunboat-v1';
const atlasUrl = 'assets/owned-enemies/scatter-gunboat-v1/parts.png';
const regions = {
  body: [90, 68, 660, 650], pod: [875, 80, 322, 630],
  gun: [220, 812, 410, 370], sensor: [860, 940, 240, 130],
} as const;
type PartName = keyof typeof regions;
type Layer = { image: Phaser.GameObjects.Image; key: PartName; x: number; y: number; width: number; height: number; flip?: boolean };
type State = {
  layers: Layer[]; fitX: number; fitY: number; px: number;
  angle: number; originX: number; originY: number;
  flight: ReturnType<typeof createEnemyFlightMotion>;
  position?: Point; revision?: number; lastShot?: number;
};
const states = new WeakMap<Phaser.GameObjects.Container, State>();

export function preloadScatterGunboat(scene: Phaser.Scene, models: Iterable<number>): void {
  if (Array.from(models).includes(SCATTER_GUNBOAT_MODEL) && !scene.textures.exists(textureKey)) scene.load.image(textureKey, atlasUrl);
}

export function createScatterGunboat(scene: Phaser.Scene, modelId: number, px: number,
  prefab?: RecordData, sprites?: RecordData): Phaser.GameObjects.Container | undefined {
  if (modelId !== SCATTER_GUNBOAT_MODEL || !scene.textures.exists(textureKey)) return undefined;
  const renderer = prefab?.renderers?.find((r: RecordData) => r.active && r.enabled && r.sprite);
  const sprite = renderer && sprites?.[renderer.sprite];
  if (!renderer || !sprite) return undefined;
  const texture = scene.textures.get(textureKey);
  for (const [name, rect] of Object.entries(regions)) if (!texture.has(name)) texture.add(name, 0, rect[0], rect[1], rect[2], rect[3]);
  const matrix = renderer.matrix;
  const a = matrix ? matrix[0][0] : renderer.scaleX;
  const b = matrix ? -matrix[2][0] : 0;
  const c = matrix ? -matrix[0][1] : 0;
  const d = matrix ? matrix[2][1] : renderer.scaleY;
  const sx = Math.hypot(a, b), sy = sx ? (a * d - b * c) / sx : 0;
  const state: State = {
    layers: [], fitX: sprite.width / sprite.ppu * px * sx / 378,
    fitY: sprite.height / sprite.ppu * px * sy / 236, px,
    angle: matrix ? Math.atan2(b, a) : -(renderer.rotation || 0) * Math.PI / 180,
    originX: (matrix ? matrix[0][3] : renderer.x || 0) * px,
    originY: -(matrix ? matrix[2][3] : renderer.y || 0) * px,
    flight: createEnemyFlightMotion({ id: 'scatter-gunboat', tier: '小怪' }, 120135),
  };
  const view = scene.add.container(0, 0);
  const add = (key: PartName, x: number, y: number, width: number, height: number, flip = false) => {
    const image = scene.add.image(0, 0, textureKey, key);
    view.add(image); state.layers.push({ image, key, x, y, width, height, flip });
  };
  add('pod', -142, -5, 94, 190, true); add('pod', 142, -5, 94, 190);
  add('gun', 0, 66, 112, 101); add('body', 0, -22, 200, 197); add('sensor', 0, -31, 42, 23);
  states.set(view, state);
  poseLayers(state, state.flight.update(0), 0);
  return view;
}

// Actual live projectiles provide the visual trigger; never invent a fire timer.
export function scatterGunboatShots(enemies: readonly Enemy[], projectiles: readonly Projectile[], clock: number): Map<number, number> {
  const owners = new Set(enemies.filter(e => e.modelId === SCATTER_GUNBOAT_MODEL).map(e => e.uid));
  const result = new Map<number, number>();
  if (!owners.size) return result;
  for (const p of projectiles) {
    if (p.owner !== 'enemy' || !owners.has(p.ownerUid) || p.held || p.age < p.warmup) continue;
    const time = clock - p.age + p.warmup;
    if (time > (result.get(p.ownerUid) ?? -Infinity)) result.set(p.ownerUid, time);
  }
  return result;
}

function poseLayers(state: State, pose: ReturnType<State['flight']['update']>, recoil: number): void {
  const angle = state.angle + pose.angle, co = Math.cos(angle), si = Math.sin(angle);
  for (const layer of state.layers) {
    const x = (layer.x + (layer.key === 'sensor' ? pose.bank * 8 : 0)) * state.fitX;
    const y = (layer.y - (layer.key === 'gun' ? recoil * 10 : 0)) * state.fitY;
    const leanX = x * (1 - Math.abs(pose.bank) * .12);
    const leanY = y + x * pose.bank * .12;
    layer.image.setPosition(state.originX + leanX * co - leanY * si + pose.x * state.fitX,
      state.originY + leanX * si + leanY * co + pose.y * state.fitY)
      .setScale(layer.width * state.fitX / layer.image.frame.width * (layer.flip ? -1 : 1) * (1 - Math.abs(pose.bank) * .12),
        layer.height * state.fitY / layer.image.frame.height)
      .setRotation(angle + (layer.key === 'pod' ? pose.lag * .45 : 0));
  }
}

export function updateScatterGunboat(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point,
  dt: number, clock: number, lastShot?: number): boolean {
  const state = states.get(view);
  if (!state) return false;
  if (dt <= 0) return true; // Freeze cosmetics during pause, upgrade and revive.
  const reset = state.revision !== (enemy.viewPositionRevision ?? 0);
  const vx = !reset && state.position ? (position.x - state.position.x) * state.px / dt : 0;
  const vy = !reset && state.position ? -(position.z - state.position.z) * state.px / dt : 0;
  state.position = { ...position }; state.revision = enemy.viewPositionRevision ?? 0;
  const pose = state.flight.update(dt, vx, vy, false);
  if (lastShot !== undefined && lastShot > (state.lastShot ?? -Infinity)) state.lastShot = lastShot;
  const age = state.lastShot === undefined ? Infinity : Math.max(0, clock - state.lastShot);
  const recoil = !enemy.dead && age < .4 ? Math.sin(Math.min(1, age / .055) * Math.PI / 2) * Math.exp(-Math.max(0, age - .055) * 15) : 0;
  poseLayers(state, pose, recoil);
  return true;
}
