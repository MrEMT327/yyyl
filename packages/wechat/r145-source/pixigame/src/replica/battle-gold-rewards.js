import correspondence from './chapter-correspondence.json' with {type:'json'};

// Local approximations from user-provided original-game screenshots.
// These are fitted curves, not extracted original server formulas.
export const BATTLE_GOLD_CURVE_POLICY=Object.freeze({
  id:'project-chapter-seven-gold-curve-v1',chapterId:7,waveCount:15,
  baseGold:430,waveGold:360,power:0.6,
});

// Chapter 1 samples: wave 1 +398, wave 5 +1297, wave 15 +1952.
// Chapter 5 samples: wave 1 +379; wave 10 +1841 and +1922.
export const SAMPLED_BATTLE_GOLD_CURVE_POLICIES=Object.freeze([
  Object.freeze({id:'project-chapter-one-gold-curve-v1',chapterId:1,waveCount:15,
    baseGold:400,waveGold:488,power:0.44}),
  Object.freeze({id:'project-chapter-five-gold-curve-v1',chapterId:5,waveCount:10,
    baseGold:380,waveGold:400,power:0.6}),
  BATTLE_GOLD_CURVE_POLICY,
]);

// User-approved coverage of every normal chapter. Only same-wave-count samples
// may be blended. Outside their range, hold the nearest sample; do not invent
// late-game growth from enemy strength, patrol rates, kills or battle duration.
export const BATTLE_GOLD_FALLBACK_POLICY=Object.freeze({
  id:'project-all-chapter-gold-fallback-v1',
  method:'same-wave-count-interpolation-clamped-at-sampled-range',
});
function chapterPolicy(chapter){
  const sampled=SAMPLED_BATTLE_GOLD_CURVE_POLICIES.find(row=>row.chapterId===chapter.id);
  if(sampled){
    if(sampled.waveCount!==chapter.waveCount)throw Error('实测金币曲线与章节波数不一致');
    return Object.freeze({...sampled,stageIndex:chapter.stageIndex,
      source:'sample-fit',referenceChapterIds:Object.freeze([sampled.chapterId])});
  }
  const samples=SAMPLED_BATTLE_GOLD_CURVE_POLICIES.filter(row=>row.waveCount===chapter.waveCount)
    .sort((left,right)=>left.chapterId-right.chapterId);
  if(!samples.length)throw Error('该章节波数缺少金币近似模板');
  const lower=samples.filter(row=>row.chapterId<chapter.id).at(-1)||samples[0];
  const upper=samples.find(row=>row.chapterId>chapter.id)||samples.at(-1);
  const mix=lower===upper?0:(chapter.id-lower.chapterId)/(upper.chapterId-lower.chapterId);
  return Object.freeze({id:`${BATTLE_GOLD_FALLBACK_POLICY.id}-chapter-${chapter.id}`,
    chapterId:chapter.id,stageIndex:chapter.stageIndex,waveCount:chapter.waveCount,
    referenceCurves:Object.freeze([lower,upper]),mix,
    source:'local-approximation',referenceChapterIds:Object.freeze([...new Set([lower.chapterId,upper.chapterId])])});
}
export const BATTLE_GOLD_CURVE_POLICIES=Object.freeze(correspondence.chapters.map(chapterPolicy));

function progressGold(policy,wave){
  const amount=curve=>curve.baseGold+curve.waveGold*(wave-1)**curve.power;
  if(!policy.referenceCurves)return Math.round(amount(policy));
  const [lower,upper]=policy.referenceCurves;
  return Math.round(amount(lower)*(1-policy.mix)+amount(upper)*policy.mix);
}

// Freeze the concrete amount before persisting the pending result. Recovery
// pays that receipt; adding or tuning a chapter must not reprice old rewards.
export function prepareBattleGoldSettlement(result){
  const collectedGold=Math.floor(Number(result.gold));
  if(!Number.isSafeInteger(collectedGold)||collectedGold<0)throw Error('战斗金币无效');
  const policy=BATTLE_GOLD_CURVE_POLICIES.find(row=>row.chapterId===result.chapterId);
  const validOutcome=policy&&(result.won===true
    ?result.wave===policy.waveCount&&!['quit','defeat'].includes(result.endReason)
    :result.won===false&&['quit','defeat'].includes(result.endReason));
  const eligible=policy&&result.engine==='danke-replica-v1'
    &&result.stageIndex===policy.stageIndex
    &&typeof result.runId==='string'&&result.runId.length>0
    &&Number.isInteger(result.wave)&&result.wave>=1&&result.wave<=policy.waveCount
    &&validOutcome&&!result.trial&&!result.debugRun&&!result.abandoned;
  const progressGoldReward=eligible?{
    policyId:policy.id,displayedWave:result.wave,
    amount:progressGold(policy,result.wave),
  }:null;
  const gold=collectedGold+(progressGoldReward?.amount??0);
  if(!Number.isSafeInteger(gold))throw Error('战斗金币超限');
  return {collectedGold,gold,progressGoldReward};
}
