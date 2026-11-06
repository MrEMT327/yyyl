import { Graphics, Text } from '../three/display.js';
import { COMBAT_UI,COMBAT_TYPE } from './combat-theme.js';
import {upgradeFeedbackProfile} from './upgrade-feedback-profile.js';
import { XP_PRESENTATION } from '../experience-presentation.js';
import { upgradeConfirmationTiming, upgradeConfirmationPose } from './upgrade-confirm-motion.js';
import {createUpgradeSelectionParticles} from './upgrade-selection-particles.js';
import {UPGRADE_SELECTION_TIMING as SELECTION_BEAT} from './upgrade-selection-timing.js';
import {UPGRADE_TRANSITION,upgradeOfferKey} from './upgrade-transition-motion.js';
let levelLight = { until: 0, started: 0, milestone: false };
let upgradeLight=null;
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export function showRunLevelFeedback(previous, level) {
  if (level <= previous) return;
  const milestone = Math.floor(level / 5) > Math.floor(previous / 5), started = performance.now();
  levelLight = { started, until: started + (milestone ? 1050 : 650), milestone };
}
export function showWeaponUpgradeFeedback(skill){
  const profile=upgradeFeedbackProfile(skill),name=String(skill.ownerName||skill.name||'武装').split(' · ').at(-1);
  upgradeLight={...profile,name,started:performance.now()};
}
// UI time keeps these local highlights moving while the battle is paused.
export function updateGrowthHud(refs, now) {
  if(upgradeLight&&refs.xpBar?.parent){
    if(!refs.upgradeReceipt||refs.upgradeReceipt.destroyed){
      const label=new Text({text:'',style:{fontFamily:COMBAT_TYPE.family,fontSize:18,fontWeight:'800',fill:COMBAT_UI.text}});
      label.eventMode='none';refs.xpBar.parent.addChild(label);refs.upgradeReceipt=label;
    }
    const receipt=refs.upgradeReceipt,age=now-upgradeLight.started;
    receipt.visible=age>=0&&age<upgradeLight.lifetime;
    if(receipt.visible){
      receipt.text=`${upgradeLight.label} · ${upgradeLight.name}`;receipt.style.fill=upgradeLight.color;
      receipt.position.set(16,(refs.levelY??1146)-34);
      receipt.scale.set(Math.min(1,540/Math.max(1,receipt.width)));
      receipt.alpha=reducedMotion()?1:Math.min(1,age/100,(upgradeLight.lifetime-age)/220);
    }
  }
  const remaining = levelLight.until - now;
  if (refs.level) refs.level.scale.set(remaining > 0 && !reducedMotion() ? 1 + .13 * Math.sin(Math.min(1, (now-levelLight.started)/350)*Math.PI) : 1);
  if (!refs.xpBar?.parent) return;
  if (!refs.growthLight || refs.growthLight.destroyed) {
    refs.growthLight = new Graphics(); refs.growthLight.eventMode = 'none';
    refs.xpBar.parent.addChild(refs.growthLight);
  }
  const light = refs.growthLight.clear();
  if (remaining <= 0) return;
  const color = levelLight.milestone ? COMBAT_UI.gold : XP_PRESENTATION.fill, fade = Math.min(1, remaining / 250);
  const xpY = refs.xpY ?? 1170, levelY = refs.levelY ?? 1146;
  light.roundRect(11,xpY-2,578,9,4).stroke({color,width:2,alpha:.8*fade});
  light.roundRect(11,levelY-4,134,34,4).stroke({color,width:2,alpha:.8*fade});
  if (!reducedMotion()) {
    const progress = Math.min(1,(now-levelLight.started)/550);
    light.roundRect(12+520*progress,xpY,56,5,2).fill({color:0xffffff,alpha:.85*fade});
  }
}
export function confirmUpgradeCard(card, width, height, commit, valid, skill, options = {}) {
  card.__upgradeConfirmCancel?.();
  const profile=upgradeFeedbackProfile(skill),reduced=reducedMotion();
  const timing=upgradeConfirmationTiming(skill,profile,Boolean(options.nativeTiming),reduced);
  timing.cardWidth=width;timing.cardHeight=height;
  const color=timing.breakthrough?({y:0xffcd76,r:0xffa47e,c:0xb6c6ff}[timing.tier]):profile.color;
  const light=new Graphics();light.eventMode='none';card.addChild(light);
  const peers=card.parent.children.filter(node=>node!==card);
  const saved=[card,...peers].map(node=>({node,x:node.x,y:node.y,alpha:node.alpha,scaleX:node.scale.x,scaleY:node.scale.y}));
  for(const {node}of saved)node.__entryCancelled=true;
  const particles=!timing.breakthrough&&!reduced?createUpgradeSelectionParticles(card,width,height,color):null;
  const original=saved[0],focus=card.__upgradeConfirmFocus||{x:300,y:650};
  const level=card.__upgradeLevelLabel,levelState=level&&{x:level.x,y:level.y,scaleX:level.scale.x,scaleY:level.scale.y,tint:level.tint??0xffffff};
  const owner=timing.breakthrough?options.selectionLayer:null;
  const start=Number.isFinite(options.startedAt)?options.startedAt:performance.now();let request=0,finished=false,committed=false,owned=false;
  function restoreLevel(){if(levelState&&!level.destroyed){level.position.set(levelState.x,levelState.y);level.scale.set(levelState.scaleX,levelState.scaleY);level.tint=levelState.tint;}}
  function cleanup(){
    cancelAnimationFrame(request);particles?.destroy();restoreLevel();if(!light.destroyed)light.destroy();
    if(card.__upgradeConfirmCancel===cancel)delete card.__upgradeConfirmCancel;
    if(owned)owner.release(card);
  }
  function cancel(){
    if(finished)return;finished=true;
    for(const state of saved)if(!state.node.destroyed&&(!owned||state.node!==card)){
      state.node.position.set(state.x,state.y);state.node.scale.set(state.scaleX,state.scaleY);state.node.alpha=state.alpha;
    }
    cleanup();
  }
  card.__upgradeConfirmCancel=cancel;
  if(owner){const point=owner.claim(card,cancel,{offerKey:upgradeOfferKey(options.offer),runId:options.offer?.runId,revealAt:reduced?0:start+SELECTION_BEAT.hide+UPGRADE_TRANSITION.nextDelay});if(!point){cancel();return cancel;}owned=true;original.x=point.x;original.y=point.y;}
  const blendTint=(from,to,weight)=>[16,8,0].reduce((value,shift)=>value|(Math.round(((from>>shift)&255)*(1-weight)+((to>>shift)&255)*weight)<<shift),0);
  function frame(now){
    if(finished)return;
    if(card.destroyed||!card.parent||!valid()){cancel();return;}
    const pose=upgradeConfirmationPose(now-start,timing);
    for(const state of saved.slice(1))if(!state.node.destroyed){
      const isCard=Boolean(state.node.__fixedCardId);state.node.alpha=state.alpha*(isCard?pose.otherAlpha:pose.extrasAlpha);
      if(isCard)state.node.y=state.y+pose.otherOffset;
    }
    card.scale.set(original.scaleX*pose.scaleX,original.scaleY*pose.scaleY);
    card.x=original.x-width*original.scaleX*(pose.scaleX-1)/2+(focus.x-original.x-width*original.scaleX/2)*pose.gather+pose.shakeX;
    card.y=original.y-height*original.scaleY*(pose.scaleY-1)/2+pose.lift+(focus.y-original.y-height*original.scaleY/2)*pose.gather+pose.shakeY;
    card.alpha=pose.alpha;
    particles?.update(now-start);
    if(levelState&&!level.destroyed){level.scale.set(levelState.scaleX*pose.levelScale,levelState.scaleY*pose.levelScale);level.tint=blendTint(levelState.tint,color,pose.levelGlow*.6);}
    const target=card.__upgradeConfirmRect||{x:3,y:3,width:width-6,height:height-6};
    const {x,y,width:w,height:h}=target,cut=8;
    const outline=()=>light.moveTo(x+cut,y).lineTo(x+w-cut,y).lineTo(x+w,y+cut).lineTo(x+w,y+h-cut).lineTo(x+w-cut,y+h).lineTo(x+cut,y+h).lineTo(x,y+h-cut).lineTo(x,y+cut).closePath();
    light.clear();outline().stroke({color,width:6,alpha:pose.glow*.18});outline().stroke({color,width:1.8,alpha:pose.glow});
    if(levelState&&pose.levelGlow>0){const half=Math.min(width*.23,40);light.moveTo(width/2-half,levelState.y+26).lineTo(width/2+half,levelState.y+26).stroke({color,width:1.5,alpha:pose.levelGlow*.4});}
    if(pose.sweepAlpha>0){const head=x+cut+(w-cut*2-24)*pose.sweep;light.moveTo(head,y+1).lineTo(head+24,y+1).stroke({color:0xf5fcff,width:3,alpha:pose.sweepAlpha});}
    if(pose.burstAlpha>0&&!timing.breakthrough){const radius=Math.min(width*.42,78)*(.65+pose.expansion*.6);light.circle(width/2,Math.min(166,height*.4),radius).stroke({color,width:2,alpha:pose.burstAlpha});}
    if(pose.done){finished=true;cleanup();if(!committed){committed=true;commit();}return;}
    if(pose.commitDue&&!committed){committed=true;commit();if(finished||card.destroyed)return;}
    request=requestAnimationFrame(frame);
  }
  frame(performance.now());return cancel;
}
