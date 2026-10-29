import source from '../public/data/skill-selection.json';

type SelectionSkill = {
  id: number; IsUpgrade: number; IsUpgrade_B: number;
  UpgradeSkillId: number[]; UpgradeSkillId_B: number[];
  CoverSkill: number; SkillType: number; SkillStar: number;
};
type WeightRow = { Weight: number; [key: string]: number };
const skills = source.skills as Record<number, SelectionSkill>;
const groups = source.groups as unknown as Record<string, Record<number, WeightRow>>;
const defaults = source.runtimeDefaults;

export type NativeSkillCandidate = { stageId: number; rootId: number; owned: boolean };
export type NativeSkillOffer = {
  id: number; parentStageId: number; rootId: number;
  kind: 'direct' | 'minor' | 'breakthrough';
};
export type NativeSelectionOptions = {
  mode?: 'A' | 'B'; weightGroup?: number; initialPool?: boolean; count?: number;
  /** Original HeroComponentExp.GetLevel (starts at 1); native slot checks add 1. */
  heroLevel?: number;
  /** Include fully upgraded families that have no remaining candidate. */
  occupiedWeaponSlots?: number; occupiedPassiveSlots?: number;
  /** Already-unlocked slot count, for account/mode policies handled by caller. */
  maxWeaponSlots?: number; maxPassiveSlots?: number;
  /** Kept for diagnostics. The APK's AdjustWeightsForSkillGroup is a no-op. */
  learnedTypeCounts?: Readonly<Record<number, number>>;
  candidateWeightFactor?: (candidate: NativeSkillCandidate) => number;
  /** APK WorldType.Main=1; chapter NewPlayerProtect flag 3 is independent of account ownership. */
  worldType?: number; newPlayerProtect?: readonly number[];
  learnedSkillIds?: readonly number[]; mockFixedQuality?: boolean;
};

/** LocalModelEx.GetSkillDeepType(row, true) 0x6887400. */
export function nativeSkillCategory(id: number, mode: 'A' | 'B' = 'A'): number {
  const row = skills[id];
  if (!row) return 0;
  if (defaults.separateBreakthroughCategory && nativeSkillUpgradeType(id, mode) === 1) return 3;
  return [1, 3, 4].includes(row.SkillType) ? 2 : [2, 5].includes(row.SkillType) ? 1 : 0;
}

export function nativeSkillSlotLimits(heroLevel: number, mode: 'A' | 'B' = 'A') {
  const level = Math.max(0, heroLevel) + 1;
  return {
    weapon: defaults.weaponSlotUnlockLevels[mode].filter(unlock => unlock <= level).length,
    passive: defaults.passiveSlotUnlockLevels[mode].filter(unlock => unlock <= level).length,
  };
}

export function nativeSkillUpgradeType(stageId: number, mode: 'A' | 'B' = 'A'): number {
  const row = skills[stageId];
  return row ? mode === 'B' ? row.IsUpgrade_B : row.IsUpgrade : 0;
}

/** HeroSkillCreator.GetEffectiveWeight 0x6c9325c -> GetWeightByGroup.
 * Chapter 1 selects Weight_1. This native path never reads WeightForNewplayer. */
export function nativeSkillWeight(id: number, group: string, weightGroup = source.chapter.SkillGroupWeight): number {
  const row = groups[group]?.[id];
  if (!row) return 0;
  return Math.max(0, Number((weightGroup >= 1 && weightGroup <= 10 ? row[`Weight_${weightGroup}`] : undefined) ?? row.Weight));
}

/** Shipped Const.UseInitSkillGroupCout, consumed by ordinary selection only. */
export const nativeInitialSkillGroupCount = Number(source.constants.UseInitSkillGroupCout);
const newPlayerDefaultSkill = Number(source.constants.NewPlayerProtect_SkillDefault);
const newPlayerBoosts = new Map<number, number>(
  [...source.constants.NewPlayerProtect_SkillDefault_SkillUp.matchAll(/"(\d+)\|(\d+)"/g)]
    .map(match => [Number(match[1]), Number(match[2])]),
);

/** DankeSkillCreator.GetNormalSkill 0x6c8ded8..e030/e698..e85c.
 * Only the initial pool in a protected main chapter gets this temporary boost,
 * and only without the default main weapon. WeightForNewplayer is not consulted.
 * WeightRandomData.BoostWeight 0x69ef828 uses integer truncation, not FP rounding.
 * The exact pool ID is boosted: an owned weapon's next stage is a different ID.
 */
