// APK 1.1.6: Chapter_MainChapter -> [101,102,103]; MainChapterHard -> [1,3,5].
// See doc/peripheral-redesign/star-progression-apk.md for native/table evidence.
const goal = (id, label, short, test) => Object.freeze({ id, label, short, test });
const NORMAL = Object.freeze([
  goal(101, '成功通关本章', '成功通关', () => true),
  goal(102, '未使用复活', '未复活', run => run.revivesUsed === 0),
  goal(103, '通关时生命值为100%', '满血通关', run => run.maxHp > 0 && run.hp >= run.maxHp),
]);
const HARD = Object.freeze([
  goal(1, '9分30秒内通关', '≤9分30秒', run => Number.isFinite(run.elapsed) && Math.floor(run.elapsed) <= 570),
  goal(3, '受击次数不超过5次', '受击≤5次', run => run.hitsTaken <= 5),
  goal(5, '未使用复活', '未复活', run => run.revivesUsed === 0),
]);
export const starGoals = (difficulty = 'easy') => difficulty === 'hard' ? HARD : NORMAL;
export const countStars = mask => [1,2,4].filter(bit => (mask & bit) !== 0).length;
export function assessRunStars({ won = false, difficulty = 'easy', hp = 0, maxHp = 0,
  revivesUsed = 0, elapsed = 0, hitsTaken = 0 } = {}) {
  const run = {hp,maxHp,revivesUsed,elapsed,hitsTaken};
  const goals = starGoals(difficulty).map(({id,label,test}, index) => ({id,label,index,achieved:won && test(run)}));
  const mask = goals.reduce((mask, goal) => mask | (goal.achieved ? 1 << goal.index : 0), 0);
  return { mask, stars:countStars(mask), goals };
}

// Existing saves recorded a star count, not individual objectives. Keep their
// earned total without inventing proof of an unrecorded no-revive achievement.
export function normalizeStarRecord(raw = {}) {
  const stars = Math.max(0, Math.min(3, Math.floor(Number(raw.stars) || 0)));
  const starMask = Number.isInteger(raw.starMask) && raw.starMask >= 0 && raw.starMask <= 7
    && countStars(raw.starMask) === stars ? raw.starMask : null;
  return { stars, starMask };
}
export function bestStarRecord(previous, run) {
  const old = normalizeStarRecord(previous);
  // Preserve the historical best, as the existing local campaign did. Never
  // manufacture a three-star run by OR-ing two different two-star runs.
  return run.stars >= old.stars ? {stars:run.stars,starMask:run.mask} : old;
}
