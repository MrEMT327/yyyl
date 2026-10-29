import { nativeResearchContributions } from './native-research-state.js';
import source from './native-patrol-source.json' with {type:'json'};
import channels from './native-resource-channels-source.json' with {type:'json'};
import { replicaChapter } from './chapter-contract.js';
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';

const config = key => source.config[key].TypeInt;
const rows = new Map(source.hangUp.map(row => [row.Id, row]));
const previews = new Map(source.quickPreview.map(row => [row.chapterId, row.itemIds]));
const gates = new Map(source.functionGates.map(row => [row.id, row]));
const firstDayLimit = Number(source.missionLimit.TypeString.split('|')[0].split(',')[1]);

// MissionModeNormal.UpdateUserMission advances MissionId by one on success.
// Preview/debug chapter access and out-of-order clears cannot advance this gate.
function missionProgress(campaign) {
  const cleared = new Set(campaign.clearedChapterIds || []);
  let id = 1;
  while (cleared.has(id) && replicaChapter(id + 1)) id++;
  return {id, wave: campaign.passedWaves?.[id] || 0};
}
function gateReached(functionId, progress) {
  if (UNLOCK_ALL_CONTENT) return true;
  const gate = gates.get(functionId);
  if (gate?.unlockType !== 1) return false;
  const [id, wave] = gate.unlockArgs.split('|').map(Number);
  return progress.id > id || (progress.id === id && progress.wave >= wave);
}
function lockText(functionId) {
  const [id, wave] = gates.get(functionId).unlockArgs.split('|').map(Number);
  return wave ? `通过第${id}章第${wave}波开启` : `到达第${id}章开启`;
}

/**
 * Confirmed native client presentation. No synthetic BeginTs/Rewards receipt.
 * GoldPerHour is a displayed base rate, not a proven settlement formula.
 * CurrentMaxMissionId is min(UserMission.MissionId, server-open-day cap).
 * All server days permit the first 20 chapters; beyond that the cap is unknown.
 */
export function nativePatrolSnapshot(campaign = {}, materials = [], progression) {
  const progress = missionProgress(campaign);
  const chapterKnown = progress.id <= firstDayLimit;
  const row = chapterKnown ? rows.get(progress.id) : null;
  const owned = new Map(materials.map(item => [item.id, item.count]));
  const researchBonus=nativeResearchContributions(progression?.nativeResearch)
    .flatMap(card=>card.attributes).reduce((sum,line)=>{
      const [key,value]=line.split('=');return sum+(key==='HangUpRewards%'?Number(value):0);
    },0);
  // RefreshRewardsAdd adds owned HangUpRewards% and authoritative subscription
  // privileges. Only the owned research contribution is locally established.
  const knownMultiplier=1+researchBonus/100;
  const previewItems = row ? (previews.get(row.Id) || []).map(id => ({
    id, name: source.previewNames[id], owned: owned.get(id) || 0,
    random: source.randomPreviewIds.includes(id),
    // Native Refresh creates PropData(id, 0): no award quantity is supplied.
    count: null,
  })) : [];
  return {
    native: true,
    unlocked: gateReached(12, progress),
    quickUnlocked: gateReached(13, progress),
    lockReason: lockText(12), quickLockReason: lockText(13),
    stageIndex: row ? replicaChapter(row.Id)?.stageIndex : null,
    chapterKnown, canPreview: true,
    nativeSettlementPending: true,
    settlementReason: '原版巡逻奖励由服务器结算，实际数量、掉落次数与完整倍率待核实；暂不扣体力或发放推算奖励。',
    storedMinutes: null, capHours: config('HangUpMaxTime') / 3600,
    intervalSeconds: config('HangUpInterval'),
    claimThresholdSeconds:config('HangUpInterval'),researchBonus,knownMultiplier,
    capNote:'基础上限8小时；原版特权可增加时长，对应激活订阅可另加4小时，当前特权状态待核实。',
    multiplierNote:'表内基础时薪已计入当前拥有的巡逻天赋加成；原版对应激活订阅另加20%，当前订阅状态待核实、未应用；不能据此推算最终领取数量。',
    rateItems: row ? [
      {id: 1, name: '金币', basePerHour:row.GoldPerHour,perHour:Math.trunc(row.GoldPerHour*knownMultiplier)},
      {id: 3, name: '经验', basePerHour:row.ExpPerHour,perHour:Math.trunc(row.ExpPerHour*knownMultiplier)},
    ] : [],
    rewards: {}, quickRewards: {}, previewItems,
    // The unused formatting argument600*1/60 is not a proven duration.
    quickMinutes:null,quickLabel:'大量巡逻收益',quickDurationKnown:false,
    quickStamina: config('HangUpFastGetCostVitality'),
    quickLimit: config('HangUpFastGetCount'),
    // LeftQuickCount/advertising availability are server fields, not config.
    quickLeft: null, quickAdLeft: null, quickAdLimit: channels.quickPatrolAd.count,
    adAvailable: false, adBusy: false, adError: '', clockRollback: false,
    bonus:researchBonus/100,
  };
}
