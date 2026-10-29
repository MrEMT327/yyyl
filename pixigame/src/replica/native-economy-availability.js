import { nativePatrolSnapshot } from './native-patrol.js';

// These old cloud mutations are not translations of native IDs/rules.
// Keep recovery of already-persisted receipts, but never create new grants.
export const NATIVE_PENDING_ECONOMY_ACTIONS = new Set([
  'claimSignIn','claimTask','claimActivity',
  'fleetActivate','fleetStarUp','fleetSkillEquip','fleetSkillRemove',
  'researchDraw','researchRefine','researchUpgrade','upgradeAircraft','upgradeWeapon',
  'synthesizeWeapon','synthesizeAll',
]);
export const NATIVE_PENDING_ECONOMY_MESSAGE='功能暂未开放';
export function nativeEconomyView(value) {
  if(!value.replicaCollection)return value;
  const disable=rows=>(rows||[]).map(row=>({...row,claimable:false,canClaim:false}));
  const blocked=value.rewardPending||value.rewardBusy;
  const shop=value.shop?{...value.shop,
    hasFree:!blocked&&value.shop.hasFree,
    items:value.shop.items.map(row=>blocked?{...row,available:false,reason:value.rewardPending?'奖励待保存':'奖励处理中'}:row),
    refresh:{...value.shop.refresh,available:!blocked&&value.shop.refresh.available}}:value.shop;
  return {...value,shop,nativeEconomyPending:true,
    tasks:disable(value.tasks),
    signIn:value.flightRewards?value.flightRewards.signIn:{...value.signIn,canClaim:false,canClaimToday:false,claimable:false},
    achievements:value.achievements?.native?value.achievements:{...value.achievements,items:disable(value.achievements?.items)},
    activity:Object.fromEntries(Object.entries(value.activity||{}).map(([key,row])=>[key,{...row,items:disable(row.items)}])),
    patrol:value.patrol?.native||value.patrol?.sampleBased?value.patrol:nativePatrolSnapshot(value.replicaCampaign,value.nativeAcquisition?.materials,value.replicaLoadout),
  };
}
