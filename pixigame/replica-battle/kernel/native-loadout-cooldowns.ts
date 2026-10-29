import type { NativeRecord } from './weapon-skill-runtime';

/** TriggerActionForceReduceAllFireCDOnce.ShouldAffect@6b4c214. The
 * surrounding OnExecute enumerates these four groups, not weapon type IDs. */
export type NativeCooldownCharacterGroup = 0 | -3 | -2 | -4;
export interface NativeFireCooldownReduction {
  /** Original JSON is a fraction: 0.15 means fifteen percent, not 0.15%. */
  percent: number;
  seconds: number;
  groups: NativeCooldownCharacterGroup[];
}

export function nativeFireCooldownReduction(args: NativeRecord): NativeFireCooldownReduction {
  const targets: readonly number[] | undefined = args.TargetCharacterType;
  return {
    percent: Number(args.ReduceFireCDPercent || 0),
    seconds: Number(args.ReduceFireCDTime || 0),
    groups: ([0, -3, -2, -4] as const).filter(group => !targets?.length || targets.includes(-1) || targets.includes(group)),
  };
}

const FP = 65536;
function fpMultiply(a: number, b: number): number {
  return Math.floor(Math.trunc(a * FP) * Math.trunc(b * FP) / FP) / FP;
}

/** CharacterWeaponStateCeaseFire.AddCurrentTime@6c5901c advances elapsed
 * time by (ceaseFireTime-currentTime)*percent, then AddCurrentConstTime
 * @6c590bc adds seconds. Thus percentages shorten the REMAINING cooldown;
 * neither call clamps the result nor starts an otherwise inactive timer.
 * An overdue deadline remains overdue until the normal state update. */
export function nativeCharacterCooldownDeadline(deadline: number, now: number, percent: number, seconds: number): number {
  return deadline - fpMultiply(deadline - now, percent) - seconds;
}

/** AIHeroOwnedSubCharacterFollowerBase.ReduceCeaseFireWaitTime@68ee128
 * applies positive parameters only. WaitForDynamicTime.AddCurrentTime
 * @69ee688 also requires maxTime-elapsed>0, and uses that remainder. The
 * fixed part @69ee720 is positive-only and is applied after the percentage.
 * Call only while an actual wait task exists. */
export function nativeFollowerCooldownDeadline(deadline: number, now: number, percent: number, seconds: number): number {
  const remainder = deadline - now;
  const fractional = percent >= 1 / FP && remainder >= 1 / FP ? fpMultiply(remainder, percent) : 0;
  return deadline - fractional - (seconds >= 1 / FP ? seconds : 0);
}

export interface NativeTriggerCooldownState {
  spec: { actions: readonly { type: number }[] };
  lastTime: number;
}

/** CharacterComponentTrigger.ReduceTriggerCdByTriggerAction@6aff2f0
 * scans every installed trigger, stops scanning that trigger's action array
 * at its first match, and calls ReduceNextTriggerCd@6bab634 once. This
 * subtracts seconds from _lastTriggerTime directly; no clamp, immediate
 * execution, count reset or modification of the configured TriggerCd. */
export function nativeReduceTriggerCooldownByAction(states: Iterable<NativeTriggerCooldownState>, targetAction: number, seconds: number): void {
  for (const state of states) if (state.spec.actions.some(action => action.type === targetAction)) state.lastTime -= seconds;
}

export interface NativeCooldownAction { action: number; args: NativeRecord }
export interface NativeLoadoutCooldownHost {
  /** Action197 acts on the trigger owner's CharacterWeaponStateCeaseFire,
   * not the root hero or every weapon. It completes only an active timer. */
  resetCeaseFireCooldown(familyId: number): void;
  /** Resolve the trigger owner to its root hero. The original invokes hero
   * and sprite timers only in WeaponState5. Second weapons (both component
   * variants) and wing planes additionally notify their AI wait task even
   * when their character is outside WeaponState5. */
  reduceFireCooldown(familyId: number, reduction: NativeFireCooldownReduction): void;
  /** This is the original trigger owner's component, without root promotion.
   * For one target action, each trigger is reduced once if ANY action matches.
   * Repeated IDs in TargetTriggerAction must be applied repeatedly. */
  reduceTriggerCooldownByAction(familyId: number, targetAction: number, seconds: number): void;
}

/** Stateless actions124/197/243; the host retains native entity/trigger timers. */
export class NativeLoadoutCooldownActions {
  constructor(private readonly host: NativeLoadoutCooldownHost) {}

  canHandle(action: number): boolean { return action === 124 || action === 197 || action === 243; }

  execute(command: NativeCooldownAction, familyId: number): boolean {
    if (command.action === 124) {
      this.host.reduceFireCooldown(familyId, nativeFireCooldownReduction(command.args));
      return true;
    }
    if (command.action === 197) {
      // ResetCeaseFireTimer@6c58f18 sets elapsed=max; the normal state update
      // performs the next attack. No new cast or global cooldown reset here.
      this.host.resetCeaseFireCooldown(familyId);
      return true;
    }
    if (command.action === 243) {
      for (const action of command.args.TargetTriggerAction || [])
        this.host.reduceTriggerCooldownByAction(familyId, Number(action), Number(command.args.ReduceTime || 0));
      return true;
    }
    return false;
  }
}
