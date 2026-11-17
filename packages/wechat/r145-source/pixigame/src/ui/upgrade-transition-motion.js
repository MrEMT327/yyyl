import {UPGRADE_SELECTION_TIMING as BEAT} from './upgrade-selection-timing.js';
import {sampleNativeShow} from './breakthrough-native-motion.js';
const clamp=t=>Math.max(0,Math.min(1,t));
const smoother=t=>{t=clamp(t);return t*t*t*(t*(t*6-15)+10);};
export const UPGRADE_TRANSITION=Object.freeze({moveStart:220,showBlend:120,faceDissolve:90,nextDelay:24,effectTailFade:150,revealDuration:190,revealStagger:12});
export const upgradeOfferKey=offer=>offer?`${offer.runId}:${offer.offerId??''}:${offer.buildVersion??''}`:'';
export function upgradeMoveProgress(age){return smoother((age-UPGRADE_TRANSITION.moveStart)/(BEAT.reveal-UPGRADE_TRANSITION.moveStart));}
export function samplePresentedShow(seconds,tier='y'){
  const native=sampleNativeShow(seconds,tier),entry=smoother(seconds*1000/UPGRADE_TRANSITION.showBlend);
  // Filter only the high-frequency optical shake/stretch. The native clip still
  // owns visibility, the broad charging motion, tiers and selection event times.
  const samples=[[-.032,1],[-.016,2],[0,3],[.016,2],[.032,1]].map(([offset,weight])=>({pose:sampleNativeShow(Math.max(0,seconds+offset),tier),weight}));
  const filtered=key=>samples.reduce((sum,row)=>sum+row.pose[key]*row.weight,0)/9;
  const hide=(BEAT.hide-BEAT.reveal)/1000,exit=smoother((seconds-(hide-UPGRADE_TRANSITION.faceDissolve/1000))/(UPGRADE_TRANSITION.faceDissolve/1000));
  return {...native,x:filtered('x')*entry*.72,y:filtered('y')*entry*.8,deltaWidth:filtered('deltaWidth')*entry*.72,deltaHeight:filtered('deltaHeight')*entry*.8,
    alpha:native.contentVisible?1-exit:0};
}
export function choiceRevealPose(elapsed,index=0,handoff=false,reducedMotion=false){
  if(reducedMotion)return {alpha:1,scale:1,offsetY:0,done:true};
  if(!handoff){const t=clamp((elapsed-index*45)/170);return {alpha:.3+.7*t,scale:1,offsetY:0,done:t===1};}
  const t=clamp((elapsed-index*UPGRADE_TRANSITION.revealStagger)/UPGRADE_TRANSITION.revealDuration),ease=smoother(t);
  return {alpha:ease,scale:.976+.024*ease,offsetY:10*(1-ease),done:t===1};
}

export function upgradeEffectOpacity(seconds){const end=(BEAT.finish-BEAT.reveal)/1000;return 1-smoother((seconds-(end-UPGRADE_TRANSITION.effectTailFade/1000))/(UPGRADE_TRANSITION.effectTailFade/1000));}
