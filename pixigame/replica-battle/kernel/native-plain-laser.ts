import type { Point } from './model';

/** LaserTrajectoryModProcessor.OnInit@6d5a2b8..4e0. Shape.height is the
 * unscaled authored height. ScaleAnim is not a multiplier on this length.
 * IgnoreDisCheck=512 bypasses both the life-range clamp and muzzle distance.
 * The native code does not clamp a negative result back to zero. */
export function nativePlainLaserLength(shapeHeight: number, bulletLifeRange: number,
  birth: Point, owner: Point, flags = 0, laserLengthPercent = 0): number {
  const length = flags & 512 ? shapeHeight
    : Math.min(shapeHeight, bulletLifeRange) - Math.hypot(birth.x - owner.x, birth.z - owner.z);
  return length * (1 + laserLengthPercent);
}

export interface NativePlainLaserRay { start: Point; angle: number; length: number }

/** OnInit@6d5a6c8..6f8 saves the world-space birth pose. In the unlocked
 * branch OnTrajectoryUpdate does not follow the owner's transform or target.
 * Event29 explicitly replaces this pose; don't synthesize it every frame. */
export function nativePlainLaserRay(start: Point, angle: number, length: number): NativePlainLaserRay {
  return { start: { ...start }, angle, length };
}

/** BulletLaserUpdateData / OnEventInternal@6d5f304..394. This event changes
 * the ray's pose, not its originally computed length. The plain enemies in
 * chapters12-15 have no EnableLock, FollowMod or ReboundMod on their Laser. */
export function updateNativePlainLaserRay(ray: NativePlainLaserRay, start: Point, angle: number): void {
  ray.start = { ...start }; ray.angle = angle;
}
