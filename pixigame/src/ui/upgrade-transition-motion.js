import {UPGRADE_SELECTION_TIMING as BEAT} from './upgrade-selection-timing.js';
import {sampleNativeShow} from './breakthrough-native-motion.js';
const clamp=t=>Math.max(0,Math.min(1,t));
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
export const UPGRADE_TRANSITION=Object.freeze({moveStart:220,showBlend:80,faceDissolve:24,nextDelay:24,effectTailFade:100,revealDuration:155,revealStagger:12});
export const upgradeOfferKey=offer=>offer?`${offer.runId}:${offer.offerId??''}:${offer.buildVersion??''}`:'';
export function upgradeMoveProgress(age){return smoother((age-UPGRADE_TRANSITION.moveStart)/(BEAT.reveal-UPGRADE_TRANSITION.moveStart));}
export function samplePresentedShow(seconds,tier='y'){
  const native=sampleNativeShow(seconds,tier),entry=smoother(seconds*1000/UPGRADE_TRANSITION.showBlend);
  const hide=(BEAT.hide-BEAT.reveal)/1000,exit=smoother((seconds-(hide-UPGRADE_TRANSITION.faceDissolve/1000))/(UPGRADE_TRANSITION.faceDissolve/1000));
  return {...native,x:native.x*entry,y:native.y*entry,deltaWidth:native.deltaWidth*entry,deltaHeight:native.deltaHeight*entry,
    alpha:native.contentVisible?1-exit:0};
}
export function choiceRevealPose(elapsed,index=0,handoff=false,reducedMotion=false){
  if(reducedMotion)return {alpha:1,scale:1,offsetY:0,done:true};
  if(!handoff){const t=clamp((elapsed-index*45)/170);return {alpha:.3+.7*t,scale:1,offsetY:0,done:t===1};}
  const t=clamp((elapsed-index*UPGRADE_TRANSITION.revealStagger)/UPGRADE_TRANSITION.revealDuration),ease=smoother(t);
  return {alpha:ease,scale:.976+.024*ease,offsetY:10*(1-ease),done:t===1};
}

export function upgradeEffectOpacity(seconds){const end=(BEAT.finish-BEAT.reveal)/1000;return 1-smoother((seconds-(end-UPGRADE_TRANSITION.effectTailFade/1000))/(UPGRADE_TRANSITION.effectTailFade/1000));}
