import type Phaser from 'phaser';
import type { Enemy, Point, RecordData } from './kernel/model';
import { sampleNativeEnemyAnimation, type NativeEnemyAnimationSource } from './kernel/native-enemy-animation';
import { nativeLogicDelta } from './kernel/native-time';
import { createEnemyFlightMotion } from './scatter-gunboat-flight';

type Region = readonly [number, number, number, number];
type PartSpec = { part: string; w?: number; h?: number; x?: number; y?: number; flip?: boolean; pinned?: boolean; order?: number };
type Skin = { name: string; model: string; tier: string; regions: Record<string, Region>; parts: (r: RecordData) => PartSpec[] };
const skins: Record<number, Skin> = {
  120182: {
    name: 'canopy-prowler', model: 'Plane40', tier: '普通', regions: {"hull":[86,78,350,351],"body":[523,109,327,324],"tail":[998,99,138,330],"fin":[198,481,105,280],"wing":[501,487,307,271],"vane":[929,489,260,293],"pod":[152,807,190,311],"grille":[501,829,320,297],"cap":[956,857,222,243]},
    parts: r => {
      const part = ({ planne40_1: 'cap', planne40_2: 'cap', planne40_3: 'cap', planne40_4: 'cap',
        planne40_5: 'grille', planne40_6: 'hull', planne40_7: 'pod', planne40_8: 'body',
        planne40_9: 'tail', planne40_10: 'fin', planne40_11: 'wing', planne40_12: 'vane' } as Record<string, string>)[r.sprite];
      // Original sixteen renderer paths, pivots, order and local motions.
      return part ? [{ part, pinned: true }] : [];
    },
  },
  121005: {
    name: 'rainforest-aegis', model: 'Plane_boss_5', tier: 'Boss', regions: {"hull":[25,37,590,570],"wing":[652,48,322,573],"bridge":[1007,116,216,466],"laser":[78,650,206,578],"cannon":[393,705,256,490],"vent":[710,794,515,298]},
    parts: r => r.sprite === 'monster13' ? [
      { part: 'wing', w: .3, h: .82, x: -.35, flip: true, pinned: true, order: -2 },
      { part: 'wing', w: .3, h: .82, x: .35, pinned: true, order: -2 },
      { part: 'hull', w: .82, h: .88, pinned: true, order: -1 },
      { part: 'bridge', w: .16, h: .38, y: -.13, pinned: true, order: 1 },
      { part: 'vent', w: .27, h: .12, y: -.3, pinned: true, order: 2 },
      // Native sprite is 3.12 x 1.87 units under a -2.5 X/Z basis.
      // Tip positions are original slots 11/12, not newly chosen muzzle points.
      ...[[-.8399999737739563, .38999998569488525], [.8500000238418579, .38999998569488525]].map(([x, z]) =>
        ({ part: 'laser', w: .055, h: .24, x: -x / 7.8, y: z / 4.675 - .12, pinned: true, order: 3 })),
      // Preserve exact slot 5..10 positions. The original per-weapon rotations
      // remain entirely in simulation, including the ring and crossed salvos.
      ...[[-2.812000036239624, 1.7580000162124634], [-2.812000036239624, .7829999923706055],
        [-2.812000036239624, -.19599999487400055], [2.819999933242798, 1.7580000162124634],
        [2.8199996948242188, .7829999923706055], [2.8199996948242188, -.19599999487400055]].map(([x, z]) =>
        ({ part: 'cannon', w: .07, h: .13, x: -x / 7.8, y: z / 4.675 - .065, pinned: true, order: 3 })),
    ] : [],
  },
};

type Layer = { image: Phaser.GameObjects.Image; path: string; index: number; rest: number[]; spec: PartSpec;
  width: number; height: number; pivotX: number; pivotY: number; order: number };
type State = { layers: Layer[]; px: number; animation?: RecordData; local?: NativeEnemyAnimationSource;
  flight: ReturnType<typeof createEnemyFlightMotion>; position?: Point; revision?: number };
const states = new WeakMap<Phaser.GameObjects.Container, State>();
const keyFor = (s: Skin) => `owned-enemy:chapter12-${s.name}-v1`;

export function preloadChapter12Enemies(scene: Phaser.Scene, models: Iterable<number>): void {
  for (const id of new Set(models)) {
    const skin = skins[id];
    if (skin && !scene.textures.exists(keyFor(skin)))
      scene.load.image(keyFor(skin), `assets/owned-enemies/chapter12-${skin.name}-v1/parts.png`);
  }
}

export function createChapter12Enemy(scene: Phaser.Scene, id: number, px: number, prefab: RecordData | undefined,
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

export function updateChapter12Enemy(view: Phaser.GameObjects.Container, enemy: Enemy, position: Point, dt: number): boolean {
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
