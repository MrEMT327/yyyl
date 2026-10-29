import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import catalog from './native-economy-catalog.json' with {type:'json'};
import { NATIVE_PILOT_SKINS, isRosterPilot } from './native-pilot-roster.js';
import { nativePilotDisplayName } from './native-pilot-names.js';
import { validateReplicaInventory } from './native-economy.js';
import { validateReplicaProgression } from './native-progression.js';
import { appendRecruitHistory, sanitizeRecruitHistory } from '../peripheral/recruit-history.js';

// Local all-content preview only: these are not reconstructed server odds.
const roster=catalog.pilots.filter(row=>isRosterPilot(row.id));
function ledger(raw) {
  return {totalPulls:Number.isSafeInteger(raw?.totalPulls)&&raw.totalPulls>=0?raw.totalPulls:0,
    history:sanitizeRecruitHistory(raw?.history)};
}
export function developmentRecruitSnapshot(raw,inventory) {
  if(!UNLOCK_ALL_CONTENT)return {pool:{unavailable:true},history:[]};
  const record=ledger(raw);
  return {revision:inventory.revision,history:record.history,pool:{id:'pilot',development:true,
    singleCost:0,tenCost:0,totalPulls:record.totalPulls,
    probabilities:Object.fromEntries(roster.map(row=>[row.id,1/roster.length])),
    probabilityLabels:Object.fromEntries(roster.map(row=>[row.id,nativePilotDisplayName(row.id)||row.name])),
    guaranteeText:'开发体验招募：免费，每次必得 1 名驾驶员或 1 张同名卡。',
    duplicateText:'首次获得激活驾驶员；已拥有则发放 1 张同名卡，用于原版升星。',
    rules:['当前正式名单等概率抽取，每次独立，无保底。','这是本地全解锁体验规则，不代表原版招募概率。']}};
}
function drawIndex() {
  const values=new Uint32Array(1),limit=Math.floor(0x100000000/roster.length)*roster.length;
  do{crypto.getRandomValues(values);}while(values[0]>=limit);
  return values[0]%roster.length;
}
export function planDevelopmentRecruit(rawProgression,rawInventory,rawRecord,operation,at) {
  if(!UNLOCK_ALL_CONTENT)throw Error('开发招募未开启');
  if(![1,10].includes(operation.count))throw Error('请选择单次或十次招募');
  const inventory=validateReplicaInventory(rawInventory),progression=validateReplicaProgression(rawProgression);
  if(operation.expectedRevision!==inventory.revision)throw Error('材料已变化，请重新招募');
  const record=ledger(rawRecord),rewards=[];
  for(let i=0;i<operation.count;i++){
    const row=roster[drawIndex()],owned=progression.pilots.find(p=>p.id===row.id),isNew=!owned?.active;
    if(isNew){
      if(owned)Object.assign(owned,{active:true,star:row.defaultStar});
      else progression.pilots.push({id:row.id,active:true,star:row.defaultStar,equipped:false});
    }else inventory.items[row.id]=(inventory.items[row.id]||0)+1;
    rewards.push({type:'pilot',id:NATIVE_PILOT_SKINS[row.id],nativeId:row.id,
      name:nativePilotDisplayName(row.id)||row.name,amount:1,isNew,copiesAdded:isNew?0:1,
      stars:isNew?row.defaultStar:owned.star,nativeRecruit:true});
  }
  inventory.revision++;
  record.totalPulls+=operation.count;
  if(!Number.isSafeInteger(record.totalPulls))throw Error('招募次数超限');
  record.history=appendRecruitHistory(record.history,{at,pool:'pilot',cost:0,
    rewards:rewards.map(row=>({...row,name:row.name+(row.isNew?'':' · 同名卡 ×1')}))});
  return {inventory:validateReplicaInventory(inventory),progression:validateReplicaProgression(progression),record,rewards};
}
