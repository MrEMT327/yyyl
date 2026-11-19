import { defeatResultModel } from './defeat-result-model.js';
import { resultRewards } from './result-rewards.js';

export function victoryResultModel(bridge, page = 0) {
  const game=bridge.game, completion=game.completionSummary||{}, native=bridge.presentation?.result;
  const rows=native ? (native.rows || []) : resultRewards(completion,game.victoryRewardDoubled).rows;
  const modelBridge={...bridge,presentation:{...bridge.presentation,result:native||{
    rows:rows.filter(row=>Number.isFinite(Number(row.amount))),
    chapterId:(game.stageIndex||0)+1,wave:game.waveIndex||1,kills:game.kills||0,stars:completion.stars||0,
  }}};
  const model=defeatResultModel(modelBridge,page);
  const stats=native?.stats||[['用时',`${Math.floor((game.elapsed||0)/60)}:${String(Math.floor((game.elapsed||0)%60)).padStart(2,'0')}`],['等级',String(game.level||1)]];
  const unlocks=native?[]:rows.filter(row=>!Number.isFinite(Number(row.amount))).map(row=>row.label);
  return {...model,recommendations:[],stars:Math.max(0,Math.min(3,Math.floor(Number(model.stars)||0))),
    stats:stats.filter(([key])=>['用时','等级'].includes(key)),
    unlocks,allStats:stats};
}
