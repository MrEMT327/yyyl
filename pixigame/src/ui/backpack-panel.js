import { backpackUseControls } from './backpack-use-controls.js';
import { nativeItemArt, nativeItemPresentation } from '../replica/native-item-presentation.js';
import { supplyWeaponArt } from './supply-visuals.js';
import { RESOURCE_ICONS } from './resource-icons.js';
import './backpack-assets.css';
import './backpack-reference.css';

export const BACKPACK_TABS = Object.freeze([
  { id: 'all', label: '道具' },
]);

const quantity = value => Number.isFinite(Number(value)) ? Math.max(0, Math.floor(Number(value))) : 0;
const exactCount = value => quantity(value).toLocaleString('zh-CN');
const itemQuality = item => Number.isInteger(item.qualityRank) && item.qualityRank >= 0 && item.qualityRank <= 5 ? item.qualityRank : 0;
const resourceQuality = id => {
  const nativeId=({coins:1,diamonds:2,stamina:4,cores:135})[id];
  return nativeId?nativeItemPresentation(nativeId).qualityRank??0:0;
};
function compactCount(value) {
  const count = quantity(value);
  const [unit, suffix] = count >= 1e8 ? [1e8, '亿'] : count >= 1e4 ? [1e4, '万'] : [1, ''];
  return `${Math.floor(count / unit * 10) / 10}${suffix}`;
}

// A read-only projection of canonical balances: no placeholder items or grants.
export function backpackItems(snapshot) {
  const wallet = snapshot.wallet || {};
  if(snapshot.nativeAcquisition) {
    const rows=snapshot.nativeAcquisition.materials.map(row=>{
      const presentation=nativeItemPresentation(row.id);
      return {
        id:'native:'+row.id,nativeId:row.id,name:presentation.name||row.name,count:row.count,
        category:[1,2].includes(row.id)?'resources':'materials',image:presentation.image,pilotFragment:presentation.pilotFragment,
        qualityRank:presentation.qualityRank??row.qualityRank??0,
        description:presentation.description||(row.id===1?'用于装备强化和收藏养成。':row.id===2?'用于商城兑换和补给。':''),
      };
    });
    if(wallet.stamina>0)rows.push({id:'stamina',name:'体力',count:wallet.stamina,category:'resources',image:nativeItemArt(4),qualityRank:resourceQuality('stamina'),description:'用于出击关卡，随时间恢复。'});
    return rows;
  }
  const materials = [
    { id: 'aircraftShards', name: '通用飞机碎片', symbol: 'shard', description: '在装备界面强化战机，提升攻击与耐久。' },
    { id: 'weaponParts', name: '武器零件', symbol: 'parts', description: '在改装间强化武器，或补足升星所缺的专属碎片。' },
    { id: 'cores', name: '科技星核', symbol: 'core', description: '在天赋界面进行王牌觉醒。' },
  ].map(item => ({ ...item, category: 'materials', count: quantity(wallet[item.id]),qualityRank:resourceQuality(item.id) }));
  const fragments = (snapshot.workshop?.items || []).map(item => ({
    id: `fragment:${item.id}`, name: `${item.name}碎片`, category: 'materials',
    count: quantity(item.fragments), weaponId: item.id,qualityRank:itemQuality(item),
    description: `用于【${item.name}】升星，优先于通用零件消耗。`,
  }));
  const resources = [
    { id: 'coins', name: '金币', symbol: 'coin', description: '用于战机、武器强化和常规觉醒。' },
    { id: 'diamonds', name: '钻石', symbol: 'diamond', description: '用于招募和商城兑换。' },
    { id: 'stamina', name: '体力', symbol: 'energy', description: '用于出击关卡和快速巡逻。体力会随时间恢复。' },
  ].map(item => ({ ...item, category: 'resources', count: quantity(wallet[item.id]),qualityRank:resourceQuality(item.id) }));
  return [...materials, ...fragments, ...resources].filter(item => item.count > 0);
}

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
  const cards = items.map(item => `<button type="button" class="bag-item" data-action="bagItem" data-id="${e(item.id)}" aria-haspopup="dialog" aria-label="${e(item.name)}，数量 ${exactCount(item.count)}"><span class="bag-item-art" data-psd-quality="${itemQuality(item)}">${itemArt(item, helpers)}<b class="bag-item-count">${compactCount(item.count)}</b></span><span class="bag-item-name">${e(item.id==='aircraftShards'?'飞机碎片':item.name)}</span></button>`).join('');
  return `<div class="pl-modal-backdrop bag-backdrop" data-action="dismiss">
    <section class="pl-modal bag-modal" data-psd-popup="primary" data-modal-type="backpack" role="dialog" aria-modal="${!detail}" aria-labelledby="lobby-modal-title" tabindex="-1" ${detail ? 'inert aria-hidden="true"' : ''}>
      <header class="pl-modal-heading bag-heading"><h2 id="lobby-modal-title">背包</h2>${close('close', '关闭背包')}</header>
      <div class="pl-modal-content bag-content">
        <div class="bag-grid" id="backpack-items" role="tabpanel" aria-labelledby="bag-tab-${tab.id}" tabindex="0">${cards || `<p class="bag-empty">${tab.id === 'all' ? '背包里还没有道具' : `暂无${tab.label}`}</p>`}</div>
        <nav class="bag-tabs" role="tablist" aria-label="背包分类">${BACKPACK_TABS.map(item => `<button type="button" class="bag-tab psd-tab ${item.id === tab.id ? 'is-selected' : ''}" id="bag-tab-${item.id}" role="tab" aria-selected="${item.id === tab.id}" aria-controls="backpack-items" tabindex="${item.id === tab.id ? 0 : -1}" data-action="bagTab" data-tab="${item.id}">${item.label}</button>`).join('')}</nav>
      </div>
    </section>
    ${detail ? `<div class="bag-detail-backdrop" data-action="bagDetailDismiss"><section class="bag-detail" data-psd-popup="secondary" role="dialog" aria-modal="true" aria-labelledby="bag-detail-title" aria-describedby="bag-detail-description" tabindex="-1">
      <header class="bag-detail-header"><div class="bag-detail-icon" data-psd-quality="${itemQuality(detail)}">${itemArt(detail, helpers)}</div><div class="bag-detail-info"><h3 id="bag-detail-title">${e(detail.name)}</h3><p>数量：<strong>${exactCount(detail.count)}</strong></p></div>${close('bagDetailClose', '关闭道具详情')}</header>
      <div class="bag-detail-body"><h4>道具详情</h4><p id="bag-detail-description">${e(detail.description)}</p>${snapshot.nativeAcquisition?backpackUseControls(detail,snapshot,state,helpers):''}</div>
    </section></div>` : ''}
  </div>`;
}
