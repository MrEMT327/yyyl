import atlas from './skill-icon-atlas.json' with {type:'json'};
import './weapon-skill-art.css';

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
const source = `${import.meta.env?.BASE_URL??'/'}art/skill-icons-anime-v1/approved-sheet.png`;

export function weaponSkillArtwork(weapon) {
  const id=WEAPON_SKILL_ICONS[weapon?.id],rect=atlas.rects[id];
  if(!id)return '';
  if(!rect) {
    const image = `${import.meta.env?.BASE_URL??'/'}art/skill-icons-anime-v2/${id}.webp`;
    return `<span class="weapon-skill-icon" data-skill-icon="${id}" aria-hidden="true" style="background-image:url('${image}');background-size:cover;background-position:center"></span>`;
  }
  const [x,y,w,h]=rect,[width,height]=atlas.sourceSize;
  return `<span class="weapon-skill-icon" data-skill-icon="${id}" aria-hidden="true" style="background-image:url('${source}');background-size:${width/w*100}% ${height/h*100}%;background-position:${x/(width-w)*100}% ${y/(height-h)*100}%"></span>`;
}
