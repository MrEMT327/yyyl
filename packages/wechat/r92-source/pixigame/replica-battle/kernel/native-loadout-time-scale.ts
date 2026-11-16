import type { NativeRecord } from './weapon-skill-runtime';

const FP = 65536;
const fpMultiply = (a: number, b: number) => Math.floor(Math.trunc(a * FP) * Math.trunc(b * FP) / FP) / FP;
export interface NativeBuffTimeSelection {
  buffId: number; buffFlag: number; buffType: number;
  /** Original action requires the exact BuffClearEvent_Time class. */
  clearEvent: number;
}
export interface NativeBuffTimeState extends NativeBuffTimeSelection {
  /** BuffClearEvent_Time._duringTime AFTER its original initialization. This
   * is fixed for the buff instance, not its remaining or cumulative duration. */
  initialDuration: number;
  remaining: number;
}

/** Action95 is UpdateBuffTime. TimeScale adds a multiple of the original
 * buff lifetime; it never changes the game, movement or projectile clock. */
export function nativeBuffTimeActionEnabled(args: NativeRecord): boolean {
  return Boolean(args.RefreshTime) || Number(args.Time || 0) >= 1 / FP || Number(args.TimeScale || 0) >= 1 / FP;
}

/** All supplied filters are ANDed. Null ID/flag lists are unrestricted but
 * present empty ID/flag lists reject every buff. Type list is ignored when
 * empty. These asymmetric checks match OnExecute@6b8f938. */
export function nativeBuffTimeMatches(buff: NativeBuffTimeSelection, args: NativeRecord): boolean {
  if (buff.clearEvent !== 1) return false;
  const flags: readonly number[] | null | undefined = args.ChangeTimeTargetBuffFlag;
  const ids: readonly number[] | null | undefined = args.ChangeTimeTargetBuffID;
  const types: readonly number[] | null | undefined = args.ChangeTimeTargetBuffType;
  return (flags == null || flags.includes(buff.buffFlag)) && (ids == null || ids.includes(buff.buffId)) &&
    (!types?.length || types.includes(buff.buffType));
}

/** No reapplication, additional layers, caster recapture or tick reset.
 * Refresh precedes the two additive operations; repeated actions add their
 * duration changes again. Infinite time-clear buffs remain immortal. */
export function nativeUpdatedBuffTime(buff: NativeBuffTimeState, args: NativeRecord): number | undefined {
  if (!nativeBuffTimeActionEnabled(args) || !nativeBuffTimeMatches(buff, args)) return undefined;
  if (!Number.isFinite(buff.initialDuration) || !Number.isFinite(buff.remaining)) return Infinity;
  return (args.RefreshTime ? buff.initialDuration : buff.remaining) + Number(args.Time || 0) +
    fpMultiply(buff.initialDuration, Number(args.TimeScale || 0));
}

export interface NativeBuffTimeActionHost {
  /** Must enumerate the EVENT TARGET's live buffs, not the action owner. */
  buffs(targetUid: number): readonly NativeBuffTimeState[];
  setRemaining(targetUid: number, buffId: number, remaining: number): void;
}
export class NativeLoadoutBuffTimeActions {
  constructor(private readonly host: NativeBuffTimeActionHost) {}
  execute(action: number, args: NativeRecord, event: { targetUid?: number }): boolean {
    if (action !== 95) return false;
    if (event.targetUid === undefined || !nativeBuffTimeActionEnabled(args)) return true;
    for (const buff of this.host.buffs(event.targetUid)) {
      const remaining = nativeUpdatedBuffTime(buff, args);
      if (remaining !== undefined) this.host.setRemaining(event.targetUid, buff.buffId, remaining);
    }
    return true;
  }
}
