import './weapon-skill-art.css';
import './skill-element-backgrounds.css';
import { currentWeaponSkillIconUrl, nativeWeaponSkillArt } from '../replica/native-weapon-skill-art.js';

// Bind existing gameplay IDs by attack motif, never by the order of the sheet.
export const WEAPON_SKILL_ICONS = Object.freeze({
  aux_cannon:'rapid-autocannon',aux_rail:'rail-piercer',
  aux_rocket:'he-missile',aux_laser:'high-energy-laser',
  aux_scatter:'electromagnetic-spread',aux_sidegun:'broadside-burst',
  aux_grenade:'bouncing-grenade',aux_mine:'proximity-mine',
  aux_beam:'scorch-ray',aux_lightning:'magstorm',
  aux_freeze:'frost-blades',aux_orb:'arc-blast',
  aux_toxin:'acid-projectile',aux_blades:'energy-blade',
  aux_gravity:'corrosive-black-hole',aux_lightmine:'cross-laser-mine',
  aux_pyro:'molten-core',aux_shield:'frost-sawblade',
  aux_tail:'rear-counterfire',aux_drone:'replicating-drones',
});

const nativeFamilies=Object.freeze({10000101:20101,10000701:20201,10001501:20301,
  10000201:20401,10000601:20501,10000401:20601,10001701:20701,
  10001101:20801,10001601:20901,10000301:21001,10000901:21101});
export const nativeWeaponSkillArtwork=skillId=>weaponSkillArtwork({id:nativeFamilies[Number(skillId)]});

export function weaponSkillArtwork(weapon) {
  const id=WEAPON_SKILL_ICONS[weapon?.id];
  // Native identities and redrawn legacy motifs share the current skill pack.
  // Only unrelated prototype effects still need the older, distinct artwork.
  const current=nativeWeaponSkillArt(weapon)||currentWeaponSkillIconUrl(id);
  if(current)return `<img class="weapon-skill-icon native-weapon-skill-icon" data-skill-icon="${id||weapon?.id}" src="${current}" alt="" aria-hidden="true" draggable="false">`;
  if(!id)return '';
  const image = `${import.meta.env?.BASE_URL??'/'}art/skill-icons-anime-v2/${id}.webp`;
  return `<img class="weapon-skill-icon" data-skill-icon="${id}" src="${image}" alt="" aria-hidden="true" draggable="false">`;
}
