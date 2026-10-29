import './recruit-results.css';
import './recruit-probabilities.css';
import {pilotHoloCard} from './pilot-holo-card.js';

// Every draw has the same portrait surface and caption track, including materials.
export function pilotRecruitResults(rewards,pilots,{number,renderReward}) {
  return `<div class="pl-card-results ${rewards.length===1?'is-single':''}">${rewards.map((reward,index)=>{
    const pilot=pilots.find(p=>p.id===(reward.pilotId||reward.id));
    if(!pilot)return `<div class="rr-result-slot is-material">${renderReward(reward)}<span class="rr-result-note" aria-hidden="true"></span></div>`;
    const note=reward.nativeRecruit?(reward.creditsAdded?`已满星 · 兑换积分 +${reward.creditsAdded}`:reward.isNew?`驾驶员已激活 · ${reward.stars} 星`:`同名卡 ×${reward.copiesAdded} · 已存入升星材料`):reward.copiesAdded?`同名卡 ×${reward.copiesAdded}${reward.aircraftCopiesAdded?' · 机体卡 ×'+reward.aircraftCopiesAdded:''}`:reward.isNew?`战姬加入 · 0 星${reward.aircraftIsNew?' · 专属座驾解锁':''}`:reward.type==='pilot'?`升星成功 · ${reward.beforeStars} → ${reward.stars} 星`:reward.aircraftCopiesAdded?`碎片 ×${number(reward.amount)} · 机体卡 ×${reward.aircraftCopiesAdded}`:`${reward.manualCards?'同名卡已足':'已满星'} · 飞机碎片 ×${number(reward.amount)}`;
    return `<div class="pl-card-result rr-result-slot" style="--reveal-delay:${Math.min(index,9)*65}ms">${pilotHoloCard({...pilot,stars:reward.stars??pilot.stars},{interactive:true,compact:rewards.length>1,reveal:true,status:reward.creditsAdded?'满星转换':reward.requiresActivation?'待激活':reward.copiesAdded?'同名卡':reward.manualCards?'同名卡已足':reward.isNew?'首次获得':'重复获得'})}<p class="rr-result-note">${note}</p></div>`;
  }).join('')}</div>`;
}

export function isRecruitResult(modal) {
  return modal?.type==='rewards' && (modal.recruit===true || ['pilot','weapon'].includes(modal.recruitPool));
}

// Result receipts are already committed; this surface only presents and closes them.
function fullscreenDialog({title,content,type,kind,variant,confirmLabel,count}, {escape:e,button}) {
  return `<div class="pl-modal-backdrop recruit-result-backdrop" data-action="dismiss"><section class="pl-modal recruit-result-dialog ${variant}" data-modal-type="${type}" data-modal-kind="${kind}" ${count?`data-draw-count="${count}"`: ''} role="dialog" aria-modal="true" aria-labelledby="lobby-modal-title" tabindex="-1"><header class="pl-modal-heading recruit-result-heading"><h2 id="lobby-modal-title">${e(title)}</h2><button type="button" class="pl-close" data-action="close" aria-label="关闭${e(title)}">×</button></header><div class="pl-modal-content recruit-result-scroll">${content}</div><footer class="recruit-result-actions">${button('close',confirmLabel,'recruit-result-confirm')}</footer></section></div>`;
}

export function recruitResultsDialog({title='招募结果',content,count},helpers) {
  return fullscreenDialog({title,content,type:'rewards',kind:'recruitResult',variant:count===1?'is-single':'is-multiple',count,confirmLabel:'确定'},helpers);
}

export function recruitRewardsDialog({title,content},helpers) {
  return fullscreenDialog({title,content,type:'recruitRewards',kind:'recruitRewards',variant:'recruit-info-dialog',confirmLabel:'返回补给'},helpers);
}
