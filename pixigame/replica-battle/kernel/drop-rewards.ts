/** Character_MonsterDropType stores DropWeight/DropParam as raw 16.16 FP. */
export interface NativeDropRule {
  DropWeight: number;
  DropParam: number;
  DropItemNum: number;
  DropItem: number;
}

export interface RewardMonster {
  dropType: number;
  characterType: number;
}

const FP = 65536n;
const raw = (value: number) => BigInt(Math.trunc(value));
const multiply = (a: bigint, b: bigint) => (a * b) >> 16n;
const divide = (a: bigint, b: bigint) => b === 0n ? 0n : a * FP / b;
const floor = (value: bigint) => value >> 16n;

/** AddExBattleWaveAttr 0x693a588: chapter × wave; a zero mission value is omitted. */
export function healthDropMultiplierRaw(chapterRaw: number, waveRaw: number, missionRaw: number): number {
  return Number(multiply(multiply(raw(waveRaw), raw(chapterRaw)), raw(missionRaw || 65536)));
}

/** getDropRate 0x6a35dbc, without account luck / HPPickUpAdd% modifiers. */
export function healthDropRateRaw(baseRaw: number, multiplierRaw: number): number {
  return Number(multiply(raw(baseRaw), raw(multiplierRaw)));
}

/** DropItemHP.OnInit 0x6a2a518: Item_battle.parameter / 10000, stored as FP. */
export function healthPickupFraction(parameter: number): number {
  return Number(divide(raw(parameter) * FP, 10000n * FP)) / Number(FP);
}

/** EntityCharacterTypeHelper.IsBoss 0x6eaac48; elite type is 201. */
export const isSpecialRewardMonster = (type: number) => type === 201 || type === 3 || type === 15;

/**
 * InitWaveGoldData 0x6988fa8 + AddGoldMonster 0x6988c40.
 * monsters must follow actual spawn order, including interval repetitions.
 * Only type 1 is randomly selected; other eligible types always carry their amount.
 * The caller supplies RNG: the original shared battle RNG seed/state is unavailable.
 */
function createWaveGoldPlan(
  budget: number,
  monsters: readonly RewardMonster[],
  rules: Readonly<Record<number, NativeDropRule>>,
  stopByEliteOrBossKilled: boolean,
  random: () => number,
) {
  const eligible = monsters.map(monster => monster.dropType !== 0 &&
    (!stopByEliteOrBossKilled || isSpecialRewardMonster(monster.characterType)));
  const counts = new Map<number, number>();
  monsters.forEach((monster, index) => {
    if (eligible[index] && rules[monster.dropType]) counts.set(monster.dropType, (counts.get(monster.dropType) || 0) + 1);
  });
  let totalWeight = 0n;
  for (const [type, count] of counts) {
    const rule = rules[type];
    totalWeight += multiply(multiply(raw(rule.DropWeight), raw(count) * FP), raw(rule.DropParam));
  }
  const perGold = divide(raw(budget) * FP, totalWeight);
  let remainder = raw(budget) * FP;
  for (const [type, count] of counts) {
    if (type < 2) continue;
    const rule = rules[type];
    remainder -= floor(multiply(multiply(raw(rule.DropWeight), raw(rule.DropParam)), perGold)) * raw(count) * FP;
  }
  const normalAmount = rules[1] ? floor(multiply(perGold, raw(rules[1].DropWeight))) : 0n;
  const takeCount = normalAmount > 0n ? Math.max(0, Number(floor(divide(remainder, normalAmount * FP)))) : 0;
  // ShuffleWithFisherYates 0x6989774: Range(1,count), descending swaps, Take(takeCount).
  const normalIndices = Array.from({ length: counts.get(1) || 0 }, (_, index) => index + 1);
  for (let remaining = normalIndices.length; remaining > 1; remaining--) {
    const other = Math.min(remaining - 1, Math.max(0, Math.floor(random() * remaining)));
    [normalIndices[remaining - 1], normalIndices[other]] = [normalIndices[other], normalIndices[remaining - 1]];
  }
  const selected = new Set(normalIndices.slice(0, takeCount));
  return { eligible, perGold, selected };
}

/** Static allocation view used by exports. Runtime must bind the carry flag
 * at actual creation and calculate the amount from the CURRENT wave. */
export function planWaveGold(budget: number, monsters: readonly RewardMonster[],
  rules: Readonly<Record<number, NativeDropRule>>, stopByEliteOrBossKilled: boolean, random: () => number): number[] {
  const { eligible, perGold, selected } = createWaveGoldPlan(budget, monsters, rules, stopByEliteOrBossKilled, random);
  let normalIndex = 0;
  return monsters.map((monster, index) => {
    const rule = rules[monster.dropType];
    if (!eligible[index] || !rule) return 0;
    if (monster.dropType === 1 && (stopByEliteOrBossKilled || !selected.has(++normalIndex))) return 0;
    // GetCharacterDropGold 0x698dc98 does NOT multiply DropParam here.
    return Math.max(0, Number(floor(multiply(perGold, raw(rule.DropWeight)))));
  });
}

/** AddGoldMonster stores a flag on the created character. GetCharacterDropGold
 * later uses that flag but the manager's CURRENT perGold and stop condition;
 * delayed creators and surviving monsters can cross a wave boundary. */
export class NativeWaveGold {
  private perGold = 0n;
  private selected = new Set<number>();
  private normalIndex = 0;
  private stopBySpecial = false;
  reset(budget: number, monsters: readonly RewardMonster[], rules: Readonly<Record<number, NativeDropRule>>,
    stopBySpecial: boolean, random: () => number): void {
    const plan = createWaveGoldPlan(budget, monsters, rules, stopBySpecial, random);
    this.perGold = plan.perGold; this.selected = plan.selected;
    this.normalIndex = 0; this.stopBySpecial = stopBySpecial;
  }
  create(dropType: number): boolean {
    return dropType === 1 && !this.stopBySpecial && this.selected.has(++this.normalIndex);
  }
  reward(monster: RewardMonster, carriesGold: boolean, rules: Readonly<Record<number, NativeDropRule>>): number {
    const rule = rules[monster.dropType];
    if (!rule || this.perGold === 0n || (monster.dropType === 1 && !carriesGold)
      || (this.stopBySpecial && !isSpecialRewardMonster(monster.characterType))) return 0;
    return Number(floor(multiply(this.perGold, raw(rule.DropWeight))));
  }
}

/** GetCharacterDropGold: fewer pieces when total < DropItemNum; remainder on last. */
export function splitGoldReward(total: number, maxPieces: number): number[] {
  const amount = Math.max(0, Math.floor(total));
  const count = Math.min(amount, Math.max(0, Math.trunc(maxPieces)));
  if (!count) return [];
  const base = Math.floor(amount / count);
  return Array.from({ length: count }, (_, index) => index === count - 1 ? amount - base * (count - 1) : base);
}

/** InitNewWaveData 0x6984708: integer FP division, then Max(1,perExp). */
export function waveExperiencePerWeight(budget: number, totalWeight: number): number {
  const perWeight = totalWeight > 0 ? raw(budget) * FP / raw(totalWeight) : 0n;
  return Number(perWeight > FP ? perWeight : FP) / Number(FP);
}
