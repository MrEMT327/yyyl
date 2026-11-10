const base=import.meta.env?.BASE_URL??'/';
export const taskChestArt=(period,claimed=false)=>period==='weekly'
  ? `${base}art/project-weekly-chest-v5/${claimed?'open':'closed'}.png`
  : `${base}art/project-task-icons-v1/chest-${claimed?'open':'closed'}.png`;

// Preview and claim must read the same current milestone, never a second prize table.
export function taskChestModel(snapshot,period,id) {
  if(!['daily','weekly'].includes(period))return null;
  const supply=snapshot.pilotSupply;
  const activity=supply?(period==='weekly'?supply.week:supply.activity):snapshot.activity?.[period];
  const row=supply
    ? activity?.milestones?.find(row=>String(row.step)===String(id))
    : activity?.items?.find(row=>String(row.id)===String(id));
  if(!row)return null;
  const step=supply?row.step:row.points;
  const claimed=Boolean(row.claimed),pending=Boolean(snapshot.rewardPending||row.pending),busy=Boolean(snapshot.rewardBusy);
  const canClaim=!claimed&&!pending&&!busy&&Boolean(supply?row.canClaim:row.claimable);
  const raw=supply?row.rewards:row.reward;
  const resources={coins:[1,'金币'],diamonds:[2,'钻石'],weaponParts:[null,'强化零件'],aircraftShards:[null,'飞机碎片'],stamina:[null,'体力']};
  const rewards=Array.isArray(raw)?raw.map(item=>({...item,amount:item.amount??item.count}))
    :Object.entries(raw||{}).filter(([,amount])=>amount>0).map(([type,amount])=>({type,amount,nativeItemId:resources[type]?.[0],name:resources[type]?.[1]||type}));
  return {period,id,step,claimed,canClaim,pending,busy,rewards,
    points:Number(activity.points??(activity.days||0)*20)||0,
    status:claimed?'已领取':pending?'待恢复':busy?'处理中':canClaim?'可领取':'未达成',
    claim:supply?{action:'pilotSupply',payload:{action:period==='weekly'?'weekly':'activity',id:Number(id),expectedRevision:supply.revision}}
      :{action:'claimActivity',payload:{id,period}},
  };
}
