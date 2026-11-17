import type { Point } from './model';
import type { CameraRect } from './enemy-ai';
import enemyTimingSource from '../public/data/enemy-attack-timing.json';

type Parameters = Record<string, unknown>;
const FP = 65536;
const number = (p: Parameters, key: string, fallback = 0): number => {
  const value = p[key] === undefined ? fallback : Number(p[key]);
  if (!Number.isFinite(value)) throw new Error(`Invalid native AI parameter ${key}`);
  return value;
};

/** EntityCharacterTypeHelper.IsBoss, 0x6eaac88..0x6eaac9c. */
export function nativeIsBossType(type: number): boolean { return type === 3 || type === 15; }

/** Both InitAttackLoop implementations construct the same bottom + LoopZ +
 * nextPointOffsetZ target. The New implementation still uses MonsterMoveToPoint
 * with isLoop, and runs AttackActionLoop in parallel (0x68f70b4..0x68f7284). */
export function nativeIsBottomAttackAI(type: string): boolean {
  return type === 'AIMoveToBottomAndAttack' || type === 'AIMoveToBottomAndAttackNew';
}

export interface NativeBehaviorNode { name: string; parameters: Parameters }

/** Preserve authored task names and parameters; parsing does NOT certify that
 * an action executor exists. Never drop an unknown task from a behaviour chain. */
