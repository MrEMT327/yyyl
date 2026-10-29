import { nativePilotFragmentName } from './native-pilot-fragments.js';
import { GEAR_PARTS, GEAR_QUALITY_NAMES, gearName } from '../peripheral/equipment-system.js';
import equipment from '../peripheral/equipment-reference-data.json' with {type:'json'};
import { equipmentArtKey } from './equipment-art.js';

// Presentation aliases follow the actual local equipment slot and acquisition use.
// Keep captured item tables and all balances/costs untouched.
const names=Object.freeze({
  ...Object.fromEntries(GEAR_PARTS.map(part=>[part.blueprintId,`${part.name}图纸`])),
  903:'装备图纸自选箱',934:'史诗装备自选箱',
  112:'高级装备箱券',113:'普通装备箱券',925:'角色箱',926:'角色箱碎片',
});
const gear=new Map(equipment.equip.map(row=>[row.ID,{
  name:gearName({family:row.ID-row.quality,quality:row.quality}),
  partId:GEAR_PARTS.find(part=>part.type===row.equipType).id,
  art:equipmentArtKey(row),
  qualityRank:Math.floor(row.quality/10)-1,qualityName:GEAR_QUALITY_NAMES[row.quality],rank:row.rank,
}]));
export const nativeGearPresentation=id=>gear.get(Number(id));
export const nativeItemDisplayName=id=>names[id]||nativePilotFragmentName(id)||nativeGearPresentation(id)?.name;
