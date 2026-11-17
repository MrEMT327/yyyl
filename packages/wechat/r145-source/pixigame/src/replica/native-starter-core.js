import {validateReplicaInventory} from './native-economy.js';
import {nativeResearchSnapshot} from './native-research.js';
import {normalizeOnboarding,completeGuide} from '../peripheral/onboarding.js';

// APK GameConfig.InitItems includes 135,1. Keep this grant separate from
// earned cores, legacy cloud currency and completion of the teaching steps.
export function planNativeStarterCore(state,now) {
  const receipt=state.nativeStarterCore;
  if(receipt){
    if(receipt.version!==1||receipt.itemId!==135||receipt.amount!==1)throw Error('初始星核发放记录无效');
    return null;
  }
  const inventory=validateReplicaInventory(state.replicaInventory);
  const before=inventory.items[135]||0;
  if(!Number.isSafeInteger(before+1)||!Number.isSafeInteger(inventory.revision+1))throw Error('星核库存超出范围');
  inventory.items[135]=before+1;inventory.revision++;
  const research=nativeResearchSnapshot(state.replicaLoadout,inventory);
  let onboarding=normalizeOnboarding(state.onboarding);
  // Repair old click-only guide completion without erasing other tutorials.
  if(research.aceDraws===0)onboarding.completed=onboarding.completed.filter(id=>id!==6);
  else onboarding=completeGuide(onboarding,6);
  const next={...state,replicaInventory:inventory,onboarding,nativeStarterCore:{
    version:1,itemId:135,amount:1,before,after:before+1,grantedAt:now,source:'GameConfig.InitItems',
  }};
  // A later switch out of unlimited materials must retain this real grant.
  if(state.developmentInventoryBackup&&Object.hasOwn(state.developmentInventoryBackup,135)){
    const saved=state.developmentInventoryBackup[135]??0;
    if(!Number.isSafeInteger(saved)||saved<0||!Number.isSafeInteger(saved+1))throw Error('测试资源备份无效');
    next.developmentInventoryBackup={...state.developmentInventoryBackup,135:saved+1};
  }
  return next;
}
