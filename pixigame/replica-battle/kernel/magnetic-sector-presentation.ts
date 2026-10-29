import type { Projectile, RecordData } from './model';
import { originalEffectDuration } from './original-effects';

/** Only the stationary magnetic fans. Plasma balls keep their own two trails. */
export function isMagneticSector(b: Readonly<Projectile>): boolean {
  return b.owner === 'player' && b.familyId === 200011 && !b.beam
    && b.fixedSegments === true && (b.modelId === 1000023 || b.modelId === 1000052);
}

export interface MagneticSectorPose {
  uid: number; modelId: number; bornAt: number; duration: number;
  age: number; x: number; z: number; angle: number; scale: number;
}

/** Render-only snapshots: no reference to a damage entity survives capture.
 * The captured fan prefabs use small authored root matrices (.16 / .15).
 * Map their normalized envelope to the resolved sector radius, not the zero
 * collider radius or Bullet.Scale=1. Read the existing rays so next-fire and
 * range upgrades cannot silently diverge from the visible footprint.
 * This is H5 presentation adaptation, not a new native combat rule.
 */
export class MagneticSectorPresentation {
  private shots = new Map<number, MagneticSectorPose>();
  private runId = -1;
  private lastClock = -Infinity;
  private durations = new Map<number, number>();

  update(state: { runId: number; clock: number; phase: string; projectiles: readonly Projectile[] },
    effects: RecordData, weapons: RecordData): MagneticSectorPose[] {
    if (state.runId !== this.runId || state.clock < this.lastClock
      || ['ready', 'won', 'lost', 'revive'].includes(state.phase)) this.shots.clear();
    this.runId = state.runId; this.lastClock = state.clock;
    if (['ready', 'won', 'lost', 'revive'].includes(state.phase)) return [];
    for (const b of state.projectiles) {
      if (!isMagneticSector(b) || b.visualHidden || !(b.scale > 0) || !(b.age > 0) || !b.segments.length) continue;
      const raw = weapons[b.weaponId];
      let parameters = raw?.TrajectoryParams ?? raw?.trajectoryParameters;
      if (typeof parameters === 'string') { try { parameters = JSON.parse(parameters); } catch { continue; } }
      const expansion = Number(parameters?.ExpansionTime);
      if (!(expansion > 0)) continue;
      const fraction = Math.min(1, b.age / expansion);
      const radius = Math.max(...b.segments.map(s => Math.hypot(s.to.x - s.from.x, s.to.z - s.from.z))) / fraction;
      if (!(radius > 0) || !Number.isFinite(radius)) continue;
      let duration = this.durations.get(b.modelId);
      if (duration === undefined) {
        duration = originalEffectDuration(effects, b.modelId);
        this.durations.set(b.modelId, duration);
      }
      // A missing/looping asset must not leave an immortal render snapshot.
      if (!(duration > 0) || !Number.isFinite(duration)) continue;
      const origin = b.segments[0].from;
      this.shots.set(b.uid, { uid: b.uid, modelId: b.modelId, bornAt: state.clock - b.age,
        duration, age: b.age, x: origin.x, z: origin.z, angle: b.angle, scale: radius });
    }
    const poses: MagneticSectorPose[] = [];
    for (const [uid, shot] of this.shots) {
      const age = state.clock - shot.bornAt;
      if (age < 0 || age >= shot.duration) { this.shots.delete(uid); continue; }
      poses.push({ ...shot, age });
    }
    return poses;
  }
}
