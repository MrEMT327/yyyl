import catalog from './native-economy-catalog.json' with {type:'json'};
import { NATIVE_AIRCRAFT_SKINS } from './native-aircraft-skins.js';
import { nativeCollectionDisplayName } from './native-collection-names.js';

const candidates=catalog.skins.filter(row=>!row.closed&&NATIVE_AIRCRAFT_SKINS[row.id]);
export const RANDOM_AIRCRAFT=Object.freeze(candidates.map(row=>{
  if(row.unlockCost.length!==1||row.unlockCost[0][0]!==row.id||row.unlockCost[0][1]!==1)
    throw Error('随机飞机激活消耗配置变化');
  return Object.freeze({id:row.id,name:nativeCollectionDisplayName(row.id)||row.name,defaultStar:row.defaultStar});
}));

// Called inside the same cloned inventory/progression plan as payment and gear.
// Ownership never changes the draw weight or converts a duplicate into a reroll.
export function grantAircraftCopies(inventory,progression,id,amount) {
  const row=candidates.find(row=>row.id===id);
  if(!row||!Number.isSafeInteger(amount)||amount<1)throw Error('随机飞机奖励无效');
  const owned=progression.skins.find(row=>row.id===id),isNew=!owned?.active;
  const copiesAdded=amount-(isNew?1:0),balance=(inventory.items[id]||0)+copiesAdded;
  if(!Number.isSafeInteger(balance))throw Error('同名飞机卡数量超限');
  if(isNew){
    const hadActivePlane=progression.skins.some(row=>row.active);
    if(owned)Object.assign(owned,{active:true,star:row.defaultStar});
    else progression.skins.push({id,star:row.defaultStar,active:true,equipped:false});
    // Match existing first-plane rewards, retaining any explicit later selection.
    if(!hadActivePlane&&!progression.role.skinId){progression.role.skinId=id;progression.role.skinStar=row.defaultStar;}
    const slot=progression.skinSkillSlots.indexOf(0);
    if(slot>=0&&row.stages.find(stage=>stage.star===row.defaultStar)?.skills.length&&!progression.skinSkillSlots.includes(id))
      progression.skinSkillSlots[slot]=id;
  }
  if(copiesAdded)inventory.items[id]=balance;
  return {id,name:nativeCollectionDisplayName(id)||row.name,amount,isNew,copiesAdded,star:isNew?row.defaultStar:owned.star};
}
