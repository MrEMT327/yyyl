/** The study loadout is data, not an extra multiplier baked into each weapon.
 * AirplaneGun_Star 2010101 currently grants PhysicalDamageAdd%=10 and
 * CritValue%=10. This does not represent an arbitrary saved account. */
export function entryWeaponAttribute(combat: { fixedEntryPreset?: { weaponStar1Attributes?: string[] } }, name: string): number {
  return (combat.fixedEntryPreset?.weaponStar1Attributes || []).reduce((sum, expression) => {
    const [key, text] = expression.split('=');
    const value = Number(text);
    return key?.trim() === name && Number.isFinite(value) ? sum + value : sum;
  }, 0);
}

/** AttributeData.MergeAttribute mergeType 2: exactly 100% uses FP 655.
 * Negative reductions increase cooldown; the native rule is not a .01 clamp. */
export function nativeCooldownMultiplier(percent: number): number {
  return percent === 100 ? 655 / 65536 : 1 - percent / 100;
}

/** AttributeData.MergeAttribute@0x6f89480. Values are already normalized:
 * percentage inputs use 0.2 for 20%. This is the merge rule, not FP emulation. */
export function mergeNativeAttribute(current: number, incoming: number, mergeType: number, reverse = false): number {
  if (mergeType === 0) return current + (reverse ? -incoming : incoming);
  if (mergeType === 1) return current * (reverse && incoming !== 0 ? 1 / incoming : incoming);
  if (mergeType === 2) {
    const factor = incoming === 1 ? 655 / 65536 : 1 - incoming;
    return current * (reverse ? 1 / factor : factor);
  }
  return current;
}

/** Original ElementType and BulletTrait enum values (dump.cs). */
export const nativeElementNames: Readonly<Record<number, string>> = {
  1: 'Physical', 2: 'Fire', 3: 'Poison', 4: 'Ice', 5: 'Energy', 6: 'Thunder',
};
export const nativeBulletTraitNames: ReadonlyArray<readonly [number, string]> = [
  [1, 'Area'], [2, 'Trajectory'], [4, 'CloseRange'], [8, 'Raycast'],
  [16, 'Split'], [32, 'Through'], [64, 'BlockBullet'], [128, 'Follow'],
  [256, 'Rebound'], [512, 'Attract'], [1024, 'Splash'], [2048, 'Explosion'], [4096, 'Eject'],
];

/** getElementAttackPercent + SetFormula_BulletTagDamagePercent. The callback
 * returns merged additive percentage points (20 for 20%), not a multiplier. */
export function nativeElementAndTraitDamageBonus(
  attribute: (name: string) => number, element: number, bulletTraits = 0,
): number {
  const elementName = nativeElementNames[element];
  let bonus = elementName ? attribute(`${elementName}DamageAdd%`) : 0;
  for (const [bit, name] of nativeBulletTraitNames) {
    if (bulletTraits & bit) bonus += attribute(`BulletTrait${name}DamageAdd%`);
  }
  // HurtBase.GetFormulaE@0x6ccfc8c adds element and trait bonuses in one bucket.
  return bonus / 100;
}

export interface NativeInheritedPassiveRow {
  AddAttributes?: readonly string[];
  TargetCharacterId?: readonly number[];
  TargetCharacterType?: readonly number[];
}

/** All three attributes have mergeType=0 and InheritFromPlayer=1 in
 * AttributeString_string (55,308,442). Recompute from learned passive rows so
 * newly acquired weapons inherit exactly the same value as existing weapons.
 * Targeted weapon cards are deliberately excluded; their own state applies them. */
export function nativeInheritedPassiveBonuses(rows: readonly NativeInheritedPassiveRow[]) {
  const values = { bulletScale: 0, skillRange: 0, orbitSpeed: 0 };
  const names: Record<string, keyof typeof values> = {
    'BulletScale%': 'bulletScale', 'AllSkillRange%': 'skillRange', 'RotateBallSpeed%': 'orbitSpeed',
  };
  for (const row of rows) {
    if (row.TargetCharacterId?.length || row.TargetCharacterType?.length) continue;
    for (const expression of row.AddAttributes || []) {
      const [name, raw] = expression.split('=');
      const key = names[name?.trim()], value = Number(raw);
      if (key && Number.isFinite(value)) values[key] += value / 100;
    }
  }
  return values;
}

/** SecondWeapenType, read from the source entity, never inferred from a skin ID.
 * SetFormula_ResearchCoefficientPercent@6ce0e74 and its 15-entry jump table.
 * Type 2/3/5/7 are deliberately absent from this laboratory bucket. */
