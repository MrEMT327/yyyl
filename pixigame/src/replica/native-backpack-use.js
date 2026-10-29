import { isItemUseBatchCount } from './item-use-batches.js';
import { grantPilotCards, pilotCreditReward, pilotAtMaxStar } from './pilot-copy-grants.js';
import { validateReplicaProgression } from './native-progression.js';
import { MATERIAL_REPLACEMENTS } from './native-material-replacements.js';
import source from './native-acquisition-catalog.json' with {type:'json'};
import catalog from './native-economy-catalog.json' with {type:'json'};
import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import { validateReplicaInventory } from './native-economy.js';
import { isRosterPilot } from './native-pilot-roster.js';
import { flightRewardView } from './flight-rewards.js';

const items=new Map(source.items.map(row=>[row.id,row]));
const gearRows=new Map(equipment.equip.map(row=>[row.ID,row]));
const direct=id=>[1,2,105,106,107,108,109,112,113,135].includes(id)||id>=801&&id<=811;
export function backpackUseRule(id) {
  id=Number(id);
  if(MATERIAL_REPLACEMENTS[id])return {kind:'exchange',target:MATERIAL_REPLACEMENTS[id],cost:1};
  if(isRosterPilot(id)&&catalog.pilots.some(row=>row.id===id&&!row.closed))return {kind:'pilotCard'};
  if(id===925)return {kind:'pilotBox'};
  if(id===926)return {kind:'pilotCompose',cost:50,target:925};
  if(id===112||id===113)return {kind:'equipmentKey',pool:id===112?'advanced':'basic'};
  const row=items.get(id),pair=row?.itemTypeParam?.[0];
  if(row?.itemSubType===12&&pair?.length===2&&isRosterPilot(pair[0])
    &&catalog.pilots.some(p=>p.id===pair[0]&&!p.closed)&&Number.isSafeInteger(pair[1])&&pair[1]>0)
    return {kind:'compose',target:pair[0],cost:pair[1]};
  // Only deterministic, explicitly configured choices. No guessed random pool.
  if([903,934].includes(id)&&row?.itemSubType===6&&row.itemTypeParam.length
    &&row.itemTypeParam.every(([target,count])=>(direct(target)||gearRows.has(target))&&Number.isSafeInteger(count)&&count>0))
    return {kind:'choice',choices:row.itemTypeParam.map(([id,count])=>({id,count}))};
  return null;
}

export function planBackpackUse(rawInventory,rawGear,operation,rawProgression) {
  const inventory=validateReplicaInventory(rawInventory),rule=backpackUseRule(operation.id);
  if(operation.expectedRevision!==inventory.revision)throw Error('道具数量已变化，请重新确认');
  if(!rule||!['compose','choice','exchange'].includes(rule.kind))throw Error('该道具不能在这里直接使用');
  // Local surplus policy: only the <50 remainder of a max-star pilot may
  // become role-box fragments 1:1. Full groups retain their credit conversion.
  if(operation.action==='exchangePilotRemainder') {
    if(rule.kind!=='compose'||!pilotAtMaxStar(validateReplicaProgression(rawProgression),rule.target))
      throw Error('仅满星驾驶员的专属碎片余量可兑换');
    const remainder=(inventory.items[operation.id]||0)%rule.cost;
    if(!remainder||operation.count!==remainder)throw Error('碎片余量已变化，请重新确认');
    const balance=(inventory.items[926]||0)+remainder;
    if(!Number.isSafeInteger(balance))throw Error('角色箱碎片数量超限，未兑换');
    inventory.items[operation.id]-=remainder;inventory.items[926]=balance;inventory.revision++;
    return {inventory:validateReplicaInventory(inventory),pilotCreditDelta:0,
      rewards:[flightRewardView({kind:'item',id:926,count:remainder})],
      message:`已将 ${remainder} 个满星专属碎片余量兑换为等量角色箱碎片`};
  }
  if(operation.action!==undefined)throw Error('未知的道具使用操作');
  const count=operation.count;
  if(!Number.isSafeInteger(count)||count<1||rule.kind==='choice'&&!isItemUseBatchCount(count))throw Error('使用数量无效');
  const cost=rule.kind==='compose'?rule.cost*count:count;
  if(!Number.isSafeInteger(cost)||(inventory.items[operation.id]||0)<cost)throw Error('道具数量不足');
  const chosen=rule.kind==='choice'?rule.choices.find(row=>row.id===operation.targetId):{id:rule.target,count:1};
  if(!chosen)throw Error('请选择宝箱内的奖励');
  const amount=chosen.count*count;
  if(!Number.isSafeInteger(amount))throw Error('奖励数量超限');
  let gear,drawn=[],pilotCreditDelta=0;
  const row=gearRows.get(chosen.id);
  if(row) {
    if(operation.expectedGearRevision!==rawGear.revision)throw Error('装备已变化，请重新确认');
    if(rawGear.version!==2||!Array.isArray(rawGear.items)||rawGear.items.length+amount>10000
      ||!Number.isSafeInteger(rawGear.serial)||rawGear.serial<0)throw Error('装备仓库无法接收本次奖励');
    gear=structuredClone(rawGear);const ids=new Set(gear.items.map(item=>item.uid));
    for(let i=0;i<amount;i++){
      const serial=gear.serial+1,uid='gear-'+serial;
      if(!Number.isSafeInteger(serial)||ids.has(uid))throw Error('装备序号无效');
      gear.serial=serial;ids.add(uid);
      const item={uid,family:row.ID-row.quality,quality:row.quality,locked:false};
      gear.items.push(item);drawn.push(item);
    }
    gear.revision++;
    if(!Number.isSafeInteger(gear.revision))throw Error('装备版本超限');
  } else if(isRosterPilot(chosen.id)){
    const grant=grantPilotCards(inventory,validateReplicaProgression(rawProgression),chosen.id,amount);
    pilotCreditDelta=grant.creditsAdded;
  } else {
    const balance=(inventory.items[chosen.id]||0)+amount;
    if(!Number.isSafeInteger(balance))throw Error('道具数量超限');
    inventory.items[chosen.id]=balance;
  }
  inventory.items[operation.id]-=cost;inventory.revision++;
  return {inventory:validateReplicaInventory(inventory),gear,drawn,pilotCreditDelta,
    rewards:[pilotCreditDelta?pilotCreditReward(pilotCreditDelta,chosen.id):flightRewardView({kind:'item',id:chosen.id,count:amount})],
    message:pilotCreditDelta?'合成完成，满星重复已转为积分':rule.kind==='exchange'?'兑换完成，兼容材料已存入背包':rule.kind==='compose'?'合成完成，同名卡已存入背包':'自选奖励已存入库存'};
}
