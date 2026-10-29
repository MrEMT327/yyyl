import { grantBattleMaterials } from './battle-material-rewards.js';
import source from './native-settlement-source.json' with {type:'json'};
import catalog from './native-economy-catalog.json' with {type:'json'};
import acquisition from './native-acquisition-catalog.json' with {type:'json'};
import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import { gearName } from '../peripheral/equipment-system.js';
import { nativeCollectionDisplayName } from './native-collection-names.js';
import { replicaInventoryAfterSettlement, validateReplicaInventory } from './native-economy.js';

// Request gold is earned battle gold, not a cloud win/loss bonus. The only
// fixed grants come from Chapter_MainChapter.FirstReward. Repeat material settlement is unverified; FinishReward is not treated as a server grant table.
export function planNativeSettlement(rawInventory, rawGear, rawClaims, result, rawMaterials) {
  const inventory=replicaInventoryAfterSettlement(rawInventory,result);
  const claims=structuredClone(rawClaims ?? {});
  if(!claims || Array.isArray(claims) || typeof claims!=='object'
    || Object.entries(claims).some(([id,run])=>!source.firstRewards[id] || typeof run!=='string' || !run))
    throw new Error('首通奖励记录无效');
  let gear=rawGear;
  const rewards=[];
  const materials=grantBattleMaterials(inventory,rewards,rawMaterials,result);
  if(result.trial || result.abandoned)return {inventory,gear,claims,rewards,materials};
  const gold=Math.floor(result.gold);
  if(gold>0)rewards.push({type:'coins',id:1,name:'金币',amount:gold});
  // Exact captured FirstReward; preserve once-only claim records.
  const first=result.won && !claims[result.chapterId]?source.firstRewards[result.chapterId]:null;
  if(first?.length){
    if(typeof result.runId!=='string'||!result.runId)throw new Error('首通结算缺少战斗记录');
    for(const [id,amount] of first){
      if(!Number.isSafeInteger(amount)||amount<=0)throw new Error('原版首通奖励数量无效');
      const row=equipment.equip.find(row=>row.ID===id);
      if(row){
        if(gear===rawGear)gear=structuredClone(rawGear);
        if(gear?.version!==2 || !Array.isArray(gear.items) || !Number.isSafeInteger(gear.serial)
          || gear.serial<0 || !Number.isSafeInteger(gear.revision) || gear.revision<0
          || gear.items.length+amount>10000)throw new Error('装备库存无法接收首通奖励');
        const granted=[];
        for(let i=0;i<amount;i++){
          const serial=gear.serial+1,uid='gear-'+serial;
          if(!Number.isSafeInteger(serial)||gear.items.some(item=>item.uid===uid))throw new Error('装备序号无效');
          gear.serial=serial;
          const item={uid,family:id-row.quality,quality:row.quality,locked:false};
          gear.items.push(item);granted.push(uid);
        }
        gear.revision++;
        if(!Number.isSafeInteger(gear.revision))throw new Error('装备版本超限');
        rewards.push({type:'equipment',id,name:gearName({family:id-row.quality,quality:row.quality}),amount,uids:granted,firstClear:true});
      }else{
        const item=acquisition.items.find(row=>row.id===id);
        if(!item || item.autoUse || item.itemType>1)throw new Error('首通物品未接入原版库存：'+id);
        const total=(inventory.items[id]||0)+amount;
        if(!Number.isSafeInteger(total))throw new Error('首通物品数量超限');
        inventory.items[id]=total;
        rewards.push({type:'native-item',id,name:nativeCollectionDisplayName(id)||catalog.itemNames[id]||item.note||('物品 '+id),amount,firstClear:true});
      }
    }
    // Independent of the bounded battle history. Persist together with inventory
    // and gear; never mark claimed before the reward save succeeds.
    claims[result.chapterId]=result.runId;
  }
  return {inventory:validateReplicaInventory(inventory),gear,claims,rewards,materials};
}
