import nativeMotion from './chapter21-enemy-motion.json';
import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number; opacity?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  120217: {
    name: 'amber-seeder', model: 'Plane60', tier: '普通', regions: {"p1":[83,63,154,299],"p2":[434,22,106,372],"p3":[684,82,309,272],"p4":[1093,41,483,353],"p5":[1668,85,262,271],"p6":[46,406,252,364],"p7":[367,489,368,228],"p8":[778,505,532,190],"p9":[1320,500,401,205],"p10":[1779,481,137,222]},
    parts: r => {
      const part = ({"plane60_1":"p1","plane60_2":"p2","plane60_3":"p3","plane60_4":"p4","plane60_5":"p5","plane60_6":"p6","plane60_7":"p7","plane60_8":"p8","plane60_9":"p9","plane60_10":"p10"} as Record<string, string>)[r.sprite];
      // Keep original node transforms and clocks; facial layers become sealed armor.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  120200: {
    name: 'fjord-beacon', model: 'Plane50', tier: '普通', regions: {"p1":[21,121,432,224],"p2":[478,28,405,399],"p3":[917,40,493,377],"p4":[1492,100,214,249],"p5":[14,469,437,351],"p6":[473,455,498,390],"p7":[1021,454,311,408]},
    parts: r => {
      const part = ({"plane50_1":"p1","plane50_2":"p2","plane50_3":"p3","plane50_4":"p4","plane50_5":"p5","plane50_6":"p6","plane50_7":"p7"} as Record<string, string>)[r.sprite];
      // Keep original node transforms and clocks; facial layers become sealed armor.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  120195: {
    name: 'copper-shear', model: 'Plane45', tier: '普通', regions: {"p1":[122,15,186,518],"p2":[449,59,400,381],"p3":[875,113,472,311],"p4":[1390,70,340,349],"p5":[80,577,278,242],"p6":[559,483,202,383],"p7":[862,531,497,290],"p8":[1445,568,240,246]},
    parts: r => {
      const part = ({"plane45_1":"p1","plane45_2":"p2","plane45_3":"p3","plane45_4":"p4","plane45_5":"p5","plane45_6":"p6","plane45_7":"p7","plane45_8":"p8"} as Record<string, string>)[r.sprite];
      // Keep original node transforms and clocks; facial layers become sealed armor.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  121012: {
    name: 'fjord-ark', model: 'Plane_boss_12', tier: '首领', regions: {"p1":[28,28,291,276],"p2":[359,104,344,167],"p3":[748,16,126,305],"p4":[1019,11,159,308],"p5":[91,333,102,292],"p6":[262,407,226,162],"p7":[531,370,302,218],"p8":[849,449,396,79],"p9":[17,707,371,147],"p10":[414,671,234,217],"p11":[758,620,90,304],"p12":[1023,620,165,314],"p13":[65,914,145,326],"p14":[279,977,359,242],"p15":[679,979,227,218],"p16":[923,1014,328,161]},
    parts: r => {
      const part = ({"pirate_boss_plane_1_b":"p1","pirate_boss_plane_2":"p2","pirate_boss_plane_3_b":"p3","pirate_boss_plane_4_b":"p4","pirate_boss_plane_5":"p5","pirate_boss_plane_6":"p6","pirate_boss_plane_7":"p7","pirate_boss_plane_8_b":"p8","pirate_boss_hat_b":"p9","pirate_boss_body_b":"p10","pirate_boss_arm_b":"p11","pirate_boss_shoulder_b":"p12","pirate_boss_hard_b":"p13","pirate_boss_chair_b":"p14","pirate_boss_eyes2":"p15","pirate_boss_mouth_1":"p16","pirate_boss_eyes1_b":"p15","pirate_boss_plane_eyes_2_b":"p15","pirate_boss_plane_eyes_1":"p16"} as Record<string, string>)[r.sprite];
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
const keyFor = (s: Skin) => `owned-enemy:chapter21-${s.name}-v1`;

export function preloadChapter21Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter21-${skin.name}-v1/parts.png`);
  }
}

export function createChapter21Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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

export function updateChapter21Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
