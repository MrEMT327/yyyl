import captured from './native-signin-source.json' with {type:'json'};
export const LOCAL_SIGNIN_POLICY_ID='project-signin-native-v4';
export const PREVIOUS_AIRCRAFT_SIGNIN_POLICY_ID='project-signin-aircraft-v3';
export const PREVIOUS_SIGNIN_POLICY_ID='project-signin-driver-v2';
export const APK_SIGNIN_POLICY_ID='dkzj-1.1.6-signin-v1';
export const STARTER_PLANE=10104;
export const SIGNIN_PLANE=10101;
export const STARTER_PILOT=40200;
export const SIGNIN_PILOT=40200;
export const SIGNIN_LAST_DAY=9999;
export const SIGNIN_SOURCE='原版签到奖励；芯片、僚机专用奖励按已确认方案替换';
const item=(id,count)=>({kind:'item',id,count});
const freezeWeek=week=>Object.freeze(week.map(rows=>Object.freeze(rows.map(Object.freeze))));
const previousWeek=freezeWeek([
 [item(2,100)],[{kind:'skins',id:SIGNIN_PLANE,count:1}],[item(10010007,50)],
 [item(2,200)],[item(10010008,50)],[item(1,5000)],
 [{kind:'pilots',id:SIGNIN_PILOT,count:1},item(2,300),item(1,5000)],
]);
const previousRepeat=freezeWeek([[item(1,5000)],[item(10010007,50)],[item(2,100)],[item(10010008,50)],[item(1,5000)],[item(10010007,50)],[item(2,200),item(10010008,50)]]);
const replacements={111:112,110:113,151:112,153:10010007,129:10010007,3132505:934};
function validateDay(day){if(!Number.isSafeInteger(day)||day<1||day>SIGNIN_LAST_DAY)throw Error('签到天数无效');}
export function capturedSigninRewards(day){
 validateDay(day);const group=captured.rows.find(row=>day>=row.rangeStart&&day<=row.rangeEnd);
 if(!group)throw Error('历史签到天数无效');
 return group.days[(day-1)%7].map(([id,count])=>({kind:id===SIGNIN_PLANE?'skins':'item',id,count}));
}
export function signinRewards(day){return capturedSigninRewards(day).map(row=>({...row,id:replacements[row.id]??row.id}));}
export const FLIGHT_SIGNIN=freezeWeek(Array.from({length:7},(_,i)=>signinRewards(i+1)));
export function previousAircraftSigninRewards(day){validateDay(day);return structuredClone((day<=7?previousWeek:previousRepeat)[(day-1)%7]);}
export function previousSigninRewards(day){return day===2?[item(1,3000)]:previousAircraftSigninRewards(day);}
export const LEGACY_FLIGHT_SIGNIN=freezeWeek([
 [item(2,100),item(1,1000)],[{kind:'skins',id:STARTER_PLANE,count:1}],
 [item(2,150)],[item(1,3000),item(106,10),item(109,10)],
 [item(2,200)],[item(105,10),item(107,10),item(108,10)],
 [item(2,300),item(1,5000),{kind:'pilots',id:STARTER_PILOT,count:1}],
]);
