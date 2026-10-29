import reference from './shop-reference-data.json' with {type:'json'};
import {GEAR_PARTS} from './equipment-system.js';
import researchSource from '../replica/local-research-shop-source.json' with {type:'json'};
import { LOCAL_SHOP_POLICY } from '../replica/local-shop-policy.js';
import { nativeItemPresentation } from '../replica/native-item-presentation.js';
import { equipmentBlueprintArtPath } from '../replica/equipment-art.js';
const integer=v=>Number.isFinite(Number(v))?Math.min(1e9,Math.max(0,Math.floor(Number(v)))):0;
const dayKey=time=>{const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const fail=message=>({ok:false,message}),copy=v=>structuredClone(v);
const goods=new Map([...reference.goods,...researchSource.goods].map(row=>[row.id,row]));
const dailyGroups=[...reference.dailyGroups,...researchSource.dailyGroups];
export const SHOP_RESOURCE_NAMES={coins:'金币',diamonds:'钻石',stamina:'体力',weaponParts:'通用强化零件',aircraftShards:'通用飞机碎片',basicKeys:'普通装备箱券',advancedKeys:'高级装备箱券',...Object.fromEntries(GEAR_PARTS.map(p=>[`blueprint${p.type}`,`${p.name}图纸`]))};
Object.assign(SHOP_RESOURCE_NAMES,Object.fromEntries(Array.from({length:11},(_,index)=>{const id=801+index;return [`researchBlueprint${id}`,nativeItemPresentation(id).name];})));
const resource=id=>id===1?'coins':id===2?'diamonds':id===4?'stamina':id===112?'advancedKeys':id===113?'basicKeys':id>=801&&id<=811?`researchBlueprint${id}`:GEAR_PARTS.find(p=>p.blueprintId===id)?`blueprint${GEAR_PARTS.find(p=>p.blueprintId===id).type}`:id===10010007?'randomBlueprints':null;
const decode=pairs=>Object.fromEntries(pairs.map(([id,n])=>[resource(id),n]));
const costOf=row=>row.price.length?{type:resource(row.price[0][0]),amount:row.price[0][1]}:{type:'free',amount:0};
const fixed=(id,nativeId,section,cost)=>{const row=goods.get(nativeId);return{id,nativeId,name:Object.keys(decode(row.reward)).map(k=>SHOP_RESOURCE_NAMES[k]).join(''),section,reward:decode(row.reward),cost:cost||costOf(row),limit:row.limit,perLimit:row.perLimit||1};};
export const SHOP_OFFERS=Object.freeze([
 fixed('coin-free',6,'coins'),fixed('coin-ad',1,'coins',{type:'ad',amount:0}),fixed('exchange-coins',1,'coins'),fixed('exchange-coins-medium',2,'coins'),fixed('exchange-coins-large',3,'coins'),fixed('ad-stamina',4,'stamina',{type:'ad',amount:0}),fixed('exchange-stamina',5,'stamina'),
// Local ad stamina rule: one completed ad grants 15, without a daily limit.
].map(o=>Object.freeze(o.id==='ad-stamina'?{...o,reward:{stamina:15},unlimited:true,limit:null,perLimit:1}:o.id==='coin-ad'?{...o,limit:1,perLimit:1}:o)));
function hash(text){let n=2166136261;for(const c of String(text)){n^=c.charCodeAt(0);n=Math.imul(n,16777619);}return n>>>0;}
function roll(seed){let n=seed>>>0;return()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};}
function catalog(day,seed,refreshes){const rng=roll(hash(`${day}:${seed}:${refreshes}`));return [1,2,3,4].map(group=>{const pool=dailyGroups.filter(r=>r.GroupId===group),total=pool.reduce((s,r)=>s+r.WeightInGroup,0);let hit=rng()*total;return(pool.find(r=>(hit-=r.WeightInGroup)<0)||pool.at(-1)).GoodsId;});}
function normalizeDailyGoodsCounts(value,day,seed,refreshes,reset){
 if(reset)return {};
 // Old builds kept only this page's slot counters. Recover all known purchases
 // by resolving that exact persisted catalog; older pages cannot be invented.
 if(value?.dailyGoodsCounts&&typeof value.dailyGoodsCounts==='object'&&!Array.isArray(value.dailyGoodsCounts))
  return Object.fromEntries(Object.entries(value.dailyGoodsCounts).filter(([id])=>/^[1-9]\d*$/.test(id)).map(([id,n])=>[id,integer(n)]));
 const counts={};
 catalog(day,seed,refreshes).forEach((id,index)=>{const n=integer(value?.dailyCounts?.[`daily-${index}`]);if(n)counts[id]=(counts[id]||0)+n;});
 return counts;
}
export function normalizeShop(value,time,seed=0){
 const today=dayKey(time),stored=/^\d{4}-\d{2}-\d{2}$/.test(value?.day)?value.day:today,reset=today>stored,day=reset?today:stored;
 if(value?.version===2){
  const savedSeed=Number(value.seed)>>>0,refreshes=reset?0:integer(value.refreshes);
  return {version:2,day,seed:savedSeed,revision:integer(value.revision),refreshes,
   dailyGoodsCounts:normalizeDailyGoodsCounts(value,day,savedSeed,refreshes,reset),
   counts:reset?{}:{...value.counts},dailyCounts:reset?{}:{...value.dailyCounts},dailyFreeClaimed:reset?false:!!value.dailyFreeClaimed,
   ...(value.pending?{pending:copy(value.pending)}:{}),...(value.legacy?{legacy:copy(value.legacy)}:{})};
 }
 const old=reset?{}:value?.counts||{};
 return {version:2,day,seed:Number(seed)>>>0,revision:integer(value?.revision),refreshes:0,dailyGoodsCounts:{},counts:{'exchange-coins':integer(old['exchange-coins']),'coin-ad':Math.min(1,integer(old['ad-coins'])),'ad-stamina':Math.min(1,integer(old['ad-stamina'])),'exchange-stamina':Math.min(5,integer(old['exchange-stamina']))},dailyCounts:{},dailyFreeClaimed:!!old['daily-coins'],...(value?{legacy:copy(value)}:{}),...(value?.pending?{pending:copy(value.pending)}:{})};
}
const rewardView=reward=>Object.entries(reward).map(([type,amount])=>type.startsWith('researchBlueprint')?{type:'nativeItem',id:Number(type.slice(17)),nativeItemId:Number(type.slice(17)),amount,...nativeItemPresentation(Number(type.slice(17)))}:type.startsWith('blueprint')?{type:'gearBlueprint',gearType:Number(type.slice(9)),amount,name:SHOP_RESOURCE_NAMES[type],image:equipmentBlueprintArtPath(GEAR_PARTS[Number(type.slice(9))-1].id)}:type.endsWith('Keys')?{type:'gearKey',pool:type==='basicKeys'?'basic':'advanced',amount,name:SHOP_RESOURCE_NAMES[type],image:nativeItemPresentation(type==='basicKeys'?113:112).image}:{type,amount,name:SHOP_RESOURCE_NAMES[type]||type});
export function shopSnapshot(value,wallet,time=Date.now()){
 const state=normalizeShop(value,time,wallet.shopSeed),clockBlocked=dayKey(time)<state.day;
 const daily=catalog(state.day,state.seed,state.refreshes).map((nativeId,index)=>{const row=goods.get(nativeId);return{...fixed(`daily-${index}`,nativeId,'daily'),discount:row.price.length?Math.floor(nativeId/100)%10:0,slot:index};});
 const fixedOffers=SHOP_OFFERS.map(o=>({...o,cost:{...o.cost},reward:{...o.reward}}));
 fixedOffers.find(o=>o.id==='exchange-stamina').cost.amount=reference.staminaPrices[Math.min(4,state.counts['exchange-stamina']||0)];
 const items=[...daily,...fixedOffers].map(o=>{
  const used=o.section==='daily'?integer(state.dailyGoodsCounts[o.nativeId]):integer(state.counts[o.id]),remaining=o.unlimited?null:Math.max(0,o.id==='coin-ad'?Math.min(o.limit-used,200-integer(state.counts['exchange-coins'])):o.limit-used);
  const reason=state.pending?'存档待恢复':clockBlocked?'日期异常':o.cost.type==='free'&&o.section==='daily'&&state.dailyFreeClaimed?'今日已领取':!o.unlimited&&!remaining?'今日已售罄':o.reward.stamina&&wallet.stamina>=wallet.maxStamina?'体力已满':o.cost.amount&&!wallet.unlimited&&wallet[o.cost.type]<o.cost.amount?`${SHOP_RESOURCE_NAMES[o.cost.type]}不足`:'';
  const kind=Object.keys(o.reward)[0];return{...o,name:kind==='randomBlueprints'?'随机强化图纸':SHOP_RESOURCE_NAMES[kind],remaining,available:!reason,reason,maxQuantity:o.unlimited?o.perLimit:Math.min(o.perLimit,remaining),art:kind.startsWith('blueprint')?GEAR_PARTS[Number(kind.slice(9))-1].id:kind};
 });
 const refreshCost=state.refreshes<reference.refreshFree?0:reference.refreshCoins;
 const refreshRemaining=null; // Server-owned total allowance is unknown.
 const refreshReason=state.pending?'存档待恢复':clockBlocked?'日期异常':!wallet.unlimited&&wallet.coins<refreshCost?'金币不足':'';
 const refreshAdReason=state.pending?'存档待恢复':clockBlocked?'日期异常':state.refreshes<reference.refreshFree?'请先使用免费刷新':'';
 return{day:state.day,token:`shop3:${state.day}:${state.revision}:${state.refreshes}:${wallet.highestCleared??-1}:${state.seed}`,items,clockBlocked,pending:!!state.pending,hasFree:items.some(o=>o.section==='daily'&&o.cost.type==='free'&&o.available),refresh:{count:state.refreshes,remaining:refreshRemaining,limit:LOCAL_SHOP_POLICY.dailyRefreshLimit,freeLimit:reference.refreshFree,freeRemaining:Math.max(0,reference.refreshFree-state.refreshes),totalLimitKnown:false,cost:refreshCost,adAvailable:!refreshAdReason,adReason:refreshAdReason,available:!refreshReason,reason:refreshReason,compatibility:true,ruleNote:LOCAL_SHOP_POLICY.note},remainingMinutes:Math.ceil(Math.max(0,new Date(`${state.day}T00:00:00`).getTime()+86400000-time)/60000),resetAt:new Date(`${state.day}T00:00:00`).getTime()+86400000};
}
export function planShopOrder(value,wallet,{id,token,time=Date.now(),adCompleted=false,quantity=1,rng=Math.random,refresh=false,refreshWithAd=false}={}){
 const snap=shopSnapshot(value,wallet,time);if(token!==snap.token)return fail('商品状态已更新，请重新选择');
 const state=normalizeShop(value,time,wallet.shopSeed);let item,delta={};
 if(refresh){
  if(refreshWithAd){if(!snap.refresh.adAvailable)return fail(snap.refresh.adReason);if(!adCompleted)return fail('完整观看广告后才能刷新');}
  else {if(!snap.refresh.available)return fail(snap.refresh.reason||'金币不足或存档待恢复');if(snap.refresh.cost&&!wallet.unlimited)delta.coins=-snap.refresh.cost;}
  state.refreshes++;state.dailyCounts={};item={name:'每日商店',reward:{}};
 }
 else{
  item=snap.items.find(o=>o.id===id);if(!item)return fail('商品不存在');if(!item.available)return fail(item.reason);
  if(!Number.isInteger(quantity)||quantity<1||quantity>item.maxQuantity)return fail('购买数量超出上限');
  if(item.cost.type==='ad'&&!adCompleted)return fail('完整观看广告后才能领取');
  const price=(item.cost.amount||0)*quantity;if(price&&!wallet.unlimited&&wallet[item.cost.type]<price)return fail(`${SHOP_RESOURCE_NAMES[item.cost.type]}不足`);
  for(const[k,n]of Object.entries(item.reward)){
   if(k==='randomBlueprints')for(let i=0;i<n*quantity;i++){const type=1+Math.floor(Math.min(.999999999,Math.max(0,Number(rng())||0))*5),key=`blueprint${type}`;delta[key]=(delta[key]||0)+1;}
   else delta[k]=(delta[k]||0)+n*quantity;
  }
  if(item.reward.stamina&&wallet.stamina>=wallet.maxStamina)return fail('体力已满');
  if(price&&!wallet.unlimited)delta[item.cost.type]=(delta[item.cost.type]||0)-price;
  if(item.section==='daily'){state.dailyCounts[id]=integer(state.dailyCounts[id])+quantity;state.dailyGoodsCounts[item.nativeId]=integer(state.dailyGoodsCounts[item.nativeId])+quantity;if(item.cost.type==='free')state.dailyFreeClaimed=true;}
  else {state.counts[id]=integer(state.counts[id])+quantity;if(id==='coin-ad')state.counts['exchange-coins']=integer(state.counts['exchange-coins'])+quantity;}
 }
 const before={},after={};for(const[k,n]of Object.entries(delta)){if(!Number.isFinite(wallet[k])||wallet[k]<0||wallet[k]+n<0)return fail('资源数据异常，请重新进入');before[k]=wallet[k];after[k]=wallet[k]+n;}
 state.revision++;state.pending={before,after,...(Object.keys(delta).some(k=>k.startsWith('blueprint')||k.endsWith('Keys'))?{gearRevision:{before:wallet.gearRevision,after:wallet.gearRevision+1}}:{})};
 return{ok:true,state,item,rewards:rewardView(Object.fromEntries(Object.entries(delta).filter(([,n])=>n>0)))};
}
export function createShopService({getState,getWallet,saveState,applyWallet,playAd,canUse=()=>true,now=Date.now,onChange=()=>{},rng=Math.random}){
 let busy=false;const snapshot=()=>{
  const view=shopSnapshot(getState(),getWallet(),now());
  return {...view,refresh:view.refresh.adAvailable&&typeof playAd!=='function'?{...view.refresh,adAvailable:false,adReason:'广告服务暂未就绪'}:view.refresh,items:view.items.map(row=>row.available&&row.cost.type==='ad'&&typeof playAd!=='function'
    ?{...row,available:false,reason:'广告服务暂未就绪'}:row)};
 };
 function recover(){const pending=getState()?.pending;if(!pending)return true;try{if(!applyWallet(pending))return false;const next={...getState()};delete next.pending;return saveState(next);}catch{return false;}}
 async function purchase(payload){
  if(busy)return fail('商城操作进行中，请稍候');if(!canUse())return fail('请先完成当前出击');if(!recover())return fail('商城存档待恢复，请重试或重新进入游戏');
  const state=getState(),time=now(),snap=snapshot();if(payload.token!==snap.token)return fail('商品状态已更新，请重新选择');
  const item=snap.items.find(o=>o.id===payload.id);if(!payload.refresh&&!item?.available)return fail(item?.reason||'商品不存在');
  const refreshAd=payload.refresh===true&&payload.refreshWithAd===true;
  if(refreshAd&&!snap.refresh.adAvailable)return fail(snap.refresh.adReason);
  busy=true;onChange();try{
   const requiresAd=refreshAd||!payload.refresh&&item?.cost.type==='ad';
   if(requiresAd){if(!playAd)return fail('广告服务暂未就绪，未消耗领取次数');const receipt=await playAd();if(receipt?.completed!==true)return fail(refreshAd?'未完整观看广告，未刷新商品':'未完整观看广告，未发放奖励');}
   if(!canUse())return fail('请先完成当前出击');if(snapshot().token!==snap.token&&dayKey(now())===snap.day)return fail('商品状态已更新，请重新选择');
   if(refreshAd&&snapshot().token!==snap.token)return fail('商品状态已更新，请重新选择');
   const result=planShopOrder(state,getWallet(),{...payload,time,adCompleted:requiresAd,rng});if(!result.ok)return result;
   if(!saveState(result.state))return fail('无法保存商城进度，本次未扣费或发放');if(!recover())return fail('兑换已记录，资源存档待恢复，请重新进入游戏');
   return{ok:true,message:payload.refresh?'商品已刷新':`${item.name}已领取`,rewards:result.rewards};
  }catch(error){return fail(error?.message||'操作未完成，未消耗领取次数');}finally{busy=false;onChange();}
 }
 return{snapshot,purchase,recover,get busy(){return busy;}};
}
