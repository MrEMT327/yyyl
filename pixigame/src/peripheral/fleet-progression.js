import { AIRCRAFTS } from '../pilots.js';
import { sanitizeFleetSkillSlots } from './fleet-skills.js';

const ids=AIRCRAFTS.map(p=>p.id),known=new Set(ids);
const count=value=>Math.max(0,Math.min(999,Math.floor(Number(value)||0)));
const roster=value=>[...new Set((Array.isArray(value)?value:[]).filter(id=>known.has(id)))];
const counts=value=>Object.fromEntries(ids.map(id=>[id,count(value?.[id])]));
export const FLEET_MAX_STARS=5;

export function sanitizeFleetProgress(value,{ownedPilots=[],ownedAircraft=[],pilotId='pilot-01'}={}) {
  const old=value&&typeof value==='object'?value:null;
  const activePilots=roster(old?.ownedPilots||ownedPilots);
  const pendingPilot=roster(old?.pending?.pilot).filter(id=>!activePilots.includes(id));
  const pendingAircraft=roster(old?.pending?.aircraft);
  const stars=Object.fromEntries(ids.map(id=>[id,old?.aircraftStars?.[id]!=null
    ? Math.min(5,count(old.aircraftStars[id])) : ownedAircraft.includes(id)&&!pendingAircraft.includes(id)?1:0]));
  return {version:1,mode:old?.mode==='automatic'?'automatic':'manual',revision:Math.max(0,Math.min(1e9,Math.floor(Number(old?.revision)||0))),
    ownedPilots:activePilots,pending:{pilot:pendingPilot,aircraft:pendingAircraft},
    copies:{pilot:counts(old?.copies?.pilot),aircraft:counts(old?.copies?.aircraft)},aircraftStars:stars,
    ...(old?.recruitPresentation?.pool==='pilot'&&Array.isArray(old.recruitPresentation.rewards)?{recruitPresentation:{token:String(old.recruitPresentation.token||'').slice(0,100),pool:'pilot',rewards:structuredClone(old.recruitPresentation.rewards.slice(0,10))}}:{}),
    skills:{pilot:sanitizeFleetSkillSlots(old?.skills?.pilot??[pilotId,null,null]),
      aircraft:sanitizeFleetSkillSlots(old?.skills?.aircraft??[])} };
}

export function collectFleetRecruit(fleet,rewards,{pilotStars={},ownedPilots=[],ownedAircraft=[]}={}) {
  const next=structuredClone(fleet),seenPilots=new Set([...ownedPilots,...next.ownedPilots,...next.pending.pilot]);
  const seenAircraft=new Set([...ownedAircraft,...next.pending.aircraft]);
  const result=rewards.map(raw=>{
    if(!raw.pilotId)return {...raw};
    const id=raw.pilotId;if(!known.has(id))return {...raw};
    const stars=Math.min(5,count(pilotStars[id]));
    const reward={...raw,manualCards:true,beforeStars:stars,stars};
    if(raw.type==='pilot') {
      if(!seenPilots.has(id))next.pending.pilot.push(id);
      seenPilots.add(id);
      next.copies.pilot[id]=Math.min(5-stars,next.copies.pilot[id]+1);
      reward.beforeStars=stars;reward.stars=stars;reward.copiesAdded=1;
      reward.copies=next.copies.pilot[id];reward.requiresActivation=next.pending.pilot.includes(id);
      reward.name=`${raw.pilotName||AIRCRAFTS.find(p=>p.id===id).name} · 同名卡 ×1`;
    }else if(raw.type==='aircraftShards') {
      reward.name=`${raw.pilotName||AIRCRAFTS.find(p=>p.id===id).name} · 同名卡已足 · 飞机碎片 ×${raw.amount}`;
    }
    const frameStars=next.aircraftStars[id];
    if(!seenAircraft.has(id))next.pending.aircraft.push(id);
    seenAircraft.add(id);
    if(frameStars+next.copies.aircraft[id]<5) {
      next.copies.aircraft[id]++;reward.aircraftCopiesAdded=1;
    }
    return reward;
  });
  next.revision++;
  return {fleet:next,rewards:result};
}

// Each operation is one peripheral-save mutation. Callers persist the returned
// state before publishing it; a failed write must leave the old state intact.
export function planFleetAction(fleet,pilotStars,{kind,id,operation,slot,revision,owned=false,temporary=false}={}) {
  const fail=message=>({ok:false,message});
  if(!['pilot','aircraft'].includes(kind))return fail('未知类别');
  if(revision!=null&&Number(revision)!==fleet.revision)return fail('页面已更新，请重新操作');
  if((operation!=='unequip'||id!=null)&&!known.has(id))return fail('未知对象');
  const next=structuredClone(fleet),stars={...pilotStars};
  if(operation==='equip'||operation==='unequip') {
    const index=Number(slot);
    if(!['number','string'].includes(typeof slot)||slot===''||!Number.isInteger(index)||index<0||index>=3)return fail('请选择技能位置');
    if(operation==='equip') {
      if(!id||!owned)return fail('激活后才能携带该技能');
      next.skills[kind]=next.skills[kind].map(v=>v===id?null:v);
      next.skills[kind][index]=id;
    }else {
      if(id&&next.skills[kind][index]!==id)return fail('技能位置已变化');
      next.skills[kind][index]=null;
    }
    next.revision++;
    return {ok:true,fleet:next,pilotStars:stars,message:operation==='equip'?'技能已装备':'技能已卸下'};
  }
  if(operation==='activate') {
    if(owned&&!temporary)return fail('已激活');
    if(next.copies[kind][id]<1)return fail('同名卡不足');
    next.copies[kind][id]--;
    next.pending[kind]=next.pending[kind].filter(v=>v!==id);
    if(kind==='pilot') {if(!next.ownedPilots.includes(id))next.ownedPilots.push(id);stars[id]=Math.max(1,count(stars[id]));}
    else next.aircraftStars[id]=Math.max(1,next.aircraftStars[id]);
    next.revision++;
    return {ok:true,fleet:next,pilotStars:stars,message:'激活成功',previousStars:0,stars:1};
  }
  if(operation==='starUp') {
    if(!owned||temporary)return fail('请先激活');
    const current=kind==='pilot'?count(stars[id]):next.aircraftStars[id];
    if(current>=5)return fail('已满星');
    if(next.copies[kind][id]<1)return fail('同名卡不足');
    next.copies[kind][id]--;
    if(kind==='pilot')stars[id]=current+1;else next.aircraftStars[id]=current+1;
    next.revision++;
    return {ok:true,fleet:next,pilotStars:stars,message:'升星成功',previousStars:current,stars:current+1};
  }
  return fail('未知操作');
}
