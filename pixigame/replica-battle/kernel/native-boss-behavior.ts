import type { Point, RecordData } from './model';
import { selectBossWeapon, type CameraRect } from './enemy-ai';
import { nativeBehaviorMoveTarget, nativeCeaseFireDuration, parseNativeBehavior } from './enemy-behavior-extensions';

const only = (p: RecordData, keys: string[]) => Object.keys(p).every(key => keys.includes(key));
const finite = (value: unknown) => typeof value === 'number' && Number.isFinite(value);
const nonnegative = (value: unknown) => finite(value) && Number(value) >= 0;

/** This is the sequential subset first used by chapter 64 / 340037. It does
 * not certify parallel groups, callbacks, custom global status or new actions.
 * Animation events, weapon attributes and trajectories have separate gates. */
export function nativeSequentialBossSupported(entity: RecordData): boolean {
  const ai = entity.ai?.parameters || {};
  if (entity.ai?.type !== 'AICommonBossNew' || !entity.weaponIds?.length
    || !only(ai, ['Behaviour', 'FireCDs', 'WeaponWeights', 'NeedPlayAniIdleOnce', 'NeedSelectNearTargetOnce', 'InitStatus'])
    || ai.NeedPlayAniIdleOnce || ai.NeedSelectNearTargetOnce || Number(ai.InitStatus || 0) !== 0
    || !Array.isArray(ai.FireCDs) || ai.FireCDs.length !== 2 || !ai.FireCDs.every(nonnegative) || ai.FireCDs[1] < ai.FireCDs[0]
    || (ai.WeaponWeights !== undefined && (!Array.isArray(ai.WeaponWeights) || ai.WeaponWeights.length > entity.weaponIds.length
      || !ai.WeaponWeights.every(nonnegative)))
    || (ai.WeaponWeights?.length === entity.weaponIds.length && !ai.WeaponWeights.some((n: number) => n > 0))) return false;
  try {
    const nodes = parseNativeBehavior(ai.Behaviour);
    return nodes.length > 0 && nodes.every(({ name, parameters: p }) => {
      if (name === 'SetTarget') return Object.keys(p).length === 0;
      if (name === 'MoveToPoint') return only(p, ['MoveType', 'TargetX', 'TargetZ', 'EdgeMarginXPercent', 'EdgeMarginZTopPercent', 'EdgeMarginZBottomPercent', 'IsLoop'])
        && [0, 1].includes(Number(p.MoveType || 0)) && Number(p.IsLoop || 0) === 0
        && ['TargetX', 'TargetZ', 'EdgeMarginXPercent', 'EdgeMarginZTopPercent', 'EdgeMarginZBottomPercent'].every(key => p[key] === undefined || finite(p[key]))
        && Number(p.EdgeMarginXPercent || 0) >= 0 && Number(p.EdgeMarginXPercent || 0) <= .5
        && Number(p.EdgeMarginZTopPercent || 0) >= 0 && Number(p.EdgeMarginZBottomPercent || 0) >= 0
        && Number(p.EdgeMarginZTopPercent || 0) + Number(p.EdgeMarginZBottomPercent || 0) <= 1;
      if (name === 'MoveFollowTarget') return only(p, ['SpeedScale', 'FollowTime', 'Group', 'RotateToTarget'])
        && nonnegative(p.SpeedScale ?? 1) && finite(p.FollowTime) && Number(p.FollowTime) > 0
        && Number.isInteger(p.Group ?? 0) && !p.RotateToTarget;
      if (name === 'Attack') return only(p, ['OnlyFireInCamera', 'WeaponUseType', 'WeaponId', 'RotateToTarget'])
        && p.OnlyFireInCamera === false && Number(p.WeaponUseType) === 1
        && Number(p.WeaponId || 0) === 0 && !p.RotateToTarget;
      return false;
    });
  } catch { return false; }
}

/** EntityCharacterData.Register/UnregisterFollowSlot. Group lists retain holes;
 * a subsequent follower reuses the first empty slot, never compacts survivors.
 * This registry belongs to the single player target, shared by all enemies. */
export class NativeFollowSlots {
  private groups = new Map<number, (number | undefined)[]>();
  private followers = new Map<number, { group: number; index: number }>();
  clear(): void { this.groups.clear(); this.followers.clear(); }
  retain(alive: (uid: number) => boolean): void {
    for (const uid of this.followers.keys()) if (!alive(uid)) this.release(uid);
  }
  register(uid: number, group: number): void {
    if (this.followers.get(uid)?.group === group) return;
    this.release(uid);
    const slots = this.groups.get(group) || [];
    let index = slots.findIndex(value => value === undefined);
    if (index < 0) index = slots.length;
    slots[index] = uid; this.groups.set(group, slots); this.followers.set(uid, { group, index });
  }
  release(uid: number): void {
    const registration = this.followers.get(uid);
    if (!registration) return;
    this.groups.get(registration.group)![registration.index] = undefined;
    this.followers.delete(uid);
  }
  position(uid: number, group: number, target: Point, targetShapeRadius: number): Point {
    const registration = this.followers.get(uid);
    if (!registration || registration.group !== group) return { ...target };
    // EntityCharacterData..cctor: all four radius constants are raw 0x3333.
    const spacing = 13107 / 65536;
    const base = Math.max(targetShapeRadius * spacing, spacing);
    const max = Math.max(base, targetShapeRadius - spacing);
    const rings = Math.floor((max - base) / spacing) + 1;
    const radius = base + (Math.floor(registration.index / 8) % rings) * spacing;
    const angle = (registration.index % 8) * 45 * (1143 / 65536);
    // Existing H5 geometry uses JS trig; this is not the native FP lookup table.
    return { x: target.x + Math.cos(angle) * radius, z: target.z + Math.sin(angle) * radius };
  }
}

