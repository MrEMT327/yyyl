import { GEAR_PARTS } from '../peripheral/equipment-system.js';
import { flightRewardView } from './flight-rewards.js';
const nonnegative=value=>Number.isSafeInteger(value)&&value>=0?value:0;
// Local claim reward adaptation, not a recovered native server reward table.
// User approved equal-count equipment sheets in place of retired fragments.
export function equipmentRewards(raw) {
  const reward={...raw},count=nonnegative(raw.weaponParts)+nonnegative(raw.aircraftShards);
  delete reward.weaponParts;delete reward.aircraftShards;
  GEAR_PARTS.forEach((part,index)=>{
    const amount=Math.floor(count/GEAR_PARTS.length)+(index<count%GEAR_PARTS.length?1:0);
    if(amount)reward[`blueprint${part.type}`]=(reward[`blueprint${part.type}`]||0)+amount;
  });
  return reward;
}
const resourceIds={coins:1,diamonds:2,...Object.fromEntries(GEAR_PARTS.map(part=>[`blueprint${part.type}`,part.blueprintId]))};
export function nativeResourceRewards(reward) {
  return Object.entries(reward).map(([key,count])=>{
    if(!resourceIds[key])throw Error('奖励尚未接入当前库存：'+key);
    return flightRewardView({kind:'item',id:resourceIds[key],count});
  });
}
