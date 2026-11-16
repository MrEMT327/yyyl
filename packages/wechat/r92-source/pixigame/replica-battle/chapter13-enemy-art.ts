import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  120160: {
    name: 'neon-ricochet', model: 'Plane27', tier: '普通', regions: {"hull":[151,15,309,760],"wing":[698,44,636,704],"vent":[1533,33,217,722]},
    parts: r => {
      const part = ({ plane27_1: 'hull', plane27_2: 'wing', plane27_3: 'vent' } as Record<string, string>)[r.sprite];
      // All four native entity variants share only appearance. Original wing
      // reflection, five bobbing nodes and +/-60-degree shots are unchanged.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  120172: {
    name: 'neon-prism', model: 'Plane17_1', tier: '精英', regions: {"hull":[72,105,624,565],"pad":[801,55,542,626],"cap":[1519,95,407,555]},
    parts: r => {
      const part = ({ monster17_1_1: 'hull', monster17_1_2: 'cap', monster17_1_3a: 'pad' } as Record<string, string>)[r.sprite];
      // Native local translations/scales and visibility, with one static
      // replacement for the original decorative sprite sequence.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  121003: {
    name: 'neon-twinrotor', model: 'Plane_boss_3', tier: 'Boss', regions: {"hull":[34,14,547,713],"rotor":[599,91,615,569],"rearRotor":[48,743,517,471],"cap":[702,778,416,415]},
    parts: r => {
      const part = ({ stg_boss_3_1: 'hull', stg_boss_3_2: 'cap', stg_boss_3_3: 'rotor', stg_boss_3_5: 'rearRotor' } as Record<string, string>)[r.sprite];
      // Each rotor follows its original, oppositely rotating native node.
      // No procedural fire events, gameplay clock or new muzzle coordinates.
      return part ? [{ part, pinned: true }] : [];
    },
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter13-${s.name}-v1`;

export function preloadChapter13Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter13-${skin.name}-v1/parts.png`);
  }
}

export function createChapter13Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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

export function updateChapter13Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
