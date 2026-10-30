import './recruit-results.css';
import './recruit-probabilities.css';
import {pilotHoloCard} from './pilot-holo-card.js';
import {pilotCardQuality} from './pilot-card-quality.js';
import {nativeRewardPresentation} from '../replica/native-item-presentation.js';

// Every draw has the same portrait surface and caption track, including materials.
export function pilotRecruitResults(rewards,pilots,{number,renderReward,grid=false}) {
  const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function materialFace(reward,{rarity,fragment=false}={}) {
    const quality=Math.max(0,Math.min(5,Number(reward.qualityRank??nativeRewardPresentation(reward).qualityRank??0)));
    const card=pilotCardQuality(rarity||(quality===5?'UR':'R'));
    const face=`${import.meta.env?.BASE_URL||'/'}art/psd-choice-v1/${card.choiceFrame}`;
    const faceUrl=globalThis.document?.baseURI?new URL(face,globalThis.document.baseURI).href:face;
    const filter=rarity?`;--rr-item-filter:${card.frameFilter}`:'';
    return `<div class="rr-material-face${fragment?' is-fragment':''}" data-item-quality="${quality}" style="--rr-item-face:url('${escape(faceUrl)}')${filter}">${fragment?`<span class="rr-fragment-rarity">${escape(rarity)}</span><span class="rr-fragment-kind">碎片</span>`:''}${renderReward(reward,true)}</div>`;
  }
  return `<div class="pl-card-results ${rewards.length===1?'is-single':''}">${rewards.map((reward,index)=>{
    const pilot=pilots.find(p=>p.id===(reward.pilotId||reward.id));
    if(!pilot){
      return `<div class="rr-result-slot is-material" style="--reveal-delay:${Math.min(index,9)*65}ms">${materialFace(reward)}</div>`;
    }
    if(reward.convertedFragment){
      const target=grid?materialFace(reward.convertedFragment,{rarity:pilot.rarity,fragment:true}):renderReward(reward.convertedFragment,true);
      return `<div class="pl-card-result rr-result-slot rr-conversion" style="--reveal-delay:${Math.min(index,9)*65}ms" aria-label="${escape(pilot.name)}，${escape(reward.convertedFragment.name||'碎片')} ×${number(reward.convertedFragment.amount)}"><div class="rr-conversion-turn"><div class="rr-conversion-source" aria-hidden="true">${pilotHoloCard({...pilot,stars:reward.stars??pilot.stars},{compact:rewards.length>1})}</div><div class="rr-conversion-target" aria-hidden="true">${target}</div></div></div>`;
    }
    const note=reward.nativeRecruit?(reward.creditsAdded?`积分 +${reward.creditsAdded}`:reward.isNew?'':`同名卡 ×${reward.copiesAdded}`):reward.copiesAdded?`同名卡 ×${reward.copiesAdded}`:reward.isNew?'':reward.type==='pilot'?`${reward.beforeStars} → ${reward.stars} 星`:`碎片 ×${number(reward.amount)}`;
    return `<div class="pl-card-result rr-result-slot" style="--reveal-delay:${Math.min(index,9)*65}ms">${pilotHoloCard({...pilot,stars:reward.stars??pilot.stars},{interactive:true,compact:rewards.length>1,reveal:true,status:reward.creditsAdded?'满星转换':reward.requiresActivation?'待激活':reward.copiesAdded?'同名卡':reward.manualCards?'同名卡已足':reward.isNew?'NEW':''})}${note?`<p class="rr-result-note">${note}</p>`:''}</div>`;
  }).join('')}</div>`;
}

export function isRecruitResult(modal) {
  return modal?.type==='rewards' && (modal.recruit===true || ['pilot','weapon'].includes(modal.recruitPool));
}

// Result receipts are already committed; this surface only presents and closes them.
function fullscreenDialog({title,content,type,kind,variant,confirmLabel,count,minimal=false}, {escape:e,button}) {
  const label=minimal?`aria-label="${e(title)}"`:'aria-labelledby="lobby-modal-title"';
  const heading=minimal?'':`<header class="pl-modal-heading recruit-result-heading"><h2 id="lobby-modal-title">${e(title)}</h2><button type="button" class="pl-close" data-action="close" aria-label="关闭${e(title)}">×</button></header>`;
  return `<div class="pl-modal-backdrop recruit-result-backdrop" data-action="dismiss"><section class="pl-modal recruit-result-dialog ${variant}" data-modal-type="${type}" data-modal-kind="${kind}" ${count?`data-draw-count="${count}"`: ''} role="dialog" aria-modal="true" ${label} tabindex="-1">${heading}<div class="pl-modal-content recruit-result-scroll">${content}</div><footer class="recruit-result-actions">${button('close',confirmLabel,'recruit-result-confirm')}</footer></section></div>`;
}

export function recruitResultsDialog({title='招募结果',content,count,pilot=false},helpers) {
  return fullscreenDialog({title,content,type:'rewards',kind:'recruitResult',variant:`${count===1?'is-single':'is-multiple'}${pilot?' is-pilot-grid':''}`,count,confirmLabel:'确定',minimal:pilot},helpers);
}

export function recruitRewardsDialog({title,content},helpers) {
  if(content.includes('class="recruit-reward-summary"'))return `<div class="pl-modal-backdrop recruit-preview-backdrop" data-action="dismiss"><section class="pl-modal recruit-preview-dialog" data-psd-popup="primary" data-modal-type="recruitRewards" role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title"><header class="pl-modal-heading"><h2 id="lobby-modal-title">${helpers.escape(title)}</h2><button type="button" class="pl-close" data-action="close" aria-label="关闭奖励预览"></button></header><div class="pl-modal-content">${content}</div></section></div>`;
  return fullscreenDialog({title,content,type:'recruitRewards',kind:'recruitRewards',variant:'recruit-info-dialog',confirmLabel:'返回招募'},helpers);
}
