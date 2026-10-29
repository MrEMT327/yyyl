import type { Point } from './model';
import type { NativeScrollCameraBounds } from './native-scroll-camera';

/** NewBattleFollowCamera.OnInit @0x7542940..74 overrides the prefab preview
 * size. This is the ordinary-camera literal at ELF 0x1a8c0dc, not a tuning knob.
 * Evidence: research/moving-camera-view-20261019.md. */
export const nativeOrdinaryCameraWidth = 20.37374496459961;

export function nativeOrdinaryCameraViewport(aspect: number): { width: number; height: number } {
  if (!(aspect > 0) || !Number.isFinite(aspect)) throw new RangeError('Camera aspect must be positive');
  const ratio = Math.fround(aspect);
  const halfHeight = Math.fround(nativeOrdinaryCameraWidth / Math.fround(ratio * 2));
  const height = Math.fround(halfHeight * 2);
  return { width: Math.fround(height * ratio), height };
}

/** HeroComponentDragMove.SetTargetPosition -> FixPosInCustomCameraBoundsWith-
 * FixedRange: source ShapeRadius, offsetX=0, bottomOffset=0, topOffset=-5.
 * Chapter_FixedMoveArea has only ID10, raw Area=[1310720,2621440] (20 x 40).
 * The fixed rectangle is centered on world zero, not on the moving camera. */
export function nativePlayerMovementBounds(camera: NativeScrollCameraBounds, radius: number,
  chapterId: number): NativeScrollCameraBounds {
  const bounds = { left: camera.left + radius, right: camera.right - radius,
    bottom: camera.bottom + radius, top: camera.top - 5 - radius };
  if (chapterId === 10) {
    bounds.left = Math.max(bounds.left, -10 + radius);
    bounds.right = Math.min(bounds.right, 10 - radius);
    bounds.bottom = Math.max(bounds.bottom, -20 + radius);
    bounds.top = Math.min(bounds.top, 20 - radius);
  }
  return bounds;
}

export function clampNativePlayerTarget(point: Point, bounds: NativeScrollCameraBounds): Point {
  return { x: Math.max(bounds.left, Math.min(bounds.right, point.x)),
    z: Math.max(bounds.bottom, Math.min(bounds.top, point.z)) };
}
