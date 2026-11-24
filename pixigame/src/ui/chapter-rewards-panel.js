import { nativeItemArt } from '../replica/native-item-presentation.js';
import { rewardDisplayQuality } from '../replica/item-display-quality.js';
import { rewardItemSlot } from './reward-item-slot.js';
import { projectIcon } from './project-ui-art.js';
import './chapter-rewards-panel.css';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={escape};

import { chapterRewardEntries, selectedChapterReward, condition, milestone } from './chapter-reward-model.js';
export { chapterRewardEntries, selectedChapterReward, condition, milestone } from './chapter-reward-model.js';

function rewardSlot(item) {
  const image=nativeItemArt(item.id),name=String(item.name||'道具');
  const artwork=image?`<img src="${escape(image)}" alt="" draggable="false">`:`<span class="chapter-reward-unknown">${escape(name)}</span>`;
  return rewardItemSlot({name,amount:item.count,itemId:item.id,artwork,...rewardDisplayQuality({nativeItemId:item.id})},helpers);
}

/** Show the next unclaimed milestone only; browsing a chapter never changes it. */
export function chapterRewardsDialog(snapshot) {
  const acquisition=snapshot.nativeAcquisition;
  if(!acquisition)return {title:'通关奖励',content:'<p>章节奖励暂未就绪。</p>'};
  const entries=chapterRewardEntries(acquisition),selected=selectedChapterReward(entries);
  if(!entries.length)return {title:'通关奖励',content:'<p>暂无章节奖励。</p>'};
  const blocked=Boolean(snapshot.rewardPending||snapshot.rewardBusy),row=selected?.row;
  const stars=snapshot.starRewards?.native&&snapshot.starRewards.modes?.length
    ? `<button type="button" class="ui-info-link chapter-reward-stars" data-action="nativeStarRewards">${projectIcon('star')}<span>星级奖励</span></button>` : '';
  const action=row?.canClaim?`<button type="button" class="pl-button pl-primary chapter-reward-claim" data-action="${selected.core?'nativeChapterCoreReward':'nativeChapterReward'}" data-id="${row.id}" data-revision="${acquisition.revision}" ${blocked?'disabled':''}>获取奖励</button>`
    : `<p class="chapter-reward-condition" role="status">${selected?escape(condition(selected)):'全部奖励已领取'}</p>`;
  const warning=row?.rewards?.some(item=>item.unverified)?'<p class="chapter-reward-note">随机奖励以实际获得为准</p>':'';
  const label=selected?`下一档奖励：第 ${selected.chapter} 章，${milestone(selected)}`:'章节奖励已领完';
  return {title:'通关奖励',content:`<section class="chapter-reward-view${selected?'':' is-complete'}" aria-label="章节奖励" ${selected?`data-current-reward="${escape(selected.key)}"`:''}>
    <div class="chapter-reward-stage" aria-label="${escape(label)}"><div class="chapter-reward-step"><span class="chapter-reward-step-main">${selected?escape(milestone(selected)):'已领完'}</span><span class="chapter-reward-step-sub">${selected?`第 ${selected.chapter} 章`:'章节奖励'}</span></div></div>
    ${selected?`<section class="chapter-reward-preview" aria-label="当前奖励"><h3>奖励</h3><div class="chapter-reward-items">${(row.rewards||[]).map(rewardSlot).join('')}</div>${warning}</section>`:''}
    <footer class="chapter-reward-footer">${action}${stars}</footer>
  </section>`};
}
