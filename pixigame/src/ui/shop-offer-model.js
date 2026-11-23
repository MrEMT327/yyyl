import {GEAR_PARTS} from '../peripheral/equipment-system.js';
import {nativeItemPresentation} from '../replica/native-item-presentation.js';
import {nativeItemDisplayName} from '../replica/native-item-names.js';

export const shopItemId=type=>/^researchBlueprint\d+$/.test(type)?Number(type.slice(17)):/^blueprint[1-5]$/.test(type)?GEAR_PARTS[Number(type.slice(9))-1]?.blueprintId:({basicKeys:113,advancedKeys:112,randomBlueprints:10010007,coins:1,diamonds:2,stamina:4,weaponParts:129})[type]||type;
export const resourceNames = {coins:'金币',diamonds:'钻石',stamina:'体力',weaponParts:'武器零件',aircraftShards:'机体碎片'};
export const shopName=type=>type.startsWith('researchBlueprint')?nativeItemPresentation(Number(type.slice(17))).name:type==='randomBlueprints'?nativeItemPresentation(10010007).name:type==='basicKeys'?nativeItemDisplayName(113):type==='advancedKeys'?nativeItemDisplayName(112):type.startsWith('blueprint')?`${GEAR_PARTS[Number(type.slice(9))-1].name}图纸`:resourceNames[type]||type;
export const shopOfferName=offer=>{const type=Object.keys(offer.reward||{})[0]||'';return /^(?:researchBlueprint\d+|blueprint\d+|basicKeys|advancedKeys|randomBlueprints)$/.test(type)?shopName(type):offer.name||shopName(type);};
const cardNames={researchBlueprint801:'机炮图纸',researchBlueprint802:'火箭图纸',researchBlueprint803:'激光图纸',researchBlueprint804:'酸液图纸',researchBlueprint805:'冰刃图纸',researchBlueprint806:'散射图纸',researchBlueprint807:'射线图纸',researchBlueprint808:'光剑图纸',researchBlueprint809:'锯盘图纸',researchBlueprint810:'闪电图纸',researchBlueprint811:'黑洞图纸',blueprint1:'头盔图纸',blueprint2:'护手图纸',blueprint3:'胸甲图纸',blueprint4:'铭牌图纸',blueprint5:'战靴图纸',basicKeys:'普通箱券',advancedKeys:'高级箱券',randomBlueprints:'随机图纸'};
export const shopCardName=offer=>cardNames[Object.keys(offer.reward||{})[0]]||shopOfferName(offer);
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

export const equipmentBox = (snapshot, pool) => snapshot.nativeAcquisition?.equipmentBoxes?.find(row => row.id === (pool === 'advanced' ? 3 : 4));
