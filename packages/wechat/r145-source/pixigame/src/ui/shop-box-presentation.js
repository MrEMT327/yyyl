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
// Positions are percentages of the chest's particle layer; size and drift use
// the shop's design units so the effect follows the artwork on narrow screens.
const advancedParticles=[
 ['glint',14,51,40,-10,18,5.7,-1.7],
 ['glint',69,20,34,12,16,6.4,-4.2],
 ['glint',89,78,37,10,21,6.8,-2.3],
 ['mote',9,74,22,-12,50,4.9,-2.5],
 ['mote',24,83,18,-20,35,5.4,-.8],
 ['mote',28,26,20,-15,37,5.2,-3.2],
 ['mote',48,19,15,11,40,5.7,-.9],
 ['mote',81,87,24,13,46,5.1,-1.7],
 ['mote',93,55,19,16,54,5.8,-3.8],
 ['fleck',16,86,10,-17,65,5.9,-2.2],
 ['fleck',38,85,8,-13,44,5.3,-4.1],
 ['fleck',57,13,9,9,45,6.1,-3.6],
 ['fleck',85,33,11,14,52,5.6,-1.1],
 ['fleck',92,93,10,17,63,6.2,-4.3],
];
export const advancedBoxParticles=`<span class="sn-chest-particles" aria-hidden="true">${advancedParticles.map(([kind,x,y,size,drift,lift,duration,delay])=>
 `<i class="sn-chest-particle is-${kind}" style="--spark-x:${x}%;--spark-y:${y}%;--spark-size:${size};--spark-drift:${drift};--spark-lift:${lift};--spark-duration:${duration}s;--spark-delay:${delay}s"></i>`).join('')}</span>`;

export function boxShowcase(box,h,pool,{decorations=true}={}) {
 const effects=!decorations||pool==='advanced'?'':`<div class="sn-box-effects" aria-hidden="true">${Array.from({length:6},(_,i)=>`<i class="sn-box-spark" style="--spark:${i};--spark-row:${i%3}"></i>`).join('')}</div>`;
 return `${effects}${boxShowcaseItems(box).map((item,index)=>`<button type="button" class="sn-floating-gear sn-floating-${index}" ${itemInspectAttributes(item.id,h.escape)} aria-label="${h.escape(item.name)}，${h.escape(item.qualityName)}，查看道具详情" aria-description="${h.escape(item.name)} · ${h.escape(item.qualityName)}"><span class="sn-floating-orb">${h.img(item.image,'','')}${item.gear.rank===1?'<b class="sn-floating-rank">S</b>':''}</span></button>`).join('')}`;
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
 }).join('')}</div>`;
}
