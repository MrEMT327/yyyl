/** Static translation of APK 1.1.6's queue/spread branches. Evidence:
 * research/salvo-{shape,order,mount}-implementation-native.txt.
 * This declares handler coverage, not visual/playtest or PRNG-seed equivalence. */
export const nativeSalvoFeatures = Object.freeze({
  strictIntegerFlags: true,
  confusion: true,
  alternatingShapeS: true,
  symmetricMountQueues: true,
  firePositionRotations: true,
  fixedPointAngleSampling: true,
  nonDefaultShapeLocksAim: true,
  defaultShapeNativeAimBranches: true,
});

const FP = 65536;
const DEG = Math.PI / 180;
const raw = (value: number): number => Math.trunc(value * FP);
const multiplyRaw = (a: number, b: number): number => Math.floor(a * b / FP);

/** XXRandom.Next(FP,FP)@43a5408 orders the endpoints and consumes one
 * 16-bit fractional draw, even for equal endpoints. The host supplies its RNG;
 * this does not claim that the host's seed/generator is the APK's 48-bit LCG. */
export function nativeSalvoRandomRange(min: number, max: number, random: () => number): number {
  const a = raw(min), b = raw(max), lo = Math.min(a, b), hi = Math.max(a, b);
  const sample = Math.min(FP - 1, Math.max(0, Math.floor(random() * FP)));
  return (lo + multiplyRaw(sample, hi - lo)) / FP;
}

/** GetRandomDeflectionAngle@6e421bc. This is separate from Confusion:
 * a positive bullet+owner angle samples [-angle/2,angle/2); zero uses no RNG. */
export function nativeSalvoDeflection(angleDegrees: number, random: () => number): number {
  const angle = raw(angleDegrees);
  if (angle < 1) return 0;
  const half = multiplyRaw(angle, FP / 2) / FP;
  return nativeSalvoRandomRange(-half, half, random);
}

/** WeaponFire@6e4378c: only queue 0 keeps the initial direction; every
 * subsequent queue reverses it when symmetric shooting is enabled.
 * getIsClockwiseInShapeS@6e4a3ac alternates successive ONE-based rounds.
 * All SalvoMod integer switches are strictly ==1 (FillLoadData@6e31ba0). */
export function nativeSalvoClockwise(parameters: NativeSalvoParameters, queueIndex: number, repeat: number): boolean {
  const clockwise = Number(parameters.IsClockWise || 0) === 1;
  const first = Number(parameters.IsSymmetricShooting || 0) === 1 && queueIndex !== 0 ? !clockwise : clockwise;
  return Number(parameters.IsShapeS || 0) === 1 && repeat % 2 !== 0 ? !first : first;
}

export interface NativeSalvoParameters {
  Confusion?: number;
  IsClockWise?: number;
  IsShapeS?: number;
  IsSymmetricShooting?: number;
}
export interface NativeSalvoShot {
  angle: number;
  delay: number;
  repeat: number;
  index: number;
  /** Salvo spread has ShapeType5; the single-bullet shortcut remains type0. */
  shapeType: 0 | 5;
  deflectionDegrees: number;
  /** Native only allows dual/side splitting on the middle shot of an odd fan. */
  primary: boolean;
}

export interface NativeSalvoOptions {
  count: number;
  totalAngleDegrees: number;
  baseAngle: number;
  startAngleDegrees?: number;
  /** Non-default salvo overrides StartAngle when BulletRotate2Target==1 or
   * BulletToAlarmPos==1. This is a queue-time target, not per-shot retargeting. */
  targetAngle?: number;
  salvoMod: boolean;
  queueIndex?: number;
  parameters?: NativeSalvoParameters;
  bulletInterval?: number;
  repeats?: number;
  repeatInterval?: number;
  deflectionAngleDegrees?: number;
  /** WeaponPreFire samples once before all mount queues; each queue's first
   * round reuses that value. The caller must provide the shared sample. */
  firstDeflectionDegrees?: number;
  random: () => number;
}

