/** PersistentModProcessor.OnInit@6d38cc4 adds this flag. The params class has
 * no fields of its own; OnUpdate, OnEvent and OnDeInit do nothing. The native
 * flag remains set if the processor is deinitialized. Evidence and consumers:
 * research/loadout-persistent-mod-runtime.json. */
export const NATIVE_PERSISTENCE_FLAG = 0x400;

/** Call at the original mod installation point before birth-position records
 * and first movement. Preserve every flag installed by other processors. */
export function nativeInstallPersistentMod(flags = 0): number {
  return flags | NATIVE_PERSISTENCE_FLAG;
}

export function nativeBulletIsPersistent(flags = 0): boolean {
  return (flags & NATIVE_PERSISTENCE_FLAG) !== 0;
}

/** EntityBullet.CheckDead@6a8e01c checks CheckOutMap FIRST, then Persistence.
 * A persistent bullet still dies outside the original map ground when flag4
 * requests that check; inside it bypasses ordinary lifetime/range expiration.
 * The callback retains every normal path (including LaserStick extra life).
 * Do not use this wrapper to suppress explicit death, collision/mod death,
 * owner destruction, kill-bullet effects, or battle cleanup. */
export function nativeCheckPersistentBulletDead(
  flags: number,
  outsideMapGround: boolean,
  ordinaryLifetimeAndRangeCheck: () => boolean,
): boolean {
  if ((flags & 4) !== 0 && outsideMapGround) return true;
  if (nativeBulletIsPersistent(flags)) return false;
  return ordinaryLifetimeAndRangeCheck();
}

/** The table lifetime remains unchanged (e.g.360012/360016 still store15s).
 * Persistence skips the automatic check instead of replacing the serialized
 * lifetime or creating an independent countdown. IgnoreDisCheck alone does
 * NOT bypass the lifetime check. */
export function nativeBulletUsesLifetimeExpiration(flags = 0): boolean {
  return !nativeBulletIsPersistent(flags);
}

/** Both FixDeltaPosInLifeRange@6a9040c and FixPredictPosInLifeRange@6a9067c
 * return the supplied value unchanged for IgnoreDisCheck or Persistence.
 * Otherwise keep the caller's existing native clamp, including its Q16 rules.
 * Generic T also preserves the vertical component of the original FPVector3. */
export function nativeFixPersistentBulletLifeRange<T>(
  flags: number,
  proposed: T,
  ordinaryClamp: (value: T) => T,
): T {
  return (flags & (0x200 | NATIVE_PERSISTENCE_FLAG)) !== 0 ? proposed : ordinaryClamp(proposed);
}

/** BuildBulletEntity@479b8f0..479b914 skips RecordOwnerPos for these flags.
 * RecordWorldFirePos still runs at479b920 for persistent bullets as usual. */
export function nativeBulletRecordsOwnerFirePosition(flags = 0): boolean {
  return (flags & (0x200 | NATIVE_PERSISTENCE_FLAG)) === 0;
}
