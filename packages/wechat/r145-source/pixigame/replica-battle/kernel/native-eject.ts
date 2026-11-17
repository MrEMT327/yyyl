import type { Point } from './model';

export interface NativeEjectParams {
  EjectCount?: number; AttackPercent?: number; SpeedPercent?: number;
  EjectProbability?: number; EjectDistance?: number; EjectDelayDuration?: number;
  BulletTrait?: number; EjectModRandomType?: number;
}
export interface NativeEjectTarget extends Point {
  uid: number; dead?: boolean; noEject?: boolean;
  /** Relation to this bullet: friendly=1, enemy=2, neutral (camp 4)=8. */
  hitCamp?: number;
}
export interface NativeEjectHost {
  /** EntityManager order, ALL characters in camera, before eligibility filtering. */
  targetsInCamera(): readonly NativeEjectTarget[];
  target(uid: number): NativeEjectTarget | undefined;
  position(): Point;
  random(): number;
  disabled(): boolean;
  ownerAttributes(): Readonly<Record<string, number>>;
  hitCampMask(): number;
}
export interface NativeEjectHit {
  target: NativeEjectTarget;
  position: Point;
  /** Unit incoming trajectory direction. */
  direction: Point;
  /** MoveStraight.CheckHitInfo.IsThrough: keep position for a through hit. */
  piercing?: boolean;
  preventCount?: boolean;
}
export type NativeEjectOutcome = { kind: 'none' | 'hold' } | {
  kind: 'turn' | 'dead';
  targetUid?: number; position: Point; yawRadians?: number;
  /** Multiply current damage by this ratio; the cumulative floor is 0.5. */
  damageScaleRatio: number;
  /** Add to BulletSpeed% once, recomputing speed from its original base. */
  firstSpeedAttributeDelta: number;
  addFlags: number;
  remainingCount: number;
  /** 4 = no next target. This still consumes the eject and applies component31. */
  result: 0 | 4;
  componentEvent: 31;
};

/** EjectModParams ctor@6d234f0; each repeated record is deserialized with
 * defaults BEFORE EjectModProcessor.AddModRepeat combines it. */
export function nativeEjectParameters(records: readonly NativeEjectParams[]): Required<NativeEjectParams> {
  const rows = records.map(p => ({ EjectCount: 0, AttackPercent: 0, SpeedPercent: 0,
    EjectProbability: 1, EjectDistance: 10, EjectDelayDuration: 0,
    BulletTrait: 4096, EjectModRandomType: 0, ...p }));
  const first = rows[0] || { EjectCount: 0, AttackPercent: 0, SpeedPercent: 0,
    EjectProbability: 1, EjectDistance: 10, EjectDelayDuration: 0,
    BulletTrait: 4096, EjectModRandomType: 0 };
  return { ...first,
    EjectCount: rows.reduce((n, p) => n + p.EjectCount, 0),
    AttackPercent: rows.reduce((n, p) => n + p.AttackPercent, 0),
    SpeedPercent: rows.reduce((n, p) => n + p.SpeedPercent, 0),
    EjectProbability: rows.reduce((n, p) => n + p.EjectProbability, 0),
    EjectDistance: Math.max(...rows.map(p => p.EjectDistance), 0),
    EjectDelayDuration: Math.max(...rows.map(p => p.EjectDelayDuration), 0),
    BulletTrait: rows.reduce((n, p) => n | p.BulletTrait, 0),
  };
}

/** FindRandomTargetInRange@5f5079c uses a random start in the UNFILTERED camera
 * list and cyclic first-fit. Random2@5f50088 samples the filtered list instead.
 * Neither branch uses nearest, IsChooseAble, nor the bullet's historic hit set. */
export function nativeSelectEjectTarget(candidates: readonly NativeEjectTarget[], position: Point,
  range: number, excludeUid: number | undefined, hitCampMask: number, randomType: number,
  random: () => number): NativeEjectTarget | undefined {
  const eligible = (t: NativeEjectTarget) => !t.dead && !t.noEject && t.uid !== excludeUid
    && (((t.hitCamp ?? 2) & hitCampMask) === (t.hitCamp ?? 2))
    && (t.x - position.x) ** 2 + (t.z - position.z) ** 2 < range * range;
  if (randomType === 1) {
    const targets = candidates.filter(eligible);
    return targets.length ? targets[Math.floor(random() * targets.length)] : undefined;
  }
  if (!candidates.length) return undefined;
  const start = Math.floor(random() * candidates.length);
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[(start + i) % candidates.length];
    if (eligible(candidate)) return candidate;
  }
  return undefined;
}

/** Ordinary MoveStraight EjectMod, distinct from FlashChain.
 * Evidence: weapon-pool-parent-native.txt, weapon-mod-repeat-native.txt,
 * weapon-pool-motion-native.txt, weapon-pool-target-rebound-native.txt,
 * native-eject-admission.txt, native-eject-strings.json, weapon-arc-chain-native.txt.
 * Instantiate after collecting mods, once per bullet. Probability is one
 * OnModBuildComplete roll granting the entire count, never a per-bounce roll.
 */
export class NativeEjectRuntime {
  readonly parameters: Required<NativeEjectParams>;
  readonly trait: number;
  readonly range: number;
  readonly delay: number;
  private count: number;
  private attackScale = 1;
  private speedApplied: boolean;
  private prediction?: number;
  private predictionMade = false;
  private lastEjectTarget?: number;
  private pending?: { hit: NativeEjectHit; elapsed: number };

