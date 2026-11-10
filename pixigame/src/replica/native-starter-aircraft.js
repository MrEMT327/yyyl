import catalog from './native-economy-catalog.json' with {type:'json'};
import {validateReplicaInventory} from './native-economy.js';
import {validateReplicaProgression} from './native-progression.js';

// The starter airframe is already available in the legacy hangar. Record that
// same ownership in native progression without consuming a duplicate card.
export function planNativeStarterAircraft(state,now) {
  if(state.nativeStarterAircraft)return null;
  const starter=catalog.skins.find(row=>row.id===10101);
  if(!starter||starter.closed||!starter.stages.some(stage=>stage.star===starter.defaultStar))throw Error('初始战机配置无效');
  validateReplicaProgression(state.replicaLoadout);
  validateReplicaInventory(state.replicaInventory);
  const progression=structuredClone(state.replicaLoadout);
  const inventory=structuredClone(state.replicaInventory);
  let aircraft=progression.skins.find(row=>row.id===starter.id),changed=false;
  if(!aircraft){
    aircraft={id:starter.id,star:starter.defaultStar,active:true,equipped:false};
    progression.skins.push(aircraft);changed=true;
  }else if(!aircraft.active){
    aircraft.active=true;aircraft.star=Math.max(aircraft.star,starter.defaultStar);changed=true;
  }
  // Keep the selected aircraft unchanged, including the legacy base selection.
  if(changed){
    if(!Number.isSafeInteger(inventory.revision+1))throw Error('库存版本超出范围');
    inventory.revision++;
  }
  validateReplicaProgression(progression);
  return {...state,replicaLoadout:progression,replicaInventory:inventory,
    nativeStarterAircraft:{version:1,id:starter.id,recordedAt:now}};
}
