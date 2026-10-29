import source from './native-player-rename-source.json' with {type:'json'};
import {DEFAULT_PLAYER_NAME,playerName,validatePlayerName} from '../player-identity.js';
import {validateReplicaInventory} from './native-economy.js';

/** The peripheral save is authoritative. Legacy custom names keep their name
 * and count as having used the free change, without a retrospective charge. */
export function nativePlayerIdentity(raw,legacyName) {
  if(raw===undefined){
    const name=playerName(legacyName);
    return {version:1,name,freeUsed:name!==DEFAULT_PLAYER_NAME};
  }
  const checked=validatePlayerName(raw?.name);
  if(raw?.version!==1||!checked.ok||checked.name!==raw.name||typeof raw.freeUsed!=='boolean'
    ||!raw.freeUsed&&raw.name!==DEFAULT_PLAYER_NAME)throw Error('玩家改名记录无效，原存档未覆盖');
  return {version:1,name:raw.name,freeUsed:raw.freeUsed};
}

export function nativePlayerRenameQuote(raw,rawInventory,legacyName) {
  const identity=nativePlayerIdentity(raw,legacyName),inventory=validateReplicaInventory(rawInventory);
  const cost=identity.freeUsed?source.cost.TypeInt:0;
  if(!Number.isSafeInteger(cost)||cost<0)throw Error('原版改名费用配置无效');
  return {cost,paidCost:source.cost.TypeInt,free:!identity.freeUsed,revision:inventory.revision,canRename:(inventory.items[2]||0)>=cost};
}

/** Confirmed native first-free/100-diamond cost only. Native cooldown depends
 * on server state; its duration is unconfirmed, so no local cooldown is invented.
 * This planner never reads or debits the archived profile currency. */
export function planNativePlayerRename(raw,rawInventory,legacyName,operation={}) {
  const identity=nativePlayerIdentity(raw,legacyName),inventory=validateReplicaInventory(rawInventory);
  const quote=nativePlayerRenameQuote(identity,inventory);
  if(operation.expectedRevision!==quote.revision||operation.expectedCost!==quote.cost||operation.expectedName!==identity.name)
    throw Error('名字或改名费用已更新，请重新确认');
  const checked=validatePlayerName(operation.name);
  if(!checked.ok)throw Error(checked.message);
  if(checked.name===identity.name)throw Error('名字没有变化，未消耗资源');
  if(!quote.canRename)throw Error(`钻石不足，改名需要${quote.cost}钻石`);
  if(quote.cost)inventory.items[2]-=quote.cost;
  inventory.revision++;
  if(!Number.isSafeInteger(inventory.revision))throw Error('库存版本超限，未消耗资源');
  return {identity:{version:1,name:checked.name,freeUsed:true},inventory:validateReplicaInventory(inventory),
    receipt:{ok:true,playerName:checked.name,cost:quote.cost,free:quote.free,message:'改名成功'}};
}