export const nativeResearchWeaponNames: Readonly<Record<number, string>> = {
  1: 'Missile', 4: 'CurveSword', 6: 'Shotgun', 8: 'RotateBall', 9: 'SmartCannon',
  10: 'Acid', 11: 'LaserCannon', 12: 'BlackHole', 13: 'MachineCannon',
  14: 'SlashBullet', 15: 'ScorchingRay',
};
export interface NativeLoadoutDamageContext {
  secondWeaponType: number; element: number; bulletTraits?: number;
  /** Original Character_entity.Type and CharacterTag, before display remapping. */
  targetType?: number; targetTags?: readonly number[];
  ownerTargetDistance?: number;
  ownerHpRatio?: number; targetHpRatio?: number;
  /** Resolved dynamic contributions, in normalized fractions. */
  commonDamageBonus?: number; hpBasedAttackBonus?: number; pickupDamageBonus?: number;
  /** Exact values already multiplied into the emitted shot. Omit to use the
   * ordinary runtime's WeaponDamageAdd and element/tag emission convention. */
  emittedWeaponBonus?: number; emittedElementTraitBonus?: number;
}

function normalizedElementTraitBonus(attributes: Readonly<Record<string, number>>, element: number, traits: number) {
  const name = nativeElementNames[element];
  let value = name ? attributes[`${name}DamageAdd%`] || 0 : 0;
  for (const [bit, trait] of nativeBulletTraitNames) if (traits & bit) value += attributes[`BulletTrait${trait}DamageAdd%`] || 0;
  return value;
}

/** The new distance triples share the exact linear/capped rule in
 * SetFormula_DistanceBased{AttackPercent,CritRate,CritValue}. */
export function nativeDistanceTripleBonus(attributes: Readonly<Record<string, number>>, distance: number, suffix: 'Attack' | 'CritRate' | 'CritValue'): number {
  const farSpeed = attributes[`FarDisAdd${suffix}ChangeSpeed%`] || 0;
  const nearSpeed = attributes[`NearDisAdd${suffix}ChangeSpeed%`] || 0;
  let value = 0;
  if (farSpeed > 0) value += Math.min((attributes[`FarDisAdd${suffix}Min%`] || 0) + distance * farSpeed, attributes[`FarDisAdd${suffix}Max%`] || 0);
  if (nearSpeed > 0) value += Math.max((attributes[`NearDisAdd${suffix}Max%`] || 0) - distance * nearSpeed, attributes[`NearDisAdd${suffix}Min%`] || 0);
  return value;
}

/** Known distance-crit terms use Const.MaxDisForNearAttr=15. The result adds to
 * the critical chance/value at HIT time, not to every emitted projectile. */
export function nativeDistanceCriticalBonuses(attributes: Readonly<Record<string, number>>, distance: number) {
  const near = distance <= 15 ? (15 - distance) / 15 : 0;
  return {
    critRate: (attributes['CriAddForNear%'] || 0) * near + nativeDistanceTripleBonus(attributes, distance, 'CritRate'),
    critValue: (attributes['CriHurtAddForNear%'] || 0) * near + nativeDistanceTripleBonus(attributes, distance, 'CritValue'),
  };
}

/** All inputs are already normalized runtime values. HurtBase.GetFormulaE is
 * (1+weapon+element+traits+monsterLevel+monsterRace)
 * *(1+common+distance+HP+pickup)*(1+final), not six separate multipliers.
 * Research and per-family Final each multiply independently in GetFormulaB.
 * emissionCorrection replaces the old emission factors exactly once at a hit;
 * callers must remove their separate nativeNearDamageBonus multiplication. */
