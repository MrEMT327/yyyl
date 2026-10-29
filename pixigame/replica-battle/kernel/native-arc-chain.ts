import type { Point } from './model';
import { nativeSelectEjectTarget } from './native-eject';

export interface NativeArcTarget extends Point { uid: number; dead?: boolean; noEject?: boolean; hitCamp?: number }
export interface NativeArcHit { weaponId: number; from: Point; to: Point; scale: number; first: boolean; final: boolean; previousTarget?: number }

/** FlashChainMod creates an actual damaging chain on BulletHitTarget. Its
 * MoveStraight carrier has DisableHurtTarget, so it must never deal the same
 * damage a second time. Ejection selects a random eligible target, excludes
 * the current entity and waits EjectDelayDuration before changing direction.
 * Evidence: weapon-arc-chain-native.txt / weapon-pool-motion-native.txt. */
export class NativeArcChain {
  private count = 0;
  private previousTarget?: number;
  private previousPoint?: Point;
  private scale = 1;
  private next?: number;
  private remainingDelay = 0;

  constructor(readonly settings: {
    chainWeaponId: number; startChainWeaponId: number;
    ejectCount: number; ejectDistance: number; ejectDelay: number;
    ejectProbability: number; attackPercent: number;
    /** Preserve original EjectModRandomType (0 cycles the unfiltered list). */
    randomType?: number; hitCampMask?: number;
  }) {}

  get waiting(): boolean { return this.remainingDelay > 0; }
  get nextTarget(): number | undefined { return this.next; }
  get lastTarget(): number | undefined { return this.previousTarget; }

  hit(target: NativeArcTarget, muzzle: Point, targets: readonly NativeArcTarget[], random: () => number,
    carrierPosition: Point = target): NativeArcHit {
    // LastEjectTarget is the destination selected on the prior bounce (the
    // current hit), NOT the older source used for drawing the previous link.
    // Revisiting that older source is allowed after its per-target hit gate.
    const selected = this.count < this.settings.ejectCount
      ? nativeSelectEjectTarget(targets, carrierPosition, this.settings.ejectDistance,
        target.uid, this.settings.hitCampMask ?? 2, this.settings.randomType ?? 0, random) : undefined;
    const canEject = this.count < this.settings.ejectCount && selected !== undefined
      && (this.settings.ejectProbability >= 1 || random() < this.settings.ejectProbability);
    const first = this.count === 0;
    const hit: NativeArcHit = {
      weaponId: first && this.settings.startChainWeaponId > 0 ? this.settings.startChainWeaponId : this.settings.chainWeaponId,
      from: { ...(this.previousPoint || muzzle) }, to: { x: target.x, z: target.z },
      scale: this.scale, first, final: !canEject, previousTarget: this.previousTarget,
    };
    this.previousPoint = { x: target.x, z: target.z }; this.previousTarget = target.uid;
    this.count++;
    if (canEject) {
      this.next = selected!.uid;
      this.remainingDelay = this.settings.ejectDelay;
      const raw = Math.floor(Math.trunc(this.scale * 65536) * (65536 + Math.trunc(this.settings.attackPercent * 65536)) / 65536);
      // Const.MinEjectAttackPercent cctor@688b1d4, slot952fa90 = "0.5f".
      this.scale = Math.max(32768, raw) / 65536;
    } else this.next = undefined;
    return hit;
  }

  /** Target is validated again after the hold; a dead prediction must not
   * continue tracking the removed entity. The host may request a new target. */
  advance(dt: number): boolean {
    if (this.remainingDelay <= 0) return true;
    this.remainingDelay -= dt;
    return this.remainingDelay <= 0;
  }

  /** Call once advance returns true and before directing the carrier. A valid
   * prediction is retained even if it moved out of range or gained NoEject;
   * only missing/dead predictions trigger a fresh native candidate search.
   * Supply the complete camera list in EntityManager order, not prefiltered
   * eligible targets. Return undefined ends this carrier's bounce path. */
  resolveNextTarget(targetsInCamera: readonly NativeArcTarget[], random: () => number,
    position: Point = this.previousPoint ?? { x: 0, z: 0 },
    lookup?: (uid: number) => NativeArcTarget | undefined): NativeArcTarget | undefined {
    if (this.next === undefined) return undefined;
    const predicted = lookup ? lookup(this.next) : targetsInCamera.find(target => target.uid === this.next);
    if (predicted && !predicted.dead) return predicted;
    const replacement = nativeSelectEjectTarget(targetsInCamera, position, this.settings.ejectDistance,
      this.previousTarget, this.settings.hitCampMask ?? 2, this.settings.randomType ?? 0, random);
    this.next = replacement?.uid;
    return replacement;
  }
}
