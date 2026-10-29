import type { NativeWeaponPoint } from './weapon-runtime-extensions';

/** Action 111 is CreateFlashSplash. FireLightningStrike is action 215, a different mechanic. */
export interface NativeFlashSplashParams {
  WeaponId: number;
  TargetTriggerCd?: number;
  AllowedSecondWeaponTypes?: readonly number[];
  BaseRate?: number;
}
export interface NativeFlashSplashOwner {
  secondWeaponType?: number;
  /** Owner entity attribute FlashSplashTriggerRate%, as a ratio. */
  triggerRatePercent: number;
}
export interface NativeFlashSplashTarget {
  uid: number;
  position: NativeWeaponPoint;
  yawDegrees: number;
}
export interface NativeFlashSplashFire {
  weaponId: number;
  origin: NativeWeaponPoint;
  yawDegrees: number;
  /** Original WorldContext.TempTargetEntity / TempTargetPos for child AI initialization. */
  targetUid: number;
  targetPosition: NativeWeaponPoint;
  flags: number;
}

/** EntityMonster._lastTriggerAdWeaponTime; share across all source bullets and actions. */
export class NativeTargetWeaponCooldowns {
  private readonly byTarget = new Map<number, Map<number, number>>();

  consume(targetUid: number, weaponId: number, now: number, cooldown: number): boolean {
    if (cooldown <= 0) return true;
    const times = this.byTarget.get(targetUid);
    // GetLastTriggerAddWeaponTime returns zero for a missing weapon, not -Infinity.
    if (now - (times?.get(weaponId) ?? 0) <= cooldown) return false;
    if (times) times.set(weaponId, now);
    else this.byTarget.set(targetUid, new Map([[weaponId, now]]));
    return true;
  }

  forgetTarget(targetUid: number): void { this.byTarget.delete(targetUid); }
  clear(): void { this.byTarget.clear(); }
}

/**
 * One instance per FlashSplashMod attached to a source bullet on event 41.
 * Native evidence: TriggerActionCreateFlashSplash 0x6b25a38;
 * FlashSplashModProcessor.OnInit 0x6dc86d4 / OnEvent 0x6dc884c.
 */
export class NativeFlashSplashRuntime {
  static readonly sourceBulletFlag = 0x100000;
  private shouldCreateWeapon = false;

  constructor(private readonly params: NativeFlashSplashParams) {}

  /** EntityComponentEventId 24, before applying HP changes, including lethal hits. */
  beforeHit(owner: NativeFlashSplashOwner | undefined, random: () => number): {
    shouldCreate: boolean;
    /** HurtSourceData.MarkGameConditionOccurred(GameCondition.NoFlashSplashApplied). */
    noFlashSplashApplied: boolean;
  } {
    const allowed = this.params.AllowedSecondWeaponTypes;
    const ownerAllowed = owner !== undefined && (!allowed?.length ||
      (owner.secondWeaponType !== undefined && allowed.includes(owner.secondWeaponType)));
    // Action params default BaseRate to zero, then overwrite the Mod's own default .3.
    const chance = ownerAllowed ? (this.params.BaseRate ?? 0) * (1 + owner!.triggerRatePercent) : 0;
    this.shouldCreateWeapon = chance >= 1 || (chance > 0 && random() < chance);
    return { shouldCreate: this.shouldCreateWeapon, noFlashSplashApplied: !this.shouldCreateWeapon };
  }

  /** EntityComponentEventId 25. No alive-target requirement and no damage multiplier. */
  afterHit(target: NativeFlashSplashTarget, ownerExists: boolean, now: number,
    cooldowns: NativeTargetWeaponCooldowns): NativeFlashSplashFire | undefined {
    if (!this.shouldCreateWeapon || !ownerExists) return undefined;
    if (!cooldowns.consume(target.uid, this.params.WeaponId, now, this.params.TargetTriggerCd ?? 0)) return undefined;
    return {
      weaponId: this.params.WeaponId,
      origin: { ...target.position },
      yawDegrees: target.yawDegrees,
      targetUid: target.uid,
      targetPosition: { ...target.position },
      flags: 0,
    };
  }
}
