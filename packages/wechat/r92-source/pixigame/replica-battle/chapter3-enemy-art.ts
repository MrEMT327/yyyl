import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  120163: {
    name: 'burst-hover', model: 'Plane30', tier: '小怪',
    regions: { hull: [91, 49, 684, 711], pod: [811, 249, 435, 397], gun: [285, 833, 289, 374], sensor: [864, 987, 295, 139] },
    parts: r => {
      if (r.sprite === 'plane30_1') return [
        { part: 'hull', h: .7, y: -.1, order: 2 },
        // Source body z=.21, height=2.56. Place the visual muzzle at native slot 2 z=1.28.
        { part: 'gun', w: .25, h: .25, y: .29296875, pinned: true, order: 7 },
        { part: 'sensor', w: .4, h: .09, y: -.08, order: 8 },
      ];
      if (r.sprite === 'plane30_9' || r.sprite === 'plane30_10') return [{ part: 'pod', flip: r.matrix[0][3] > 0, order: 0 }];
      return [];
    },
  },
  120131: {
    name: 'armored-scout', model: 'Plane3', tier: '小怪',
    regions: { hull: [53, 55, 724, 731], wing: [800, 345, 435, 248], engine: [231, 836, 340, 367], sensor: [785, 938, 406, 227] },
    parts: r => r.sprite === 'monster3_0000' ? [
      { part: 'wing', w: .25, h: .24, x: -.38, y: -.08, flip: true, order: 0 },
      { part: 'wing', w: .25, h: .24, x: .38, y: -.08, order: 0 },
      { part: 'engine', w: .25, h: .3, y: -.32, order: 1 },
      { part: 'hull', w: .72, h: .78, order: 2 },
      { part: 'sensor', w: .42, h: .18, y: .2, order: 3 },
    ] : [],
  },
  120153: {
    name: 'rush-missile', model: 'Plane20', tier: '小怪',
    regions: { hull: [254, 22, 258, 793], wing: [826, 212, 333, 314], engine: [224, 878, 319, 299], sensor: [861, 958, 217, 223] },
    parts: r => r.sprite === 'stg_boss_4_2' ? [
      { part: 'wing', w: .27, h: .23, x: -.33, y: -.2, flip: true, order: 0 },
      { part: 'wing', w: .27, h: .23, x: .33, y: -.2, order: 0 },
      { part: 'engine', w: .32, h: .2, y: -.38, order: 1 },
      { part: 'hull', w: .42, h: 1, order: 2 },
      { part: 'sensor', w: .23, h: .18, y: -.1, order: 3 },
    ] : [],
  },
  121001: {
    name: 'broadside-boss', model: 'Plane_boss_1', tier: 'Boss',
    regions: { hull: [29, 72, 593, 568], arm: [633, 70, 169, 601], housing: [837, 157, 396, 484],
      barrel: [94, 676, 293, 511], optic: [421, 974, 365, 133], engine: [810, 696, 412, 497] },
    parts: r => {
      const part = ({ pirate_boss_plane_1: 'hull', pirate_boss_plane_2: 'engine', pirate_boss_plane_3: 'arm',
        pirate_boss_plane_4: 'housing', pirate_boss_plane_5: 'barrel', pirate_boss_plane_7: 'housing',
        pirate_boss_plane_6: 'engine', pirate_boss_plane_eyes_1: 'optic', pirate_boss_plane_eyes_2: 'housing',
        pirate_boss_body: 'hull', pirate_boss_hard: 'optic',
      } as Record<string, string>)[r.sprite];
      // Source arm/cannon paths retain all enter, hold, fire, exit and death transforms.
      return part ? [{ part, pinned: ['arm', 'housing', 'barrel', 'optic'].includes(part) }] : [];
    },
  },
};
type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter3-${s.name}-v1`;

export function preloadChapter3Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter3-${skin.name}-v1/parts.png`);
  }
}

