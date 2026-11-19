// Local approximation approved from the original chapter-7 screenshots.
// This is not an extracted server formula. Other chapters need their own data.
export const BATTLE_GOLD_CURVE_POLICY=Object.freeze({
  id:'project-chapter-seven-gold-curve-v1',chapterId:7,waveCount:15,
  baseGold:430,waveGold:360,power:0.6,
});

// Calculate before persisting the pending result. Recovery pays that exact
// recorded total, so a future policy change cannot reprice an in-flight receipt.
export function prepareBattleGoldSettlement(result){
  const collectedGold=Math.floor(Number(result.gold));
  if(!Number.isSafeInteger(collectedGold)||collectedGold<0)throw Error('战斗金币无效');
  const policy=BATTLE_GOLD_CURVE_POLICY;
  const validOutcome=result.won===true
    ?result.wave===policy.waveCount&&!['quit','defeat'].includes(result.endReason)
    :result.won===false&&['quit','defeat'].includes(result.endReason);
  const eligible=result.engine==='danke-replica-v1'
    &&result.chapterId===policy.chapterId&&result.stageIndex===policy.chapterId-1
    &&typeof result.runId==='string'&&result.runId.length>0
    &&Number.isInteger(result.wave)&&result.wave>=1&&result.wave<=policy.waveCount
    &&validOutcome&&!result.trial&&!result.debugRun&&!result.abandoned;
  const progressGoldReward=eligible?{
    policyId:policy.id,displayedWave:result.wave,
    amount:Math.round(policy.baseGold+policy.waveGold*(result.wave-1)**policy.power),
  }:null;
  const gold=collectedGold+(progressGoldReward?.amount??0);
  if(!Number.isSafeInteger(gold))throw Error('战斗金币超限');
  return {collectedGold,gold,progressGoldReward};
}
