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

export const milestone=entry=>entry.core?'通关奖励':entry.row.wave?`第 ${entry.row.wave} 波`:entry.row.room?`${entry.row.room} 个房间`:`${entry.row.time} 秒`;

// The original view focuses its current unclaimed ID and advances after a claim.
// Preserve independent core grants in chapter order, without skipping an unmet row.
export function selectedChapterReward(entries) {
  return entries.find(entry=>!entry.row.claimed)||null;
}

export function condition(entry) {
  if(entry.row.claimed)return '已领取';
  if(entry.row.reached&&!entry.row.canClaim)return '奖励暂不可领取';
  if(entry.core)return `通关第${entry.chapter}章领取`;
  // Language_languagetable / MissionRewardViewModule_Text and Text1.
  if(entry.row.wave||entry.row.room)return `通过${entry.chapter}-${entry.row.wave||entry.row.room}领取`;
  return `第${entry.chapter}章生存${Math.floor(entry.row.time/60)}分钟领取`;
}
