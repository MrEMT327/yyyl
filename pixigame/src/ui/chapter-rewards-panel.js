import { nativeItemArt } from '../replica/native-item-presentation.js';
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const reward=(item,processed=false,historicalClaim=false,showIcon=true)=>{
  const art=showIcon?nativeItemArt(item.id):null,icon=art?`<img class="pl-icon" src="${escape(art)}" alt="" draggable="false">`:'';
  return item.unverified?(historicalClaim?`${icon}${escape(item.name)}<small>（已领取）</small>`:
    `${icon}${escape(item.name)} ×${item.count}`):
    `${icon}${escape(item.name||'星核')} ×${item.count}${processed?' · 已领取':''}`;
};
/** Keep the current chapter view compact while retaining the complete ledger. */
export function chapterRewardsDialog(snapshot,preferredChapter,{currentOnly=false}={}) {
  const a=snapshot.nativeAcquisition;
  if(!a)return {title:'章节奖励',content:'<p>章节奖励暂未就绪。</p>'};
  const stars=snapshot.starRewards?.native?snapshot.starRewards.modes[0]:null;
  const originalStars=stars?'<button type="button" class="wc-button" data-action="nativeStarRewards">星级奖励</button>':'';
  const blocked=Boolean(snapshot.rewardPending||snapshot.rewardBusy);
  const waves=a.rewards,cores=a.chapterCoreRewards||[],ledger=a.chapterRewardLedger;
  const chapters=[...new Set([...waves.map(r=>r.missionId),...cores.map(r=>r.id)])].sort((x,y)=>x-y);
  const next=waves.find(row=>!row.processed),readyCore=cores.find(row=>row.canClaim);
  const opened=new Set([preferredChapter,next?.missionId,readyCore?.id]);
  const button=(row,core=false)=>{
    const label=row.claimed?'已领取':row.unresolved?'补领':row.canClaim?'领取':!core&&row.reached?'先领前一项':'未达成';
    const style=currentOnly?`pl-button ${row.canClaim?'pl-primary':'pl-secondary'}`:'wc-button';
    return `<button type="button" class="${style}" data-action="${core?'nativeChapterCoreReward':'nativeChapterReward'}" data-id="${row.id}" data-revision="${a.revision}" ${blocked||!row.canClaim?'disabled':''}>${label}</button>`;
  };
  const waveRow=row=>`<section class="bc-star-reward ${row.claimed?'is-claimed':''}"><b>${row.wave?`第 ${row.wave} 波`:row.room?`${row.room} 个房间`:`${row.time} 秒`}${row.unresolved?'<small> · 待补图纸</small>':''}</b><span>${row.rewards.map(item=>reward(item,row.processed&&!item.unverified,row.claimed,!currentOnly)).join('<br>')}${!currentOnly?row.rewards.filter(r=>r.preview?.length).map(r=>`<details><summary>奖励预览</summary>${r.preview.map(item=>reward(item)).join('<br>')}</details>`).join(''):''}</span>${button(row)}</section>`;
  const coreRow=core=>`<section class="bc-star-reward ${core.claimed?'is-claimed':''}"><b>通关奖励</b><span>${core.rewards.map(item=>reward(item,false,false,!currentOnly)).join('<br>')}</span>${button(core,true)}</section>`;
  const notice=blocked?`<p role="status">${snapshot.rewardPending?'奖励待保存':'奖励处理中'}</p>`:'';
  if(currentOnly){
    const id=preferredChapter??snapshot.stages?.[snapshot.selectedStageIndex||0]?.replicaChapterId??chapters[0];
    const rows=waves.filter(row=>row.missionId===id),core=cores.find(row=>row.id===id);
    return {title:'章节奖励',content:`<section class="bc-star-rewards bc-current-chapter" aria-label="章节奖励"><div class="bc-star-total"><strong>累计 ${rows.filter(row=>row.claimed).length}<small> / ${rows.length}</small></strong><span>每档仅领一次</span></div>${notice}<div class="bc-star-reward-list">${rows.map(waveRow).join('')}${core?coreRow(core):''}</div><div class="bc-chapter-actions"><button type="button" class="wc-button" data-action="chapterRewards">全部章节</button>${originalStars}</div></section>`};
  }
  const pending=ledger?.deferred||[];
  const deferred=pending.length?`<p>待补图纸 ${pending.length} 档</p>`:'';
  return {title:'章节奖励',content:`<section class="bc-star-rewards clarity-page" aria-label="章节奖励">${notice}${originalStars}${deferred}${Array.from({length:Math.ceil(chapters.length/10)},(_,group)=>{const ids=chapters.slice(group*10,group*10+10),open=ids.some(id=>opened.has(id));return `<details class="bc-reward-group"${open?' open':''}><summary>第 ${ids[0]}–${ids.at(-1)} 章${ids.some(id=>waves.some(row=>row.missionId===id&&row.canClaim)||cores.some(row=>row.id===id&&row.canClaim))?' · 可领取':''}</summary>${ids.map(id=>{
    const rows=waves.filter(r=>r.missionId===id),core=cores.find(r=>r.id===id);
    const stage=snapshot.stages?.find(s=>s.replicaChapterId===id),title=stage?.chapterName||`第 ${id} 章`;
    const done=rows.filter(r=>r.claimed).length+Number(Boolean(core?.claimed)),waiting=rows.filter(r=>r.unresolved).length;
    const ready=rows.some(r=>r.canClaim)||core?.canClaim;
    return `<details${opened.has(id)?' open':''}><summary>${escape(title)} · ${done}/${rows.length+Number(Boolean(core))}${waiting?` · 待补图纸${waiting}档`:''}${ready?' · 可领取':''}</summary><div class="bc-star-reward-list">${rows.map(waveRow).join('')}${core?coreRow(core):''}</div></details>`;
  }).join('')}</details>`;}).join('')}</section>`};
}
