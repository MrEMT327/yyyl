import source from './native-patrol-source.json' with {type:'json'};
import channels from './native-resource-channels-source.json' with {type:'json'};
// These units/counts are explicit in GameConfig and Shop_AdInfo. This does
// not establish the server payout formula or turn FastGet=1 into two hours.
export const NATIVE_PATROL_RULES=Object.freeze({
 intervalSeconds:source.config.HangUpInterval.TypeInt,
 capSeconds:source.config.HangUpMaxTime.TypeInt,
 quickDailyCount:source.config.HangUpFastGetCount.TypeInt,
 quickStamina:source.config.HangUpFastGetCostVitality.TypeInt,
 quickAdDailyCount:channels.quickPatrolAd.count,
});
