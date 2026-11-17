import { isSpecialRewardMonster } from './drop-rewards';

const FP = 65536n;
export interface ExperienceMonster { weight: number; type: number }

/** Waterfall owns one CURRENT-wave account. Neither remaining count is an
 * inventory of live entities; InitNewWaveData counts the authored wave plan.
 * IgnoreDrop must skip reward(), while ordinary self-deaths still complete().
 * Evidence: InitNewWaveData 0x6984090, GetCharacterDropExp 0x698ca90,
 * EnemyDieSpecialLogic 0x698c894. Local entry has no extra XP percentage. */
export class NativeWaveExperience {
  private budget = 0n;
  private perWeight = FP;
  private awarded = 0n;
  private remainingWeighted = 0;
  private remainingSpecial = 0;
  private stopBySpecial = false;

  reset(budget: number, stopBySpecial: boolean, planned: readonly ExperienceMonster[]): void {
    this.budget = BigInt(Math.trunc(budget)) * FP;
    this.awarded = 0n;
    this.remainingWeighted = planned.filter(monster => monster.weight >= 1).length;
    this.remainingSpecial = planned.filter(monster => isSpecialRewardMonster(monster.type)).length;
    this.stopBySpecial = stopBySpecial;
    const weight = planned.reduce((sum, monster) => sum + (monster.weight >= 1 ? Math.trunc(monster.weight) : 0), 0);
    const per = weight ? this.budget / BigInt(weight) : 0n;
    this.perWeight = per > FP ? per : FP;
  }

  reward(monster: ExperienceMonster, fallbackExp: number, dropMultiplierRaw = 65536): number {
    // DropMgr passes (1 + AddExp%) * AddExpMission (base 1). Preserve the
    // native zero-budget branch's EXTRA +1; do not normalize that inconsistency.
    const multiplier = BigInt(Math.trunc(dropMultiplierRaw));
    if (this.budget === 0n) return Number(BigInt(Math.trunc(fallbackExp)) * (FP + multiplier)) / Number(FP);
    const finalWeighted = monster.weight >= 1 && --this.remainingWeighted <= 0;
    const finalSpecial = this.stopBySpecial
      && this.remainingSpecial === Number(isSpecialRewardMonster(monster.type));
    let value: bigint;
    if (finalWeighted || finalSpecial) {
      value = this.budget - this.awarded;
      this.awarded = this.budget;
    } else if (this.awarded === this.budget) value = 0n;
    else {
      value = BigInt(Math.trunc(monster.weight)) * this.perWeight;
      if (this.awarded + value > this.budget) value = this.budget - this.awarded;
      this.awarded += value;
      // The budget tracks base XP; only ordinary weighted returns multiply.
      value = value * multiplier >> 16n;
    }
    return Number(value) / Number(FP);
  }

  /** Native special counter changes at the death completion callback, AFTER
   * DropItems. An IgnoreDrop death must not silently erase planned XP count. */
  complete(type: number): boolean {
    return this.stopBySpecial && isSpecialRewardMonster(type) && --this.remainingSpecial <= 0;
  }
}
