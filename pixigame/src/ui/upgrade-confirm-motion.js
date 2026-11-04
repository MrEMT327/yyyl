import {UPGRADE_SELECTION_TIMING as BEAT} from './upgrade-selection-timing.js';
import {NATIVE_BREAKTHROUGH_MOTION as NATIVE,sampleNativeTrack,sampleNativeShow} from './breakthrough-native-motion.js';
import {upgradeMoveProgress,samplePresentedShow,UPGRADE_TRANSITION} from './upgrade-transition-motion.js';
const clamp=n=>Math.max(0,Math.min(1,n)),range=(t,a,b)=>clamp((t-a)/Math.max(1,b-a));
const smooth=t=>t*t*(3-2*t),blend=(a,b,t)=>a+(b-a)*t;
export function upgradeConfirmationTiming(skill,profile,nativeTiming,reducedMotion){
  const breakthrough=Boolean(nativeTiming&&skill?.opensBreakthrough);
  const duration=nativeTiming?(breakthrough?BEAT.breakthroughCommit:BEAT.normalCommit):reducedMotion?120:profile.duration;
  return {duration,visualDuration:breakthrough&&!reducedMotion?BEAT.finish:duration,
    breakthrough,reducedMotion,burst:breakthrough||Boolean(profile.stage),tier:skill?.star>=9?'c':skill?.star>=6?'r':'y'};
}
export function upgradeConfirmationPose(elapsed,timing){
  const {duration,visualDuration=duration,breakthrough,reducedMotion,burst}=timing,age=Math.max(0,elapsed),t=range(age,0,duration);
  const peers=1-smooth(range(age,20,Math.min(160,duration*.55))),extras=1-smooth(range(age,80,Math.min(240,duration*.7)));
  const levelGlow=smooth(range(age,0,35))*(1-smooth(range(age,180,340))),pulse=Math.sin(Math.PI*range(age,0,200));
  if(breakthrough&&!reducedMotion){
    const gather=upgradeMoveProgress(age),seconds=(age-BEAT.reveal)/1000;
    const baseWidth=timing.cardWidth??179.2,baseHeight=timing.cardHeight??(606*1300/1624),unit=baseWidth/328;
    const press=sampleNativeTrack(NATIVE.press.rootMotion.scaleX,Math.min(age/1000,NATIVE.press.duration),NATIVE.press.duration);
    const pressEnd=sampleNativeTrack(NATIVE.pressEnd.rootMotion.scaleX,0,NATIVE.pressEnd.duration);
    const scale=age<UPGRADE_TRANSITION.moveStart?press:blend(sampleNativeTrack(NATIVE.press.rootMotion.scaleX,UPGRADE_TRANSITION.moveStart/1000,NATIVE.press.duration),1.2,gather);
    const show=seconds>=0?samplePresentedShow(seconds,timing.tier):null,visible=!show||show.contentVisible;
    return {scale,scaleX:scale*(1+(show?.deltaWidth??0)*unit/baseWidth),scaleY:scale*(1+(show?.deltaHeight??0)*unit/baseHeight),
      shakeX:(show?.x??0)*unit*scale,shakeY:-(show?.y??0)*unit*scale,
      alpha:visible?(show?.alpha??1):0,lift:0,gather,otherAlpha:peers,otherOffset:10*(1-peers),extrasAlpha:extras,
      levelScale:1+.18*pulse,levelGlow,glow:visible?.65*(show?.alpha??1):0,sweep:range(age,420,720),sweepAlpha:0,
      expansion:0,burstAlpha:0,commitDue:age>=duration,done:age>=visualDuration};
  }
  const exit=smooth(range(age,duration*(breakthrough?.92:.7),duration)),pressTime=t*400;
  const press=pressTime<55?blend(1,.982,smooth(range(pressTime,0,55))):pressTime<150?blend(.982,1.035,1-(1-range(pressTime,55,150))**3):blend(1.035,1.008,smooth(range(pressTime,150,250)));
  const impact=Math.sin(Math.PI*range(age,0,duration*.85)),sweep=range(age,duration*.12,duration*.75),expansion=range(age,duration*.28,duration*.88);
  const scale=reducedMotion?1:blend(press,.97,exit);
  return {scale,scaleX:scale,scaleY:scale,shakeX:0,shakeY:0,alpha:1-exit,lift:reducedMotion?0:-10*exit,gather:0,
    otherAlpha:peers,otherOffset:reducedMotion?0:10*(1-peers),extrasAlpha:extras,
    levelScale:reducedMotion?1:1+.075*pulse,levelGlow,glow:(.24+.65*impact)*(1-exit),sweep,sweepAlpha:reducedMotion?0:.85*Math.sin(Math.PI*sweep)*(1-exit),
    expansion,burstAlpha:burst&&!reducedMotion?.3*Math.sin(Math.PI*expansion)*(1-exit):0,commitDue:age>=duration,done:age>=visualDuration};
}
