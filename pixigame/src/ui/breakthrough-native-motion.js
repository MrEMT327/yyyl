import profile from './breakthrough-native-motion.json';
export const NATIVE_BREAKTHROUGH_MOTION=profile;
export function sampleNativeTrack(track,time,duration=Infinity){
  if(track.source==='m_ConstantClip')return track.value;
  const t=Math.fround(Math.max(0,Math.min(duration,time))),keys=track.keys;
  let lo=0,hi=keys.length;
  while(lo<hi){const mid=(lo+hi)>>>1;if(keys[mid].time<=t)lo=mid+1;else hi=mid;}
  if(!lo)return track.initialValue;
  const key=keys[lo-1],dt=Math.max(0,t-key.time),[a,b,c,d]=key.coefficients;
  return ((a*dt+b)*dt+c)*dt+d;
}
export function sampleNativeShow(time,tier='y'){
  const clip=profile.shows[({y:'gold',r:'red',c:'rainbow'})[tier]||'gold'];
  const s=track=>sampleNativeTrack(track,time,clip.duration),m=clip.rootMotion;
  return {x:s(m.anchoredPositionX),y:s(m.anchoredPositionY),deltaWidth:s(m.sizeDeltaX),deltaHeight:s(m.sizeDeltaY),
    contentVisible:time<clip.duration&&s(clip.contentVisibility.GameObject)>=.5,
    iconVisible:time<clip.duration&&s(clip.contentVisibility.Root)>=.5};
}
