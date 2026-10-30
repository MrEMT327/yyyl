import { nativeRewardPresentation } from '../replica/native-item-presentation.js';
import { lobbyNavigation } from './lobby-navigation.js';
import { resourceIcon } from './resource-icons.js';
import { guiChevron } from './gui-casual.js';
import { projectIcon, projectIconUrl } from './project-ui-art.js';
import { pilotHoloCard } from './pilot-holo-card.js';
import { pilotCardQuality } from './pilot-card-quality.js';
import { characterPortrait, portraitPresentation } from './character-portraits.js';
import { portraitFramingStyle } from './portrait-framing.js';
import { supplyPool } from './supply-pools.js';
import './recruit-reference.css';
const base=import.meta.env?.BASE_URL??'/';
const glyph=(name,cls='')=>resourceIcon(name,`rc-icon ${cls}`)||projectIcon(name,`rc-icon ${cls}`);
const collected=(item,isPilot)=>isPilot?(item?.activated??Boolean(item?.owned&&!item?.temporaryUnlocked)):item?.owned;
const recruitPreviewPortrait=item=>{const portrait=portraitPresentation(item);return {...portrait,image:portrait.avatar||portrait.image};};
const collectionStatus=(item,isPilot)=>collected(item,isPilot)?'已拥有':isPilot&&item?.copies?'待激活':isPilot&&item?.temporaryUnlocked?'试玩':'未拥有';
const isLegacyBoxReward=item=>[925,926].includes(Number(item?.nativeItemId??item?.id))||/角色箱/.test(item?.name||'');
export function recruitItems(s){return s.pilots||[];}
// Show the actual recruitment candidates, excluding the two base pilots.
export function recruitBoxItems(s){
  if(!s.pilotSupply)return recruitItems(s);
  const ids=new Set(s.pilotSupply.candidates.map(row=>row.skinId));
  return recruitItems(s).filter(row=>ids.has(row.id));
}
export function recruitFeatured(s,pool,selected){const items=recruitItems(s);return items.find(x=>x.id===selected)||items[0];}
export function recruitNavigation(){return lobbyNavigation('supply');}
// Browsing changes the illustration only. Costs, rates and guarantees are canonical.
export function recruitPage({snapshot:s,helpers:h,selected}){
 const {escape:e,number:n}=h,info=supplyPool(s,'pilot'),items=recruitItems(s),featured=recruitFeatured(s,'pilot',selected);
 const quality=pilotCardQuality(featured?.rarity);
 // Show the next applicable guarantee.
 const pity=(info.pityDetails||[]).filter(item=>['pilot','ssr','ur'].includes(item.id)&&Number(item.triggerAt)>0)
  .map(item=>({...item,remaining:Math.max(1,item.triggerAt-Math.max(0,Number(info.pity?.[item.id])||0))}))
  .sort((a,b)=>a.remaining-b.remaining||(a.id==='ur'?-1:1))[0];
 const label=pity?.id==='pilot'?'驾驶员':pity?.id==='ur'?'UR驾驶员':'SSR及以上驾驶员';
 const pityHtml=pity?`<p class="recruit-pity" data-pity="${pity.id}" aria-label="${label}，${pity.remaining}抽内必得" aria-live="polite">再招募<strong>${pity.remaining}</strong>次必得<b>${label}</b></p>`:'';
 const single=info.singleCost??info.cost;
 const draw=count=>{
  const cost=count===10?info.tenCost:single;
  if(info.unavailable||cost==null)return '';
  const reason=s.rewardPending?'奖励待保存':s.rewardBusy?'奖励处理中':info.unavailable||cost==null?'暂未开放':'';
  return `<button type="button" class="rc-draw recruit-draw ${count===10?'is-ten':'is-single'}" data-action="recruit" data-count="${count}" ${reason||s.wallet.diamonds<cost?'disabled':''} aria-label="${count===10?'十次':'单次'}招募，消耗${cost??0}钻石${reason?'，'+e(reason):''}"><strong>${count===10?'十次招募':'单次招募'}</strong><span class="${s.wallet.diamonds<cost?'is-short':''}">${resourceIcon('diamonds','recruit-cost-icon')}<b>×${cost==null?'—':n(cost)}</b></span></button>`;
 };
 const presentation=featured?portraitPresentation(featured):null,portrait=presentation?.image?.replace(/^\.\/assets\//,`${base}assets/`);
 const livePortrait=featured?characterPortrait(featured,'recruit-hero-portrait'):'';
 return `<section class="rc-page recruit-reference" aria-label="驾驶员招募" style="--recruit-grade:${quality.color};--recruit-grade-light:${quality.light}">
 <header class="recruit-toolbar"><h2 class="recruit-pool-heading">驾驶员招募</h2><button type="button" class="recruit-rules psd-button" data-action="recruitRewards" aria-label="奖励预览">奖励</button><button type="button" class="recruit-history psd-button" data-action="recruitHistory" aria-label="招募记录"><img class="recruit-history-icon" src="${projectIconUrl('task-log')}" alt="" draggable="false"><span>记录</span></button></header>
 <div class="rc-browse recruit-browse"><article class="recruit-showcase is-pilot" data-featured-pilot="${e(featured?.id||'')}" data-recruit-rarity="${e(featured?.rarity||'R')}" aria-label="驾驶员展示">
 ${featured?`<div class="recruit-feature-visual" style="${portraitFramingStyle(featured.id)}">${livePortrait||`<img class="recruit-hero-portrait" src="${e(portrait)}" alt="${e(featured.name)}" draggable="false" decoding="async">`}</div><div class="recruit-feature-copy" aria-live="polite"><span class="recruit-grade">${e(featured.rarity||'R')}</span><h2>${e(featured.name)}</h2><span class="recruit-feature-title">${e(featured.title||'驾驶员')}</span><section class="recruit-feature-skill" aria-label="驾驶员技能"><div class="recruit-skill-copy"><strong>${e(featured.skillName||featured.passive?.name||'')}</strong><p>${e(featured.passive?.description||featured.description||'')}</p></div><button type="button" class="recruit-detail wc-button" data-action="pilotInfo" data-id="${e(featured.id)}">查看详情 ${glyph('chevron-right')}</button></section></div>`:'<p class="recruit-empty">暂无可展示驾驶员</p>'}
 </article>
 <section class="recruit-collection rc-preview" aria-label="角色预览"><div class="rc-preview-strip recruit-collection-strip" role="group" aria-label="驾驶员列表" tabindex="0">${items.map(item=>`<button type="button" class="rc-preview-card is-pilot ${item.id===featured?.id?'is-selected':''}" data-action="recruitPreview" data-id="${e(item.id)}" aria-pressed="${item.id===featured?.id}" aria-label="预览${e(item.name)}，${e(item.rarity)}，${collectionStatus(item,true)}">${pilotHoloCard(recruitPreviewPortrait(item),{compact:true,selected:item.id===featured?.id,loading:'lazy'})}</button>`).join('')}</div></section></div>
 <footer class="rc-footer recruit-footer">${pityHtml}<div class="rc-actions">${draw(1)}${draw(10)}</div>${s.rewardPending?`<div class="recruit-recovery" role="status"><span>已有奖励待保存</span><button type="button" class="wc-button" data-action="recoverDailyRewards" ${s.rewardBusy?'disabled':''}>重试保存</button></div>`:''}${s.storageWarning?`<p class="recruit-warning">${e(s.storageWarning)}</p>`:''}</footer></section>`;
}
export function recruitModal(type,s,h,view){
  const pool='pilot';
  const {escape:e,number:n}=h,info=supplyPool(s,pool);
  const itemStatus=item=>collectionStatus(item,true),boxItems=recruitBoxItems(s);
  if(type==='recruitHistory'){
    const entries=(info.direct?(s.pilotSupply?.directHistory||[]):(s.recruitHistory||[]).filter(entry=>!entry.pool||entry.pool==='pilot'))
      .filter(entry=>!(entry.results||[]).some(isLegacyBoxReward));
    const list=entries.length?`<ol class="recruit-history-entries">${entries.slice().reverse().map(entry=>`<li>${entry.results.map(result=>{
      const reward=result.convertedFragment||result;
      return `<p><span>${e(nativeRewardPresentation(reward).name||reward.name)} ×${n(reward.amount??1)}</span></p>`;
    }).join('')}</li>`).join('')}</ol>`:'<p class="recruit-modal-empty">暂无记录</p>';
    const total=info.direct?info.directTotalPulls??0:info.totalPulls??0;
    return {title:'招募记录',content:`<div class="recruit-modal-surface"><div class="recruit-history-summary"><span>累计招募 <b>${n(total)}</b> 次</span></div>${list}</div>`};
  }
  if(view==='roster')return {title:'角色一览',content:`<div class="recruit-probability-content"><section class="recruit-reward-section"><header><h3>可获得驾驶员 · ${boxItems.length}位</h3><small>通过招募获得</small></header><div class="recruit-reward-collection">${boxItems.map(item=>`<button type="button" data-action="recruitRewardDetail" data-kind="${pool}" data-id="${e(item.id)}" aria-label="查看${e(item.name)}详情">${pilotHoloCard(portraitPresentation(item),{compact:true,loading:'lazy'})}<span class="recruit-owned-state">${itemStatus(item)}</span></button>`).join('')}</div></section></div>`};
  if(info.direct){
    const resources=info.resources||[];
    return {title:'招募奖励',content:`<div class="recruit-reward-summary" data-recruit-mode="direct"><h3>驾驶员</h3><div class="recruit-preview-grid">${boxItems.map(item=>`<div class="recruit-preview-item" aria-label="${e(item.name)}，${e(item.rarity)}">${h.img(recruitPreviewPortrait(item).image,'','recruit-preview-icon')}<span>${e(item.name)}</span><strong>${e(item.rarity)}</strong></div>`).join('')}</div><h3>资源</h3><div class="recruit-preview-grid">${resources.map(item=>`<div class="recruit-preview-item" aria-label="${e(item.name)} ×${n(item.amount)}">${h.img(item.image,'','recruit-preview-icon')}<span>${e(item.name)}</span><strong>×${n(item.amount)}</strong></div>`).join('')}</div></div>`};
  }
  const rates=Object.entries(info.probabilities||{}).filter(([key,value])=>!['925','926'].includes(key)&&!/角色箱/.test(info.probabilityLabels?.[key]||'')&&Number.isFinite(Number(value)));
  const shortNames={1:'金币',112:'高级箱券',113:'普通箱券',blueprint:'随机图纸'};
  const rewardItems=rates.map(([key])=>{
    const label=info.probabilityLabels?.[key]||key,match=/^(.*?)\s*×\s*(\d+)$/.exec(label);
    const name=shortNames[key]||match?.[1]||label,count=match?.[2],art=key==='blueprint'?projectIconUrl('task-log'):nativeRewardPresentation({id:Number(key)}).image;
    return `<div class="recruit-preview-item" aria-label="${e(label)}">${art?h.img(art,'','recruit-preview-icon'):''}<span>${e(name)}</span>${count?`<strong>×${n(Number(count))}</strong>`:''}</div>`;
  }).join('');
  return {title:'奖励预览',content:`<div class="recruit-reward-summary" data-recruit-pool="${pool}"><div class="recruit-preview-grid" aria-label="招募奖励">${rewardItems}</div><div class="recruit-preview-rules">${info.guaranteeText?`<p>${e(info.guaranteeText)}</p>`:''}</div><button type="button" class="wc-button recruit-preview-back" data-action="close">返回招募</button></div>`};
}
