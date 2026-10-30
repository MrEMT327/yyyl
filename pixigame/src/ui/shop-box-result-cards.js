import {equipmentArtPath} from '../replica/equipment-art.js';
import { equipmentBoxReceiptItems } from '../replica/native-equipment-box-receipt.js';
import { nativeCollectionDisplayName } from '../replica/native-collection-names.js';

export function shopBoxRewards(modal,s) {
  const recorded=Boolean(modal.receipt),view=recorded?equipmentBoxReceiptItems(modal.receipt):null;
  const warehouse=new Map(s.equipment.items.map(item=>[item.uid,item]));
  // The former cloud result screen has no native receipt. Keep its live view;
  // native history must never silently substitute current warehouse qualities.
  const items=recorded?view.items:(modal.drawn||[]).map(id=>warehouse.get(id)).filter(Boolean);
  const equipment=items.map(item=>{
    const owned=warehouse.get(item.uid);
    const current=recorded?(owned?.family===item.family?owned:null):item;
    const status=!recorded?'':!item.uid?'库存关联未保存':!current?'已消耗':current.quality!==item.quality?'当前品质已变化':'';
    return {type:'gear',id:item.uid||item.nativeId,nativeItemId:item.nativeId,name:item.name,amount:1,qualityName:item.qualityName,
      qualityRank:Math.max(0,Math.min(5,Math.floor(item.quality/10)-1)),
      image:recorded?undefined:`art/project-flight-gear-v1/${item.art}.webp`,gearUid:current?.uid,
      receiptStatus:status?[modal.history&&recorded?`开出时：${item.qualityName}`:'',status].filter(Boolean).join(' · '):''};
  });
  const pilots=(modal.pilots||[]).map(p=>({type:'pilot',id:p.id,name:nativeCollectionDisplayName(p.id)||p.name,
    amount:p.amount||1,receiptStatus:p.creditsAdded?`已满星 · 兑换积分 +${p.creditsAdded}`:p.isNew?'驾驶员已解锁':`同名升星材料 ×${p.amount}`}));
  const weapons=(modal.weapons||[]).map(w=>({type:'weapon',id:w.id,name:nativeCollectionDisplayName(w.id)||w.name,
    amount:1,receiptStatus:w.isNew?'已解锁':`本武器碎片 ×${w.fragmentsAdded}`}));
  return {rewards:[...equipment,...pilots,...weapons],detailsMissing:Boolean(view?.detailsMissing)};
}