  constructor(params: NativeEjectParams | readonly NativeEjectParams[], ownerAttrs: Readonly<Record<string, number>>,
    source: { flags?: number; disabled?: boolean; initialCount?: number }, random: () => number) {
    this.parameters = nativeEjectParameters(Array.isArray(params) ? params : [params as NativeEjectParams]);
    const p = this.parameters, ignored = Boolean((source.flags || 0) & 2);
    this.trait = ignored ? 0 : p.BulletTrait;
    this.count = source.initialCount || 0;
    // BattleWorldContext.RandomNextBool is the build-time decision, including
    // a disabled mod; DisableEject then prevents the count from being installed.
    const probability = ignored ? 0 : p.EjectProbability;
    const enabled = random() < probability;
    if (enabled && !source.disabled) this.count += Math.trunc(p.EjectCount) + Math.trunc(ownerAttrs.EjectMod_EjectCount || 0);
    this.range = (p.EjectDistance + (ownerAttrs.ModEjectDistance || 0)) * (1 + (ownerAttrs['ModEjectDistance%'] || 0));
    this.delay = (p.EjectDelayDuration + (ownerAttrs.ModEjectDelayDuration || 0)) * (1 + (ownerAttrs['ModEjectDelayDuration%'] || 0));
    this.speedApplied = Boolean((source.flags || 0) & 32768);
  }

  get remainingCount(): number { return this.count; }
  get waiting(): boolean { return Boolean(this.pending); }
  /** CanHitEject result. 1/2/3 are failed admission; don't invoke beginHit.
   * HitCamp must be a nonzero character camp, not obstacle/wall bits. */
  admission(hitCamp: number, host: NativeEjectHost): 0 | 1 | 2 | 3 {
    if (host.disabled()) return 1;
    if (!hitCamp || (hitCamp & host.hitCampMask()) !== hitCamp || (hitCamp & -28) !== 0) return 3;
    return this.count > 0 ? 0 : 2;
  }

  /** Call before HurtTarget if a trigger needs willEject/next target. */
  predict(currentUid: number | undefined, host: NativeEjectHost): number | undefined {
    if (this.predictionMade) return this.prediction;
    const chosen = nativeSelectEjectTarget(host.targetsInCamera(), host.position(), this.range,
      currentUid ?? this.lastEjectTarget, host.hitCampMask(), this.parameters.EjectModRandomType, () => host.random());
    this.prediction = chosen?.uid === this.lastEjectTarget ? undefined : chosen?.uid;
    this.predictionMade = true;
    return this.prediction;
  }

  /** After successful damage, once. Host must skip ordinary move/hit while hold.
   * Do not clear historical hit timestamps: native permits revisiting targets
   * after their normal MinBulletHurtTime, not repeatedly in the same frame. */
  beginHit(hit: NativeEjectHit, host: NativeEjectHost): NativeEjectOutcome {
    if (this.admission(hit.target.hitCamp ?? 2, host) !== 0 || this.pending) return { kind: 'none' };
    this.predict(hit.target.uid, host);
    if (this.delay > 0) {
      this.pending = { hit: { ...hit, target: { ...hit.target }, position: { ...hit.position }, direction: { ...hit.direction } }, elapsed: 0 };
      return { kind: 'hold' };
    }
    return this.execute(hit, host, false);
  }

  update(dt: number, host: NativeEjectHost): NativeEjectOutcome {
    if (!this.pending) return { kind: 'none' };
    this.pending.elapsed += dt;
    if (this.pending.elapsed < this.delay) return { kind: 'hold' };
    const { hit } = this.pending; this.pending = undefined;
    return this.execute(hit, host, true);
  }

  private execute(hit: NativeEjectHit, host: NativeEjectHost, delayed: boolean): NativeEjectOutcome {
    if (!hit.preventCount && !host.disabled()) this.count--;
    const priorScale = this.attackScale;
    const change = this.parameters.AttackPercent + (host.ownerAttributes()['EjectHurtReduce%'] || 0);
    this.attackScale = Math.max(32768, Math.floor(Math.trunc(priorScale * 65536)
      * (65536 + Math.trunc(change * 65536)) / 65536)) / 65536;
    const speedDelta = this.speedApplied ? 0 : this.parameters.SpeedPercent;
    this.speedApplied = true;
    let target = this.prediction === undefined ? undefined : host.target(this.prediction);
    this.predictionMade = false; this.prediction = undefined;
    if (!target || target.dead) {
      // Delayed onEject has no current HitInfo: it excludes lastEjectTarget.
      const next = this.predict(delayed ? undefined : hit.target.uid, host);
      target = next === undefined ? undefined : host.target(next);
      this.predictionMade = false; this.prediction = undefined;
    }
    const common = { damageScaleRatio: this.attackScale / priorScale, firstSpeedAttributeDelta: speedDelta,
      addFlags: 32768, remainingCount: this.count, componentEvent: 31 as const };
    if (!target || target.dead) return { ...common, kind: 'dead', position: { ...host.position() }, result: 4 };
    this.lastEjectTarget = target.uid;
    let origin = { ...host.position() };
    // Immediate non-through hits project enemy center onto the incoming line;
    // delayed onEject(null) uses the retained projectile position unchanged.
    if (!delayed && !hit.piercing) {
      const projection = (hit.target.x - origin.x) * hit.direction.x + (hit.target.z - origin.z) * hit.direction.z;
      origin = { x: origin.x + hit.direction.x * projection, z: origin.z + hit.direction.z * projection };
    }
    return { ...common, kind: 'turn', position: origin,
      yawRadians: Math.atan2(target.x - origin.x, target.z - origin.z), targetUid: target.uid, result: 0 };
  }
}
