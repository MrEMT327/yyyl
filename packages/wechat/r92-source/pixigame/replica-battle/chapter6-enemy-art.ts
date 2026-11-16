import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  122008: {
    name: 'ion-catamaran', model: 'Plane32_elite1', tier: '精英',
    regions: {"hull":[285,5,234,546],"gun":[796,50,183,475],"housing":[189,561,421,421],"rotor":[704,591,364,357],"hub":[296,1024,207,205],"fin":[725,984,294,262]},
    parts: r => {
      // The old expanded orange outline masks are decorative, not attack warnings.
      const match = /^plane32_elite1_(\d+)$/.exec(r.sprite);
      const part = match && ({ 1: 'hull', 2: 'gun', 3: 'hub', 4: 'housing', 5: 'rotor', 6: 'hub', 7: 'fin' } as Record<number, string>)[Number(match[1])];
      return part ? [{ part, pinned: part === 'gun' }] : [];
    },
  },
  120179: {
    name: 'porcelain-sentry', model: 'Plane37', tier: '普通',
    regions: {"shell":[156,32,502,528],"eye":[818,131,254,370],"petal":[249,566,300,340],"nozzle":[789,599,280,284],"abdomen":[235,907,342,320],"crest":[803,942,249,265]},
    parts: r => {
      const part = ({ planne37_1: 'nozzle', planne37_2: 'crest', planne37_3: 'eye', planne37_4: 'shell',
        planne37_5: 'petal', planne37_6: 'petal', planne37_7: 'abdomen', planne37_8: 'abdomen',
        planne37_9: 'nozzle', planne37_10: 'shell' } as Record<string, string>)[r.sprite];
      return part ? [{ part, pinned: part === 'nozzle', order: ({ abdomen: -1, shell: 0, petal: 1, crest: 2, eye: 3, nozzle: 4 } as Record<string, number>)[part] }] : [];
    },
  },
  120132: {
    name: 'glass-dart', model: 'Plane2', tier: '普通',
    regions: {"shell":[70,24,461,744],"fin":[676,94,510,606],"face":[98,819,394,420],"tail":[709,819,343,404]},
    parts: r => {
      const part = ({ monster2_1: 'shell', monster2_2: 'face', monster2_3: 'tail', monster2_4: 'fin' } as Record<string, string>)[r.sprite];
      return part ? [{ part }] : [];
    },
  },
  120216: {
    name: 'garnet-crab', model: 'Plane59', tier: '普通',
    regions: {"shell":[122,67,468,379],"claw":[802,67,268,393],"eye":[222,527,290,266],"leg":[727,517,404,317],"joint":[187,891,359,269],"nozzle":[806,887,221,269]},
    parts: r => {
      const part = ({ plane59_1: 'eye', plane59_2: 'joint', plane59_3: 'joint', plane59_4: 'nozzle',
        plane59_5: 'shell', plane59_6: 'claw', plane59_7: 'joint', plane59_8: 'joint', plane59_9: 'leg' } as Record<string, string>)[r.sprite];
      return part ? [{ part, pinned: part === 'nozzle', order: ({ leg: -2, joint: -1, shell: 0, claw: 1, nozzle: 2, eye: 3 } as Record<string, number>)[part] }] : [];
    },
  },
  122016: {
    name: 'crown-nautilus', model: 'Plane_boss_15', tier: 'Boss',
    regions: {"shell":[93,62,302,389],"wing":[557,75,191,388],"joint":[914,140,247,286],"face":[96,522,293,270],"mouth":[493,511,303,317],"horn":[955,494,171,337],"tail":[130,867,208,296],"pearl":[504,928,248,209],"brow":[855,938,354,225]},
    parts: r => {
      const match = /^boss15_(\d+)$/.exec(r.sprite);
      const part = match && ({ 1: 'brow', 2: 'horn', 3: 'face', 4: 'pearl', 5: 'pearl', 6: 'brow',
        7: 'joint', 8: 'horn', 9: 'pearl', 10: 'mouth', 11: 'joint', 12: 'horn', 13: 'joint',
        14: 'wing', 15: 'shell', 16: 'tail', 17: 'joint', 18: 'brow', 19: 'tail' } as Record<number, string>)[Number(match[1])];
      // All native cannon transforms continue to control the new siphon and its crown.
      return part ? [{ part, pinned: r.hierarchy.includes('cannon'),
        order: part === 'joint' && r.hierarchy.includes('cannon') ? 2 : ({ tail: -3, wing: -2, joint: -1, shell: 0, horn: 1, brow: 2, face: 3, mouth: 3, pearl: 4 } as Record<string, number>)[part] }] : [];
    },
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter6-${s.name}-v1`;

export function preloadChapter6Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter6-${skin.name}-v1/parts.png`);
  }
}

export function createChapter6Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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

export function updateChapter6Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
