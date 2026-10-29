import { equipmentWeaponCard } from './equipment-page.js';
import { gearWorkshopPage } from './gear-workshop-page.js';
import { projectIconUrl } from './project-ui-art.js';
import { catalogWeaponArtwork } from './weapon-catalog-page.js';
import { lobbyCost } from './lobby-cost.js';
import { WEAPON_QUALITIES } from '../fixed-parts/common-weapons.js';
import { emptySlotMark } from './psd-empty-slot.js';
import './workshop-reference-page.css';

const base=import.meta.env?.BASE_URL??'/';
const image=(name,cls='')=>name==='workshop-plus'?emptySlotMark(`ws-empty-mark ${cls}`):`<img class="${cls}" src="${projectIconUrl('upgrade-arrow')}" alt="" aria-hidden="true" draggable="false">`;
export const workshopNumber=value=>Number(value||0).toLocaleString('zh-CN',{maximumFractionDigits:3});
const button=(action,label,attrs='',cls='',disabled=false)=>`<button type="button" class="wc-button ${cls}" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;
export const WORKSHOP_FILTERS=['all','ready','equipped',...WEAPON_QUALITIES.map((_,i)=>`q${i}`)];
const filterLabel=(value,leveling)=>value==='all'?'全部':value==='ready'?(leveling?'可强化':'可升星'):value==='equipped'?'已装备':WEAPON_QUALITIES[Number(value.slice(1))]||'全部';
export function workshopFilterDialog(value,mode='level',gear) {
  const choices=mode==='gear'?[['all','全部'],...gear.blueprints.map(p=>[String(p.type),p.name])]:WORKSHOP_FILTERS.map(key=>[key,filterLabel(key,mode==='level')]);
  return {title:mode==='gear'?'筛选装备部位':'筛选武器',content:`<div class="ws-filter-options">${choices.map(([key,label])=>button('workshopFilterSelect',label,`data-filter="${key}" aria-pressed="${key===value}"`)).join('')}</div>`};
}

export function workshopReferencePage({snapshot:s,helpers:h,workshopId,workshopFilter='all',workshopMode='level',workshopBackLabel='返回装备',workshopKind='weapon',gearWorkshop}) {
  if(workshopKind==='gear')return gearWorkshopPage({snapshot:s,helpers:h,gearWorkshop,workshopFilter});
  const {escape:e}=h,leveling=workshopMode==='level';
  const all=(s.workshop?.items||[]).map(item=>({...item,growth:s.weapons.find(w=>w.id===item.id)}));
  const items=all.filter(item=>item.owned&&item.growth&&(workshopFilter==='ready'?(leveling?item.growth.canUpgrade:item.canSynthesize):workshopFilter==='equipped'?(item.equipped||item.id===s.innateWeapon):workshopFilter.startsWith('q')?item.qualityRank===Number(workshopFilter.slice(1)):true));
  const item=all.find(item=>item.id===workshopId&&item.owned&&item.growth),growth=item?.growth;
  const ready=Boolean(item&&(leveling?growth.canUpgrade:item.canSynthesize));
  const capped=Boolean(item&&leveling&&!growth.cost),canChange=capped&&item.qualityRank<5;
  const current=item?(leveling?`Lv.${growth.level}`:`${item.qualityRank}星`):'';
  const next=item?(leveling?growth.cost?`Lv.${growth.level+1}`:`Lv.${growth.maxLevel??growth.level}`:item.nextQualityRank!=null?`${item.nextQualityRank}星`:`${item.qualityRank}星`):'';
  const cannotAdvance=Boolean(item&&(leveling?capped:item.qualityRank>=5));
  const targetLabel=leveling&&capped?'等级上限':!leveling&&item?.qualityRank>=5?'最高品质':'提升后';
  let reason='';
  if(item&&!ready) {
    if(capped)reason=canChange?'升星可提高等级上限':'已满级';
    else if(leveling) {
      const short=[];
      if(s.wallet?.coins<growth.cost.coins)short.push('金币');
      if(s.wallet?.weaponParts<growth.cost.weaponParts)short.push('零件');
      reason=short.length?short.join('与')+'不足':'材料不足';
    } else reason=item.qualityRank>=5?'已满星':s.workshop?.universalFragments<item.universalCost?'通用零件不足':item.reason||'材料不足';
  }
  const qualityEffect=(item?.nextEffect||item?.currentEffect||'').replace('；等级上限 ',' · 上限 ');
  const effect=item?(leveling?growth.cost?`基础伤害 ${workshopNumber(growth.damage)} → ${workshopNumber(growth.nextDamage??growth.damage)}`:`基础伤害 ${workshopNumber(growth.damage)}`:qualityEffect):'';
  const cost=(label,icon,amount,available)=>amount>0?lobbyCost(h,{label,icon,amount,available,showAvailable:true}):'';
  const price=!item?'':leveling?growth.cost?cost('金币','coin',growth.cost.coins,s.wallet?.coins)+cost('通用零件','parts',growth.cost.weaponParts,s.wallet?.weaponParts):'':item.cost?cost('通用零件','parts',item.universalCost,s.workshop?.universalFragments)+cost('专属碎片','shard',item.specificCost,item.fragments):'';
  const slot=result=>`<button type="button" class="wc-item ws-slot workshop-scene-slot${result?' is-result':''}" data-action="workshopChoose" ${item?`data-psd-quality="${result&&!leveling?(item.nextQualityRank??item.qualityRank):item.qualityRank}"`: ''} aria-label="${item?`${e(item.name)}，${result?targetLabel:'当前属性'}`:'选择武器'}"><small>${result?targetLabel:'当前'}</small><span class="ws-slot-art">${item?catalogWeaponArtwork(growth,h):image('workshop-plus')}</span>${item?`<span class="ws-slot-level"${!result?` data-growth-id="${e(item.id)}" data-growth-stat="${leveling?'level':'qualityRank'}"`:''}>${e(result?next:current)}</span>`:''}</button>`;
  const label=!item?(leveling?'强化':'升星'):leveling?capped?canChange?'去升星':'已满级':'强化':item.qualityRank>=5?'已满星':'升星';
  const action=canChange?'workshopMode':leveling?'upgrade':'workshopSynthesize';
  return `<section class="ws-page" data-workshop-mode="${workshopMode}" aria-label="改装间">
    <div class="ws-stage"><header class="ws-header"><h1>改装间</h1><div class="ws-modes" role="group" aria-label="改装类型">${button('workshopMode','强化',`data-mode="level" aria-pressed="${leveling}"`,leveling?'is-active':'')}${button('workshopMode','升星',`data-mode="quality" aria-pressed="${!leveling}"`,leveling?'':'is-active')}</div></header>
      <div class="ws-recipe">${slot(true)}${image('workshop-arrow',`ws-arrow${cannotAdvance?' is-capped':''}`)}${slot(false)}</div>
      <div class="ws-message"><h2>${item?e(item.name):'选择武器'}</h2>${effect?`<p data-growth-id="${e(item.id)}" data-growth-stat="damage">${e(effect)}</p>`:''}${reason?`<small>${e(reason)}</small>`:''}</div>
      <img class="ws-technician" src="${base}art/project-workshop-technician-v2/technician-v2.webp" alt="" aria-hidden="true" draggable="false">
    </div>
    <header class="ws-warehouse-heading">${button('workshopFilter',workshopFilter==='all'?'筛选':filterLabel(workshopFilter,leveling),`aria-label="筛选武器，当前${filterLabel(workshopFilter,leveling)}"`)}<h2>仓库</h2>${!leveling?button('workshopBatch','一键升星','','ws-batch',!s.workshop?.batch?.steps?.length):'<span></span>'}</header>
    <div class="ref-warehouse ws-inventory" data-workshop-scroll="${workshopMode}:${workshopFilter}"><div class="ref-item-grid ws-grid">${items.map(w=>equipmentWeaponCard(w.growth,{snapshot:s,helpers:h},{action:'workshopSelect',selected:item?.id,innateId:s.innateWeapon})).join('')}</div>${items.length?'':'<p class="ws-empty">暂无符合条件的武器</p>'}</div>
    <footer class="ws-footer">${button('catalogBack','返回',`aria-label="${e(workshopBackLabel)}"`,'ws-back')}${button(action,`<strong>${label}</strong>${price?`<small class="workshop-cost ws-price">${price}</small>`:''}`,`data-kind="weapon" data-id="${e(item?.id||'')}" data-rank="${item?.qualityRank??''}"${canChange?' data-mode="quality"':''}`,'ws-confirm',!ready&&!canChange)}</footer>
  </section>`;
}