export function parseNativeBehavior(value: unknown): NativeBehaviorNode[] {
  if (value === undefined || value === '') return [];
  const sources = Array.isArray(value) ? value : [value];
  const result: NativeBehaviorNode[] = [];
  for (const encodedSource of sources) {
    if (typeof encodedSource !== 'string') throw new Error('Native Behaviour must contain strings');
    // Character_entity keeps one additional JSON-string escaping layer inside
    // Behaviour, e.g. MoveDynamicRotateCenter${\"CenterXPos\":0}.
    // Decode the whole string layer before scanning; replacing every backslash
    // would corrupt escaped quotes inside a legitimate string parameter.
    const source: string = /\$\s*\{\\"/.test(encodedSource)
      ? JSON.parse('"' + encodedSource + '"') : encodedSource;
    // The shipped descriptions separate actions with semicolons. Scan outside
    // JSON strings/brackets so later string parameters can contain semicolons.
    let start = 0, depth = 0, quoted = false, escaped = false;
    const parts: string[] = [];
    for (let i = 0; i < source.length; i++) {
      const ch = source[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') quoted = false;
      } else if (ch === '"') quoted = true;
      else if (ch === '{' || ch === '[') depth++;
      else if (ch === '}' || ch === ']') depth--;
      else if (ch === ';' && depth === 0) { parts.push(source.slice(start, i)); start = i + 1; }
      if (depth < 0) throw new Error('Unbalanced native Behaviour');
    }
    if (quoted || depth !== 0) throw new Error('Unterminated native Behaviour');
    parts.push(source.slice(start));
    for (const part of parts) {
      const text = part.trim();
      if (!text) continue;
      const split = text.indexOf('$');
      const name = split < 0 ? text : text.slice(0, split);
      const parameters = split < 0 ? {} : JSON.parse(text.slice(split + 1));
      if (!name || !parameters || typeof parameters !== 'object' || Array.isArray(parameters)) throw new Error(`Invalid native Behaviour action: ${name}`);
      result.push({ name, parameters });
    }
  }
  return result;
}

export interface DynamicRotateState {
  center: Point; radius: number; angleDegrees: number; rotateSpeed: number;
  changeToRadius: number; firstSpeed: number; secondSpeed: number;
  stopRemaining: number; clockwise: boolean; phase: 'contract' | 'wait' | 'collapse';
}

/** MonsterMoveDynamicRotateCenter.SetData 0x69d1964; OnStart sets state=2.
 * This is contract -> wait -> collapse to zero, NOT a repeating orbit. */
export function createNativeDynamicRotate(parameters: Parameters): DynamicRotateState {
  return {
    center: { x: number(parameters, 'CenterXPos'), z: number(parameters, 'CenterZPos') },
    radius: number(parameters, 'OriginRadius'), angleDegrees: number(parameters, 'OriginAngle'),
    rotateSpeed: number(parameters, 'RotateSpeed'), changeToRadius: number(parameters, 'ChangeToRadius'),
    firstSpeed: number(parameters, 'ChangeSpeedFirst'), secondSpeed: number(parameters, 'ChangeSpeedSecond'),
    stopRemaining: number(parameters, 'ChangeStopTime'), clockwise: parameters.IsClockwise === true,
    phase: 'contract',
  };
}

/** Returns true for the native Suicide(false) event. Caller must not award
 * kill rewards. Character heading is not changed by this movement action.
 * DxxFPMath.SinCos takes degrees with Q16 deg2rad=1143/65536; JS trig is an
 * approximation of the native LUT, not a bit-identical replacement. */
export function advanceNativeDynamicRotate(position: Point, state: DynamicRotateState, dt: number): boolean {
  if (state.phase === 'wait') {
    state.stopRemaining -= dt;
    if (state.stopRemaining <= 0) state.phase = 'collapse';
  } else {
    const remaining = state.phase === 'contract' ? state.radius - state.changeToRadius : state.radius;
    state.radius -= Math.min(remaining, (state.phase === 'contract' ? state.firstSpeed : state.secondSpeed) * dt);
    if (state.phase === 'contract' && state.radius === state.changeToRadius) state.phase = 'wait';
  }
  state.angleDegrees += state.rotateSpeed * dt * (state.clockwise ? -1 : 1);
  const radians = state.angleDegrees * (1143 / FP);
  position.x = state.center.x + Math.cos(radians) * state.radius;
  position.z = state.center.z + Math.sin(radians) * state.radius;
  return state.radius === 0;
}

export interface AimedAttackState {
  phase: 'ready' | 'warning' | 'gap' | 'attack' | 'wait';
  remaining: number; waitSeconds: number; aim?: Point;
}
export interface AimedAttackEvents {
  startWarning?: { duration: number; directionType: number };
  stopWarning?: boolean;
  attack?: { useType: number; targetAlarmPos?: Point };
  trackHeading: boolean;
}

export function createNativeAimedAttack(): AimedAttackState {
  return { phase: 'ready', remaining: 0, waitSeconds: 0 };
}

/** AI200007.AddAttack 0x6fabc08: lock aim -> WarnTime -> Attack(useType=1)
 * -> unlock aim -> random WaitTime. Report OnFireEnd via attackFinished;
 * the actor's FireCD must not be used as a substitute for the attack task. */
export function advanceNative200007(
  state: AimedAttackState, parameters: Parameters, dt: number, target: Point | undefined,
  random: () => number, attackFinished: boolean, attackRandomSuccess: boolean,
): AimedAttackEvents {
  const result: AimedAttackEvents = { trackHeading: state.phase === 'wait' };
  if (!target) return result;
  if (state.phase === 'attack') {
    if (attackFinished) { state.phase = 'wait'; state.remaining = state.waitSeconds; result.trackHeading = true; }
    return result;
  }
  if (state.phase === 'wait' || state.phase === 'warning') {
    state.remaining -= dt;
    if (state.remaining > 0) return result;
    if (state.phase === 'warning') {
      state.phase = 'attack'; result.stopWarning = true; result.attack = { useType: 1 }; return result;
    }
    state.phase = 'ready';
  }
  const min = number(parameters, 'WaitTimeMin'), max = number(parameters, 'WaitTimeMax');
  state.waitSeconds = min + random() * (max - min);
  if (!attackRandomSuccess) {
    state.phase = 'wait'; state.remaining = state.waitSeconds; result.trackHeading = true; return result;
  }
  state.phase = 'warning'; state.remaining = number(parameters, 'WarnTime');
  result.trackHeading = false;
  if (state.remaining > 0) result.startWarning = { duration: state.remaining, directionType: 0 };
  else { state.phase = 'attack'; result.attack = { useType: 1 }; }
  return result;
}

/** AI320013.onDataParse 0x68ea27c sets constants, ignoring fireInterval:
 * 1s tracked multi-red-line warning -> Q16 .2s gap -> AttackAction -> 1s wait.
 * Warning completion snapshots TargetAlarmPos (0x68eabac). */
export function advanceNative320013(
  state: AimedAttackState, parameters: Parameters, dt: number, target: Point | undefined, attackFinished: boolean,
): AimedAttackEvents {
  const result: AimedAttackEvents = { trackHeading: false };
  if (state.phase === 'attack') {
    if (attackFinished) { state.phase = 'wait'; state.remaining = 1; }
    return result;
  }
  if (state.phase !== 'ready') {
    state.remaining -= dt;
    if (state.remaining > 0) return result;
    if (state.phase === 'warning') {
      state.aim = target ? { ...target } : undefined;
      state.phase = 'gap'; state.remaining = 13107 / FP; result.stopWarning = true; return result;
    }
    if (state.phase === 'gap') {
      // AttackAction..ctor 0x699ba18 initializes _useType=Random (1).
      state.phase = 'attack'; result.attack = { useType: 1, targetAlarmPos: state.aim }; return result;
    }
    state.phase = 'ready';
  }
  state.phase = 'warning'; state.remaining = 1;
  result.startWarning = { duration: 1, directionType: number(parameters, 'WarningDir') };
  return result;
}

/** These declarations are intentionally fail-closed: their schemas have been
 * decoded, but their runtime contracts have not all been translated yet. */
export const nativeBehaviorUnresolved = Object.freeze({
  AICommonBossNew: 'Only sequential MoveToPoint/SetTarget/MoveFollowTarget/Attack with certified animation events is integrated; parallel groups, other actions and status variants remain blocked',
  CallMonsters: 'Only old CommonBoss single-config StraightFall with ordinary Type2 children, no protection/chapter features, no call hold and no overlapping streams is integrated; other branches remain blocked',
});

/** Observed by AICommonBoss.checkIfEnableCallMonster 0x690b970..0x690b9fc. */
export function nativeCallCooldownReady(now: number, callTimestamp: number, parameters: Parameters): boolean {
  return callTimestamp === 0 || now - callTimestamp >= number(parameters, 'CallCDTime', 12);
}

/** StraightFall passes ignoreDrop=true to CreateBaby (0x690bf5c). This flag
 * must suppress drops independently of whether summons count as kills. */
export const nativeStraightFallSummonIgnoresDrops = true;

/** AIStatusMoveToPointHandler.CalcTargetPosition/GetRandomPosInView:
 * type 0 is absolute X/Z, 1 samples camera rect inset by fractions of the
 * entire width/height. Other values retain the current position. No radius
 * padding is applied here (unlike the old CommonBoss random-move task). */
export function nativeBehaviorMoveTarget(position: Point, bounds: CameraRect, parameters: Parameters, random: () => number): Point {
  const kind = number(parameters, 'MoveType');
  if (kind === 0) return { x: number(parameters, 'TargetX'), z: number(parameters, 'TargetZ') };
  if (kind !== 1) return { ...position };
  const width = bounds.right - bounds.left, height = bounds.top - bounds.bottom;
  const marginX = width * number(parameters, 'EdgeMarginXPercent');
  const bottom = bounds.bottom + height * number(parameters, 'EdgeMarginZBottomPercent');
  const top = bounds.top - height * number(parameters, 'EdgeMarginZTopPercent');
  return { x: bounds.left + marginX + random() * (width - marginX * 2), z: bottom + random() * (top - bottom) };
}

export interface NativeRandomIntervalState {
  elapsed: number; intervalElapsed: number; interval: number;
  min: number; max: number; duration: number; finished: boolean;
}
/** RandomIntervalAction.OnStart calls its action immediately, THEN samples its
 * first interval. Caller must execute that initial callback before using this
 * state. Keeping this separate preserves native PRNG order inside the action. */
export function createNativeRandomInterval(parameters: Parameters, random: () => number): NativeRandomIntervalState {
  const min = number(parameters, 'MinInterval'), max = number(parameters, 'MaxInterval');
  return { elapsed: 0, intervalElapsed: 0, interval: min + random() * (max - min), min, max, duration: number(parameters, 'TotalDuration'), finished: false };
}

/** RandomIntervalAction.OnUpdate 0x69e1bc0: at most one callback per native
 * tick; interval overshoot is discarded. Callback precedes duration completion,
 * including when both boundaries occur on the same tick. */
export function advanceNativeRandomInterval(state: NativeRandomIntervalState, dt: number, random: () => number, action: () => void): void {
  if (state.finished) return;
  state.elapsed += dt; state.intervalElapsed += dt;
  if (state.intervalElapsed >= state.interval) {
    action();
    state.intervalElapsed = 0;
    state.interval = state.min + random() * (state.max - state.min);
  }
  state.finished = state.elapsed >= state.duration;
}

/** AICommonBoss.initMinMaxCallZ overwrites CallData.MinZ/MaxZ based on AI type.
 * StraightFall defaults are Q16 values from rodata 0x1a8f030 (1.1,1.2).
 * onCallMonster passes radius=2, offsetX=2, needInCamera=false to map sampling.
 * Radius does not affect the result when needInCamera=false. */
export function nativeStraightFallSummonPosition(bounds: CameraRect, random: () => number): Point {
  const height = bounds.top - bounds.bottom;
  return {
    x: bounds.left + 2 + random() * (bounds.right - bounds.left - 4),
    z: bounds.bottom + height * (72089 / FP + random() * ((78643 - 72089) / FP)),
  };
}

export interface NativeSummonRecipe { entityId: number; count: number; ignoreDrop: true; angle: number; parameters: Parameters }
/** Restrict to the actually studied StraightFall branch. Stay, authored
 * formations and MonsterIds selection use a different path, never approximate
 * them with the falling-spawn recipe. */
export function nativeStraightFallSummonRecipe(parameters: Parameters): NativeSummonRecipe {
  if (number(parameters, 'CallAIType') !== 0) throw new Error('Unsupported native summon AI: only StraightFall has a verified recipe');
  if (Array.isArray(parameters.MonsterIds) && parameters.MonsterIds.length) throw new Error('MonsterIds summon selection is not verified');
  return { entityId: number(parameters, 'CallMonsterId'), count: number(parameters, 'Count', 1), ignoreDrop: true, angle: Math.PI, parameters };
}

export interface NativeCeaseFireState {
  elapsed: number; duration: number; waitingForLasers: boolean; finished: boolean;
}

/** CharacterWeaponStateCeaseFire.Enter 0x6c57a30 computes the duration once.
 * The caller must enter this state at the actual SkillExit completion event,
 * not at initial fire, last ordinary bullet impact, or FireHold start.
 * Only registered laser entities block this timer; ordinary flying bullets do
 * not. Animation/event data must be available before enabling this adapter. */
export function createNativeCeaseFire(duration: number, hasRegisteredLasers: boolean): NativeCeaseFireState {
  if (!Number.isFinite(duration)) throw new Error('Invalid native cease-fire duration');
  return { elapsed: 0, duration: Math.max(0, duration), waitingForLasers: hasRegisteredLasers, finished: false };
}

/** CheckLaserBulletStatus 0x6c58d10 and OnUpdate 0x6c589c0. The tick on which
 * the last registered laser disappears also increments the CD timer. There is
 * no speculative laser timeout. Returns the OnFireEnd event exactly once.
 * bypassCooldown is native character flag 27; do not derive it from AI type. */
export function advanceNativeCeaseFire(state: NativeCeaseFireState, dt: number, allRegisteredLasersDestroyed: boolean, bypassCooldown = false): boolean {
  if (state.finished) return false;
  if (state.waitingForLasers) {
    if (!allRegisteredLasersDestroyed) return false;
    state.waitingForLasers = false;
  }
  if (!bypassCooldown && state.duration > 0) {
    state.elapsed += dt;
    if (state.elapsed < state.duration) return false;
  }
  state.finished = true;
  return true;
}

/** CalculateCeaseFireTime 0x6bd4640..0x6bd46fc, with already-resolved native
 * attribute multipliers. Custom interval is ADDED to base/weapon FireCD.
 * Do not use this for old Bottom AI's explicit wait: that callback returns
 * fireInterval directly, whereas BottomNew invokes this calculation. */
export function nativeCeaseFireDuration(
  customInterval: number, entityFireCD: number, weaponFireCD: number,
  fireCDMultiplier: number, allFireCDMultiplier: number, attackSpeed: number,
): number {
  const seconds = Math.max(0, (customInterval + entityFireCD + weaponFireCD) * fireCDMultiplier * allFireCDMultiplier);
  return attackSpeed === 0 ? seconds : seconds / attackSpeed;
}

interface NativeEnemyWeaponTiming {
  animationId: number; alarmSeconds: number; fireHoldSeconds: number;
  enterHold: number | null; fireEvent: number | null;
  exitFire: number | null; exitEnd: number | null;
}
export const nativeEnemyAttackTimings = enemyTimingSource.entities as Record<string, {
  model: string; weapons: Record<string, NativeEnemyWeaponTiming>;
}>;

/** Same weapon-state chain as Boss attacks, but use the actual enemy prefab's
 * controller events. The general-plane Exit is 5/60s, not the Boss's 16/60s.
 * Alarm appears in both Hold and FireHold when the latter exists. */
export function nativeEnemyAttackTimeline(entityId: number, weaponId: number, holdTime: number, animationSpeed = 1, effectiveFireHold?: number) {
  const timing = nativeEnemyAttackTimings[entityId]?.weapons[weaponId];
  if (!timing || timing.enterHold === null || timing.exitEnd === null || animationSpeed <= 0) return undefined;
  const enter = timing.enterHold / animationSpeed;
  const firstAlarmEnd = enter + timing.alarmSeconds;
  const holdEnd = firstAlarmEnd + Math.max(0, holdTime);
  const fireHold = effectiveFireHold ?? timing.fireHoldSeconds;
  const fireHoldStart = holdEnd + (fireHold > 0 ? timing.alarmSeconds : 0);
  const fireEvent = fireHold > 0 ? timing.fireEvent : timing.exitFire;
  if (fireEvent === null) return undefined;
  const firstFire = fireHoldStart + fireEvent / animationSpeed;
  const exitStart = fireHoldStart + fireHold;
  return { enter, firstAlarmEnd, holdEnd, fireHoldStart, firstFire, exitStart, exitEnd: exitStart + timing.exitEnd / animationSpeed };
}
