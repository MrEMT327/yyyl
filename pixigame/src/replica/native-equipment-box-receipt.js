import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import { nativeGearPresentation } from './native-item-names.js';
import { isRosterPilot } from './native-pilot-roster.js';
import { ITEM_USE_BATCH_LIMIT } from './item-use-batches.js';
import { RANDOM_WEAPONS } from './native-weapon-grants.js';
import { RANDOM_AIRCRAFT } from './native-aircraft-grants.js';

const weaponRows=new Map(RANDOM_WEAPONS.map(row=>[row.id,row]));
const aircraftRows=new Map(RANDOM_AIRCRAFT.map(row=>[row.id,row]));

const records=new Map(equipment.equip.map(row=>[row.ID,{
  ...nativeGearPresentation(row.ID),nativeId:row.ID,family:row.ID-row.quality,quality:row.quality,
}]));

// Version 1 already stored original outcome IDs and counts. Reconstruct those
// records without reading the mutable warehouse or changing historical saves.
export function equipmentBoxReceiptItems(receipt) {
  const missing=()=>({items:[],weapons:[],aircraft:[],detailsMissing:true});
  if(receipt?.version!==1||!Number.isSafeInteger(receipt.count)||receipt.count<1||receipt.count>ITEM_USE_BATCH_LIMIT
    ||!Array.isArray(receipt.outcomes)||receipt.outcomes.length!==receipt.count)return missing();
  const items=[],weapons=[],aircraft=[],uids=Array.isArray(receipt.uids)?receipt.uids:[],seen=new Set();
  let index=0,detailsMissing=false;
  for(const outcome of receipt.outcomes){
    if(!Number.isSafeInteger(outcome?.id)||!Number.isSafeInteger(outcome.amount)||outcome.amount<1||outcome.amount>10000)return missing();
    const row=records.get(outcome.id);
    if(!row){
      if(weaponRows.has(outcome.id)){
        const detail=receipt.weaponRewards?.[weapons.length];
        // Keep the original unlock/duplicate status. Older receipts can still
        // show their recorded weapon and quantity without inferring that status.
        const matches=detail?.id===outcome.id&&detail.amount===outcome.amount;
        if(detail&&!matches)detailsMissing=true;
        weapons.push({...matches?detail:{id:outcome.id,amount:outcome.amount},name:weaponRows.get(outcome.id).name});
      }else if(aircraftRows.has(outcome.id)){
        const detail=receipt.aircraftRewards?.[aircraft.length];
        const matches=detail?.id===outcome.id&&detail.amount===outcome.amount;
        if(detail&&!matches)detailsMissing=true;
        aircraft.push({...matches?detail:{id:outcome.id,amount:outcome.amount},name:aircraftRows.get(outcome.id).name});
      }else if(!isRosterPilot(outcome.id))detailsMissing=true;
      continue;
    }
    if(items.length+outcome.amount>10000)return missing();
    for(let i=0;i<outcome.amount;i++){
      const recorded=uids[index++],valid=typeof recorded==='string'&&/^gear-[1-9]\d*$/.test(recorded)&&!seen.has(recorded);
      const uid=valid?recorded:null;
      if(uid)seen.add(uid);else detailsMissing=true;
      items.push({...row,uid});
    }
  }
  if(index!==uids.length)detailsMissing=true;
  return {items,weapons,aircraft,detailsMissing};
}
