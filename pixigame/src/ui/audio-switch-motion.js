const transitions=new WeakMap();
export const AUDIO_SWITCH_DURATION=180;
export function audioSwitchPosition(owner,key,enabled,now=performance.now()) {
  const transition=transitions.get(owner)?.get(key);
  if(!transition||transition.enabled!==enabled)return enabled?1:0;
  const t=Math.max(0,Math.min(1,(now-transition.started)/AUDIO_SWITCH_DURATION));
  const value=transition.from+((enabled?1:0)-transition.from)*(1-(1-t)**3);
  if(t===1)transitions.get(owner).delete(key);
  return value;
}
export function beginAudioSwitch(owner,key,before,after,now=performance.now()) {
  const from=audioSwitchPosition(owner,key,before,now);
  if(!transitions.has(owner))transitions.set(owner,new Map());
  transitions.get(owner).set(key,{from,enabled:after,started:now});
}
