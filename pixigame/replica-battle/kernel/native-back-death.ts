/** CharacterExplosionBackDeath and its class 5/6 subclasses.
 * Evidence: research/chapter16-death-weapon-audit.md. This helper models
 * controller calls, not an invented delay relative to the world update loop. */
export const nativeBackDeathDestroyThresholdRaw = 0xccb;
export const nativeBackDeathAnimationThresholdRaw = 0;
export const nativeDeathFireFlags = 0x88;

/** Character_hurtAttributeName (all 12 rows). Bullet.Element is a different
 * enum and does NOT select the lethal HurtData.HurtType. Native expression
 * construction reads the first hurtAttributes/triggerAttributes expression.
 * Unknown names have no native Normal fallback: lookup returns null, and
 * GetHurtExpressions dereferences it. Return undefined so host can diagnose
 * unsupported content without silently classifying it as elemental damage. */
export function nativeHurtTypeFromExpressions(expressions: readonly string[] | undefined): number | undefined {
  const expression = expressions?.[0];
  if (!expression) return undefined;
  const equals = expression.indexOf('=');
  if (equals < 0) return undefined;
  const name = expression.slice(0, equals);
  switch (name) {
    case 'Attack': case 'AddAttack': return 1;
    case 'ElementAttackFire': case 'AddElementAttackFire': return 2;
    case 'ElementAttackPoison': case 'AddElementAttackPoison': return 3;
    case 'ElementAttackIce': case 'AddElementAttackIce': return 4;
    case 'ElementAttackThunder': case 'AddElementAttackThunder': return 5;
    case 'BodyAttack': return 6;
    case 'RecoverHP': return 7;
    default: return undefined;
  }
}

export interface NativeBackDeathSelection {
  classId: 5 | 6;
  handler: 'CharacterBackDeathFireBullet' | 'CharacterBackDeathDefault';
  /** BodyAttack uses ReadParams(0, emptyString), not the entity's death JSON. */
  useTableParameters: boolean;
  hurtType: number;
  weaponId: number;
}

/** HurtType is not AttackerType; in particular Self=5 is NOT BodyAttack=6. */
export function nativeBackDeathSelection(classId: number, hurtType: number,
  parameters: { WeaponID?: number }): NativeBackDeathSelection | undefined {
  if (hurtType === 6) return { classId: 6, handler: 'CharacterBackDeathDefault',
    useTableParameters: false, hurtType, weaponId: 0 };
  if (classId !== 5 && classId !== 6) return undefined;
  return { classId, handler: classId === 5 ? 'CharacterBackDeathFireBullet' : 'CharacterBackDeathDefault',
    useTableParameters: true, hurtType, weaponId: classId === 5 ? Number(parameters.WeaponID || 0) : 0 };
}

export interface NativeBackDeathEdges {
  /** Play explosion/check configured explosion/create extra death weapon;
   * then class 5 changes its weapon and fires. Does NOT remove the entity. */
  enterDeathComplete: boolean;
  /** PlayDeathSound -> completion callback -> NotifyEntityRemove. */
  destroy: boolean;
  fireWeaponId: number;
}

export class NativeBackDeath {
  private state: 0 | 1 | 2 | 3 = 1;
  private timeRaw = 0;
  constructor(readonly selection: NativeBackDeathSelection) {}
  get done() { return this.state === 0; }

  /** Call once per actual native logic update, using raw FP delta (2184).
   * Host may perform the original DeadBackUpdate before handling the edge;
   * for class 5/6 _deathTime=0 so its completion result cannot delay this edge.
   * Host retains any 3D OnYCheck/vertical-motion representation separately. */
  update(deltaRaw: number): NativeBackDeathEdges {
    const edge: NativeBackDeathEdges = { enterDeathComplete: false, destroy: false, fireWeaponId: 0 };
    if (this.state === 0) return edge;
    if (this.state === 1 && this.selection.hurtType === 2) {
      this.state = 2; // _backMaxTime==0: no timer increment this call.
      return edge;
    }
    this.timeRaw += deltaRaw;
    if (this.state === 3) {
      if (this.timeRaw >= nativeBackDeathDestroyThresholdRaw) {
        this.state = 0;
        edge.destroy = true;
      }
    } else if (this.timeRaw > nativeBackDeathAnimationThresholdRaw) {
      this.state = 3;
      edge.enterDeathComplete = true;
      edge.fireWeaponId = this.selection.weaponId;
      // Native EnterDeathComplete does NOT reset the accumulated timer.
    }
    return edge;
  }
}

export interface NativeDeathFirePlan {
  weaponId: number;
  fixedPosition: { x: number; y: number; z: number };
  angle: number;
  flags: number;
  /** Only this explicit death shot may survive the dead-owner queue filter. */
  allowDeadOwner: true;
}

/** Emit via the existing weapon/mod/attribute pipeline. No hardcoded damage:
 * hurtAttributes Attack=1 is a formula input, not evidence of 1 final damage.
 * No head mount, live aiming, or attack-animation delay on this FireNow path. */
export function nativeBackDeathFirePlan(weaponId: number,
  position: { x: number; y?: number; z: number }, angle: number): NativeDeathFirePlan | undefined {
  if (!weaponId) return undefined;
  return { weaponId, fixedPosition: { x: position.x, y: (position.y || 0) + 0.5, z: position.z },
    angle, flags: nativeDeathFireFlags, allowDeadOwner: true };
}
