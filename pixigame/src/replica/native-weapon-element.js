import preview from './native-weapon-preview-index.json' with {type:'json'};
import {BATTLE_ELEMENTS} from './battle-weapon-element.js';
import {nativeWeaponGroupId} from './native-weapon-groups.js';

// Resolve the native attack family, including skins, from its actual skill IDs.
// The generated index reads the same primary Bullet.Element as combat.
export function nativeWeaponElement(row,rows=[]) {
  const base=rows.find(item=>Number(item.id)===nativeWeaponGroupId(row));
  for (const stage of [row?.stage,...(row?.stages||[]),base?.stage,...(base?.stages||[])]) {
    for (const skill of stage?.skills||[]) {
      const element=BATTLE_ELEMENTS[preview.families[skill.id]?.elementId];
      if(element)return element;
    }
  }
  return null;
}
