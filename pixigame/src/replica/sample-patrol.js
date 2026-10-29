// PATROL_SAMPLE records one observed screenshot, not a server formula.
// Runtime settlement uses local chapter curves and an 11-type rotation below.
import { nativePatrolSnapshot } from './native-patrol.js';
import { UNLOCK_ALL_CONTENT, UNLIMITED_RESOURCES } from '../development-resources.js';
import { validateReplicaInventory } from './native-economy.js';
import { nativeItemArt } from './native-item-presentation.js';
import { nativeItemPresentation } from './native-item-presentation.js';
import { LOCAL_ECONOMY_POLICY, economyTime, economyDay, localIncomeRates, localPatrolVoucherRates } from './local-economy-policy.js';
const {patrolIntervalSeconds:INTERVAL,patrolCapSeconds:CAP,quickSeconds:QUICK_SECONDS,
 quickDailyCount:QUICK_COUNT,quickAdDailyCount:AD_COUNT,quickStamina:STAMINA_COST}=LOCAL_ECONOMY_POLICY;
// sampleBased is an old UI transport flag, not proof of a sampled server formula.
export const PATROL_SAMPLE = Object.freeze([
  [1,8320,'金币'],[2,7,'钻石'],
  [105,13,'座舱装甲图纸'],[106,20,'火控模组图纸'],[107,20,'机身装甲图纸'],
  [108,17,'引擎装甲图纸'],[109,14,'增幅核心图纸'],
  [801,5,'速射机炮图纸'],[802,5,'爆燃导弹图纸'],[803,1,'高能激光图纸'],
  [804,4,'酸液枪图纸'],[805,2,'冰刃弹图纸'],[807,2,'灼热射线图纸'],
  [808,1,'能量光剑图纸'],[810,6,'电弧枪图纸'],[811,4,'酸性黑洞图纸'],
].map(([id,count,name])=>Object.freeze({id,count,name})));

