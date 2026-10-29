import { projectIconUrl } from './project-ui-art.js';
import { projectItemIcon } from './project-item-icons.js';
// HD resources follow the user PSD style and share one source across HTML,
// reward cards, the inventory and Three.js. Width/height retain HUD layout units.
export const RESOURCE_ICONS = Object.freeze({
  experience: Object.freeze({url:projectItemIcon(3),width:128,height:128}),
  coins: Object.freeze({url:projectIconUrl('credits-token'),width:34,height:42}),
  stamina: Object.freeze({url:projectIconUrl('stamina'),width:30,height:44}),
  diamonds: Object.freeze({url:projectIconUrl('diamonds'),width:20,height:39}),
  weaponParts: Object.freeze({url:projectIconUrl('weapon-parts'),width:256,height:256}),
  aircraftShards: Object.freeze({url:projectIconUrl('aircraft-shard'),width:256,height:256}),
  cores: Object.freeze({url:projectIconUrl('technology-core'),width:256,height:256}),
});
const aliases={exp:'experience',xp:'experience',experience:'experience',heroExp:'experience',coin:'coins',coins:'coins',diamond:'diamonds',diamonds:'diamonds',gem:'diamonds',energy:'stamina',stamina:'stamina',bolt:'stamina',parts:'weaponParts',weaponParts:'weaponParts',shard:'aircraftShards',aircraftShards:'aircraftShards',core:'cores',cores:'cores'};
export function resourceIconType(name){return aliases[name];}
export function resourceIcon(name,cls=''){
  const type=resourceIconType(name);
  if(type)return `<img class="resource-icon gui-icon ${cls}" data-resource="${type}" src="${RESOURCE_ICONS[type].url}" alt="" aria-hidden="true" draggable="false">`;
  return '';
}
