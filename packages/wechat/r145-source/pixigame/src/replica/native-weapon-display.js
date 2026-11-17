import catalog from './native-economy-catalog.json' with {type:'json'};
import weaponSource from './chapter-weapon-source.json' with {type:'json'};
import { PUBLIC_ARSENAL } from '../fixed-parts/airframe-arsenal.js';

const weaponNames = new Map(catalog.guns.filter(row => PUBLIC_ARSENAL[row.appearance]).map(row => [row.id, PUBLIC_ARSENAL[row.appearance].name]));
export const nativeWeaponDisplayName = id => weaponNames.get(Number(id));

// Laboratory ID -> native unlock skill is captured explicitly; several source
// milestone rows copied another weapon's icon/name. Only their UI is corrected.
const weaponLabels = new Set(catalog.guns.map(row => row.name));
const labRoots = new Map(weaponSource.labs.map(row => [row.ID, String(row.unlockSkill)]));
const researchSkills = new Map(catalog.labs.flatMap(lab => lab.levels.flatMap(level => level.skills.map(skill => [skill.id, {
  icon:labRoots.get(lab.id),
  ...(weaponLabels.has(skill.name) && skill.name !== lab.name ? {name:lab.name} : {}),
}]))));
export const nativeWeaponSkillDisplayOverride = id => researchSkills.get(Number(id));

// Display text follows the same canonical names as the equipment catalog.
// Source skill IDs, rows, selection weights and learned history stay native.
const names = new Map(catalog.guns.flatMap(row => {
  const name = nativeWeaponDisplayName(row.id);
  return name && name !== row.name ? [[row.name, name]] : [];
}));
const pattern = new RegExp([...names.keys()].sort((a,b) => b.length-a.length)
  .map(name => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'g');

// Research item IDs are stable; their labels follow the corresponding weapon.
export function nativeResearchBlueprintName(id) {
  const key = Number(id);
  return key >= 801 && key <= 811 ? nativeWeaponDisplayText(catalog.itemNames[key]) : undefined;
}

export function nativeWeaponDisplayText(value) {
  return String(value ?? '').replace(pattern, name => names.get(name));
}
