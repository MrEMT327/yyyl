import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';
import { nativeLogicDelta } from './kernel/native-time';

// Appearance only: retain native Animator time, poses and independent gun mounts.
export const SIEGE_BOSS_MODEL = 121002;
const textureKey = 'owned-enemy:siege-boss-v1';
const atlasUrl = 'assets/owned-enemies/siege-boss-v1/parts.png';
const regions = {
  hull: [65, 50, 350, 855], wing: [475, 125, 420, 380],
  gun: [935, 100, 300, 730], engine: [525, 530, 330, 355],
  bridge: [40, 935, 850, 260], sensor: [935, 1035, 280, 130],
} as const;
type Part = keyof typeof regions;
type Layer = {
  image: Phaser.GameObjects.Image; part: Part; sourcePath: string; index: number;
  rest: number[]; width: number; height: number; pivotX: number; pivotY: number;
  flip: boolean; alpha: number;
};
type State = {
  layers: Layer[]; px: number; animation: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number;
};
const states = new WeakMap<Phaser.GameObjects.Container, State>();

export function preloadSiegeBoss(scene: Phaser.Scene, models: Iterable<number>): void {
  if (Array.from(models).includes(SIEGE_BOSS_MODEL) && !scene.textures.exists(textureKey))
    scene.load.image(textureKey, atlasUrl);
}

export function createSiegeBoss(scene: Phaser.Scene, modelId: number, px: number,
  prefab: RecordData | undefined, assets: RecordData): Phaser.GameObjects.Container | undefined {
  if (modelId !== SIEGE_BOSS_MODEL || !prefab || !scene.textures.exists(textureKey)) return undefined;
  const animation = assets.bossAnimations?.models?.Plane_boss_2 || assets.bossAnimation;
  if (!animation?.clips?.Idle?.frames?.length) return undefined;
  const selected: { r: RecordData; part: Part; flip: boolean; heightScale: number }[] = [];
  for (const r of prefab.renderers || []) {
    if (!r.active || !r.enabled || !assets.sprites[r.sprite]) continue;
    const part: Part | undefined = ({
      plane_boss2_1: 'bridge', plane_boss2_2: 'engine', plane_boss2_3: 'gun',
      plane_boss2_8: 'hull', plane_boss2_13: 'hull', plane_boss2_9: 'wing',
      plane_boss2_12: 'wing', plane_boss2_11: 'sensor', plane_boss2_14: 'sensor',
    } as Record<string, Part>)[r.sprite];
    if (part) selected.push({ r, part, flip: r.sprite === 'plane_boss2_9', heightScale: part === 'sensor' ? .3 : 1 });
  }
  // If the native resource mapping changes, retain the normal prefab fallback.
  if (selected.filter(x => x.part === 'gun').length !== 2 || selected.filter(x => x.part === 'hull').length !== 2
    || selected.some(x => !x.r.matrix || !animation.renderers.some((r: RecordData) => r.path === x.r.hierarchy.join('/')))) return undefined;
  const texture = scene.textures.get(textureKey);
  for (const [name, rect] of Object.entries(regions)) if (!texture.has(name))
    texture.add(name, 0, rect[0], rect[1], rect[2], rect[3]);
  const state: State = { layers: [], px, animation, local: assets.enemyLocalAnimation,
    flight: createEnemyFlightMotion({ id: 'siege-boss', tier: 'Boss' }, SIEGE_BOSS_MODEL) };
  const view = scene.add.container(0, 0);
  selected.sort((a, b) => {
    const order = (r: RecordData) => animation.renderers.find((v: RecordData) => v.path === r.hierarchy.join('/')).sortingOrder;
    return order(a.r) - order(b.r);
  });
  for (const { r, part, flip, heightScale } of selected) {
    const sourcePath = r.hierarchy.join('/'), s = assets.sprites[r.sprite];
    const pivot = s.renderPivot || s.pivot || { x: .5, y: .5 };
    const image = scene.add.image(0, 0, textureKey, part);
    const rest = r.matrix.slice(0, 3).flat() as number[];
    rest.push(r.color?.a ?? 1);
    state.layers.push({ image, part, sourcePath, index: animation.renderers.findIndex((v: RecordData) => v.path === sourcePath),
      rest, width: s.width / s.ppu, height: s.height / s.ppu * heightScale,
      pivotX: pivot.x, pivotY: 1 - pivot.y, flip, alpha: r.color?.a ?? 1 });
    view.add(image);
  }
  states.set(view, state);
  poseLayers(state, animation.clips.Idle.frames[0], state.flight.update(0));
  return view;
}

