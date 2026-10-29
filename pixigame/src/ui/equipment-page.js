import { lobbyNavigation } from './lobby-navigation.js';
import { resourceIcon } from './resource-icons.js';
// Presentation-only equipment screen. Slot IDs, ownership and progression remain canonical.
import { equippedSlots } from './equipment-labels.js';
import { cardSelection } from './card-selection.js';
import { lobbyResources } from './lobby-resources.js';
import { lobbyPageHeading } from './lobby-header.js';
import { catalogWeaponArtwork } from './weapon-catalog-page.js';
import { equipmentToolbar } from './equipment-toolbar.js';
import { emptySlotMark } from './psd-empty-slot.js';
import { airframeEquipmentPage } from './airframe-equipment-page.js';

const baseUrl = import.meta.env?.BASE_URL ?? '/';
const art = name => `${baseUrl}art/equipment-comic-v1/${name}`;
const extraIcons = new Set(['star','lock','heart','user-astronaut','crosshairs','angles-right','exclamation']);
const glyph = (name, cls='') => resourceIcon(name, "eq-icon " + cls) || `<img class="eq-icon ${cls}" src="${extraIcons.has(name) ? art(`icons/${name}.svg`) : `${baseUrl}art/shop-comic-v1/icons/${name}.svg`}" alt="" aria-hidden="true" draggable="false">`;
const qualityColors = ['#91a8bc','#08cf8f','#16aaf4','#a24bff','#ffdd35','#f05f83'];
const qualityNames = ['普通','优秀','稀有','史诗','传说','神话'];
const valueId = value => typeof value === 'object' ? value?.itemId || value?.id : value;
export const equipmentSlotLabel = slot => ({W1:'专属武器',W2:'专属武器',W3:'武器槽3',W4:'武器槽4',W5:'武器槽5',W6:'武器槽6'}[slot] || slot);

export function equipmentHeader({snapshot:s,helpers:h}) {
  return `${lobbyPageHeading({helpers:h,title:'装备',icon:glyph('wrench')})}${lobbyResources({snapshot:s,helpers:h},'equipmentShop')}`;
}

export function equipmentNavigation() { return lobbyNavigation('assembly'); }

