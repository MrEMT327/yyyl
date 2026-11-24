import { researchCardQuality } from './research-art.js';
import './research-result.css';

import { researchResultChanges } from './research-result-model.js';
export { researchResultChanges } from './research-result-model.js';

export function researchAwakeningResult(card, receipt, h) {
  const {escape:e,img,researchArt:art}=h;
  const changes=receipt.nativeChanges||researchResultChanges(card,receipt.previousLevel,receipt.level);
  return `<article class="research-result research-awakening-result">
    <div class="research-detail-card research-result-emblem" data-psd-quality="${researchCardQuality(card.quality)}" role="img" aria-label="${e(card.qualityName)}${e(card.name)}">${img(art(card.icon),'','research-result-icon')}</div>
    <h3 class="research-result-name">${e(card.name)}</h3>
    <div class="research-result-level" aria-label="等级变化"><span>Lv.${e(receipt.previousLevel)}</span><i aria-hidden="true">→</i><strong>Lv.${e(receipt.level)}</strong></div>
    <div class="research-result-changes">${changes.map(row=>`<div class="research-result-stat" aria-label="${e(row.label)} ${e(row.before)} → ${e(row.after)}"><span>${e(row.label)}</span><div><span>${e(row.before)}</span><i aria-hidden="true">→</i><strong>${e(row.after)}</strong></div></div>`).join('')}</div>
    ${receipt.earnedCore?`<div class="research-result-core">${img(`${import.meta.env?.BASE_URL??'/'}art/project-inventory-icons-v1/technology-core.png`,'','')}<span>星核</span><strong>×${e(receipt.earnedCore)}</strong></div>`:''}
    <button type="button" class="wc-button research-close" data-action="close">确定</button>
  </article>`;
}
