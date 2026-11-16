/** Pure consumers for special-action host contracts. Incoming attributes are
 * already native fractions from Name|value; retain each contribution separately
 * for mergeNativeConditionalAttributeGroups instead of flattening mergeType2.
 * Evidence: research/loadout-special-host-contract.json. */
export interface NativeSpecialWeaponAttributeCondition { targetHpAtMost?: number; circularSlashOnly?: boolean }
type AttributeSource = { familyId: number; weaponIds: readonly number[]; attributes: Record<string, number>; condition?: NativeSpecialWeaponAttributeCondition };

export class NativeSpecialWeaponAttributes {
  private sources = new Map<string, AttributeSource>();

  replace(familyId: number, sourceKey: string, weaponIds: readonly number[], attributes: Readonly<Record<string, number>>, condition?: NativeSpecialWeaponAttributeCondition): void {
    if (!Object.keys(attributes).length) { this.sources.delete(sourceKey); return; }
    this.sources.set(sourceKey, { familyId, weaponIds: [...weaponIds], attributes: { ...attributes }, condition: condition && { ...condition } });
  }

  /** Evaluate immediately BEFORE damage changes target HP. isCircularSlash is
   * the original bool stamp, not HurtType1 nor a BulletTrait bit. */
  groups(context: { familyId: number; weaponId: number; targetHpRatio?: number; isCircularSlash?: boolean }): Array<{ sourceKey: string; attributes: Record<string, number> }> {
    const groups: Array<{ sourceKey: string; attributes: Record<string, number> }> = [];
    for (const [sourceKey, source] of this.sources) {
      if (source.familyId !== context.familyId || source.weaponIds.length && !source.weaponIds.includes(context.weaponId)) continue;
      if (source.condition?.circularSlashOnly && !context.isCircularSlash) continue;
      const threshold = source.condition?.targetHpAtMost;
      if (threshold !== undefined && (context.targetHpRatio === undefined || context.targetHpRatio > threshold)) continue;
      groups.push({ sourceKey, attributes: { ...source.attributes } });
    }
    return groups;
  }

  clear(): void { this.sources.clear(); }
}

/** Exact shipped IntervalTrigger: triggers when (++counter)>interval, then
 * resets counter0. Configure resets progress; <=0 disables it. In particular,
 * interval4 triggers on tick5 and interval3 triggers on tick4. */
export class NativeSpecialIntervalTrigger {
  private interval = 0;
  private counter = 0;
  configure(interval: number): void { this.interval = Math.max(0, Math.trunc(interval)); this.counter = 0; }
  reset(): void { this.interval = 0; this.counter = 0; }
  tick(): boolean {
    if (this.interval < 1) return false;
    if (++this.counter > this.interval) { this.counter = 0; return true; }
    return false;
  }
  get progress(): Readonly<{ interval: number; counter: number }> { return { interval: this.interval, counter: this.counter }; }
}

export interface NativeSpecialMissileBoost { extraCount: number; attrs: Readonly<Record<string, number>> }

/** 216 is evaluated AFTER initial creation and only when the successful initial
 * list is nonempty. Pending consecutive missiles do not advance this counter.
 * Pass its result to NativeMissileRuntime.createRound's native boost pass;
 * integrations should evaluate lazily after made.length>0, not before firing. */
export class NativeSpecialMissileBoostCounter {
  private trigger = new NativeSpecialIntervalTrigger();
  private extraCount = 1;
  private attributes: Record<string, number> = {};
  configure(everyFireCount: number, extraCount: number, attributes: Readonly<Record<string, number>>): void {
    this.trigger.configure(everyFireCount > 0 ? everyFireCount : 4);
    this.extraCount = extraCount > 0 ? Math.trunc(extraCount) : 1;
    this.attributes = { ...attributes };
  }
  successfulRound(successfulInitialCount: number): NativeSpecialMissileBoost | undefined {
    if (successfulInitialCount < 1 || !this.trigger.tick()) return undefined;
    return { extraCount: this.extraCount, attrs: { ...this.attributes } };
  }
  clear(): void { this.trigger.reset(); this.extraCount = 1; this.attributes = {}; }
}

export interface NativeCircularSlashStamp {
  isCircularSlash: true; totalAngle: 360; rangeAddPercent: number; attributes: Readonly<Record<string, number>>;
}

/** 218 stamps a successfully CREATED stored sword, not a hit, launch, reverse
 * or halfway event. It persists on that bullet through its later trajectory.
 * The host must additionally implement SemiCircleMov2's stamped360-degree
 * sweep/range branch and the pre-hit low-HP bool filter before admission. */
export class NativeSpecialCircularSlashCounter {
  private trigger = new NativeSpecialIntervalTrigger();
  private rangeAddPercent = 0;
  private attributes: Record<string, number> = {};
  configure(interval: number, rangeAddPercent: number, attributes: Readonly<Record<string, number>>): void {
    this.trigger.configure(interval); this.rangeAddPercent = rangeAddPercent; this.attributes = { ...attributes };
  }
  createdSword(): NativeCircularSlashStamp | undefined {
    if (!this.trigger.tick()) return undefined;
    return { isCircularSlash: true, totalAngle: 360, rangeAddPercent: this.rangeAddPercent, attributes: { ...this.attributes } };
  }
  clear(): void { this.trigger.reset(); this.rangeAddPercent = 0; this.attributes = {}; }
}
