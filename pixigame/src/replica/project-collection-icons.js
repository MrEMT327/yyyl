import { nativeWeaponCatalogSkillArt, nativeFleetSkillIconArt } from './native-weapon-skill-art.js';
import { battleSkillIconUrl } from '../ui/battle-skill-art.js';
import { weaponCatalogThemeArt } from '../ui/weapon-theme-art.js';
export function projectCollectionIcon(icon) {
  const key=String(icon||'').split('/').pop().replace(/\.(png|webp)$/,'');
  const skill=/^stg_skillLab_icon_(\d+)$/.exec(key);
  if(skill)return nativeWeaponCatalogSkillArt(skill[1]);
  const weapon=/^stg_AirPlaneGun_icon_(\d+)$/.exec(key);
  if(weapon)return weaponCatalogThemeArt(weapon[1]);
  return nativeFleetSkillIconArt(key)||battleSkillIconUrl(key);
}
