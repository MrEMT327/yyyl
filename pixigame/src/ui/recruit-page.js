import {recruitItems,recruitBoxItems,recruitFeatured} from './recruit-selection.js';
export {recruitItems,recruitBoxItems,recruitFeatured} from './recruit-selection.js';
import { nativeRewardPresentation } from '../replica/native-item-presentation.js';
import { resourceIcon } from './resource-icons.js';
import { projectIcon } from './project-ui-art.js';
import { pilotHoloCard } from './pilot-holo-card.js';
import {qualityDisplayLabel} from './quality-display-label.js';
import { pilotCardQuality } from './pilot-card-quality.js';
import { portraitPresentation, recruitPortraitPresentation } from './character-portraits.js';
import { portraitFramingStyle } from './portrait-framing.js';
import { supplyPool } from './supply-pools.js';
import './recruit-reference.css';
const base=import.meta.env?.BASE_URL??'/';
const glyph=(name,cls='')=>resourceIcon(name,`rc-icon ${cls}`)||projectIcon(name,`rc-icon ${cls}`);
const recruitPreviewPortrait=item=>{const portrait=portraitPresentation(item);return {...portrait,image:portrait.avatar||portrait.image};};
const pilotRarity=item=>qualityDisplayLabel(item?.rarity,item?.qualityKnown);
const collectionStatus=item=>{
  const owned=item?.activated??Boolean(item?.owned&&!item?.temporaryUnlocked);
  return owned?'已拥有':item?.copies?'待激活':item?.temporaryUnlocked?'试玩':'未拥有';
};
// Browsing changes the illustration only. Costs, rates and guarantees are canonical.
export function recruitPage({snapshot:s,helpers:h,selected}){
 const {escape:e,number:n}=h,info=supplyPool(s,'pilot'),items=recruitItems(s),featured=recruitFeatured(s,selected);
 const quality=pilotCardQuality(featured?.rarity,featured?.qualityRank,featured?.qualityKnown);
 const single=info.singleCost??info.cost;
 const draw=count=>{
  const cost=count===10?info.tenCost:single;
  if(info.unavailable||cost==null)return '';
  const reason=s.rewardPending?'奖励待保存':s.rewardBusy?'奖励处理中':info.unavailable||cost==null?'暂未开放':'';
  return `<button type="button" class="rc-draw recruit-draw ${count===10?'is-ten':'is-single'}" data-action="recruit" data-count="${count}" ${reason||s.wallet.diamonds<cost?'disabled':''} aria-label="${count===10?'十次':'单次'}招募，消耗${cost??0}钻石${reason?'，'+e(reason):''}"><strong>${count===10?info.rookieAvailable?'新手十连':'十次招募':'单次招募'}</strong><span class="${s.wallet.diamonds<cost?'is-short':''}">${resourceIcon('diamonds','recruit-cost-icon',{inspect:false})}<b>×${cost==null?'—':n(cost)}</b></span></button>`;
 };
 const presentation=featured?recruitPortraitPresentation(featured):null,portrait=presentation?.image?.replace(/^\.\/assets\//,`${base}assets/`);
 const staticPortrait=featured?`<img class="recruit-hero-portrait" data-recruit-portrait="${e(featured.id)}"${portraitFramingStyle(featured.id)?' data-portrait-framed':''} src="${e(portrait)}" alt="${e(featured.name)}" draggable="false" decoding="async">`:'';
 return `<section class="rc-page recruit-reference" aria-label="驾驶员招募" style="--recruit-grade:${quality.color};--recruit-grade-light:${quality.light}">
 <div class="recruit-toolbar" role="group" aria-label="招募信息"><button type="button" class="recruit-rules ui-info-link" data-action="recruitRewards" aria-label="奖励预览">${projectIcon('info','recruit-rules-icon')}<span>奖励</span></button></div>
 <div class="rc-browse recruit-browse"><article class="recruit-showcase is-pilot" data-featured-pilot="${e(featured?.id||'')}" data-recruit-rarity="${e(featured?.rarity||'R')}" aria-label="驾驶员展示">
 ${featured?`<div class="recruit-feature-visual" style="${portraitFramingStyle(featured.id)}">${staticPortrait}</div><div class="recruit-feature-copy" aria-live="polite"><span class="recruit-grade">${e(featured.rarity||'R')}</span><h2>${e(featured.name)}</h2><div class="recruit-feature-title-row"><span class="recruit-feature-title">${e(featured.title||'驾驶员')}</span>${['pilot-01','pilot-02'].includes(featured.id)?'':`<button type="button" class="recruit-detail ui-info-link" data-action="pilotInfo" data-id="${e(featured.id)}">查看详情 ${glyph('chevron-right')}</button>`}</div><section class="recruit-feature-skill" aria-label="驾驶员技能"><div class="recruit-skill-copy"><strong>${e(featured.skillName||featured.passive?.name||'')}</strong><p>${e(featured.passive?.description||featured.description||'')}</p></div></section></div>`:'<p class="recruit-empty">暂无可展示驾驶员</p>'}
 </article>
 <section class="recruit-collection rc-preview" aria-label="角色预览"><div class="rc-preview-strip recruit-collection-strip" role="group" aria-label="驾驶员列表" tabindex="0">${items.map(item=>`<button type="button" class="rc-preview-card is-pilot ${item.id===featured?.id?'is-selected':''}" data-action="recruitPreview" data-id="${e(item.id)}" aria-pressed="${item.id===featured?.id}" aria-label="${e(['预览'+item.name,pilotRarity(item),collectionStatus(item)].filter(Boolean).join('，'))}">${pilotHoloCard(recruitPreviewPortrait(item),{compact:true,selected:item.id===featured?.id,loading:'lazy'})}</button>`).join('')}</div></section></div>
 <footer class="rc-footer recruit-footer"><div class="rc-actions">${draw(1)}${draw(10)}</div>${s.rewardPending?`<div class="recruit-recovery" role="status"><span>已有奖励待保存</span><button type="button" class="wc-button" data-action="recoverDailyRewards" ${s.rewardBusy?'disabled':''}>重试保存</button></div>`:''}${s.storageWarning?`<p class="recruit-warning">${e(s.storageWarning)}</p>`:''}</footer></section>`;
}
export function recruitModal(_type,s,h){
  const pool='pilot';
  const {escape:e,number:n}=h,info=supplyPool(s,pool);
  if(info.direct){
    const boxItems=recruitBoxItems(s);
    const resources=info.resources||[];
    const heading=info.tenPilotSummary||'驾驶员';
    return {title:'招募奖励',content:`<div class="recruit-reward-summary" data-recruit-mode="direct"><h3>${e(heading)}</h3><div class="recruit-preview-grid">${boxItems.map(item=>`<div class="recruit-preview-item" aria-label="${e([item.name,pilotRarity(item)].filter(Boolean).join('，'))}">${h.img(recruitPreviewPortrait(item).image,'','recruit-preview-icon')}<span>${e(item.name).replace('·','<br>')}</span>${pilotRarity(item)?`<strong>${e(pilotRarity(item))}</strong>`:''}</div>`).join('')}</div><h3>资源</h3><div class="recruit-preview-grid">${resources.map(item=>`<div class="recruit-preview-item" aria-label="${e(item.name)} ×${n(item.amount)}">${h.img(item.image,'','recruit-preview-icon')}<span>${item.name==='随机装备图纸'?'随机<br>装备图纸':e(item.name)}</span><strong>×${n(item.amount)}</strong></div>`).join('')}</div></div>`};
  }
  const rates=Object.entries(info.probabilities||{}).filter(([key,value])=>!['925','926'].includes(key)&&!/角色箱/.test(info.probabilityLabels?.[key]||'')&&Number.isFinite(Number(value)));
  const shortNames={1:'金币',112:'高级箱券',113:'普通箱券',blueprint:'随机图纸'};
  const rewardItems=rates.map(([key])=>{
    const label=info.probabilityLabels?.[key]||key,match=/^(.*?)\s*×\s*(\d+)$/.exec(label);
    const name=shortNames[key]||match?.[1]||label,count=match?.[2],art=nativeRewardPresentation({id:key==='blueprint'?10010007:Number(key)}).image;
    return `<div class="recruit-preview-item" aria-label="${e(label)}">${art?h.img(art,'','recruit-preview-icon'):''}<span>${e(name)}</span>${count?`<strong>×${n(Number(count))}</strong>`:''}</div>`;
  }).join('');
  return {title:'奖励预览',content:`<div class="recruit-reward-summary" data-recruit-pool="${pool}"><div class="recruit-preview-grid" aria-label="招募奖励">${rewardItems}</div></div>`};
}
