import type { Point } from './model';
import behaviorSource from '../public/data/boss-behavior.json';

export type BossWeaponMetadata = {
  animationId: number; alarmEffect: number; alarmSeconds: number; fireHoldSeconds: number;
  enterHold: number | null; fireEvent: number | null; exitFire: number | null; exitEnd: number | null;
  model: string; trajectory: string; holdEffect: number; holdCompleteEffect: number;
};
export const nativeBossWeapons = behaviorSource.weapons as Record<number, BossWeaponMetadata>;
const entityWeapons = (behaviorSource as unknown as {
  entityWeapons?: Record<number, Record<number, BossWeaponMetadata>>;
}).entityWeapons;
export const nativeBossEntities = behaviorSource.entities as Record<number, {
  model: string; ai: string; parameters: Record<string, unknown>; weapons: number[];
}>;

/** Weapon IDs are reused by different prefab controllers; callbacks belong to an entity/model. */
export function nativeBossWeaponFor(entityId: number, weaponId: number): BossWeaponMetadata | undefined {
  const specific = entityWeapons?.[entityId];
  if (specific) return specific[weaponId];
  const legacy = nativeBossWeapons[weaponId];
  return legacy?.model === nativeBossEntities[entityId]?.model ? legacy : undefined;
}

export function bossAnimationNames(weaponId: number, entityId?: number) {
  const row = entityId === undefined ? nativeBossWeapons[weaponId] : nativeBossWeaponFor(entityId, weaponId);
  if (!row || row.animationId <= 0) return undefined;
  const suffix = String(row.animationId).padStart(2, '0');
  return { enter: `SkillEnter${suffix}`, hold: `SkillHold${suffix}`, fireHold: `SkillFireHold${suffix}`, exit: `SkillExit${suffix}` };
}

/** EntityCharacterData.SetShapeScale (0x6c04b58). ModelScale is NOT this argument. */
export function nativeShapeRadii(shape: number[], shapeScale = 1): { radius: number; radius2: number } {
  if (shape.length === 2) {
    const x = shape[0] * shapeScale, z = shape[1] * shapeScale;
    return { radius: Math.hypot(x, z), radius2: Math.min(x, z) };
  }
  const radius = (shape.length === 1 ? shape[0] : 3275 / 65536) * shapeScale;
  return { radius, radius2: radius };
}

/** EntitySplitBronMoveToTargetPos.OnUpdate: clamped linear interpolation, not ease-out. */
export function sampleBornPosition(start: Point, destination: Point, elapsed: number, duration: number): Point {
  const t = duration <= 0 ? 1 : Math.max(0, Math.min(1, elapsed / duration));
  return { x: start.x + (destination.x - start.x) * t, z: start.z + (destination.z - start.z) * t };
}

/** Both Hold variants select the blocking alarm substate only when an effect exists. */
export function weaponAlarmSeconds(effectId: number, milliseconds: number, fallbackSeconds = 0): number {
  if (effectId <= 0) return 0;
  return milliseconds > 0 ? Math.floor(milliseconds * 65536 / 1000) / 65536 : fallbackSeconds;
}

/** Confirmed data; animation callback latency is intentionally not guessed. */
export const bossAttackTiming: Readonly<Record<number, {
  animationId: number; alarmEffect: number; alarmSeconds: number;
  fireHoldSeconds: number; afterAttackCooldown: number;
}>> = Object.freeze(Object.fromEntries(Object.entries(nativeBossWeapons).map(([id, row]) => [id, {
  animationId: row.animationId, alarmEffect: row.alarmEffect, alarmSeconds: row.alarmSeconds,
  fireHoldSeconds: row.fireHoldSeconds, afterAttackCooldown: 1,
}])));

/** Events read from the original plane_boss_2 controller's animationId=1 clips. */
export const bossAnimationEvents = Object.freeze({ enterHold: 0.01666666753590107, exitEnd: 0.2666666805744171 });

/** Hold and FireHold each have their own Alarm substate. FireHold -> Exit suppresses Exit's Fire event. */
export function bossAttackTimeline(weaponId: number, holdTime: number, animationSpeed = 1, entityId?: number) {
  const events = entityId === undefined ? nativeBossWeapons[weaponId] : nativeBossWeaponFor(entityId, weaponId);
  const timing = events;
  // animationId=0 weapons (Boss 340009) are fired by AI callbacks directly.
  if (!timing || !events || events.enterHold === null || events.exitEnd === null || animationSpeed <= 0) return undefined;
  const fireEvent = timing.fireHoldSeconds > 0 ? events.fireEvent : events.exitFire;
  if (fireEvent === null) return undefined;
  const speed = animationSpeed;
  const enter = events.enterHold / speed;
  const firstAlarmEnd = enter + timing.alarmSeconds;
  const holdEnd = firstAlarmEnd + Math.max(0, holdTime);
  const fireHoldStart = holdEnd + (timing.fireHoldSeconds > 0 ? timing.alarmSeconds : 0);
  const firstFire = fireHoldStart + fireEvent / speed;
  const exitStart = fireHoldStart + timing.fireHoldSeconds;
  // CeaseFire/laser tracking must also finish before finishBossAttack is called.
  return { enter, firstAlarmEnd, holdEnd, firstFire, fireHoldStart, exitStart, exitEnd: exitStart + events.exitEnd / speed };
}

/** Native AttackAction finishes on OnFireEnd; its AI cooldown starts AFTER that event. */
export interface BossAttackGate { phase: 'attacking' | 'cooldown' | 'ready'; remaining: number }
export function createBossAttackGate(): BossAttackGate { return { phase: 'attacking', remaining: 0 }; }
export function finishBossAttack(gate: BossAttackGate, cooldown = 1): void {
  if (gate.phase !== 'attacking') return;
  gate.phase = 'cooldown'; gate.remaining = Math.max(0, cooldown);
}
export function advanceBossCooldown(gate: BossAttackGate, dt: number): boolean {
  if (gate.phase === 'cooldown') {
    gate.remaining -= dt;
    if (gate.remaining <= 0) gate.phase = 'ready';
  }
  return gate.phase === 'ready';
}
