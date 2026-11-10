import './recruit-results.css';
import './recruit-probabilities.css';
import {pilotHoloCard} from './pilot-holo-card.js';
import {pilotCardQuality} from './pilot-card-quality.js';
import {nativeRewardPresentation} from '../replica/native-item-presentation.js';
import {rewardDisplayQuality} from '../replica/item-display-quality.js';
import {nativePilotDisplayQuality} from '../replica/native-pilot-quality.js';

// Every draw has the same portrait surface and caption track, including materials.
export function pilotRecruitResults(rewards,pilots,{number,renderReward,grid=false}) {
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function cardFrame(card) {
    const path=`${import.meta.env?.BASE_URL||'/'}art/psd-choice-v1/${card.choiceFrame}`;
    return globalThis.document?.baseURI?new URL(path,globalThis.document.baseURI).href:path;
  }
  const idleCard=content=>grid?`<div class="rr-idle-sway">${content}</div>`:content;
  function materialFace(reward,{rarity,pilotQualityRank,pilotQualityKnown,fragment=false}={}) {
    const quality=rewardDisplayQuality(reward,nativeRewardPresentation(reward)).qualityRank;
    const card=!rarity&&quality===5?{choiceFrame:'card-red.png',frameFilter:'none'}:
      pilotCardQuality(rarity||'R',pilotQualityRank,pilotQualityKnown);
    const faceUrl=cardFrame(card);
    const filter=rarity?`;--rr-item-filter:${card.frameFilter}`:'';
    return `<div class="rr-material-face${fragment?' is-fragment':''}" data-item-quality="${quality}" style="--rr-item-face:url('${escape(faceUrl)}')${filter}">${fragment?`<div class="phc-lightpass" aria-hidden="true"></div><span class="rr-fragment-rarity">${escape(rarity)}</span><span class="rr-fragment-kind">碎片</span>`:''}${renderReward(reward,true)}</div>`;
  }
  return `<div class="pl-card-results ${rewards.length===1?'is-single':''}">${rewards.map((reward,index)=>{
    const nativeId=Number(reward.nativeId??reward.nativeItemId);
    const matched=(Number.isSafeInteger(nativeId)&&nativeId>0?pilots.find(p=>Number(p.nativeId)===nativeId):null)
      ||pilots.find(p=>p.id===(reward.pilotId||reward.id));
    const quality=matched&&nativeId>0?nativePilotDisplayQuality({nativeId}):null;
    const pilot=quality?.qualityKnown?{...matched,...quality}:
      matched?.rarity==='UR'?{...matched,rarity:'SSR'}:matched;
    if(!pilot){
      return `<div class="rr-result-slot is-material" style="--reveal-delay:${Math.min(index,9)*65}ms">${materialFace(reward)}</div>`;
    }
    const note=reward.nativeRecruit?(reward.creditsAdded?`积分 +${reward.creditsAdded}`:reward.isNew?'':`同名卡 ×${reward.copiesAdded??reward.amount??1}`):reward.copiesAdded?`同名卡 ×${reward.copiesAdded??reward.amount??1}`:reward.isNew?'':reward.type==='pilot'?`${reward.beforeStars} → ${reward.stars} 星`:`碎片 ×${number(reward.amount)}`;
    // Receipts retain their real copy/credit rewards; only first acquisition gets a badge.
    const character=pilotHoloCard({...pilot,stars:reward.stars??pilot.stars},{interactive:true,compact:rewards.length>1,reveal:true,status:reward.isNew?'NEW':''});
    return `<div class="pl-card-result rr-result-slot" style="--reveal-delay:${Math.min(index,9)*65}ms">${idleCard(character)}${note?`<p class="rr-result-note">${note}</p>`:''}</div>`;
  }).join('')}</div>`;
}

export function isRecruitResult(modal) {
  return modal?.type==='rewards' && (modal.recruit===true || ['pilot','weapon'].includes(modal.recruitPool));
}

// Result receipts are already committed; this surface only presents and closes them.
function fullscreenDialog({title,content,type,kind,variant,confirmLabel,count,minimal=false}, {escape:e,button}) {
  const label=minimal?`aria-label="${e(title)}"`:'aria-labelledby="lobby-modal-title"';
  const heading=minimal?'':`<header class="pl-modal-heading recruit-result-heading"><h2 id="lobby-modal-title">${e(title)}</h2><button type="button" class="pl-close" data-action="close" aria-label="关闭${e(title)}"></button></header>`;
  return `<div class="pl-modal-backdrop recruit-result-backdrop" data-action="dismiss"><section class="pl-modal recruit-result-dialog ${variant}" data-modal-type="${type}" data-modal-kind="${kind}" ${count?`data-draw-count="${count}"`: ''} role="dialog" aria-modal="true" ${label} tabindex="-1">${heading}<div class="pl-modal-content recruit-result-scroll">${content}</div><footer class="recruit-result-actions">${button('close',confirmLabel,'recruit-result-confirm')}</footer></section></div>`;
}

export function recruitResultsDialog({title='招募结果',content,count,pilot=false},helpers) {
  return fullscreenDialog({title,content,type:'rewards',kind:'recruitResult',variant:`${count===1?'is-single':'is-multiple'}${pilot?' is-pilot-grid':''}`,count,confirmLabel:'确定',minimal:pilot},helpers);
}

export function recruitRewardsDialog({title,content},helpers) {
  if(content.includes('class="recruit-reward-summary"'))return `<div class="pl-modal-backdrop recruit-preview-backdrop" data-action="dismiss"><section class="pl-modal recruit-preview-dialog" data-psd-popup="primary" data-modal-type="recruitRewards" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title"><header class="pl-modal-heading"><h2 id="lobby-modal-title">${helpers.escape(title)}</h2><button type="button" class="pl-close" data-action="close" aria-label="关闭奖励预览"></button></header><div class="pl-modal-content">${content}</div></section></div>`;
  return fullscreenDialog({title,content,type:'recruitRewards',kind:'recruitRewards',variant:'recruit-info-dialog',confirmLabel:'返回招募'},helpers);
}
