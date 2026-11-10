import { itemInspectAttributes } from './item-description-model.js';
import {nativeItemPresentation} from '../replica/native-item-presentation.js';
import {nativeGearPresentation} from '../replica/native-item-names.js';
import {rewardItemSlot} from './reward-item-slot.js';

export const boxChestArt=box=>`${import.meta.env?.BASE_URL||'/'}art/${box.id===3?'project-equipment-boxes-v1/advanced.png':'shop-comic-v1/weapon-crate-v2.webp'}`;
const percent=(weight,denominator=100000)=>`${Number((weight/denominator*100).toFixed(3))}%`;
export const boxRewardGroups=box=>(box?.rates||[]).filter(group=>group.weight>0).map(group=>({...group,items:group.items.filter(item=>item.weight>0).map(item=>({...item,...nativeItemPresentation(item.id)}))}));
// Showcase real obtainable equipment, with three different silhouettes/parts.
export function boxShowcaseItems(box) {
 const items=boxRewardGroups(box).flatMap(group=>group.items).map(item=>({...item,gear:nativeGearPresentation(item.id)})).filter(item=>item.gear&&item.image);
 const advanced=box?.id===3,parts=advanced?['fire-control','cockpit','fuselage']:['engine-armor','cockpit','fuselage'];
 return parts.map((part,index)=>items.filter(item=>item.gear.partId===part).sort((a,b)=>{
  const aRank=advanced&&index===1?a.gear.rank:0,bRank=advanced&&index===1?b.gear.rank:0;
  return bRank-aRank||b.qualityRank-a.qualityRank||a.id-b.id;
 })[0]).filter(Boolean);
}
export function boxShowcase(box,h) {
 const pool=box?.id===3?'advanced':'basic';
 return `<div class="sn-box-effects" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i class="sn-box-spark" style="--spark:${i};--spark-row:${i%3}"></i>`).join('')}</div>${boxShowcaseItems(box).map((item,index)=>`<button type="button" class="sn-floating-gear sn-floating-${index}" ${itemInspectAttributes(item.id,h.escape)} aria-label="${h.escape(item.name)}，${h.escape(item.qualityName)}，查看道具详情" aria-description="${h.escape(item.name)} · ${h.escape(item.qualityName)}"><span class="sn-floating-orb">${h.img(item.image,'','')}${item.gear.rank===1?'<b class="sn-floating-rank">S</b>':''}</span></button>`).join('')}`;
}
export function boxGuarantees(box,h,{detail=false}={}) {
 const state=box?.compatibility;if(!state)return '';
 const advanced=box.id===3;
 return [{remaining:state.qualityRemaining,quality:advanced?3:1,label:advanced?'史诗':'优秀'},...(advanced?[{remaining:state.sRemaining,quality:3,label:'圣环',series:true}]:[])].filter(row=>Number.isSafeInteger(row.remaining)&&row.remaining>0).map(row=>`<p class="${detail?'sn-detail-guarantee':'sn-box-guarantee'} ${row.series?'is-series':''}"><b>${h.number(row.remaining)}</b>件内必得<span class="sn-quality-text" data-rarity="${row.quality}">${row.label}</span>装备</p>`).join('');
}
function previewSlot(item,h) {
 return rewardItemSlot({name:item.name,amount:item.count,artwork:item.image?h.img(item.image,'',''):'' ,qualityRank:item.qualityRank,qualityKnown:item.qualityKnown,qualityName:item.qualityName,itemId:item.id},h);
}
// Reference layout: all rewards in five columns, one continuous vertical scroll.
export function boxDetails(box,h) {
 const groups=boxRewardGroups(box);
 return `<div class="sn-box-details sn-box-gallery">${groups.map(group=>{
  return `<section class="sn-reward-group" aria-label="${h.escape(group.name)}奖励"><div class="sn-reward-group-heading"><h4>${h.escape(group.name)}</h4><b><span>基础概率 </span>${percent(group.weight,group.denominator)}</b></div><div class="sn-reward-grid">${group.items.map(item=>`<figure class="sn-reward-preview" data-preview-id="${item.id}" aria-label="${h.escape(item.name)}，基础掉落概率 ${percent(item.weight,group.denominator)}" aria-description="${h.escape(item.name)} · 基础掉落概率 ${percent(item.weight,group.denominator)}">${previewSlot(item,h)}<figcaption>${percent(item.weight,group.denominator)}</figcaption></figure>`).join('')}</div></section>`;
 }).join('')}<section class="sn-box-rules" aria-label="保底规则"><h4>保底规则</h4><p class="sn-pity-rule">仅装备奖励计入保底，获得对应装备后重置；武器、战机不计入。以上为基础概率，触发保底时按保底规则发放。</p></section></div>`;
}
