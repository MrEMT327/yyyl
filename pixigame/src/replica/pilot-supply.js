import { AIRCRAFTS } from '../pilots.js';
// Girl Flight supply policy. Native pilot IDs, star costs and battle values stay intact.
import { normalizeGrowthSupplyClaims, growthSupplySnapshot, claimGrowthSupply } from './growth-supply.js';
import { ITEM_USE_BATCH_LIMIT, isItemUseBatchCount } from './item-use-batches.js';
import { grantPilotCards, pilotAtMaxStar, pilotCreditReward, PILOT_CREDIT_COST } from './pilot-copy-grants.js';
import { collectionSupplySnapshot, claimCollectionSupply } from './collection-supply.js';
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import catalog from './native-economy-catalog.json' with {type:'json'};
import { NATIVE_PILOT_SKINS, isRosterPilot } from './native-pilot-roster.js';
import { nativePilotDisplayName } from './native-pilot-names.js';
import { validateReplicaInventory } from './native-economy.js';
import { validateReplicaProgression } from './native-progression.js';
import { flightDay } from './flight-rewards.js';
import { nativeItemArt } from './native-item-presentation.js';
import { nativeItemDisplayName } from './native-item-names.js';
import { pilotFragmentForPilot } from './native-pilot-fragments.js';
import { PILOT_TASK_POINTS, PILOT_TASK_REWARDS, PILOT_DAILY_ACTIVITY_REWARDS, PILOT_WEEKLY_ACTIVITY_REWARDS, PILOT_AD_REWARDS } from './pilot-supply-reward-policy.js';

export const PILOT_SUPPLY_POOL = Object.freeze([
  {id:926,amount:3,weight:70,name:'角色箱碎片'},
  {id:925,amount:1,weight:2,name:'角色箱'},
  {id:113,amount:1,weight:10,name:'普通装备箱券'},
  {id:112,amount:1,weight:3,name:'高级装备箱券'},
  {id:1,amount:1000,weight:10,name:'金币'},
  {id:'blueprint',amount:10,weight:5,name:'装备图纸（随机一种）'},
]);
const exchangeRoster=catalog.pilots.filter(row=>!row.closed&&isRosterPilot(row.id));
const roster=exchangeRoster.filter(row=>![40100,40101].includes(row.id));
const recruitRarity=row=>AIRCRAFTS.find(p=>p.id===NATIVE_PILOT_SKINS[row.id])?.rarity;
export const DIRECT_RECRUIT_RATES=Object.freeze({R:.74,SR:.20,SSR:.05,UR:.01});
// The historical direct-character chance and ten-draw guarantee, combined
// with existing project resources. Weights add up to 100 per unforced draw.
export const DIRECT_RECRUIT_PILOT_WEIGHT=20;
export const DIRECT_RECRUIT_RESOURCES=Object.freeze([
  Object.freeze({id:1,amount:1000,weight:40,name:'金币'}),
  Object.freeze({id:113,amount:1,weight:20,name:'普通箱券'}),
  Object.freeze({id:'blueprint',amount:10,weight:15,name:'随机装备图纸'}),
  Object.freeze({id:112,amount:1,weight:5,name:'高级箱券'}),
]);
const blueprints=[105,106,107,108,109];
const INTRO_BATTLE_REWARDS=[{id:1,amount:300},{id:106,amount:5}];
// Retain task IDs so existing claims cannot be paid again after the change.
const tasks=[{id:'login',name:'每日报到',target:1,counter:'login',starter:40100},
  {id:'battle1',name:'完成 1 次出击',target:1,counter:'battles',destination:'battle'},
  {id:'battle3',name:'赢得 1 场战斗',target:1,counter:'victories',destination:'battle'},
  {id:'upgrade',name:'完成 1 次基础强化',target:1,counter:'upgrades',destination:'equipment'},
  {id:'recruit',name:'完成 1 次招募',target:1,counter:'recruits',destination:'supply'}]
  .map(task=>({...task,points:PILOT_TASK_POINTS[task.id],rewards:PILOT_TASK_REWARDS[task.id]}));