export function nativeSalvoPattern(options: NativeSalvoOptions): NativeSalvoShot[] {
  const count = Math.max(1, Math.trunc(options.count));
  const repeats = Math.max(1, Math.trunc(options.repeats ?? 1));
  const parameters = options.parameters || {};
  const total = raw(options.totalAngleDegrees);
  const denominator = total >= 360 * FP ? count : count - 1;
  const step = denominator ? Math.trunc(total / denominator) : 0;
  const interval = raw(options.bulletInterval ?? 0), repeatInterval = raw(options.repeatInterval ?? 0);
  const deflection = () => nativeSalvoDeflection(options.deflectionAngleDegrees ?? 0, options.random);
  const shots: NativeSalvoShot[] = [];
  for (let repeat = 0; repeat < repeats; repeat++) {
    // LoadFireQueue@6e44bf8 draws before entering each later fan, even when
    // that round's first shot will be live-aimed again by the default branch.
    const firstDeflection = repeat === 0 ? options.firstDeflectionDegrees ?? 0 : deflection();
    const clockwise = nativeSalvoClockwise(parameters, options.queueIndex ?? 0, repeat);
    const sign = clockwise ? -1 : 1;
    const half = multiplyRaw(clockwise ? -total : total, FP / 2);
    const shapeType = options.salvoMod && count > 1 ? 5 : 0;
    // Count==1 bypasses onCreateSpreadShape entirely, including StartAngle.
    const base = count === 1 ? options.baseAngle
      : options.salvoMod && options.targetAngle !== undefined ? options.targetAngle
      : options.startAngleDegrees ? options.startAngleDegrees * DEG : options.baseAngle;
    for (let index = 0; index < count; index++) {
      // Confusion is a boolean switch, NOT a number of jitter degrees.
      // onCreateSpreadShape@6e4f65c draws for EVERY fan shot, before that
      // shot's independent GetRandomDeflectionAngle call (except shot0).
      const displacement = count > 1 && Number(parameters.Confusion || 0) === 1
        ? raw(nativeSalvoRandomRange(0, total / FP, options.random)) : index * step;
      const spread = count > 1 ? (half - sign * displacement) / FP : 0;
      const randomAngle = index === 0 ? firstDeflection : deflection();
      shots.push({ angle: base + (spread + randomAngle) * DEG,
        delay: (repeat * repeatInterval + index * interval) / FP,
        repeat, index, shapeType, deflectionDegrees: randomAngle,
        primary: count === 1 || (count % 2 === 1 && index === Math.floor(count / 2)) });
    }
  }
  return shots;
}

/** CalculateRotation@6e488c8 applies the queue-indexed table rotation AFTER
 * fireData.rotation * CalculateDeltaRotation; it is not a modulo lookup. */
export function nativeFirePositionAngle(rotations: readonly number[] | undefined, queueIndex: number): number {
  return rotations && queueIndex >= 0 && queueIndex < rotations.length ? Number(rotations[queueIndex]) * DEG : 0;
}

/** CalculateDeltaRotation@6e47cd0. FireRotation=1 only selects the initial
 * queue direction: it is NOT permission to recalculate it from a moving muzzle.
 * A replacement rotation cancels the entire saved rotation, including jitter.
 * FirePosRotations are applied afterwards by CalculateRotation. */
export function nativeShotAimMode(shapeType: number, parameters: {
  DisableRealTimeTarget?: number; BulletRotate2Target?: number;
  BulletToAlarmPos?: number; RealTimeEntityRotation?: number; FireRotation?: number;
}): 'queued' | 'target' | 'owner' | 'radial' {
  if (shapeType !== 0) return 'queued';
  if (!Number(parameters.DisableRealTimeTarget || 0)
    && Number(parameters.BulletRotate2Target || 0) >= 1
    && !Number(parameters.BulletToAlarmPos || 0)) return 'target';
  if (Number(parameters.RealTimeEntityRotation || 0) !== 1) return 'queued';
  return Number(parameters.FireRotation || 0) === 3 ? 'radial' : 'owner';
}
