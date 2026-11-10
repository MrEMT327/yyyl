import { nativeBattleSkillArt, SKILL_ICON_ASSETS, BATTLE_SKILL_ART_KEYS } from '../replica/native-weapon-skill-art.js';
export { BATTLE_SKILL_ART_KEYS };
export const PASSIVE_SKILL_ART_KEYS=Object.freeze(BATTLE_SKILL_ART_KEYS.filter(key=>key.startsWith('110')));
export const battleSkillIconUrl=nativeBattleSkillArt;
export function createSkillIconSprites(sprites) {
  const presentation={...sprites};
  for(const {key,category} of SKILL_ICON_ASSETS)if(category!=='variant')presentation[key]={...sprites[key],url:nativeBattleSkillArt(key)};
  return presentation;
}