export function initializeSamplePatrol(raw,campaign={},time=Date.now()) {
  economyTime(time);
  if(raw?.version===2&&raw.policyVersion===1){
    const state=structuredClone(raw);
    state.remainders??={};state.remainders.basic??=0;state.remainders.advanced??=0;
    if(['beginAt','lastSeen','quickUsed','adUsed','gearCursor','researchCursor'].some(key=>!Number.isSafeInteger(state[key])||state[key]<0)
      ||!state.remainders||['gold','gear','research'].some(key=>!Number.isSafeInteger(state.remainders[key])||state.remainders[key]<0||state.remainders[key]>=360000)
      ||['basic','advanced'].some(key=>!Number.isSafeInteger(state.remainders[key])||state.remainders[key]<0||state.remainders[key]>=2880000)
      ||typeof state.day!=='string'||!/^[0-9]+$/.test(state.day)||state.quickUsed>QUICK_COUNT||state.adUsed>AD_COUNT)throw Error('兼容巡逻记录无效，旧档未覆盖');
    if(time>=state.lastSeen&&Number(economyDay(time))>Number(state.day)){state.day=economyDay(time);state.quickUsed=0;state.adUsed=0;}
    return state;
  }
  return {version:2,policyVersion:1,beginAt:time,lastSeen:time,day:economyDay(time),quickUsed:0,adUsed:0,
    gearCursor:0,researchCursor:0,remainders:{gold:0,gear:0,research:0,basic:0,advanced:0},...(raw?{legacy:structuredClone(raw)}:{})};
}
export function samplePatrolSnapshot(raw,campaign,time,revision,progression) {
  const native=nativePatrolSnapshot(campaign,[],progression);
  const ledger=initializeSamplePatrol(raw,campaign,time),chapter=continuousChapter(campaign),rates={...localIncomeRates(chapter),...localPatrolVoucherRates(chapter)};
  const clockRollback=time<ledger.lastSeen||time<ledger.beginAt;
  const seconds=clockRollback?0:Math.min(CAP,Math.floor((time-ledger.beginAt)/1000));
  return {...native,revision,development:UNLOCK_ALL_CONTENT,sampleBased:true,chapterKnown:true,stageIndex:chapter-1,
    nativeSettlementPending:false,nativeSettlementKnown:false,payoutSource:'local-patrol-v1',compatibility:true,compatibilityNote:LOCAL_ECONOMY_POLICY.label,
    storedMinutes:seconds/60,clockRollback,quickHours:QUICK_SECONDS/3600,quickMinutes:QUICK_SECONDS/60,quickDurationKnown:true,
    quickLeft:Math.max(0,QUICK_COUNT-ledger.quickUsed),quickAdLeft:Math.max(0,AD_COUNT-ledger.adUsed),quickLabel:`${QUICK_SECONDS/3600}小时巡逻收益`,
    rewards:seconds>=INTERVAL?{coins:1}:{},rewardRows:preview(ledger,rates,Math.floor(seconds/INTERVAL)*INTERVAL,native.researchBonus),
    quickRewardRows:preview(ledger,rates,QUICK_SECONDS,native.researchBonus),
    rateItems:[{id:1,name:'金币',perHour:Math.floor(rates.gold*(100+native.researchBonus)/100)},
      {id:105,name:'装备图纸（五种轮换合计）',perHour:Math.floor(rates.gear*(100+native.researchBonus)/100)},
      {id:801,name:'科研图纸（十一种轮换合计）',perHour:Math.floor(rates.research*(100+native.researchBonus)/100)},
      {id:113,name:'普通装备箱券',perHour:rates.basic*(100+native.researchBonus)/800},
      {id:112,name:'高级装备箱券',perHour:rates.advanced*(100+native.researchBonus)/800}],
    capNote:'离线兼容：最多积累8小时，10分钟起领；UTC+8每日重置快速次数。',
    multiplierNote:'章节分段兼容产出，巡逻天赋只加成一次；不是原服结算公式。',referenceRows:[],referenceNote:''};
}
function continuousChapter(campaign){
  const cleared=new Set(campaign.clearedChapterIds||[]);let chapter=1;
  while(chapter<60&&cleared.has(chapter))chapter++;
  return chapter;
}
function rewardsFor(ledger,rates,seconds,bonus){
  const totals=[];
  for(const key of ['gold','gear','research']){
    const numerator=rates[key]*seconds*(100+bonus)+ledger.remainders[key];
    const count=Math.floor(numerator/360000);ledger.remainders[key]=numerator%360000;
    if(key==='gold'){if(count)totals.push([1,count]);continue;}
    const size=key==='gear'?5:11,start=key==='gear'?105:801,cursorKey=key==='gear'?'gearCursor':'researchCursor';
    const counts=Array(size).fill(Math.floor(count/size));
    for(let index=0;index<count%size;index++)counts[(ledger[cursorKey]+index)%size]++;
    ledger[cursorKey]=(ledger[cursorKey]+count)%size;
    counts.forEach((amount,index)=>{if(amount)totals.push([start+index,amount]);});
  }
  for(const [key,id] of [['basic',113],['advanced',112]]){
    const numerator=rates[key]*seconds*(100+bonus)+(ledger.remainders[key]||0),count=Math.floor(numerator/2880000);
    ledger.remainders[key]=numerator%2880000;
    if(count)totals.push([id,count]);
  }
  return totals;
}
const presentation=pairs=>pairs.map(([id,amount])=>({type:'nativeItem',nativeItemId:id,id,amount,...nativeItemPresentation(id),image:nativeItemArt(id)}));
function preview(ledger,rates,seconds,bonus){return presentation(rewardsFor(structuredClone(ledger),rates,seconds,bonus));}
export function planSamplePatrol(raw,rawInventory,campaign,time,operation,stamina,progression) {
  const inventory=validateReplicaInventory(rawInventory);
  if(operation.expectedRevision!==inventory.revision)throw Error('库存已变化，请重新领取');
  const ledger=initializeSamplePatrol(raw,campaign,time),native=nativePatrolSnapshot(campaign,[],progression);
  if(time<ledger.lastSeen||time<ledger.beginAt)throw Error('设备时间回退，请恢复时间后领取');
  if(!native.unlocked||operation.mode!=='idle'&&!native.quickUnlocked)throw Error('巡逻条件未达成');
  let seconds=QUICK_SECONDS,staminaCost=0,pairs;
  if(operation.mode==='idle'){
    const elapsed=Math.floor((time-ledger.beginAt)/1000);seconds=Math.floor(Math.min(CAP,elapsed)/INTERVAL)*INTERVAL;
    if(seconds<INTERVAL)throw Error('巡逻满10分钟后领取');
    ledger.beginAt=elapsed>=CAP?time:ledger.beginAt+seconds*1000;
  }else if(operation.mode==='stamina'){
    if(ledger.quickUsed>=QUICK_COUNT)throw Error('今日体力快速次数已用完');
    if(!UNLIMITED_RESOURCES&&(!Number.isSafeInteger(stamina)||stamina<STAMINA_COST))throw Error('体力不足');
    staminaCost=UNLIMITED_RESOURCES?0:STAMINA_COST;ledger.quickUsed++;
  }else if(operation.mode==='ad'){
    if(ledger.adUsed>=AD_COUNT)throw Error('今日模拟广告快速次数已用完');
    ledger.adUsed++;
  }else if(operation.mode==='devSample'&&UNLOCK_ALL_CONTENT){pairs=PATROL_SAMPLE.map(row=>[row.id,row.count]);}
  else throw Error('巡逻操作无效');
  pairs??=rewardsFor(ledger,{...localIncomeRates(continuousChapter(campaign)),...localPatrolVoucherRates(continuousChapter(campaign))},seconds,native.researchBonus);
  for(const [id,count] of pairs){const total=(inventory.items[id]||0)+count;if(!Number.isSafeInteger(total))throw Error('库存数量超限');inventory.items[id]=total;}
  ledger.lastSeen=time;
  inventory.revision++;
  return {samplePatrol:true,ledger,inventory:validateReplicaInventory(inventory),staminaCost,
    rewards:presentation(pairs),title:operation.mode==='devSample'?'开发样例发放':'巡逻收益 · 离线兼容v1'};
}
