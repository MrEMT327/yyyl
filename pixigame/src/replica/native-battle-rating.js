import { assessRunStars, bestStarRecord, countStars } from '../campaign-stars.js';
import rules from './native-battle-rules.json' with { type: 'json' };

// A legacy receipt without HP/revive evidence must not become a three-star run.
// The chapter's three conditions are extracted unchanged from the native table.
export function assessReplicaBattle(result) {
  if (!rules.chapters[result.chapterId] || !Number.isFinite(result.hp) ||
    !Number.isFinite(result.maxHp) || result.hp < 0 || result.maxHp <= 0 ||
    !Number.isInteger(result.revivesUsed) || result.revivesUsed < 0) return null;
  const assessment=assessRunStars({won:Boolean(result.won)&&!result.abandoned,
    difficulty:'easy',hp:result.hp,maxHp:result.maxHp,revivesUsed:result.revivesUsed});
  return {starMask:assessment.mask,stars:assessment.stars,starObjectives:assessment.goals};
}
export function preserveReplicaStars(previous, result) {
  const assessed=assessReplicaBattle(result);
  const old=Number.isInteger(previous)&&previous>=0&&previous<=7?previous:0;
  if(!assessed)return old;
  // Server-side cross-run merge rules aren't shipped in the APK. Keep the
  // project's existing single-best-run policy; never combine two partial runs.
  return bestStarRecord({stars:countStars(old),starMask:old},
    {stars:assessed.stars,mask:assessed.starMask}).starMask;
}
export { countStars };
