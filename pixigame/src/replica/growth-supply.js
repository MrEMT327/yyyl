// Local growth rewards use equipment materials. Historical pilot choices are
// accepted only to preserve already-claimed daily / weekly supply records.
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import { PILOT_FRAGMENT_ITEMS } from './native-pilot-fragments.js';
import { flightRewardView } from './flight-rewards.js';
import { localGrowthAllowances } from './local-growth-policy.js';

export const GROWTH_SUPPLY_RULES=Object.freeze({
  daily:Object.freeze({name:'每日成长补给',boxId:903,boxCount:1,materialCount:1,fallbackId:105,
    requirement:'领取每日100活跃奖励后可领，每天一次'}),
  week:Object.freeze({name:'每周成长补给',boxId:934,boxCount:1,materialCount:5,fallbackId:105,chapter:8,days:5,
    extraRewards:Object.freeze([Object.freeze({id:135,count:1})]),
    requirement:'通关第8章，且本周累计5天领取满活跃奖励后可领，每周一次'}),
});
export const GROWTH_SUPPLY_ITEM_IDS=Object.freeze([903,934,105]);
export function normalizeGrowthSupplyClaims(ledger) {
  for(const period of Object.keys(GROWTH_SUPPLY_RULES)){
    const record=ledger[period];record.growthChoice??=null;
    if(period==='daily'){
      record.growthCoresClaimed??=0;
      if(!Number.isSafeInteger(record.growthCoresClaimed)||record.growthCoresClaimed<0||record.growthCoresClaimed>2
        ||record.growthCoresClaimed>0&&record.growthChoice===null)throw Error('每日成长星核记录无效');
    }
    if(record.growthChoice!==null&&record.growthChoice!==0&&!PILOT_FRAGMENT_ITEMS.some(row=>row.pilotId===record.growthChoice))
      throw Error('成长补给领取记录无效');
    if(GROWTH_SUPPLY_RULES[period].extraRewards?.length){
      if(record.growthExtrasClaimed===undefined)record.growthExtrasClaimed=false;
      if(typeof record.growthExtrasClaimed!=='boolean'||record.growthExtrasClaimed&&record.growthChoice===null)
        throw Error('成长补给额外奖励记录无效');
    }
  }
}
export function growthSupplySnapshot(progression,inventory,ledger,campaign={}) {
  return Object.fromEntries(Object.entries(GROWTH_SUPPLY_RULES).map(([period,rule])=>{
    const claimedId=ledger[period].growthChoice,claimed=claimedId!==null;
    const coreAllowance=UNLOCK_ALL_CONTENT?2:localGrowthAllowances(campaign).dailyCores;
    const remainingCores=Math.max(0,coreAllowance-(ledger.daily.growthCoresClaimed||0));
    const extraRewards=period==='daily'?(remainingCores?[{id:135,count:remainingCores}]:[]):
      ledger.week.growthExtrasClaimed?[]:rule.extraRewards||[];
    const supplemental=claimed&&extraRewards.length>0;
    const reached=UNLOCK_ALL_CONTENT||(period==='daily'?ledger.daily.activityClaimed:
      ledger.week.activeDays.length>=rule.days&&(campaign.clearedChapterIds||[]).includes(rule.chapter));
    return [period,{...rule,period,claimed,claimedId,reached,supplemental,canClaim:(!claimed||supplemental)&&reached,
      policyVersion:2,coreIncomeNote:period==='daily'?`今日星核 ${ledger.daily.growthCoresClaimed||0}/${coreAllowance} · 通关10章后每日1枚。`:'每周额外领取星核 ×1。',
      extraRewards:extraRewards.map(reward=>flightRewardView({kind:'item',...reward})),
      box:flightRewardView({kind:'item',id:rule.boxId,count:rule.boxCount}),
      material:flightRewardView({kind:'item',id:rule.fallbackId,count:rule.materialCount})}];
  }));
}
export function claimGrowthSupply(progression,inventory,ledger,campaign,operation) {
  const rule=Object.hasOwn(GROWTH_SUPPLY_RULES,operation.period)?GROWTH_SUPPLY_RULES[operation.period]:null;
  if(!rule)throw Error('请选择每日或每周成长补给');
  const view=growthSupplySnapshot(progression,inventory,ledger,campaign)[operation.period];
  if(view.claimed&&!view.supplemental)throw Error('本期成长补给已领取');
  if(!view.reached)throw Error(rule.requirement);
  if(!view.supplemental&&operation.id!==0)throw Error('补给内容已更新，请重新打开');
  const extras=view.extraRewards.map(({id,count})=>({id,count}));
  const pairs=view.supplemental?extras:[{id:rule.boxId,count:rule.boxCount},{id:rule.fallbackId,count:rule.materialCount},...extras];
  for(const {id,count} of pairs){
    const balance=(inventory.items[id]||0)+count;
    if(!Number.isSafeInteger(balance))throw Error('库存数量超限，本次未领取');
    inventory.items[id]=balance;
  }
  if(!view.supplemental)ledger[operation.period].growthChoice=0;
  if(operation.period==='daily')ledger.daily.growthCoresClaimed=(ledger.daily.growthCoresClaimed||0)+extras.reduce((sum,row)=>sum+(row.id===135?row.count:0),0);
  else if(rule.extraRewards?.length)ledger.week.growthExtrasClaimed=true;
  return {rewards:pairs.map(r=>flightRewardView({kind:'item',...r})),title:view.supplemental?rule.name+'星核已补领':rule.name+'已领取'};
}
