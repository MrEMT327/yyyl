import nativeMotion from './chapter20-enemy-motion.json';
import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number; opacity?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  122005: {
    name: 'polar-broadside', model: 'Plane25_elite1', tier: '精英', regions: {"p1":[246,10,167,493],"p2":[625,102,373,354],"p3":[1159,10,246,495],"p4":[23,572,662,374],"p5":[783,507,133,496],"p6":[1208,507,164,507]},
    parts: r => {
      const part = ({"plane25_elite1_1":"p1","plane25_elite1_2":"p2","plane25_elite1_3":"p3","plane25_elite1_4":"p4","plane25_elite1_5":"p5","plane25_elite1_6":"p6"} as Record<string, string>)[r.sprite.replace(/m$/, '')];
      // Preserve the native hierarchy; blurred underlays reuse a translucent owned silhouette.
      return part ? [{ part, pinned: true, opacity: /m$/.test(r.sprite) ? .12 : 1 }] : [];
    },
  },
  120199: {
    name: 'night-lancer', model: 'Plane49', tier: '普通', regions: {"p1":[37,45,334,356],"p2":[393,52,366,343],"p3":[830,97,224,255],"p4":[1201,11,111,417],"p5":[1527,11,162,416],"p6":[23,574,458,197],"p7":[548,446,169,431],"p8":[899,448,71,421],"p9":[1185,463,151,414],"p10":[1471,446,267,431]},
    parts: r => {
      const part = ({"plane49_1":"p1","plane49_2":"p2","plane49_3":"p3","plane49_4":"p4","plane49_5":"p5","plane49_6":"p6","plane49_7":"p7","plane49_8a":"p8","plane49_8b":"p9","plane49_8c":"p10"} as Record<string, string>)[r.sprite.replace(/m$/, '')];
      // Preserve the native hierarchy; blurred underlays reuse a translucent owned silhouette.
      return part ? [{ part, pinned: true, opacity: /m$/.test(r.sprite) ? .12 : 1 }] : [];
    },
  },
  120158: {
    name: 'frost-cruiser', model: 'Plane25', tier: '普通', regions: {"p1":[205,6,174,504],"p2":[539,111,644,338],"p3":[1249,6,159,504],"p4":[7,566,614,416],"p5":[732,518,193,471]},
    parts: r => {
      const part = ({"plane25_1":"p1","plane25_2":"p2","plane25_3":"p3","plane25_4":"p4","plane25_5":"p5"} as Record<string, string>)[r.sprite.replace(/m$/, '')];
      // Preserve the native hierarchy; blurred underlays reuse a translucent owned silhouette.
      return part ? [{ part, pinned: true, opacity: /m$/.test(r.sprite) ? .12 : 1 }] : [];
    },
  },
  120177: {
    name: 'aurora-gyro', model: 'Plane36', tier: '首领', regions: {"p1":[67,68,515,509],"p2":[716,112,470,451],"p3":[233,684,184,521],"p4":[810,801,281,321]},
    parts: r => {
      const part = ({"plane36_1":"p1","plane36_2":"p2","plane36_3":"p3","plane36_4":"p4"} as Record<string, string>)[r.sprite.replace(/m$/, '')];
      // Preserve the native hierarchy; blurred underlays reuse a translucent owned silhouette.
      return part ? [{ part, pinned: true, opacity: /m$/.test(r.sprite) ? .12 : 1 }] : [];
    },
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter20-${s.name}-v1`;

export function preloadChapter20Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter20-${skin.name}-v1/parts.png`);
  }
}

export function createChapter20Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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
      .setRotation(angle).setAlpha((native?.spritePathId === '0' ? 0 : native?.alpha ?? m[12] ?? layer.rest[12]) * (layer.spec.opacity ?? 1));
  }
}

export function updateChapter20Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