export function equipmentPage(ctx, {filter='owned',sort='quality',selectedWeapon,selectedSlot='W3',pickingSlot=false,gearSort='quality',gearFilter='all'}={}) {
  if(ctx.snapshot.equipment&&!pickingSlot)return airframeEquipmentPage(ctx,{sort:gearSort,filter:gearFilter});
  const {snapshot:s,helpers:h} = ctx, {escape:e,number:n,thumbnail} = h;
  const a = s.aircraft.find(item=>item.id===s.aircraftId) || s.aircraft[0];
  const innateId = s.innateWeapon || a?.weaponId;
  const main = s.weapons.find(w=>w.id===innateId);
  const selected = selectedWeapon || innateId;
  const equipped = id => equippedSlots(s,id).length>0;
  const allowed = w => filter==='owned' ? w.owned : filter==='equipped' ? equipped(w.id) : filter==='locked' ? !w.owned && w.id!==innateId : filter==='available' ? w.owned && !equipped(w.id) : true;
  const items = s.weapons.filter(allowed).sort((x,y) => Number(y.owned||y.id===innateId)-Number(x.owned||x.id===innateId)
    || (sort==='level' ? (y.level||1)-(x.level||1) : sort==='name' ? x.name.localeCompare(y.name,'zh-CN') : (y.qualityRank||0)-(x.qualityRank||0))
    || (y.level||1)-(x.level||1) || x.id.localeCompare(y.id));
  const alert = ready => ready ? `<span class="eq-upgrade-ready" role="img" aria-label="可升级">${glyph('angles-right')}</span>` : '';
  const mount = (label,position,w,action,attributes,ready=false) => {
    const active=pickingSlot&&attributes.includes(`data-slot="${selectedSlot}"`);
    const quality=Math.max(0,Math.min(5,Math.floor(Number(w?.qualityRank)||0)));
    return `<button type="button" class="eq-mount ${position} ${w?'is-filled':'is-empty'} ${active?'is-selected':''}" data-frame-quality="${quality}" data-psd-quality="${quality}" data-action="${action}" ${attributes} aria-label="${e(label)}，${e(w?.name||'空槽，选择武器')}${active?'，当前选择':''}" title="${e(w?.name||label)}"><span class="eq-mount-inner"><strong>${e(label)}</strong><span class="eq-mount-art">${w?catalogWeaponArtwork(w,h):emptySlotMark('eq-icon eq-empty-plus')}</span>${w?`<b>Lv.${n(w.level||1)}</b>`:''}</span>${cardSelection(active)}${alert(ready)}</button>`;
  };
  const slotMount = (slot,position) => {const w=s.weapons.find(w=>w.id===valueId(s.loadout[slot]));return mount(equipmentSlotLabel(slot),position,w,'equipmentSlot',`data-slot="${slot}"`,w?.canUpgrade);};
  const card = w => equipmentWeaponCard(w, ctx, {selected, innateId});
  return `<section class="eq-page" aria-label="战机装备"><div class="eq-hangar">
    <div class="eq-aircraft-stage pl-live-model" aria-label="${e(a?.name||'当前战机')}">${h.preview?.(a?.id,{name:a?.name})||h.thumbnail(a?.id,'eq-aircraft-fallback')}</div>
    ${mount('专属武器','is-main',main,'weapon',`data-id="${e(innateId)}"`,main?.canUpgrade)}
    ${slotMount('W3','is-aux-one')}${slotMount('W4','is-aux-two')}
    ${mount('专属武器','is-aircraft',main,'weapon',`data-id="${e(innateId)}"`,main?.canUpgrade)}
    ${slotMount('W5','is-aux-three')}${slotMount('W6','is-aux-four')}
    <button type="button" class="eq-stat-row" data-action="formation" aria-label="查看出战阵容，攻击${n(s.combatStats?.attack??a?.attack)}，耐久${n(s.combatStats?.maxHp??a?.hp)}"><span aria-label="攻击 ${n(s.combatStats?.attack??a?.attack)}">${glyph('crosshairs','eq-attack')}<b>${n(s.combatStats?.attack??a?.attack)}</b></span><span aria-label="耐久 ${n(s.combatStats?.maxHp??a?.hp)}">${glyph('heart','eq-hp')}<b>${n(s.combatStats?.maxHp??a?.hp)}</b></span></button>
    <div class="eq-catalog-row" aria-label="装备分类"><button type="button" data-action="equipmentWeapons" aria-label="管理武器">${glyph('crosshairs')}<strong>武器</strong></button><button type="button" data-action="catalog" data-kind="aircraft" aria-label="管理战机">${glyph('jet-fighter','eq-plane')}<strong>战机</strong></button><button type="button" data-action="catalog" data-kind="pilot" aria-label="管理驾驶员">${glyph('user-astronaut')}<strong>驾驶员</strong></button></div>
  </div>
  ${equipmentToolbar({sort,filter},e)}
  ${pickingSlot?`<div class="eq-pick-hint" role="status">正在选择：${equipmentSlotLabel(selectedSlot)}<button type="button" data-action="equipmentCancelPick">取消</button></div>`:''}
  <div class="eq-inventory" aria-labelledby="eq-inventory-title"><div class="eq-card-grid">${items.map(card).join('')}</div>${!items.length?`<div class="eq-empty"><p>${filter==='available'?'暂无可装配武器':'暂无符合条件的武器'}</p><button type="button" data-action="equipmentShowAll">查看已拥有武器</button></div>`:''}<div class="eq-inventory-footer"><span>已拥有 ${s.weapons.filter(w=>w.owned).length} / ${s.weapons.length}</span></div></div></section>`;
}

export function equipmentWeaponCard(w, ctx, {selected, innateId, action = 'equipmentWeapon'} = {}) {
  const {snapshot:s,helpers:h}=ctx, {escape:e,number:n,thumbnail}=h;
  const equipped=id=>equippedSlots(s,id).length>0;
    const quality=Math.max(0,Math.min(5,Number(w.qualityRank)||0)), fitted=equipped(w.id), locked=!w.owned&&w.id!==innateId;
    return `<button type="button" class="eq-card ${selected===w.id?'is-selected':''} ${locked?'is-locked':''}" data-frame-quality="${quality}" data-psd-quality="${quality}" style="--eq-quality:${qualityColors[quality]}" data-action="${action}" data-id="${e(w.id)}" aria-pressed="${selected===w.id}" aria-label="${e(w.name)}，${qualityNames[quality]}，等级${w.level||1}${locked?'，未解锁':fitted?'，已装备':''}" title="${e(w.name)}"><span class="eq-card-inner"><span class="eq-card-art">${catalogWeaponArtwork(w,h)}</span><strong class="eq-card-name">${e(w.name)}</strong><span class="eq-card-stars" aria-label="${qualityNames[quality]}">${Array.from({length:5},(_,i)=>glyph('star',i<quality?'is-earned':'')).join('')}</span><b class="eq-card-level">Lv.${n(w.level||1)}</b></span>${cardSelection(selected===w.id)}${locked?glyph('lock','eq-card-lock'):fitted?`<span class="eq-card-equipped">${w.id===innateId?'专属':'已装备'}</span>`:''}</button>`;
}
