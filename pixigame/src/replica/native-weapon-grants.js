import source from './native-acquisition-catalog.json' with {type:'json'};
import catalog from './native-economy-catalog.json' with {type:'json'};
import { nativeCollectionDisplayName } from './native-collection-names.js';

// Original random-weapon group. Local fulfillment samples these candidates
// uniformly; it never changes odds according to ownership or star level.
const ids=source.drops.find(row=>row.drop_id===10010023).Rand1.map(([id])=>id);
export const RANDOM_WEAPONS=Object.freeze(ids.map(id=>{
  const row=catalog.guns.find(row=>row.id===id&&!row.closed);
  if(!row||row.unlockCost.length!==1||row.unlockCost[0][0]!==id||row.unlockCost[0][1]!==1)
    throw Error('随机武器候选或激活消耗配置变化');
  return Object.freeze({id,name:nativeCollectionDisplayName(id)||row.name,defaultStar:row.defaultStar});
}));

export function grantWeaponCopies(inventory,progression,id,amount) {
  const row=RANDOM_WEAPONS.find(row=>row.id===id);
  if(!row||!Number.isSafeInteger(amount)||amount<1)throw Error('随机武器奖励无效');
  const owned=progression.guns.find(row=>row.id===id),isNew=!owned?.active;
  const copiesAdded=amount-(isNew?1:0),balance=(inventory.items[id]||0)+copiesAdded;
  if(!Number.isSafeInteger(balance))throw Error('同名武器数量超限');
  if(isNew){
    if(owned)Object.assign(owned,{active:true,star:row.defaultStar,equipped:false});
    else progression.guns.push({id,star:row.defaultStar,active:true,equipped:false});
  }
  if(copiesAdded)inventory.items[id]=balance;
  return {id,name:row.name,amount,isNew,copiesAdded,star:isNew?row.defaultStar:owned.star};
}
