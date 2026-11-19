import { itemInspectAttributes } from './item-description-model.js';
import { availabilityMessage, isResourceShortage } from './resource-availability.js';
import './resource-availability.css';
import { STAMINA_RECOVERY_DESCRIPTION } from '../peripheral/config.js';
import { nativeEquipmentBoxPrices } from '../replica/native-box-prices.js';
import { lobbyHeader } from './lobby-header.js';
import { lobbyNavigation } from './lobby-navigation.js';
import { resourceIcon } from './resource-icons.js';
import { projectIcon } from './project-ui-art.js';
import './shop-popup-polish.css';
import './shop-reference.css';
import { supplyWeaponArt } from './supply-visuals.js';
import { supplyPool } from './supply-pools.js';
import {GEAR_PARTS} from '../peripheral/equipment-system.js';
import './shop-native-v2.css';
import { nativeItemArt, nativeItemPresentation } from '../replica/native-item-presentation.js';
import { rewardItemSlot } from './reward-item-slot.js';
import { boxShowcase, boxGuarantees, boxDetails } from './shop-box-presentation.js';
import { nativeItemDisplayName } from '../replica/native-item-names.js';
const base=import.meta.env?.BASE_URL??'/';
const shopItemId=type=>/^researchBlueprint\d+$/.test(type)?Number(type.slice(17)):/^blueprint[1-5]$/.test(type)?GEAR_PARTS[Number(type.slice(9))-1]?.blueprintId:({basicKeys:113,advancedKeys:112,randomBlueprints:10010007,coins:1,diamonds:2,stamina:4,weaponParts:129})[type]||type;
const resourceNames = {coins:'金币',diamonds:'钻石',stamina:'体力',weaponParts:'武器零件',aircraftShards:'机体碎片'};
const resourceIcons = {coins:'coins',diamonds:'gem',stamina:'bolt',weaponParts:'gear',aircraftShards:'jet-fighter'};
// Cost pictograms belong to their purchase control, not the item inspector.
const costIcon=(name,cls='sn-cost-icon')=>resourceIcon(name,cls,{inspect:false});
const glyph = (name, cls='') => resourceIcon(name, "shop-icon " + cls) || projectIcon({play:'ad-play',box:'chest-closed',gear:'weapon-parts','jet-fighter':'aircraft-shard'}[name]||name,`shop-icon ${cls}`);
const resourceArt = type => resourceIcon(type,'shop-resource-art') || glyph(resourceIcons[type]||'box',`shop-resource-symbol is-${type}`);

export const shopHeader = lobbyHeader;

export function shopNavigation() { return lobbyNavigation('shop'); }

