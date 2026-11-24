import {taskDisplayOrder} from '../../ui/task-display-order.js';
import {taskChestModel} from '../../ui/task-chest-model.js';
import {rewardItemModel} from '../../ui/reward-item-model.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {researchBlueprintArt} from '../../replica/research-blueprint-art.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {rewardDisplayQuality,rewardNativeItemId} from '../../replica/item-display-quality.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';

const destinations={battle1:'battle',battle3:'battle',sortie:'battle',victory:'battle',upgrade:'equipment',recruit:'supply'};
export function taskReward(row,s,signIn=false){
  const id=rewardNativeItemId(row),fallback=rewardItemModel(row,s);
  const special=signIn&&(row.id===10010007?nativeItemArt(10010007):row.id===10010008?researchBlueprintArt(801):null);
  const collection=signIn&&row.nativeRow?nativeCollectionArt(row.nativeRow,row.type==='aircraft'?'preview':'thumbnail'):null;
  return {...fallback,...rewardDisplayQuality(row),itemId:id??row.type??row.id,name:row.name||fallback.name,
    image:special||researchBlueprintArt(id)||row.image||collection||RESOURCE_ICONS[row.type]?.url||fallback.image,amount:row.count??row.amount??1};
}
export function rewardRows(value){
  return Array.isArray(value)?value:Object.entries(value||{}).filter(([,count])=>count>0).map(([type,count])=>({type,count}));
}
export function activityModel(s,period){
  const weekly=period==='weekly',supply=s.pilotSupply;
  const activity=(supply?(weekly?supply.week:supply.activity):s.activity?.[period])||{};
  const max=supply?100:activity.max||100,value=Math.max(0,Math.min(max,activity.points??((activity.days||0)*20)));
  const steps=supply?[20,40,60,80,100]:(activity.items||[]).map(r=>r.id);
  const milestones=steps.map(id=>taskChestModel(s,period,id)||{id,step:id,claimed:false,canClaim:false,rewards:[]});
  const rows=supply?(weekly?supply.week.tasks:supply.tasks):(s.tasks||[]).filter(r=>r.type===period);
  const blocked=Boolean(s.rewardPending||s.rewardBusy||(supply&&supply.taskGate?.reached===false));
  const tasks=taskDisplayOrder(rows||[],weekly&&supply?r=>r.progress>=r.target:undefined).map(r=>{
    const target=Math.max(1,Number(r.target)||0),progress=supply?(r.target?Math.max(0,Math.min(target,r.progress||0)):Number(r.claimed||r.canClaim)):r.progress;
    const reached=progress>=target,destination=r.destination||destinations[r.id],payload={id:r.id,destination};
    if(!supply){
      const label=r.pending?'待恢复':r.claimed?'已领取':!reached?'前往':s.rewardPending?'待恢复':r.claimable?'领取':'暂未开放';
      return {...r,points:r.activityPoints,target,progress,label,action:reached?'claimTask':'dailyGo',payload,
        disabled:r.pending||r.claimed||blocked||reached&&(!r.claimable||s.nativeEconomyPending),rewards:rewardRows(r.reward)};
    }
    const complete=weekly&&reached,go=!r.claimed&&!r.canClaim&&(weekly?!complete:Boolean(destination));
    const label=r.claimed?(weekly?'已领取':'已完成'):go?'前往':r.canClaim?'领取':complete?'已完成':'未达成';
    return {...r,target,progress,label,action:go?'dailyGo':'pilotSupply',payload:go?payload:{id:r.id,operation:weekly?'weeklyTask':'task',revision:supply.revision},
      claimed:weekly?complete:r.claimed,ready:!weekly&&r.canClaim,disabled:blocked||r.claimed||(!go&&!r.canClaim),rewards:[]};
  });
  return {weekly,value,max,milestones,tasks,revision:supply?.revision,label:weekly?'每周活跃':'每日活跃',
    reset:supply?.taskGate?.reached===false?supply.taskGate.reason:(weekly?'每周一':'每日')+' 00:00 刷新'};
}
export function signInCard(day,s){
  const recorded=day.rewards?.length?day.rewards:[day];
  const rows=day.legacyReward&&day.claimed&&day.calendarDay===1&&recorded.length>1?recorded.filter(r=>r.type!=='coins'):recorded;
  const pilot=rows.find(r=>r.type==='pilot');
  return {day:day.calendarDay||day.day,final:day.day===7,claimed:day.claimed,items:rows,
    today:Boolean(day.active&&!day.claimed&&s.signIn.canClaim&&!s.rewardPending),busy:Boolean(s.rewardBusy),
    pilot:pilot?{name:pilot.name,image:nativeCollectionArt(pilot.nativeRow,'preview')}:null};
}
export function achievementRows(s){
  return taskDisplayOrder(s.achievements?.items||[]).map(r=>{
    const reached=r.progress>=r.target;
    const label=r.claimed?'已完成':r.pending||s.rewardPending?'待恢复':reached?(r.claimable?'领取':'未达成'):'前往';
    return {...r,label,action:reached?'claimAchievement':'dailyGo',payload:{id:r.id,destination:r.destination},ready:r.claimable,
      disabled:r.claimed||r.pending||s.rewardPending||s.rewardBusy||reached&&!r.claimable,
      rewards:rewardRows(r.rewardItems||r.reward)};
  });
}
