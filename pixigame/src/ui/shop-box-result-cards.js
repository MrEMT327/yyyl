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
      image:recorded?undefined:equipmentArtPath(item.art),gearUid:current?.uid,
      receiptStatus:status?[modal.history&&recorded?`开出时：${item.qualityName}`:'',status].filter(Boolean).join(' · '):''};
  });
  const pilots=(modal.receipt?.pilotRewards??modal.pilots??[]).map(p=>({type:'pilot',id:p.id,name:nativeCollectionDisplayName(p.id)||p.name,
    amount:p.amount||1,receiptStatus:p.creditsAdded?`已满星 · 兑换积分 +${p.creditsAdded}`:p.isNew?'驾驶员已解锁':`同名升星材料 ×${p.amount}`}));
  const weapons=(view?.weapons??modal.weapons??[]).map(w=>({type:'weapon',id:w.id,name:nativeCollectionDisplayName(w.id)||w.name,
    amount:w.amount||1,receiptStatus:w.isNew?'武器已解锁':w.fragmentsAdded!==undefined?`本武器碎片 ×${w.fragmentsAdded}`:w.isNew===false?`同名武器 ×${w.copiesAdded??w.amount}`:`武器 ×${w.amount}`}));
  const aircraft=(view?.aircraft??modal.aircraft??[]).map(a=>({type:'aircraft',id:a.id,name:nativeCollectionDisplayName(a.id)||a.name,
    amount:a.amount||1,receiptStatus:a.isNew?'飞机已解锁':a.isNew===false?`同名飞机卡 ×${a.copiesAdded??a.amount}`:`飞机 ×${a.amount}`}));
  return {rewards:[...equipment,...pilots,...weapons,...aircraft],detailsMissing:Boolean(view?.detailsMissing)};
}
