import { nativeItemPresentation } from '../replica/native-item-presentation.js';
import { nativeGearPresentation } from '../replica/native-item-names.js';
import { rewardNativeItemId, rewardDisplayQuality } from '../replica/item-display-quality.js';

const resources={coins:1,diamonds:2,stamina:4,cores:135,weaponParts:129};
const walletKeys={1:'coins',2:'diamonds',4:'stamina',135:'cores',129:'weaponParts'};
export function descriptionItemId(item={}) {
  const id=item.nativeItemId??item.nativeId??item.itemId??item.id;
  if(typeof id==='string'&&id.startsWith('native:'))return Number(id.slice(7));
  return rewardNativeItemId(item)||resources[id]||null;
}
export function itemDescriptionModel(item={},snapshot={}) {
  const id=descriptionItemId(item),canonical=id?nativeItemPresentation(id):{};
  const owned=snapshot.nativeAcquisition?.materials?.find(row=>Number(row.id)===id);
  const walletKey=walletKeys[id]||item.type||item.id;
  // An absent item in a canonical inventory means zero. Never use receipt
  // amounts, offer quantities or level/star counts as the held item count.
  const gear=id&&nativeGearPresentation(id);
  const count=gear?(snapshot.equipment?.items?.filter(row=>Number(row.nativeId)===id).length??null):id===4?snapshot.wallet?.stamina:
    id&&snapshot.nativeAcquisition?owned?.count??0:snapshot.wallet?.[walletKey];
  const description=canonical.description||item.description||({
    1:'用于装备强化、科研升级等养成。',2:'用于商城兑换、补给和驾驶员招募。',
    3:'用于提升玩家等级。',4:'出击关卡时消耗，随时间恢复。',135:'用于天赋觉醒。',
  })[id]||(gear?'可在装备界面装配、强化或合成。':'暂无道具说明。');
  const qualityItem=item.qualityKnown===false?{...item,qualityRank:undefined}:item;
  const qualityPresentation=canonical.qualityKnown===false?{...canonical,qualityRank:undefined}:canonical;
  return {id,name:canonical.name||item.name||item.label||'道具',
    image:canonical.image||item.image,description,
    count:Number.isFinite(count)?Math.max(0,Math.floor(count)):null,
    ...rewardDisplayQuality({...qualityItem,type:item.type||(gear?'gear':undefined),...(id?{nativeItemId:id}:{})},qualityPresentation)};
}

export function itemInspectAttributes(id,escape=String) {
  if(id==null)return '';
  const nativeId=descriptionItemId({itemId:id});
  const name=(nativeId?nativeItemPresentation(nativeId).name:null)||({coins:"金币",diamonds:"钻石",aircraftShards:"机体碎片",weaponParts:"武器零件"})[id]||"道具";
  return `data-item-inspect="" data-item-id="${escape(id)}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="查看${escape(name)}详情"`;
}
