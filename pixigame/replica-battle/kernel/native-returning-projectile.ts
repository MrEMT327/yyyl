import type { NativeWeaponPoint } from './weapon-runtime-extensions';

export interface NativeReturningParams {
  StayTime?: number;
  /** 0: root owner's last damage source, 1: bullet Data.TargetPosition. */
  TargetPosType?: number;
  /** 0: stay on arrival, 1: stay on a matching character hit. */
  StayType?: number;
  HitMonsterTypes?: readonly number[];
  HitMonsterStayTimes?: readonly number[];
}
export interface NativeReturningBirth {
  /** GetOnlyBulletSpeed at OnInit; percentage modifiers remain live. */
  baseSpeed: number;
  forward: NativeWeaponPoint;
  targetPosition?: NativeWeaponPoint;
  /** Snapshot of root owner's recorded damage source, if the entity exists. */
  hurtSourcePosition?: NativeWeaponPoint;
}
export interface NativeReturningHost {
  position(): NativeWeaponPoint;
  owner(): NativeWeaponPoint;
  rootAlive(): boolean;
  /** GetOnlyBulletSpeedPercent + getSecondWeaponDeltaSpeedPercent. */
  speedPercent(): number;
  pose(point: NativeWeaponPoint): void;
  kill(): void;
  /** EntityBullet.FixDeltaPosInLifeRange, if this projectile has a life range. */
  fixDelta?(delta: NativeWeaponPoint): NativeWeaponPoint;
  moved?(delta: NativeWeaponPoint): void;
}

export type NativeReturningPhase = 'outbound' | 'stay' | 'return';
const normal = (p: NativeWeaponPoint): NativeWeaponPoint => {
  const length = Math.hypot(p.x, p.z);
  return length === 0 ? { x: 0, z: 0 } : { x: p.x / length, z: p.z / length };
};

/** MoveAndReturnStayProcessor (6d70f68/6d71184/6d7176c/6d71d58).
 * Host owns collision detection: use current-position overlap in ALL phases,
 * repeat-hit interval, and direct HurtTarget without through-count destruction.
 * This controller does not change bullet rotation or create a visual spin. */
export class NativeReturningProjectileRuntime {
  private currentPhase: NativeReturningPhase = 'outbound';
  private elapsedStay = 0;
  private stayDuration: number;
  private outboundTarget: NativeWeaponPoint;
  private outboundDirection: NativeWeaponPoint;
  private dead = false;

  constructor(private readonly host: NativeReturningHost,
    private readonly params: NativeReturningParams,
    private readonly birth: NativeReturningBirth) {
    this.stayDuration = params.StayTime ?? 0;
    const explicit = params.TargetPosType === 1
      ? birth.targetPosition ?? { x: 0, z: 0 } : birth.hurtSourcePosition;
    if (explicit) {
      this.outboundTarget = { ...explicit };
      const position = host.position();
      this.outboundDirection = normal({ x: explicit.x - position.x, z: explicit.z - position.z });
    } else {
      // Native fallback is the ABSOLUTE vector forward * 2, not birthPos + it.
      this.outboundTarget = { x: birth.forward.x * 2, z: birth.forward.z * 2 };
      this.outboundDirection = { ...birth.forward };
    }
  }

  get phase(): NativeReturningPhase { return this.currentPhase; }
  get collides(): boolean { return !this.dead; }

  /** Call after native CheckHit/HurtTarget. True means native TickHit breaks its
   * hit enumeration this frame after switching to Stay (even for duration 0). */
  onHit(characterType: number): boolean {
    if (this.dead || this.currentPhase !== 'outbound' || this.params.StayType !== 1) return false;
    const index = this.params.HitMonsterTypes?.indexOf(characterType) ?? -1;
    if (index < 0) return false;
    const duration = this.params.HitMonsterStayTimes?.[index] ?? this.params.StayTime ?? 0;
    if (duration < 0) return false;
    this.enterStay(duration);
    return true;
  }

  step(dt: number): void {
    if (this.dead || !this.host.rootAlive()) return;
    if (this.currentPhase === 'stay') {
      this.elapsedStay += dt;
      if (this.elapsedStay >= this.stayDuration) this.currentPhase = 'return';
      return; // Native drops phase-transition remainder, even when duration is 0.
    }
    const position = this.host.position();
    const target = this.currentPhase === 'return' ? this.host.owner() : this.outboundTarget;
    const remaining = { x: target.x - position.x, z: target.z - position.z };
    const direction = this.currentPhase === 'return' ? normal(remaining) : this.outboundDirection;
    const distance = this.birth.baseSpeed * (1 + this.host.speedPercent()) * dt;
    let delta = { x: direction.x * distance, z: direction.z * distance };
    const remainingLength = Math.hypot(remaining.x, remaining.z);
    if (remainingLength >= 0x42 / 65536 && Math.hypot(delta.x, delta.z) > remainingLength) {
      delta = remaining;
    }
    delta = this.host.fixDelta?.(delta) ?? delta;
    const next = { x: position.x + delta.x, z: position.z + delta.z };
    this.host.pose(next);
    this.host.moved?.(delta);
    const updatedTarget = this.currentPhase === 'return' ? this.host.owner() : this.outboundTarget;
    if (Math.hypot(next.x - updatedTarget.x, next.z - updatedTarget.z) > 0x1999 / 65536) return;
    if (this.currentPhase === 'return') {
      this.dead = true;
      this.host.kill();
    } else if ((this.params.StayType ?? 0) === 0) {
      this.enterStay(this.params.StayTime ?? 0);
    } else {
      this.currentPhase = 'return';
    }
  }

  private enterStay(duration: number): void {
    this.currentPhase = 'stay';
    this.elapsedStay = 0;
    this.stayDuration = duration;
  }
}
