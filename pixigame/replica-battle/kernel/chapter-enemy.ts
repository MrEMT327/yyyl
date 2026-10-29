import type { Point } from './model';
import { advanceBossMove, bossRandomTarget, type CameraRect } from './enemy-ai';

type Parameters = Record<string, any>;

/** AICommonBoss constructor 0x690c78c and InitWeapons 0x6909b0c.
 * The unconfigured Boss 340021 uses these ranges, not chapter 1's override. */
export function nativeCommonBossSettings(parameters: Parameters, weaponIndex: number) {
  const cds = parameters.fireCDs as number[] | undefined;
  return {
    minZ: Number(parameters.MinZs?.[weaponIndex] ?? 29491 / 65536),
    maxZ: Number(parameters.MaxZs?.[weaponIndex] ?? 55705 / 65536),
    moveType: Number(parameters.WeaponMoveTypes?.[weaponIndex] ?? 0),
    weaponWeight: Number(parameters.WeaponWeights?.[weaponIndex] ?? 10),
    cooldownMin: cds && cds.length >= 2 ? Number(cds[0]) : 1,
    cooldownMax: cds && cds.length >= 2 ? Number(cds[1]) : 1,
  };
}

/** AICommonBoss.onRandomAI / onLaser. The red-line task may move; after it
 * ends, aimGap, AttackAction and fireCD run sequentially without movement.
 * The explicit ignore-warning branch instead moves alongside Attack+Wait. */
export function nativeCommonBossLaserPlan(trajectory: string, parameters: Parameters) {
  const warning = trajectory.toLowerCase().includes('laser') && parameters.IsIgnoreLaserWarning !== 1;
  return { warning: warning ? 1 : 0, gap: warning ? 13107 / 65536 : 0 };
}

/** AIMoveFollowTarget.OnUpdateAttack 0x68f000c. It translates in world space,
 * stops inside its own ShapeRadius-FollowOffset, and does not turn or shoot.
 * Native MoveTranslate does not clamp the displacement to the target. */
export function advanceNativeFollowTarget(position: Point, target: Point, speed: number, shapeRadius: number, dt: number, parameters: Parameters): void {
  const dx = target.x - position.x, dz = target.z - position.z;
  const distance = Math.hypot(dx, dz);
  const stop = shapeRadius - Number(parameters.FollowOffset ?? 0);
  if (distance * distance <= stop * stop || distance === 0) return;
  const step = speed * Number(parameters.FollowSpeedScale ?? 0) * dt;
  position.x += dx / distance * step; position.z += dz / distance * step;
}

export interface NativeBoss340001State {
  phase: 'moving' | 'attacking'; elapsed: number; target?: Point;
}
export function createNativeBoss340001State(): NativeBoss340001State {
  return { phase: 'moving', elapsed: 0 };
}

/** AI340001.InitAttackLoop 0x6904ca4: horizontal random movement for
 * fireInterval, then one RandomWeapon AttackAction. No post-attack 1s wait.
 * Returns true exactly when caller must choose a uniform random weapon/start
 * its animation; pass attackFinished only on native-style OnFireEnd. */
export function advanceNativeBoss340001(
  state: NativeBoss340001State, position: Point, bounds: CameraRect,
  radius2: number, speed: number, dt: number, random: () => number,
  attackFinished: boolean, parameters: Parameters,
): boolean {
  if (state.phase === 'attacking') {
    if (attackFinished) { state.phase = 'moving'; state.elapsed = 0; state.target = undefined; }
    return false;
  }
  if (!state.target || (position.x === state.target.x && position.z === state.target.z)) {
    state.target = bossRandomTarget(position, bounds, 36044 / 65536, 55705 / 65536, radius2, 1, random);
  }
  advanceBossMove(position, state.target, speed, dt, 1);
  state.elapsed += dt;
  const interval = Number(parameters.fireInterval ?? 0);
  if (interval > 0 && state.elapsed >= interval) { state.phase = 'attacking'; return true; }
  return false;
}

