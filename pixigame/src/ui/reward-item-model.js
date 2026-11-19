import {nativeRewardPresentation} from '../replica/native-item-presentation.js';
import {rewardDisplayQuality,rewardNativeItemId} from '../replica/item-display-quality.js';
import {COMMON_WEAPONS} from '../fixed-parts/common-weapons.js';
import {aircraftUiImage} from '../aircraft-ui-images.js';
import {weaponIconUrl} from './weapon-icon-source.js';
import {projectIconUrl} from './project-ui-art.js';

const base=import.meta.env?.BASE_URL??'/';
const resources={
  coins:['金币','psd-main-v1/resources/coins-icon'],diamonds:['钻石','psd-main-v1/resources/diamonds-icon'],
  stamina:['体力','psd-main-v1/resources/stamina-icon'],aircraftShards:['通用飞机碎片','project-inventory-icons-v1/aircraft-shard'],
  weaponParts:['武器零件','project-inventory-icons-v1/weapon-parts'],cores:['科技星核','project-inventory-icons-v1/technology-core'],
};

function artwork(r,id,type,native,resource){
  if(type==='pilotCredits')return {image:projectIconUrl('activity-medal'),icon:'medal'};
  const customImage=native.image||(type==='nativeItem'?r.image:['gear','gearBlueprint','gearKey'].includes(type)&&r.image?base+r.image:null);
  if(customImage)return {image:customImage,artClass:'pl-icon ag-reward-art'};
  if(resource)return {image:base+'art/'+resource+'.png',artClass:'pl-icon'};
  const weapon=COMMON_WEAPONS[id],model=weapon?weaponIconUrl(id):aircraftUiImage(id,'thumbnail');
  if(model)return {image:model,artClass:weapon?'pl-model-thumb pl-weapon-emblem pl-weapon-icon-'+id.slice(4):'pl-model-thumb'};
  const icon=type==='aircraft'?'plane':type==='weapon'?'weapon':'crate';
  return {icon,image:icon==='crate'?projectIconUrl('chest-closed'):base+'art/peripheral-v2/icons/entry-'+icon+'.png'};
}

// Display accepted receipts exactly as settled. Names, quality and art are shared with the existing reward list.
export function rewardItemModel(r,snapshot,projectAssets=true){
  const id=r.id||r.itemId,type=r.type||r.kind,native=nativeRewardPresentation(r);
  const known=snapshot.weapons.find(item=>item.id===id)||snapshot.aircraft.find(item=>item.id===id);
  const resource=resources[type];
  return {type,itemId:rewardNativeItemId(r)??id,name:native.name||resource?.[0]||r.name||known?.aircraftName||known?.name||'补给',
    ...rewardDisplayQuality(r,native,known),...artwork(r,id,type,native,projectAssets&&resource?.[1]),
    amount:r.amount??r.count??1,isNew:r.isNew===true,receiptStatus:r.receiptStatus,gearUid:projectAssets?r.gearUid:null};
}
