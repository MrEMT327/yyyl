import type { GameContent, RecordData, Spawn } from './model';
import { createNativeRandomSpawnPoints } from './random-spawn';
import type { NativeScrollCameraBounds } from './native-scroll-camera';

/** A mission's authored time chooses when it is refreshed. Once refreshed,
 * each creator owns an independent world-clock deadline. UI waits may hold
 * mission progression, but never rebase creators already in this queue. */
export class MissionCreators {
  private future: Spawn[];
  private queued: Spawn[] = [];
  private refreshed = new Set<number>();
  private seed: number;
  constructor(private content: GameContent) {
    this.future = [...content.spawns];
    this.seed = (Number(content.chapter.chapter.id) ^ 0x1badf00d) >>> 0;
  }
  private random = (): number => {
    this.seed ^= this.seed << 13; this.seed ^= this.seed >>> 17; this.seed ^= this.seed << 5;
    return (this.seed >>> 0) / 4294967296;
  };

  refresh(event: RecordData, worldClock: number, carryGold: (spawn: Spawn) => boolean, camera?: NativeScrollCameraBounds): void {
    if (this.refreshed.has(event.id)) return;
    this.refreshed.add(event.id);
    const templates = this.future.filter(spawn => spawn.eventId === event.id);
    this.future = this.future.filter(spawn => spawn.eventId !== event.id);
    const authoredRefresh = Number(event.baseTime ?? event.time);
    const append = (template: Spawn, position?: { x: number; z: number }) => {
      if (this.queued.length >= 600) return;
      // AddGoldMonster writes the creator's flag BEFORE it enters the queue,
      // not when a delayed creator eventually instantiates its entity.
      this.queued.push({ ...template, ...(position || {}), carriesGold: carryGold(template), time: worldClock + template.time - authoredRefresh });
    };
    const repeats = [...new Set(templates.map(spawn => spawn.creatorRepeat || 0))].sort((a, b) => a - b);
    for (const repeat of repeats) {
      const batch = templates.filter(spawn => (spawn.creatorRepeat || 0) === repeat);
      // Native CreateIntervalMonster: tile/group first, then random, each repeat.
      for (const template of batch) if (!template.randomPlacement) append(template);
      const randomTemplates = batch.filter(spawn => spawn.randomPlacement);
      if (!randomTemplates.length) continue;
      const config = this.content.assets.geometry.randomSpawns[event.id];
      if (!config) throw new Error(`缺少随机出怪配置：${event.id}`);
      // CreateRandomMonster / RandomPos read the current CameraBounds after
      // the world's camera update; authored tile X coordinates remain absolute.
      const world = camera ? { width: camera.right - camera.left, height: camera.top - camera.bottom,
        left: camera.left, right: camera.right, top: camera.top } : this.content.world;
      const points = createNativeRandomSpawnPoints(event, config, world, this.queuedPositions, this.random);
      for (const [index, point] of points.entries()) {
        const template = randomTemplates[index];
        if (!template || template.entityId !== point.entityId)
          throw new Error(`随机出怪预算与实体不一致：${event.id}/${point.entityId}`);
        append(template, point.origin);
      }
    }
    this.queued.sort((a, b) => a.time - b.time || a.eventId - b.eventId);
  }

  takeDue(worldClock: number): Spawn[] {
    let count = 0;
    while (count < this.queued.length && this.queued[count].time <= worldClock) count++;
    return this.queued.splice(0, count);
  }

  cancelWave(wave: number): void {
    this.future = this.future.filter(spawn => spawn.wave !== wave);
    // ClearMonsterCreateData@0x692ec1c resets the global creator count.
    // Older waves' delayed creators are cancelled too; unrefreshed future
    // waves remain available, while this wave's skipped missions are removed.
    this.queued = [];
  }

  get queuedCount(): number { return this.queued.length; }
  get queuedPositions() { return this.queued.map(spawn => ({ x: spawn.x, z: spawn.z })); }
  pending(predicate: (spawn: Spawn) => boolean): boolean {
    return this.future.some(predicate) || this.queued.some(predicate);
  }
  pendingWave(wave: number, specialOnly = false): boolean {
    return this.pending(spawn => {
      const type = Number(this.content.chapter.entities[spawn.entityId].raw.Type);
      return spawn.wave === wave && (!specialOnly || type === 201 || type === 3 || type === 15);
    });
  }
}
