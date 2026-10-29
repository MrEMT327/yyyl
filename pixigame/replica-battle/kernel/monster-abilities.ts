import source from '../public/data/monster-abilities.json';
import { mergeNativeAttribute, nativeBulletTraitNames, nativeElementNames } from './combat-attributes';

const definitions = source.abilities as Record<number, string[]>;
export interface NativeMonsterContext { entityType: number; chapterFeatureIds?: readonly number[] }

/** ApplyChapterMonsterFeatures@0x6e6bd50 deliberately admits only Type=2.
 * Elite and both Boss types retain their own abilities, but not chapter features. */
export function nativeMonsterEffects(abilityIds: readonly number[] | undefined, context?: NativeMonsterContext): string[] {
  const effects = (abilityIds || []).flatMap(id => definitions[id] || []);
  if (context?.entityType === 2) for (const id of context.chapterFeatureIds || []) {
    const feature = (source.chapterFeatures as Record<number, { Type: string; Args: string }>)[id];
    if (feature?.Type === 'Attr' || feature?.Type === 'Skill') effects.push(feature.Args);
  }
  return effects;
}

/** ApplyMonsterAbilityEffects@0x6e75060 treats numeric effect strings as skills. */
export function nativeMonsterSkillIds(abilityIds: readonly number[] | undefined, context?: NativeMonsterContext): number[] {
  return [...new Set(nativeMonsterEffects(abilityIds, context).filter(value => /^\d+$/.test(value.trim())).map(Number))];
}

/** EntityCharacterTypeHelper.IsBoss@0x6eaac88. */
export function nativeIsBoss(entityType: number): boolean { return entityType === 3 || entityType === 15; }

/** BattleWorldContext.ApplyMonsterAbilityEffects merges nonempty effect strings. */
export function nativeMonsterAttribute(abilityIds: readonly number[] | undefined, attribute: string, context?: NativeMonsterContext): number {
  let value = 0;
  for (const effect of nativeMonsterEffects(abilityIds, context)) {
    const [name, amount] = effect.split('=');
    if (name === attribute && Number.isFinite(Number(amount))) value += Number(amount);
  }
  return value;
}

/** Resist attributes have mergeType=2 and defaultValue=100. Their stored value
 * is remaining damage, so two 60% reductions give .4*.4, not 1-.6-.6. */
function resistanceFactor(abilityIds: readonly number[] | undefined, attribute: string, context?: NativeMonsterContext): number {
  let factor = 1;
  for (const effect of nativeMonsterEffects(abilityIds, context)) {
    const [name, amount] = effect.split('=');
    const value = Number(amount);
    if (name === attribute && Number.isFinite(value)) factor = mergeNativeAttribute(factor, value / 100, 2);
  }
  return factor;
}

/** HurtBase.GetFormulaF/G: elemental and bullet-tag weaknesses add together;
 * elemental resistance and each matching tag resistance multiply separately.
 * Pass the actual bullet's trait mask, never derive it from its damage element.
 * Buff/body sources without an actual bullet leave bulletTraits at zero. */
export function nativeMonsterElementMultiplier(abilityIds: readonly number[] | undefined, element: number, bulletTraits = 0, context?: NativeMonsterContext): number {
  const name = nativeElementNames[element];
  let resistance = name ? resistanceFactor(abilityIds, `${name}DamageResist%`, context) : 1;
  let weakness = name ? nativeMonsterAttribute(abilityIds, `${name}DamageAddToSelf%`, context) : 0;
  for (const [bit, trait] of nativeBulletTraitNames) {
    if (!(bulletTraits & bit)) continue;
    resistance *= resistanceFactor(abilityIds, `BulletTrait${trait}DamageResist%`, context);
    weakness += nativeMonsterAttribute(abilityIds, `BulletTrait${trait}DamageAddToSelf%`, context);
  }
  return resistance * (1 + weakness / 100);
}

export function nativeMonsterImmuneThrough(abilityIds: readonly number[] | undefined): boolean {
  return nativeMonsterAttribute(abilityIds, 'ImmuneBulletThrough') > 0;
}

/** EntityCharacter.AllowBeThrough: BulletTrait.Area (bit 1) ignores this immunity. */
export function nativeMonsterBlocksThrough(abilityIds: readonly number[] | undefined, bulletTraits = 0): boolean {
  return (bulletTraits & 1) === 0 && nativeMonsterImmuneThrough(abilityIds);
}

export function nativeMonsterImmuneAttract(abilityIds: readonly number[] | undefined): boolean {
  return nativeMonsterAttribute(abilityIds, 'ImmuneBulletAttract') > 0;
}
