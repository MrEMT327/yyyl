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
export function recruitItems(s){return s.pilots||[];}
// The resource supply can showcase every pilot; the role-box preview must use
// its actual eight-person candidate list, which excludes the two base pilots.
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
 // Show the next high-rarity guarantee; all three rules remain in probabilities.
 const pity=(info.pityDetails||[]).filter(item=>['ssr','ur'].includes(item.id)&&Number(item.triggerAt)>0)
  .map(item=>({...item,remaining:Math.max(1,item.triggerAt-Math.max(0,Number(info.pity?.[item.id])||0))}))
  .sort((a,b)=>a.remaining-b.remaining||(a.id==='ur'?-1:1))[0];
 const label=pity?.id==='ur'?'UR':'SSR及以上';
 const pityHtml=info.mixed?`<p class="recruit-pity">${info.rookieAvailable?'首次十连 · 至少获得 1 个角色箱':'50 碎片合成角色箱 · 开箱另计未拥有保底'}${info.development?' · 开发免费':''}</p>`:pity?`<p class="recruit-pity" data-pity="${pity.id}" aria-label="${label}，${pity.remaining}抽内必得" aria-live="polite">再招募<strong>${pity.remaining}</strong>次必得<b>${label}</b>驾驶员</p>`:'';
 const single=info.singleCost??info.cost;
 const draw=count=>{
  const cost=count===10?info.tenCost:single;
  if(info.unavailable||cost==null)return '';
  const reason=s.rewardPending?'奖励待保存':s.rewardBusy?'奖励处理中':info.unavailable||cost==null?'暂未开放':s.wallet.diamonds<cost?'钻石不足':'';
  return `<button type="button" class="rc-draw recruit-draw ${count===10?'is-ten':'is-single'}" data-action="recruit" data-count="${count}" ${reason?'disabled':''} aria-label="${count===10?'十次':'单次'}补给，消耗${cost??0}钻石${reason?'，'+e(reason):''}"><strong>${count===10?info.rookieAvailable?'新手十连':'十次补给':'单次补给'}</strong><span>${resourceIcon('diamonds','recruit-cost-icon')}<b>×${cost==null?'—':n(cost)}</b></span>${reason?`<small class="recruit-shortage">${e(reason)}</small>`:''}</button>`;
 };
 const presentation=featured?portraitPresentation(featured):null,portrait=presentation?.image?.replace(/^\.\/assets\//,`${base}assets/`);
 const livePortrait=featured?characterPortrait(featured,'recruit-hero-portrait'):'';
 return `<section class="rc-page recruit-reference" aria-label="驾驶员补给" style="--recruit-grade:${quality.color};--recruit-grade-light:${quality.light}">
 <div class="rc-browse recruit-browse"><article class="recruit-showcase is-pilot" data-featured-pilot="${e(featured?.id||'')}" data-recruit-rarity="${e(featured?.rarity||'R')}" aria-label="驾驶员展示">
 ${featured?`<div class="recruit-feature-visual" style="${portraitFramingStyle(featured.id)}">${livePortrait||`<img class="recruit-hero-portrait" src="${e(portrait)}" alt="${e(featured.name)}" draggable="false" decoding="async">`}</div><div class="recruit-feature-copy" aria-live="polite"><span class="recruit-grade">${e(featured.rarity||'R')}</span><h2>${e(featured.name)}</h2><span class="recruit-feature-title">${e(featured.title||'驾驶员')}</span></div>`:'<p class="recruit-empty">暂无可展示驾驶员</p>'}
 <div class="recruit-cycle"><button type="button" class="rc-arrow psd-button is-prev" data-action="recruitCycle" data-step="-1" aria-label="预览上一个角色" ${items.length<2?'disabled':''}>${guiChevron()}</button><button type="button" class="rc-arrow psd-button is-next" data-action="recruitCycle" data-step="1" aria-label="预览下一个角色" ${items.length<2?'disabled':''}>${guiChevron()}</button></div></article>
 ${featured?`<section class="recruit-feature-skill" aria-label="驾驶员技能"><div class="recruit-skill-copy"><strong>${e(featured.skillName||featured.passive?.name||'')}</strong><p>${e(featured.passive?.description||featured.description||'')}</p></div><button type="button" class="recruit-detail wc-button" data-action="pilotInfo" data-id="${e(featured.id)}">详情 ${glyph('chevron-right')}</button></section>`:''}
 <section class="recruit-collection rc-preview" aria-label="角色预览"><div class="rc-preview-strip recruit-collection-strip">${items.map(item=>`<button type="button" class="rc-preview-card is-pilot ${item.id===featured?.id?'is-selected':''}" data-action="recruitPreview" data-id="${e(item.id)}" aria-pressed="${item.id===featured?.id}" aria-label="预览${e(item.name)}，${e(item.rarity)}，${collectionStatus(item,true)}">${pilotHoloCard(recruitPreviewPortrait(item),{compact:true,selected:item.id===featured?.id,loading:'lazy'})}${item.id===featured?.id?'<i class="recruit-selected-mark" aria-hidden="true">✓</i>':''}</button>`).join('')}</div><div class="recruit-collection-actions"><div class="recruit-toolbar" role="group" aria-label="补给功能"><button type="button" class="recruit-rules psd-button" data-action="recruitRewards" aria-label="奖励预览">奖励</button><button type="button" class="recruit-history psd-button" data-action="recruitHistory" aria-label="补给记录"><img class="recruit-history-icon" src="${projectIconUrl('task-log')}" alt="" draggable="false"><span>记录</span></button></div><button type="button" class="recruit-roster-link psd-button" data-action="recruitRoster">角色一览</button></div></section></div>
 <footer class="rc-footer recruit-footer">${pityHtml}<div class="rc-actions">${draw(1)}${draw(10)}</div>${s.rewardPending?`<div class="recruit-recovery" role="status"><span>已有奖励待保存</span><button type="button" class="wc-button" data-action="recoverDailyRewards" ${s.rewardBusy?'disabled':''}>重试保存</button></div>`:''}${s.storageWarning?`<p class="recruit-warning">${e(s.storageWarning)}</p>`:''}</footer></section>`;
}
export function recruitModal(type,s,h,view){
  const pool='pilot';
  const {escape:e,number:n}=h,info=supplyPool(s,pool);
  const itemStatus=item=>collectionStatus(item,true),boxItems=recruitBoxItems(s);
  const close='<button type="button" class="recruit-modal-back" data-action="close">返回补给</button>';
  if(type==='recruitHistory'){
    const entries=s.pilotSupply?.history||s.recruitHistory||[],boxes=s.pilotSupply?.boxHistory||[];
    const list=(rows,isBox)=>rows.length?`<ol class="recruit-history-entries">${rows.slice().reverse().map(entry=>`<li><header><time>${e(new Date(entry.at).toLocaleString('zh-CN',{hour12:false}))}</time><b>${entry.count} 次${isBox?'开箱':` · ${n(entry.cost)} 钻石`}</b></header>${entry.results.map(r=>`<p><span>${e(nativeRewardPresentation(r).name||r.name)} ${r.isNew?'· 首次获得':r.creditsAdded?'· 积分 +1':r.copiesAdded?'· 同名卡 ×1':`×${r.amount}`}</span></p>`).join('')}</li>`).join('')}</ol>`:'<p class="recruit-modal-empty">暂无记录</p>';
    return {title:'驾驶员补给记录',content:`<div class="recruit-modal-surface"><div class="recruit-history-summary"><span>累计补给 <b>${n(info.totalPulls||0)}</b> 次</span><small>各保留最近 50 批</small></div><h3>资源补给</h3>${list(entries,false)}<h3>角色箱开启</h3>${list(boxes,true)}${close}</div>`};
  }
  if(view==='roster')return {title:'角色一览',content:`<div class="recruit-probability-content"><section class="recruit-reward-section"><header><h3>可获得驾驶员 · ${boxItems.length}位</h3><small>通过角色箱获得</small></header><div class="recruit-reward-collection">${boxItems.map(item=>`<button type="button" data-action="recruitRewardDetail" data-kind="${pool}" data-id="${e(item.id)}" aria-label="查看${e(item.name)}详情">${pilotHoloCard(portraitPresentation(item),{compact:true,loading:'lazy'})}<span class="recruit-owned-state">${itemStatus(item)}</span></button>`).join('')}</div></section></div>`};
  const rates=Object.entries(info.probabilities||{}).filter(([,value])=>Number.isFinite(Number(value)));
  const shortNames={1:'金币',112:'高级箱券',113:'普通箱券',925:'角色箱',926:'角色箱碎片',blueprint:'随机图纸'};
  const rateRows=rates.map(([key])=>{
    const label=info.probabilityLabels?.[key]||key,match=/^(.*?)\s*×\s*(\d+)$/.exec(label);
    const name=shortNames[key]||match?.[1]||label,count=match?.[2],art=key==='blueprint'?projectIconUrl('task-log'):nativeRewardPresentation({id:Number(key)}).image;
    return `<div aria-label="${e(label)}"><dt>${art?h.img(art,'','recruit-rate-icon'):''}<span><b>${e(name)}</b>${count?`<small>×${n(Number(count))}</small>`:''}</span></dt></div>`;
  }).join('');
  const guarantee=info.mixed?(info.rookieAvailable?'首次十连必得角色箱 ×1':`${s.pilotSupply?.box.required??50}碎片 → 角色箱 ×1`):info.guaranteeText;
  const boxArt=nativeRewardPresentation({id:925}).image;
  return {title:'奖励预览',content:`<div class="recruit-probability-content" data-recruit-pool="${pool}">
    ${guarantee?`<p class="recruit-modal-guarantee">${boxArt?h.img(boxArt,'','recruit-guarantee-icon'):''}<strong>${e(guarantee)}</strong></p>`:''}
    ${rates.length?`<section class="recruit-rate-section"><header><h3>可能获得</h3><small>角色箱需另开</small></header><dl>${rateRows}</dl></section>`:''}
    <details class="recruit-rule-details recruit-roster-details"><summary>可获得驾驶员 · ${boxItems.length}位</summary><section class="recruit-reward-section"><div class="recruit-reward-collection">${boxItems.map(item=>`<button type="button" data-action="recruitRewardDetail" data-kind="${pool}" data-id="${e(item.id)}" aria-label="查看${e(item.name)}详情">${pilotHoloCard(portraitPresentation(item),{compact:true,loading:'lazy'})}<span class="recruit-owned-state">${itemStatus(item)}</span></button>`).join('')}</div></section></details>
    ${info.rules?.length||info.duplicateText||s.pilotSupply?`<details class="recruit-rule-details"><summary>详细规则</summary>${info.guaranteeText?`<p>${e(info.guaranteeText)}</p>`:''}${s.pilotSupply?'<p>两名基础驾驶员不在角色箱奖池中；展示页切换驾驶员不改变开箱范围。</p>':''}${info.duplicateText?`<p>${e(info.duplicateText)}</p>`:''}${(info.rules||[]).map(rule=>`<p>${e(rule.replace(/（各\s*[\d.]+%）/g,''))}</p>`).join('')}</details>`:''}</div>`};
}
