import effects from '../replica/native-equipment-effects-index.json' with {type:'json'};
import {GEAR_QUALITY_NAMES} from '../peripheral/equipment-system.js';

export function gearDetailSkills(item){
  const source=effects.equipment[item.family+60];
  return (source?.features||item.features||[]).map(feature=>({
    ...feature,
    text:feature.text.replace(/^[^·]+·\s*/,''),
    qualityName:GEAR_QUALITY_NAMES[feature.quality]||'',
    unlocked:feature.quality==null||item.quality>=feature.quality,
  }));
}

export function gearDetailIncrease(item){
  return Number.isFinite(item.nextAttribute)&&Number.isFinite(item.attribute)
    ? item.nextAttribute-item.attribute : null;
}
