// Girl Flight deterministic acquisition policy. Original unlock/star costs stay intact.
import catalog from './native-economy-catalog.json' with {type:'json'};
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import { nativeCollectionDisplayName } from './native-collection-names.js';
import { nativeItemArt } from './native-item-presentation.js';
import { flightRewardView } from './flight-rewards.js';
import { localGrowthAllowances } from './local-growth-policy.js';

const rules={
  guns:{period:'daily',name:'机炮',requirement:'领取每日100活跃奖励后可领，每天一次',
    fallback:[[1,3000],[105,5],[106,5],[107,5],[108,5],[109,5]]},
  skins:{period:'week',name:'飞机',requirement:'本周累计5天领取每日满活跃奖励后开放本周自选名额',
    fallback:[[112,1],[105,10],[106,10],[107,10],[108,10],[109,10]]},
};

export function collectionSupplySnapshot(progression,inventory,ledger,campaign={}) {
  return Object.fromEntries(Object.entries(rules).map(([kind,rule])=>{
    const candidates=catalog[kind].filter(row=>UNLOCK_ALL_CONTENT||!row.closed).map(row=>{
      const owned=progression[kind].find(entry=>entry.id===row.id&&entry.active);
      const maxStar=Math.max(...row.stages.map(stage=>stage.star));
      const maxed=Boolean(owned&&owned.star>=maxStar),copies=inventory.items[row.id]||0;
      const costCount=costs=>(costs||[]).reduce((sum,[id,count])=>sum+(id===row.id?count:0),0);
      const needed=maxed?0:(owned?0:costCount(row.unlockCost))+row.stages
        .filter(stage=>stage.star>=(owned?.star??row.defaultStar)&&stage.star<maxStar)
        .reduce((sum,stage)=>sum+costCount(stage.cost),0);
      return {id:row.id,name:nativeCollectionDisplayName(row.id)||row.name,image:nativeItemArt(row.id),
        owned:Boolean(owned),star:owned?.star||0,maxed,copies,needed,
        selectable:UNLOCK_ALL_CONTENT||!maxed&&copies<needed,stocked:!maxed&&copies>=needed};
    });
    const record=ledger[rule.period],limit=kind==='skins'?(UNLOCK_ALL_CONTENT?5:localGrowthAllowances(campaign).weeklyPlanes):1;
    const claimedCount=record.collectionCount??(record.collectionChoice===null?0:1),claimed=claimedCount>=limit;
    const reached=UNLOCK_ALL_CONTENT||(kind==='guns'?ledger.daily.activityClaimed:ledger.week.activeDays.length>=5);
    const allowanceNote=kind==='skins'?'每周自选1张飞机卡，通关10/20/30/60章后增至2/3/4/5张。':'每天自选1张机炮卡。';
    return [kind,{kind,name:rule.name,requirement:rule.requirement,candidates,claimed,reached,limit,claimedCount,remaining:Math.max(0,limit-claimedCount),allowanceNote,
      canClaim:!claimed&&reached,complete:!candidates.some(row=>row.selectable),
      claimedId:record.collectionChoice,fallback:rule.fallback.map(([id,count])=>flightRewardView({kind:'item',id,count}))}];
  }));
}

/** Called inside the existing pilot-supply atomic profile/inventory transaction. */
export function claimCollectionSupply(progression,inventory,ledger,operation,campaign={}) {
  const rule=rules[operation.kind];
  if(!rule)throw Error('请选择机炮或飞机补给');
  const view=collectionSupplySnapshot(progression,inventory,ledger,campaign)[operation.kind];
  if(view.claimed)throw Error('本期自选补给已领取');
  if(!view.reached)throw Error(view.requirement);
  let pairs;
  if(view.complete){
    if(operation.id!==0)throw Error('同名卡已充足，请重新确认材料补给');
    pairs=rule.fallback;
  }else{
    const selected=view.candidates.find(row=>row.id===operation.id&&row.selectable);
    if(!selected)throw Error('该收藏已满星、同名卡已足够或不可选择，请重新选择');
    pairs=[[selected.id,1]];
  }
  const rewards=pairs.map(([id,count])=>{
    const balance=(inventory.items[id]||0)+count;
    if(!Number.isSafeInteger(balance))throw Error('道具数量超限，未领取');
    inventory.items[id]=balance;
    return flightRewardView({kind:'item',id,count});
  });
  ledger[rule.period].collectionChoice=operation.id;
  ledger[rule.period].collectionCount=view.claimedCount+1;
  return {rewards,title:view.complete?rule.name+'满级材料补给':rule.name+'自选卡已存入背包'};
}