// Older resource-header links used the recruitment section for diamonds.
const shopButton=(action,label,data='',disabled=false)=>`<button type="button" class="wc-button sn-button" data-action="${action}" ${data} ${disabled?'disabled':''}>${label}</button>`;
// Shop products communicate their quantity tier; small cost icons keep the HUD coin.
const coinArt=amount=>amount>=10000?`<img src="${base}art/shop-coin-tiers-v2/${amount>=50000?'coins-safe':'coins-canister'}.png" class="sn-item-art" alt="" draggable="false">`:projectIcon('credits-stack','sn-item-art sn-coin-small');
const shopArt=(type,amount=0)=>type.startsWith('researchBlueprint')?`<img src="${nativeItemArt(Number(type.slice(17)))}" alt="" draggable="false">`:type==='basicKeys'||type==='advancedKeys'?`<img src="${nativeItemArt(type==='basicKeys'?113:112)}" alt="" draggable="false">`:type.startsWith('blueprint')?`<img src="${nativeItemArt(GEAR_PARTS[Number(type.slice(9))-1].blueprintId)}" alt="" draggable="false">`:type==='randomBlueprints'?`<img src="${nativeItemArt(10010007)}" alt="" draggable="false">`:type==='coins'?coinArt(amount):resourceArt(type);
const shopName=type=>type.startsWith('researchBlueprint')?nativeItemPresentation(Number(type.slice(17))).name:type==='randomBlueprints'?nativeItemPresentation(10010007).name:type==='basicKeys'?nativeItemDisplayName(113):type==='advancedKeys'?nativeItemDisplayName(112):type.startsWith('blueprint')?`${GEAR_PARTS[Number(type.slice(9))-1].name}图纸`:resourceNames[type]||type;
const shopOfferName=offer=>{const type=Object.keys(offer.reward||{})[0]||'';return /^(?:researchBlueprint\d+|blueprint\d+|basicKeys|advancedKeys|randomBlueprints)$/.test(type)?shopName(type):offer.name||shopName(type);};
const cardNames={researchBlueprint801:'机炮图纸',researchBlueprint802:'火箭图纸',researchBlueprint803:'激光图纸',researchBlueprint804:'酸液图纸',researchBlueprint805:'冰刃图纸',researchBlueprint806:'散射图纸',researchBlueprint807:'射线图纸',researchBlueprint808:'光剑图纸',researchBlueprint809:'锯盘图纸',researchBlueprint810:'闪电图纸',researchBlueprint811:'黑洞图纸',blueprint1:'头盔图纸',blueprint2:'护手图纸',blueprint3:'胸甲图纸',blueprint4:'铭牌图纸',blueprint5:'战靴图纸',basicKeys:'普通箱券',advancedKeys:'高级箱券',randomBlueprints:'随机图纸'};
const shopCardName=offer=>cardNames[Object.keys(offer.reward||{})[0]]||shopOfferName(offer);
export function shopPurchaseMax(offer,wallet={}){
  const limit=Math.max(0,Math.floor(Number(offer?.maxQuantity)||0)),price=Number(offer?.cost?.amount)||0;
  if(!price||wallet.unlimited)return limit;
  return Math.min(limit,Math.floor(Math.max(0,Number(wallet[offer.cost.type])||0)/price));
}
export function shopOfferQuote(offer){
  if(!offer)return null;
  return JSON.stringify([offer.id,offer.nativeId,offer.cost?.type,offer.cost?.amount,Object.entries(offer.reward||{}).sort(([a],[b])=>a.localeCompare(b))]);
}
export function reconcileShopReview(review,snapshot){
  if(review?.type!=='shopConfirm'||!snapshot?.shop)return {review,invalidated:false};
  const offer=snapshot.shop.items.find(item=>item.id===review.id),quantity=review.quantity||1;
  if(!offer)return {review:null,invalidated:true};
  let next=review;
  if(review.token!==snapshot.shop.token){
    if(!offer.available||review.quoteKey!==shopOfferQuote(offer)||quantity>shopPurchaseMax(offer,snapshot.wallet))return {review:null,invalidated:true};
    next={...review,token:snapshot.shop.token};
  }
  const max=Math.max(1,shopPurchaseMax(offer,snapshot.wallet));
  if(quantity>max)next={...next,quantity:max};
  return {review:next,invalidated:false};
}
export function shopSectionId(id='boxes'){return({supply:'daily',resources:'coins',exchange:'coins',daily:'daily',boxes:'boxes',coins:'coins',stamina:'stamina'})[id]||'boxes';}
export function shopPage({snapshot:s,helpers:h},selectedSection='boxes'){
 const {escape:e,number:n}=h;selectedSection=shopSectionId(selectedSection);const shop=s.shop,items=shop?.items||[],gear=s.equipment,blocked=s.rewardPending||s.rewardBusy;
 const action=o=>{
   const shortage=!blocked&&isResourceShortage(o.reason);
   const reason=s.rewardPending?'奖励待保存':s.rewardBusy?'奖励处理中':!o.available&&!shortage?availabilityMessage(o.reason):'';
   const soldOut=!o.unlimited&&o.remaining===0||o.reason==='今日已领取';
   let label;
   if(soldOut&&!blocked)label='已售罄';
   else if(o.cost.amount) {
     label=`<span class="sn-price ${shortage?'is-short':''}">${costIcon(o.cost.type)}<span>${n(o.cost.amount)}</span></span>${reason?`<small>${e(reason)}</small>`:''}`;
   } else label=reason?e(reason):o.cost.type==='ad'?`${glyph('play')}广告领取`:'免费领取';
   const payment=o.cost.amount?`消耗${o.cost.amount}${resourceNames[o.cost.type]||''}`:o.cost.type==='ad'?'广告领取':'免费领取';
   const description=`${shopOfferName(o)}，${payment}${o.reason?'，'+o.reason:''}`;
   return `<button type="button" class="sn-card-trigger" data-action="shopOffer" data-id="${e(o.id)}"
     ${shortage?`data-resource-short="${e(resourceNames[o.cost.type]||'资源')}"`:''}
     ${o.cost.amount&&!shortage?'aria-haspopup="dialog"':''} aria-label="${e(description)}"
     ${blocked||!o.available?'disabled':''}></button><div class="sn-card-price">${label}</div>`;
 };
 const tile=o=>{
   const [type,amount]=Object.entries(o.reward)[0];
   const unavailable=!o.available&&!isResourceShortage(o.reason);
   return `<article class="sn-tile ${unavailable?'is-unavailable':''}" data-offer="${e(o.id)}">
     ${action(o)}<h3>${e(shopCardName(o))}</h3>
     <div class="sn-art" ${itemInspectAttributes(shopItemId(type),e)}>${shopArt(type,amount)}</div>
     <strong>×${n(amount)}</strong>
     ${o.discount?`<span class="sn-discount"><span>${e(o.discount)}折</span></span>`:''}
   </article>`;
 };
 const currency=(id,label)=>{
   const offer=items.find(item=>item.id===id);
   if(!offer)return'';
   const free=id==='exchange-coins'?items.find(item=>item.id==='coin-free'):null;
   const primary=free&&(free.unlimited||free.remaining==null||free.remaining>0)?free:offer;
   const unavailable=!primary.available&&!isResourceShortage(primary.reason);
   return `<article class="sn-currency ${unavailable?'is-unavailable':''}" data-offer="${e(id)}">
     ${action(primary)}<h3>${e(label)}</h3>
     <div class="sn-art" ${itemInspectAttributes(1,e)}>${shopArt('coins',offer.reward.coins)}</div>
     <strong>×${n(offer.reward.coins)}</strong>
   </article>`;
 };
 const progress=gear?.basicRewardAvailable?20:(gear?.draws||0)%20;
 const box=pool=>{
  const advanced=pool==='advanced',prices=nativeEquipmentBoxPrices(pool),price=prices.single,keys=gear?.keys?.[pool]||0;
  const ticketName=advanced?'高级箱券':'普通箱券';
  const preview=s.nativeAcquisition?.equipmentBoxes?.find(row=>row.id===(advanced?3:4));
  const quotes=preview?.quotes;
  const quote=count=>quotes?.find(row=>row.count===count);
  const amount=count=>quote(count)?.amount??(keys>=count?count:count===10?prices.ten:price);
  const payment=count=>quote(count)?.payment||(keys>=count?'key':'diamond');
  const cost=count=>payment(count)==='free'?'<span class="sn-free-cost">免费开启</span>':`<span class="${payment(count)==='diamond'&&!s.wallet.unlimited&&s.wallet.diamonds<amount(count)||payment(count)==='key'&&keys<amount(count)?'is-short':''}">${payment(count)==='key'?h.img(nativeItemArt(prices.keyId),'','sn-cost-icon'):costIcon('diamonds')} ${amount(count)==null?'—':payment(count)==='key'?`${n(keys)}/${n(amount(count))}`:n(amount(count))}</span>`;
  const openButton=count=>shopButton('shopBoxConfirm',`<span>开启${count}次</span>${cost(count)}${count===1&&['free','key'].includes(payment(count))&&!blocked?'<i class="sn-box-ready" aria-hidden="true"></i>':''}`,`data-pool="${pool}" data-count="${count}" data-payment="${payment(count)}" aria-label="开启${count}次，${payment(count)==='free'?'免费':`消耗${payment(count)==='key'?ticketName:'钻石'}${amount(count)??'待同步'}`}"`,blocked||(quote(count)?!quote(count).canDraw:keys<count&&!s.wallet.unlimited&&s.wallet.diamonds<(count===10?prices.ten:price)));
  const claimable=gear?.basicRewardAvailable>0;
  const freeSeconds=Math.ceil((preview?.compatibility?.freeRemainingMs||0)/1000);
  const freeTime=[Math.floor(freeSeconds/3600),Math.floor(freeSeconds/60)%60,freeSeconds%60].map(value=>String(value).padStart(2,'0')).join(':');
  const chest=`${base}art/${advanced?'project-equipment-boxes-v1/advanced.png':'shop-comic-v1/weapon-crate-v2.webp'}`;
  return `<article class="sn-box ${advanced?'is-advanced':''}" data-box="${pool}"><div class="sn-box-shell">
   <div class="sn-box-copy"><h3>${advanced?'高级装备箱':'普通装备箱'}</h3>${boxGuarantees(preview,h)}</div>
   <button type="button" class="sn-info" data-action="shopBoxRates" data-pool="${pool}" aria-label="${advanced?'高级':'普通'}装备宝箱详情">${projectIcon('info')}</button>
   <div class="sn-box-art">${h.img(chest,advanced?'金边白色高级装备箱':'蓝灰色普通装备箱','sn-chest-image')}</div>
   ${boxShowcase(preview,h)}
   ${freeSeconds>0&&!preview?.compatibility?.clockBlocked?`<p class="sn-box-free-time" data-ui-live-text="box-${pool}">${freeTime}后免费</p>`:''}
   <div class="sn-box-actions">${openButton(1)}${openButton(10)}</div>
   ${advanced?'':`<button type="button" class="sn-box-milestone ${claimable?'is-claimable':''}" data-action="shopClaimBoxReward" aria-label="${claimable?'领取高级装备箱券':'开启20次可领高级装备箱券'}，当前${progress}/20" ${!claimable||blocked?'disabled':''}>
    ${rewardItemSlot({name:'高级装备箱券',amount:1,artwork:h.img(nativeItemArt(112),'','sn-item-art'),qualityRank:3,itemId:112},h)}
    <span class="sn-milestone-value">${s.rewardPending?'待保存':s.rewardBusy?'处理中':claimable?'领取':`${progress}/20`}</span>
    ${claimable?'<i class="sn-milestone-dot" aria-hidden="true"></i>':''}
   </button>`}
  </div></article>`;
 };
 const hours=Math.floor((shop?.remainingMinutes||0)/60),minutes=(shop?.remainingMinutes||0)%60;
 const freeRefreshes=shop?.refresh?.freeRemaining||0;
 const refreshLabel=freeRefreshes?`免费刷新×${n(freeRefreshes)}`:`${glyph('play')}<span>刷新</span>`;
 const refreshAria=freeRefreshes?`免费刷新，剩余${freeRefreshes}次`:'观看广告刷新商店';
 const current=selectedSection==='stamina'?'coins':selectedSection;
 const sections={
  boxes:()=>`<h2>装备宝箱</h2>${box('advanced')}${box('basic')}`,
  daily:()=>`<h2>每日商店</h2><div class="sn-refresh"><div><strong data-ui-live-text="shop-refresh">${hours}:${String(minutes).padStart(2,'0')} 后刷新</strong></div>${shopButton('shopRefreshPreview',refreshLabel,`aria-label="${e(refreshAria)}"`,blocked||!(freeRefreshes?shop?.refresh?.available:shop?.refresh?.adAvailable))}</div><div class="sn-daily-grid">${items.filter(o=>o.section==='daily').map(tile).join('')}</div>`,
  coins:()=>`<h2>金币</h2><div class="sn-currency-grid">${currency('exchange-coins','少量金币')}${currency('exchange-coins-medium','一袋金币')}${currency('exchange-coins-large','一箱金币')}</div>`,
 };
 return `<section class="shop-page store-reference shop-native-v2" data-shop-active="${current}" aria-label="商城">
  <nav class="store-categories" aria-label="商城分类">${[['boxes','宝箱'],['daily','每日商店'],['coins','金币']].map(([id,label])=>`<button type="button" class="store-category psd-tab ${current===id?'is-active':''}" data-action="shopSection" data-section="${id}" aria-current="${current===id}">${label}${id==='daily'&&shop?.hasFree?'<i class="store-free-dot" aria-label="可领取"></i>':''}</button>`).join('')}</nav>
  <div class="shop-scroll store-scroll"><div class="sn-content">
   ${s.rewardPending?'<p class="sn-notice">奖励待保存</p>'+shopButton('recoverDailyRewards','重试保存','',s.rewardBusy):s.rewardBusy?'<p class="sn-notice">奖励正在处理</p>':''}
   ${shop?.clockBlocked?'<p class="sn-notice">设备日期异常</p>':''}
   ${Object.entries(sections).map(([id,render])=>`<section data-shop-section="${id}" class="sn-section">${render()}</section>`).join('')}
  </div></div>
 </section>`;
}