function nativeInitialPoolWeight(base: number, stageId: number, options: NativeSelectionOptions): number {
  if (!options.initialPool || options.worldType !== 1 || options.mockFixedQuality
    || !options.newPlayerProtect?.includes(3)
    || !options.learnedSkillIds || options.learnedSkillIds.includes(newPlayerDefaultSkill)) return base;
  const percent = newPlayerBoosts.get(stageId) ?? 0;
  return base + Math.trunc(base * percent / 100);
}

function drawWeighted<T>(items: readonly T[], weight: (item: T) => number, count: number, random: () => number): T[] {
  const pool = items.map(value => ({ value, weight: weight(value) })).filter(item => item.weight > 0);
  const result: T[] = [];
  while (pool.length && result.length < count) {
    const total = pool.reduce((sum, item) => sum + item.weight, 0);
    let ticket = Math.min(1 - Number.EPSILON, Math.max(0, random())) * total;
    let index = 0;
    for (; index < pool.length - 1; index++) {
      ticket -= pool[index].weight;
      if (ticket < 0) break;
    }
    result.push(pool.splice(index, 1)[0].value);
  }
  return result;
}

function optionsFor(stageId: number, mode: 'A' | 'B', canStudy: (id: number) => boolean): number[] {
  const row = skills[stageId];
  return (row ? mode === 'B' ? row.UpgradeSkillId_B : row.UpgradeSkillId : []).filter(canStudy);
}

/** One parent stage per family is offered to this function. Never flatten all its
 * possible child cards into the normal pool. GetRandomCount 0x69f1850 transforms
 * IsUpgrade=2 into exactly one weighted child before the normal UI opens.
 * IsUpgrade=1 remains the parent until selected, then opens the separate two-choice UI.
 * DankeSkillCreator.GetRandomSkills first draws a category, then the owned/new
 * weapon pool, then a family. It is not one flat weighted draw over all cards.
 */