export function nativeLoadoutDamageFactors(attributes: Readonly<Record<string, number>>, context: NativeLoadoutDamageContext) {
  const read = (name: string) => attributes[name] || 0;
  const weaponName = nativeResearchWeaponNames[context.secondWeaponType];
  const research = 1 + (weaponName ? read(`Lab${weaponName}DamageAdd%`) : 0);
  const skillFinal = 1 + (weaponName ? read(`Final${weaponName}DamageAdd%`) : 0);
  const type = context.targetType;
  let monsterLevel = type === 2 ? read('HitToCommonMonster%') : type === 201 ? read('HitToEliteMonster%') : type === 3 || type === 15 ? read('HitToBoss%') : 0;
  if (type === 201 || type === 3 || type === 15) monsterLevel += read('HitToBossOrElite%');
  const tagNames: Readonly<Record<number, string>> = { 11: 'Fly', 12: 'Ground', 101: 'Organism', 102: 'Zombie', 103: 'Machine', 104: 'HeavyArmor' };
  let monsterRace = 0;
  for (const tag of context.targetTags || []) if (tagNames[tag]) monsterRace += read(`HitTo${tagNames[tag]}%`);
  const elementTrait = normalizedElementTraitBonus(attributes, context.element, context.bulletTraits || 0);
  const weapon = read('WeaponDamageAdd%');
  const distance = context.ownerTargetDistance;
  let distanceAttack = 0;
  if (distance !== undefined) {
    distanceAttack = read('AttackAddForNear%') > 0 && distance <= 15 ? read('AttackAddForNear%') * (15 - distance) / 15 : 0;
    distanceAttack += nativeDistanceTripleBonus(attributes, distance, 'Attack');
    if (distance <= 7) distanceAttack += read('NearDisAddAttack%');
    // AttackAddForFar selects direction; its magnitude is not the coefficient.
    // Const.MinAttackDisPercent=.3, MaxAttackDisPercent=2, AttackDisFar=30.
    const direction = read('AttackAddForFar%');
    if (direction > 0) distanceAttack += .3 + 1.7 * Math.min(distance, 30) / 30 - 1;
    else if (direction < 0) distanceAttack += 2 - 1.7 * Math.min(distance, 30) / 30 - 1;
  }
  const hpAttack = nativeLoadoutHpAttackBonus(attributes, context.ownerHpRatio, context.targetHpRatio);
  const category = 1 + weapon + elementTrait + monsterLevel + monsterRace;
  const common = 1 + read('CommonDamageAdd%') + (context.commonDamageBonus || 0) + distanceAttack + hpAttack + (context.hpBasedAttackBonus || 0) + (context.pickupDamageBonus || 0);
  const final = 1 + read('FinalDamageAdd%');
  const multiplier = research * skillFinal * category * common * final;
  const emitted = (1 + (context.emittedWeaponBonus ?? weapon)) * (1 + (context.emittedElementTraitBonus ?? elementTrait));
  return { research, skillFinal, category, common, final, multiplier, emissionCorrection: emitted !== 0 ? multiplier / emitted : 0 };
}

export const nativeLoadoutDamageAttributeNames: readonly string[] = [
  ...Object.values(nativeResearchWeaponNames).flatMap(n => [`Lab${n}DamageAdd%`, `Final${n}DamageAdd%`]),
  'CommonDamageAdd%', 'FinalDamageAdd%', 'HitToCommonMonster%', 'HitToEliteMonster%', 'HitToBoss%', 'HitToBossOrElite%',
  ...['Fly', 'Ground', 'Organism', 'Zombie', 'Machine', 'HeavyArmor'].map(n => `HitTo${n}%`),
  'AttackAddForNear%', 'AttackAddForFar%', 'NearDisAddAttack%', 'CriAddForNear%', 'CriHurtAddForNear%',
  'TargetHurtAddForHp', 'TargetFullHpExHurt', 'AttackAddForHpLow', 'DamageAddToFullHP%', 'DamageAddToLowHP%', 'DamageAddToHighHP%',
  ...['Attack', 'CritRate', 'CritValue'].flatMap(n => ['Far', 'Near'].flatMap(direction => ['Min', 'Max', 'ChangeSpeed'].map(part => `${direction}DisAdd${n}${part}%`))),
];

/** SetFormula_HPBasedAttackPercent@6ce5394, owner/target ratios are distinct.
 * Const damage-to-low/high thresholds are .3/.7; the owner low-HP ramp has the
 * original raw 0x14000 (1.25) coefficient. Only positive source values apply. */
export function nativeLoadoutHpAttackBonus(attributes: Readonly<Record<string, number>>, ownerHpRatio?: number, targetHpRatio?: number): number {
  const positive = (name: string) => Math.max(0, attributes[name] || 0);
  let bonus = ownerHpRatio !== undefined ? positive('AttackAddForHpLow') * (1 - ownerHpRatio) * 1.25 : 0;
  if (targetHpRatio !== undefined) {
    if (targetHpRatio > .5) bonus += positive('TargetHurtAddForHp') * targetHpRatio;
    if (targetHpRatio === 1) bonus += positive('TargetFullHpExHurt') + positive('DamageAddToFullHP%');
    if (targetHpRatio <= .3) bonus += positive('DamageAddToLowHP%');
    if (targetHpRatio >= .7) bonus += positive('DamageAddToHighHP%');
  }
  return bonus;
}

/** HurtRecoverHP.OnRunAttack@6cd53ec. RecoverHP adds to each healing event; it
 * does not start a regeneration timer. Source 20/23 skip flat healing bonuses.
 * Item_battle.parameter/10000 supplies baseHeal for the heart pickup. */
export function nativeLoadoutHealAmount(baseHeal: number, attributes: Readonly<Record<string, number>>, sourceKind = 0, bulletHeartBonus = 0): number {
  let percent = attributes['RecoverHP%'] || 0, flat = 0;
  if (sourceKind !== 20 && sourceKind !== 23) {
    flat += attributes.RecoverHP || 0;
    if (sourceKind === 1) {
      flat += attributes.HeartHpAdd || 0;
      percent += (attributes['HeartHpAdd%'] || 0) + bulletHeartBonus;
    }
  }
  // FPMath.Round: closest integer, ties to even (raw low-bit branch).
  const amount = baseHeal * (1 + percent) + flat;
  const floor = Math.floor(amount), fraction = amount - floor;
  return fraction === .5 ? floor % 2 === 0 ? floor : floor + 1 : Math.round(amount);
}

