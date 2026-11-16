import type { NativeWallBox } from './native-wall-query';

export interface NativeWallCameraBounds { left: number; right: number; bottom: number; top: number }

/** Original MapOutWallManager.ctor / EntityMapOutWall.Init; units are world
 * units, dimensions are converted to Shape2D box HALF extents. */
export const nativeMapOutWallThickness = 6;
/** Original globalgamemanagers TagManager, not a rendering sorting layer. */
export const nativeMapOutWallLayer = 9;
export const nativeStoneLayer = 11;
export const nativeOrdinaryWallQueryMask = (1 << nativeMapOutWallLayer) | (1 << nativeStoneLayer);

/** BattleCameraBase.UpdateCameraBounds -> ToFP -> FromFloat_UNSAFE uses
 * float32 * 65536 then truncates. Adapt each camera edge before deriving W/H,
 * rather than separately truncating a floating wall center and half extent. */
const cameraEdgeRaw = (value: number): number => {
  const result = Math.trunc(Math.fround(Math.fround(value) * 65536));
  if (!Number.isSafeInteger(result)) throw new RangeError('Camera edge is outside supported Q16 range');
  return result;
};

/** Chapters 9, 28, 30, 33, 43, 53 and 58 share S_1_1 mission data, waterfall
 * chapterType=8, cameraId=3 and empty ChapterFeature. Chapter 53 adds only
 * monster damage attributes (2010403/1010504), not geometry or wall changes.
 * S_1_1 has HasSky=false, no StoneRects and no ColliderRects; background
 * tilePrefab changes do not replace this physical mission data. Keep other
 * profiles gated until their static-map dependency has been checked. */
export function nativeChapter9WallQuerySupported(chapterId: number, chapterType: number, dataPath: string): boolean {
  return [9, 28, 30, 33, 43, 53, 58].includes(chapterId) && chapterType === 8 && dataPath === 'S_1_1';
}

/** Camera-created caches dimensions, while stageCenter initially stays zero.
 * Camera-updated changes only the center, retaining the original dimensions.
 * Evidence: research/chapter9-physical-walls-source.md. */
export class NativeMapOutWalls {
  readonly boxes: NativeWallBox[];
  private center = { x: 0, z: 0 };
  private readonly halfWidth: number;
  private readonly halfHeight: number;

  constructor(bounds: NativeWallCameraBounds) {
    this.halfWidth = Math.trunc((cameraEdgeRaw(bounds.right) - cameraEdgeRaw(bounds.left)) / 2) / 65536;
    this.halfHeight = Math.trunc((cameraEdgeRaw(bounds.top) - cameraEdgeRaw(bounds.bottom)) / 2) / 65536;
    const halfThickness = nativeMapOutWallThickness / 2;
    // Preserve creation order. Exact equal-distance ties still depend on the
    // native broadphase enumeration, which is not established by creation order.
    // Entity collider hits have IsDynamic=true, but disabled PhysicsBody leaves
    // Entry.HasDynamicBody=false, so QueryOptions classifies these as kinematic.
    this.boxes = [
      { id: 'mapOutWall:top', center: { x: 0, z: 0 }, halfExtents: { x: this.halfWidth, z: halfThickness }, layer: nativeMapOutWallLayer, isTrigger: false, bodyType: 'kinematic' },
      { id: 'mapOutWall:bottom', center: { x: 0, z: 0 }, halfExtents: { x: this.halfWidth, z: halfThickness }, layer: nativeMapOutWallLayer, isTrigger: false, bodyType: 'kinematic' },
      { id: 'mapOutWall:left', center: { x: 0, z: 0 }, halfExtents: { x: halfThickness, z: this.halfHeight + nativeMapOutWallThickness }, layer: nativeMapOutWallLayer, isTrigger: false, bodyType: 'kinematic' },
      { id: 'mapOutWall:right', center: { x: 0, z: 0 }, halfExtents: { x: halfThickness, z: this.halfHeight + nativeMapOutWallThickness }, layer: nativeMapOutWallLayer, isTrigger: false, bodyType: 'kinematic' },
    ];
    this.updatePositions();
  }

  onCameraBoundsUpdated(bounds: NativeWallCameraBounds): void {
    this.center = {
      x: Math.trunc((cameraEdgeRaw(bounds.left) + cameraEdgeRaw(bounds.right)) / 2) / 65536,
      z: Math.trunc((cameraEdgeRaw(bounds.bottom) + cameraEdgeRaw(bounds.top)) / 2) / 65536,
    };
    this.updatePositions();
  }

  private updatePositions(): void {
    const { x, z } = this.center, halfThickness = nativeMapOutWallThickness / 2;
    this.boxes[0].center = { x, z: z + this.halfHeight + halfThickness };
    this.boxes[1].center = { x, z: z - this.halfHeight - halfThickness };
    this.boxes[2].center = { x: x - this.halfWidth - halfThickness, z };
    this.boxes[3].center = { x: x + this.halfWidth + halfThickness, z };
  }
}
