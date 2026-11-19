import source from './native-research-source.json' with {type:'json'};
import {nativeResearchState} from './native-research-state.js';
import {RESEARCH_QUALITY_NAMES} from '../peripheral/research.js';
import economy from './native-economy-catalog.json' with {type:'json'};
import {validateReplicaInventory} from './native-economy.js';
import {validateReplicaProgression} from './native-progression.js';
const cardById=new Map(source.cards.map(row=>[String(row.ID),row]));
const stage=(id,level)=>source.levels.find(row=>row.CardID===Number(id)&&row.CardLevel===level);
const totals=state=>Object.fromEntries([1,2].map(type=>[type,Object.entries(state.levels).reduce((n,[id,level])=>n+(cardById.get(id).CardType===type?level:0),0)]));
// User-approved local odds (2026-10-21), NOT recovered server probabilities.
export const NATIVE_RESEARCH_LOCAL_WEIGHTS=Object.freeze({2:70,3:25,4:5,5:90,6:10});
export const NATIVE_RESEARCH_CORE_INTERVAL=15; // TalentEpicCoin=[15,135].
// Source Skill_Main descriptions, not the retired cloud numeric substitutes.
const featureLines=row=>{
 const raw=row?.FeatureJson;
 const features=(raw?Array.isArray(raw)?raw:[raw]:[]).map(value=>typeof value==='string'?JSON.parse(value):value);
 return features.flatMap(feature=>String(feature.Args).split(',').map(Number).flatMap(id=>
  feature.Type!=='Skill'?[]:id>=500001&&id<=500005?[`每场战斗前${id-500001+3}次受到的远程伤害减半`]:
   id===500011?['每次迎战首领前，掉落1个维修箱']:[]));
};
const lines=row=>(row?.Attribute||[]).map(value=>{
 const [key,amount]=value.split('='),percent=key.trim().endsWith('%');
 return `${economy.attributeNames[key.trim()]||key.trim()} +${amount}${percent?'%':''}`;
}).concat(featureLines(row));
function quote(state,pool){
 const type=pool==='normal'?1:pool==='ace'?2:0;
 if(!type)throw Error('请选择觉醒类型');
 const count=totals(state)[type],table=type===1?source.normal:source.ace;
 const cost=table.find(row=>row.ID===count+1)||table.at(-1);
 const group=source.drops.find(row=>row.drop_id===cost?.drawDrop);
 // Never reinterpret Rand1's remaining columns as server odds. The user has
 // approved quality-weighted local draws from the original candidate IDs.
 const fixed=group?.Rand1?.length===1&&group.Rand1[0][1]===1?group.Rand1[0][0]:null;
 const card=fixed&&cardById.get(String(fixed));
 const previous=state.levels[fixed]||0;
 const target=card&&stage(fixed,previous+1);
 const finished=source.cards.filter(row=>row.CardType===type).every(row=>(state.levels[row.ID]||0)===row.maxLv);
 const candidates=[...new Set((group?.Rand1||[]).map(row=>row[0]))].map(id=>cardById.get(String(id)))
  .filter(row=>row&&row.CardType===type&&(state.levels[row.ID]||0)<row.maxLv&&stage(row.ID,(state.levels[row.ID]||0)+1));
 const supported=!finished&&(fixed?Boolean(card&&target&&previous<card.maxLv&&card.CardType===type):candidates.length>0);
 return {cost,card,target,previous,count,supported,finished,candidates,fixed,reason:finished?'该类科技已全部满级，资源未扣除':'科技奖励配置不可用，资源未扣除'};
}
function sample(items,weight,rng){
 const roll=rng();
 if(!Number.isFinite(roll)||roll<0||roll>=1)throw Error('觉醒随机值无效，资源未扣除');
 let ticket=roll*items.reduce((sum,item)=>sum+weight(item),0);
 for(const item of items){ticket-=weight(item);if(ticket<0)return item;}
 return items.at(-1);
}
export function nativeResearchSnapshot(rawProgression,rawInventory) {
 const state=nativeResearchState(rawProgression.nativeResearch),inventory=validateReplicaInventory(rawInventory);
 const normal=quote(state,'normal'),ace=quote(state,'ace');
 // Card identity and artwork come from the same captured native row.
 const cards=[...source.cards].sort((a,b)=>a.order-b.order).map(row=>{
   const id=String(row.ID),visual={id,icon:row.icon,pool:row.CardType===1?'normal':'ace'};
   const level=state.levels[id]||0;
   return {...visual,native:true,name:row.name,quality:row.Quality,qualityName:RESEARCH_QUALITY_NAMES[row.Quality],
     maxLevel:row.maxLv,level,owned:level>0,maxed:level===row.maxLv,
     effects:lines(stage(row.ID,level)),nextEffects:lines(stage(row.ID,level+1)),perLevel:{}};
 });
 const afford=q=>q.supported&&q.cost.Cost.every(([id,count])=>(inventory.items[id]||0)>=count);
 return {...state,native:true,revision:inventory.revision,cards,owned:cards.filter(row=>row.owned).length,
   effects:cards.filter(row=>row.owned).flatMap(row=>row.effects.map(line=>`${row.name}：${line}`)),
   normalCost:normal.cost.Cost.find(([id])=>id===1)?.[1]||0,
   normalDraws:normal.count,aceDraws:ace.count,cores:inventory.items[135]||0,
   canNormal:afford(normal),canAce:afford(ace),normalFinished:normal.finished,aceFinished:ace.finished,allFinished:normal.finished&&ace.finished,
   refining:false,refineReady:false,coresSufficient:false,refineSteps:0,untilCore:0,
   progressText:normal.finished?'常规科技已满级 · 星核':`再觉醒 ${NATIVE_RESEARCH_CORE_INTERVAL-normal.count%NATIVE_RESEARCH_CORE_INTERVAL} 次赠1星核 · 持有`,
   rules:['常规觉醒消耗金币；王牌觉醒每次消耗1枚星核。','每15次常规觉醒获得1枚星核。','觉醒概率：常规普通70%、优秀25%、杰出5%；王牌史诗90%、传说10%。','同品质未满级科技等概率抽取，满级科技退出奖池。']};
}
export function planNativeResearch(rawProgression,rawInventory,operation,rng=Math.random) {
 const progression=validateReplicaProgression(rawProgression),inventory=validateReplicaInventory(rawInventory);
 if(operation.expectedRevision!==inventory.revision)throw Error('科技或材料库存已更新，请重新操作');
 const state=nativeResearchState(progression.nativeResearch),q=quote(state,operation.pool);
 if(!q.supported)throw Error(q.reason);
 if(!q.fixed){
   const qualities=[...new Set(q.candidates.map(row=>row.Quality))];
   const quality=sample(qualities,value=>NATIVE_RESEARCH_LOCAL_WEIGHTS[value],rng);
   q.card=sample(q.candidates.filter(row=>row.Quality===quality),()=>1,rng);
   q.previous=state.levels[q.card.ID]||0;q.target=stage(q.card.ID,q.previous+1);
 }
 for(const [id,count]of q.cost.Cost){
   if(!Number.isSafeInteger(count)||count<=0||(inventory.items[id]||0)<count)throw Error('原版材料不足');
   inventory.items[id]-=count;
 }
 state.levels[q.card.ID]=q.previous+1;progression.nativeResearch=state;inventory.revision++;
 const earnedCore=operation.pool==='normal'&&(q.count+1)%NATIVE_RESEARCH_CORE_INTERVAL===0?1:0;
 if(earnedCore)inventory.items[135]=(inventory.items[135]||0)+earnedCore;
 return {progression:validateReplicaProgression(progression),inventory:validateReplicaInventory(inventory),
   receipt:{ok:true,researchResult:true,pool:operation.pool,cardId:String(q.card.ID),previousLevel:q.previous,level:q.previous+1,earnedCore,
     message:`${q.card.name} · Lv.${q.previous+1}`,
     nativeChanges:(q.target.Attribute||[]).map(value=>{
       const [key,amount]=value.split('='),old=(stage(q.card.ID,q.previous)?.Attribute||[]).find(line=>line.split('=')[0]===key)?.split('=')[1]||'0';
       const unit=key.trim().endsWith('%')?'%':'';
       return {label:economy.attributeNames[key.trim()]||key.trim(),before:`+${old}${unit}`,after:`+${amount}${unit}`};
     }).concat(featureLines(q.target).map(after=>({label:'技能效果',before:featureLines(stage(q.card.ID,q.previous)).join('；')||'未觉醒',after})))}};
}