const weekTasks=[
  {id:'weekly-sorties',name:'每周完成 5 次出击',target:5,counter:'battles',points:30,destination:'battle'},
  {id:'weekly-victories',name:'每周取得 3 次胜利',target:3,counter:'victories',points:40,destination:'battle'},
  {id:'weekly-upgrades',name:'每周完成 5 次强化',target:5,counter:'upgrades',points:30,destination:'equipment'},
];
const names={925:'角色箱',926:'角色箱碎片',113:'普通装备箱券',112:'高级装备箱券',1:'金币',2:'钻石'};
const safe=n=>Number.isSafeInteger(n)&&n>=0;
const date=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value);
const pilotName=row=>nativePilotDisplayName(row.id)||row.name;
const maxStar=row=>Math.max(...row.stages.map(stage=>stage.star));
function weekStart(day) {
  const time=new Date(day+'T00:00:00Z');
  time.setUTCDate(time.getUTCDate()-(time.getUTCDay()+6)%7);
  return time.toISOString().slice(0,10);
}
function history(raw,box=false) {
  if(!Array.isArray(raw))throw Error('补给记录无效');
  return raw.slice(-50).map(row=>{
    if(!row||!safe(row.at)||row.at>8.64e15||!safe(row.cost)||(box?!isItemUseBatchCount(row.count):![1,10].includes(row.count))||!Array.isArray(row.results)||row.results.length!==row.count)throw Error('补给记录无效');
    return {...row,results:row.results.map(r=>{
      if(!r||typeof r.name!=='string'||!safe(r.amount)||r.amount<1)throw Error('补给奖励记录无效');
      return {...r,name:r.name.slice(0,100)};
    })};
  });
}
function ledger(raw,time) {
  const today=flightDay(time),week=weekStart(today);
  const l=structuredClone(raw??{version:1,total:0,newbieTenClaimed:false,history:[],boxOpened:0,boxMisses:0,
    boxHistory:[],cardCredits:0,daily:{day:today,battles:0,claimed:[],activityClaimed:false,ads:0},
    week:{start:week,activeDays:[],claimed:false}});
  l.directRecruit??={ssr:0,ur:0,total:0};
  // Older direct-only records guarantee a character on every draw, so their
  // character miss count is exactly zero; retain existing high-rarity pity.
  l.directRecruit.pilot??=0;
  if(![l.directRecruit.pilot,l.directRecruit.ssr,l.directRecruit.ur,l.directRecruit.total].every(safe)||l.directRecruit.pilot>=10||l.directRecruit.ssr>=30||l.directRecruit.ur>=70)throw Error('招募保底记录无效');
  // Preserve points already earned under the previous three-task schedule.
  if(l.daily&&l.daily.taskVersion===undefined){
    const claimed=Array.isArray(l.daily.claimed)?l.daily.claimed:[];
    l.daily.taskVersion=2;
    l.daily.activityOffset=(claimed.includes('battle1')?20:0)+(claimed.includes('battle3')?20:0);
  }
  if(l.daily){l.daily.victories??=0;l.daily.upgrades??=0;l.daily.recruits??=0;}
  if(l.week){l.week.battles??=0;l.week.victories??=0;l.week.upgrades??=0;}
  // New one-time resource reward; existing daily claims and all granted pilots survive.
  l.introBattleRewardClaimed ??= false;
  if(typeof l.introBattleRewardClaimed!=='boolean')throw Error('新手出击奖励记录无效');
  if(l.version!==1||![l.total,l.boxOpened,l.boxMisses,l.cardCredits].every(safe)||l.boxMisses>4||
    typeof l.newbieTenClaimed!=='boolean'||!date(l.daily?.day)||!safe(l.daily.battles)||!safe(l.daily.ads)||l.daily.ads>2||
    l.daily.taskVersion!==2||!safe(l.daily.activityOffset)||l.daily.activityOffset>40||
    ![l.daily.victories,l.daily.upgrades,l.daily.recruits].every(safe)||
    !Array.isArray(l.daily.claimed)||new Set(l.daily.claimed).size!==l.daily.claimed.length||l.daily.claimed.some(id=>!tasks.some(t=>t.id===id))||
    typeof l.daily.activityClaimed!=='boolean'||!date(l.week?.start)||!Array.isArray(l.week.activeDays)||
    l.week.activeDays.length>7||new Set(l.week.activeDays).size!==l.week.activeDays.length||l.week.activeDays.some(d=>!date(d)||weekStart(d)!==l.week.start)||
    ![l.week.battles,l.week.victories,l.week.upgrades].every(safe)||
    typeof l.week.claimed!=='boolean')throw Error('驾驶员补给存档无效，旧记录已保留');
  // New independent claim slots preserve all previous supply claims and pity.
  for(const [period,kind] of [['daily','guns'],['week','skins']]){
    const record=l[period];record.collectionChoice??=null;
    if(record.collectionChoice!==null&&record.collectionChoice!==0
      &&!catalog[kind].some(row=>row.id===record.collectionChoice))throw Error('收藏自选领取记录无效');
    record.collectionCount??=record.collectionChoice===null?0:1;
    if(!Number.isSafeInteger(record.collectionCount)||record.collectionCount<0||record.collectionCount>(period==='daily'?1:5)
      ||(record.collectionCount===0)!==(record.collectionChoice===null))throw Error('收藏自选名额记录无效');
  }
  l.history=history(l.history);l.boxHistory=history(l.boxHistory,true);
  if(today<l.daily.day||week<l.week.start)throw Error('日期异常，请恢复设备日期');
  if(today>l.daily.day)l.daily={day:today,battles:0,victories:0,upgrades:0,recruits:0,taskVersion:2,activityOffset:0,claimed:[],activityClaimed:false,ads:0,collectionChoice:null};
  if(week>l.week.start)l.week={start:week,activeDays:[],claimed:false,battles:0,victories:0,upgrades:0,collectionChoice:null};
  normalizeGrowthSupplyClaims(l);
  return l;
}
export function addPilotSupplyCredits(raw,time,amount) {
  if(!Number.isSafeInteger(amount)||amount<0)throw Error('满星重复积分数量无效');
  const l=ledger(raw,time);l.cardCredits+=amount;
  if(!safe(l.cardCredits))throw Error('满星重复积分数量超限');
  return l;
}
const counter=value=>safe(value)?value:0;
function taskCount(task,l,external={},weekly=false) {
  if(task.counter==='login')return 1;
  const period=weekly?l.week:l.daily;
  const legacyKey=task.counter==='battles'?'sorties':task.counter;
  const history=task.counter==='recruits'&&!weekly
    ? l.history.filter(row=>flightDay(row.at)===l.daily.day).reduce((sum,row)=>sum+row.count,0):0;
  return Math.max(counter(period[task.counter]),counter(external[legacyKey]),history);
}
function weeklyTaskView(l,external={}) {
  const rows=weekTasks.map(task=>({...task,progress:Math.min(task.target,taskCount(task,l,external,true))}));
  const objectivePoints=rows.filter(task=>task.progress>=task.target).reduce((sum,task)=>sum+task.points,0);
  return {rows,points:Math.min(100,Math.max(objectivePoints,l.week.activeDays.length*20))};
}
export function recordPilotSupplyBattle(raw,time,{won=false,taskCounters={}}={}) {
  const l=ledger(raw,time),daily=taskCounters.daily||{},weekly=taskCounters.weekly||{};
  l.daily.battles=Math.max(l.daily.battles,counter(daily.sorties))+1;
  l.week.battles=Math.max(l.week.battles,counter(weekly.sorties))+1;
  if(won){
    l.daily.victories=Math.max(l.daily.victories,counter(daily.victories))+1;
    l.week.victories=Math.max(l.week.victories,counter(weekly.victories))+1;
  }
  if(![l.daily.battles,l.week.battles,l.daily.victories,l.week.victories].every(safe))throw Error('出击次数超限');
  return l;
}
export function recordPilotSupplyUpgrade(raw,time,amount=1,{taskCounters={}}={}) {
  if(!safe(amount)||amount<1)throw Error('强化次数无效');
  const l=ledger(raw,time),daily=taskCounters.daily||{},weekly=taskCounters.weekly||{};
  l.daily.upgrades=Math.max(l.daily.upgrades,counter(daily.upgrades))+amount;
  l.week.upgrades=Math.max(l.week.upgrades,counter(weekly.upgrades))+amount;
  if(![l.daily.upgrades,l.week.upgrades].every(safe))throw Error('强化次数超限');
  return l;
}
function points(l){return Math.min(100,l.daily.activityOffset+tasks.filter(t=>l.daily.claimed.includes(t.id)).reduce((sum,t)=>sum+t.points,0));}
function ticket(limit) {
  const value=new Uint32Array(1),ceiling=Math.floor(0x100000000/limit)*limit;
  do{crypto.getRandomValues(value);}while(value[0]>=ceiling);
  return value[0]%limit;
}
function itemReward(id,amount) {
  return {id,nativeItemId:id,type:id===1?'coins':'nativeItem',amount,
    name:nativeItemDisplayName(id)||names[id]||catalog.itemNames[id]||'装备图纸',image:nativeItemArt(id)};
}
// Direct draws were appended after the legacy box pool and have their own
// draw counter. Keep the full saved ledger; expose only complete direct batches.
function directRecruitHistory(l) {
  let remaining=Math.min(l.total,l.directRecruit.total);
  const recent=[];
  for(let i=l.history.length-1;i>=0&&remaining>0;i--){
    const row=l.history[i];
    if(row.count>remaining||row.results.some(r=>[925,926].includes(Number(r.nativeItemId??r.id))||/角色箱/.test(r.name)))break;
    recent.push(row);remaining-=row.count;
  }
  return recent.reverse();
}
export function pilotSupplySnapshot(raw,rawInventory,rawProgression,time,campaign={},taskCounters={}) {
  const l=ledger(raw,time),inventory=validateReplicaInventory(rawInventory),progression=validateReplicaProgression(rawProgression);
  const missing=roster.filter(row=>!progression.pilots.some(p=>p.id===row.id&&p.active));
  const weekly=weeklyTaskView(l,taskCounters.weekly);
  return {revision:inventory.revision,history:l.history,directHistory:directRecruitHistory(l),boxHistory:l.boxHistory,development:UNLOCK_ALL_CONTENT,
    collection:collectionSupplySnapshot(progression,inventory,l,campaign),
    growth:growthSupplySnapshot(progression,inventory,l,campaign),
    pool:{id:'pilot',mixed:false,direct:true,originLabel:'驾驶员招募',development:UNLOCK_ALL_CONTENT,
      singleCost:UNLOCK_ALL_CONTENT?0:100,tenCost:UNLOCK_ALL_CONTENT?0:1000,totalPulls:l.total,directTotalPulls:l.directRecruit.total,
      probabilities:{pilot:.2,coins:.4,basicKey:.2,blueprint:.15,advancedKey:.05},
      probabilityLabels:{pilot:'驾驶员',coins:'金币 ×1000',basicKey:'普通箱券 ×1',blueprint:'随机装备图纸 ×10',advancedKey:'高级箱券 ×1'},
      rarityProbabilities:DIRECT_RECRUIT_RATES,
      resources:DIRECT_RECRUIT_RESOURCES.map(r=>({...r,image:nativeItemArt(r.id==='blueprint'?105:r.id)})),
      pity:{pilot:l.directRecruit.pilot,ssr:l.directRecruit.ssr,ur:l.directRecruit.ur},
      pityDetails:[{id:'pilot',triggerAt:10},{id:'ssr',triggerAt:30},{id:'ur',triggerAt:70}],
      guaranteeText:'10抽内必得驾驶员 · 30抽内SSR及以上 · 70抽内UR',
      duplicateText:'重复驾驶员转为对应碎片 ×50。',
      rules:['单次100钻石，十次1000钻石。','基础概率：驾驶员20%、金币40%、普通箱券20%、随机装备图纸15%、高级箱券5%。',
        '驾驶员稀有度条件概率：R／SR／SSR／UR为74%／20%／5%／1%。',
        '10抽内必得驾驶员；30抽内必得SSR或UR，70抽内必得UR。单抽与十连共享保底；UR同时重置三项计数。',
        '首次获得激活驾驶员；重复驾驶员转为对应碎片，可在背包合成同名卡。']},
    candidates:roster.map(row=>({id:row.id,skinId:NATIVE_PILOT_SKINS[row.id],name:pilotName(row),
      owned:progression.pilots.some(p=>p.id===row.id&&p.active),
      copies:inventory.items[row.id]||0,maxed:progression.pilots.some(p=>p.id===row.id&&p.active&&p.star>=maxStar(row))})),
    exchanges:exchangeRoster.map(row=>({id:row.id,name:pilotName(row),
      owned:progression.pilots.some(p=>p.id===row.id&&p.active),copies:inventory.items[row.id]||0,
      maxed:pilotAtMaxStar(progression,row.id)})),creditCost:PILOT_CREDIT_COST,
    box:{count:inventory.items[925]||0,fragments:inventory.items[926]||0,required:50,opened:l.boxOpened,
      missing:missing.length,remaining:missing.length?(l.boxOpened<2?1:5-l.boxMisses):null,credits:l.cardCredits},
    tasks:tasks.map(t=>{const progress=Math.min(t.target,taskCount(t,l,taskCounters.daily));return {...t,rewards:t.rewards.map(r=>itemReward(r.id,r.amount)),introRewards:t.id==='battle1'&&!l.introBattleRewardClaimed?INTRO_BATTLE_REWARDS.map(r=>itemReward(r.id,r.amount)):[],starterName:t.starter&&!progression.pilots.some(p=>p.id===t.starter&&p.active)?nativePilotDisplayName(t.starter):null,progress,claimed:l.daily.claimed.includes(t.id),
      canClaim:!l.daily.claimed.includes(t.id)&&(UNLOCK_ALL_CONTENT||progress>=t.target)};}),
    activity:{rewards:PILOT_DAILY_ACTIVITY_REWARDS.map(r=>itemReward(r.id,r.amount)),points:points(l),claimed:l.daily.activityClaimed,canClaim:!l.daily.activityClaimed&&points(l)>=100},
    ad:{count:l.daily.ads,limit:2,canClaim:l.daily.ads<2,rewards:PILOT_AD_REWARDS.map(r=>itemReward(r.id,r.amount))},
    week:{rewards:PILOT_WEEKLY_ACTIVITY_REWARDS.map(r=>itemReward(r.id,r.amount)),days:l.week.activeDays.length,points:weekly.points,tasks:weekly.rows,claimed:l.week.claimed,canClaim:!l.week.claimed&&(UNLOCK_ALL_CONTENT||weekly.points>=100)}};
}
export function planPilotSupply(rawProgression,rawInventory,rawRecord,operation,time,{adCompleted=false,campaign={},taskCounters={},randomTicket=ticket}={}) {
  const inventory=validateReplicaInventory(rawInventory),progression=validateReplicaProgression(rawProgression),l=ledger(rawRecord,time);
  if(operation.expectedRevision!==inventory.revision)throw Error('库存已更新，请重新操作');
  const rewards=[];
  const add=(id,count)=>{inventory.items[id]=(inventory.items[id]||0)+count;rewards.push(itemReward(id,count));};
  const debit=(id,count)=>{
    if(!safe(count))throw Error('消耗数量无效');
    const balance=inventory.items[id]??0;
    if(balance<count)throw Error(id===2?'钻石不足':id===925?'角色箱不足':id===926?'角色箱碎片不足':'同名卡数量不足');
    // Fresh normal inventories have no diamond entry. A free order must not
    // turn an absent balance into NaN before the reward transaction is saved.
    if(count>0)inventory.items[id]=balance-count;
  };
  let title='获得奖励',cost=0,taskActivityOnly=false,taskActivityPoints=0;
  if(operation.action==='draw') {
    const count=operation.count;if(![1,10].includes(count))throw Error('请选择单次或十次招募');
    cost=UNLOCK_ALL_CONTENT?0:count*100;debit(2,cost);
    for(let i=0;i<count;i++){
      const pity=l.directRecruit;
      const forced=pity.pilot>=9||pity.ssr>=29||pity.ur>=69;
      const bucket=forced?0:randomTicket(100);
      if(bucket<DIRECT_RECRUIT_PILOT_WEIGHT){
        const roll=randomTicket(10000)/10000;
        const rarity=pity.ur>=69?'UR':pity.ssr>=29?(roll<5/6?'SSR':'UR'):
          roll<.74?'R':roll<.94?'SR':roll<.99?'SSR':'UR';
        const candidates=roster.filter(row=>recruitRarity(row)===rarity);
        const unfinished=candidates.filter(row=>!pilotAtMaxStar(progression,row.id));
        const pool=unfinished.length?unfinished:candidates;
        const row=pool[randomTicket(pool.length)];
        if(!row)throw Error('招募奖池配置无效');
        const owned=progression.pilots.find(p=>p.id===row.id&&p.active);
        if(!owned){
          const grant=grantPilotCards(inventory,progression,row.id,1,{activate:true});
          rewards.push({type:'pilot',id:NATIVE_PILOT_SKINS[row.id],nativeId:row.id,name:pilotName(row),amount:1,rarity,...grant,nativeRecruit:true});
        }else{
          // One same-name card is exactly one configured fragment bundle.
          // Store fragments atomically; the presentation only animates the receipt.
          const fragment=pilotFragmentForPilot(row.id);
          if(!fragment)throw Error('驾驶员碎片配置缺失');
          const balance=(inventory.items[fragment.id]||0)+fragment.cost;
          if(!safe(balance))throw Error('驾驶员碎片数量超限');
          inventory.items[fragment.id]=balance;
          const convertedFragment=itemReward(fragment.id,fragment.cost);
          // Resolve artwork from the canonical item ID in the current runtime;
          // never persist an absolute URL tied to a preview server's port.
          delete convertedFragment.image;
          rewards.push({type:'pilot',id:NATIVE_PILOT_SKINS[row.id],nativeId:row.id,name:pilotName(row),amount:1,rarity,
            isNew:false,stars:owned.star,nativeRecruit:true,convertedFragment});
        }
        pity.pilot=0;
        pity.ssr=['SSR','UR'].includes(rarity)?0:pity.ssr+1;
        pity.ur=rarity==='UR'?0:pity.ur+1;
      }else{
        let cursor=bucket-DIRECT_RECRUIT_PILOT_WEIGHT;
        const resource=DIRECT_RECRUIT_RESOURCES.find(r=>(cursor-=r.weight)<0);
        if(!resource)throw Error('招募资源配置无效');
        add(resource.id==='blueprint'?blueprints[randomTicket(blueprints.length)]:resource.id,resource.amount);
        pity.pilot++;pity.ssr++;pity.ur++;
      }
      pity.total++;
    }
    l.total+=count;l.daily.recruits+=count;title='驾驶员招募结果';
    l.history.push({at:time,count,cost,results:structuredClone(rewards)});l.history=l.history.slice(-50);
  }else if(operation.action==='compose') {
    const count=operation.count??1;
    if(!Number.isSafeInteger(count)||count<1||!safe(count*50))throw Error('合成数量无效');
    debit(926,count*50);add(925,count);title='角色箱合成完成';
  }else if(operation.action==='open') {
    const count=operation.count;if(!isItemUseBatchCount(count))throw Error(`每批可开启 1～${ITEM_USE_BATCH_LIMIT} 个角色箱`);
    debit(925,count);
    for(let i=0;i<count;i++){
      const missing=roster.filter(row=>!progression.pilots.some(p=>p.id===row.id&&p.active));
      const pool=missing.length&&(l.boxOpened<2||l.boxMisses>=4)?missing:roster;
      const row=pool[ticket(pool.length)],owned=progression.pilots.find(p=>p.id===row.id),isNew=!owned?.active;
      if(isNew)l.boxMisses=0;
      else if(missing.length)l.boxMisses++;else l.boxMisses=0;
      const grant=grantPilotCards(inventory,progression,row.id,1,{activate:true});
      l.cardCredits+=grant.creditsAdded;
      rewards.push({type:'pilot',id:NATIVE_PILOT_SKINS[row.id],nativeId:row.id,name:pilotName(row),amount:1,
        ...grant,nativeRecruit:true});
      l.boxOpened++;
    }
    l.boxHistory.push({at:time,count,cost:0,results:structuredClone(rewards)});l.boxHistory=l.boxHistory.slice(-50);title='角色箱开启结果';
  }else if(operation.action==='growth') {
    const result=claimGrowthSupply(progression,inventory,l,campaign,operation);
    rewards.push(...result.rewards);title=result.title;
  }else if(operation.action==='collection') {
    const result=claimCollectionSupply(progression,inventory,l,operation,campaign);
    rewards.push(...result.rewards);title=result.title;
  }else if(operation.action==='task') {
    const task=tasks.find(t=>t.id===operation.id);
    if(!task||l.daily.claimed.includes(task.id)||!UNLOCK_ALL_CONTENT&&taskCount(task,l,taskCounters.daily)<task.target)throw Error('任务未完成或已领取');
    const beforePoints=points(l);
    l.daily.claimed.push(task.id);task.rewards.forEach(r=>add(r.id,r.amount));taskActivityPoints=points(l)-beforePoints;
    if(task.id==='battle1'&&!l.introBattleRewardClaimed){
      INTRO_BATTLE_REWARDS.forEach(r=>add(r.id,r.amount));l.introBattleRewardClaimed=true;
    }
    // Only the base pilot is granted at login; other pilots keep their acquisition routes.
    if(task.starter&&!progression.pilots.some(p=>p.id===task.starter&&p.active)){
      const row=catalog.pilots.find(p=>p.id===task.starter);
      grantPilotCards(inventory,progression,row.id,1,{activate:true});
      rewards.push({type:'pilot',id:NATIVE_PILOT_SKINS[row.id],nativeId:row.id,name:pilotName(row),
        amount:1,isNew:true,stars:row.defaultStar,nativeRecruit:true});
    }
    taskActivityOnly=rewards.length===0;
  }else if(operation.action==='activity') {
    if(l.daily.activityClaimed||points(l)<100)throw Error('请先领取每日任务，达到 100 活跃');
    l.daily.activityClaimed=true;PILOT_DAILY_ACTIVITY_REWARDS.forEach(r=>add(r.id,r.amount));
    if(!l.week.activeDays.includes(l.daily.day))l.week.activeDays.push(l.daily.day);
  }else if(operation.action==='weekly') {
    if(l.week.claimed||!UNLOCK_ALL_CONTENT&&weeklyTaskView(l,taskCounters.weekly).points<100)throw Error('每周活跃未达 100，或奖励已领取');
    l.week.claimed=true;PILOT_WEEKLY_ACTIVITY_REWARDS.forEach(r=>add(r.id,r.amount));
  }else if(operation.action==='ad'||operation.action==='devAd') {
    if(l.daily.ads>=2||!(operation.action==='devAd'?UNLOCK_ALL_CONTENT:adCompleted))throw Error('广告未完整完成或今日次数已用完');
    l.daily.ads++;PILOT_AD_REWARDS.forEach(r=>add(r.id,r.amount));
  }else if(operation.action==='convertCopies') {
    const count=operation.count;
    if(!exchangeRoster.some(row=>row.id===operation.id)||!pilotAtMaxStar(progression,operation.id))throw Error('仅已满星驾驶员的同名卡可转换积分');
    if(!Number.isSafeInteger(count)||count<1)throw Error('转换数量无效');
    debit(operation.id,count);l.cardCredits+=count;
    rewards.push(pilotCreditReward(count,operation.id));title='满星同名卡转换完成';
  }else if(operation.action==='exchangeKey') {
    if(!UNLOCK_ALL_CONTENT&&l.cardCredits<PILOT_CREDIT_COST)throw Error('需 3 个满星重复积分');
    if(!UNLOCK_ALL_CONTENT)l.cardCredits-=PILOT_CREDIT_COST;
    add(112,1);title='积分兑换完成';
  }else if(operation.action==='exchange') {
    const row=exchangeRoster.find(r=>r.id===operation.id),owned=progression.pilots.find(p=>p.id===row?.id&&p.active);
    if(!row||owned&&owned.star>=maxStar(row)||!UNLOCK_ALL_CONTENT&&l.cardCredits<PILOT_CREDIT_COST)throw Error('需 3 个积分并选择未拥有或未满星的驾驶员');
    if(!UNLOCK_ALL_CONTENT)l.cardCredits-=PILOT_CREDIT_COST;
    // Local compatibility: the same 3-credit exchange also grants the first
    // card. This closes acquisition for open pilots outside the role-box pool.
    const grant=grantPilotCards(inventory,progression,row.id,1,{activate:true});
    l.cardCredits+=grant.creditsAdded;
    rewards.push({type:'pilot',id:NATIVE_PILOT_SKINS[row.id],nativeId:row.id,
      name:pilotName(row),amount:1,...grant,nativeRecruit:true});
    title=grant.isNew?'指定驾驶员解锁完成':'驾驶员同名卡兑换完成';
  }else throw Error('未知补给操作');
  inventory.revision++;
  if(![l.total,l.boxOpened,l.cardCredits,l.daily.recruits,l.directRecruit.total].every(safe))throw Error('补给数量超限');
  return {pilotSupply:true,inventory:validateReplicaInventory(inventory),progression:validateReplicaProgression(progression),
    ledger:l,rewards,title,...(taskActivityOnly?{taskActivityOnly:true,taskActivityPoints}:{}),...(['open','draw'].includes(operation.action)?{recruitPool:'pilot'}:{}),...(operation.action==='draw'?{isRecruitDraw:true}:{})};
}