function poseLayers(state: State, frame: number[][] | undefined,
  pose: ReturnType<State['flight']['update']>, local?: ReturnType<typeof sampleNativeEnemyAnimation>): void {
  const byPath = local ? new Map(local.map(p => [p.path, p])) : undefined;
  for (const layer of state.layers) {
    const native = byPath?.get(layer.sourcePath), m = native?.matrix || frame?.[layer.index] || layer.rest;
    const a = m[0], b = -m[8], c = -m[1], d = m[9];
    const sx = Math.hypot(a, b), sy = sx ? (a * d - b * c) / sx : 0;
    let x = m[3] * state.px, y = -m[11] * state.px;
    let angle = Math.atan2(b, a), width = layer.width * state.px * sx;
    // Cannons use exact native poses. Only armor/engines receive cosmetic depth;
    // visual banking cannot move the muzzle away from native warning/laser origins.
    if (layer.part !== 'gun') {
      const depth = layer.part === 'sensor' ? 1 : layer.part === 'hull' ? .65 : .3;
      x += pose.bank * state.px * depth;
      y += x * pose.bank * .08;
      width *= 1 - Math.abs(pose.bank) * .1;
      angle += pose.angle * .25 + (layer.part === 'wing' || layer.part === 'engine' ? pose.lag * .3 : 0);
    }
    layer.image.setOrigin(layer.pivotX, layer.pivotY).setPosition(x, y)
      .setScale(width / layer.image.frame.width * (layer.flip ? -1 : 1),
        layer.height * state.px * sy / layer.image.frame.height)
      .setRotation(angle).setAlpha(native?.spritePathId === '0' ? 0 : native?.alpha ?? m[12] ?? layer.alpha);
  }
}

export function updateSiegeBoss(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
  const state = states.get(view);
  if (!state) return false;
  if (dt <= 0) return true;
  const reset = state.revision !== (enemy.viewPositionRevision ?? 0);
  const vx = !reset && state.position ? (position.x - state.position.x) * state.px / dt : 0;
  const vy = !reset && state.position ? -(position.z - state.position.z) * state.px / dt : 0;
  state.position = { ...position }; state.revision = enemy.viewPositionRevision ?? 0;
  const name = enemy.dead ? 'Death' : enemy.animationClip || 'Idle';
  const age = enemy.dead ? enemy.deathAge ?? (4 * nativeLogicDelta - (enemy.deathRemaining || 0)) : enemy.animationTime ?? enemy.age;
  const clip = state.animation.clips[name] ?? (name === 'Idle' ? state.animation.clips.idle : undefined);
  let frame: number[][] | undefined;
  if (clip?.frames?.length) {
    const clipAge = age * Number(clip.stateSpeed ?? 1);
    const loop = name === 'Idle' || name.startsWith('SkillFireHold') || name.startsWith('SkillHold');
    const seconds = loop && clip.duration > 0 ? clipAge % clip.duration : Math.min(clipAge, clip.duration);
    frame = clip.frames[Math.min(clip.frames.length - 1, Math.max(0, Math.floor(seconds * clip.fps)))];
  }
  const local = sampleNativeEnemyAnimation(state.local, enemy.entityId, { age: enemy.age, mainState: name, mainTime: age });
  poseLayers(state, frame, state.flight.update(dt, vx, vy, !!enemy.laserWarning), local);
  return true;
}
