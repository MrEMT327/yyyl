// All chapter indices are zero-based. Permanent growth costs and premium-currency
// odds are intentionally outside this second-pass income tuning.
export const ECONOMY_VERSION = 2;
const anchors = Object.freeze([
  [1, 150, 6, 2], [5, 300, 8, 3],
  [6, 350, 8, 3], [15, 650, 12, 4],
  [16, 700, 12, 4], [30, 1100, 16, 5],
  [31, 1200, 16, 5], [50, 1800, 22, 6],
].map(([chapter, coins, weaponParts, aircraftShards]) => Object.freeze({ chapter, coins, weaponParts, aircraftShards })));
export const CHAPTER_REWARD_ANCHORS = anchors;
export const economyStageIndex = value => Number.isFinite(Number(value)) ? Math.max(0, Math.min(49, Math.floor(Number(value)))) : 0;
const roundCoins = value => Math.round(value / 10) * 10;

export function chapterVictoryReward(stageIndex) {
  const chapter = economyStageIndex(stageIndex) + 1;
  const right = anchors.find(row => row.chapter >= chapter);
  const left = anchors[Math.max(0, anchors.indexOf(right) - 1)];
  const progress = right.chapter === left.chapter ? 0 : (chapter - left.chapter) / (right.chapter - left.chapter);
  const lerp = key => left[key] + (right[key] - left[key]) * progress;
  return { coins: roundCoins(lerp('coins')), weaponParts: Math.round(lerp('weaponParts')), aircraftShards: Math.round(lerp('aircraftShards')) };
}

// Chapters 2–4 used to give four shards on every clear. Keep that first-clear
// support, without making them permanently better farms than later chapters.
export function firstClearMaterialReward(stageIndex) {
  const index = economyStageIndex(stageIndex);
  return index >= 1 && index <= 3 ? { aircraftShards: 4 - chapterVictoryReward(index).aircraftShards } : {};
}

export function chapterPatrolRate(stageIndex) {
  const reward = chapterVictoryReward(stageIndex);
  // Eight idle hours give one clear's resources at later chapters. Early-game
  // floors retain useful starter support; three quick claims add six hours.
  return { coins: Math.max(75, reward.coins / 8), weaponParts: Math.max(1, reward.weaponParts / 8), aircraftShards: Math.max(1 / 3, reward.aircraftShards / 8) };
}

export function taskRewardForStage(task, stageIndex) {
  const stage = chapterVictoryReward(stageIndex), reward = { ...task.reward };
  const shares = {
    login: { coins: .25, weaponParts: .5 },
    sortie: { coins: .5, weaponParts: .5 },
    victory: { aircraftShards: 1 },
    upgrade: { coins: .25, weaponParts: .25 },
    recruit: { coins: .25 },
    'weekly-sorties': { coins: 2, aircraftShards: 3 },
    'weekly-victories': { weaponParts: 2 },
    'weekly-upgrades': { coins: 1.5, weaponParts: 1 },
  }[task.id] || {};
  for (const [key, share] of Object.entries(shares)) {
    const scaled = key === 'coins' ? roundCoins(stage[key] * share) : Math.round(stage[key] * share);
    reward[key] = Math.max(reward[key] || 0, scaled);
  }
  return reward;
}

export function shopOfferForStage(base, stageIndex) {
  const stage = chapterVictoryReward(stageIndex);
  const reward = { ...base.reward }, cost = { ...base.cost };
  switch (base.id) {
    case 'daily-coins': reward.coins = Math.max(100, roundCoins(stage.coins * .1)); break;
    case 'daily-parts':
      reward.weaponParts = Math.max(5, Math.round(stage.weaponParts * .5));
      cost.amount = Math.max(100, roundCoins(stage.coins * .3)); break;
    case 'daily-aircraft':
      reward.aircraftShards = Math.max(2, Math.round(stage.aircraftShards * .5));
      cost.amount = Math.max(150, roundCoins(stage.coins * .35)); break;
    case 'ad-coins': reward.coins = Math.max(150, roundCoins(stage.coins * .75)); break;
    case 'ad-parts': reward.weaponParts = Math.max(4, Math.round(stage.weaponParts * .5)); break;
    case 'ad-aircraft': reward.aircraftShards = Math.max(2, Math.round(stage.aircraftShards * .5)); break;
    case 'exchange-coins': reward.coins = Math.max(300, stage.coins); break;
  }
  return { ...base, reward, cost };
}
