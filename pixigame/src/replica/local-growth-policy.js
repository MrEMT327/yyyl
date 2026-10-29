// Explicit offline compatibility pacing; native costs and attributes are intact.
export const LOCAL_GROWTH_POLICY=Object.freeze({
  version:1,
  dailyCoreBands:Object.freeze([{chapter:0,count:0},{chapter:10,count:1},{chapter:30,count:1}]),
  weeklyPlaneBands:Object.freeze([{chapter:0,count:1},{chapter:10,count:2},{chapter:20,count:3},{chapter:30,count:4},{chapter:60,count:5}]),
});
export function localGrowthAllowances(campaign={}) {
  const chapter=Math.max(0,...(campaign.clearedChapterIds||[]).filter(id=>Number.isInteger(id)&&id>=1&&id<=60));
  const allowance=bands=>bands.filter(row=>chapter>=row.chapter).at(-1).count;
  return {chapter,dailyCores:allowance(LOCAL_GROWTH_POLICY.dailyCoreBands),weeklyPlanes:allowance(LOCAL_GROWTH_POLICY.weeklyPlaneBands)};
}
