import { ACHIEVEMENTS, ACHIEVEMENT_CATEGORIES } from '../peripheral/daily-progress.js';
import { equipmentRewards, nativeResourceRewards } from './native-reward-resources.js';
import catalog from './native-economy-catalog.json' with {type:'json'};

const nonnegative=value=>Number.isSafeInteger(value)&&value>=0?value:0;
const ids=kind=>new Set(catalog[kind].map(row=>row.id));
const gunIds=ids('guns'),planeIds=ids('skins');
const definitions=ACHIEVEMENTS.map(row=>{
  const reward=equipmentRewards(row.reward);
  const mapped={...row,reward,rewardItems:nativeResourceRewards(reward)};
  // Native aircraft/weapons have 1..5 stars, not legacy 10..50 levels.
  // Keep achievement IDs so historical claims cannot be granted a second time.
  if(['weaponLevel','aircraftLevel'].includes(row.metric)) {
    mapped.target=({10:2,30:3,50:5})[row.target];
    mapped.metric=row.metric==='weaponLevel'?'weaponStar':'aircraftStar';
    mapped.name=`任一${row.metric==='weaponLevel'?'武器':'战机'}达到 ${mapped.target} 星`;
    mapped.destination=row.metric==='weaponLevel'?'weapon':'aircraft';
  }
  if(row.metric==='aircraft') {
    mapped.target=Math.min(row.target,planeIds.size);
    mapped.name=`拥有 ${mapped.target} 架战机`;
  }
  if(row.metric==='weapons')mapped.name=`拥有 ${row.target} 种武器`;
  if(row.metric==='recruits')mapped.name=`累计驾驶员补给 ${row.target} 次`;
  return Object.freeze(mapped);
});

export function nativeAchievementSnapshot(claims={},progression={},campaign={},supply={}) {
  const guns=(progression.guns||[]).filter(row=>row.active&&gunIds.has(row.id));
  const planes=(progression.skins||[]).filter(row=>row.active&&planeIds.has(row.id));
  const cleared=(campaign.clearedChapterIds||[]).filter(id=>Number.isInteger(id)&&id>=1&&id<=50);
  const stars=Object.entries(campaign.starMasks||{}).reduce((sum,[id,mask])=>
    Number(id)>=1&&Number(id)<=50&&Number.isInteger(mask)&&mask>=0&&mask<=7
      ?sum+(mask&1)+((mask>>1)&1)+((mask>>2)&1):sum,0);
  const metrics={chapter:Math.max(0,...cleared),stars,
    weapons:new Set(guns.map(row=>row.id)).size,aircraft:new Set(planes.map(row=>row.id)).size,
    weaponStar:Math.max(0,...guns.map(row=>nonnegative(row.star))),
    aircraftStar:Math.max(0,...planes.map(row=>nonnegative(row.star))),recruits:nonnegative(supply.total)};
  const claimed=new Set(claims.claimed||[]);
  return {native:true,categories:ACHIEVEMENT_CATEGORIES,items:definitions.map(row=>({...row,
    progress:Math.min(row.target,metrics[row.metric]),claimed:claimed.has(row.id),
    claimable:!claimed.has(row.id)&&metrics[row.metric]>=row.target,
  }))};
}
