// Compatibility only: personal pilot fragments no longer enter live rewards.
// Whole bundles become manual-upgrade cards; remainders retain their former
// max-star exchange value. Inventory and credits must be saved atomically.
import { PILOT_FRAGMENT_ITEMS } from './native-pilot-fragments.js';
import { validateReplicaInventory } from './native-economy.js';
import { validateReplicaProgression } from './native-progression.js';
import { grantPilotCards } from './pilot-copy-grants.js';
import { MAXED_PILOT_FRAGMENT_DIAMONDS } from './pilot-supply-reward-policy.js';

export function planRetiredPilotFragments(rawInventory,rawProgression) {
  if(!PILOT_FRAGMENT_ITEMS.some(row=>Object.hasOwn(rawInventory.items,row.id)))return null;
  const inventory=validateReplicaInventory(rawInventory),progression=validateReplicaProgression(rawProgression);
  let creditsAdded=0,diamondsAdded=0;
  const converted=[];
  for(const row of PILOT_FRAGMENT_ITEMS){
    if(!Object.hasOwn(inventory.items,row.id))continue;
    const count=inventory.items[row.id],cards=Math.floor(count/row.cost);
    const diamonds=(count%row.cost)*MAXED_PILOT_FRAGMENT_DIAMONDS;
    const grant=cards?grantPilotCards(inventory,progression,row.pilotId,cards):{copiesAdded:0,creditsAdded:0};
    creditsAdded+=grant.creditsAdded;diamondsAdded+=diamonds;
    if(!Number.isSafeInteger(creditsAdded)||!Number.isSafeInteger(diamondsAdded))throw Error('旧驾驶员奖励折算数量超限');
    converted.push({id:row.id,count,pilotId:row.pilotId,copiesAdded:grant.copiesAdded,creditsAdded:grant.creditsAdded,diamonds});
    delete inventory.items[row.id];
  }
  if(diamondsAdded){
    inventory.items[2]=(inventory.items[2]||0)+diamondsAdded;
    if(!Number.isSafeInteger(inventory.items[2]))throw Error('钻石数量超限，旧奖励未折算');
  }
  inventory.revision++;
  return {inventory:validateReplicaInventory(inventory),creditsAdded,diamondsAdded,converted};
}