export function createChapter3Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
  assets: RecordData): Phaser.GameObjects.Container | undefined {
  const skin = skins[id];
  if (!skin || !prefab || !scene.textures.exists(keyFor(skin))) return undefined;
  const animation = assets.bossAnimations?.models?.[skin.model];
  const local: NativeEnemyAnimationSource | undefined = assets.enemyLocalAnimation;
  const selected = (prefab.renderers as RecordData[]).flatMap(r => r.active && r.enabled && assets.sprites[r.sprite]
    ? skin.parts(r).map(spec => ({ r, spec, path: r.hierarchy.join('/') })) : []);
  if (!selected.length || selected.some(({ r, path }) => !r.matrix || (animation && !animation.renderers.some((v: RecordData) => v.path === path))
    || (local?.models[skin.model] && !local.models[skin.model].renderers.some(v => v.path === path)))) return undefined;
  const key = keyFor(skin), texture = scene.textures.get(key);
  for (const [name, rect] of Object.entries(skin.regions)) if (!texture.has(name)) texture.add(name, 0, ...rect);
  const view = scene.add.container(0, 0), state: State = { layers: [], px, animation, local,
    flight: createEnemyFlightMotion({ id: skin.name, tier: skin.tier }, id) };
  for (const { r, spec, path } of selected) {
    const s = assets.sprites[r.sprite], pivot = s.renderPivot || s.pivot || { x: .5, y: .5 };
    const index = animation?.renderers.findIndex((v: RecordData) => v.path === path) ?? -1;
    const rest = r.matrix.slice(0, 3).flat() as number[]; rest.push(r.color?.a ?? 1);
    state.layers.push({ image: scene.add.image(0, 0, key, spec.part), path, index, rest, spec,
      width: s.width / s.ppu, height: s.height / s.ppu, pivotX: pivot.x, pivotY: 1 - pivot.y,
      order: spec.order ?? animation?.renderers[index]?.sortingOrder ?? r.sortingOrder });
  }
  state.layers.sort((a, b) => a.order - b.order);
  for (const layer of state.layers) view.add(layer.image);
  states.set(view, state);
  poseLayers(state, animation?.clips?.Idle?.frames?.[0], state.flight.update(0));
  return view;
}

function poseLayers(state: State, frame: number[][] | undefined, pose: ReturnType<State['flight']['update']>,
  local?: ReturnType<typeof sampleNativeEnemyAnimation>): void {
  const byPath = local ? new Map(local.map(v => [v.path, v])) : undefined;
  for (const layer of state.layers) {
    const native = byPath?.get(layer.path), m = native?.matrix || frame?.[layer.index] || layer.rest;
    const a = m[0], b = -m[8], c = -m[1], d = m[9], sx = Math.hypot(a, b), sy = sx ? (a * d - b * c) / sx : 0;
    const ox = (layer.spec.x || 0) * layer.width, oy = (layer.spec.y || 0) * layer.height;
    let x = (m[3] + a * ox + c * oy) * state.px, y = (-m[11] + b * ox + d * oy) * state.px;
    let angle = Math.atan2(b, a), width = layer.width * (layer.spec.w ?? 1) * state.px * sx;
    if (!layer.spec.pinned) {
      x += pose.bank * state.px * .4; y += x * pose.bank * .08;
      angle += pose.angle * .25 + (['wing', 'engine', 'pod'].includes(layer.spec.part) ? pose.lag * .3 : 0);
      width *= 1 - Math.abs(pose.bank) * .1;
    }
    layer.image.setOrigin(layer.pivotX, layer.pivotY).setPosition(x, y)
      .setScale(width / layer.image.frame.width * (layer.spec.flip ? -1 : 1),
        layer.height * (layer.spec.h ?? 1) * state.px * sy / layer.image.frame.height)
      .setRotation(angle).setAlpha(native?.spritePathId === '0' ? 0 : native?.alpha ?? m[12] ?? layer.rest[12]);
  }
}

export function updateChapter3Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
  const state = states.get(view);
  if (!state) return false;
  if (dt <= 0) return true;
  const reset = state.revision !== (enemy.viewPositionRevision ?? 0);
  const vx = !reset && state.position ? (position.x - state.position.x) * state.px / dt : 0;
  const vy = !reset && state.position ? -(position.z - state.position.z) * state.px / dt : 0;
  state.position = { ...position }; state.revision = enemy.viewPositionRevision ?? 0;
  const name = enemy.dead ? 'Death' : enemy.animationClip || 'Idle';
  const age = enemy.dead ? enemy.deathAge ?? (4 * nativeLogicDelta - (enemy.deathRemaining || 0)) : enemy.animationTime ?? enemy.age;
  const clip = state.animation?.clips[name];
  let frame: number[][] | undefined;
  if (clip?.frames?.length) {
    const t = age * Number(clip.stateSpeed ?? 1), loop = name === 'Idle' || name.startsWith('SkillFireHold') || name.startsWith('SkillHold');
    const seconds = loop && clip.duration > 0 ? t % clip.duration : Math.min(t, clip.duration);
    frame = clip.frames[Math.min(clip.frames.length - 1, Math.max(0, Math.floor(seconds * clip.fps)))];
  }
  const local = sampleNativeEnemyAnimation(state.local, enemy.entityId, { age: enemy.age, mainState: name, mainTime: age });
  poseLayers(state, frame, state.flight.update(dt, vx, vy, !!enemy.laserWarning), local);
  return true;
}
