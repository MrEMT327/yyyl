import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  122004: {
    name: 'dock-crane', model: 'Plane15_elite1', tier: '精英',
    regions: {"shell":[75,16,272,595],"shoulder":[411,108,457,421],"scythe":[946,6,278,605],"jaw":[38,678,295,175],"brow":[398,701,553,149],"stinger":[1045,627,132,300],"joint":[57,945,256,260],"socket":[521,953,236,238]},
    parts: r => {
      // Expanded duplicate outline masks are decorative; attack warnings remain native.
      const match = /^plane15_elite1_(\d+)$/.exec(r.sprite);
      const part = match && ({ 1: 'shell', 2: 'shoulder', 3: 'stinger', 4: 'scythe',
        5: 'brow', 6: 'jaw', 7: 'joint', 8: 'socket' } as Record<number, string>)[Number(match[1])];
      return part ? [{ part, pinned: part === 'stinger' }] : [];
    },
  },
  120198: {
    name: 'breakwater-wing', model: 'Plane48', tier: '普通',
    regions: {"mantle":[89,64,317,313],"eye":[481,90,293,257],"wing":[894,58,329,325],"fin":[67,475,269,307],"inner":[418,422,419,411],"tail":[904,534,303,203],"lobe":[30,922,399,214],"finback":[486,883,302,294],"backing":[836,882,376,299]},
    parts: r => {
      const part = ({ plane48_1: 'mantle', plane48_1b: 'backing', plane48_2: 'eye', plane48_3: 'wing',
        plane48_4: 'fin', plane48_4b: 'finback', plane48_5: 'inner', plane48_6: 'tail', plane48_7: 'lobe' } as Record<string, string>)[r.sprite];
      return part ? [{ part, order: ({ finback: -3, backing: -2, inner: -1, tail: 0, lobe: 0, wing: 1, fin: 1, mantle: 2, eye: 3 } as Record<string, number>)[part] }] : [];
    },
  },
  120149: {
    name: 'channel-dart', model: 'Plane17', tier: '普通',
    regions: {"shell":[232,1,171,619],"fin":[679,121,572,425],"tail":[98,708,463,490],"crest":[890,625,128,586]},
    parts: r => r.sprite === 'monster17_0000' ? [
      // One native sprite transform, subdivided visually inside its existing footprint.
      { part: 'tail', w: .65, h: .28, y: -.34, order: -2 },
      { part: 'fin', w: .42, h: .34, x: -.27, y: -.02, flip: true, order: -1 },
      { part: 'fin', w: .42, h: .34, x: .27, y: -.02, order: -1 },
      { part: 'shell', w: .6, h: .9, y: .04, order: 0 },
      { part: 'crest', w: .22, h: .49, y: -.03, order: 1 },
    ] : [],
  },
  120201: {
    name: 'salvage-buoy', model: 'Plane51', tier: '普通',
    regions: {"outer":[30,33,475,334],"petal":[558,19,208,343],"mouth":[842,161,415,207],"bell":[44,421,438,327],"body":[496,410,352,350],"plate":[878,512,386,234],"stalk":[199,782,112,417],"eye":[515,913,258,247]},
    parts: r => {
      const match = /^plane51_(\d+)$/.exec(r.sprite);
      const part = match && ({ 1: 'outer', 2: 'petal', 3: 'mouth', 4: 'bell', 5: 'body',
        6: 'plate', 7: 'stalk', 8: 'eye' } as Record<number, string>)[Number(match[1])];
      return part ? [{ part, order: ({ body: -3, outer: -2, petal: -1, bell: 0, stalk: 1, plate: 2, mouth: 3, eye: 4 } as Record<string, number>)[part] }] : [];
    },
  },
  121004: {
    name: 'drydock-carrier', model: 'Plane_boss_4', tier: 'Boss',
    regions: {"shell":[163,6,431,492],"fin":[830,6,253,477],"plume":[218,528,324,334],"horn":[854,504,148,379],"mouth":[209,902,338,330],"brow":[815,891,228,354]},
    parts: r => {
      const match = /^stg_boss_4_(\d+)$/.exec(r.sprite);
      const part = match && ({ 1: 'shell', 2: 'fin', 3: 'plume', 4: 'horn', 5: 'mouth', 6: 'brow' } as Record<number, string>)[Number(match[1])];
      // Preserve native attack-part animation and mount alignment, including the Flame branch.
      return part ? [{ part, pinned: true }] : [];
    },
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter8-${s.name}-v1`;

export function preloadChapter8Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter8-${skin.name}-v1/parts.png`);
  }
}

export function createChapter8Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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
      angle += pose.angle * .25 + (['horn', 'wing', 'fin', 'petal', 'leg', 'tail'].includes(layer.spec.part) ? pose.lag * .3 : 0);
      width *= 1 - Math.abs(pose.bank) * .1;
    }
    layer.image.setOrigin(layer.pivotX, layer.pivotY).setPosition(x, y)
      .setScale(width / layer.image.frame.width * (layer.spec.flip ? -1 : 1),
        layer.height * (layer.spec.h ?? 1) * state.px * sy / layer.image.frame.height)
      .setRotation(angle).setAlpha(native?.spritePathId === '0' ? 0 : native?.alpha ?? m[12] ?? layer.rest[12]);
  }
}

export function updateChapter8Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
