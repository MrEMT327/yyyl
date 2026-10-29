import { isRosterPilot } from './native-pilot-roster.js';
import { nativeEquipmentBoxPreview, nativeRandomGroupPreview } from './native-client-rules.js';
import source from './native-acquisition-catalog.json' with {type:'json'};
import growth from './native-economy-catalog.json' with {type:'json'};
import { validateReplicaInventory } from './native-economy.js';
import { replicaChapter } from './chapter-contract.js';
import { nativeCollectionDisplayName } from './native-collection-names.js';
import { localRewardPairs, LOCAL_ECONOMY_POLICY } from './local-economy-policy.js';
const items=new Map(source.items.map(row=>[row.id,row]));
const drops=new Map(source.drops.map(row=>[row.drop_id,row]));
const missions=new Map(source.missionRewards.map(row=>[row.id,row]));
const chapterDropNames={10010007:'随机装备图纸',10010008:'随机科研图纸'};
// Exact fixed reward ID; the paused drone consumer is not fabricated here.
const chapterEntitlements={30001:'原版僚机（对应系统暂停）'};
// User-approved local core supply, independent of the native wave-reward cursor.
export const CHAPTER_CORE_REWARDS=Object.freeze({5:1,10:1,15:1,20:1,25:1,30:1,35:1,40:1,45:1,50:1});
const rewardPairs=row=>row.reward;
const itemName=id=>nativeCollectionDisplayName(id)||growth.itemNames[id]||items.get(id)?.note||chapterDropNames[id]||chapterEntitlements[id]||(drops.has(id)?'随机材料奖励':`物品 ${id}`);
const direct=id=>{const row=items.get(id);return Boolean(row&&!row.autoUse&&row.itemType<=1)||Object.hasOwn(chapterEntitlements,id);};
const localRandomGroup=id=>Object.hasOwn(chapterDropNames,id);
const unresolvedPairs=row=>rewardPairs(row).filter(([id])=>!direct(id));
const rewardView=([id,count])=>{const target=direct(id)?localRewardPairs([[id,count]])[0][0]:id;return {id:target,originalId:id,count,name:itemName(target),localCompatibility:localRandomGroup(id),unverified:!direct(id)&&!localRandomGroup(id),preview:nativeRandomGroupPreview(id)};};
function fixedChapterRewards(row) {
  if(rewardPairs(row).some(([id,count])=>!Number.isSafeInteger(id)||id<=0||!Number.isSafeInteger(count)||count<=0))
    throw Error('原版奖励配置无效，本次未领取');
  return rewardPairs(row).filter(([id])=>direct(id)).map(([id,count])=>({id,count,name:itemName(id)}));
}
const compose=items.get(926);
const [composeTarget,composeCost]=compose.itemTypeParam[0];

