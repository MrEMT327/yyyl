// Girl Flight acquisition policy, NOT a reconstruction of the native economy.
// Native IDs, star costs and combat skills remain unchanged.
import { nativeItemDisplayName } from './native-item-names.js';
import { grantPilotCards, pilotCreditReward } from './pilot-copy-grants.js';
import catalog from './native-economy-catalog.json' with { type: 'json' };
import acquisition from './native-acquisition-catalog.json' with { type: 'json' };
import { nativeCollectionDisplayName } from './native-collection-names.js';
import { nativeItemArt } from './native-item-presentation.js';

import {STARTER_PLANE,STARTER_PILOT,FLIGHT_SIGNIN,LOCAL_SIGNIN_POLICY_ID} from './local-signin-policy.js';
export {STARTER_PLANE,STARTER_PILOT,FLIGHT_SIGNIN} from './local-signin-policy.js';
const item = (id,count) => ({kind:'item',id,count});
const unit = (kind,id) => ({kind,id,count:1});
// Retired chapter-gift definitions are not a live income source. Historical
// ledger.chapters stays preserved; nativeAcquisition owns chapter rewards.
export const FLIGHT_AD_REWARDS = [item(2,50),item(1,1000)];
export function flightDay(time) {
  if(!Number.isFinite(time))throw new Error('日期无效');
  return new Date(time+8*3600000).toISOString().slice(0,10); // Fixed UTC+8 reset.
}
export function flightLedger(value,legacy={}) {
  const result=structuredClone(value||{version:1,chapters:[],signCount:legacy.claimedCount||0,
    signDay:legacy.lastClaimDay||'',starterPending:(legacy.claimedCount||0)>=2,
    adDay:'',misses:0,total:0,history:[]});
  if(result.version!==1||!Array.isArray(result.chapters)||new Set(result.chapters).size!==result.chapters.length||
    result.chapters.some(x=>!Number.isInteger(x)||x<1||x>50)||
    !Number.isInteger(result.signCount)||result.signCount<0||result.signCount>7||
    !Number.isInteger(result.misses)||result.misses<0||result.misses>=10||
    !Number.isSafeInteger(result.total)||result.total<0||
    ![result.signDay,result.adDay].every(x=>x===''||/^\d{4}-\d{2}-\d{2}$/.test(x)))
    throw new Error('奖励领取记录无效，未覆盖旧记录');
  return result;
}
export function flightRewardView(reward) {
  const row=reward.kind==='item'?null:catalog[reward.kind].find(r=>r.id===reward.id);
  const name=nativeItemDisplayName(reward.id)||({925:'角色箱',926:'角色箱碎片',113:'普通装备箱券'})[reward.id]||nativeCollectionDisplayName(reward.id)||row?.name||catalog.itemNames[reward.id]||acquisition.items.find(r=>r.id===reward.id)?.note||`物品 ${reward.id}`;
  return {...reward,name,
    nativeRow:row,type:reward.kind==='skins'?'aircraft':reward.kind==='pilots'?'pilot':reward.kind==='guns'?'weapon':reward.id===2?'diamonds':reward.id===1?'coins':'nativeItem',
    ...(reward.kind==='item'?{nativeItemId:reward.id,image:nativeItemArt(reward.id)}:{}),
    amount:reward.count,title:`${name} ×${reward.count}`};
}
export function flightRewardsSnapshot(ledger,inventory,campaign,time) {
  const claims=flightLedger(ledger),today=flightDay(time);
  const canSign=claims.starterPending || claims.signCount<7&&today>claims.signDay;
  return {
    revision:inventory.revision,diamonds:inventory.items[2]||0,
    misses:claims.misses,total:claims.total,history:(claims.history||[]).map(row=>({...row,rewards:row.rewards.map(r=>({...r,name:nativeCollectionDisplayName(r.id)||r.name}))})),
    chapters:[], // Compatibility only; use nativeAcquisition.rewards.
    ad:{canClaim:today>claims.adDay,rewards:FLIGHT_AD_REWARDS.map(flightRewardView)},
    signIn:{ruleSource:LOCAL_SIGNIN_POLICY_ID,nativeRewardScheduleKnown:false,today,lastClaimDay:claims.signDay,claimedCount:claims.signCount,
      completed:claims.signCount===7&&!claims.starterPending,canClaim:canSign,starterPending:claims.starterPending,
      supplements:{},days:FLIGHT_SIGNIN.map((rewards,i)=>({day:i+1,...flightRewardView(rewards[0]),
        rewards:rewards.map(flightRewardView),
        title:rewards.map(r=>flightRewardView(r).title).join('、'),
        claimed:i<claims.signCount&&!(claims.starterPending&&i===1),
        active:claims.starterPending?i===1:i===claims.signCount})),
    },
  };
}
function grant(inventory,progression,reward) {
  const view=flightRewardView(reward);
  if(reward.kind==='item') inventory.items[reward.id]=(inventory.items[reward.id]||0)+reward.count;
  else {
    const row=catalog[reward.kind].find(r=>r.id===reward.id);
    if(!row||row.closed)throw new Error('奖励配置不可用');
    const hadActivePlane=reward.kind==='skins'&&progression.skins.some(row=>row.active);
    const old=progression[reward.kind].find(r=>r.id===reward.id);
    if(reward.kind==='pilots'){
      const grant=grantPilotCards(inventory,progression,reward.id,reward.count,{activate:true});
      if(grant.creditsAdded)return pilotCreditReward(grant.creditsAdded,reward.id);
      Object.assign(view,grant);
    } else if(old?.active) {
      // One duplicate is one native copy, usable by the unchanged star cost.
      inventory.items[reward.id]=(inventory.items[reward.id]||0)+reward.count;
      view.name+=' · 升星用重复件';view.isNew=false;
    } else {
      if(old)Object.assign(old,{active:true,star:row.defaultStar});
      else progression[reward.kind].push({id:reward.id,star:row.defaultStar,active:true,equipped:false});
      view.isNew=true;
      if(reward.kind==='skins') {
        if(!hadActivePlane&&!progression.role.skinId){progression.role.skinId=reward.id;progression.role.skinStar=row.defaultStar;}
        const slot=progression.skinSkillSlots.indexOf(0);
        if(slot>=0&&row.stages.find(s=>s.star===row.defaultStar)?.skills.length&&!progression.skinSkillSlots.includes(reward.id))
          progression.skinSkillSlots[slot]=reward.id;
      }
    }
  }
  if(Object.values(inventory.items).some(n=>!Number.isSafeInteger(n)||n<0))throw new Error('库存数量超限');
  return view;
}
export function planFlightReward({ledger,inventory,progression,campaign,time},operation,rng=Math.random) {
  const next={ledger:flightLedger(ledger),inventory:structuredClone(inventory),progression:structuredClone(progression)};
  const l=next.ledger,today=flightDay(time),rewards=[];
  if(operation.revision!==inventory.revision)throw new Error('库存已更新，请重新操作');
  let pilotCreditDelta=0;
  const give=r=>{const view=grant(next.inventory,next.progression,r);pilotCreditDelta+=view.creditsAdded||0;rewards.push(view);};
  if(operation.action==='signin') {
    if(l.starterPending){give(unit('skins',STARTER_PLANE));l.starterPending=false;}
    else {
      if(l.signCount>=7||today<=l.signDay)throw new Error('今日已签到、七日已完成或日期异常');
      FLIGHT_SIGNIN[l.signCount].forEach(give);l.signCount++;l.signDay=today;
    }
  } else if(operation.action==='chapter') {
    throw new Error('旧章节礼包已停用，请前往章节奖励领取');
  } else if(operation.action==='ad') {
    if(!operation.completed||today<=l.adDay)throw new Error('广告未完成、今日已领取或日期异常');
    FLIGHT_AD_REWARDS.forEach(give);l.adDay=today;
  } else if(operation.action==='draw') {
    // Retired custom mixed box: preserve historical receipts, never charge.
    throw new Error('钻石收藏箱已取消，请使用现有宝箱');
  } else throw new Error('未知奖励操作');
  next.inventory.revision++;
  if(!Number.isSafeInteger(next.inventory.revision)||!Number.isSafeInteger(l.total))throw new Error('奖励版本超限');
  return {...next,rewards,pilotCreditDelta};
}