export function nativeUpDownParameters(parameters: Parameters) {
  return {
    minTopZ: Number(parameters.minTopZ ?? 52428 / 65536), maxTopZ: Number(parameters.maxTopZ ?? 58982 / 65536),
    minBottomZ: Number(parameters.minBottomZ ?? 0), maxBottomZ: Number(parameters.maxBottomZ ?? 6553 / 65536),
    slowSpeedPercent: Number(parameters.slowSpeedPercent ?? .5),
    minDuration: Number(parameters.minDuration ?? 1), maxDuration: Number(parameters.maxDuration ?? 3),
    alarmTime: Number(parameters.alarmTime ?? 6553 / 65536), repetitions: Number(parameters.repetitions ?? 3),
    rushSpeed: Number(parameters.RushSpeed ?? 35), showShadow: Number(parameters.ShowShadow ?? 0),
    shadowFadeTime: Number(parameters.ShadowFadeTime ?? 26214 / 65536),
    upFireDelay: Number(parameters.MoveUpFireDelayTime ?? 17694 / 65536),
    upFireInterval: Number(parameters.MoveUpFireInterval ?? 19660 / 65536),
  };
}
export interface NativeUpDownState {
  phase: 'wandering' | 'warning' | 'down' | 'up'; elapsed: number;
  wanderDuration: number; target?: Point; upDelayElapsed: number; callbackElapsed: number;
}
export function createNativeUpDownState(parameters: Parameters, random: () => number): NativeUpDownState {
  const p = nativeUpDownParameters(parameters);
  return { phase: 'wandering', elapsed: 0, wanderDuration: p.minDuration + random() * (p.maxDuration - p.minDuration), upDelayElapsed: 0, callbackElapsed: 0 };
}
/** Native InitAttackLoop sums 2*alarm+.0499725 for each flash, halving alarm.
 * This is distinct from Weapon.AttackAlarmtTime; the direct-fire callback does
 * not run the character weapon animation state machine. */
export function nativeUpDownWarningDuration(parameters: Parameters): number {
  const p = nativeUpDownParameters(parameters);
  let duration = 0, alarm = p.alarmTime;
  for (let i = 0; i < p.repetitions; i++) { duration += alarm * 2 + 3275 / 65536; alarm = Math.floor(alarm * 32768) / 65536; }
  return duration;
}

/** AIMoveUpDown + MonsterMoveTopToBottom. `fire` is a direct CreateWeaponAndFire
 * request at the CURRENT position/rotation, never a new animation attack.
 * The first five chapters configure ShowShadow=0, so down-travel callbacks are
 * cosmetic no-ops. Upward callbacks and arrival at bottom do fire weapons. */
export function advanceNativeUpDown(
  state: NativeUpDownState, position: Point, bounds: CameraRect, radius2: number,
  ordinarySpeed: number, dt: number, random: () => number, parameters: Parameters,
  onFire?: () => void,
): { fire: boolean; warningStarted: boolean; phase: NativeUpDownState['phase'] } {
  const p = nativeUpDownParameters(parameters);
  let fire = false, warningStarted = false;
  const fireNow = () => { fire = true; onFire?.(); };
  if (state.phase === 'wandering') {
    if (!state.target || (position.x === state.target.x && position.z === state.target.z)) state.target = bossRandomTarget(position, bounds, p.minTopZ, p.maxTopZ, radius2, 1, random);
    advanceBossMove(position, state.target, ordinarySpeed, dt, 1);
    state.elapsed += dt;
    if (state.elapsed >= state.wanderDuration) { state.phase = 'warning'; state.elapsed = 0; warningStarted = true; }
  } else if (state.phase === 'warning') {
    state.elapsed += dt;
    if (state.elapsed >= nativeUpDownWarningDuration(parameters)) {
      state.phase = 'down'; state.elapsed = 0;
      state.target = bossRandomTarget(position, bounds, p.minBottomZ, p.maxBottomZ, radius2, 2, random);
    }
  } else if (state.target) {
    // Native callback timer is updated before checking destination arrival.
    if (state.phase === 'down') {
      state.callbackElapsed += dt;
      if (state.callbackElapsed >= 3276 / 65536) state.callbackElapsed = 0;
    } else if (state.phase === 'up') {
      if (state.upDelayElapsed < p.upFireDelay) state.upDelayElapsed += dt;
      else { state.callbackElapsed += dt; if (state.callbackElapsed >= p.upFireInterval) { state.callbackElapsed = 0; fireNow(); } }
    }
    if (position.x === state.target.x && position.z === state.target.z) {
      if (state.phase === 'down') {
        state.phase = 'up'; state.upDelayElapsed = 0;
        state.target = bossRandomTarget(position, bounds, p.minTopZ, p.maxTopZ, radius2, 2, random);
        fireNow();
      } else {
        Object.assign(state, createNativeUpDownState(parameters, random));
        return { fire, warningStarted, phase: state.phase };
      }
    }
    advanceBossMove(position, state.target!, p.rushSpeed * (state.phase === 'up' ? p.slowSpeedPercent : 1), dt, 2);
  }
  return { fire, warningStarted, phase: state.phase };
}