/** DropMgr.getDropRate@6a35dbc. This is drop probability, not heal amount.
 * Mission/chapter/wave factors have already been applied by the caller. */
export function nativeLoadoutHpDropRate(baseRate: number, attributes: Readonly<Record<string, number>>): number {
  return baseRate * (1 + (attributes['HPPickUpAdd%'] || 0));
}

export interface NativeIncomingDamageContext {
  attackerKind: 'bullet' | 'body' | 'other'; attackerType?: number;
  /** Native movement-state flag; do not infer standing from render animation. */
  standing?: boolean;
  /** Native source MonsterType==1 is flying; false is its ground branch. */
  attackerFlying?: boolean;
}
/** SetFormula_DamageDecrease / DamageDecreasePercent. Percentage values here
 * are ALREADY remaining factors from mergeType2, e.g. .8 for 20% reduction.
 * Returns distinct formula fields; multiply before subtracting flat reduction. */
export function nativeLoadoutIncomingDamageFactors(attributes: Readonly<Record<string, number>>, context: NativeIncomingDamageContext) {
  const factor = (name: string) => attributes[name] ?? 1;
  const value = (name: string) => attributes[name] || 0;
  let remainingMultiplier = factor('HurtDecrease%'), flatReduction = value('HurtDecrease');
  if (context.standing) { remainingMultiplier *= factor('StandHurtDecrease%'); flatReduction += value('StandHurtDecrease'); }
  if (context.attackerKind === 'bullet') { remainingMultiplier *= factor('BulletHurtDecrease%'); flatReduction += value('BulletHurtDecrease'); }
  else if (context.attackerKind === 'body') { remainingMultiplier *= factor('BodyHurtDecrease%'); flatReduction += value('BodyHurtDecrease'); }
  const type = context.attackerType;
  if (type === 2) { remainingMultiplier *= factor('HurtReduceForMonster%'); flatReduction += value('HurtReduceForMonster'); }
  else if (type === 3 || type === 15 || type === 201) {
    remainingMultiplier *= factor('HurtReduceForBoss%') * factor('HurtReduceForBossOrElite%');
    flatReduction += value('HurtReduceForBossOrElite');
  } else if (type === 1) remainingMultiplier *= factor('HurtReduceForPlayer%');
  if (context.attackerFlying !== undefined) remainingMultiplier *= factor(context.attackerFlying ? 'HurtReduceForFly%' : 'HurtReduceForGround%');
  return { remainingMultiplier, flatReduction };
}

/** AttributeData.GetMiss@6f87ed4 / GetExtraMiss@6f87fb0. Ordinary evasion is
 * Miss% + far-distance extra - attacker's HitRate%. Trait evasion uses a separate
 * random draw, shared by all matching traits (therefore max, not sum). */
export function nativeLoadoutMissChance(attributes: Readonly<Record<string, number>>, hitRate = 0, distance = 0, bulletTraits = 0) {
  const speed = attributes['FarDisAddMissChangeSpeed%'] || 0;
  const extra = distance >= 4 && speed !== 0 ? Math.min((attributes['FarDisAddMissMin%'] || 0) + distance * speed, attributes['FarDisAddMissMax%'] || 0) : 0;
  const ordinary = (attributes['Miss%'] || 0) + extra - hitRate;
  let trait = 0;
  for (const [bit, name] of nativeBulletTraitNames) if (bulletTraits & bit) trait = Math.max(trait, attributes[`BulletTrait${name}Miss%`] || 0);
  return { ordinary: Math.max(0, ordinary), trait };
}

export const nativeLoadoutSurvivalAttributeNames: readonly string[] = [
  'RecoverHP', 'RecoverHP%', 'HeartHpAdd', 'HeartHpAdd%', 'HPPickUpAdd%', 'Miss%',
  'FarDisAddMissMin%', 'FarDisAddMissMax%', 'FarDisAddMissChangeSpeed%',
  'HurtDecrease', 'HurtDecrease%', 'StandHurtDecrease', 'StandHurtDecrease%', 'BodyHurtDecrease', 'BodyHurtDecrease%', 'BulletHurtDecrease', 'BulletHurtDecrease%',
  'HurtReduceForMonster', 'HurtReduceForMonster%', 'HurtReduceForBossOrElite', 'HurtReduceForBoss%', 'HurtReduceForBossOrElite%', 'HurtReduceForPlayer%', 'HurtReduceForFly%', 'HurtReduceForGround%',
  ...nativeBulletTraitNames.map(([, name]) => `BulletTrait${name}Miss%`),
];