type Task = { kind: 'move'; point: Point; angle: number }
  | { kind: 'target' }
  | { kind: 'follow'; speedScale: number; duration: number; group: number }
  | { kind: 'attack'; weaponId: number; cooldown: number };
export interface NativeBossProgram {
  tasks: Task[]; index: number; started: boolean; elapsed: number;
  selectedTarget: boolean; attackPhase: 'ready' | 'attack' | 'cooldown';
}

/** ExecuteEntityBehaviour first rolls one weapon for the entire round, then
 * eagerly constructs every task. Random destinations and cooldowns must be
 * sampled here, in authored order, not when the task starts later. */
export function createNativeBossProgram(entity: RecordData, position: Point & { angle: number }, bounds: CameraRect,
  attackSpeed: number, random: () => number, selectedTarget = false): NativeBossProgram {
  if (!nativeSequentialBossSupported(entity)) throw new Error('Unsupported AICommonBossNew Behaviour');
  const ai = entity.ai.parameters;
  const weaponId = selectBossWeapon(entity.weaponIds, ai.WeaponWeights, random());
  const tasks: Task[] = parseNativeBehavior(ai.Behaviour).map(({ name, parameters: p }): Task => {
    if (name === 'MoveToPoint') return { kind: 'move', point: nativeBehaviorMoveTarget(position, bounds, p, random), angle: position.angle };
    if (name === 'SetTarget') return { kind: 'target' };
    if (name === 'MoveFollowTarget') return { kind: 'follow', speedScale: Number(p.SpeedScale ?? 1), duration: Number(p.FollowTime), group: Number(p.Group ?? 0) };
    const custom = ai.FireCDs[0] + random() * (ai.FireCDs[1] - ai.FireCDs[0]);
    return { kind: 'attack', weaponId, cooldown: nativeCeaseFireDuration(custom, Number(entity.stats.fireInterval || 0), 0, 1, 1, attackSpeed) };
  });
  return { tasks, index: 0, started: false, elapsed: 0, selectedTarget, attackPhase: 'ready' };
}

function moveTowards(position: Point, target: Point, distance: number): void {
  const x = target.x - position.x, z = target.z - position.z, length = Math.hypot(x, z);
  if (length <= distance || length === 0) { position.x = target.x; position.z = target.z; }
  else { position.x += x / length * distance; position.z += z / length * distance; }
}

/** TaskQueue and Sequence each advance at most one child per frame. In
 * particular Attack completion cannot also consume its following Wait frame.
 * Returns end-of-round so the caller immediately constructs the next round,
 * but does not execute that next round until the following logic frame. */
export function advanceNativeBossProgram(state: NativeBossProgram, actor: Point & { uid: number; angle: number },
  target: Point | undefined, targetRadius: number, speed: number, dt: number, slots: NativeFollowSlots,
  startAttack: (weaponId: number) => void, attackFinished: () => boolean): boolean {
  const task = state.tasks[state.index];
  let done = false;
  if (task.kind === 'move') {
    // MonsterMoveToPoint tests equality before moving, completing next tick.
    done = actor.x === task.point.x && actor.z === task.point.z;
    if (!done) { moveTowards(actor, task.point, speed * dt); actor.angle = task.angle; }
  } else if (task.kind === 'target') {
    state.selectedTarget = !!target; done = true;
  } else if (task.kind === 'follow') {
    if (!state.started && state.selectedTarget && target) slots.register(actor.uid, task.group);
    state.elapsed += dt;
    done = !state.selectedTarget || !target || state.elapsed >= task.duration;
    if (done) slots.release(actor.uid);
    else moveTowards(actor, slots.position(actor.uid, task.group, target!, targetRadius), speed * task.speedScale * dt);
  } else if (state.attackPhase === 'ready') {
    startAttack(task.weaponId); state.attackPhase = 'attack';
  } else if (state.attackPhase === 'attack') {
    if (attackFinished()) { state.attackPhase = 'cooldown'; state.elapsed = 0; }
  } else {
    state.elapsed += dt;
    done = state.elapsed >= task.cooldown;
  }
  state.started = true;
  if (done) {
    state.index++; state.started = false; state.elapsed = 0; state.attackPhase = 'ready';
  }
  return state.index === state.tasks.length;
}
