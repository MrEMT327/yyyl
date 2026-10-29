export type NativeComboEntityKey = number | string;
export interface NativeSameTargetComboConfig {
  weaponId: number; attribute: string; add: number; max: number; intervalType: number;
}
export interface NativeSameTargetComboQuery {
  /** Character holding the config; keep separate from the root owner below. */
  ownerKey: NativeComboEntityKey;
  rootOwnerUid: NativeComboEntityKey; targetUid: NativeComboEntityKey;
  weaponId: number; attribute: string; now: number;
}
type HitCounts = { lastAt: number; halfSecond: number; oneSecond: number };
type ConfigSource = { ownerKey: NativeComboEntityKey; config: NativeSameTargetComboConfig; order: number };

/** Original per-target CharacterComponentOnHit dictionaries are keyed by
 * (root-owner EntityRef, exact WeaponId), separately for .5s and1s. These are
 * consecutive-gap windows, NOT rolling counts of hits in the last .5s/1s.
 * Record each original accepted BulletHurtInfo contact ONCE before owner hit
 * events and hurt calculation. Queries never increment, so multiple damage
 * formulas do not duplicate this contact. First hit is count1 -> bonus0.
 * Evidence: research/loadout-same-target-combo*.arm64.txt. */
export class NativeSameTargetComboRuntime {
  private targets = new Map<NativeComboEntityKey, Map<NativeComboEntityKey, Map<number, HitCounts>>>();
  private sources = new Map<string, ConfigSource>();
  private order = 0;

  /** Native setter assigns the last config for owner/weapon/attribute; it does
   * not add deltas from multiple configurations or reset target hit history. */
  replace(ownerKey: NativeComboEntityKey, sourceKey: string, config: NativeSameTargetComboConfig | undefined): void {
    if (!config) { this.sources.delete(sourceKey); return; }
    this.sources.set(sourceKey, { ownerKey, config: { ...config }, order: ++this.order });
  }

  recordHit(rootOwnerUid: NativeComboEntityKey, targetUid: NativeComboEntityKey, weaponId: number, now: number): void {
    if (weaponId < 1) return;
    let owners = this.targets.get(targetUid);
    if (!owners) this.targets.set(targetUid, owners = new Map());
    let weapons = owners.get(rootOwnerUid);
    if (!weapons) owners.set(rootOwnerUid, weapons = new Map());
    let counts = weapons.get(weaponId);
    if (!counts) weapons.set(weaponId, counts = { lastAt: now, halfSecond: 0, oneSecond: 0 });
    const gap = now - counts.lastAt;
    counts.halfSecond = (gap > 0.5 ? 0 : counts.halfSecond) + 1;
    counts.oneSecond = (gap > 1 ? 0 : counts.oneSecond) + 1;
    counts.lastAt = now;
  }

  count(rootOwnerUid: NativeComboEntityKey, targetUid: NativeComboEntityKey, weaponId: number, intervalType: number, now: number): number {
    const counts = this.targets.get(targetUid)?.get(rootOwnerUid)?.get(weaponId);
    if (!counts) return 0;
    // Only enum1 is OneSecond; every other enum follows HalfSecond natively.
    const oneSecond = intervalType === 1;
    if (now - counts.lastAt > (oneSecond ? 1 : 0.5)) {
      if (oneSecond) counts.oneSecond = 0; else counts.halfSecond = 0;
    }
    return oneSecond ? counts.oneSecond : counts.halfSecond;
  }

  /** Return an incoming native attribute fraction for GetHurtAdd, e.g. Attack%.
   * Add with the other FormulaB Attack% terms, do not multiply this separately.
   * Original min(max,delta*(count-1)) caps even when max is zero/negative. */
  bonus(query: NativeSameTargetComboQuery): number {
    let winner: ConfigSource | undefined;
    for (const source of this.sources.values()) if (source.ownerKey === query.ownerKey
      && source.config.weaponId === query.weaponId && source.config.attribute === query.attribute
      && (!winner || source.order > winner.order)) winner = source;
    if (!winner || query.weaponId < 1 || winner.config.add <= 0) return 0;
    const previous = this.count(query.rootOwnerUid, query.targetUid, query.weaponId, winner.config.intervalType, query.now) - 1;
    return previous > 0 ? Math.min(winner.config.max, winner.config.add * previous) : 0;
  }

  forgetTarget(targetUid: NativeComboEntityKey): void { this.targets.delete(targetUid); }
  clear(): void { this.targets.clear(); this.sources.clear(); this.order = 0; }
}
