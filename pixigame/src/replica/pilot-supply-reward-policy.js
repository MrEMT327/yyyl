// Local adaptation of the captured 弹壳战机 1.1.6 task tables: daily activity
// includes 1,000 coins and 100 diamonds; weekly activity includes 200 diamonds
// and an equipment key. Its task rows award activity. The per-task and ad
// amounts below are project tuning, not claims about the live competitor.
const items=rows=>Object.freeze(rows.map(([id,amount])=>Object.freeze({id,amount})));

export const PILOT_TASK_POINTS=Object.freeze({login:25,battle1:25,battle3:25,upgrade:25,recruit:20});
export const PILOT_TASK_REWARDS=Object.freeze({
  login:items([[1,1000]]),
  battle1:items([[1,1000]]),
  battle3:items([[113,1]]),
  upgrade:items([]),
  recruit:items([]),
});
export const PILOT_DAILY_ACTIVITY_REWARDS=items([[2,100]]);
export const PILOT_WEEKLY_ACTIVITY_REWARDS=items([[2,200],[112,1]]);
export const PILOT_AD_REWARDS=items([[1,1000]]);
// 50 fragments make one credit; three credits buy a 300-diamond advanced key.
export const MAXED_PILOT_FRAGMENT_DIAMONDS=2;
