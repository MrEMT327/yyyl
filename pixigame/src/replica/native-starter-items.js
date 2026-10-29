import source from './native-starter-items-source.json' with {type:'json'};
import {validateReplicaInventory} from './native-economy.js';
export const NATIVE_INITIAL_STAMINA=source.items.find(([id])=>id===4)[1];
const grants=source.items.filter(([id])=>id!==4&&id!==135);
// 135 already has a separate durable receipt; stamina belongs to the timed wallet.
// Never overwrite earned stock, replay a grant after spending, or refill an old save.
export function planNativeStarterItems(state,now){
 const receipt=state.nativeStarterItems;
 if(receipt){
  if(receipt.version!==1||JSON.stringify(receipt.items)!==JSON.stringify(grants))throw Error('初始奖励发放记录无效');
  return null;
 }
 const inventory=validateReplicaInventory(state.replicaInventory),before={},after={};
 if(!Number.isSafeInteger(inventory.revision+1))throw Error('库存版本超出范围');
 const backup=state.developmentInventoryBackup?{...state.developmentInventoryBackup}:null;
 for(const[id,amount]of grants){
  before[id]=inventory.items[id]||0;after[id]=before[id]+amount;
  if(!Number.isSafeInteger(after[id]))throw Error('初始奖励库存超出范围');
  inventory.items[id]=after[id];
  if(backup&&Object.hasOwn(backup,id)){
   const saved=backup[id]??0;
   if(!Number.isSafeInteger(saved)||saved<0||!Number.isSafeInteger(saved+amount))throw Error('测试资源备份无效');
   backup[id]=saved+amount;
  }
 }
 inventory.revision++;
 return {...state,replicaInventory:inventory,...(backup?{developmentInventoryBackup:backup}:{}),
  nativeStarterItems:{version:1,items:structuredClone(grants),before,after,grantedAt:now,source:source.source}};
}
