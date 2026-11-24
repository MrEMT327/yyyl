import { itemInspectAttributes } from './item-description-model.js';
import {rewardItemSlot} from './reward-item-slot.js';
import {advancedParticles,boxShowcaseItems,boxRewardGroups,percent} from './shop-box-art.js';
export {advancedParticles,boxChestArt,boxShowcaseItems,boxRewardGroups,percent} from './shop-box-art.js';

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
