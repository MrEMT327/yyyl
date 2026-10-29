import { emptySlotMark } from './psd-empty-slot.js';
import { equippedSlots, slotLabel } from './equipment-labels.js';

export const WEAPON_EQUIP_SLOTS = ['W3', 'W4', 'W5', 'W6'];

// Presentation only: ownership and loadout validation remain in the peripheral system.
export function weaponEquipControls({ snapshot, weapon, selectedSlot, helpers, showStatus = true, requireSlotSelection = false }) {
  const { escape: e, thumbnail, button } = helpers;
  const fitted = equippedSlots(snapshot, weapon.id);
  const innate = fitted.includes('W1');
  if (fitted.length) {
    return `<section class="weapon-equip-controls">${showStatus ? `<p class="weapon-equip-status">已装备 · ${fitted.map(slotLabel).join(' / ')}</p>` : ''}${innate ? '' : button('unequipWeapon', '卸下武器', 'weapon-equip-remove', `data-slot="${fitted[0]}"`)}</section>`;
  }
  if (!weapon.owned) {
    return `<section class="weapon-equip-controls">${button('equipWeapon', '前往商城宝箱', 'weapon-equip-confirm', `data-id="${e(weapon.id)}"`)}</section>`;
  }
  const currentWeapon = slot => {
    const value = snapshot.loadout[slot];
    return snapshot.weapons.find(w => w.id === (value?.itemId || value?.id || value));
  };
  const target = WEAPON_EQUIP_SLOTS.includes(selectedSlot) ? selectedSlot : requireSlotSelection ? null : WEAPON_EQUIP_SLOTS.find(slot=>!currentWeapon(slot)) || 'W3';
  const replaced = currentWeapon(target);
  return `<section class="weapon-equip-controls" aria-labelledby="weapon-equip-title">
    <h3 id="weapon-equip-title">选择装配位置</h3>
    <div class="weapon-equip-slots" role="group" aria-labelledby="weapon-equip-title">${WEAPON_EQUIP_SLOTS.map(slot => {
      const current = currentWeapon(slot), active = target === slot;
      return `<button type="button" class="weapon-equip-slot ${active ? 'is-selected' : ''}" data-action="pickSlot" data-slot="${slot}" aria-pressed="${active}" aria-label="${slotLabel(slot)}，${e(current?.name || '空闲，可装配')}"><span class="weapon-equip-slot-heading"><b>${slotLabel(slot)}</b><span aria-hidden="true">${active ? '✓ 已选' : current ? '已装配' : '空闲'}</span></span><span class="weapon-equip-slot-item">${current ? thumbnail(current.id) : emptySlotMark('weapon-equip-empty')}<span>${e(current?.name || '可装配武器')}</span></span></button>`;
    }).join('')}</div>
    <p id="weapon-equip-hint" class="weapon-equip-hint" role="status">${!target?'选择要替换的位置':replaced ? `替换「${e(replaced.name)}」` : `${slotLabel(target)} · 空闲`}</p>
    ${button('equipWeapon', !target?'选择替换位置':replaced ? `替换${slotLabel(target)}武器` : `装备至${slotLabel(target)}`, 'weapon-equip-confirm', `data-id="${e(weapon.id)}" aria-describedby="weapon-equip-hint"`, !target)}
  </section>`;
}
