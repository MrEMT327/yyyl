import {nativeCollectionArt,nativeSkillArt} from '../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../replica/native-weapon-skill-art.js';
import {nativeItemArt} from '../replica/native-item-presentation.js';
import {equipmentArtPath} from '../replica/equipment-art.js';
import {projectIcon} from './project-ui-art.js';
import {resourceIcon} from './resource-icons.js';
import {rewardItemSlot} from './reward-item-slot.js';
import {feedbackKindLabel,feedbackAttributes,feedbackSkills,cleanFeedbackText,mergeFeedbackFeatures} from './process-feedback-model.js';
import './process-feedback.css';
import heroBounds from './process-feedback-art-bounds.json' with {type:'json'};

const art='/art/process-feedback-v1/';
const star=(count,capacity=5)=>`<span class="pf-stars" aria-label="${count}星">${Array.from({length:Math.max(count,capacity)},(_,i)=>projectIcon('star',i<count?'':'is-icon-muted')).join('')}</span>`;
const arrow=()=>projectIcon('chevron-right','pf-arrow');
const dismiss=()=>'<button type="button" class="pf-dismiss" data-action="close">点击空白处关闭</button>';
const image=(url,cls='',extra='')=>`<img class="${cls}" src="${url}" alt="" draggable="false" ${extra}>`;
function feedbackFrame(tone='primary'){
  const rows=[[[0,0,255,110],[255,0,268,110],[523,0,44,110]],[[0,110,27,549],[27,110,496,549],[523,110,44,549]],[[0,659,255,55],[255,659,268,55],[523,659,44,55]]];
  const src=tone==='collection'?art+'collection-panel.png':tone==='merge'?art+'merge-panel.png':'/art/psd-popup-v1/primary.png';
  return `<div class="pf-outer-art" aria-hidden="true">${rows.map((row,i)=>`<span class="pf-frame-row pf-frame-row-${i}">${row.map(region=>`<svg viewBox="${region.join(' ')}" preserveAspectRatio="none" focusable="false"><image href="${src}" width="567" height="714" preserveAspectRatio="none"/></svg>`).join('')}</span>`).join('')}</div>`;
}
function heroImage(url){
  const path=new URL(url,document.baseURI).pathname,bounds=heroBounds.assets[path];
  if(!bounds)return image(url,'pf-hero');
  return `<svg class="pf-hero" viewBox="${bounds.viewBox.join(' ')}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><image href="${url}" width="${bounds.size[0]}" height="${bounds.size[1]}"/></svg>`;
}
const banner=title=>`<div class="pf-banner">${image(art+'success-banner.png')}<h2 id="lobby-modal-title">${title}</h2></div>`;
// Sample the generated plate's visible bounds. This is nine-slice image
// rendering, not a new vector drawing; transparent export padding stays intact.
const insetFrame=()=>`<span class="pf-inset-art" aria-hidden="true">${[
  [13,181,45,45],[58,181,2056,45],[2114,181,45,45],
  [13,226,45,269],[58,226,2056,269],[2114,226,45,269],
  [13,495,45,45],[58,495,2056,45],[2114,495,45,45],
].map(region=>`<svg viewBox="${region.join(' ')}" preserveAspectRatio="none" focusable="false"><image href="${art}inset-panel.png" width="2172" height="724"/></svg>`).join('')}</span>`;
const panel=(content,cls='')=>`<div class="pf-inset ${cls}">${insetFrame()}${content}</div>`;
const sparks=()=>`<div class="pf-particles" aria-hidden="true">${Array.from({length:8},(_,i)=>image(art+'hologram-reveal.png','pf-particle',`style="--i:${i}"`)).join('')}</div>`;
function frame(content,{className='',title,footer=''}={}) {
  return `<div class="pl-modal-backdrop pf-backdrop" data-action="dismiss"><section class="pl-modal pf-shell ${className}" data-modal-type="processFeedback" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1">${feedbackFrame(className.includes('pf-collection')?'collection':className.startsWith('pf-merge')?'merge':'primary')}${title?`<header class="pf-heading"><h2 id="lobby-modal-title">${title}</h2></header>`:''}${content}${footer}</section></div>`;
}
function collection(record,s,h) {
  const e=h.escape,n=h.number,row=record.after,up=record.operation==='star',pilot=record.kind==='pilots';
  const attrs=feedbackAttributes(record,s.replicaCollection?.attributeNames).map(a=>`<div class="pf-attribute"><span>${e(a.label)}</span>${up&&Number.isFinite(a.from)?`<span class="pf-old">${a.from>=0?'+':''}${n(a.from)}${a.suffix}</span>${arrow()}`:''}<b data-count-to="${a.to}" data-count-from="${up?a.from??0:0}" data-count-suffix="${a.suffix}">+${n(a.to)}${a.suffix}</b></div>`).join('');
  const skillRows=feedbackSkills(record).map(skill=>{
    const url=record.kind==='guns'?nativeWeaponSkillArt(row)||nativeSkillArt(skill):nativeSkillArt(skill);
    const description=cleanFeedbackText(skill.description);
    const concise=up?description.replace(/^初始携带[^，,]+[，,]/,''):description.replace(/^获得[^，,]+[，,]/,'');
    return `<div class="pf-skill-row">${image(url,'pf-skill-icon')}<div><strong>${e(skill.name)}</strong><p>${e(concise)}</p></div></div>`;
  }).join('');
  const comparison=up?`<span class="pf-star-before"><small>${n(record.before.star)}星</small>${star(record.before.star,pilot?5:record.before.star)}</span>${arrow()}<span class="pf-star-after"><small>${n(row.star)}星</small>${star(row.star,pilot?5:row.star)}</span>`:star(row.star);
  const hero=heroImage(nativeCollectionArt(row,'default'));
  const body=`${banner(up?'升星成功':'获得'+feedbackKindLabel(record.kind))}<div class="pf-stage" aria-hidden="true">${image(record.kind==='guns'?art+'hologram-reveal.png':'/art/aircraft-activation-v1/activation-stage.png','pf-stage-light')}${image(art+'hologram-reveal.png','pf-stage-pulse')}</div><div class="pf-hero-wrap">${hero}</div>${sparks()}<h3 class="pf-name">${insetFrame()}${e(row.name)}</h3><div class="pf-star-change${up?' is-upgrade':''}">${comparison}</div>${panel(attrs,'pf-attributes')}${panel(`${up?'<span class="pf-skill-heading">技能提升</span>':''}${skillRows}`,'pf-skills')}`;
  return frame(body,{className:`pf-collection pf-kind-${record.kind}${up?' pf-star-result':''}`,footer:dismiss()});
}
function gearSlot(item,h,{inspectable=true,quantity=false}={}) {
  return rewardItemSlot({name:item.name,amount:1,artwork:image('/'+equipmentArtPath(item.art)),qualityRank:Math.max(0,Math.floor(item.quality/10)-1),itemId:item.nativeId??item.family+item.quality,showQuantity:quantity,inspectable,overlay:!quantity&&Number.isFinite(item.level)?`<b class="pf-gear-level">Lv.${h.number(item.level)}</b>`:''},h);
}
function merge(record,h) {
  // A batch can produce only one surviving target after chained merges. Use
  // the full result presentation in that case rather than a one-cell grid.
  if(record.type==='mergeBatch'&&record.results.length>1)return frame(`<div class="pf-merge-grid">${record.results.map((pair,i)=>`<figure class="pf-result-tile" style="--index:${i}">${gearSlot(pair.after,h,{quantity:true})}<figcaption>${h.escape(pair.after.name)}</figcaption></figure>`).join('')}</div><div class="pf-submit"><button class="wc-button pl-primary" data-action="close">确定</button></div>`,{className:'pf-merge-batch',title:'合成成功'});
  const pair=record.results[0],features=mergeFeedbackFeatures(pair);
  const materials=(record.materials||[]).slice(0,3);
  return frame(`<div class="pf-merge-body"><div class="pf-merge-stage"><div class="pf-merge-materials" aria-hidden="true">${materials.map((item,i)=>`<span style="--index:${i};--origin:${materials.length===1?0:(i/(materials.length-1)-.5)*48}cqw">${gearSlot(item,h,{inspectable:false})}</span>`).join('')}</div><div class="pf-merge-result">${gearSlot(pair.after,h)}</div></div><h3 class="pf-merge-name">${h.escape(pair.after.name)}</h3>${panel(`<div class="pf-attribute"><span>${h.escape(pair.after.attributeName)}</span><span class="pf-old">+${h.number(pair.before.attribute)}</span>${projectIcon('equipment-upgrade','pf-merge-arrow')}<b data-count-from="${pair.before.attribute}" data-count-to="${pair.after.attribute}">+${h.number(pair.after.attribute)}</b></div>`,'pf-merge-attributes')}${features.length?panel(features.map(text=>`<p>${projectIcon('check')}<span>${h.escape(text)}</span></p>`).join(''),'pf-new-features'):''}</div><div class="pf-submit"><button class="wc-button pl-primary" data-action="close">确定</button></div>`,{className:'pf-merge',title:'合成成功'});
}
function progression(record,h) {
  const level=record.type==='level';
  return frame(`<div class="pf-progression-icon">${image(level?'/art/project-supplement-icons-v1/experience.png':'/art/project-talents-v1/patrol.webp')}${image(art+'hologram-reveal.png','pf-progression-glow')}</div>${level?`<div class="pf-level-change"><span>Lv.${h.number(record.from)}</span>${arrow()}<strong>Lv.<b data-count-from="${record.from}" data-count-to="${record.to}" data-count-plain="">${h.number(record.to)}</b></strong></div>`:`<h3 class="pf-feature-name">${h.escape(record.name)}</h3><p class="pf-feature-description">${h.escape(record.description)}</p>`}<div class="pf-submit"><button class="wc-button pl-primary" data-action="${level?'close':'processFeatureGo'}">${level?'确定':'前往'}</button></div>`,{className:'pf-progression',title:level?'等级提升':'功能开启',footer:level?'':dismiss()});
}
export function processFeedbackDialog(modal,s,h) {
  const record=modal.records[modal.index||0];
  return record.type==='collection'?collection(record,s,h):record.type==='merge'||record.type==='mergeBatch'?merge(record,h):progression(record,h);
}
export function boxOpeningDialog(modal,h) {
  const advanced=modal.pool==='advanced';
  return `<div class="pl-modal-backdrop pf-backdrop pf-opening-backdrop"><section class="pl-modal pf-opening" data-modal-type="boxOpening" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1"><h2 id="lobby-modal-title">${advanced?'高级':'普通'}装备箱</h2><button class="pf-skip ui-info-link" type="button" data-action="processSkipBox">跳过 ${arrow()}</button><div class="pf-opening-stage">${image(art+'hologram-reveal.png')}</div><div class="pf-chest-closed">${image(advanced?'/art/project-equipment-boxes-v1/advanced.png':'/art/shop-comic-v1/weapon-crate-v2.webp')}</div><div class="pf-chest-open">${image(advanced?'/art/project-equipment-boxes-v1/advanced-open.png':art+'basic-open.png')}</div><div class="pf-chest-light">${image(art+'hologram-reveal.png')}</div></section></div>`;
}
export function boxResultActions(modal,s,h) {
  if(modal.history||!modal.pool)return '';
  const box=s.nativeAcquisition?.equipmentBoxes?.find(row=>row.id===(modal.pool==='advanced'?3:4));
  if(!box)return '';
  const controls=(modal.count===10?[0,10]:[1,10]).map(count=>{
    if(!count)return '<button type="button" class="wc-button" data-action="close">确定</button>';
    const quote=box.quotes?.find(row=>row.count===count);if(!quote)return '';
    const icon=quote.payment==='key'?image(nativeItemArt(quote.itemId),'sn-cost-icon'):resourceIcon('diamonds','sn-cost-icon',{inspect:false});
    return `<button type="button" class="wc-button${count===10?' pl-primary':''}" data-action="processBoxAgain" data-pool="${modal.pool}" data-count="${count}" ${!quote.canDraw||s.rewardPending||s.rewardBusy?'disabled':''}><span>${modal.count===10?'再开':'开启'}${count}次</span><small>${quote.payment==='free'?'免费开启':icon+' '+h.number(quote.amount)}</small></button>`;
  }).join('');
  return `<div class="pf-box-actions">${controls}</div>`;
}