function milestoneState(value={}) {
  const lastClaimedId=value.lastClaimedId??0;
  if(!Number.isSafeInteger(lastClaimedId)||lastClaimedId<0||lastClaimedId>source.missionRewards.at(-1).id)throw new Error('章节奖励领取记录无效');
  const coreChapters=value.coreChapters===undefined?[]:value.coreChapters;
  if(!Array.isArray(coreChapters)||new Set(coreChapters).size!==coreChapters.length
    ||coreChapters.some(id=>!Number.isInteger(id)||!Object.hasOwn(CHAPTER_CORE_REWARDS,id)))
    throw new Error('章节星核领取记录无效');
  // Keep the historical complete-claim cursor before unissued rows.
  // fixedRewardCursor is explicitly a LOCAL compatibility cursor. Keep the
  // original cursor before unresolved rows, and retain their literal pairs.
  const fixedRewardCursor=value.fixedRewardCursor??lastClaimedId;
  if(!Number.isSafeInteger(fixedRewardCursor)||fixedRewardCursor<lastClaimedId||fixedRewardCursor>source.missionRewards.at(-1).id)
    throw Error('章节固定奖励处理记录无效');
  const deferred=value.deferredRandomRewards??[];
  if(!Array.isArray(deferred)||new Set(deferred.map(row=>row?.rewardId)).size!==deferred.length)
    throw Error('待核实图纸记录无效，未覆盖旧记录');
  const resolved=value.resolvedRandomRewardIds??[];
  if(!Array.isArray(resolved)||new Set(resolved).size!==resolved.length||resolved.some(id=>!missions.has(id)||id<=lastClaimedId||id>fixedRewardCursor||!unresolvedPairs(missions.get(id)).length||deferred.some(entry=>entry.rewardId===id)))
    throw Error('兼容随机奖励记录无效，未覆盖旧记录');
  const expected=source.missionRewards.filter(row=>row.id>lastClaimedId&&row.id<=fixedRewardCursor&&unresolvedPairs(row).length&&!resolved.includes(row.id));
  if(deferred.length!==expected.length||expected.some(row=>{
    const saved=deferred.find(entry=>entry?.rewardId===row.id);
    return !saved||JSON.stringify(saved.rewards)!==JSON.stringify(unresolvedPairs(row));
  })||deferred.some(row=>!missions.has(row?.rewardId)))
    throw Error('待核实图纸与原表不一致，未发放或覆盖记录');
  return {...structuredClone(value),version:3,lastClaimedId,fixedRewardCursor,resolvedRandomRewardIds:resolved.slice(),
    deferredRandomRewards:structuredClone(deferred),coreChapters:coreChapters.slice()};
}
function eligible(row,campaign) {
  if((campaign.clearedChapterIds||[]).some(id=>id>=row.missionId))return true;
  // CanGetReward checks wave, then room, then time. Unsupported modes are
  // not substituted with elapsed wall-clock time from an ordinary battle.
  if(row.wave)return (campaign.passedWaves?.[row.missionId]||0)>=row.wave;
  return false;
}
export function nativeAcquisitionSnapshot(rawInventory,campaign={},rawClaims={},gear,time=Date.now()) {
  const inventory=validateReplicaInventory(rawInventory),claims=milestoneState(rawClaims);
  const rewards=source.missionRewards.filter(row=>replicaChapter(row.missionId)).map(row=>{
    const reward=rewardPairs(row);
    const fixed=reward.every(([id])=>direct(id));
    const supported=reward.every(([id])=>direct(id)||localRandomGroup(id)),processed=row.id<=claims.fixedRewardCursor;
    const deferred=claims.deferredRandomRewards.find(entry=>entry.rewardId===row.id);
    const deferredRewards=unresolvedPairs(row).map(rewardView);
    const reached=eligible(row,campaign),claimed=processed&&!deferred;
    return {...row,reward,localCompatibility:supported&&!fixed,verification:fixed?'固定奖励数量沿原表，暂停资源兼容兑换':supported?`${LOCAL_ECONOMY_POLICY.label}：随机图纸按原候选逐张分配`:claimed?'已领取记录保留':'随机奖励规则未接通',
      rewards:reward.map(rewardView),fixedRewards:reward.filter(([id])=>direct(id)).map(rewardView),
      deferredRewards,reached,claimed,processed,unresolved:Boolean(deferred),supported,
      canClaim:supported&&(Boolean(deferred)||!processed&&row.id===claims.fixedRewardCursor+1&&reached)};
  });
  const chapterCoreRewards=Object.entries(CHAPTER_CORE_REWARDS).map(([key,count])=>{
    const id=Number(key),claimed=claims.coreChapters.includes(id),reached=(campaign.clearedChapterIds||[]).includes(id);
    return {id,claimed,reached,canClaim:!claimed&&reached,rewards:[{id:135,count,name:itemName(135)}]};
  });
  return {revision:inventory.revision,chapterCoreRewards,
    chapterRewardLedger:{completeClaimedThrough:claims.lastClaimedId,fixedProcessedThrough:claims.fixedRewardCursor,
      deferred:claims.deferredRandomRewards.map(entry=>{const row=missions.get(entry.rewardId);return {...entry,missionId:row.missionId,wave:row.wave,rewards:entry.rewards.map(rewardView)};}),
      compatibilityNote:'离线兼容v1：随机组按原候选逐张均匀分配；旧待发记录只补图纸，不重复发固定奖励。'},
    equipmentBoxes:nativeEquipmentBoxPreview(inventory.items,gear,time),materials:Object.entries(inventory.items).filter(([,count])=>count>0).map(([id,count])=>({id:Number(id),count,name:itemName(Number(id))})),rewards,
    recruit:{fragmentId:compose.id,fragmentCount:inventory.items[compose.id]||0,required:composeCost,boxId:composeTarget,boxCount:inventory.items[composeTarget]||0,
      canCompose:(inventory.items[compose.id]||0)>=composeCost,maxComposeCount:Math.floor((inventory.items[compose.id]||0)/composeCost),canOpen:(inventory.items[composeTarget]||0)>0,
      candidates:items.get(composeTarget).itemPreview.filter(([id])=>isRosterPilot(id)).map(([id,count])=>({id,count,name:nativeCollectionDisplayName(id)||growth.pilots.find(row=>row.id===id)?.name||itemName(id)}))},
    labGate:{...source.labFunction,receiptAvailable:false}};
}
/** Inventory and claim cursor commit together. Drop group IDs never enter inventory. */
export function planNativeAcquisition(rawInventory,campaign,rawClaims,operation,rng=Math.random) {
  const inventory=validateReplicaInventory(rawInventory),claims=milestoneState(rawClaims);
  if(operation.expectedRevision!==inventory.revision)throw new Error('材料库存已变化，请重新确认');
  let rewards,deferredRewards=[],deferredRewardId=null;
  if(operation.action==='chapterReward'){
    const row=nativeAcquisitionSnapshot(inventory,campaign,claims).rewards.find(row=>row.id===operation.id);
    if(!row?.canClaim)throw new Error(row?.processed?'该档固定奖励已处理，不会重复发放':'请先达到条件并依次处理章节奖励');
    const existing=claims.deferredRandomRewards.find(entry=>entry.rewardId===row.id);
    const pairs=localRewardPairs(existing?existing.rewards:rewardPairs(row),rng);
    rewards=pairs.map(([id,count])=>({id,count,name:itemName(id)}));
    if(existing)claims.deferredRandomRewards=claims.deferredRandomRewards.filter(entry=>entry.rewardId!==row.id);
    else claims.fixedRewardCursor=row.id;
    if(unresolvedPairs(row).length)claims.resolvedRandomRewardIds.push(row.id);
    // Never step the original claimed cursor over unissued random rewards.
    const pendingIds=new Set(claims.deferredRandomRewards.map(entry=>entry.rewardId));
    while(claims.lastClaimedId<claims.fixedRewardCursor&&!pendingIds.has(claims.lastClaimedId+1))claims.lastClaimedId++;
    claims.resolvedRandomRewardIds=claims.resolvedRandomRewardIds.filter(id=>id>claims.lastClaimedId);
  }else if(operation.action==='chapterCoreReward'){
    const row=nativeAcquisitionSnapshot(inventory,campaign,claims).chapterCoreRewards.find(row=>row.id===operation.id);
    if(!row?.canClaim)throw new Error(row?.claimed?'该章节星核已领取':'请先完整通关对应章节');
    rewards=row.rewards;claims.coreChapters.push(row.id);
  }else if(operation.action==='composePilotBox'){
    const count=operation.count??1,max=Math.floor((inventory.items[compose.id]||0)/composeCost);
    if(!Number.isSafeInteger(count)||count<1||count>max)throw new Error('合成数量无效或驾驶员宝箱碎片不足');
    inventory.items[compose.id]-=composeCost*count;
    rewards=[{id:composeTarget,count,name:itemName(composeTarget)}];
  }else throw new Error('该原版获取方式尚未接通，未消耗材料');
  for(const row of rewards){const count=(inventory.items[row.id]||0)+row.count;if(!Number.isSafeInteger(count))throw new Error('原版材料数量超限');inventory.items[row.id]=count;}
  inventory.revision++;
  return {inventory:validateReplicaInventory(inventory),claims:milestoneState(claims),rewards,deferredRewards,deferredRewardId,policyVersion:LOCAL_ECONOMY_POLICY.version,
    ...(deferredRewards.length?{message:rewards.length?'固定奖励已入背包；随机图纸未发放，已留档待核实':'随机奖励已留档待核实，未发放物品',title:'固定部分已处理 · 图纸待核实'}:{})};
}
