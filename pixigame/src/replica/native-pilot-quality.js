import {nativeItemDisplayQuality,rewardNativeItemId} from './item-display-quality.js';
import {isRosterPilot} from './native-pilot-roster.js';

// The character catalog's native quality is authoritative across all views.
const RARITY_BY_RANK=Object.freeze({2:'R',3:'SR',4:'SSR'});
export function nativePilotDisplayQuality(pilot={}) {
  const id=rewardNativeItemId({...pilot,type:'pilot'});
  const quality=isRosterPilot(id)?nativeItemDisplayQuality(id):null;
  const rarity=quality&&RARITY_BY_RANK[quality.qualityRank];
  return rarity?{...quality,rarity}:{qualityRank:null,qualityName:'未标注',qualityKnown:false,rarity:'未标注'};
}
