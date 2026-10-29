// Two semantic levels from 弹窗.psd. Unknown/new lobby dialogs inherit primary.
export const SECONDARY_POPUPS = new Set([
  'shopConfirm', 'shopWeaponConfirm', 'researchCard', 'researchResult',
  'weapon', 'weaponSkill', 'weaponSkillGroup', 'pilotInfo', 'aircraftInfo', 'innateInfo', 'stamina', 'workshopBatch', 'workshopFilter', 'quickPatrol',
]);
export const popupLevel = type => SECONDARY_POPUPS.has(type) ? 'secondary' : 'primary';
