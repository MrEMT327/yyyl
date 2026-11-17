/** Source: DynamicMap.Update 0x7561f0c, OnInit 0x756023c;
 * DynamicLoadMapManager.CreateMap 0x756037c and Update 0x7561364.
 * All positions and speeds are original Unity world X/Z units.
 */
export type NativeMapBounds = [number, number, number, number];
export interface NativeMapSegment {
  key: string;
  url: string;
  width: number;
  height: number;
  bounds: NativeMapBounds;
  blendMode: 'NORMAL' | 'ADD' | 'SUBTRACT';
  batchOrder: number;
}
export interface NativeMapLayer {
  id: string;
  layer: number;
  name: string;
  active: boolean;
  moveSpeed: number;
  mulSpeed: number;
  moveType: number;
  verticalDistance: number;
  moveScale: number;
  origin: { x: number; y: number; z: number };
  /** Original Collider.bounds.size.z. Zero only for non-DynamicMap decoration. */
  loopLength: number;
  bounds: NativeMapBounds;
  segments: NativeMapSegment[];
  rendererCount: number;
  spriteCount: number;
}
export interface NativeChapterMapLayers {
  prefab: string;
  layers: NativeMapLayer[];
  viewHeightMax: number;
  simulationViewMoveDenominator: number;
  renderers?: NativeMapSpriteRenderer[];
  status: 'inventory' | 'composed' | 'source-sprites';
}
/** Full raw source placement; owner is DynamicMap.id, or 'static'.
 * matrix maps sprite-local XY to Unity world XYZ. Bounds are conservative
 * world XZ bounds before layer scrolling and simulation-view camera offsets.
 */
export interface NativeMapSpriteRenderer {
  rendererPathId: string;
  name: string;
  sprite: string;
  spritePathId: string;
  owner: string;
  active: boolean;
  enabled: boolean | number;
  matrix: number[][];
  x: number;
  y: number;
  z: number;
  color: { r: number; g: number; b: number; a: number };
  flipX: boolean;
  flipY: boolean;
  drawMode: number;
  size: { x: number; y: number };
  bounds: NativeMapBounds;
  sortingKey: number[];
  sortingOrder: number;
  materials: { m_FileID: number; m_PathID: number | string }[];
  batchOrder: number;
  blendMode: 'NORMAL' | 'ADD' | 'SUBTRACT';
}
export interface NativeMapLayersManifest {
  version: number;
  chapters: Record<string, NativeChapterMapLayers>;
}
export interface NativeMapSegmentPose {
  /** Repeat index is relative to the unwrapped original source map. */
  repeat: number;
  x: number;
  z: number;
  width: number;
  height: number;
}

/** The raw native Update translates towards Vector3.back, regardless of
 * moveType. SimulationView only controls the separate camera displacement. */
export function nativeMapScrollZ(layer: NativeMapLayer, elapsed: number, mulSpeed = layer.mulSpeed): number {
  return -layer.moveSpeed * elapsed * mulSpeed;
}

/** Lowest visible repeat center for renderers that manage their own copy pool.
 * Do not repeat static decorations. If a strip plus viewport spans > one period,
 * also draw subsequent centers separated by loopLength; use SegmentPoses above
 * to obtain that exact list automatically. */
export function nativeMapSegmentZ(
  layer: NativeMapLayer,
  segmentCenterZ: number,
  elapsed: number,
  viewportBottom: number,
  segmentHalfHeight: number,
): number {
  const z = segmentCenterZ + nativeMapScrollZ(layer, elapsed);
  if (!(layer.loopLength > 0)) return z;
  return z + Math.ceil((viewportBottom - segmentHalfHeight - z) / layer.loopLength) * layer.loopLength;
}

/** Return only visible repeated strip copies. Unlike wrapping each strip at an
 * arbitrary viewport threshold, this preserves the native layer's exact repeat
 * period, including authored overlaps extending outside the collider bounds.
 * Camera offsets are explicit inputs; this function invents no parallax factor.
 */
export function nativeMapSegmentPoses(
  layer: NativeMapLayer,
  segment: Pick<NativeMapSegment, 'bounds'>,
  scrollZ: number,
  visibleBounds: NativeMapBounds,
  cameraOffset: { x: number; z: number } = { x: 0, z: 0 },
): NativeMapSegmentPose[] {
  if (!layer.active) return [];
  const [x0, z0, x1, z1] = segment.bounds;
  const x = (x0 + x1) / 2 + cameraOffset.x;
  const width = x1 - x0, height = z1 - z0;
  if (x + width / 2 < visibleBounds[0] || x - width / 2 > visibleBounds[2]) return [];
  const z = (z0 + z1) / 2 + scrollZ + cameraOffset.z;
  const length = layer.loopLength;
  if (!(length > 0)) {
    return z + height / 2 < visibleBounds[1] || z - height / 2 > visibleBounds[3]
      ? [] : [{ repeat: 0, x, z, width, height }];
  }
  const first = Math.ceil((visibleBounds[1] - z - height / 2) / length);
  const last = Math.floor((visibleBounds[3] - z + height / 2) / length);
  const poses: NativeMapSegmentPose[] = [];
  for (let repeat = first; repeat <= last; repeat++) poses.push({ repeat, x, z: z + repeat * length, width, height });
  return poses;
}

/** Integrate speed changes without retroactively applying a new multiplier to
 * all elapsed time. Pass the same game delta the source map Update receives;
 * call with zero while the game is paused. */
export class NativeMapLayerClock {
  private offsets = new Map<string, number>();
  private multiplier = 1;
  setMulSpeed(value: number): void { this.multiplier = value; }
  reset(): void { this.offsets.clear(); this.multiplier = 1; }
  update(layers: readonly NativeMapLayer[], deltaSeconds: number): void {
    for (const layer of layers) {
      if (!layer.active) continue;
      const offset = (this.offsets.get(layer.id) ?? 0) - layer.moveSpeed * deltaSeconds * this.multiplier;
      this.offsets.set(layer.id, offset);
    }
  }
  z(layer: NativeMapLayer): number { return this.offsets.get(layer.id) ?? 0; }
}

/** ScrollMapManager.UpdatePos uses the interpolated CameraView delta, not the
 * logical camera or player. Preserve the Unity float operation order and each
 * layer's authored sign/scale; None layers receive no extra displacement. */
export class NativeMapCameraOffsets {
  private offsets = new Map<string, { x: number; z: number }>();
  reset(): void { this.offsets.clear(); }
  update(layers: readonly NativeMapLayer[], delta: { x: number; z: number }, denominator: number): void {
    for (const layer of layers) {
      if (!layer.active || layer.moveType !== 1) continue;
      const distance = Math.abs(Math.fround(layer.verticalDistance));
      const factor = Math.fround(distance / Math.fround(Math.fround(denominator) + distance));
      const offset = this.offsets.get(layer.id) ?? { x: 0, z: 0 };
      const dx = Math.fround(Math.fround(Math.fround(delta.x) * factor) * Math.fround(layer.moveScale));
      const dz = Math.fround(Math.fround(Math.fround(delta.z) * factor) * Math.fround(layer.moveScale));
      this.offsets.set(layer.id, { x: Math.fround(offset.x + dx), z: Math.fround(offset.z + dz) });
    }
  }
  position(layer: NativeMapLayer): Readonly<{ x: number; z: number }> {
    return this.offsets.get(layer.id) ?? { x: 0, z: 0 };
  }
}
