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
import { weaponThemeArt } from './weapon-theme-art.js';
import { equipmentBoxReceiptItems } from '../replica/native-equipment-box-receipt.js';
import { supplyPool } from './supply-pools.js';
import {GEAR_PARTS} from '../peripheral/equipment-system.js';
import './shop-native-v2.css';
import { nativeItemArt, nativeItemPresentation } from '../replica/native-item-presentation.js';
import { nativeItemDisplayName } from '../replica/native-item-names.js';
const resourceNames = {coins:'金币',diamonds:'钻石',stamina:'体力',weaponParts:'武器零件',aircraftShards:'机体碎片'};
const resourceIcons = {coins:'coins',diamonds:'gem',stamina:'bolt',weaponParts:'gear',aircraftShards:'jet-fighter'};
const glyph = (name, cls='') => resourceIcon(name, "shop-icon " + cls) || projectIcon({play:'ad-play',box:'chest-closed',gear:'weapon-parts','jet-fighter':'aircraft-shard'}[name]||name,`shop-icon ${cls}`);
const resourceArt = type => resourceIcon(type,'shop-resource-art') || glyph(resourceIcons[type]||'box',`shop-resource-symbol is-${type}`);

export const shopHeader = lobbyHeader;

export function shopNavigation() { return lobbyNavigation('shop'); }

