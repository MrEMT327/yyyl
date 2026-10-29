import {equipmentArtPath} from '../replica/equipment-art.js';
import { equipmentBoxReceiptItems } from '../replica/native-equipment-box-receipt.js';
import { nativeItemArt } from '../replica/native-item-presentation.js';

export function shopBoxEquipmentCards(modal,s,h) {
  const e=h.escape,recorded=Boolean(modal.receipt),view=recorded?equipmentBoxReceiptItems(modal.receipt):null;
  const warehouse=new Map(s.equipment.items.map(item=>[item.uid,item]));
  // The former cloud result screen has no native receipt. Keep its live view;
  // native history must never silently substitute current warehouse qualities.
  const items=recorded?view.items:(modal.drawn||[]).map(id=>warehouse.get(id)).filter(Boolean);
  const cards=items.map(item=>{
    const owned=warehouse.get(item.uid);
    const current=recorded?(owned?.family===item.family?owned:null):item;
    const tag=current?'button':'div';
    const action=current?`type="button" data-action="gearDetail" data-id="${e(item.uid)}" aria-label="${e(item.name)}，查看当前装备"`:'';
    const image=recorded?nativeItemArt(item.nativeId):(import.meta.env?.BASE_URL??'/')+equipmentArtPath(item.art);
    const status=modal.history&&recorded&&item.uid&&!current?'已消耗':'';
    return `<${tag} class="sn-result" data-psd-quality="${Math.max(0,Math.min(5,Math.floor(item.quality/10)-1))}" ${action}>
      <img src="${e(image)}" alt=""><b>${e(item.name)}</b>${status?`<small>${e(status)}</small>`:''}</${tag}>`;
  }).join('');
  return {cards,note:view?.detailsMissing?'<p class="sn-hint">部分奖励记录缺失</p>':''};
}
