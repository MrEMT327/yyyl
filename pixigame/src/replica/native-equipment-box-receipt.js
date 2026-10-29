import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import { nativeGearPresentation } from './native-item-names.js';
import { isRosterPilot } from './native-pilot-roster.js';
import catalog from './native-economy-catalog.json' with {type:'json'};
import { ITEM_USE_BATCH_LIMIT } from './item-use-batches.js';

const records=new Map(equipment.equip.map(row=>[row.ID,{
  ...nativeGearPresentation(row.ID),nativeId:row.ID,family:row.ID-row.quality,quality:row.quality,
}]));

// Version 1 already stored original outcome IDs and counts. Reconstruct those
// records without reading the mutable warehouse or changing historical saves.
export function equipmentBoxReceiptItems(receipt) {
  const missing=()=>({items:[],detailsMissing:true});
  if(receipt?.version!==1||!Number.isSafeInteger(receipt.count)||receipt.count<1||receipt.count>ITEM_USE_BATCH_LIMIT
    ||!Array.isArray(receipt.outcomes)||receipt.outcomes.length!==receipt.count)return missing();
  const items=[],uids=Array.isArray(receipt.uids)?receipt.uids:[],seen=new Set();
  let index=0,detailsMissing=false;
  for(const outcome of receipt.outcomes){
    if(!Number.isSafeInteger(outcome?.id)||!Number.isSafeInteger(outcome.amount)||outcome.amount<1||outcome.amount>10000)return missing();
    const row=records.get(outcome.id);
    if(!row){if(!isRosterPilot(outcome.id)&&!catalog.guns.some(row=>row.id===outcome.id))detailsMissing=true;continue;}
    if(items.length+outcome.amount>10000)return missing();
    for(let i=0;i<outcome.amount;i++){
      const recorded=uids[index++],valid=typeof recorded==='string'&&/^gear-[1-9]\d*$/.test(recorded)&&!seen.has(recorded);
      const uid=valid?recorded:null;
      if(uid)seen.add(uid);else detailsMissing=true;
      items.push({...row,uid});
    }
  }
  if(index!==uids.length)detailsMissing=true;
  return {items,detailsMissing};
}
