import nativeMotion from './chapter25-enemy-motion.json';
import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number; opacity?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  120156: {
    name: 'orbital-dart', model: 'Plane23', tier: '普通', regions: {"p1":[58,141,408,236],"p2":[624,7,117,458],"p3":[894,10,366,446],"p4":[1408,144,253,235],"p5":[32,593,607,198],"p6":[725,528,155,292],"p7":[1042,474,240,406]},
    parts: r => {
      const part = ({"monster_23_1":"p1","monster_23_2":"p2","monster_23_3":"p3","monster_23_4":"p4","monster_23_5":"p5","monster_23_6":"p6","monster_23_7":"p7"} as Record<string, string>)[r.sprite];
      // Keep original node transforms and clocks; facial layers become sealed armor.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  120166: {
    name: 'relay-cairn', model: 'Plane33', tier: '普通', regions: {"p1":[88,14,197,423],"p2":[402,24,354,384],"p3":[829,153,254,248],"p4":[1143,221,515,200],"p5":[1742,15,175,406],"p6":[100,463,170,311],"p7":[506,439,122,335],"p8":[769,541,368,190],"p9":[1221,486,393,263],"p10":[1775,438,80,336]},
    parts: r => {
      const part = ({"plane33_1":"p1","plane33_2":"p2","plane33_3":"p3","plane33_4":"p4","plane33_5":"p5","plane33_6":"p6","plane33_7":"p7","plane33_8":"p8","plane33_9":"p9","plane33_10":"p10"} as Record<string, string>)[r.sprite];
      // Keep original node transforms and clocks; facial layers become sealed armor.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  120181: {
    name: 'salvage-seeker', model: 'Plane39', tier: '普通', regions: {"p1":[45,123,319,170],"p2":[417,86,461,251],"p3":[908,22,426,374],"p4":[1374,37,366,313],"p5":[108,366,194,495],"p6":[510,394,230,449],"p7":[893,432,408,401],"p8":[1437,381,261,465]},
    parts: r => {
      const part = ({"planne39_1":"p1","planne39_2":"p2","planne39_3":"p3","planne39_4":"p4","planne39_5":"p5","planne39_7":"p6","planne39_8":"p7","planne39_9":"p8"} as Record<string, string>)[r.sprite];
      // Keep original node transforms and clocks; facial layers become sealed armor.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  121011: {
    name: 'derelict-citadel', model: 'Plane_boss_11', tier: '首领', regions: {"p1":[12,67,362,194],"p2":[394,71,242,214],"p3":[692,15,113,346],"p4":[852,105,393,182],"p5":[76,314,139,301],"p6":[303,327,192,274],"p7":[531,412,372,177],"p8":[914,384,330,204],"p9":[84,627,102,288],"p10":[285,626,150,289],"p11":[486,719,416,137],"p12":[921,667,311,246],"p13":[22,928,209,294],"p14":[290,915,349,315],"p15":[684,981,197,203],"p16":[903,1018,335,160]},
    parts: r => {
      const part = ({"stg_tzboss_1":"p1","stg_tzboss_2":"p2","stg_tzboss_3":"p3","stg_tzboss_4":"p4","stg_tzboss_5":"p5","stg_tzboss_6":"p6","stg_tzboss_7":"p7","stg_tzboss_8":"p8","stg_tzboss_9":"p9","stg_tzboss_10":"p10","stg_tzboss_11":"p11","stg_tzboss_12":"p12","stg_tzboss_13":"p13","stg_tzboss_tou":"p14","stg_tzboss_eyes":"p15","stg_tzboss_ya":"p16","stg_tzboss_eyes_1":"p15","stg_tzboss_gx_1":"p15","stg_tzboss_gx_2":"p15"} as Record<string, string>)[r.sprite];
      // Keep original node transforms and clocks; facial layers become sealed armor.
      return part ? [{ part, pinned: true }] : [];
    },
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter25-${s.name}-v1`;

export function preloadChapter25Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter25-${skin.name}-v1/parts.png`);
  }
}

export function createChapter25Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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

export function updateChapter25Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
