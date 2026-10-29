/** AIMoveReboundWall / MoveOnStraightForward, APK 1.1.6.
 * Call checkNativeEnemyRebound BEFORE advanceNativeEnemyRebound each AI tick.
 * Physical queries remain the host's responsibility: camera edges are not walls.
 */
export interface ReboundPoint { x: number; z: number }
export interface ReboundBounds { left: number; right: number; top: number; bottom: number }
/** ScrollCameraManager.Init 0x6a049e4/0x6a04a00 loads the second int64 at
 * ELF VA 0x1a8e9b0 into this.xOffset (+0x38), independent of aspect ratio. */
export const nativeEnemyReboundScrollXOffset = 131072 / 65536;
export interface NativeEnemyReboundState {
  direction: ReboundPoint;
  /** MoveOnStraightForward.OnStart 0x69dd378; SetData does not recapture it. */
  taskSpeed: number;
  needTriggerOutMap: boolean;
  allowReboundRayCast: boolean;
}

export function createNativeEnemyRebound(originAngleDegrees: number, taskStartSpeed: number): NativeEnemyReboundState {
  const angle = originAngleDegrees * Math.PI / 180;
  return { direction: { x: Math.sin(angle), z: Math.cos(angle) }, taskSpeed: taskStartSpeed,
    needTriggerOutMap: false, allowReboundRayCast: false };
}

/** GetReboundOffset 0x68f4fb4. Shape type is the native Shape2D type,
 * not the entity type. Do not substitute a bounding-circle diagonal. */
export function nativeReboundRayOffset(shapeType: number, shape: readonly number[]): number {
  if (shapeType === 1) return shape[0];
  if (shapeType === 4) return shape[1];
  return 0x6666 / 65536;
}

export function nativeReboundRay(position: ReboundPoint, state: NativeEnemyReboundState,
  offset: number, currentSpeed: number, dt: number): { start: ReboundPoint; end: ReboundPoint } {
  const start = { x: position.x + state.direction.x * offset, z: position.z + state.direction.z * offset };
  return { start, end: { x: start.x + state.direction.x * currentSpeed * dt,
    z: start.z + state.direction.z * currentSpeed * dt } };
}

function reflect(state: NativeEnemyReboundState, normal: ReboundPoint): void {
  const dot = state.direction.x * normal.x + state.direction.z * normal.z;
  state.direction = { x: state.direction.x - 2 * dot * normal.x,
    z: state.direction.z - 2 * dot * normal.z };
}

export interface NativeReboundCheck {
  /** Actual camera world bounds; recovery expands these by native constant 5. */
  camera: ReboundBounds;
  /** ScrollCameraManager.xOffset; independent of actor radius. */
  scrollXOffset: number;
  /** Physics query result after native CheckHit filtering. Omit if no query hit.
   * An unavailable physical query must be reported by the host as a fidelity gap. */
  cast?: { camp: number; normal: ReboundPoint };
  /** Nearest valid native AI target, evaluated only when recovery is needed. */
  nearestTarget: () => ReboundPoint | undefined;
}

/** CheckRebound 0x68f431c; no position correction occurs here.
 * true means direction/rotation was assigned; use atan2(direction.x,direction.z).
 */
export function checkNativeEnemyRebound(position: ReboundPoint, state: NativeEnemyReboundState,
  input: NativeReboundCheck): boolean {
  if (input.cast && state.allowReboundRayCast) {
    // 0x68f4a2c..0x68f4ab4: a hit consumes this branch even when it is not camp 32.
    if (input.cast.camp === 32) { reflect(state, input.cast.normal); return true; }
    return false;
  }
  const halfWidth = (input.camera.right - input.camera.left) / 2;
  const halfHeight = (input.camera.top - input.camera.bottom) / 2;
  // convertCameraFixBoundsToMapRect uses width/height around world zero.
  const left = -halfWidth - input.scrollXOffset, right = halfWidth + input.scrollXOffset;
  const bottom = -halfHeight, top = halfHeight;
  if (position.x >= left && position.x <= right && position.z >= bottom && position.z <= top) {
    state.needTriggerOutMap = state.allowReboundRayCast = true;
    return false;
  }
  let changed = false;
  if (state.needTriggerOutMap) {
    // GetPosInIllegalBoundsLine 0x6cf7bdc: horizontal edges win at corners.
    const normal = position.x > right ? { x: -1, z: 0 }
      : position.x < left ? { x: 1, z: 0 }
      : position.z > top ? { x: 0, z: -1 } : { x: 0, z: 1 };
    reflect(state, normal);
    state.needTriggerOutMap = state.allowReboundRayCast = false;
    changed = true;
  }
  const c = input.camera;
  if (position.x < c.left - 5 || position.x > c.right + 5
    || position.z < c.bottom - 5 || position.z > c.top + 5) {
    const target = input.nearestTarget();
    if (target) {
      const dx = target.x - position.x, dz = target.z - position.z;
      const length = Math.hypot(dx, dz);
      state.direction = length === 0 ? { x: 0, z: 0 } : { x: dx / length, z: dz / length };
      changed = true;
    }
  }
  return changed;
}

/** MoveOnStraightForward.OnUpdate 0x69dd3f0, after AI state update. */
export function advanceNativeEnemyRebound(position: ReboundPoint, state: NativeEnemyReboundState, dt: number): void {
  position.x += state.direction.x * state.taskSpeed * dt;
  position.z += state.direction.z * state.taskSpeed * dt;
}
