// A bounded receipt log for the recruitment history UI; never changes draw results.
export const RECRUIT_HISTORY_LIMIT = 50;
const text = (value, length=100) => typeof value==='string' ? value.slice(0,length) : '';
export function sanitizeRecruitHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-RECRUIT_HISTORY_LIMIT).flatMap(entry => {
    if (!entry || !['pilot','weapon'].includes(entry.pool) || !Array.isArray(entry.results)) return [];
    const at=Number(entry.at);
    if (!Number.isFinite(at) || at<0 || at>8.64e15) return [];
    const results=entry.results.slice(0,10).filter(r=>r&&typeof r==='object').map(r=>({
      id:text(r.id,80),name:text(r.name),amount:Math.max(1,Math.min(100000,Math.floor(Number(r.amount)||1))),
      isNew:r.isNew===true,rarity:text(r.rarity,12),
    }));
    if (!results.length) return [];
    return [{at,pool:entry.pool,count:results.length,cost:Math.max(0,Math.min(1e9,Math.floor(Number(entry.cost)||0))),results}];
  });
}
export function appendRecruitHistory(history,{at,pool,cost,rewards}) {
  return sanitizeRecruitHistory([...sanitizeRecruitHistory(history),{at,pool,cost,results:rewards}]);
}
