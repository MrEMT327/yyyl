import { parseNativeConditionalAttributes } from './loadout-attributes';
import type { NativeRecord } from './weapon-skill-runtime';

type Attributes = Readonly<Record<string, number>>;
type OwnerState = { counts: Map<number, number>; boosts: Map<number, Map<number, Attributes>> };

/** Original EntityCharacter._nextFireBoostAttrs: (weapon/counter, absolute
 * fire count) -> dictionary. A later write REPLACES the complete dictionary.
 * Counter0 means any weapon, -1 means any main weapon; positive keys are exact
 * Weapon IDs. These are owner-character counters, never per-trigger counters.
 * Evidence: research/loadout-next-fire-boost-runtime.json. */
export class NativeNextFireBoostRuntime {
  private owners = new Map<number, OwnerState>();

  private owner(ownerKey: number): OwnerState {
    let state = this.owners.get(ownerKey);
    if (!state) this.owners.set(ownerKey, state = { counts: new Map(), boosts: new Map() });
    return state;
  }

  count(ownerKey: number, counterKey: number): number {
    return this.owners.get(ownerKey)?.counts.get(counterKey) || 0;
  }

  /** Call at Weapon.TriggerWeaponFireTriggerEvent, ONCE for the weapon firing
   * operation, before constructing its bullets. Multiple salvo bullets within
   * one WeaponFire share its count. A later actual WeaponFire invocation counts
   * again; do not substitute a per-projectile event17 callback.
   * Native increments exact-ID and key0 independently. */
  weaponFire(ownerKey: number, weaponId: number): void {
    this.increment(ownerKey, weaponId);
    this.increment(ownerKey, 0);
  }

  /** Separate original TriggerMainWeaponFireTriggerEvent: bit13 of the firing
   * flags gates key-1. Call before the main-fire trigger is dispatched. */
  mainWeaponFire(ownerKey: number, flags: number): void {
    if (flags & 0x2000) this.increment(ownerKey, -1);
  }

  private increment(ownerKey: number, counterKey: number): void {
    const state = this.owner(ownerKey);
    state.counts.set(counterKey, (state.counts.get(counterKey) || 0) + 1);
  }

  /** Action211 OnExecute. mainWeaponId is the original owner's main weapon's
   * Weapon table ID (fallback owner.EntityData.CurWeaponId), not a family ID.
   * All eight direct meta skills currently use BoostType4, so need no fallback.
   * Attrs are Name|fraction, already normalized. NextFireCount<=1 means one.
   * Returns false for an invalid original target/type or empty dictionary. */
  execute(ownerKey: number, args: NativeRecord, mainWeaponId?: number): boolean {
    const attributes = parseNativeConditionalAttributes(args.Attrs);
    if (!Object.keys(attributes).length) return false;
    let counterKey: number;
    switch (Number(args.BoostType)) {
      case 1: counterKey = Number(mainWeaponId || 0); if (counterKey < 1) return false; break;
      case 2: counterKey = Number(args.TargetWeaponId || 0); if (counterKey < 1) return false; break;
      case 3: counterKey = 0; break;
      case 4: counterKey = -1; break;
      default: return false;
    }
    const state = this.owner(ownerKey), start = this.count(ownerKey, counterKey) + 1;
    let byCount = state.boosts.get(counterKey);
    if (!byCount) state.boosts.set(counterKey, byCount = new Map());
    const count = Math.max(1, Math.trunc(Number(args.NextFireCount) || 0));
    for (let i = 0; i < count; i++) byCount.set(start + i, { ...attributes });
    return true;
  }

  /** Native GetAllNextFireBoostAttrs sums the current exact-ID, key0 and key-1
   * dictionaries by raw addition, then bullet creation merges that ONE result
   * through AttributeData.MergeAttribute. Do not consume/delete it per bullet:
   * every bullet in the same weapon firing operation receives the same result.
   * Query only after the firing counters were incremented, before event7 and
   * before computing scale, crit and damage from the bullet's final attributes. */
  attributes(ownerKey: number, weaponId: number): Record<string, number> {
    const state = this.owners.get(ownerKey), result: Record<string, number> = {};
    if (!state) return result;
    for (const key of [weaponId, 0, -1]) {
      const values = state.boosts.get(key)?.get(state.counts.get(key) || 0);
      for (const [name, value] of Object.entries(values || {})) result[name] = (result[name] || 0) + value;
    }
    return result;
  }

  value(ownerKey: number, weaponId: number, attribute: string): number {
    return this.attributes(ownerKey, weaponId)[attribute] || 0;
  }

  /** Original action211 Undo clears ALL next-fire dictionaries on its owner;
   * it does not selectively remove the source or reset weapon fire counts. */
  clearBoosts(ownerKey: number): void { this.owners.get(ownerKey)?.boosts.clear(); }
  clear(): void { this.owners.clear(); }
}
