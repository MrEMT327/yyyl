import type { HitBuffMod } from './status-effects';
export type RecordData = Record<string, any>;
export type Phase = 'ready' | 'playing' | 'paused' | 'upgrade' | 'treasure' | 'revive' | 'won' | 'lost';
export interface Point { x: number; z: number }
export interface Spawn extends Point { time: number; entityId: number; eventId: number; wave: number; hpMultiplier: number; attackMultiplier: number; hpDropMultiplierRaw: number; exp: number; gold: number; carriesGold?: boolean; pathId?: number; boss?: boolean; loopZ: number; loopRestartZOffset: number; ignoreDrop?: boolean; parentUid?: number; creatorRepeat?: number; randomPlacement?: boolean }
export interface Enemy extends Point {
  uid: number; entityId: number; modelId: number; scale: number; hp: number; maxHp: number; attack: number; bodyAttack: number;
  radiusX: number; radiusZ: number; age: number; fireAt: number; weaponStep: number; wave: number;
  origin: Point; target: Point; pathDistance: number; angle: number; hitFlash: number;
  exp: number; gold: number; carriesGold?: boolean; hpDropMultiplierRaw: number; boss: boolean; elite: boolean; oldX: number; oldZ: number; dead: boolean; box: boolean;
  deathRemaining?: number; deathSound?: number; deathAge?: number;
  ignoreDrop?: boolean; parentUid?: number;
  animationClip?: string; animationTime?: number;
  /** Explicit view creation/reposition events; never used for collision. */
  viewResetPosition?: Point; viewPositionRevision?: number;
  laserWarning?: { target: Point; until: number; mounts: Point[] };
  urgencyWarning?: { startedAt: number; duration: number; posType: number };
}
export interface Projectile extends Point {
  originalThroughCount?: number;
  suppressFirstTargetEvent?: boolean;
  uid: number; owner: 'player' | 'enemy'; weaponId: number; bulletId: number; modelId: number;
  vx: number; vz: number; age: number; lifetime: number; scale: number; damage: number;
  radiusX: number; radiusZ: number; offsetZ: number; angle: number; pierce: number; bounce: number; follow: number;
  oldX: number; oldZ: number; hit: Set<number>; beam: boolean; beamLength: number; dead: boolean;
  hitInterval: number; ownerUid: number; hitTimes: Map<number, number>; box: boolean; critChance: number; critMultiplier: number; warmup: number; familyId: number; reflections: number;
  ray: boolean; segments: { from: Point; to: Point }[]; anchorX: number; anchorZ: number; throughDamage: number; throughScale: number;
  ricochet: number; ricochetRange: number; ricochetDamage: number; ricochetSpeed: number; explosion?: RecordData;
  scaleAnimation?: { start: number; target: number; duration: number; wait: number };
  followLimit?: number; followTurned?: number;
  attackSnapshot: number; hitBuffs: HitBuffMod[];
  birth?: Point; deathHandled?: boolean;
  ownerAngleAtBirth?: number; localMount?: Point;
  held?: boolean; collisionDisabled?: boolean; repeatHits?: boolean; damageDisabled?: boolean;
  fixedSegments?: boolean; targetUid?: number; flags?: number; traits?: number;
  visualAngle?: number;
  visualHidden?: boolean;
  offsetX?: number;
  visualScaleX?: number;
  runtimeMods?: RecordData[];
  trajectory?: string;
  trajectoryParameters?: RecordData;
}
export interface Pickup extends Point { uid: number; itemId: number; modelId: number; kind: 'exp' | 'gold' | 'heart' | 'buff' | 'trigger'; value: number; age: number; delay: number; attracted: boolean; state: 'scatter' | 'stay' | 'retreat' | 'absorb'; stateTime: number; speed: number; origin: Point; destination: Point; retreatDistance: number; retreatDuration: number }
export interface Effect extends Point { uid: number; kind: 'hit' | 'explosion' | 'muzzle' | 'text' | 'level' | 'heal'; age: number; duration: number; size: number; value?: string; modelId?: number; critical?: boolean; originalScale?: number; originalSpeed?: number; originalMirrorX?: boolean; angle?: number; ownerUid?: number; followPlayer?: boolean; followOffset?: Point }
export interface Choice { id: number; name: string; description: string; icon: string; star: number; group: number; advance?: number; parentStageId?: number; opensBreakthrough?: boolean; effects: RecordData[]; raw?: RecordData }
export interface CannonState { stageId: number; damageBonus: number; cooldownReduction: number; critBonus: number; parallel: number; parallelPercent: number; sidePercent: number; pierce: number; bulletId: number; fireCount: number; fireHoldBonus: number; fireInterval?: number; waitingForBeams?: boolean; hitBuffs?: HitBuffMod[]; throughDamage?: number }
export interface WeaponState extends CannonState { at: number; salvo: number; salvoAngle: number; homing: number; beamWidth: number; lifetime: number; lifetimePercent: number; range: number; reflections: number; skillDamage: number; critDamage: number; side: number; sideAngle: number; speedBonus: number; scaleBonus: number; ricochet: number; ricochetRange: number; ricochetDamage: number; ricochetSpeed: number; explosion?: RecordData; explosionScale: number; beamLength: number; hitIntervalFactor: number; disableThroughReduction: boolean;
  nativeAttributes?: Record<string, number>; nativeMods?: { name: string; args: RecordData }[]; nativeWeaponIds?: number[];
}
export function newWeapon(stageId: number, bulletId = 0): WeaponState { return { stageId, bulletId, at: 0, damageBonus: 0, cooldownReduction: 0, critBonus: 0, parallel: 1, parallelPercent: 0, sidePercent: 0, pierce: 0, fireCount: 1, fireHoldBonus: 0, salvo: 0, salvoAngle: 0, homing: 0, beamWidth: 0, lifetime: 0, lifetimePercent: 0, range: 0, reflections: 0, skillDamage: 0, critDamage: 0, side: 0, sideAngle: 10, speedBonus: 0, scaleBonus: 0, ricochet: 0, ricochetRange: 10, ricochetDamage: 0, ricochetSpeed: 0, explosionScale: 0, beamLength: 0, hitIntervalFactor: 1, disableThroughReduction: false }; }
export interface GameContent { chapter: RecordData; assets: RecordData; combat: RecordData; spawns: Spawn[]; world: { width: number; height: number }; }
export const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));
export const fp = (n: number) => n / 65536;
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Collider extends Point { oldX: number; oldZ: number; radiusX: number; radiusZ: number; box: boolean; angle: number }
function intervalSweep(x: number, z: number, dx: number, dz: number, rx: number, rz: number): number | null {
  let entry = 0, exit = 1;
  for (const [p, v, r] of [[x, dx, rx], [z, dz, rz]]) {
    if (Math.abs(v) < 1e-10) { if (Math.abs(p) > r) return null; continue; }
    const a = (-r - p) / v, b = (r - p) / v;
    entry = Math.max(entry, Math.min(a, b)); exit = Math.min(exit, Math.max(a, b));
    if (entry > exit) return null;
  }
  return entry;
}
function circleBox(circle: Collider, box: Collider): number | null {
  const co = Math.cos(box.angle), si = Math.sin(box.angle);
  const local = (x: number, z: number) => ({ x: x * co - z * si, z: x * si + z * co });
  const start = local(circle.oldX - box.oldX, circle.oldZ - box.oldZ);
  const end = local(circle.x - box.x, circle.z - box.z);
  const dx = end.x - start.x, dz = end.z - start.z, r = circle.radiusX;
  const times = [intervalSweep(start.x, start.z, dx, dz, box.radiusX + r, box.radiusZ), intervalSweep(start.x, start.z, dx, dz, box.radiusX, box.radiusZ + r)];
  for (const x of [-box.radiusX, box.radiusX]) for (const z of [-box.radiusZ, box.radiusZ]) times.push(sweptEllipse(start, end, { x, z }, { x, z }, r, r));
  const hits = times.filter((t): t is number => t !== null);
  return hits.length ? Math.min(...hits) : null;
}
export function sweep(a: Collider, b: Collider): number | null {
  if (!a.box && !b.box) return sweptEllipse({ x: a.oldX, z: a.oldZ }, a, b, { x: b.oldX, z: b.oldZ }, a.radiusX + b.radiusX, a.radiusX + b.radiusX);
  if (!a.box) return circleBox(a, b);
  if (!b.box) return circleBox(b, a);
  const axes = (angle: number) => [{ x: Math.cos(angle), z: -Math.sin(angle) }, { x: Math.sin(angle), z: Math.cos(angle) }];
  const aa = axes(a.angle), ba = axes(b.angle);
  const x = a.oldX - b.oldX, z = a.oldZ - b.oldZ, dx = a.x - b.x - x, dz = a.z - b.z - z;
  let entry = 0, exit = 1;
  for (const axis of [...aa, ...ba]) {
    const radius = Math.abs(axis.x * aa[0].x + axis.z * aa[0].z) * a.radiusX + Math.abs(axis.x * aa[1].x + axis.z * aa[1].z) * a.radiusZ + Math.abs(axis.x * ba[0].x + axis.z * ba[0].z) * b.radiusX + Math.abs(axis.x * ba[1].x + axis.z * ba[1].z) * b.radiusZ;
    const p = x * axis.x + z * axis.z, v = dx * axis.x + dz * axis.z;
    if (Math.abs(v) < 1e-10) { if (Math.abs(p) > radius) return null; continue; }
    const t0 = (-radius - p) / v, t1 = (radius - p) / v;
    entry = Math.max(entry, Math.min(t0, t1)); exit = Math.min(exit, Math.max(t0, t1));
    if (entry > exit) return null;
  }
  return entry;
}

// Sweep in relative target space, so a fast projectile cannot jump over a moving target.
export function sweptEllipse(a: Point, b: Point, target: Point, oldTarget: Point, rx: number, rz: number): number | null {
  const x = (a.x - oldTarget.x) / rx, z = (a.z - oldTarget.z) / rz;
  const dx = (b.x - target.x) / rx - x, dz = (b.z - target.z) / rz - z;
  const c = x * x + z * z - 1;
  if (c <= 0) return 0;
  const aa = dx * dx + dz * dz;
  if (aa < 1e-12) return null;
  const bb = 2 * (x * dx + z * dz), disc = bb * bb - 4 * aa * c;
  if (disc < 0) return null;
  const t = (-bb - Math.sqrt(disc)) / (2 * aa);
  return t >= 0 && t <= 1 ? t : null;
}

