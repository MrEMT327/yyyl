import { victoryAdReward } from '../sortie-rewards.js';

const names = { coins: '金币', diamonds: '钻石', weaponParts: '通用零件', aircraftShards: '飞机碎片', stamina: '体力' };
const amountOf = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;

// Display receipts only; currency doubling does not apply to equipment/materials.
export function resultRewards(completion = {}, doubled = false) {
  const rows = [];
  let canDouble = false;
  const currency = victoryAdReward(completion);
  for (const type of ['coins', 'diamonds']) {
    const amount = currency[type];
    if (amount) {
      canDouble = true;
      const breakdown = completion.coinBreakdown;
      if (type === 'coins' && breakdown && amountOf(breakdown.base) + amountOf(breakdown.firstClear) === amount) {
        for (const [key, label] of [['base', '通关金币'], ['firstClear', '首通额外金币']]) {
          if (amountOf(breakdown[key])) rows.push({ label, amount: `+${amountOf(breakdown[key]) * (doubled ? 2 : 1)}` });
        }
        continue;
      }
      rows.push({ label: names[type], amount: `+${amount * (doubled ? 2 : 1)}` });
    }
  }
  for (const reward of completion.peripheralRewards || []) {
    const amount = amountOf(reward.amount);
    if (amount) rows.push({ label: `${reward.source === 'first-clear' ? '首通补给 · ' : ''}${names[reward.type] || reward.name || reward.type}`, amount: `+${amount}` });
  }
  for (const item of completion.unlockedModules || []) {
    rows.push({ label: item.shortName || item.name || '新装备', amount: '已解锁' });
  }
  return { rows, canDouble };
}
