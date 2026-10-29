import equipment from './loadout-equipment-index.json' with {type:'json'};

// The original table's overall range is a save/transport boundary. A particular
// quality's maxLevel gates further reinforcement, never inherited part levels.
export const NATIVE_EQUIPMENT_LEVEL_MAX=Math.max(...equipment.equipment.map(row=>row.maxLevel));
export const normalizeEquipmentPartLevel=value=>Math.max(1,Math.min(NATIVE_EQUIPMENT_LEVEL_MAX,Math.round(Number(value))||1));
export const isEquipmentPartLevel=value=>Number.isInteger(value)&&value>=1&&value<=NATIVE_EQUIPMENT_LEVEL_MAX;
