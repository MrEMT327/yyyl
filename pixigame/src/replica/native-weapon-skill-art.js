import { cloudAssetBase } from '../ui/cloud-asset-base.js';
import { nativeWeaponGroupId } from './native-weapon-groups.js';
import variantSkills from './native-weapon-variant-skill-icons.json' with {type:'json'};

// Base attacks and variant passives keep separate visual identities.
const icons = Object.freeze({
  20101:'rapid-autocannon',20201:'he-missile',20301:'high-energy-laser',
  20401:'acid-projectile',20501:'frost-blades',20601:'magstorm',
  20701:'scorch-ray',20801:'energy-blade',20901:'frost-sawblade',
  21001:'arc-blast',21101:'corrosive-black-hole',
});
const variants=new Map(variantSkills.assets.map(asset=>[asset.weaponId,asset.file]));
const skillSources=new Map(variantSkills.assets.flatMap(asset=>asset.skillIds.map(id=>[id,asset.weaponId])));
const variantArt=id=>{
  const file=variants.get(Number(id));
  return file?cloudAssetBase+'art/project-weapon-variant-skill-icons-v2/'+file:null;
};
const currentEffects = new Set(Object.values(icons));
export function currentWeaponSkillIconUrl(icon) {
  return currentEffects.has(icon) ? cloudAssetBase+'art/project-weapon-skill-icons-v3/'+icon+'.webp' : null;
}
export function nativeWeaponSkillArt(row) {
  return variantArt(row?.id)||currentWeaponSkillIconUrl(icons[nativeWeaponGroupId(row)]);
}
// Star-up details receive skill IDs, while slots receive source weapon IDs.
export const nativeVariantSkillArt=skillId=>variantArt(skillSources.get(Number(skillId)));
