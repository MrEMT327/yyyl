import { equipmentBoxRules } from './native-equipment-boxes.js';
import { RANDOM_AIRCRAFT } from './native-aircraft-grants.js';
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import source from './native-acquisition-catalog.json' with {type:'json'};
import text from './native-acquisition-labels.json' with {type:'json'};
import { nativeGearPresentation } from './native-item-names.js';
import { nativeCollectionDisplayName } from './native-collection-names.js';
import { localBoxSnapshot } from './local-box-state.js';

// UI_BoxInfoViewModule/DrawBoxButton are previews and payment selection,
// not a client implementation of the server's reward sampler.
function equipmentRateName(group) {
  const entries=group.ItemsProbability.map(([id])=>nativeGearPresentation(id));
  if(!entries.length||entries.some(row=>!row))return null;
  const labels=[...new Set(entries.map(row=>`${row.rank?'圣环系列 · ':''}${row.qualityName}`))];
  return labels.length===1?labels[0]:null;
}
export function nativeEquipmentBoxPreview(items,gear,time=Date.now()) {
  const economy=localBoxSnapshot(gear,time);
  return [4,3].map(id=>{
    const row=source.boxes.find(row=>row.ID===id),keys=items[row.Key_ID]||0;
    let rates=row.DrawBoxRateInfo.map(id=>source.boxRates.find(row=>row.ID===id)).map(group=>({
      id:group.ID,name:equipmentRateName(group)||text.strings[group.TitleNameID]||group.TitleNameID,
      weight:group.ItemsProbability.reduce((sum,item)=>sum+item[2],0),denominator:100000,
      items:group.ItemsProbability.map(([id,count,weight])=>({id,count,weight,name:nativeCollectionDisplayName(id)||text.itemNames[id]||`物品 ${id}`})),
    }));
    // All captured equipment Single arrays have one value. Do not assume
    // singleNum=0 for a future multi-price config with no authoritative DTO.
    const single=row.Single.length===1?row.Single[0]:null;
    const rule=equipmentBoxRules(id);
    if(id===3){
      rates=rates.map(group=>{
        const entries=group.items.map(item=>({...item,weight:rule.items.find(r=>r[0]===item.id)?.[2]||0}));
        return {...group,...(group.id===311?{name:'随机武器'}:{}),items:entries.map(item=>item.id===902?{...item,name:'随机武器（11种等概率）'}:item),weight:entries.reduce((n,r)=>n+r.weight,0)};
      });
      const aircraft=RANDOM_AIRCRAFT.map(row=>{const [,count,weight]=rule.items.find(item=>item[0]===row.id);return {id:row.id,name:row.name,count,weight};});
      rates.push({id:'aircraft',name:'随机飞机',items:aircraft,weight:aircraft.reduce((sum,row)=>sum+row.weight,0),denominator:100000});
    }
    const quotes=[1,10].map(count=>{
      const diamondCost=count===10?row.Ten:single;
      const free=count===1&&economy[id].freeAvailable;
      return {count,payment:free?'free':keys>=count?'key':'diamond',itemId:keys>=count?row.Key_ID:2,
        amount:free?0:keys>=count?count:diamondCost,available:free?1:keys>=count?keys:(items[2]||0),
        canDraw:!economy[id].clockBlocked&&rule.supported&&(free||keys>=count || diamondCost!=null&&(items[2]||0)>=diamondCost),freeStateKnown:true,freeStateSource:economy[id].ruleSource,nativeFreeStateKnown:false};
    });
    return {id,name:id===4?'普通装备箱':'高级装备箱',keyId:row.Key_ID,keys,rates,quotes,
      weightTotal:rates.reduce((sum,row)=>sum+row.weight,0),denominator:100000,
      cumulativeStateKnown:id===4,compatibility:economy[id],canDraw:rule.supported,unavailableReason:rule.reason};
  });
}

// CheckFunctionOpen -> IsChapterMapMaxLevelReached, Function_Function 10.
// This is the configured progress condition, not a fabricated server unlock.
export function nativeLabProgressGate(campaign={}) {
  const gate=source.labFunction;
  if(gate.unlockType!==1)throw new Error('实验室功能门槛类型未接通');
  const [chapter,wave]=gate.unlockArgs.split('|').map(Number);
  if(!Number.isSafeInteger(chapter)||!Number.isSafeInteger(wave))throw new Error('实验室功能门槛无效');
  const reached=(campaign.clearedChapterIds||[]).some(id=>id>=chapter)
    ||Object.entries(campaign.passedWaves||{}).some(([id,passed])=>passed>0&&(Number(id)>chapter||(Number(id)===chapter&&passed>=wave)));
  const reachedChapter=Math.max(1,...(campaign.clearedChapterIds||[]).map(id=>id+1),
    ...Object.entries(campaign.passedWaves||{}).filter(([,passed])=>passed>0).map(([id])=>Number(id)));
  return {chapter,wave,reachedChapter,reached:UNLOCK_ALL_CONTENT || reached,developmentUnlocked:UNLOCK_ALL_CONTENT,serverStateKnown:false};
}

export function nativeLabView(row,campaign) {
  const gate=nativeLabProgressGate(campaign),current=row.levels.find(level=>level.level===row.level);
  const next=row.levels.find(level=>level.id===current?.nextId);
  const eligible=gate.reached&&(gate.developmentUnlocked||gate.reachedChapter>=row.unlockChapter);
  const costs=current?.costs||[],affordable=costs.every(cost=>cost.available>=cost.count);
  const ready=eligible&&row.active&&row.activationKnown;
  const confirmed=row.confirmedSkillLevel??0;
  return {gate,owned:Boolean(row.active),level:row.level,activationStateKnown:Boolean(row.activationKnown),next,
    status:!gate.reached?'功能条件未达成':!eligible?`第${row.unlockChapter}章解锁`:!row.active?'尚未解锁':row.needActive?'当前技能待激活':!next?'已满级':'可以继续研究',
    currentCosts:costs,maxed:Boolean(current&&!next),affordable,
    milestones:row.levels.filter(level=>level.skills.length).map(level=>({
      ...level,status:!row.active||level.level>row.level?'未达到等级':level.level<=confirmed?'已激活':'待激活',
    })),canActivate:Boolean(ready&&row.needActive),canUpgrade:Boolean(ready&&!row.needActive&&next&&affordable)};
}

export function nativeRandomGroupPreview(id) {
  const row=source.drops.find(row=>row.drop_id===id);
  // UI_BoxInfoViewModule.AddItemToList (0x7c8860c) takes the first
  // two columns as item ID and preview count. Remaining columns are
  // not interpreted as a client-side reward range or sampling rule.
  return row?row.Rand1.map(([id,count])=>({id,count,name:nativeCollectionDisplayName(id)||text.itemNames[id]||`物品 ${id}`})):[];
}
