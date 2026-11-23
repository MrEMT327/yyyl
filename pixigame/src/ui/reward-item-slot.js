import './psd-quality-frames.css';
import './reward-item-slot.css';
import {slotTier,quantity,rewardSlotAmount} from './reward-item-art.js';
export {rewardSlotAmount,paintRewardItemSlot} from './reward-item-art.js';

// Shared square for receipts, sign-in rewards and inventory. The caller owns
// identity/quality; this renderer never grants, upgrades or samples an item.
export function rewardItemSlot({name='道具',amount=1,artwork='',qualityRank,qualityName,qualityKnown,overlay='',className='',itemId,showQuantity=true,inspectable=true,isNew=false},h) {
  const e=h.escape,tier=slotTier({qualityRank,qualityKnown});
  const quality=tier?(qualityName||tier.name):'未标注';
  const exact=quantity(amount).toLocaleString('zh-CN', {useGrouping:false});
  return `<span class="reward-item-slot common-reward-item-frame${className?' '+e(className):''}" data-psd-quality="${tier?.rank??0}" data-quality-known="${Boolean(tier)}"${itemId!=null?` data-item-id="${e(itemId)}"`:''} ${inspectable?'data-item-inspect="" data-item-name="'+e(name)+'" role="button" tabindex="0" aria-haspopup="dialog"':'role="img"'} aria-label="${e(name)}，${e(quality)}${showQuantity?`，数量 ${exact}`:''}${isNew?'，新获得':''}" aria-description="${e(name)} · ${e(quality)}${showQuantity?` · ${exact}`:''}"><span class="reward-item-art">${artwork}</span>${isNew?'<span class="reward-item-new" aria-hidden="true">新</span>':''}${showQuantity?`<b class="reward-item-quantity common-reward-quantity">×${rewardSlotAmount(amount)}</b>`:''}${overlay?`<span class="reward-item-overlay">${overlay}</span>`:''}</span>`;
}
