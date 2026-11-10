import './psd-quality-frames.css';
import './reward-item-slot.css';
import {ITEM_QUALITY_TIERS} from '../replica/item-display-quality.js';
import {nineSliceGeometry} from './nine-slice-geometry.js';
import {cloudAssetBase} from './cloud-asset-base.js';

const FRAME_SIZE=128;
const FRAME_SLICE=18;
const slotTier=({qualityRank,qualityKnown})=>qualityKnown!==false&&Number.isInteger(qualityRank)
  ? ITEM_QUALITY_TIERS[qualityRank] : undefined;
import {qualityDisplayLabel} from './quality-display-label.js';
const quantity=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;

export function rewardSlotAmount(value) {
  const count=quantity(value);
  const unit=count>=1e8?1e8:count>=1e4?1e4:1;
  return `${Math.floor(count/unit*10)/10}${unit===1e8?'亿':unit===1e4?'万':''}`;
}
// Match the PSD plate, centred art window and quantity style in reward-item-slot.css.
export function paintRewardItemSlot(surface, row, {x,y,size}, paintImage) {
  const tier=slotTier(row)?.color??'empty';
  const frame=paintImage(surface,`${cloudAssetBase}art/psd-equipment-v1/frame-${tier}.png`,x,y,size,size,false);
  frame.geometry.dispose();
  frame.geometry=nineSliceGeometry(size,size,FRAME_SIZE,FRAME_SIZE,FRAME_SLICE,size*FRAME_SLICE/FRAME_SIZE);

  const artWidth=size*.8,artHeight=size*.71;
  paintImage(surface,row.image,x+(size-artWidth)/2,y+(size-artHeight)/2,artWidth,artHeight);

  const fontSize=size*.22;
  surface.text('×'+rewardSlotAmount(row.amount),x+size*.91,y+size*.94-fontSize*.4,{
    size:fontSize,weight:400,family:'PsdPopup,"Microsoft YaHei",sans-serif',
    color:'#fff3cd',outline:'#102234',align:'right',maxWidth:size*.84,
  });
}
// Shared square for receipts, sign-in rewards and inventory. The caller owns
// identity/quality; this renderer never grants, upgrades or samples an item.
export function rewardItemSlot({name='道具',amount=1,artwork='',qualityRank,qualityName,qualityKnown,overlay='',className='',itemId,showQuantity=true,inspectable=true,isNew=false},h) {
  const e=h.escape,tier=slotTier({qualityRank,qualityKnown});
  const quality=tier?(qualityName||tier.name):'未标注';
  const exact=quantity(amount).toLocaleString('zh-CN', {useGrouping:false});
  return `<span class="reward-item-slot common-reward-item-frame${className?' '+e(className):''}" data-psd-quality="${tier?.rank??0}" data-quality-known="${Boolean(tier)}"${itemId!=null?` data-item-id="${e(itemId)}"`:''} ${inspectable?'data-item-inspect="" data-item-name="'+e(name)+'" role="button" tabindex="0" aria-haspopup="dialog"':'role="img"'} aria-label="${e(name)}，${e(quality)}${showQuantity?`，数量 ${exact}`:''}${isNew?'，新获得':''}" aria-description="${e(name)} · ${e(quality)}${showQuantity?` · ${exact}`:''}"><span class="reward-item-art">${artwork}</span>${isNew?'<span class="reward-item-new" aria-hidden="true">新</span>':''}${showQuantity?`<b class="reward-item-quantity common-reward-quantity">×${rewardSlotAmount(amount)}</b>`:''}${overlay?`<span class="reward-item-overlay">${overlay}</span>`:''}</span>`;
}
