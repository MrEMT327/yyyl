import { COMMON_WEAPONS } from './common-weapons.js';
import { WEAPON_MAX_LEVEL, commonWeaponUpgradeCost, weaponLevelLimitMessage } from './weapon-progression-config.js';

export const QUALITY_FRAGMENT_COSTS=Object.freeze([20,40,80,140,220]);
export const DUPLICATE_FRAGMENTS=Object.freeze({white:10,green:15,blue:20,purple:30,gold:50});
const integer=(n,min=0,max=1e9)=>Math.min(max,Math.max(min,Math.floor(Number(n)||0)));
export function sanitizeWeaponProgress(value){
  const weapons=Object.fromEntries(Object.keys(COMMON_WEAPONS).map(id=>{const r=value?.weapons?.[id]||{};return [id,{unlocked:id==='aux_cannon'||Boolean(r.unlocked),level:integer(r.level,1,WEAPON_MAX_LEVEL),...(Number(r.level)>WEAPON_MAX_LEVEL||r.legacyLevel?{legacyLevel:Math.max(integer(r.level),integer(r.legacyLevel))}:{}),qualityRank:integer(r.qualityRank,0,5),fragments:integer(r.fragments)}];}));
  return {version:1,universalFragments:integer(value?.universalFragments),weapons};
}
export function receiveCommonWeapon(value,id,rewardQuality='white'){
  const state=sanitizeWeaponProgress(value),w=state.weapons[id];if(!w)return {state,ok:false};
  const first=!w.unlocked,fragmentsAdded=first?0:(DUPLICATE_FRAGMENTS[rewardQuality]||10);
  w.unlocked=true;w.fragments+=fragmentsAdded;return {state,ok:true,first,fragmentsAdded};
}
export function upgradeCommonWeapon(value,id,kind,coins=0){
  const state=sanitizeWeaponProgress(value),w=state.weapons[id];if(!w?.unlocked)return {ok:false,state,coins,reason:'请先获得完整武器'};
  if(kind==='level'){
    const cost=commonWeaponUpgradeCost(w.level,w.qualityRank);if(!cost)return {ok:false,state,coins,reason:weaponLevelLimitMessage(w.qualityRank)};
    if(coins<cost.coins||state.universalFragments<cost.weaponParts)return {ok:false,state,coins,reason:'金币或通用武器零件不足'};
    w.level++;state.universalFragments-=cost.weaponParts;
    return {ok:true,state,coins:coins-cost.coins,cost:cost.coins,weaponParts:cost.weaponParts};
  }
  if(kind!=='quality'||w.qualityRank>=5)return {ok:false,state,coins,reason:'已达最高品质'};
  const cost=QUALITY_FRAGMENT_COSTS[w.qualityRank],specific=Math.min(cost,w.fragments),universal=cost-specific;
  if(state.universalFragments<universal)return {ok:false,state,coins,reason:'武器碎片不足'};
  w.fragments-=specific;state.universalFragments-=universal;w.qualityRank++;return {ok:true,state,coins,cost,specific,universal};
}