export function shopModal(modal,s,h) {
  const {escape:e,number:n,button}=h,blocked=s.rewardPending||s.rewardBusy;
  const orderStale=modal.token!==undefined&&modal.token!==s.shop.token;
  if(modal.type==='shopStamina'){
    const offers=s.shop.items.filter(o=>o.section==='stamina');
    return {title:'体力补给',content:`<div class="sn-dialog sn-vitality"><h3>${resourceArt('stamina')}${n(s.wallet.stamina)} / ${n(s.wallet.maxStamina??s.wallet.staminaMax)}</h3><p>${e(STAMINA_RECOVERY_DESCRIPTION)}</p>${offers.map(o=>`<div class="sn-vitality-offer"><div><strong>体力 ×${o.reward.stamina}</strong><small>${o.unlimited?'不限次数':`剩余 ${o.remaining}/${o.limit}`}</small></div>${shopButton('shopOffer',o.cost.type==='ad'?`${glyph('play')}广告领取`:`${costIcon('diamonds')}${o.cost.amount}`,`data-id="${e(o.id)}"`,blocked||!o.available)}</div>${!o.available?`<p class="sn-hint">${e(availabilityMessage(o.reason))}</p>`:''}`).join('')}</div>`};
  }
  if(s.equipment?.native && ['shopBoxRates','shopBoxConfirm'].includes(modal.type)){
    const box=s.nativeAcquisition.equipmentBoxes.find(box=>box.id===(modal.pool==='advanced'?3:4));
    const quote=box.quotes.find(quote=>quote.count===(modal.count===10?10:1));
    if(modal.type==='shopBoxRates')return {title:'概率详情',content:boxDetails(box,h)};
    const stale=modal.revision!==s.equipment.revision||modal.inventoryRevision!==s.nativeAcquisition.revision;
    const cost=quote.payment==='key'?h.img(nativeItemArt(quote.itemId),'','sn-cost-icon'):costIcon('diamonds');
    return {title:`开启${box.name}`,content:`<div class="sn-dialog"><p class="sn-box-confirm-question">${quote.payment==='free'?'免费开启':`是否消耗 <span class="sn-price">${cost}<span>${quote.amount==null?'—':n(quote.amount)}</span></span> 开启${quote.count}次？`}</p>${!box.canDraw?`<p>${e(box.unavailableReason)}</p>`:''}${modal.error||stale?`<p class="sn-error">${e(stale?'库存已更新，请关闭后重新确认':modal.error)}</p>`:''}<div class="sn-dialog-actions">${shopButton('close','取消')}${shopButton('shopBoxOpen','确认开启','',blocked||stale||!quote.canDraw)}</div></div>`};
  }
  if(modal.type==='shopBoxRates'){
    const rates=modal.pool==='advanced'?s.equipment.advancedSupply.probabilities.map(r=>({name:({311:'武器模组',312:'S级史诗装备',313:'史诗装备',314:'精良装备',315:'优秀装备'})[r.id],chance:r.weight/s.equipment.advancedSupply.weightTotal*100})):[{name:'普通装备',chance:70},{name:'优秀装备',chance:30}];
    return {title:'宝箱概率',content:`<div class="sn-dialog"><h3>${modal.pool==='advanced'?'高级':'基础'}装备宝箱</h3>${rates.map(r=>`<p class="sn-rate"><span>${e(r.name)}</span><b>${Number(r.chance.toFixed(4))}%</b></p>`).join('')}</div>`};
  }
  if(modal.type==='shopBoxConfirm'){
    const pool=modal.pool==='advanced'?'advanced':'basic',count=modal.count===10?10:1,keys=s.equipment.keys[pool]||0,useKey=keys>=count,cost=(pool==='advanced'?300:60)*count;
    const icon=useKey?h.img(nativeItemArt(pool==='advanced'?112:113),'','sn-cost-icon'):costIcon('diamonds');
    return {title:`开启${pool==='advanced'?'高级':'普通'}装备箱`,content:`<div class="sn-dialog"><p class="sn-box-confirm-question">是否消耗 <span class="sn-price">${icon}<span>${n(useKey?count:cost)}</span></span> 开启${count}次？</p>${modal.error?`<p class="sn-error">${e(modal.error)}</p>`:''}<div class="sn-dialog-actions">${shopButton('close','取消')}${shopButton('shopBoxOpen','确认开启','',!useKey&&!s.wallet.unlimited&&s.wallet.diamonds<cost)}</div></div>`};
  }
  if (modal.type==='shopWeaponPreview') {
    const pool=supplyPool(s,'weapon'), tiers={white:'普通',green:'优秀',blue:'精良',purple:'史诗',gold:'传说'};
    return {title:'武器奖励预览',content:`<div class="shop-pool-copy shop-paper-pool">
      <section class="shop-pool-section" aria-label="补给档位概率"><h3>补给档位概率 <small>非保底基础概率</small></h3><dl class="shop-pool-rates">${Object.entries(pool.probabilities||{}).map(([tier,value])=>`<div data-tier="${e(tier)}"><dt><i class="shop-tier-mark" aria-hidden="true"></i>${e(pool.probabilityLabels?.[tier]||tiers[tier]||tier)}</dt><dd>${(value*100).toFixed(1)}%</dd></div>`).join('')}</dl><p class="shop-pool-note">${e(pool.duplicateText||'档位仅决定重复武器转化的零件数量，不代表武器品质。')}</p></section>
      ${pool.guaranteeText?`<p class="shop-pool-guarantee">${e(pool.guaranteeText)}</p>`:''}
      <section class="shop-pool-section" aria-label="可获得的武器"><h3>可获得武器 <small>${s.weapons.length} 种</small></h3><div class="shop-pool-grid">${s.weapons.map(w=>`<div><span class="shop-pool-item-art">${supplyWeaponArt(w,h.thumbnail)}</span><span class="shop-pool-item-name">${e(w.name)}</span></div>`).join('')}</div></section>
      ${pool.rules?.length?`<details class="shop-pool-rules"><summary tabindex="0" data-focus="shop-pool-rules">补给规则</summary>${pool.rules.map(rule=>`<p>${e(rule)}</p>`).join('')}</details>`:''}
    </div>`};
  }
  if (modal.type==='shopWeaponConfirm') {
    const cost=supplyPool(s,'weapon').singleCost??20, affordable=s.wallet.diamonds>=cost;
    return {title:'确认武器补给',content:`<div class="shop-confirm shop-paper-confirm"><div class="shop-confirm-head"><span class="shop-confirm-item-art">${projectIcon('chest-closed')}</span><div><h3>通用武器 <b>×1</b></h3><p>随机获得 1 件武器</p><small>重复转为通用强化零件</small></div></div><div class="shop-confirm-price"><p class="shop-confirm-cost"><span>消耗</span><strong>${costIcon('diamonds','shop-icon')}<b>${n(cost)}</b><span>钻石</span></strong></p><p class="shop-confirm-balance">当前拥有 <b>${n(s.wallet.diamonds)}</b> 钻石</p></div><div class="dialog-actions" role="group" aria-label="兑换操作">${button('close','暂不兑换','shop-cancel')}${button('shopWeaponBuy','确认兑换','shop-button is-yellow','',!affordable)}</div></div>`};
  }
  const o=s.shop.items.find(o=>o.id===modal.id);
  if (!o) return {title:'商品已更新',content:'请关闭后重新选择。'};
  const max=shopPurchaseMax(o,s.wallet),quantity=Math.max(1,Math.min(Math.max(1,max),modal.quantity||1));
  const rewardType=Object.keys(o.reward)[0],price=o.cost.amount*quantity,currency=resourceNames[o.cost.type]||'';
  const disabled=blocked||orderStale||!o.available||quantity>max;
  return {title:'确认兑换',content:`<div class="sn-dialog sn-exchange-dialog">
    <div class="sn-exchange-product">
      <span class="sn-exchange-item" ${itemInspectAttributes(shopItemId(rewardType),e)}>${shopArt(rewardType,o.reward[rewardType])}</span>
      <div class="sn-exchange-copy"><h3>${e(shopOfferName(o))}</h3><p>×${n(o.reward[rewardType]*quantity)}</p></div>
      ${o.maxQuantity>1?`<div class="sn-quantity" aria-label="购买数量">${shopButton('shopQuantity','−','data-step="-1" aria-label="减少数量"',quantity<=1)}<output aria-label="购买数量">${quantity}</output>${shopButton('shopQuantity','＋','data-step="1" aria-label="增加数量"',quantity>=max)}${shopButton('shopQuantity','MAX','data-step="max" aria-label="最大数量"',quantity>=max)}</div>`:''}
    </div>
    <div class="sn-dialog-actions sn-exchange-actions">${shopButton('shopConfirm',`${costIcon(o.cost.type)}<span>${n(price)}</span>`,`data-id="${e(o.id)}" aria-label="确认兑换，消耗${n(price)}${e(currency)}"`,disabled)}</div>
  </div>`};
}

