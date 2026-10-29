import { researchTabs } from './research-tabs.js';
import { researchCardQuality } from './research-art.js';
import { researchAwakeningResult } from './research-result.js';
import { lobbyNavigation } from './lobby-navigation.js';
import { resourceIcon } from './resource-icons.js';
import { lobbyResources } from './lobby-resources.js';
import { lobbyPageHeading } from './lobby-header.js';
import { RESEARCH_CORE_INTERVAL, RESEARCH_REFINE_STEPS } from '../peripheral/research.js';

const base=import.meta.env?.BASE_URL??'/';
const button=(action,label,attrs='',cls='')=>`<button type="button" class="wc-button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const amount=(v,n)=>Number(v)>=1e8?`${Number((v/1e8).toFixed(1))}亿`:Number(v)>=1e4?`${Number((v/1e4).toFixed(1))}万`:n(v);
export function researchHeader({snapshot,helpers}) {return `${lobbyPageHeading({helpers,title:'科技研究',icon:helpers.icon('research')})}${lobbyResources({snapshot,helpers},'researchShop')}`;}
export function researchNavigation(){return lobbyNavigation('research');}

function cardFace(c,h,preview=false) {
  const {escape:e,img,researchArt:art}=h,revealed=c.owned||preview;
  return `<span class="research-card-shell${revealed?'':' is-concealed'}${preview?' is-preview':''}" data-psd-quality="${revealed?researchCardQuality(c.quality):0}"${preview?` role="img" aria-label="${e(c.qualityName)}${e(c.name)}"`:''}><span class="research-card-artbox">${revealed?img(art(c.icon),'','research-card-art'):img(`${base}art/research-comic-v1/question.svg`,'','research-card-mystery')}</span>${revealed&&!preview?`<span class="research-card-caption"><b>${e(c.name)}</b><strong>${c.maxed?'MAX':`Lv.${c.level}`}</strong></span>`:''}</span>`;
}

export function researchPage({snapshot:s,helpers:h}) {
  const r=s.research;if(!r)return '<section class="research-page rg-page"><p>科技暂不可用</p></section>';
  const {escape:e,number:n,img,researchArt:art}=h;
  const core=img(art('technology-core'),'','research-core-icon');
  const coin=resourceIcon('coin','research-icon');
  const normalName=r.allFinished?'全部满级':r.coresSufficient?'星核已充足':r.refineReady?'领取星核':r.refining?'推进研制':'常规觉醒';
  const normalBlocked=r.allFinished||r.coresSufficient;
  const normalShort=!normalBlocked&&!r.refineReady&&s.wallet.coins<r.normalCost;
  const normalHint='';
  const normalPrice=normalBlocked?'—':r.refineReady?`${core}<b>+1</b>`:`${coin}<b>${amount(s.wallet.coins,n)}</b><i>/${amount(r.normalCost,n)}</i>`;
  const aceShort=!r.aceFinished&&r.cores<1;
  const progress=r.native?r.progressText:r.allFinished||r.aceFinished?'':r.coresSufficient?'星核充足，可进行王牌觉醒':r.refining?`研制 ${r.refineProgress}/${r.refineSteps}`:`再觉醒 ${r.untilCore} 次，获得`;
  // Owned (including MAX) comes first; stable sort preserves native order within each group.
  const cards=[...r.cards].sort((a,b)=>Number(b.owned)-Number(a.owned)).map(c=>!c.owned?`<div class="research-card is-locked" role="img" aria-label="未觉醒科技">${cardFace(c,h)}</div>`:`<button type="button" class="research-card" data-action="researchCard" data-id="${e(c.id)}" aria-label="${e(c.qualityName)}${e(c.name)}，${c.maxed?'已满级':`等级${c.level}`}">${cardFace(c,h)}</button>`).join('');
  return `<section class="research-page rg-page" aria-label="天赋"><header class="research-banner has-research-tabs">${researchTabs(s)}${button('researchSummary',`总加成 ${r.owned}/${r.cards.length}`,`aria-label="已觉醒${r.owned}张，共${r.cards.length}张，查看总加成"`,'research-summary')}</header>
    <div class="research-scroll" tabindex="0" aria-label="天赋卡片列表，可滚动浏览"><div class="research-grid">${cards}</div></div>
    <footer class="research-footer">${progress?`<p class="research-core-progress">${progress}${r.coresSufficient?'':`${core}<span>×${r.native?r.cores:1}</span>`}</p>`:''}<div class="research-actions">
      <button type="button" class="wc-button research-awaken is-normal" data-action="researchDraw" data-pool="normal" data-revision="${r.revision}" ${r.canNormal?'':'disabled'} aria-label="${e(normalName)}${normalHint?`，${normalHint}`:''}，现有${s.wallet.coins}金币，消耗${normalBlocked||r.refineReady?0:r.normalCost}金币"><strong>${normalName}</strong><span${normalShort?' class="is-short"':''}>${normalPrice}</span></button>
      <button type="button" class="wc-button research-awaken is-ace" data-action="researchDraw" data-pool="ace" data-revision="${r.revision}" ${r.canAce?'':'disabled'} aria-label="${r.aceFinished?'王牌已满级':'王牌觉醒，消耗1枚星核'}"><strong>${r.aceFinished?'王牌已满级':'王牌觉醒'}</strong><span${aceShort?' class="is-short"':''}>${r.aceFinished?'—':`${core}<b>${n(r.cores)}</b><i>/1</i>`}</span></button>
    </div>${s.storageWarning?`<p class="research-warning">${e(s.storageWarning)}</p>`:''}</footer></section>`;
}

export function researchModal(modal,s,h) {
  const {escape:e,img,researchArt:art}=h,r=s.research;
  if(!r)return {title:'科技',content:'<p>科技暂不可用</p>'};
  const close=label=>button('close',label,'','research-close');
  const core=img(art('technology-core'),'星核','research-core-reward');
  if(modal.type==='researchSummary')return {title:'科技总加成',content:`<article class="research-copy"><p>已觉醒 ${r.owned}/${r.cards.length}</p>${r.effects.length?r.effects.map(line=>`<p class="research-effect">${e(line)}</p>`).join(''):'<p>尚未觉醒科技</p>'}<details class="research-rules"><summary tabindex="0" data-research-rules>觉醒规则</summary>${r.native?r.rules.map(line=>`<p>${e(line)}</p>`).join(''):`<p>常规觉醒消耗金币；王牌觉醒每次消耗1枚星核。</p><p>随机提升一种未满级科技。</p><p>每${RESEARCH_CORE_INTERVAL}次常规觉醒获得1枚星核。常规科技全部满级后，每${RESEARCH_REFINE_STEPS}次研制获得1枚星核。</p>`}</details>${close('返回天赋')}</article>`};
  const receipt=modal.result,c=r.cards.find(c=>c.id===(receipt?.cardId||modal.id));
  if(!c&&receipt?.earnedCore)return {title:'星核研制完成',content:`<article class="research-result">${core}<h3>星核 ×${receipt.earnedCore}</h3>${close('收下')}</article>`};
  if(!c&&receipt?.refining)return {title:'星核研制',content:`<article class="research-result"><h3>研制进度 ${receipt.refineProgress}/${receipt.refineSteps}</h3><progress max="${receipt.refineSteps}" value="${receipt.refineProgress}" aria-label="星核研制进度"></progress>${close('继续')}</article>`};
  if(!c||(!receipt&&!c.owned))return {title:'科技',content:'<p>未觉醒科技</p>'};
  if(receipt)return {title:receipt.previousLevel?'科技升级':'科技觉醒',content:researchAwakeningResult(c,receipt,h)};
  const level=receipt?`Lv.${receipt.previousLevel} → Lv.${receipt.level}`:`${c.level} / ${c.maxLevel}级 · ${c.pool==='normal'?'常规':'王牌'}觉醒`;
  return {title:receipt?receipt.previousLevel?'科技升级':'科技觉醒':c.name,content:`<article class="research-detail${receipt?' research-result':''}"><div class="research-detail-card">${cardFace(c,h,true)}</div><p class="research-level">${level}</p><div class="research-copy">${c.owned?`<h4>当前效果</h4>${c.effects.map(line=>`<p class="research-effect">${e(line)}</p>`).join('')}`:''}${!receipt&&!c.maxed?`<h4>${c.owned?'下一级':'觉醒效果'}</h4>${c.nextEffects.map(line=>`<p>${e(line)}</p>`).join('')}`:''}${receipt?.earnedCore?`<p class="research-extra-core">额外获得星核 ×${receipt.earnedCore}</p>`:''}</div>${close(receipt?'收下':'返回天赋')}</article>`};
}
