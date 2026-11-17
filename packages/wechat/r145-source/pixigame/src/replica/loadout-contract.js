import index from './loadout-equipment-index.json' with { type: 'json' };

import { validateReplicaProgression } from './native-progression.js';
import { normalizeWeaponChapterProgress } from './chapter-weapon-access.js';
import {normalizeEquipmentPartLevel,isEquipmentPartLevel} from './native-equipment-level.js';

const rows = new Map(index.equipment.map(row => [row.id, row]));

// Transfer source IDs and progression only. The replica owns every formula.
// Aircraft/pilot art IDs, legacy modifiers and research-card IDs are not
// interchangeable with native plane/pilot/gun/lab progression IDs.
export function validateReplicaConfiguration(value) {
  if (value?.version !== 2 || value.sourceRevision !== index.sourceRevision
    || !Array.isArray(value.equipment) || value.equipment.length > index.slots.length) {
    throw new Error('复刻战前配置版本不一致，请刷新后重试');
  }
  const used = new Set();
  const equipment = value.equipment.map(entry => {
    const row = rows.get(entry?.id);
    if (!row || entry.slot !== row.slot || used.has(row.slot)
      || !isEquipmentPartLevel(entry.level)) {
      throw new Error(`装备原版 ID、槽位或等级无效：${entry?.id ?? '未知'}`);
    }
    used.add(row.slot);
    return { id: row.id, slot: row.slot, level: entry.level };
  }).sort((a, b) => a.slot - b.slot);
  return { version: 2, sourceRevision: index.sourceRevision, equipment, progression: validateReplicaProgression(value.progression), weaponChapterProgress: normalizeWeaponChapterProgress(value.weaponChapterProgress) };
}

export function createReplicaConfiguration(gear, progression, campaign) {
  if (!gear || !Array.isArray(gear.items) || !gear.slots || !gear.levels) {
    throw new Error('缺少战前装备记录');
  }
  const equipment = [];
  for (const slot of index.slots) {
    const uid = gear.slots[slot];
    if (!uid) continue;
    const matches = gear.items.filter(item => item.uid === uid);
    const item = matches[0];
    const row = item && rows.get(Number(item.family) + Number(item.quality));
    if (matches.length !== 1 || !row || row.slot !== slot) {
      throw new Error(`装备槽 ${slot} 找不到唯一的原版配置`);
    }
    const level = Number(gear.levels[slot] ?? 1);
    if (!Number.isFinite(level)) throw new Error(`装备槽 ${slot} 的等级无效`);
    // Carry the part level unchanged across quality changes. Quality caps only
    // decide whether another reinforcement purchase is available.
    equipment.push({ id: row.id, slot, level: normalizeEquipmentPartLevel(level) });
  }
  return validateReplicaConfiguration({ version: 2, sourceRevision: index.sourceRevision, equipment, progression, weaponChapterProgress: normalizeWeaponChapterProgress(campaign) });
}

export function replicaConfigurationKey(value) {
  return JSON.stringify(validateReplicaConfiguration(value));
}
