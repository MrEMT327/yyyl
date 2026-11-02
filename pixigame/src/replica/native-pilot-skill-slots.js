import { isRosterPilot } from './native-pilot-roster.js';

export const PILOT_SKILL_SLOT_COUNT = 3;

// Appearance selection remains independent. Only old records without this
// field inherit their formerly equipped pilot's skill once.
export function validatePilotSkillSlots(raw, pilots, hasSkill) {
  const available = entry => entry.active && isRosterPilot(entry.id) && hasSkill(entry.id, entry.star);
  const legacy = pilots.find(entry => entry.equipped && available(entry));
  const slots = raw === undefined ? [legacy?.id || 0, 0, 0] : raw;
  if (!Array.isArray(slots) || slots.length !== PILOT_SKILL_SLOT_COUNT) throw Error('驾驶员技能槽数量无效');
  const used = new Set();
  for (const id of slots) {
    if (id === 0) continue;
    if (!Number.isSafeInteger(id) || used.has(id) || !pilots.some(entry => entry.id === id && available(entry))) {
      throw Error('驾驶员技能未激活、不可装配或重复装配');
    }
    used.add(id);
  }
  return slots.slice();
}
