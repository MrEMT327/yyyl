import { cloudAssetBase } from '../ui/cloud-asset-base.js';
import { nativeWeaponGroupId } from './native-weapon-groups.js';

// Skill effects have their own artwork. Inventory models remain independent.
const icons = Object.freeze({
  20101:'rapid-autocannon',20201:'he-missile',20301:'high-energy-laser',
  20401:'acid-projectile',20501:'frost-blades',20601:'magstorm',
  20701:'scorch-ray',20801:'energy-blade',20901:'frost-sawblade',
  21001:'arc-blast',21101:'corrosive-black-hole',
});

export function nativeWeaponSkillArt(row) {
  const icon = icons[nativeWeaponGroupId(row)];
  return icon ? cloudAssetBase+'art/project-weapon-skill-icons-v2/'+icon+'.webp' : null;
}
