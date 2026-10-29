import nativeMotion from './chapter16-enemy-motion.json';
import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number; tint?: number; opacity?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  122009: { name: 'bronze-tide-warden', model: 'Plane33_elite1', tier: '精英', regions: {"deck":[99,21,169,350],"hull":[383,13,317,371],"bearing":[757,54,307,311],"armor":[1113,55,294,303],"outrigger":[131,382,110,347],"hinge":[418,432,254,262],"pod":[843,394,140,314],"rivet":[1213,463,108,197],"turret":[70,746,260,289],"cannon":[489,701,116,352],"strut":[850,725,110,329],"coupling":[1135,778,229,231]},
    parts: r => {
      const underlay = /m$/.test(r.sprite);
      const part = ({"plane33_elite1_1":"deck","plane33_elite1_2":"hull","plane33_elite1_3":"bearing","plane33_elite1_4":"armor","plane33_elite1_5":"outrigger","plane33_elite1_6":"hinge","plane33_elite1_7":"pod","plane33_elite1_8":"rivet","plane33_elite1_9":"turret","plane33_elite1_10":"cannon","plane33_elite1_11":"strut","plane33_elite1_12":"coupling"} as Record<string, string>)[r.sprite.replace(/m$/, '')];
      // Every native part keeps its hierarchy, scale, pivot, order and clock.
      // Former blur-underlay nodes use subdued owned silhouettes for depth.
      return part ? [{ part, pinned: true, tint: underlay ? 0x152a2c : 0xffffff, opacity: underlay ? .12 : 1 }] : [];
    },
  },
  120184: { name: 'verdigris-skiff', model: 'Plane42', tier: '普通', regions: {"brow":[27,144,525,208],"float":[618,60,308,366],"deck":[1009,66,511,389],"bar":[18,605,589,258],"hull":[650,506,388,477],"cap":[1179,615,244,240]},
    parts: r => {
      const underlay = /m$/.test(r.sprite);
      const part = ({"planne42_1":"hull","planne42_2":"bar","planne42_3":"brow","planne42_4":"deck","planne42_5":"float","planne42_6":"cap"} as Record<string, string>)[r.sprite.replace(/m$/, '')];
      // Every native part keeps its hierarchy, scale, pivot, order and clock.
      // Former blur-underlay nodes use subdued owned silhouettes for depth.
      return part ? [{ part, pinned: true, tint: underlay ? 0x152a2c : 0xffffff, opacity: underlay ? .12 : 1 }] : [];
    },
  },
  120183: { name: 'sunken-bastion', model: 'Plane41', tier: '普通', regions: {"float":[105,7,219,470],"pivot":[446,119,249,302],"hull":[750,21,441,467],"deck":[13,512,466,336],"cannon":[536,482,158,353],"cradle":[720,527,472,285],"fin":[499,846,225,451]},
    parts: r => {
      const underlay = /m$/.test(r.sprite);
      const part = ({"planne41_1":"float","planne41_2":"pivot","planne41_3":"hull","planne41_4":"deck","planne41_5":"cannon","planne41_6":"cradle","planne41_7":"fin"} as Record<string, string>)[r.sprite.replace(/m$/, '')];
      // Every native part keeps its hierarchy, scale, pivot, order and clock.
      // Former blur-underlay nodes use subdued owned silhouettes for depth.
      return part ? [{ part, pinned: true, tint: underlay ? 0x152a2c : 0xffffff, opacity: underlay ? .12 : 1 }] : [];
    },
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter16-${s.name}-v1`;

export function preloadChapter16Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter16-${skin.name}-v1/parts.png`);
  }
}

export function createChapter16Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
  assets: RecordData): Phaser.GameObjects.Container | undefined {
  const skin = skins[id];
  if (!skin || !prefab || !scene.textures.exists(keyFor(skin))) return undefined;
  const animation = assets.bossAnimations?.models?.[skin.model];
  const local = nativeMotion as unknown as NativeEnemyAnimationSource;
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
    state.layers.push({ image: scene.add.image(0, 0, key, spec.part).setTint(spec.tint ?? 0xffffff), path, index, rest, spec,
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
      .setRotation(angle).setAlpha((native?.spritePathId === '0' ? 0 : native?.alpha ?? m[12] ?? layer.rest[12]) * (layer.spec.opacity ?? 1));
  }
}

export function updateChapter16Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
