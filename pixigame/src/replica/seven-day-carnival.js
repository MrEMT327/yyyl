import {CARNIVAL_POLICY as policy} from './seven-day-carnival-policy.js';
import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import {validateReplicaInventory} from './native-economy.js';
import {flightDay,flightRewardView} from './flight-rewards.js';
import {localRandomMaterials} from './local-economy-policy.js';

const DAY=86400000,duration=policy.durationHours*3600000;
const taskIds=new Set(policy.days.flatMap(day=>day.tasks.map(task=>task.id)));
const milestonePoints=new Set(policy.milestones.map(row=>row.points));
const maxPoints=policy.milestones.at(-1).points;
const counters=['coinsSpent','diamondsSpent','equipmentBoxes','basicBoxes','quickPatrols',
  'equipmentUpgrades','equipmentMerges','talentDraws','labUpgrades','shopPurchases','enemyKills','bossKills','staminaSpent'];
const metricKeys=['chapter','stars','accountLevel','power','equippedBlue','equippedPurple'];
const safe=value=>Number.isSafeInteger(value)&&value>=0;
const count=value=>safe(value)?value:0;
const sum=values=>values.reduce((total,value)=>total+count(value),0);
const zeroes=keys=>Object.fromEntries(keys.map(key=>[key,0]));
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const validClaims=(values,set)=>Array.isArray(values)&&values.length<=set.size&&new Set(values).size===values.length&&values.every(id=>set.has(id));

export function validateCarnival(raw){
  if(!raw||raw.version!==policy.version||![raw.startedAt,raw.lastSeen,raw.revision,raw.startedAt+duration].every(safe)
    ||raw.lastSeen<raw.startedAt||!Array.isArray(raw.loginDays)||raw.loginDays.length>7
    ||new Set(raw.loginDays).size!==raw.loginDays.length||raw.loginDays.some(day=>!date(day))
    ||!validClaims(raw.taskClaims,taskIds)||!validClaims(raw.milestoneClaims,milestonePoints)
    ||counters.some(key=>!safe(raw.counters?.[key]))||metricKeys.some(key=>!safe(raw.metrics?.[key])))
    throw Error('七日嘉年华记录无效，旧记录未覆盖');
  return raw;
}

export function captureCarnivalEvidence(state){
  const patrol=state?.samplePatrol,labs=state?.replicaLoadout?.labs;
  return {
    started:state?.carnival!==undefined,
    coins:count(state?.replicaInventory?.items?.[1]),diamonds:count(state?.replicaInventory?.items?.[2]),
    daily:{...state?.pilotSupply?.daily},basicBoxes:count(state?.equipment?.nativeBoxProgress?.basicDraws),
    talentDraws:sum(Object.values(state?.replicaLoadout?.nativeResearch?.levels||{})),
    labs:Object.fromEntries((Array.isArray(labs)?labs:[]).filter(Boolean).map(row=>[row.id,count(row.level)])),
    patrol:patrol?{day:patrol.day,quick:count(patrol.quickUsed)+count(patrol.adUsed)}:null,
  };
}

function currentMetrics(state,power){
  const campaign=state.replicaCampaign||{},gear=state.equipment||{};
  const equipped=Object.values(gear.slots||{}).map(uid=>gear.items?.find(item=>item.uid===uid)).filter(Boolean);
  const stars=sum(Object.values(campaign.starMasks||{}).map(mask=>
    Number.isInteger(mask)&&mask>=0&&mask<=7?Number(Boolean(mask&1))+Number(Boolean(mask&2))+Number(Boolean(mask&4)):0));
  return {chapter:Math.max(0,...(campaign.clearedChapterIds||[]).map(count)),stars,
    accountLevel:count(state.replicaLoadout?.playerLevel)||1,power:count(power),
    equippedBlue:equipped.filter(item=>item.quality>=30).length,equippedPurple:equipped.filter(item=>item.quality>=40).length};
}