// Older resource-header links used the recruitment section for diamonds.
const shopButton=(action,label,data='',disabled=false)=>`<button type="button" class="wc-button sn-button" data-action="${action}" ${data} ${disabled?'disabled':''}>${label}</button>`;
const shopArt=type=>type.startsWith('researchBlueprint')?`<img src="${nativeItemArt(Number(type.slice(17)))}" alt="" draggable="false">`:type==='basicKeys'||type==='advancedKeys'?`<img src="${nativeItemArt(type==='basicKeys'?113:112)}" alt="" draggable="false">`:type.startsWith('blueprint')?`<img src="${nativeItemArt(GEAR_PARTS[Number(type.slice(9))-1].blueprintId)}" alt="" draggable="false">`:type==='randomBlueprints'?projectIcon('chest-closed','sn-item-art'):type==='coins'?projectIcon('credits-stack','sn-item-art'):resourceArt(type);
const shopName=type=>type.startsWith('researchBlueprint')?nativeItemPresentation(Number(type.slice(17))).name:type==='randomBlueprints'?'随机强化图纸':type==='basicKeys'?nativeItemDisplayName(113):type==='advancedKeys'?nativeItemDisplayName(112):type.startsWith('blueprint')?`${GEAR_PARTS[Number(type.slice(9))-1].name}图纸`:resourceNames[type]||type;
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
 const action=(o,extra='')=>{
   const reason=s.rewardPending?'奖励待保存':s.rewardBusy?'奖励处理中':!o.available?availabilityMessage(o.reason):'';
   const soldOut=!o.unlimited&&o.remaining===0||o.reason==='今日已领取';
   const label=soldOut&&!blocked?'已售罄':o.cost.amount?`<span class="sn-price ${isResourceShortage(o.reason)?'is-short':''}">${resourceIcon(o.cost.type,'sn-cost-icon')}<span>${n(o.cost.amount)}</span></span>${reason?`<small>${e(reason)}</small>`:''}`:reason?e(reason):o.cost.type==='ad'?`${glyph('play')}广告领取`:'免费领取';
   return shopButton('shopOffer',label,`data-id="${e(o.id)}" ${!blocked&&isResourceShortage(o.reason)?`data-resource-short="${e(resourceNames[o.cost.type]||'资源')}"`:''} aria-label="${e(o.name)}，${o.cost.amount?`消耗${o.cost.amount}${resourceNames[o.cost.type]||''}`:o.cost.type==='ad'?'广告领取':'免费领取'}${o.reason?'，'+e(availabilityMessage(o.reason)):''}" ${extra}`,blocked||!o.available);
 };
 const tile=o=>{const[type,amount]=Object.entries(o.reward)[0];return `<article class="sn-tile" data-offer="${e(o.id)}"><h3>${e(o.name)}</h3><div class="sn-art">${shopArt(type)}</div><strong>×${n(amount)}</strong>${o.discount?`<span class="sn-discount">${o.discount}折</span>`:''}<small>${o.remaining?'限购 '+o.remaining+' 次':'已售罄'}</small>${action(o)}</article>`;};
 const currency=(id,label)=>{const o=items.find(x=>x.id===id);if(!o)return'';const free=id==='exchange-coins'?items.find(x=>x.id==='coin-free'):null,ad=id==='exchange-coins'?items.find(x=>x.id==='coin-ad'):null,primary=free?.available?free:ad?.available?ad:o;return `<article class="sn-currency" data-offer="${e(id)}"><div class="sn-art">${shopArt('coins')}</div><div class="sn-currency-copy"><h3>${e(label)}</h3><strong>×${n(o.reward.coins)}</strong><small>今日剩余 ${n(primary.remaining)} 次</small></div>${action(primary)}</article>`;};
 const progress=gear?.basicRewardAvailable?20:(gear?.draws||0)%20;
 const box=pool=>{
  const advanced=pool==='advanced',prices=nativeEquipmentBoxPrices(pool),price=prices.single,keys=gear?.keys?.[pool]||0;
  const ranks=advanced?[1,2,3]:[0,1];
  const quotes=s.nativeAcquisition?.equipmentBoxes?.find(row=>row.id===(advanced?3:4))?.quotes;
  const quote=count=>quotes?.find(row=>row.count===count);
  const amount=count=>quote(count)?.amount??(keys>=count?count:count===10?prices.ten:price);
  const payment=count=>quote(count)?.payment||(keys>=count?'key':'diamond');
  const cost=count=>payment(count)==='free'?'<span>免费开启</span>':`<span class="${payment(count)==='diamond'&&!s.wallet.unlimited&&s.wallet.diamonds<amount(count)||payment(count)==='key'&&keys<amount(count)?'is-short':''}">${payment(count)==='key'?h.img(nativeItemArt(prices.keyId),'','sn-cost-icon'):resourceIcon('diamonds','sn-cost-icon')} ${amount(count)==null?'—':n(amount(count))}</span>`;
  return `<article class="sn-box ${advanced?'is-advanced':''}" data-box="${pool}">
   <h3>${advanced?'高级装备箱':'普通装备箱'}</h3>
   <button type="button" class="sn-info" data-action="shopBoxRates" data-pool="${pool}" aria-label="${advanced?'高级':'基础'}装备宝箱概率">${projectIcon('info')}</button>
   <div class="sn-box-art">${projectIcon('chest-closed')}</div>
   <div class="sn-box-copy"><div class="sn-quality-range" aria-label="${advanced?'优秀、精良、史诗装备':'普通、优秀装备'}">${ranks.map(rank=>`<i data-psd-quality="${rank}" aria-hidden="true"></i>`).join('')}</div>${advanced?'<small>含随机武器、飞机</small>':''}${advanced&&!gear?.native?'<p>含 S 级装备</p>':''}${keys?`<small>补给券 ×${n(keys)}</small>`:''}</div>
   ${advanced?'':`<button type="button" class="sn-progress" data-action="shopClaimBoxReward" ${gear?.basicRewardAvailable&&!s.rewardPending&&!s.rewardBusy?'':'disabled'} aria-label="${gear?.basicRewardAvailable?'领取高级装备箱券':'开启20次可领高级装备箱券'}" title="每开启20次，领取高级装备箱券 ×1"><span data-psd-quality="3">${h.img(nativeItemArt(112),'','sn-item-art')}</span><b>${s.rewardPending?'待保存':s.rewardBusy?'处理中':gear?.basicRewardAvailable?'领取':`${progress}/20`}</b></button>`}
   <div class="sn-box-actions">${shopButton('shopBoxConfirm',`<span>开启1次</span>${cost(1)}`,`data-pool="${pool}" data-count="1" data-payment="${payment(1)}" aria-label="开启1次，${quote(1)?.payment==='free'?'免费':`消耗${payment(1)==='key'?'补给券':'钻石'}${amount(1)??'待同步'}`}"`,blocked||(quote(1)?!quote(1).canDraw:keys<1&&!s.wallet.unlimited&&s.wallet.diamonds<price))}${shopButton('shopBoxConfirm',`<span>开启10次</span>${cost(10)}`,`data-pool="${pool}" data-count="10" aria-label="开启10次，消耗${payment(10)==='key'?'补给券':'钻石'}${amount(10)??'待同步'}"`,blocked||(quote(10)?!quote(10).canDraw:keys<10&&!s.wallet.unlimited&&s.wallet.diamonds<prices.ten))}</div>
  </article>`;
 };
 const hours=Math.floor((shop?.remainingMinutes||0)/60),minutes=(shop?.remainingMinutes||0)%60;
 const current=selectedSection==='stamina'?'coins':selectedSection;
 const sections={
  boxes:()=>`<h2>装备宝箱</h2>${box('advanced')}${box('basic')}`,
  daily:()=>`<h2>每日商店</h2><div class="sn-daily-grid">${items.filter(o=>o.section==='daily').map(tile).join('')}</div><div class="sn-refresh"><div><strong>${hours}:${String(minutes).padStart(2,'0')} 后刷新</strong><small>今日免费刷新：${shop?.refresh?.freeRemaining||0} / ${shop?.refresh?.freeLimit??3}</small></div>${shopButton('shopRefreshPreview',shop?.refresh?.cost?'刷新商品':'免费刷新','',blocked||!(shop?.refresh?.available||shop?.refresh?.adAvailable))}</div>`,
  coins:()=>`<h2>金币</h2><div class="sn-currency-grid">${currency('exchange-coins','少量金币')}${currency('exchange-coins-medium','一袋金币')}${currency('exchange-coins-large','一箱金币')}</div>`,
 };
 return `<section class="shop-page store-reference shop-native-v2" data-shop-active="${current}" aria-label="商城">
  <nav class="store-categories" aria-label="商城分类">${[['boxes','宝箱'],['daily','每日商店'],['coins','金币']].map(([id,label])=>`<button type="button" class="store-category psd-tab ${current===id?'is-active':''}" data-action="shopSection" data-section="${id}" aria-current="${current===id}">${label}${id==='daily'&&shop?.hasFree?'<i class="store-free-dot" aria-label="可领取"></i>':''}</button>`).join('')}</nav>
  <div class="shop-scroll store-scroll"><div class="sn-content">
   ${s.rewardPending?'<p class="sn-notice">奖励待保存</p>'+shopButton('recoverDailyRewards','重试保存','',s.rewardBusy):s.rewardBusy?'<p class="sn-notice">奖励正在处理</p>':''}
   ${shop?.clockBlocked?'<p class="sn-notice">设备日期异常</p>':''}
   <section data-shop-section="${current}" class="sn-section">${sections[current]()}</section>
  </div></div>
 </section>`;
}