// Runs once per DOM identity; refreshes and background clocks cannot replay it.
export function createProcessFeedbackMotion(root,{sound=()=>{},finishBox=()=>{}}={}) {
  let node=null,animations=[],timers=[],observers=[];
  const reduced=()=>globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const clear=()=>{animations.forEach(a=>a.cancel());animations=[];timers.forEach(clearTimeout);timers=[];observers.forEach(o=>o.disconnect());observers=[];node=null;};
  const later=(fn,delay)=>timers.push(setTimeout(fn,delay));
  function play(host,modal) {
    const next=host.querySelector('.pf-shell,.pf-opening,.pf-box-result');
    if(!next){if(node)clear();return;}
    if(next===node)return;
    clear();node=next;
    const isBox=modal.type==='boxOpening';
    if(!reduced()){
      sound(isBox?'reward':'upgrade');
      for(const el of next.querySelectorAll('.pf-attribute b[data-count-to],.pf-level-change b[data-count-to]')){
        const from=Number(el.dataset.countFrom),to=Number(el.dataset.countTo);if(!Number.isFinite(from)||!Number.isFinite(to))continue;
        const merging=next.classList.contains('pf-merge');
        const duration=merging?450:650,delay=merging?600:850,start=performance.now()+delay;
        el.setAttribute('aria-label',(el.hasAttribute('data-count-plain')?'':to>=0?'+':'')+to.toLocaleString('zh-CN',{useGrouping:false})+(el.dataset.countSuffix||''));
        el.textContent=(el.hasAttribute('data-count-plain')?'':from>=0?'+':'')+from.toLocaleString('zh-CN',{useGrouping:false})+(el.dataset.countSuffix||'');
        const update=()=>{if(!el.isConnected)return;const t=Math.max(0,Math.min(1,(performance.now()-start)/duration)),v=Math.round(from+(to-from)*(1-Math.pow(1-t,3)));el.textContent=(el.hasAttribute('data-count-plain')?'':v>=0?'+':'')+v.toLocaleString('zh-CN',{useGrouping:false})+(el.dataset.countSuffix||'');if(t<1)later(update,30);};
        later(update,delay);
      }
      next.querySelectorAll('.pf-result-tile,.pl-reward-item').forEach((el,i)=>animations.push(el.animate([{opacity:0,transform:'translateY(16px) scale(.8)'},{opacity:1,transform:'translateY(0) scale(1)'}],{duration:340,delay:160+i*75,fill:'backwards',easing:'cubic-bezier(.2,.7,.25,1)'})));
    }
    if(isBox)later(finishBox,reduced()?100:1900);
  }
  return {play,clear,destroy:clear};
}
