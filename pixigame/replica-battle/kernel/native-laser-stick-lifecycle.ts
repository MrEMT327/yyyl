import { nativeBulletIsPersistent } from './native-persistent-mod';

/** LaserBase.get_FireHoldTime@6d60410 and the processor getter@4de82b0
 * return LaserBaseParams.FireHoldTime directly. Input is normalized table FP.
 * Its default is zero;202128 explicitly sets .5. This is the owner's firing
 * hold, not evidence for an automatic bullet-death timer. */
export function nativeLaserStickHoldTime(parameters: Readonly<{ FireHoldTime?: number }>): number {
  return parameters.FireHoldTime ?? 0;
}

/** Keep this false until an active native normal-fire cleanup consumer is
 * recovered. FireHold.Exit is empty; its time ending changes owner state.
 * CeaseFire.CheckLaserBulletStatus waits for death, rather than causing it.
 * Never replace this missing path with FireHoldTime or Bullet.LifeTime. */
export const NATIVE_PERSISTENT_LASER_STICK_EXPIRY_CONFIRMED = false;

/** Dependency gate only. Other persistent trajectories retain their installed
 * flag consumers; normal LaserStick still uses the existing lifetime path.
 * This precise combination must remain unavailable until its explicit death
 * consumer is installed, so a successful compile cannot create immortal beams. */
export function nativeLaserStickNeedsExplicitExpiry(trajectory: string, flags: number): boolean {
  return trajectory === 'LaserStick' && nativeBulletIsPersistent(flags)
    && !NATIVE_PERSISTENT_LASER_STICK_EXPIRY_CONFIRMED;
}
