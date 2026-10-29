import { GENERAL_SLOTS, PERIPHERAL_AIRCRAFT_MAP } from '../peripheral/config.js';
import { COMMON_WEAPONS } from '../fixed-parts/common-weapons.js';

// Browsing another aircraft shows that aircraft's saved fit, never the selected
// aircraft's auxiliary weapons. Item ids and physical seats match combat.
export function peripheralModelLoadout(aircraftId, snapshot = {}) {
  const aircraft = snapshot.aircraft?.find(a => a.id === aircraftId);
  const innate = aircraft?.weaponId || PERIPHERAL_AIRCRAFT_MAP.get(aircraftId)?.weaponId;
  const slots = aircraft?.loadout || (snapshot.aircraftId === aircraftId ? snapshot.loadout : {}) || {};
  const catalog = new Map((snapshot.weapons || []).map(w => [w.id, w]));
  const weapons = innate ? [{ id: `${aircraftId}/innate/${innate}`, itemId: innate,
    slots: ['W1', 'W2'], kind: 'weapon', innate: true, qualityRank: 0, level: 1 }] : [];
  const seen = new Set([innate]);
  for (const slot of GENERAL_SLOTS) {
    const id = slots[slot], owned = catalog.get(id);
    if (!COMMON_WEAPONS[id] || owned?.owned === false || seen.has(id)) continue;
    seen.add(id);
    weapons.push({ id: `${aircraftId}/common/${id}`, itemId: id, slots: [slot], kind: 'weapon', innate: false,
      qualityRank: owned?.qualityRank || 0, level: owned?.level || 1 });
  }
  return { version: 3, common: true, pilotId: aircraftId, aircraftId, weapons, connectors: [] };
}

export const peripheralModelLoadoutKey = loadout => JSON.stringify(loadout.weapons.map(w => [w.itemId, w.slots, w.qualityRank]));
