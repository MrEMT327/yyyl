import type { Point, Projectile, RecordData } from './model';
import curveSource from '../public/data/projectile-curves.json';

/** State belongs to a bullet, not its owning actor. Several salvos can coexist. */
export interface NativeProjectileMotion {
  direction: number;
  elapsed: number;
  offset: number;
  mirror: number;
  diffusion: Point;
  createElapsed: number;
  attack: number;
  curveTick?: number;
}

/** Unity's unweighted keys use cubic Hermite interpolation, not linear lerp.
 * The shipped speed curve 100027 is unweighted and clamps outside its keys. */
export function nativeSpeedCurveValue(id: number, time: number): number {
  const curve = (curveSource.curves as Record<string, any>)[String(id)];
  const keys = curve?.m_Curve;
  if (!keys?.length) return 0;
  if (time <= keys[0].time) return keys[0].value;
  const last = keys[keys.length - 1];
  if (time >= last.time) return last.value;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i];
    if (time > b.time) continue;
    if (!Number.isFinite(Number(a.outSlope)) || !Number.isFinite(Number(b.inSlope))) return a.value;
    const duration = b.time - a.time, t = (time - a.time) / duration;
    return (2*t*t*t-3*t*t+1)*a.value + (t*t*t-2*t*t+t)*duration*Number(a.outSlope) + (-2*t*t*t+3*t*t)*b.value + (t*t*t-t*t)*duration*Number(b.inSlope);
  }
  return last.value;
}

/** MoveStraight.TickHit 0x6d7c87c: with a curve, Acc*Evaluate is added
 * ONCE PER native logic tick; without a curve Acc is multiplied by deltaTime. */
export function advanceNativeStraightSpeed(bullet: Projectile, state: NativeProjectileMotion, parameters: RecordData, dt: number): void {
  const acceleration = Number(parameters.Acc || 0);
  if (!acceleration) return;
  let speed = Math.hypot(bullet.vx, bullet.vz);
  if (Number(parameters.CurveId) > 0) {
    const tick = Math.floor((bullet.age + 1e-9) * 30);
    for (let n = (state.curveTick || 0) + 1; n <= tick; n++) {
      speed += acceleration * nativeSpeedCurveValue(Number(parameters.CurveId), parameters.CurveMaxTime ? n / 30 / Number(parameters.CurveMaxTime) : 0);
      if (parameters.Limit !== undefined) speed = acceleration > 0 ? Math.min(speed, Number(parameters.Limit)) : Math.max(speed, Number(parameters.Limit));
    }
    state.curveTick = tick;
  } else {
    speed += acceleration * dt;
    if (parameters.Limit !== undefined) speed = acceleration > 0 ? Math.min(speed, Number(parameters.Limit)) : Math.max(speed, Number(parameters.Limit));
  }
  bullet.vx = Math.sin(bullet.angle) * speed; bullet.vz = Math.cos(bullet.angle) * speed;
}

export function createNativeProjectileMotion(angle: number, radial: Point | undefined, mirror: number, attack: number): NativeProjectileMotion {
  const length = radial ? Math.hypot(radial.x, radial.z) : 0;
  return { direction: angle, elapsed: 0, offset: 0, mirror, diffusion: length ? { x: radial!.x / length, z: radial!.z / length } : { x: 0, z: 0 }, createElapsed: 0, attack };
}

/** MoveDiffusionProcessor 0x6d75704 / 0x6d76518: a translating formation,
 * plus a finite radial expansion from WeaponBornPosition. Not a radial salvo. */
export function advanceNativeDiffusion(bullet: Projectile, state: NativeProjectileMotion, parameters: RecordData, dt: number): void {
  const duration = Number(parameters.DiffusionTime || 0);
  const radial = state.elapsed < duration && duration > 0 ? Number(parameters.DiffusionSize || 0) / duration : 0;
  bullet.x += (bullet.vx + state.diffusion.x * radial) * dt;
  bullet.z += (bullet.vz + state.diffusion.z * radial) * dt;
  state.elapsed += dt;
}

/** GetNextPosition 0x6d7855c uses speed*dt/2 for forward travel and
 * amplitude*sin(elapsed*frequency)*(speed*logicDt/2) for its lateral offset.
 * The reference tick is the APK's 30 Hz, independent of browser refresh rate.
 * OnTrajectoryUpdate turns the sprite/collider along its actual displacement. */
export function advanceNativeSnake(bullet: Projectile, state: NativeProjectileMotion, parameters: RecordData, dt: number): void {
  const speed = Math.hypot(bullet.vx, bullet.vz);
  state.elapsed += dt;
  const offset = Number(parameters.Amplitude || 0) * Math.sin(state.elapsed * Number(parameters.Frequency || 0)) * speed / 60;
  const side = (offset - state.offset) * state.mirror;
  const dx = Math.sin(state.direction) * speed * dt / 2 + Math.cos(state.direction) * side;
  const dz = Math.cos(state.direction) * speed * dt / 2 - Math.sin(state.direction) * side;
  bullet.x += dx; bullet.z += dz;
  if (dx || dz) bullet.angle = Math.atan2(dx, dz);
  state.offset = offset;
}

/** Weapon.onCreateEllipseShape 0x6e4c28c. All bullets share forward rotation;
 * only their birth positions form an ellipse (axes remain in world X/Z). */
export function nativeEllipseOffsets(parameters: RecordData): Point[] {
  const count = Math.max(1, Math.trunc(parameters.Count || 1));
  return Array.from({ length: count }, (_, index) => {
    const angle = index * Math.PI * 2 / count;
    return { x: Math.sin(angle) * Number(parameters.SemiMajorAxis || 0), z: Math.cos(angle) * Number(parameters.SemiMinorAxis || 0) };
  });
}
