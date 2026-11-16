import type { Projectile, RecordData } from './model';
import { originalEffectDuration, originalEffectHistoryDuration } from './original-effects';
import { isMagneticSector } from './magnetic-sector-presentation';

interface TailPose {
  uid: number; modelId: number; x: number; z: number; scale: number; angle: number;
  age: number; capturedAt: number; duration: number; emissionStopAge: number;
  finiteImpact: boolean;
}
const families = new Set([200001,200011,200031,200041,200061,200091,200101,200121,200141,200151,200171]);
/** Detached world-space smoke/sparks only. Bodies, local glow, damage and beams
 * still end with the simulation entity. Native TrailRenderer histories remain independent. */
export class WeaponParticleTails {
  private poses = new Map<number, TailPose>();
  private durations = new Map<number, number>();
  private runId = -1;
  private clock = -Infinity;

  update(state: { runId: number; clock: number; phase: string; projectiles: readonly Projectile[] }, effects: RecordData): TailPose[] {
    const ended = ['ready','won','lost','revive'].includes(state.phase);
    if (ended || state.runId !== this.runId || state.clock < this.clock) this.poses.clear();
    this.runId = state.runId; this.clock = state.clock;
    if (ended) return [];
    const active = new Set<number>();
    for (const b of state.projectiles) {
      if (b.owner !== 'player' || (!families.has(b.familyId) && b.weaponId !== 200151)
        || b.beam || isMagneticSector(b) || b.visualHidden || !(b.scale > 0)
        || !b.modelId || (b.weaponId === 110001 && b.held)) continue;
      let duration = this.durations.get(b.modelId);
      // Lightning is a stationary, finite hit effect, not a flying projectile body.
      const finiteImpact = b.modelId === 1000048;
      if (duration === undefined) {
        duration = finiteImpact ? originalEffectDuration(effects, b.modelId) : originalEffectHistoryDuration(effects, b.modelId);
        this.durations.set(b.modelId, duration);
      }
      if (!(duration > 0) || !Number.isFinite(duration)) continue;
      active.add(b.uid);
      this.poses.set(b.uid, { uid: b.uid, modelId: b.modelId, x: b.x, z: b.z,
        scale: b.scale, angle: b.angle, age: b.age, capturedAt: state.clock,
        duration: finiteImpact ? Math.max(0, duration - b.age) : duration,
        finiteImpact, emissionStopAge: b.age });
    }
    const tails: TailPose[] = [];
    for (const [uid, pose] of this.poses) {
      if (active.has(uid)) continue;
      const elapsed = state.clock - pose.capturedAt;
      if (elapsed >= pose.duration) { this.poses.delete(uid); continue; }
      tails.push({ ...pose, age: pose.emissionStopAge + elapsed });
    }
    return tails;
  }
}