export function shopModal(modal,s,h) {
  const {escape:e,number:n,button}=h,blocked=s.rewardPending||s.rewardBusy;
  const orderStale=modal.token!==undefined&&modal.token!==s.shop.token;
  if(modal.type==='shopStamina'){
    const offers=s.shop.items.filter(o=>o.section==='stamina');
    return {title:'体力补给',content:`<div class="sn-dialog sn-vitality"><h3>${resourceArt('stamina')}${n(s.wallet.stamina)} / ${n(s.wallet.maxStamina??s.wallet.staminaMax)}</h3><p>${e(STAMINA_RECOVERY_DESCRIPTION)}</p>${offers.map(o=>`<div class="sn-vitality-offer"><div><strong>体力 ×${o.reward.stamina}</strong><small>${o.unlimited?'不限次数':`今日剩余 ${n(o.remaining)} 次`}</small></div>${shopButton('shopOffer',o.cost.type==='ad'?`${glyph('play')}广告领取`:`${resourceIcon('diamonds','sn-cost-icon')}${o.cost.amount}`,`data-id="${e(o.id)}"`,blocked||!o.available)}</div>${!o.available?`<p class="sn-hint">${e(availabilityMessage(o.reason))}</p>`:''}`).join('')}</div>`};
  }
  if(modal.type==='shopRefreshConfirm'){
    const refresh=s.shop.refresh,adMode=refresh.freeRemaining===0;
    return {title:'刷新每日商店',content:`<div class="sn-dialog"><p>${adMode?'免费次数已用完，看广告可刷新一次。':`今日免费刷新：${n(refresh.freeRemaining)} / ${n(refresh.freeLimit)}`}</p><p>同一商品当日限购不重置。</p>${orderStale?'<p class="sn-error">商品已更新，请重新选择。</p>':''}${adMode&&!refresh.adAvailable&&refresh.adReason?`<p class="sn-hint">${e(refresh.adReason)}</p>`:''}<div class="sn-dialog-actions">${adMode?shopButton('shopRefreshConfirm',`金币 ×${n(refresh.cost)}<br>刷新`,'',blocked||orderStale||!refresh.available):shopButton('close','取消')}${shopButton(adMode?'shopRefreshAdConfirm':'shopRefreshConfirm',adMode?`${glyph('play')}看广告刷新`:'免费刷新','',blocked||orderStale||!(adMode?refresh.adAvailable:refresh.available))}</div></div>`};
  }
  if(s.equipment?.native && ['shopBoxRates','shopBoxConfirm'].includes(modal.type)){
    const box=s.nativeAcquisition.equipmentBoxes.find(box=>box.id===(modal.pool==='advanced'?3:4));
    const quote=box.quotes.find(quote=>quote.count===(modal.count===10?10:1));
    if(modal.type==='shopBoxRates')return {title:'宝箱概率',content:`<div class="sn-dialog"><h3>${e(box.name)}</h3>${box.rates.map(r=>`<p class="sn-rate"><span>${e(r.name)}</span><b>${r.weight/1000}%</b></p>`).join('')}</div>`};
    const stale=modal.revision!==s.equipment.revision||modal.inventoryRevision!==s.nativeAcquisition.revision;
    return {title:'开启装备宝箱',content:`<div class="sn-dialog"><h3>${e(box.name)} ×${quote.count}</h3><p>${quote.payment==='free'?'免费开启':`消耗${quote.payment==='key'?'箱券':'钻石'} ×${quote.amount??'—'}`}</p>${!box.canDraw?`<p>${e(box.unavailableReason)}</p>`:''}${modal.error||stale?`<p class="sn-error">${e(stale?'库存已更新，请关闭后重新确认':modal.error)}</p>`:''}<div class="sn-dialog-actions">${shopButton('close','取消')}${shopButton('shopBoxOpen','确认开启','',blocked||stale||!quote.canDraw)}</div></div>`};
  }
  if(modal.type==='shopBoxRates'){
    const rates=modal.pool==='advanced'?s.equipment.advancedSupply.probabilities.map(r=>({name:({311:'武器模组',312:'S级史诗装备',313:'史诗装备',314:'精良装备',315:'优秀装备'})[r.id],chance:r.weight/s.equipment.advancedSupply.weightTotal*100})):[{name:'普通装备',chance:70},{name:'优秀装备',chance:30}];
    return {title:'宝箱概率',content:`<div class="sn-dialog"><h3>${modal.pool==='advanced'?'高级':'基础'}装备宝箱</h3>${rates.map(r=>`<p class="sn-rate"><span>${e(r.name)}</span><b>${Number(r.chance.toFixed(4))}%</b></p>`).join('')}</div>`};
  }
  if(modal.type==='shopBoxConfirm'){
    const pool=modal.pool==='advanced'?'advanced':'basic',count=modal.count===10?10:1,keys=s.equipment.keys[pool]||0,useKey=keys>=count,cost=(pool==='advanced'?300:60)*count;
    return {title:'开启装备宝箱',content:`<div class="sn-dialog"><h3>${pool==='advanced'?'高级':'基础'}装备宝箱 ×${count}</h3><p>消耗${useKey?'补给券':'钻石'} ×${useKey?count:cost}</p>${modal.error?`<p class="sn-error">${e(modal.error)}</p>`:''}<div class="sn-dialog-actions">${shopButton('close','取消')}${shopButton('shopBoxOpen','确认开启','',!useKey&&!s.wallet.unlimited&&s.wallet.diamonds<cost)}</div></div>`};
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
    return {title:'确认武器补给',content:`<div class="shop-confirm shop-paper-confirm"><div class="shop-confirm-head"><span class="shop-confirm-item-art">${projectIcon('chest-closed')}</span><div><h3>通用武器 <b>×1</b></h3><p>随机获得 1 件武器</p><small>重复转为通用强化零件</small></div></div><div class="shop-confirm-price"><p class="shop-confirm-cost"><span>消耗</span><strong>${glyph('gem')}<b>${n(cost)}</b><span>钻石</span></strong></p><p class="shop-confirm-balance">当前拥有 <b>${n(s.wallet.diamonds)}</b> 钻石</p></div><div class="dialog-actions" role="group" aria-label="兑换操作">${button('close','暂不兑换','shop-cancel')}${button('shopWeaponBuy','确认兑换','shop-button is-yellow','',!affordable)}</div></div>`};
  }
  const o=s.shop.items.find(o=>o.id===modal.id);
  if (!o) return {title:'商品已更新',content:'请关闭后重新选择。'};
  const max=shopPurchaseMax(o,s.wallet),quantity=Math.max(1,Math.min(Math.max(1,max),modal.quantity||1)),rewardType=Object.keys(o.reward)[0],balance=s.wallet[o.cost.type];
  return {title:'确认兑换',content:`<div class="sn-dialog"><div class="shop-confirm-head"><span class="shop-confirm-item-art">${shopArt(rewardType)}</span><div><h3>${e(o.name)}</h3><p>×${n(o.reward[rewardType]*quantity)}</p><small>${o.unlimited?'不限次数':`今日剩余 ${n(o.remaining)} 次`}</small></div></div>${o.maxQuantity>1?`<div class="sn-quantity" aria-label="购买数量">${shopButton('shopQuantity','−','data-step="-1" aria-label="减少数量"',quantity<=1)}<output>${quantity}</output>${shopButton('shopQuantity','＋','data-step="1" aria-label="增加数量"',quantity>=max)}</div>`:''}<p class="sn-confirm-price">消耗 ${resourceIcon(o.cost.type,'sn-cost-icon')}${n(o.cost.amount*quantity)}</p><p>${e(resourceNames[o.cost.type]||'')}余额 ${n(balance)}</p>${modal.error||orderStale?`<p class="sn-error">${e(orderStale?'商品已更新，请重新选择。':modal.error)}</p>`:''}<div class="sn-dialog-actions">${shopButton('close','取消')}${shopButton('shopConfirm',o.available?'确认兑换':e(o.reason),`data-id="${e(o.id)}"`,blocked||orderStale||!o.available||quantity>max||!s.wallet.unlimited&&balance<o.cost.amount*quantity)}</div></div>`};
}