export function tasksModal(s,h,period='daily') {
  const {escape:e,number:n,icon,button}=h;
  const tasks=s.tasks.filter(t=>t.type===period),names={coins:'金币',diamonds:'钻石',aircraftShards:'飞机碎片',weaponParts:'零件'};
  return `<div class="task-tabs" role="group" aria-label="任务分类">${[['daily','每日任务'],['weekly','每周任务']].map(([id,label])=>`<button type="button" data-action="taskPeriod" data-period="${id}" aria-pressed="${id===period}">${label}${s.tasks.some(t=>t.type===id&&t.claimable)?'<i class="shop-free-dot"></i>':''}</button>`).join('')}</div><p class="task-refresh">${period==='daily'?'每日00:00刷新':'每周一00:00刷新'}</p><div class="pl-task-list">${tasks.map(t=>`<div class="pl-task"><div class="pl-task-badge">${icon(period==='weekly'?'medal':'mission')}</div><div class="pl-task-copy"><h3>${e(t.name)}</h3><p class="task-rewards">${Object.entries(t.reward||{}).map(([key,amount])=>`${names[key]||key} ×${n(amount)}`).join(' · ')}</p><progress aria-label="${e(t.name)}进度" max="${t.target}" value="${Math.min(t.progress,t.target)}"></progress><small>${n(Math.min(t.progress,t.target))} / ${n(t.target)}</small></div>${button('claimTask',t.claimed?'已领取':t.claimable?'领取':'进行中',t.claimable?'pl-primary':'pl-secondary',`data-id="${e(t.id)}"`,!t.claimable)}</div>`).join('')}</div>`;
}

import './shop-layout.css';

import './shop-box-presentation.css';
