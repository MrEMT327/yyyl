// Storage and combat retain stable slot IDs; players see numbered Chinese labels.
export const slotLabel = slot => `槽${String(slot).replace(/^W/, '')}`;
export function equippedSlots(snapshot, weaponId) {
  const innate = snapshot.innateWeapon || snapshot.aircraft?.find(a => a.id === snapshot.aircraftId)?.weaponId;
  if (innate === weaponId) return ['W1', 'W2'];
  return Object.entries(snapshot.loadout || {}).filter(([, value]) => (value?.itemId || value?.id || value) === weaponId).map(([slot]) => slot);
}

export const WEAPON_EQUIP_SLOTS = ['W3', 'W4', 'W5', 'W6'];

// Presentation only: ownership and loadout validation remain in the peripheral system.
