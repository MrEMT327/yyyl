import { ITEM_USE_BATCH_LIMIT, isItemUseBatchCount } from './item-use-batches.js';
import { RANDOM_WEAPONS, grantWeaponCopies } from './native-weapon-grants.js';
import { RANDOM_AIRCRAFT, grantAircraftCopies } from './native-aircraft-grants.js';
import source from './native-acquisition-catalog.json' with {type:'json'};
import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import { validateReplicaInventory } from './native-economy.js';
import { nativeBoxProgress, basicBoxReward } from './native-box-progress.js';

import { validateReplicaProgression } from './native-progression.js';
import { localBoxState } from './local-box-state.js';
import { LOCAL_ECONOMY_POLICY } from './local-economy-policy.js';
const DENOMINATOR=100000;
const rows=new Map(equipment.equip.map(row=>[row.ID,row]));
export function equipmentBoxRules(id) {
  const box=source.boxes.find(row=>row.ID===id);
  if(!box)return {supported:false,reason:'未知装备宝箱'};
  const groups=box.DrawBoxRateInfo.map(id=>source.boxRates.find(row=>row.ID===id));
  if(groups.some(row=>!row))return {supported:false,reason:'宝箱概率表缺失'};
  let items=groups.flatMap(row=>row.ItemsProbability);
  // Local pool: weapons 10%, aircraft 5%, green equipment 41%. Pilots stay in recruitment.
  // Blue, purple and S equipment retain their existing weights.
  if(id===3){
    const green=items.filter(([item])=>rows.get(item)?.quality===20);
    if(green.length!==20)throw Error('高级箱自定义奖池配置变化');
    items=items.filter(([item])=>rows.has(item)||item===902).map(([item,count,weight])=>
      [item,count,item===902?10000:rows.get(item)?.quality===20?2050:weight]);
    if(RANDOM_AIRCRAFT.length!==8)throw Error('高级箱飞机奖池配置变化');
    items.splice(1,0,...RANDOM_AIRCRAFT.map(row=>[row.id,1,625]));
  }
  const valid=items.every(([id,count,weight])=>(rows.has(id)||id===902&&RANDOM_WEAPONS.length===11||RANDOM_AIRCRAFT.some(row=>row.id===id))&&Number.isSafeInteger(count)&&count>0
    &&Number.isSafeInteger(weight)&&weight>=0);
  const weight=items.reduce((sum,row)=>sum+row[2],0);
  const supported=[3,4].includes(id) && valid && weight===DENOMINATOR
    &&box.Single.length===1&&Number.isSafeInteger(box.Single[0])&&box.Single[0]>0
    &&Number.isSafeInteger(box.Ten)&&box.Ten>0;
  return {box,items,supported,weight,reason:supported?'':'该箱子的完整抽取规则尚未核实，暂不开放'};
}
function ticket(denominator=DENOMINATOR) {
  // Uniform integer ticket without modulo bias, including the nested weapon draw.
  const value=new Uint32Array(1),limit=Math.floor(0x100000000/denominator)*denominator;
  do{crypto.getRandomValues(value);}while(value[0]>=limit);
  return value[0]%denominator;
}
export function planEquipmentBox(gear,rawInventory,operation,rawProgression) {
  const inventory=validateReplicaInventory(rawInventory),count=operation.count;
  if(operation.revision!==gear?.revision||operation.expectedInventoryRevision!==inventory.revision)
    return {ok:false,message:'装备或材料已变化，请重新确认开箱'};
  const keyOnly=operation.keyOnly!==undefined;
  if(keyOnly?!isItemUseBatchCount(count):![1,10].includes(count))
    return {ok:false,message:keyOnly?`每批可使用 1～${ITEM_USE_BATCH_LIMIT} 张箱券`:'请选择单抽或十连'};
  const id=operation.boxId ?? ({basic:4,advanced:3})[operation.pool];
  const rule=equipmentBoxRules(id);
  if(!rule.supported)return {ok:false,message:rule.reason};
  const {box,items}=rule;
  const time=operation.time??Date.now(),economy=localBoxState(gear.localBoxState,time),boxState=economy.boxes[id];
  if(time<economy.lastSeen)return {ok:false,message:'设备时间回退，请恢复时间后开箱'};
  const freePayment=!keyOnly&&count===1&&time>=boxState.nextFreeAt;
  const keyPayment=(inventory.items[box.Key_ID]||0)>=count;
  if(keyOnly&&(!keyPayment||operation.keyOnly!==box.Key_ID))return {ok:false,message:'箱券不足，本次未消耗钻石'};
  const debit={id:freePayment?box.Key_ID:keyPayment?box.Key_ID:2,amount:freePayment?0:keyPayment?count:count===10?box.Ten:box.Single[0],free:freePayment};
  if((inventory.items[debit.id]||0)<debit.amount)return {ok:false,message:'密钥或钻石不足'};
  const maxGrant=Math.max(...items.filter(row=>row[2]>0).map(row=>row[1]))*count;
  if(gear.version!==2||!Array.isArray(gear.items)||gear.items.length+maxGrant>10000
    ||!Number.isSafeInteger(gear.serial)||gear.serial<0||!Number.isSafeInteger(gear.revision)||gear.revision<0)
    return {ok:false,message:'装备仓库无法接收本次奖励'};
  const next=structuredClone(gear),drawn=[],outcomes=[],weaponRewards=[],aircraftRewards=[];
  const progression=id===3?validateReplicaProgression(rawProgression):null;
  for(let draw=0;draw<count;draw++){
    let cursor=ticket();
    let chosen=items.find(row=>(cursor-=row[2])<0);
    if(!chosen)throw new Error('原版概率表未覆盖抽取结果');
    if(rows.has(chosen[0])){
      const forceS=id===3&&boxState.sMisses+1>=LOCAL_ECONOMY_POLICY.advancedSPity;
      const forceQuality=boxState.qualityMisses+1>=LOCAL_ECONOMY_POLICY.boxQualityPity[id];
      const minimum=id===3?40:20;
      const initialEquipment=rows.get(chosen[0]);
      if(forceS&&initialEquipment.rank!==1||forceQuality&&initialEquipment.quality<minimum){
        const pool=items.filter(([item,,weight])=>weight>0&&rows.has(item)&&rows.get(item).quality>=minimum&&(!forceS||rows.get(item).rank===1));
        let guaranteedTicket=ticket(pool.reduce((sum,row)=>sum+row[2],0));
        chosen=pool.find(row=>(guaranteedTicket-=row[2])<0);
        if(!chosen)throw Error('兼容保底奖池无效');
      }
      const awarded=rows.get(chosen[0]);
      boxState.qualityMisses=awarded.quality>=minimum?0:boxState.qualityMisses+1;
      if(id===3)boxState.sMisses=awarded.rank===1?0:boxState.sMisses+1;
    }
    if(chosen[0]===902){
      const weapon=RANDOM_WEAPONS[ticket(RANDOM_WEAPONS.length)];
      const reward=grantWeaponCopies(inventory,progression,weapon.id,chosen[1]);
      outcomes.push({id:weapon.id,amount:chosen[1]});
      weaponRewards.push(reward);
      continue;
    }
    if(RANDOM_AIRCRAFT.some(row=>row.id===chosen[0])){
      const reward=grantAircraftCopies(inventory,progression,chosen[0],chosen[1]);
      outcomes.push({id:chosen[0],amount:chosen[1]});
      aircraftRewards.push(reward);
      continue;
    }
    const [itemId,amount]=chosen,row=rows.get(itemId);
    outcomes.push({id:itemId,amount});
    if(!row)throw new Error('装备宝箱奖励配置无效');
    for(let i=0;i<amount;i++){
      const serial=next.serial+1,uid='gear-'+serial;
      if(!Number.isSafeInteger(serial)||next.items.some(item=>item.uid===uid))throw new Error('装备序号无效');
      next.serial=serial;
      const item={uid,family:itemId-row.quality,quality:row.quality,locked:false};
      next.items.push(item);drawn.push({...item});
    }
  }
  if(debit.amount)inventory.items[debit.id]-=debit.amount;
  if(freePayment)boxState.nextFreeAt=time+LOCAL_ECONOMY_POLICY.boxFreeHours[id]*3600000;
  economy.lastSeen=time;next.localBoxState=economy;
  next.nativeBoxProgress=nativeBoxProgress(gear.nativeBoxProgress);
  if(id===4){
    next.nativeBoxProgress.basicDraws+=count;
    if(!Number.isSafeInteger(next.nativeBoxProgress.basicDraws))throw new Error('宝箱累计次数超限');
  }
  inventory.revision++;next.revision++;
  if(!Number.isSafeInteger(next.revision))throw new Error('装备版本超限');
  const receipt={version:1,boxId:id,count,debit,outcomes,uids:drawn.map(row=>row.uid),
    pilotRewards:[],weaponRewards,aircraftRewards,inventoryRevision:inventory.revision,gearRevision:next.revision};
  return {ok:true,message:'开箱奖励已保存',state:next,inventory:validateReplicaInventory(inventory),
    drawn,pilotRewards:[],weaponRewards,aircraftRewards,pilotCreditDelta:0,...(progression?{progression:validateReplicaProgression(progression)}:{}),pool:id===4?'basic':'advanced',receipt};
}

export function claimBasicBoxReward(gear,rawInventory,operation) {
  const inventory=validateReplicaInventory(rawInventory),reward=basicBoxReward(gear);
  if(operation.revision!==gear?.revision||operation.expectedInventoryRevision!==inventory.revision)
    return {ok:false,message:'装备或材料已变化，请重新确认领取'};
  if(reward.available<1)return {ok:false,message:'基础宝箱累计开启20次后可领取'};
  const next=structuredClone(gear);
  next.nativeBoxProgress=nativeBoxProgress(gear.nativeBoxProgress);
  next.nativeBoxProgress.basicClaims++;
  next.revision++;
  inventory.items[112]=(inventory.items[112]||0)+1;
  inventory.revision++;
  if(!Number.isSafeInteger(next.revision)||!Number.isSafeInteger(inventory.items[112]))throw new Error('宝箱奖励余额超限');
  return {ok:true,state:next,inventory:validateReplicaInventory(inventory),keyReward:1,message:'高级装备箱券 ×1 已领取'};
}
