import { Graphics, Text } from '../three/display.js';
import { COMBAT_UI,COMBAT_TYPE } from './combat-theme.js';
import {upgradeFeedbackProfile} from './upgrade-feedback-profile.js';
import { XP_PRESENTATION } from '../experience-presentation.js';
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
export function confirmUpgradeCard(card, width, height, commit, valid, skill) {
  card.__entryCancelled=true;card.alpha=1;
  const light = new Graphics(); light.eventMode = 'none'; card.addChild(light);
  const target = card.__upgradeConfirmRect || {x:12,y:height-52,width:width-24,height:38};
  const profile=upgradeFeedbackProfile(skill);
  const badge=new Text({text:profile.label,style:{fontFamily:COMBAT_TYPE.family,fontSize:21,fontWeight:'900',fill:profile.color}});
  badge.anchor.set(.5,0);badge.position.set(width/2,height-64);badge.eventMode='none';card.addChild(badge);
  const start = performance.now(), duration = reducedMotion() ? 120 : profile.duration;
  const siblings = card.parent.children.filter(n => n !== card && n.__fixedCardId);
  const originalY = card.y,originalX=card.x,originalScale=card.scale.x;
  function frame(now) {
    if (card.destroyed || !card.parent || !valid()) { if (!light.destroyed) light.destroy(); if(!badge.destroyed)badge.destroy(); return; }
    const t = Math.min(1,(now-start)/duration);
    if (!reducedMotion()) {
      const exit = Math.max(0,(t-.55)/.45),pop=1+(profile.stage?.045:.025)*Math.sin(Math.min(1,t/.55)*Math.PI);
      siblings.forEach(n => { if (!n.destroyed) n.alpha = 1-exit; });
      card.scale.set(originalScale*pop);card.x=originalX-width*originalScale*(pop-1)/2;
      card.y = originalY-height*originalScale*(pop-1)/2-12*exit;
      card.alpha = 1 - .75*exit;
    }
    light.clear().roundRect(2,2,width-4,height-4,8).stroke({color:profile.color,width:7,alpha:.22})
      .roundRect(3,3,width-6,height-6,7).stroke({color:profile.color,width:2.5,alpha:1})
      .roundRect(target.x,target.y,target.width,target.height,4).fill({color:0xffffff,alpha:.12*(1-t)})
      .roundRect(8,height-72,width-16,58,4).fill({color:COMBAT_UI.deep,alpha:.98});
    if (!reducedMotion()) light.roundRect(target.x+(target.width-20)*t,target.y+2,20,target.height-4,2).fill({color:0xffffff,alpha:.65*Math.sin(Math.PI*t)});
    if (t < 1) requestAnimationFrame(frame);
    else { light.destroy(); commit(); }
  }
  requestAnimationFrame(frame);
}
