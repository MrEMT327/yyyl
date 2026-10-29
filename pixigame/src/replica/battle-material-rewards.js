// New battles use native collected gold and verified first-clear rewards only.
// v4/v5 material receipts remain payable solely for already persisted runs.
import { nativeItemPresentation } from './native-item-presentation.js';
export const BATTLE_MATERIAL_POLICY=Object.freeze({version:6,label:'原版已验证结算'});
export function prepareBattleMaterialRewards() {
  // Server repeat-material quantities are unknown; never invent local grants.
  return [];
}
function ledger(raw) {
  const result=structuredClone(raw??{version:1,victories:0,researchSheets:0});
  if(result.version!==1||![result.victories,result.researchSheets].every(n=>Number.isSafeInteger(n)&&n>=0))
    throw Error('战斗材料历史记录无效，旧记录已保留');
  return result;
}
export function battleMaterialSnapshot(raw) {
  ledger(raw);
  return {nativeSettlementPending:true,compatibility:false,reason:'已停用本地波次图纸和胜利箱券补发；原服重复材料结算数量待证实。'};
}
export function grantBattleMaterials(inventory,rewards,raw,result) {
  // Pay concrete durable receipts only. Pending v4 payouts stay unchanged;
  // do not recalculate old runs or generate v4/v5 receipts for new battles.
  const next=ledger(raw);
  if(![4,5].includes(result.materialPolicyVersion)||result.trial||result.abandoned||result.endReason==='quit')return next;
  const pairs=structuredClone(result.localMaterialRewards||[]);
  next.compatibilityVictories??=0;
  if(!Number.isSafeInteger(next.compatibilityVictories)||next.compatibilityVictories<0)throw Error('材料兼容胜利记录无效');
  if(result.won){next.compatibilityVictories++;if(!Number.isSafeInteger(next.compatibilityVictories))throw Error('材料胜利计数超限');if(next.compatibilityVictories%3===0)pairs.push([113,1]);}
  for(const [id,count] of pairs){
    if(![105,106,107,108,109,113,801,802,803,804,805,806,807,808,809,810,811].includes(id)||!Number.isSafeInteger(count)||count<=0)throw Error('战斗材料凭据无效');
    const total=(inventory.items[id]||0)+count;
    if(!Number.isSafeInteger(total))throw Error('战斗材料数量超限');
    inventory.items[id]=total;
    rewards.push({type:'native-item',id,amount:count,...nativeItemPresentation(id),compatibility:true});
  }
  return next;
}
