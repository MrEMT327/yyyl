const amountOf = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

// Both base and first-clear coins retain the research bonus. Materials and unlocks
// are separate receipts and never enter the currency-only ad reward.
export function victoryCurrencyReward(baseCoins, firstClearCoins, researchBonus = 0) {
  const bonus = Number.isFinite(Number(researchBonus)) ? Math.max(0, Number(researchBonus)) : 0;
  const boost = value => { const coins = amountOf(value); return coins + Math.round(coins * bonus); };
  const coinBreakdown = { base: boost(baseCoins), firstClear: boost(firstClearCoins) };
  return { earned: { coins: coinBreakdown.base + coinBreakdown.firstClear, diamonds: 0 }, coinBreakdown };
}

export function victoryAdReward(completion = {}) {
  return { coins: amountOf(completion.earned?.coins), diamonds: amountOf(completion.earned?.diamonds) };
}
