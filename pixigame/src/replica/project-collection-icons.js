import { nativeWeaponSkillArt } from './native-weapon-skill-art.js';
import { battleSkillIconUrl } from '../ui/battle-skill-art.js';
import { projectIconUrl } from '../ui/project-ui-art.js';
import { weaponCatalogThemeArt } from '../ui/weapon-theme-art.js';

const weaponFamilies = Object.freeze({
  '01': '10000701', '02': '10000601', '03': '10000201',
  '04': '10001701', '05': '10001601', '06': '10000301',
  '07': '10001501', '08': '10000101', '09': '10000401',
  '10': '10000901', '11': '10001101', '12': '10000101',
  '13': '10000701', '14': '10000601', '15': '10001701',
  '16': '10001101', '17': '10001601', '18': '10001501',
  '19': '10000201', '20': '10000401', '21': '10000301', '22': '10000901',
});

// These pilot skills fire or modify the corresponding weapon's attacks.
// Reuse its current skill illustration instead of generic element symbols.
const pilotWeaponSkills = Object.freeze({
  '10807011':20201, '10815011':20301, '10802011':20401,
  '10806011':20501, '10804011':20601, '10817011':20701,
  '10811011':20801, '10816011':20901, '10803011':21001,
  '10809011':21101,
});
const specialSkills = Object.freeze({
  '3010201': 'skill-shield', '3010101': 'skill-beam',
  '3010301': 'skill-explosive', '3020101': 'skill-toxin',
  '3020201': 'skill-blades', '3020301': 'skill-drone',
});

export function projectCollectionIcon(icon) {
  const key = String(icon || '').split('/').pop().replace(/\.(png|webp)$/, '');
  const weapon = /^(?:stg_skillLab_icon|stg_AirPlaneGun_icon)_(\d+)$/.exec(key);
  if (weapon) return weaponCatalogThemeArt(weapon[1]) || battleSkillIconUrl(weaponFamilies[weapon[1]]);
  if (pilotWeaponSkills[key]) return nativeWeaponSkillArt({id:pilotWeaponSkills[key]});
  return battleSkillIconUrl(key) || (specialSkills[key] ? projectIconUrl(specialSkills[key]) : null);
}