export function tasksModal(s,h,period='daily') {
  const {escape:e,number:n,icon,button}=h;
  const tasks=s.tasks.filter(t=>t.type===period),names={coins:'金币',diamonds:'钻石',aircraftShards:'飞机碎片',weaponParts:'零件'};
  return `<div class="task-tabs" role="group" aria-label="任务分类">${[['daily','每日任务'],['weekly','每周任务']].map(([id,label])=>`<button type="button" data-action="taskPeriod" data-period="${id}" aria-pressed="${id===period}">${label}${s.tasks.some(t=>t.type===id&&t.claimable)?'<i class="shop-free-dot"></i>':''}</button>`).join('')}</div><p class="task-refresh">${period==='daily'?'每日00:00刷新':'每周一00:00刷新'}</p><div class="pl-task-list">${tasks.map(t=>`<div class="pl-task"><div class="pl-task-badge">${icon(period==='weekly'?'medal':'mission')}</div><div class="pl-task-copy"><h3>${e(t.name)}</h3><p class="task-rewards">${Object.entries(t.reward||{}).map(([key,amount])=>`${names[key]||key} ×${n(amount)}`).join(' · ')}</p><progress aria-label="${e(t.name)}进度" max="${t.target}" value="${Math.min(t.progress,t.target)}"></progress><small>${n(Math.min(t.progress,t.target))} / ${n(t.target)}</small></div>${button('claimTask',t.claimed?'已领取':t.claimable?'领取':'进行中',t.claimable?'pl-primary':'pl-secondary',`data-id="${e(t.id)}"`,!t.claimable)}</div>`).join('')}</div>`;
}

import './shop-layout.css';
