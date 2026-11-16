import { planEquipmentBox, claimBasicBoxReward } from './native-equipment-boxes.js';
import { basicBoxReward } from './native-box-progress.js';
import { GEAR_PARTS, gearSnapshot, planGearAction } from '../peripheral/equipment-system.js';
import effects from './native-equipment-effects-index.json' with {type:'json'};
import { validateReplicaInventory } from './native-economy.js';

export function replicaWallet(rawInventory) {
  const {items}=validateReplicaInventory(rawInventory);
  return {coins:items[1]||0,diamonds:items[2]||0,unlimited:false};
}
function materialView(gear,inventory) {
  const next=structuredClone(gear);
  for(const part of GEAR_PARTS)next.blueprints[part.type]=inventory.items[part.blueprintId]||0;
  next.keys={basic:inventory.items[113]||0,advanced:inventory.items[112]||0};
  return next;
}
export function replicaGearSnapshot(gear,rawInventory) {
  const inventory=validateReplicaInventory(rawInventory),wallet=replicaWallet(inventory);
  const snapshot=gearSnapshot(materialView(gear,inventory),wallet);
  // Keep cloud cards and details; restore all original quality effects by ID.
  // These are descriptions, not a substitute for runtime handler admission.
  snapshot.items=snapshot.items.map(item=>{
    const source=effects.equipment[item.family+item.quality];
    if(!source)throw new Error('缺少原版装备效果记录：'+(item.family+item.quality));
    return {...item,nativeId:source.id,nativeName:source.nativeName,nativeSeries:source.series,
      features:source.features.map(feature=>({...feature}))};
  });
  const reward=basicBoxReward(gear);
  return {...snapshot,wallet,native:true,supplyAvailable:true,draws:reward.basicDraws,basicRewardClaims:reward.basicClaims,basicRewardAvailable:reward.available,cumulativeStateKnown:true};
}
/** Reuse equipment table rules; only replace their resource source/transaction. */
export function planReplicaGear(gear,rawInventory,operation,progression) {
  const inventory=validateReplicaInventory(rawInventory);
  if(operation.operation==='supply')return planEquipmentBox(gear,inventory,operation,progression);
  if(operation.operation==='claimBasicReward')return claimBasicBoxReward(gear,inventory,operation);
  const view=materialView(gear,inventory);
  const plan=planGearAction(view,{...operation,wallet:replicaWallet(inventory)});
  if(!plan.ok)return plan;
  const delta=(id,amount)=>{
    if(amount===0)return;
    const count=(inventory.items[id]||0)+amount;
    if(!Number.isSafeInteger(count)||count<0)throw new Error('原版装备材料余额异常');
    inventory.items[id]=count;
  };
  delta(1,plan.walletDelta.coins||0);
  for(const part of GEAR_PARTS)delta(part.blueprintId,plan.state.blueprints[part.type]-view.blueprints[part.type]);
  inventory.revision++;
  // Keep former cloud balances archived in their existing fields. They are
  // never imported into native inventory or read by native purchase previews.
  plan.state.blueprints=structuredClone(gear.blueprints);
  plan.state.keys=structuredClone(gear.keys);
  return {...plan,inventory:validateReplicaInventory(inventory)};
}
