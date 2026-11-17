// DrawBox_DrawBoxConst.SmallEquipBoxCharge: 20 openings -> item 112 x1.
// Keep this separate from the former custom pool's draws/claims counters.
export function nativeBoxProgress(value) {
  const int=n=>Number.isSafeInteger(n)&&n>=0?n:0;
  const draws=int(value?.basicDraws),claims=Math.min(int(value?.basicClaims),Math.floor(draws/20));
  return {version:1,basicDraws:draws,basicClaims:claims};
}
export function basicBoxReward(gear) {
  const progress=nativeBoxProgress(gear?.nativeBoxProgress);
  return {...progress,available:Math.floor(progress.basicDraws/20)-progress.basicClaims,required:20,rewardId:112,rewardAmount:1};
}
