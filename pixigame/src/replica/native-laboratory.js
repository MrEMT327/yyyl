import catalog from './native-economy-catalog.json' with {type:'json'};
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';

/** Native DTO separates Level and NeedActive. Legacy local records stopped at
 * a milestone with unknown state: resume there without charging that level twice.
 * Earlier milestones are necessarily complete under the native upgrade gate. */
export function nativeLabActivation(entry) {
  const row=catalog.labs.find(row=>row.id===entry.id);
  const level=row?.levels.find(row=>row.level===entry.level);
  if(!level)throw Error('原版实验室等级配置缺失');
  const known=entry.activationKnown===true&&typeof entry.needActive==='boolean';
  const needActive=known?entry.needActive:Boolean(level.skills.length);
  if(needActive&&!level.skills.length)throw Error('非技能节点不能标记为待激活');
  const limit=needActive?entry.level-1:entry.level;
  const saved=entry.confirmedSkillLevel;
  if(saved!==undefined&&(!Number.isSafeInteger(saved)||saved<0||saved>limit))
    throw Error('实验室已确认技能等级记录无效');
  return {activationKnown:true,needActive,confirmedSkillLevel:limit};
}

/** Offline replacement for server-owned initial DTOs, using unlockChapter and
 * the first source level. No draw, purchase or synthetic material fee. */
export function synchronizeNativeLabs(progression,gate) {
  if(!gate.reached)return;
  for(const row of catalog.labs) {
    if(!gate.developmentUnlocked&&gate.reachedChapter<row.unlockChapter)continue;
    let entry=progression.labs.find(entry=>entry.id===row.id);
    if(!entry){
      entry={id:row.id,level:row.levels[0].level,active:true};
      progression.labs.push(entry);
    }
    entry.active=true;
    Object.assign(entry,nativeLabActivation(entry));
  }
}

/** TechnologyManager.IsTechnologyUpLevelAvailable 0x7740198 checks current
 * costs and blocks NeedActive. ActiveTechnologySkill 0x7740528 only checks
 * NeedActive before sending SkillLabActive; no second cost is configured. */
export function advanceNativeLab(progression,inventory,operation,gate) {
  if(!gate.reached)throw Error('通过第6章第5波后开放科研');
  synchronizeNativeLabs(progression,gate);
  const entry=progression.labs.find(row=>row.id===operation.id&&row.active);
  const row=catalog.labs.find(row=>row.id===operation.id);
  if(!entry||!row)throw Error('尚未达到该科研项目的解锁章节');
  if(!gate.developmentUnlocked&&gate.reachedChapter<row.unlockChapter)throw Error(`第${row.unlockChapter}章解锁该科研项目`);
  if(UNLOCK_ALL_CONTENT&&operation.action==='preview-level') {
    const target=row.levels.find(level=>level.level===operation.level);
    if(!target)throw Error('实验室预览等级无效');
    Object.assign(entry,{level:target.level,active:true,activationKnown:true,needActive:false,confirmedSkillLevel:target.level});
    return;
  }
  const state=nativeLabActivation(entry);
  if(operation.action==='activate') {
    if(!state.needActive)throw Error('当前没有待激活的技能');
    Object.assign(entry,{activationKnown:true,needActive:false,confirmedSkillLevel:entry.level});
    return;
  }
  if(operation.action!=='upgrade')throw Error('未知的科研操作');
  if(state.needActive)throw Error('请先激活当前等级的技能');
  const current=row.levels.find(level=>level.level===entry.level);
  const next=row.levels.find(level=>level.id===current.nextId);
  if(!next)throw Error('已达原版实验室最高等级');
  const costs=new Map();
  for(const [id,count]of current.cost)costs.set(id,(costs.get(id)||0)+count);
  for(const [id,count]of costs) {
    if(!Number.isSafeInteger(count)||count<=0)throw Error('科研消耗配置无效');
    if((inventory.items[id]||0)<count)throw Error(id===1?'金币不足':'对应技能图纸不足');
  }
  for(const [id,count]of costs)inventory.items[id]-=count;
  const needActive=Boolean(next.skills.length);
  Object.assign(entry,{level:next.level,activationKnown:true,needActive,
    confirmedSkillLevel:needActive?current.level:next.level});
}
