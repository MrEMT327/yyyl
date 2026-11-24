import catalog from './native-economy-catalog.json' with {type:'json'};
import {STARTER_PILOT_ID} from './native-pilot-roster.js';
import {validateReplicaInventory} from './native-economy.js';
import {validateReplicaProgression} from './native-progression.js';

// Recognize the already available base pilot in the native collection. Do
// not debit inventory, equip over the player's choice, or grant a duplicate.
export function planNativeStarterPilot(state){
  if(state.replicaLoadout?.pilots?.some(row=>row.id===STARTER_PILOT_ID&&row.active))return null;
  const starter=catalog.pilots.find(row=>row.id===STARTER_PILOT_ID);
  if(!starter||starter.closed||!starter.stages.some(row=>row.star===starter.defaultStar))throw Error('初始驾驶员配置无效');
  const progression=validateReplicaProgression(state.replicaLoadout),inventory=validateReplicaInventory(state.replicaInventory);
  const existing=progression.pilots.find(row=>row.id===STARTER_PILOT_ID);
  if(existing){existing.active=true;existing.star=Math.max(starter.defaultStar,existing.star);}
  else progression.pilots.push({id:STARTER_PILOT_ID,star:starter.defaultStar,active:true,equipped:false});
  if(!Number.isSafeInteger(++inventory.revision))throw Error('库存版本超出范围');
  return {...state,replicaLoadout:validateReplicaProgression(progression),replicaInventory:inventory};
}
