/** Rendering contracts only; simulation values are never changed here. */
export interface ScreenPoint { x: number; y: number }
export type ScreenProjection = (x: number, z: number) => ScreenPoint;

export const COMBAT_LAYERS: Readonly<{
  area: 30; playerShot: 32; impact: 34; player: 37;
  status: 38; text: 42; enemyShot: 44; warning: 47;
}>;
export function playerVisibility(clock: number, invincible: number, phantom?: boolean): number;

export interface DamageTextInput {
  uid: number; age: number; duration: number; value?: unknown; critical?: boolean;
}
export interface DamageTextPose {
  x: number; y: number; alpha: number; fontSize: number; color: string; depth: number;
}
export function damageTextPose(fx: DamageTextInput): DamageTextPose;

export interface HitSparkInput {
  uid: number; kind: string; modelId?: number; age?: number; duration?: number;
}
export class HitSparkAdmission {
  events: Map<number, { allowed: boolean; until: number }>;
  cells: Map<string, number>;
  clock: number;
  beginFrame(clock: number): void;
  accepts(fx: HitSparkInput, point: ScreenPoint): boolean;
  reset(): void;
}

export interface EmitterTiming {
  speed_scale?: number; lifetime?: number; trail_lifetime?: number;
}
export function trimEmitterHistory<Entry extends { age: number }>(
  history: Entry[], age: number, properties: EmitterTiming
): void;

export interface PooledVisual {
  setVisible(visible: boolean): unknown;
  destroy(): void;
}
/** All retained objects and newly created objects have the same concrete type. */
export class VisualMeshPool<View extends PooledVisual> {
  constructor(limit?: number);
  limit: number;
  free: View[];
  created: number;
  reused: number;
  acquire(create: () => View): View;
  release(view: View): void;
  clear(): void;
}
