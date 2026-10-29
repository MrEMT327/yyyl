import type { Point, RecordData } from './model';

/** CreateRandomMonster 0x6988034, RandomPos 0x698bb64, CheckPosValid
 * 0x698bd74. The caller supplies the current native-style pending creator
 * queue, including tile positions queued before this random creator. Do not
 * pass all historical spawn positions: consumed creators no longer belong to it. */
export function createNativeRandomSpawnPoints(
  event: RecordData, config: RecordData, world: { width: number; height: number; left?: number; right?: number; top?: number },
  queuedPositions: Point[], random: () => number,
): RecordData[] {
  const result: RecordData[] = [];
  const left = world.left ?? -world.width / 2, right = world.right ?? world.width / 2;
  const top = world.top ?? world.height / 2;
  // Native creator storage has 600 slots; this includes prior tile creators.
  const count = Math.max(0, Math.min(Math.trunc(config.count), 600 - queuedPositions.length));
  const separated = (point: Point) => queuedPositions.every(other => Math.hypot(other.x - point.x, other.z - point.z) >= 2);
  const randomPosition = (): Point => {
    let point: Point = { x: 0, z: top };
    for (let attempt = 0; attempt < 10; attempt++) {
      point = { x: Math.min(right - 1, left + 1 + random() * (world.width - 2)),
        z: top + Math.floor(random() * Math.max(1, Number(config.height))) };
      if (separated(point)) break;
    }
    return point;
  };
  while (result.length < count) {
    const group = config.groups[Math.floor(random() * config.groups.length)];
    if (!group?.entityIds?.length) throw new Error(`随机出怪配置为空：${event.id}`);
    const origin = randomPosition();
    for (const [index, entityId] of group.entityIds.entries()) {
      if (result.length >= count) break;
      let position = { x: Math.min(right - 1, origin.x + index * group.width), z: origin.z + index * group.height };
      if (!separated(position)) position = randomPosition();
      queuedPositions.push(position);
      result.push({ entityId, origin: position, needsCameraTopTranslation: false,
        timeBeforeIntervalRepeat: event.time, interval: event.parameters.interval });
    }
  }
  return result;
}
