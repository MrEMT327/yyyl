import { AIRCRAFTS } from '../pilots.js';
import { pilotPassive } from './pilot-growth.js';

export const FLEET_SKILL_SLOT_COUNT = 3;
export const FLEET_FILTERS = Object.freeze([
  {id:'all',label:'全部'}, {id:'ballistic',label:'机炮'},
  {id:'explosive',label:'爆破'}, {id:'electromagnetic',label:'电磁'},
  {id:'energy',label:'能量'}, {id:'drone',label:'无人机'},
]);
const categories=['ballistic','drone','ballistic','ballistic','explosive','electromagnetic','electromagnetic','energy','explosive','energy'];
const icons=['skill-gravity','skill-shield','skill-ballistic','skill-ballistic','skill-explosive','skill-rail','skill-lightning','skill-laser','skill-explosive','skill-shield'];
const byId=new Map(AIRCRAFTS.map((p,index)=>[p.id,{...p,category:categories[index],skillIcon:icons[index]}]));
const number=value=>Number(Number(value).toFixed(2));
const percent=value=>number(value*100);

export function sanitizeFleetSkillSlots(value,allowed=()=>true) {
  const used=new Set();
  return Array.from({length:FLEET_SKILL_SLOT_COUNT},(_,index)=>{
    const id=Array.isArray(value)?value[index]:null;
    if(!byId.has(id)||used.has(id)||!allowed(id))return null;
    used.add(id);return id;
  });
}

// Reuse this game's implemented aircraft abilities. Stars strengthen their
// existing payload; firing intervals, projectile floors and immunity caps stay
// explicit rather than inventing a second set of attacks for the catalog.
export function aircraftSkillAbility(id,stars=1) {
  const p=byId.get(id);if(!p)return null;
  const rank=Math.max(0,Math.min(5,Math.floor(Number(stars)||0)));
  const strength=[1,1,1.15,1.3,1.6,1.8][rank];
  const a=structuredClone(p.ability);
  for(const key of ['damage','damageRatio','ratio','fullHealthShieldRatio','duration','chance','multiplier','radius']) {
    if(typeof a[key]==='number')a[key]=number(a[key]*strength);
  }
  if(a.type==='critical')a.chance=Math.min(a.globalChanceCap,a.chance);
  return a;
}

export function describeAircraftSkill(a) {
  if(!a)return '';
  if(a.type==='phase')return `每${a.interval}秒进入${a.duration}秒相位，期间免疫伤害，可穿越普通敌机和障碍物。`;
  if(a.type==='heal')return `每${a.interval}秒恢复${percent(a.ratio)}%最大耐久；满耐久时获得${percent(a.fullHealthShieldRatio)}%护盾，持续${a.shieldDuration}秒。`;
  if(a.type==='missile')return `每${a.interval}秒发射${a.count}枚追踪导弹，基础伤害${a.damage}，命中产生范围爆炸。`;
  if(a.type==='critical')return `暴击率提高${percent(a.chance)}%，暴击伤害提高${percent(a.multiplier)}%。总暴击率上限${percent(a.globalChanceCap)}%。`;
  if(a.type==='minimum-direct-shots')return `普通直射武器不足${a.minimumShots}条弹道时补足为${a.minimumShots}发，每发造成${percent(a.damageRatio)}%攻击力伤害。`;
  if(a.type==='side-shot')return `主炮射击时，左右各发射1枚横向穿透弹，每枚造成${percent(a.damage)}%攻击力伤害。`;
  if(a.type==='sanctuary')return `每${a.interval}秒清除周围弹幕，获得${a.immunityCharges}次伤害免疫，最多储存${a.maxStoredCharges}次。`;
  return '';
}

export function fleetSkillDefinition(kind,item) {
  const p=byId.get(item?.id);if(!p)return null;
  const stars=Math.max(0,Math.min(5,Math.floor(Number(item.stars)||0)));
  const passive=kind==='pilot'?pilotPassive(p.id,stars):null;
  const ability=kind==='aircraft'?aircraftSkillAbility(p.id,stars):null;
  return {id:p.id,kind,name:passive?.name||p.skillName,ownerName:kind==='aircraft'?item.aircraftName||item.name||p.aircraft:item.name||p.name,
    stars,category:p.category,icon:p.skillIcon,owned:Boolean(item.owned),temporary:Boolean(item.temporaryUnlocked),
    description:passive?.description||describeAircraftSkill(ability),modifiers:passive?.modifiers||{},ability};
}

export function fleetSkillSnapshot(kind,items,slots) {
  const list=items.map(item=>fleetSkillDefinition(kind,item)).filter(Boolean);
  const available=new Set(list.filter(s=>s.owned).map(s=>s.id));
  const equipped=sanitizeFleetSkillSlots(slots,id=>available.has(id));
  return {slots:equipped,skills:list.map(s=>({...s,slot:equipped.indexOf(s.id)}))};
}

export function mergePilotSkillModifiers(skills) {
  const result={};
  for(const skill of skills)for(const [key,value] of Object.entries(skill.modifiers||{})) {
    if(key.endsWith('Multiplier'))result[key]=(result[key]??1)*value;
    else if(key.endsWith('Interval'))result[key]=Math.min(result[key]??Infinity,value);
    else if(key.endsWith('Duration'))result[key]=Math.max(result[key]??0,value);
    else if(key==='shieldMaxHpRatio')result[key]=Math.max(result[key]??0,value);
    else result[key]=(result[key]??0)+value;
  }
  for(const key of Object.keys(result))result[key]=Number(result[key].toFixed(6));
  return result;
}

export function fleetCriticalModifiers(abilities) {
  const result={};
  for(const a of abilities)if(a?.type==='critical') {
    result.critChance=(result.critChance||0)+a.chance;
    result.critMultiplierBonus=(result.critMultiplierBonus||0)+a.multiplier;
    result.critChanceCap=Math.min(result.critChanceCap??1,a.globalChanceCap??1);
  }
  return result;
}
