// Two semantic levels from 弹窗.psd. Unknown/new lobby dialogs inherit primary.
export const SECONDARY_POPUPS = new Set([
  'shopConfirm', 'researchCard', 'researchResult', 'taskChestPreview',
  'weapon', 'weaponSkill', 'weaponSkillGroup', 'pilotInfo', 'aircraftInfo', 'stamina', 'workshopBatch', 'workshopFilter', 'quickPatrol',
]);
export const popupLevel = type => SECONDARY_POPUPS.has(type) ? 'secondary' : 'primary';
