import './psd-quality-frames.css';
import './reward-item-slot.css';
import {ITEM_QUALITY_TIERS} from '../replica/item-display-quality.js';
const quantity=value=>Number.isFinite(Number(value))?Math.max(0,Math.floor(Number(value))):0;

export function rewardSlotAmount(value) {
  const count=quantity(value);
  const unit=count>=1e8?1e8:count>=1e4?1e4:1;
  return `${Math.floor(count/unit*10)/10}${unit===1e8?'亿':unit===1e4?'万':''}`;
}
// Shared square for receipts, sign-in rewards and inventory. The caller owns
// identity/quality; this renderer never grants, upgrades or samples an item.
export function rewardItemSlot({name='道具',amount=1,artwork='',qualityRank=0,qualityName,qualityKnown=true,overlay='',className='',itemId},h) {
  const e=h.escape,rank=Number.isInteger(qualityRank)&&qualityRank>=0&&qualityRank<=5?qualityRank:0;
  const quality=qualityName||(qualityKnown?ITEM_QUALITY_TIERS[rank].name:'未标注');
  const exact=quantity(amount).toLocaleString('zh-CN');
  return `<span class="reward-item-slot common-reward-item-frame${className?' '+e(className):''}" data-psd-quality="${rank}" data-quality-known="${Boolean(qualityKnown)}"${itemId!=null?` data-item-id="${e(itemId)}"`:''} role="img" aria-label="${e(name)}，${e(quality)}，数量 ${exact}" title="${e(name)} · ${e(quality)} · ${exact}"><span class="reward-item-art">${artwork}</span><b class="reward-item-quantity common-reward-quantity">×${rewardSlotAmount(amount)}</b>${overlay?`<span class="reward-item-overlay">${overlay}</span>`:''}</span>`;
}
