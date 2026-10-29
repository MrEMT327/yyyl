import { nativeItemArt } from '../replica/native-item-presentation.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reward=(item,processed=false,historicalClaim=false)=>{
  const art=nativeItemArt(item.id),icon=art?`<img class="pl-icon" src="${escape(art)}" alt="" draggable="false">`:'';
  return item.unverified?(historicalClaim?`${icon}${escape(item.name)}<small>（已领取）</small>`:
    `${icon}${escape(item.name)} ×${item.count}`):
    `${icon}${escape(item.name||'星核')} ×${item.count}${processed?' · 已领取':''}`;
};
/** Original fixed quantities; random group allocation is explicitly local compatibility. */
export function chapterRewardsDialog(snapshot,preferredChapter) {
  const a=snapshot.nativeAcquisition;
  if(!a)return {title:'章节奖励',content:'<p>章节奖励暂未就绪。</p>'};
  const stars=snapshot.starRewards?.native?snapshot.starRewards.modes[0]:null;
  const originalStars=stars?`<p><button type="button" class="wc-button" data-action="nativeStarRewards">星级奖励 · ${stars.total}星 · 可领${stars.items.filter(row=>row.claimable).length}项</button></p>`:'';
  const blocked=Boolean(snapshot.rewardPending||snapshot.rewardBusy);
  const waves=a.rewards,cores=a.chapterCoreRewards||[],ledger=a.chapterRewardLedger;
  const chapters=[...new Set([...waves.map(r=>r.missionId),...cores.map(r=>r.id)])].sort((x,y)=>x-y);
  const next=waves.find(row=>!row.processed),readyCore=cores.find(row=>row.canClaim);
  const opened=new Set([preferredChapter,next?.missionId,readyCore?.id]);
  const button=(row,core=false)=>{
    const label=row.claimed?'已领取':row.unresolved?'补领待发图纸':row.canClaim?(row.deferredRewards?.length?'领取':'领取'):core?'完整通关后领取':row.reached?'先处理前一项':'未达成';
    return `<button type="button" class="wc-button" data-action="${core?'nativeChapterCoreReward':'nativeChapterReward'}" data-id="${row.id}" data-revision="${a.revision}" ${blocked||!row.canClaim?'disabled':''}>${label}</button>`;
  };
  const pending=ledger?.deferred||[];
  const deferred=pending.length?`<details><summary>旧待发图纸记录 · ${pending.length}档（可点击对应奖励补领）</summary><p>可补领尚未领取的图纸。</p>${pending.map(row=>`<p>第${row.missionId}章${row.wave?`第${row.wave}波`:''}<br>${row.rewards.map(item=>reward(item)).join('<br>')}</p>`).join('')}</details>`:'';
  return {title:'章节奖励',content:`<section class="bc-star-rewards clarity-page" aria-label="章节奖励"><div class="clarity-summary"><span>章节奖励 <b>${waves.filter(r=>r.claimed).length}/${waves.length}</b></span><span>通关星核 <b>${cores.filter(r=>r.claimed).length}/${cores.length}</b></span></div>${blocked?'<p role="status">奖励正在处理或待保存，请先完成当前奖励。</p>':''}${originalStars}${deferred}<details class="clarity-rules"><summary>领取规则</summary><p>每项固定奖励仅领取一次。</p><p>完整通关第5、10、15……50章，各可领星核1枚，共10枚。</p></details>${Array.from({length:Math.ceil(chapters.length/10)},(_,group)=>{const ids=chapters.slice(group*10,group*10+10),open=ids.some(id=>opened.has(id));return `<details class="bc-reward-group"${open?' open':''}><summary>第 ${ids[0]}–${ids.at(-1)} 章${ids.some(id=>waves.some(row=>row.missionId===id&&row.canClaim)||cores.some(row=>row.id===id&&row.canClaim))?' · 可领取':''}</summary>${ids.map(id=>{
    const rows=waves.filter(r=>r.missionId===id),core=cores.find(r=>r.id===id);
    const stage=snapshot.stages?.find(s=>s.replicaChapterId===id),title=stage?.chapterName||`第 ${id} 章`;
    const done=rows.filter(r=>r.claimed).length+Number(Boolean(core?.claimed)),waiting=rows.filter(r=>r.unresolved).length;
    const ready=rows.some(r=>r.canClaim)||core?.canClaim;
    return `<details${opened.has(id)?' open':''}><summary>${escape(title)} · ${done}/${rows.length+Number(Boolean(core))}${waiting?` · 待补图纸${waiting}档`:''}${ready?' · 可领取':''}</summary><div class="bc-star-reward-list">${rows.map(row=>`<section class="bc-star-reward ${row.claimed?'is-claimed':''}"><b>${row.wave?`通过第 ${row.wave} 波`:row.room?`通过 ${row.room} 个房间`:`达到 ${row.time} 秒`}${row.unresolved?'<small>固定部分已领 · 图纸可补领</small>':''}</b><span>${row.rewards.map(item=>reward(item,row.processed&&!item.unverified,row.claimed)).join('<br>')}${row.rewards.filter(r=>r.preview?.length).map(r=>`<details><summary>奖励预览</summary>${r.preview.map(item=>reward(item)).join('<br>')}</details>`).join('')}</span>${button(row)}</section>`).join('')}${core?`<section class="bc-star-reward ${core.claimed?'is-claimed':''}"><b>通关奖励 · 完整通关</b><span>${core.rewards.map(item=>reward(item)).join('<br>')}</span>${button(core,true)}</section>`:''}</div></details>`;
  }).join('')}</details>`;}).join('')}</section>`};
}
