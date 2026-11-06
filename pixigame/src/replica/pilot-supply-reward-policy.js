// Captured 1.1.6 task objectives and activity rewards. Closed modes are not
// substituted with easier objectives. Collection/recruitment policy is separate.
import source from './native-recurring-task-source.json' with {type:'json'};
const freeze=rows=>Object.freeze(rows.map(row=>Object.freeze(row)));
const items=rows=>freeze(rows.map(([id,amount])=>({id,amount})));
const supported={
  20101:['login','login','signin'],20102:['battle1','battles','battle'],
  20106:['kills','enemyKills','battle'],20105:['upgrade','upgrades','equipment'],
  20108:['patrol','patrolClaims','patrol'],20107:['boxes','boxesOpened','boxes'],
  20110:['shop','shopPurchases','shop'],
  60101:['weekly-kills','enemyKills','battle'],60102:['weekly-bosses','bossKills','battle'],
  60103:['weekly-shop','shopPurchases','shop'],60105:['weekly-boxes','boxesOpened','boxes'],
  60106:['weekly-login','loginDays','signin'],60107:['weekly-stamina','staminaSpent','battle'],
};
const objectives=type=>freeze(source.tasks.filter(row=>row.Type===type&&supported[row.ID]).sort((a,b)=>a.Sort-b.Sort).map(row=>{
  const params=JSON.parse(row.ConditionParams),[id,counter,destination]=supported[row.ID];
  return {id,nativeId:row.ID,name:row.title.replace('{0}',params.Count),target:params.Count,counter,destination,points:row.RewardItem[0][1],rewards:items([]),...(id==='login'?{starter:40100}:{})};
}));
export const PILOT_DAILY_TASKS=objectives(2);
export const PILOT_WEEKLY_TASKS=objectives(6);
export const PILOT_TASK_POINTS=Object.freeze(Object.fromEntries(PILOT_DAILY_TASKS.map(row=>[row.id,row.points])));
export const PILOT_WEEKLY_TASK_POINTS=Object.freeze(Object.fromEntries(PILOT_WEEKLY_TASKS.map(row=>[row.id,row.points])));
export const PILOT_TASK_REWARDS=Object.freeze(Object.fromEntries(PILOT_DAILY_TASKS.map(row=>[row.id,row.rewards])));
export const PREVIOUS_PILOT_TASK_POINTS=Object.freeze({login:25,battle1:50,battle3:25,upgrade:25,recruit:20});
// The user approved replacing quantum/chip/drone rewards with live resources.
const replacement={111:112};
const activity=base=>Object.freeze(Object.fromEntries(source.milestones.filter(row=>row.ID>=base&&row.ID<=base+4).map(row=>[row.Score,items(row.Reward.map(([id,count])=>[replacement[id]??id,count]))])));
export const PILOT_ACTIVITY_REWARDS=Object.freeze({daily:activity(1001),weekly:activity(2001)});
export const PILOT_DAILY_ACTIVITY_REWARDS=PILOT_ACTIVITY_REWARDS.daily[100];
export const PILOT_WEEKLY_ACTIVITY_REWARDS=PILOT_ACTIVITY_REWARDS.weekly[100];
export const PILOT_AD_REWARDS=items([[1,1000]]);
export const MAXED_PILOT_FRAGMENT_DIAMONDS=2;
export const NATIVE_TASK_EXCLUSIONS=freeze(source.tasks.filter(row=>!supported[row.ID]).map(row=>({nativeId:row.ID,name:row.title,reason:'当前没有对应的充值、陨石轰炸或星空塔入口'})));
export function recurringProgressGate(campaign={},kind='tasks'){
 const {chapter,wave}=source.gates[kind];
 const reached=(campaign.clearedChapterIds||[]).some(id=>id>=chapter||(wave===0&&id>=chapter-1))
   ||Object.entries(campaign.passedWaves||{}).some(([id,count])=>count>0&&(Number(id)>chapter||Number(id)===chapter&&count>=wave));
 return {chapter,wave,reached,reason:wave?`到达第${chapter}章第${wave}波开启`:`到达第${chapter}章开启`};
}
