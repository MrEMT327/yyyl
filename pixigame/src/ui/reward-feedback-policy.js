import { projectItemIcon } from './project-item-icons.js';

// Completed purchase confirmations are spent orders. Return to their resource
// picker when present, otherwise let the reward close back to the shop.
export function rewardReturnModal(modal) {
  if (!modal || modal.type==='rewards') return null;
  return modal.type==='shopConfirm' ? modal.returnTo || null : modal;
}

export function walletGains(before = {}, after = {}) {
  return ['coins','diamonds','stamina','weaponParts','aircraftShards','cores'].flatMap(type=>{
    const amount=Number(after[type])-Number(before[type]);
    return Number.isFinite(amount)&&amount>0?[{type,amount}]:[];
  });
}

// A committed receipt is authoritative. Wallet deltas only fill missing receipts;
// they must not duplicate currency already included in an explicit reward list.
export function actionRewards(result,before={},after={}) {
  if(!result?.ok||result.researchResult||result.gearResult?.operation==='supply')return [];
  const raw=result.rewards??result.reward;
  const rewards=Array.isArray(raw)?raw.filter(item=>item&&Number(item.amount??item.count??1)>0)
    :Object.entries(raw||{}).filter(([,amount])=>typeof amount==='number'&&amount>0).map(([type,amount])=>({type,amount}));
  if(rewards.length)return rewards;
  const fallback=walletGains(before.wallet,after.wallet);
  if(result.gearResult?.keyReward>0)fallback.push({type:'gearKey',pool:'advanced',amount:result.gearResult.keyReward,name:'高级装备箱券',image:projectItemIcon(112)});
  return fallback;
}