export function drawNativeOrdinaryChoices(
  candidates: readonly NativeSkillCandidate[], canStudy: (id: number) => boolean,
  random: () => number, options: NativeSelectionOptions = {},
): NativeSkillOffer[] {
  const mode = options.mode ?? 'A';
  const weightGroup = options.weightGroup ?? source.chapter.SkillGroupWeight;
  const eligible = candidates.filter(candidate => {
    const upgrade = nativeSkillUpgradeType(candidate.stageId, mode);
    return upgrade === 1 || upgrade === 2
      ? optionsFor(candidate.stageId, mode, canStudy).length > 0 : canStudy(candidate.stageId);
  });
  const weight = (candidate: NativeSkillCandidate) => {
    // RemoveSkill 0x6c90e80..efc inserts next stages into BOTH pools using
    // GetSkillWeight's SurvivorGroup weight. Only new roots use the initial table.
    const group = options.initialPool && !candidate.owned ? 'InitSurvivorGroup' : 'SurvivorGroup';
    const base = nativeSkillWeight(candidate.rootId, group, weightGroup);
    return nativeInitialPoolWeight(base, candidate.stageId, options)
      * Math.max(0, options.candidateWeightFactor?.(candidate) ?? 1);
  };
  const available = eligible.filter(candidate => weight(candidate) > 0);
  const category = (candidate: NativeSkillCandidate) => nativeSkillCategory(candidate.stageId, mode);
  const limits = nativeSkillSlotLimits(options.heroLevel ?? 1, mode);
  const occupiedWeapon = options.occupiedWeaponSlots
    ?? new Set(candidates.filter(c => c.owned && category(c) >= 2).map(c => c.rootId)).size;
  const occupiedPassive = options.occupiedPassiveSlots
    ?? new Set(candidates.filter(c => c.owned && category(c) === 1).map(c => c.rootId)).size;
  const weaponRemaining = Math.max(0, (options.maxWeaponSlots ?? limits.weapon) - occupiedWeapon);
  const passiveRemaining = Math.max(0, (options.maxPassiveSlots ?? limits.passive) - occupiedPassive);
  // GetAlreadyStudySkill/GetReadyStudySkill use SkillStar >= 2 / == 1.
  // `owned` is for occupied slots, not a replacement for these native pool rules.
  const already = (candidate: NativeSkillCandidate) => (skills[candidate.stageId]?.SkillStar ?? 1) >= 2;
  const chosen: NativeSkillCandidate[] = [];
  const offers: NativeSkillOffer[] = [];
  const toOffer = (candidate: NativeSkillCandidate): NativeSkillOffer | undefined => {
    const upgrade = nativeSkillUpgradeType(candidate.stageId, mode);
    if (upgrade === 2) {
      const id = drawWeighted(optionsFor(candidate.stageId, mode, canStudy),
        id => nativeSkillWeight(id, 'BranchSurvivorGroup', 0), 1, random)[0];
      return id === undefined ? undefined : {
        id, parentStageId: candidate.stageId, rootId: candidate.rootId, kind: 'minor',
      };
    }
    return { id: candidate.stageId, parentStageId: candidate.stageId, rootId: candidate.rootId,
      kind: upgrade === 1 ? 'breakthrough' : 'direct' };
  };
  const remaining = () => available.filter(c => !chosen.some(p => p.rootId === c.rootId));
  const drawOne = (forcedCategory?: number): NativeSkillCandidate | undefined => {
    const pool = remaining();
    const categories = defaults.categoryWeights.map((baseWeight, index) => {
      const members = pool.filter(c => category(c) === index);
      let enabled = members.length > 0;
      // These asymmetric checks reproduce 0x6c8f6b4 / 0x6c8f890 exactly.
      if (index === 1) enabled &&= passiveRemaining > 0 || members.some(c => !already(c));
      if (index === 2) enabled &&= weaponRemaining > 0 || members.some(already);
      return { index, weight: enabled ? baseWeight : 0 };
    });
    const start = forcedCategory ?? drawWeighted(categories, item => item.weight, 1, random)[0]?.index ?? 0;
    // Original cycles through the other categories if the selected pool is empty.
    for (let step = 0; step < categories.length; step++) {
      const index = (start + step) % categories.length;
      let members = pool.filter(c => category(c) === index);
      if (index === 1 && passiveRemaining === 0) members = members.filter(already);
      if (index === 2) {
        if (weaponRemaining === 0) members = members.filter(already);
        else if (defaults.splitOwnedWeaponPool && !options.initialPool) {
          const percent = defaults.ownedWeaponPercent[Math.max(0,
            Math.min(occupiedWeapon - 1, defaults.ownedWeaponPercent.length - 1))];
          // XXRandom.Next(0, categoryWeight + 1), strict threshold > ticket.
          const base = defaults.categoryWeights[2];
          const ticket = Math.floor(Math.min(1 - Number.EPSILON, Math.max(0, random())) * (base + 1));
          const wantOwned = base * percent / 100 > ticket;
          const preferred = members.filter(c => already(c) === wantOwned);
          members = preferred.length ? preferred : members.filter(c => already(c) !== wantOwned);
        }
      }
      const selected = drawWeighted(members, weight, 1, random)[0];
      if (selected) return selected;
    }
    return undefined;
  };
  for (let i = 0; i < (options.count ?? 3); i++) {
    const selected = drawOne();
    if (!selected) break;
    chosen.push(selected);
    // Native resolves this card's minor child before drawing the next category.
    const offer = toOffer(selected);
    if (offer) offers.push(offer);
  }
  // GetNormalSkill 0x6c8e194..6c8e500 guarantees a weapon when multiple
  // offers were drawn and a weapon remains eligible. This is not a fixed 2+1 quota.
  if (chosen.length > 1 && !chosen.some(c => category(c) >= 2)) {
    const replaceIndex = Math.floor(Math.min(1 - Number.EPSILON, Math.max(0, random())) * chosen.length);
    const weapon = drawOne(2);
    if (weapon) {
      const offer = toOffer(weapon);
      if (offer && category(weapon) >= 2) offers[replaceIndex] = offer;
    }
  }
  return offers;
}

/** OpenSelectSpecialSkill 0x6c92ac0/6c92e80/6c92ee0. Does not consume another level.
 * Caller has already learned parentStageId; applying the selected child must not
 * apply that parent stage's inherent attributes a second time. */
export function drawNativeBreakthroughChoices(
  parentStageId: number, canStudy: (id: number) => boolean, random: () => number,
  options: Pick<NativeSelectionOptions, 'mode' | 'weightGroup'> = {},
): number[] {
  return drawWeighted(optionsFor(parentStageId, options.mode ?? 'A', canStudy),
    id => nativeSkillWeight(id, 'UpgradeSurvivorGroup', options.weightGroup), 2, random);
}

/** GetDeltaWeightPercent 0x6c9ac1c..98: min(perSkill*count,max)/100.
 * Diagnostic formula only: AdjustWeightsForSkillGroup 0x6c9acfc is a native
 * no-op without hotfix, so ordinary selection must not apply this multiplier. */
export function nativeLearnedTypeWeightDelta(skillType: number, count: number): number {
  const row = (source.typeWeights as Record<number, { AddWeightPerSkill: number; AddWeightMax: number }>)[skillType];
  return row ? Math.min(row.AddWeightPerSkill * count, row.AddWeightMax) / 100 : 0;
}
