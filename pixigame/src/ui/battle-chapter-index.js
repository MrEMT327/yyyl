export function battleChapterIndex(snapshot, requestedChapter) {
  const max = Math.max(0, (snapshot.stages?.length || 0) - 1);
  const current = snapshot.selectedStageIndex || 0;
  return Math.max(0, Math.min(max, Number.isInteger(requestedChapter) ? requestedChapter : current));
}
