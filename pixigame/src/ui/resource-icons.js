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
const inspectionIds={experience:3,coins:1,stamina:4,diamonds:2,weaponParts:129,cores:135,aircraftShards:'aircraftShards'};
const inspectionNames={experience:'经验',coins:'金币',stamina:'体力',diamonds:'钻石',weaponParts:'武器零件',cores:'星核',aircraftShards:'机体碎片'};
export function resourceIcon(name,cls='',{inspect=true}={}){
  const type=resourceIconType(name);
  const interaction=inspect?`data-item-inspect="" data-item-id="${inspectionIds[type]}" data-item-name="${inspectionNames[type]}" role="button" tabindex="0" aria-haspopup="dialog" aria-label="查看${inspectionNames[type]}详情"`:'aria-hidden="true"';
  if(type)return `<img class="resource-icon gui-icon ${cls}" data-resource="${type}" ${interaction} src="${RESOURCE_ICONS[type].url}" alt="" draggable="false">`;
  return '';
}
