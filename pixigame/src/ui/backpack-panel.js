import { backpackItems, BACKPACK_TABS, exactCount, itemQuality } from './backpack-model.js';
export { backpackItems, BACKPACK_TABS } from './backpack-model.js';
import { backpackUseControls } from './backpack-use-controls.js';
import { supplyWeaponArt } from './supply-visuals.js';
import { RESOURCE_ICONS } from './resource-icons.js';
import {rewardDisplayQuality} from '../replica/item-display-quality.js';
import {rewardItemSlot} from './reward-item-slot.js';
import './backpack-assets.css';
import './backpack-reference.css';

const itemArt = (item, helpers) => {
  if(item.nativeId||item.image)return item.image
    ? `<img class="bag-owned-art" src="${helpers.escape(item.image)}" alt="" aria-hidden="true" draggable="false">${item.pilotFragment?'<span class="bag-fragment-badge">碎片</span>':''}`
    : `<span class="bag-owned-art">${helpers.escape(item.name)}</span>`;
  if(item.weaponId)return supplyWeaponArt({id:item.weaponId},helpers.thumbnail);
  return `<img class="bag-owned-art" src="${RESOURCE_ICONS[item.id].url}" alt="" aria-hidden="true" draggable="false">`;
};

export function backpackDialog(snapshot, state, helpers) {
  const { escape: e } = helpers;
  const tab = BACKPACK_TABS.find(item => item.id === state.bagTab) || BACKPACK_TABS[0];
  const all = backpackItems(snapshot);
  const items = all.filter(item => tab.id === 'all' || item.category === tab.id);
  const detail = all.find(item => item.id === state.bagItem);
  const close = (action, label) => `<button type="button" class="bag-close" data-action="${action}" aria-label="${label}"></button>`;
  const slot=(item,className,showQuantity=true)=>rewardItemSlot({inspectable:false,name:item.name,amount:item.count,showQuantity,artwork:itemArt(item,helpers),qualityRank:itemQuality(item),qualityName:item.qualityName,qualityKnown:item.qualityKnown??true,itemId:item.nativeId??item.id,className},helpers);
  const cards = items.map(item => `<button type="button" class="bag-item" data-action="bagItem" data-id="${e(item.id)}" aria-haspopup="dialog" aria-label="${e(item.name)}，数量 ${exactCount(item.count)}">${slot(item,'bag-item-art')}<span class="bag-item-name">${e(item.id==='aircraftShards'?'飞机碎片':item.name)}</span></button>`).join('');
  const multipleTabs=BACKPACK_TABS.length>1;
  return `<div class="pl-modal-backdrop bag-backdrop" data-action="dismiss">
    <section class="pl-modal bag-modal" data-psd-popup="primary" data-modal-type="backpack" role="dialog" aria-modal="${!detail}" aria-labelledby="lobby-modal-title" tabindex="-1" ${detail ? 'inert aria-hidden="true"' : ''}>
      <header class="pl-modal-heading bag-heading"><h2 id="lobby-modal-title">背包</h2>${close('close', '关闭背包')}</header>
      <div class="pl-modal-content bag-content">
        <div class="bag-grid" id="backpack-items" ${multipleTabs?`role="tabpanel" aria-labelledby="bag-tab-${tab.id}"`:'role="region" aria-label="道具"'} tabindex="0">${cards || `<p class="bag-empty">${tab.id === 'all' ? '背包里还没有道具' : `暂无${tab.label}`}</p>`}</div>
        ${multipleTabs?`<nav class="bag-tabs" role="tablist" aria-label="背包分类">${BACKPACK_TABS.map(item => `<button type="button" class="bag-tab psd-tab ${item.id === tab.id ? 'is-selected' : ''}" id="bag-tab-${item.id}" role="tab" aria-selected="${item.id === tab.id}" aria-controls="backpack-items" tabindex="${item.id === tab.id ? 0 : -1}" data-action="bagTab" data-tab="${item.id}">${item.label}</button>`).join('')}</nav>`:''}
      </div>
    </section>
    ${detail ? `<div class="bag-detail-backdrop" data-action="bagDetailDismiss"><section class="bag-detail" data-psd-popup="secondary" role="dialog" aria-modal="true" aria-labelledby="bag-detail-title" aria-describedby="bag-detail-description" tabindex="-1">
      <h3 id="bag-detail-title" class="bag-detail-title">${e(detail.name)}</h3>
      <header class="bag-detail-header">${slot(detail,'bag-detail-icon',false)}<div class="bag-detail-info"><p>数量：<strong>${exactCount(detail.count)}</strong></p></div>${close('bagDetailClose', '关闭道具详情')}</header>
      <div class="bag-detail-body"><p id="bag-detail-description">${e(detail.description)}</p>${snapshot.nativeAcquisition?backpackUseControls(detail,snapshot,state,helpers):''}</div>
    </section></div>` : ''}
  </div>`;
}
