import source from './native-achievement-source.json' with {type:'json'};
import { nativeResourceRewards } from './native-reward-resources.js';
import catalog from './native-economy-catalog.json' with {type:'json'};
import {validateNativeAchievementProgress} from './native-achievement-progress.js';

export const NATIVE_ACHIEVEMENT_POLICY='original-achievements-v1-eight-aircraft';
const categories=Object.freeze([{id:'combat',name:'战斗'},{id:'growth',name:'成长'},{id:'collection',name:'收藏'}]);
const groups={
  1201:{condition:100,metric:'loginDays',parameter:'Count',category:'growth',destination:'signin'},
  1202:{condition:107,metric:'accountLevel',parameter:'Level',category:'growth',destination:'battle'},
  1204:{condition:103,metric:'mainlineAttempts',parameter:'Count',category:'combat',destination:'battle'},
  1210:{condition:105,metric:'diamondsSpent',parameter:'Count',category:'growth',destination:'shop'},
  1211:{condition:126,metric:'equipmentBoxes',parameter:'Count',category:'collection',destination:'boxes'},
  1213:{condition:302,metric:'equipmentLevel',parameter:'Level',category:'growth',destination:'equipment'},
  1215:{condition:700,metric:'aircraft',parameter:'Count',category:'collection',destination:'aircraft'},
};
const planeIds=new Set(catalog.skins.filter(row=>!row.closed).map(row=>row.id));
const aircraftLimit=Math.min(8,planeIds.size);
const definitions=Object.freeze(source.rows.flatMap(row=>{
  const rule=groups[row.Group];if(!rule)return [];
  const params=JSON.parse(row.ConditionParams),target=params[rule.parameter];
  if(row.Group==='1215'&&target>aircraftLimit)return [];
  if(row.Type!==1||row.ConditionId!==rule.condition||!Number.isSafeInteger(target)||target<1
    ||row.Group==='1204'&&params.Type!==1||row.Group==='1210'&&params.ItemId!==2
    ||row.Group==='1213'&&params.Count!==1||row.UnlockCondition!=='')throw Error('原版成就条件配置无效');
  const reward={diamonds:row.RewardItem.filter(([id])=>id===2).reduce((sum,[,amount])=>sum+amount,0)};
  if(row.RewardItem.some(([id,amount])=>id!==2||!Number.isSafeInteger(amount)||amount<1)||!reward.diamonds)
    throw Error('原版成就奖励配置无效');
  return [Object.freeze({id:`native-achievement-${row.ID}`,nativeId:row.ID,nativeGroup:row.Group,
    category:rule.category,metric:rule.metric,target,name:row.title.replace(/\{\d+\}/g,String(target)),
    destination:rule.destination,reward:Object.freeze(reward),rewardItems:nativeResourceRewards(reward)})];
}));
// Legacy custom IDs stay in the save as historical receipts. They neither
// become original claim IDs nor remove an original entitlement with a different
// condition/reward. Every original ID is independently claimable exactly once.
export function nativeAchievementSnapshot(claims={},progression={},campaign={},supply={},context={}){
  const claimedIds=claims?.claimed??[];
  if(!Array.isArray(claimedIds)||claimedIds.some(id=>typeof id!=='string'||!id))throw Error('成就领取记录无效，旧记录未覆盖');
  const claimed=new Set(claimedIds),counters=validateNativeAchievementProgress(context.progress);
  const metrics={...counters,accountLevel:progression.playerLevel??1,
    equipmentLevel:Math.max(counters.maxEquipmentLevel,1,...Object.values(context.equipment?.levels||{}).filter(Number.isSafeInteger)),
    aircraft:new Set((progression.skins||[]).filter(row=>row.active&&planeIds.has(row.id)).map(row=>row.id)).size};
  return {native:true,ruleSource:NATIVE_ACHIEVEMENT_POLICY,categories,items:definitions.map(row=>({...row,
    progress:Math.min(row.target,metrics[row.metric]),claimed:claimed.has(row.id),
    claimable:!claimed.has(row.id)&&metrics[row.metric]>=row.target}))};
}