// Use the last successfully saved evidence, never a frame tick or an
// uncommitted transaction. Keep the original version-1 ledger format.
export function planCarnivalProgress(before,next,time,power,{equipmentMerges=0}={}){
  if(!next.replicaLoadout||!next.replicaInventory||!next.equipment)return null;
  if(!safe(time))throw Error('活动时间无效');
  const existing=next.carnival;
  if(existing!==undefined){
    validateCarnival(existing);
    const expiresAt=existing.startedAt+duration;
    if(time<existing.lastSeen||existing.lastSeen>=expiresAt)return existing;
    if(time>=expiresAt)return {...existing,lastSeen:expiresAt};
  }
  const ledger=existing===undefined?{version:policy.version,startedAt:time,lastSeen:time,revision:0,
    loginDays:[],taskClaims:[],milestoneClaims:[],counters:zeroes(counters),metrics:zeroes(metricKeys)}:structuredClone(existing);
  ledger.lastSeen=time;
  const today=flightDay(time);
  if(!ledger.loginDays.includes(today)&&ledger.loginDays.length<7)ledger.loginDays.push(today);
  const metrics=currentMetrics(next,power);
  for(const key of metricKeys)ledger.metrics[key]=Math.max(ledger.metrics[key],metrics[key]);
  if(existing===undefined||!before?.started)return ledger;
  const current=captureCarnivalEvidence(next);
  const increase=(key,delta)=>{
    const total=ledger.counters[key]+Math.max(0,delta);
    if(!safe(total))throw Error('嘉年华累计次数超限');
    ledger.counters[key]=total;
  };
  increase('coinsSpent',before.coins-current.coins);
  increase('diamondsSpent',before.diamonds-current.diamonds);
  const events={shopPurchases:'shopPurchases',enemyKills:'enemyKills',bossKills:'bossKills',staminaSpent:'staminaSpent',
    boxesOpened:'equipmentBoxes',upgrades:'equipmentUpgrades'};
  for(const [field,key] of Object.entries(events))
    increase(key,count(current.daily[field])-(current.daily.day===before.daily.day?count(before.daily[field]):0));
  increase('basicBoxes',current.basicBoxes-before.basicBoxes);
  increase('talentDraws',current.talentDraws-before.talentDraws);
  increase('labUpgrades',sum(Object.entries(current.labs).map(([id,level])=>Math.max(0,level-(before.labs[id]??1)))));
  increase('equipmentMerges',count(equipmentMerges));
  if(current.patrol)increase('quickPatrols',current.patrol.quick-(current.patrol.day===before.patrol?.day?before.patrol.quick:0));
  return validateCarnival(ledger);
}

export function carnivalClock(ledger,time){
  if(!ledger)return null;
  const expiresAt=ledger.startedAt+duration;
  return {expiresAt,clockRollback:time<ledger.lastSeen,expired:time>=expiresAt||ledger.lastSeen>=expiresAt,
    day:Math.max(1,Math.min(7,Math.floor((time-ledger.startedAt)/DAY)+1))};
}

function milestoneReward(reward){
  if(reward.kind==='equipment')return {...flightRewardView({kind:'item',id:reward.previewId,count:reward.count}),
    type:'equipment',name:reward.name,image:flightRewardView({kind:'item',id:934,count:1}).image,
    qualityRank:3,qualityName:'史诗',qualityKnown:true};
  return flightRewardView({kind:'item',id:reward.id,count:reward.count});
}
const milestoneViews=policy.milestones.map(row=>({...row,rewards:[milestoneReward(row.reward)]}));
const taskReward=flightRewardView({kind:'item',id:2,count:policy.taskDiamonds});

