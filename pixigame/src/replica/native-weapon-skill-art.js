import { requireSkillIconUrl } from './skill-icon-registry.js';
export {nativeFleetSkillArt,nativeFleetSkillIconArt,NATIVE_FLEET_SKILL_ASSETS} from './native-fleet-skill-art.js';
export {skillIconElement,skillElementBackgroundArt,skillIconBackgroundArt,SKILL_BACKGROUND_ELEMENTS} from './skill-element-background-art.js';
export { SKILL_ICON_ASSETS, BATTLE_SKILL_ART_KEYS, skillIconUrl as nativeBattleSkillArt } from './skill-icon-registry.js';
import variantSkills from './native-weapon-variant-skill-icons.json' with {type:'json'};
import elementArtwork from './native-weapon-element-art.json' with {type:'json'};

// Base attacks and variant passives keep separate visual identities.
const icons = Object.freeze({
  20101:'rapid-autocannon',20201:'he-missile',20301:'high-energy-laser',
  20401:'acid-projectile',20501:'frost-blades',20601:'magstorm',
  20701:'scorch-ray',20801:'energy-blade',20901:'frost-sawblade',
  21001:'arc-blast',21101:'corrosive-black-hole',
});
const skillSources=new Map(variantSkills.assets.flatMap(asset=>asset.skillIds.map(id=>[id,asset.weaponId])));
const elementFiles=new Map(elementArtwork.assets.map(asset=>[asset.weaponId,asset.file]));
const elementArt=id=>{
  const file=elementFiles.get(Number(id));
  return file?requireSkillIconUrl(file.replace(/\.webp$/, ''),String(id)):null;
};
const variantArt=id=>elementArt(id);
const currentEffects = new Set(Object.values(icons));
export function currentWeaponSkillIconUrl(icon) {
  if(!currentEffects.has(icon))return null;
  const id=Object.keys(icons).find(id=>icons[id]===icon);
  return elementArt(id);
}
export function nativeWeaponSkillArt(row) {
  return elementArt(row?.catalogSelectionId??row?.id);
}
const catalogIds=[null,20201,20501,20401,20701,20901,21001,20301,20101,20601,21101,20801,20102,20202,20502,20702,20802,20902,20302,20402,20602,21002,21102];
export const nativeWeaponCatalogSkillArt=slot=>elementArt(catalogIds[Number(slot)]);
// Star-up details receive skill IDs, while slots receive source weapon IDs.
export const nativeVariantSkillArt=skillId=>variantArt(skillSources.get(Number(skillId)));
