import { playLocalRewardedAd } from '../ui/local-rewarded-ad.js';

/** Desktop/local builds use an explicit placeholder. An integration-supplied
 * provider and the dedicated 4399 build retain their own completion contract.
 * Installed before main.js captures __THUNDER_RUNTIME_GLOBALS__.
 */
export function installLocalRewardedAd(scope=globalThis,mode='production',play=playLocalRewardedAd) {
  if(String(mode)==='4399')return false;
  const runtime=scope.__THUNDER_RUNTIME_GLOBALS__||{};
  if(typeof runtime.playRewardedAd==='function')return false;
  scope.__THUNDER_RUNTIME_GLOBALS__={...runtime,playRewardedAd:play};
  return true;
}
