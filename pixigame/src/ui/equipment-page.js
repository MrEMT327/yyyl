import { resourceIcon } from './resource-icons.js';
// Presentation-only equipment screen. Slot IDs, ownership and progression remain canonical.
import { equippedSlots } from './equipment-labels.js';
import { cardSelection } from './card-selection.js';
import { lobbyResources } from './lobby-resources.js';
import { lobbyPageHeading } from './lobby-header.js';
import { catalogWeaponArtwork } from './weapon-catalog-page.js';
import './equipment-toolbar.css';
import { airframeEquipmentPage } from './airframe-equipment-page.js';

const baseUrl = import.meta.env?.BASE_URL ?? '/';
const art = name => `${baseUrl}art/equipment-comic-v1/${name}`;
const extraIcons = new Set(['star','lock','heart','user-astronaut','crosshairs','angles-right','exclamation']);
const glyph = (name, cls='') => resourceIcon(name, "eq-icon " + cls) || `<img class="eq-icon ${cls}" src="${extraIcons.has(name) ? art(`icons/${name}.svg`) : `${baseUrl}art/shop-comic-v1/icons/${name}.svg`}" alt="" aria-hidden="true" draggable="false">`;
const qualityColors = ['#91a8bc','#08cf8f','#16aaf4','#a24bff','#ffdd35','#f05f83'];
const qualityNames = ['普通','优秀','稀有','史诗','传说','神话'];

export function equipmentHeader({snapshot:s,helpers:h}) {
  return `${lobbyPageHeading({helpers:h,title:'装备',icon:glyph('wrench')})}${lobbyResources({snapshot:s,helpers:h},'equipmentShop')}`;
}

export function equipmentPage(ctx,{gearSort='quality',gearFilter='all'}={}) {
  return airframeEquipmentPage(ctx,{sort:gearSort,filter:gearFilter});
}

export function equipmentWeaponCard(w, ctx, {selected, innateId, action = 'equipmentWeapon'} = {}) {
  const {snapshot:s,helpers:h}=ctx, {escape:e,number:n}=h;
  const equipped=id=>equippedSlots(s,id).length>0;
    const quality=Math.max(0,Math.min(5,Number(w.qualityRank)||0)), fitted=equipped(w.id), locked=!w.owned&&w.id!==innateId;
    return `<button type="button" class="eq-card ${selected===w.id?'is-selected':''} ${locked?'is-locked':''}" data-frame-quality="${quality}" data-psd-quality="${quality}" style="--eq-quality:${qualityColors[quality]}" data-action="${action}" data-id="${e(w.id)}" aria-pressed="${selected===w.id}" aria-label="${e(w.name)}，${qualityNames[quality]}，等级${w.level||1}${locked?'，未解锁':fitted?'，已装备':''}" aria-description="${e(w.name)}"><span class="eq-card-inner"><span class="eq-card-art">${catalogWeaponArtwork(w,h)}</span><strong class="eq-card-name">${e(w.name)}</strong><span class="eq-card-stars" aria-label="${qualityNames[quality]}">${Array.from({length:5},(_,i)=>glyph('star',i<quality?'is-earned':'')).join('')}</span><b class="eq-card-level">Lv.${n(w.level||1)}</b></span>${cardSelection(selected===w.id)}${locked?glyph('lock','eq-card-lock'):fitted?`<span class="eq-card-equipped">${w.id===innateId?'专属':'已装备'}</span>`:''}</button>`;
}
