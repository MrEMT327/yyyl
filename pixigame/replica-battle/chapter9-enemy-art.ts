import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  122024: {
    name: 'verdant-bastion', model: 'Plane48_elite1', tier: '精英', regions: {"hull":[95,122,331,319],"module":[593,185,204,194],"blade":[1033,99,87,342],"wing":[85,542,333,290],"fin":[617,530,147,293],"backing":[953,562,223,250],"tail":[191,893,126,299],"pod":[521,924,305,250],"vent":[943,995,244,145]},
    parts: r => {
      // Only native decorative expanded outline masks are omitted, not warning effects.
      const part = ({ Plane48_elite1b: 'vent', Plane48_elite2: 'module', Plane48_elite3c: 'blade',
        Plane48_elite3d: 'wing', Plane48_elite4: 'fin', Plane48_elite4b: 'backing',
        Plane48_elite5: 'hull', Plane48_elite6: 'tail', Plane48_elite7: 'pod', Plane48_elite8: 'module' } as Record<string, string>)[r.sprite];
      return part ? [{ part, order: ({ backing: -3, tail: -2, pod: -1, blade: -1, wing: 0,
        fin: 0, hull: 1, vent: 2, module: 3 } as Record<string, number>)[part] }] : [];
    },
  },
  120178: {
    name: 'mosswing-scout', model: 'Plane13_4', tier: '普通', regions: {"hull":[35,106,696,578],"wing":[787,185,435,415],"emitter":[217,760,198,358],"deck":[604,772,554,338]},
    parts: r => r.sprite === 'monster13_1' ? [
      { part: 'wing', w: .34, h: .56, x: -.31, y: -.06, flip: true, order: -1 },
      { part: 'wing', w: .34, h: .56, x: .31, y: -.06, order: -1 },
      { part: 'hull', w: .8, h: .9, order: 0 },
      { part: 'deck', w: .38, h: .35, y: -.08, order: 1 },
      // Original sprite width/height/ppu and native slots 6/9: x=+/-1.125, z=.325.
      // Place the emitter tips at those existing mounts; no simulation mount is moved.
      { part: 'emitter', w: .13, h: .36, x: -1.125 * 81.81818389892578 / 256,
        y: .32499998807907104 * 81.81818389892578 / 153 - .18, pinned: true, order: 2 },
      { part: 'emitter', w: .13, h: .36, x: 1.125 * 81.81818389892578 / 256,
        y: .32499998807907104 * 81.81818389892578 / 153 - .18, pinned: true, order: 2 },
    ] : [],
  },
  120176: {
    name: 'jade-rebound', model: 'Plane3_1', tier: '普通', regions: {"hull":[107,49,517,643],"wing":[744,151,452,383],"plate":[125,804,495,361],"pod":[857,721,246,460]},
    parts: r => {
      const part = ({ monster3_2: 'wing', monster3_1_2: 'wing', monster3_1_3: 'hull',
        monster3_1_1: 'plate', monster3_1_4: 'pod' } as Record<string, string>)[r.sprite];
      return part ? [{ part, order: ({ wing: -1, pod: -1, hull: 0, plate: 1 } as Record<string, number>)[part] }] : [];
    },
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter9-${s.name}-v1`;

export function preloadChapter9Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter9-${skin.name}-v1/parts.png`);
  }
}

export function createChapter9Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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

export function updateChapter9Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
