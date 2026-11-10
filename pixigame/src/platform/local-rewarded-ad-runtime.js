/** Unintegrated builds grant through the existing reward service, without UI. */
export function playFreeRewardedAd() {
  return Promise.resolve({completed:true,status:'completed',free:true});
}

/** Desktop/local builds grant immediately. An integration-supplied
 * provider and the dedicated 4399 build retain their own completion contract.
 * Installed before main.js captures __THUNDER_RUNTIME_GLOBALS__.
 */
export function installLocalRewardedAd(scope=globalThis,mode='production',play=playFreeRewardedAd) {
  if(String(mode)==='4399')return false;
  const runtime=scope.__THUNDER_RUNTIME_GLOBALS__||{};
  if(typeof runtime.playRewardedAd==='function')return false;
  // Only the bundled development SDK is free. A platform SDK keeps its own
  // completion/error contract, including failures and interrupted playback.
  const CpSDK=runtime.CpSDK||scope.CpSDK;
  if(typeof CpSDK==='function'&&CpSDK.localDevelopment!==true)return false;
  scope.__THUNDER_RUNTIME_GLOBALS__={...runtime,playRewardedAd:play};
  return true;
}
