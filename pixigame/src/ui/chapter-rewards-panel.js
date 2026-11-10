import { nativeItemArt } from '../replica/native-item-presentation.js';
import { rewardDisplayQuality } from '../replica/item-display-quality.js';
import { rewardItemSlot } from './reward-item-slot.js';
import { projectIcon } from './project-ui-art.js';
import './chapter-rewards-panel.css';

const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const helpers={escape};

// Wave rewards and the project's independent chapter-core grants keep their
// own identities, revision checks and claim rules in one chronological queue.
export function chapterRewardEntries(acquisition) {
  const waves=acquisition?.rewards||[],cores=acquisition?.chapterCoreRewards||[];
  const chapters=[...new Set([...waves.map(row=>row.missionId),...cores.map(row=>row.id)])].sort((a,b)=>a-b);
  return chapters.flatMap(chapter=>[
    ...waves.filter(row=>row.missionId===chapter).map(row=>({key:`wave:${row.id}`,chapter,row,core:false})),
    ...cores.filter(row=>row.id===chapter).map(row=>({key:`core:${row.id}`,chapter,row,core:true})),
  ]);
}

const milestone=entry=>entry.core?'通关奖励':entry.row.wave?`第 ${entry.row.wave} 波`:entry.row.room?`${entry.row.room} 个房间`:`${entry.row.time} 秒`;

// The original view focuses its current unclaimed ID and advances after a claim.
// Preserve independent core grants in chapter order, without skipping an unmet row.
export function selectedChapterReward(entries) {
  return entries.find(entry=>!entry.row.claimed)||null;
}

function rewardSlot(item) {
  const image=nativeItemArt(item.id),name=String(item.name||'道具');
  const artwork=image?`<img src="${escape(image)}" alt="" draggable="false">`:`<span class="chapter-reward-unknown">${escape(name)}</span>`;
  return rewardItemSlot({name,amount:item.count,itemId:item.id,artwork,...rewardDisplayQuality({nativeItemId:item.id})},helpers);
}

function condition(entry) {
  if(entry.row.claimed)return '已领取';
  if(entry.row.reached&&!entry.row.canClaim)return '奖励暂不可领取';
  if(entry.core)return `通关第${entry.chapter}章领取`;
  // Language_languagetable / MissionRewardViewModule_Text and Text1.
  if(entry.row.wave||entry.row.room)return `通过${entry.chapter}-${entry.row.wave||entry.row.room}领取`;
  return `第${entry.chapter}章生存${Math.floor(entry.row.time/60)}分钟领取`;
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
