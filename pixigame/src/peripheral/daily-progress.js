// Local economy tuning. Layout comes from UI_Task; these are this game's rewards.
export const TASK_ACTIVITY = Object.freeze({
  login:20, sortie:20, victory:20, upgrade:20, recruit:20,
  'weekly-sorties':30, 'weekly-victories':40, 'weekly-upgrades':30,
});
export const TASK_DESTINATIONS = Object.freeze({
  login:'signin', sortie:'battle', victory:'battle', upgrade:'workshop', recruit:'supply',
  'weekly-sorties':'battle', 'weekly-victories':'battle', 'weekly-upgrades':'workshop',
});
const milestones = rewards => Object.freeze(rewards.map((reward,index)=>Object.freeze({
  id:String((index+1)*20), points:(index+1)*20, reward:Object.freeze(reward),
})));
export const ACTIVITY_REWARDS = Object.freeze({
  daily:milestones([{coins:100},{weaponParts:5},{coins:200,aircraftShards:3},{weaponParts:8},{diamonds:10}]),
  weekly:milestones([{coins:300},{weaponParts:10},{aircraftShards:8},{coins:500},{diamonds:30}]),
});
export const ACHIEVEMENT_CATEGORIES = Object.freeze([
  {id:'combat',name:'战斗'}, {id:'growth',name:'成长'}, {id:'collection',name:'收藏'},
]);
const track = (prefix,category,metric,targets,label,destination,rewards) => targets.map((target,i)=>Object.freeze({
  id:`${prefix}-${target}`, category, metric, target, name:label(target), destination,
  reward:Object.freeze(rewards[i]),
}));
export const ACHIEVEMENTS = Object.freeze([
  ...track('chapter','combat','chapter',[1,3,5,10],n=>`通关第 ${n} 章`,'battle',
    [{diamonds:5},{diamonds:10},{diamonds:20},{diamonds:30}]),
  ...track('stars','combat','stars',[3,15,30,60],n=>`主线累计获得 ${n} 星`,'chapters',
    [{weaponParts:5},{weaponParts:10},{weaponParts:20},{weaponParts:30}]),
  ...track('weapon-level','growth','weaponLevel',[10,30,50],n=>`任一武器达到 ${n} 级`,'workshop',
    [{coins:200},{coins:500},{coins:1000}]),
  ...track('aircraft-level','growth','aircraftLevel',[10,30,50],n=>`任一战机达到 ${n} 级`,'aircraft',
    [{aircraftShards:5},{aircraftShards:10},{aircraftShards:20}]),
  ...track('recruits','growth','recruits',[1,10,50],n=>`累计招募 ${n} 次`,'supply',
    [{coins:100},{weaponParts:10},{diamonds:20}]),
  ...track('weapons','collection','weapons',[3,10,20],n=>`拥有 ${n} 种通用武器`,'weapon',
    [{weaponParts:5},{weaponParts:10},{diamonds:20}]),
  ...track('aircraft','collection','aircraft',[2,5,10],n=>`拥有 ${n} 架战机`,'aircraft',
    [{aircraftShards:5},{aircraftShards:10},{diamonds:20}]),
]);
const int = value => Math.max(0,Math.floor(Number(value)||0));

export function activitySnapshot(period,tasks,state={}) {
  const points=tasks.filter(t=>t.type===period && t.progress>=t.target)
    .reduce((sum,t)=>sum+(TASK_ACTIVITY[t.id]||0),0);
  const claimed=state.activityClaimed||[];
  return {points,max:100,items:ACTIVITY_REWARDS[period].map(row=>({...row,
    claimed:claimed.includes(row.id),claimable:!claimed.includes(row.id)&&points>=row.points,
  }))};
}

// Recover only facts present in the existing stores; never guess missing history.
export function achievementMetrics({campaign={},stages=[],collection={},aircraft={},ownedAircraft=[],pilotPulls=0}) {
  let chapter=0,stars=0;
  stages.forEach((stage,index)=>{
    const result=campaign.results?.[`${stage.id}:easy`];
    if(result?.cleared || result?.stars>0) {chapter=index+1;stars+=Math.min(3,int(result.stars));}
  });
  const weapons=Object.values(collection.weaponProgress?.weapons||{}).filter(w=>w.unlocked);
  return {chapter,stars,weapons:weapons.length,
    weaponLevel:Math.max(0,...weapons.map(w=>int(w.level))),
    aircraftLevel:Math.max(0,...ownedAircraft.map(id=>int(aircraft[id]?.level))),
    aircraft:new Set(ownedAircraft).size,
    recruits:int(pilotPulls)+int(collection.pools?.weapon_permanent?.totalPulls),
  };
}

export function achievementSnapshot(state={},metrics={}) {
  const claimed=state.claimed||[];
  return {categories:ACHIEVEMENT_CATEGORIES,items:ACHIEVEMENTS.map(row=>({...row,
    progress:Math.min(row.target,int(metrics[row.metric])),claimed:claimed.includes(row.id),
    claimable:!claimed.includes(row.id)&&int(metrics[row.metric])>=row.target,
  }))};
}
