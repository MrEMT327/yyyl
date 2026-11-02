import captured from './native-signin-source.json' with {type:'json'};

export const LOCAL_SIGNIN_POLICY_ID='project-signin-driver-v2';
export const APK_SIGNIN_POLICY_ID='dkzj-1.1.6-signin-v1';
export const STARTER_PLANE=10104; // Historical starter receipt only.
export const STARTER_PILOT=40200;
export const SIGNIN_PILOT=40200; // 绯雨·桃乐丝; real driver, not an aircraft skin.
export const SIGNIN_LAST_DAY=9999;
export const SIGNIN_SOURCE='项目签到奖励：可用养成资源与第七天驾驶员';
const item=(id,count)=>({kind:'item',id,count});
const freezeWeek=week=>Object.freeze(week.map(rows=>Object.freeze(rows.map(Object.freeze))));
// The competitor informs the seven-card layout. Every live reward belongs to
// an implemented project feature: currency, gear/research sheets, or a pilot.
export const FLIGHT_SIGNIN=freezeWeek([
  [item(2,100)],[item(1,3000)],[item(10010007,50)],
  [item(2,200)],[item(10010008,50)],[item(1,5000)],
  [{kind:'pilots',id:SIGNIN_PILOT,count:1},item(2,300),item(1,5000)],
]);
const repeatWeek=freezeWeek([
  [item(1,5000)],[item(10010007,50)],[item(2,100)],
  [item(10010008,50)],[item(1,5000)],[item(10010007,50)],
  [item(2,200),item(10010008,50)],
]);
export function signinRewards(day) {
  if(!Number.isSafeInteger(day)||day<1||day>SIGNIN_LAST_DAY)throw Error('签到天数无效');
  return structuredClone((day<=7?FLIGHT_SIGNIN:repeatWeek)[(day-1)%7]);
}
// Captured APK rows are used ONLY to describe awards already earned under the
// rejected APK policy. Never grant its keys/chips/drone materials again.
export function capturedSigninRewards(day) {
  const group=captured.rows.find(row=>day>=row.rangeStart&&day<=row.rangeEnd);
  if(!group)throw Error('历史签到天数无效');
  return group.days[(day-1)%7].map(([id,count])=>({kind:id===10101?'skins':'item',id,count}));
}
// Read-only history: old claimed days keep the reward they actually received.
export const LEGACY_FLIGHT_SIGNIN=Object.freeze([
  [item(2,100),item(1,1000)],[{kind:'skins',id:STARTER_PLANE,count:1}],
  [item(2,150)],[item(1,3000),item(106,10),item(109,10)],
  [item(2,200)],[item(105,10),item(107,10),item(108,10)],
  [item(2,300),item(1,5000),{kind:'pilots',id:STARTER_PILOT,count:1}],
]);
