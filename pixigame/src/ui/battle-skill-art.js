import { cloudAssetBase } from './cloud-asset-base.js';
import { weaponFamilyThemeArt } from './weapon-theme-art.js';

export const BATTLE_SKILL_ART_KEYS = Object.freeze([
  '10000101', '10000201', '10000301', '10000401',
  '10000601', '10000701', '10000901', '10001101',
  '10001501', '10001601', '10001701', '11000101',
  '11000201', '11000301', '11000601', '11000307',
  '11000801', '11001101', '11001401', '11001601',
  '11001701', '11002001', '11002201', '11002501',
]);

const icons = new Map(BATTLE_SKILL_ART_KEYS.map(key => [key, weaponFamilyThemeArt(key) || `${cloudAssetBase}art/project-battle-skills-v1/${key}.webp`]));

export function battleSkillIconUrl(key) {
  return icons.get(String(key)) || null;
}

export function createSkillIconSprites(sprites) {
  const presentation = { ...sprites };
  for (const [key, url] of icons) presentation[key] = { ...sprites[key], url };
  return presentation;
}