export function carnivalSnapshot(raw,state,time,power){
  if(raw===undefined)return null;
  const ledger=validateCarnival(raw),clock=carnivalClock(ledger,time),{expired,clockRollback,day}=clock;
  const points=ledger.taskClaims.length*policy.taskPoints,blocked=expired||clockRollback;
  const liveMetrics=blocked?ledger.metrics:currentMetrics(state,power);
  const metrics={...ledger.counters,...Object.fromEntries(metricKeys.map(key=>[key,Math.max(ledger.metrics[key],liveMetrics[key])])),
    loginDays:ledger.loginDays.length};
  const claimedTasks=new Set(ledger.taskClaims);
  const days=policy.days.map(row=>({day:row.day,unlocked:row.day<=day,tasks:row.tasks.map(task=>{
    const claimed=claimedTasks.has(task.id),progress=Math.min(task.target,count(metrics[task.metric]));
    return {...task,progress,claimed,canClaim:!blocked&&row.day<=day&&!claimed&&progress>=task.target};
  })}));
  const milestones=milestoneViews.map(row=>{
    const claimed=ledger.milestoneClaims.includes(row.points);
    return {...row,claimed,canClaim:!blocked&&!claimed&&points>=row.points};
  });
  return {...clock,revision:ledger.revision,inventoryRevision:state.replicaInventory.revision,
    equipmentRevision:state.equipment.revision,startedAt:ledger.startedAt,observedAt:time,points,maxPoints,
    days,taskReward,taskPoints:policy.taskPoints,milestones,
    canClaim:days.some(row=>row.tasks.some(task=>task.canClaim))||milestones.some(row=>row.canClaim)};
}

export function planCarnivalClaim(state,operation,time,rng=Math.random,power){
  const ledger=structuredClone(validateCarnival(state.carnival)),view=carnivalSnapshot(ledger,state,time,power);
  if(operation.expectedRevision!==ledger.revision||operation.expectedInventoryRevision!==state.replicaInventory.revision)
    throw Error('活动或库存已更新，请重新领取');
  if(view.expired)throw Error('七日嘉年华已结束');
  if(view.clockRollback)throw Error('设备时间回退，请恢复时间后重试');
  let reward;
  if(operation.kind==='task'){
    const task=view.days.flatMap(day=>day.tasks).find(task=>task.id===operation.id);
    if(!task?.canClaim)throw Error(task?.claimed?'该任务奖励已领取':'任务尚未开放或未达成');
    ledger.taskClaims.push(task.id);reward={kind:'item',id:2,count:policy.taskDiamonds};
  }else if(operation.kind==='milestone'){
    const row=view.milestones.find(row=>row.points===operation.id);
    if(!row?.canClaim)throw Error(row?.claimed?'该活跃奖励已领取':'尚未达到该档活跃度');
    ledger.milestoneClaims.push(row.points);reward=row.reward;
  }else throw Error('未知嘉年华领取操作');
  const inventory=validateReplicaInventory(state.replicaInventory),rewards=[];
  let gear=state.equipment;
  if(reward.kind==='equipment'){
    if(operation.expectedEquipmentRevision!==gear.revision)throw Error('装备已更新，请重新领取');
    const candidates=equipment.equip.filter(row=>row.quality===reward.quality&&row.rank===reward.rank);
    if(!candidates.length||gear.version!==2||gear.items.length>=10000||!safe(gear.serial))throw Error('装备仓库无法接收奖励');
    const roll=rng();
    if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('随机装备结果无效');
    const row=candidates[Math.floor(roll*candidates.length)];
    gear=structuredClone(gear);
    const serial=gear.serial+1,uid='gear-'+serial;
    if(!safe(serial)||gear.items.some(item=>item.uid===uid))throw Error('装备序号无效');
    gear.serial=serial;gear.items.push({uid,family:row.ID-row.quality,quality:row.quality,locked:false});gear.revision++;
    rewards.push(flightRewardView({kind:'item',id:row.ID,count:1}));
  }else{
    const pairs=reward.kind==='materials'?localRandomMaterials(reward.id,reward.count,rng):[[reward.id,reward.count]];
    for(const [id,amount] of pairs){
      const balance=(inventory.items[id]||0)+amount;
      if(!safe(balance))throw Error('奖励数量超限');
      inventory.items[id]=balance;rewards.push(flightRewardView({kind:'item',id,count:amount}));
    }
  }
  inventory.revision++;ledger.revision++;ledger.lastSeen=time;
  if(!safe(inventory.revision)||!safe(ledger.revision)||!safe(gear.revision))throw Error('奖励版本超限');
  return {carnival:validateCarnival(ledger),inventory:validateReplicaInventory(inventory),gear,rewards};
}
