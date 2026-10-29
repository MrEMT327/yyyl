import { battleSkillIconUrl } from '../ui/battle-skill-art.js';
import { projectIconUrl } from '../ui/project-ui-art.js';

const weaponFamilies = Object.freeze({
  '01': '10000701', '02': '10000601', '03': '10000201',
  '04': '10001701', '05': '10001601', '06': '10000301',
  '07': '10001501', '08': '10000101', '09': '10000401',
  '10': '10000901', '11': '10001101', '12': '10000101',
  '13': '10000701', '14': '10000601', '15': '10001701',
  '16': '10001101', '17': '10001601', '18': '10001501',
  '19': '10000201', '20': '10000401', '21': '10000301', '22': '10000901',
});

const specialSkills = Object.freeze({
  '10807011': 'skill-explosive', '10815011': 'skill-laser',
  '10802011': 'skill-toxin', '10806011': 'skill-freeze',
  '10804011': 'skill-ballistic', '10817011': 'skill-beam',
  '10811011': 'skill-blades', '10816011': 'skill-blades',
  '10803011': 'skill-lightning', '10809011': 'skill-gravity',
  '3010201': 'skill-shield', '3010101': 'skill-beam',
  '3010301': 'skill-explosive', '3020101': 'skill-toxin',
  '3020201': 'skill-blades', '3020301': 'skill-drone',
});

export function projectCollectionIcon(icon) {
  const key = String(icon || '').split('/').pop().replace(/\.(png|webp)$/, '');
  const weapon = /^(?:stg_skillLab_icon|stg_AirPlaneGun_icon)_(\d+)$/.exec(key);
  if (weapon) return battleSkillIconUrl(weaponFamilies[weapon[1]]);
  return battleSkillIconUrl(key) || (specialSkills[key] ? projectIconUrl(specialSkills[key]) : null);
}
