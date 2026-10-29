import source from './native-resource-channels-source.json' with {type:'json'};
import { countStars } from './native-battle-rating.js';
import { replicaChapter } from './chapter-contract.js';
import { validateReplicaInventory } from './native-economy.js';
import { flightRewardView } from './flight-rewards.js';
import acquisition from './native-acquisition-catalog.json' with {type:'json'};
import { nativeRandomGroupPreview } from './native-client-rules.js';
import { localRewardPairs, LOCAL_ECONOMY_POLICY } from './local-economy-policy.js';

const items=new Map(acquisition.items.map(row=>[row.id,row]));
const rows=new Map(source.starRewards.map(row=>[row.ID,row]));
const direct=id=>{const row=items.get(id);return Boolean(row&&!row.autoUse&&row.itemType<=1);};
function claimedIds(state) {
  const ids=state.nativeClaimed??[];
  if(!Array.isArray(ids)||new Set(ids).size!==ids.length||ids.some(id=>!Number.isSafeInteger(id)||!rows.has(id)))
    throw Error('原版星级奖励记录无效，旧记录未覆盖');
  return ids;
}
const rewardView=([id,count])=>direct(id)?{...flightRewardView({kind:'item',id:localRewardPairs([[id,count]])[0][0],count}),originalId:id}:{
  id,count,name:'随机装备图纸（离线逐张均匀分配）',preview:nativeRandomGroupPreview(id),
};
// Original normal-mode claim state is a set of IDs, not a sequential cursor.
// Legacy custom rewards paid different items: archive those records as-is and
// record the restored original entitlement separately; never convert old money.
export function nativeStarRewardSnapshot(state={},campaign={},maxStars=180) {
  const claimed=claimedIds(state);
  const total=Object.entries(campaign.starMasks||{}).reduce((sum,[id,mask])=>
    replicaChapter(Number(id))&&Number.isInteger(mask)&&mask>=0&&mask<=7?sum+countStars(mask):sum,0);
  return {native:true,pending:Boolean(state.pending),migrationNote:(state.claimed?.easy||[]).length?
    '旧版自定奖励及领取记录保留；本页恢复原版奖励，以独立记录各领取一次。':'',
    modes:[{id:'easy',label:'原版主线星级奖励',total,maxStars,
      items:source.starRewards.filter(row=>row.Stars<=maxStars).map(row=>{
        const supported=row.Reward.every(([id,count])=>(direct(id)||[10010007,10010008].includes(id))&&Number.isSafeInteger(count)&&count>0);
        const done=claimed.includes(row.ID),reached=total>=row.Stars;
        return {id:row.ID,stars:row.Stars,rewardItems:row.Reward.map(rewardView),supported,reached,
          claimed:done,claimable:!state.pending&&!done&&reached&&supported};
      })}]};
}
/** Inventory balances + claim ID are committed in one enclosing durable save. */
export function planNativeStarClaim(rawState={},rawInventory,campaign,operation,maxStars=180,rng=Math.random) {
  const inventory=validateReplicaInventory(rawInventory);
  if(operation.expectedRevision!==inventory.revision)throw Error('材料库存已更新，请重新领取');
  if(operation.mode!=='easy')throw Error('仅支持原版主线星级奖励');
  const row=nativeStarRewardSnapshot(rawState,campaign,maxStars).modes[0].items.find(r=>r.id===operation.id);
  if(!row)throw Error('奖励档位不存在');
  if(rawState.pending)throw Error('星级奖励存档待恢复');
  if(row.claimed)throw Error('此档奖励已领取');
  if(!row.reached)throw Error('累计星数不足');
  if(!row.supported)throw Error('原版随机奖励发放规则待核实，本次未领取');
  const compatibility=rawState.nativeCompatibility;
  if(compatibility){
    const fixed=compatibility.fixedProcessedIds,entries=compatibility.deferredRandomRewards;
    if(compatibility.version!==1||!Array.isArray(fixed)||!Array.isArray(entries)||new Set(fixed).size!==fixed.length||entries.length!==fixed.length
      ||fixed.some(id=>![1,7].includes(id)||claimedIds(rawState).includes(id)||entries.filter(entry=>entry.rewardId===id&&entry.mode==='easy'&&JSON.stringify(entry.rewards)==='[[10010007,100]]').length!==1))
      throw Error('星级固定先领记录无效，旧档未覆盖');
  }
  const fixedWasPaid=compatibility?.fixedProcessedIds?.includes(row.id);
  const pairs=localRewardPairs(rows.get(row.id).Reward.filter(([id])=>!fixedWasPaid||!direct(id)),rng);
  for(const [id,count] of pairs){
    const next=(inventory.items[id]||0)+count;
    if(!Number.isSafeInteger(next))throw Error('奖励数量超出库存范围');
    inventory.items[id]=next;
  }
  inventory.revision++;
  const state={...structuredClone(rawState),nativeClaimed:[...claimedIds(rawState),row.id]};
  if(compatibility){
    state.nativeCompatibility={...structuredClone(compatibility),fixedProcessedIds:(compatibility.fixedProcessedIds||[]).filter(id=>id!==row.id),
      deferredRandomRewards:(compatibility.deferredRandomRewards||[]).filter(entry=>entry.rewardId!==row.id)};
  }
  return {state,inventory:validateReplicaInventory(inventory),receipt:{ok:true,message:'星级奖励已领取',
    policyVersion:LOCAL_ECONOMY_POLICY.version,rewards:pairs.map(([id,count])=>flightRewardView({kind:'item',id,count}))}};
}
