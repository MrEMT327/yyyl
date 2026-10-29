/** Static APK evidence: research/map-door-restoration.md.
 * A resource reference is not a gameplay spawn instruction. The current
 * chapterType=8 waterfall manager explicitly initializes HasDoor=false.
 * This module describes that closed branch; it adds no room-transition logic.
 */
export interface NativeMapDoorStyle {
  DoorRes: number;
  /** Serialized FP raw values, not world-space floats. */
  DoorPos: readonly number[];
}

/** GetDoorPos 0x6cf029c selects one x/z pair by map size. It does not create
 * one door for every pair. Only call when the manager actually enables a door. */
export function nativeSelectedDoorPosition(rawPositions: readonly number[], mapSizeType: number) {
  if (!Number.isInteger(mapSizeType) || mapSizeType < 0 || mapSizeType * 2 + 1 >= rawPositions.length)
    throw new Error(`Missing native door position for map size ${mapSizeType}`);
  const x = rawPositions[mapSizeType * 2], z = rawPositions[mapSizeType * 2 + 1];
  if (!Number.isSafeInteger(x) || !Number.isSafeInteger(z)) throw new Error('Invalid raw FP door position');
  return { x: x / 65536, y: 0, z: z / 65536 };
}

/** InitWaterfallMap 0x6cfa1c8 -> PrepareInfo -> OnInitAsync 0x7506328.
 * Preserve the authored reference for diagnostics/asset inventory, while
 * preventing scene importers from instantiating it just because it is nonzero.
 * Restricted to the verified ordinary-main-chapter path (chapterType 8).
 */
export function nativeMainChapterDoorPlan(chapterType: number, style: NativeMapDoorStyle) {
  if (chapterType !== 8) throw new Error(`Unverified map-door lifecycle for chapter type ${chapterType}`);
  return {
    configuredResourceId: style.DoorRes,
    configuredPositionsRaw: [...style.DoorPos],
    hasDoor: false as const,
    spawnResourceId: null,
    reason: 'InitWaterfallMap disables the door in the ordinary chapter runtime' as const,
  };
}
