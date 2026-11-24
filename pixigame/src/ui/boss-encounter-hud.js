import {drawNineSlice} from './canvas-surface.js';
import {COMBAT_TYPE} from './combat-theme.js';

export const BOSS_BAR = Object.freeze({x:92,y:154,width:622,height:34});
export const BOSS_WARNING_LAYER = Object.freeze({y:565,width:696,height:268});
const ELITE_WARNING = {accent:'#ff785e',edge:'#b7564b',fill:'#8b332c',deep:'#431b24'};
const BOSS_WARNING = {accent:'#ff6481',edge:'#ba4c68',fill:'#892942',deep:'#401725'};
const clamp=value=>Math.max(0,Math.min(1,value));
const smooth=value=>{const t=clamp(value);return t*t*(3-2*t);};

// Keep the presentation object stable so sustained hits cannot reset its trail.
export function syncBossHud(previous, enemy) {
  if(!enemy||enemy.dead||!(enemy.hp>0))return null;
  const key=enemy.uid??enemy;
  const view=previous?._key===key?previous:{_key:key};
  view.hp=enemy.hp;view.maxHp=enemy.maxHp;
  view.visualSpec={name:enemy.name||enemy.config?.title||enemy.config?.name||'旗舰'};
  return view;
}

// The native warning clock owns advancement and completion. This function
// samples a read-only view; it never advances a wave or runs a separate timer.
export function bossWarningFrame(warning, reducedMotion=false) {
  if(!warning||![2,5].includes(warning.type))return null;
  const t=Number(warning.elapsed),duration=Number(warning.duration)||3;
  if(!Number.isFinite(t)||t<0||t>=duration)return null;
  const fade=clamp((duration-t)/Math.min(.23333335,duration));
  const enter=smooth(t/.22);
  return {type:warning.type,title:warning.type===2?'首领来袭':'强敌来袭',elapsed:t,
    alpha:enter*fade,offsetY:reducedMotion?0:-8*(1-enter),
    sweep:reducedMotion?1:clamp((t-.18)/.72)};
}

function label(ctx,value,x,y,size,align='left',color='#edf6fb') {
  ctx.font=`800 ${size}px ${COMBAT_TYPE.family}`;ctx.textAlign=align;
  ctx.textBaseline='top';ctx.fillStyle=color;ctx.fillText(value,x,y);
}
function polygon(ctx,points) {
  ctx.beginPath();ctx.moveTo(points[0],points[1]);
  for(let i=2;i<points.length;i+=2)ctx.lineTo(points[i],points[i+1]);
  ctx.closePath();
}

export function drawBossHealthBar(ctx,boss,health,images,motion) {
  const {x,y,width:w,height:h}=BOSS_BAR,innerW=w-8;
  ctx.save();
  if(motion?.active)ctx.translate(motion.x*w,motion.y*w);
  const frame=images.get('health-track');
  if(frame)drawNineSlice(ctx,frame,x,y,w,h,[8,24,8,24]);
  polygon(ctx,[x+5,y+4,x+w-5,y+4,x+w-13,y+h-5,x+13,y+h-5]);
  ctx.save();ctx.clip();ctx.fillStyle='#17232d';ctx.fillRect(x,y,w,h);
  ctx.fillStyle='#dfad8c';ctx.fillRect(x+4,y+4,innerW*health.trail,h-8);
  ctx.save();ctx.beginPath();ctx.rect(x+4,y+4,innerW*(health.bar??health.ratio),h-8);ctx.clip();
  const fill=images.get('boss-health-fill');
  if(fill)drawNineSlice(ctx,fill,x+3,y+3,w-6,h-6,[8,24,8,24]);
  else {ctx.fillStyle='#c65353';ctx.fillRect(x,y,w,h);}
  ctx.restore();ctx.restore();
  const icon=images.get('encounter-boss');
  if(icon)ctx.drawImage(icon,x-56+(motion?.iconX??0)*w,y+(h-48)/2+(motion?.iconY??0)*w,48,48);
  let name=String(boss.visualSpec?.name||boss.config?.title||boss.config?.name||'旗舰');
  ctx.font=`800 23px ${COMBAT_TYPE.family}`;
  while(name.length>1&&ctx.measureText(name).width>w-130)name=name.slice(0,-2)+'…';
  label(ctx,name,Math.max(148,x+12),y-28,23);
  label(ctx,`${Math.ceil(health.ratio*100)}%`,x+w-4,y-28,22,'right','#ffc0b4');
  ctx.restore();
}

function drawWarningBadge(ctx,x,y,icon,{accent,edge,deep}) {
  ctx.save();
  ctx.translate(x,y);
  const badge=ctx.createLinearGradient(0,-63,0,63);
  badge.addColorStop(0,deep);badge.addColorStop(1,'#200e1b');
  ctx.beginPath();ctx.arc(0,0,63,0,Math.PI*2);
  ctx.fillStyle=badge;ctx.fill();
  ctx.lineWidth=2;ctx.strokeStyle=edge;ctx.stroke();
  ctx.beginPath();ctx.arc(0,0,70,-2.65,-.49);
  ctx.lineWidth=4;ctx.strokeStyle=accent;ctx.stroke();
  const width=icon?.naturalWidth||icon?.width,height=icon?.naturalHeight||icon?.height;
  if(width>0&&height>0){
    const scale=92/Math.max(width,height),w=width*scale,h=height*scale;
    ctx.drawImage(icon,-w/2,-h/2,w,h);
  }else{
    label(ctx,'!',0,-35,60,'center','#fff2e7');
  }
  ctx.restore();
}

export function drawBossWarning(ctx,view,icon) {
  if(!view||view.alpha<=0)return;
  const palette=view.type===2?BOSS_WARNING:ELITE_WARNING;
  const {accent,edge,fill,deep}=palette;
  const x=24,y=130,w=BOSS_WARNING_LAYER.width-2*x,h=114,center=x+w/2;
  ctx.save();ctx.translate(0,view.offsetY);ctx.globalAlpha*=view.alpha;
  polygon(ctx,[x+21,y,x+w,y,x+w,y+h-21,x+w-21,y+h,x,y+h,x,y+21]);
  const panel=ctx.createLinearGradient(x,0,x+w,0);
  panel.addColorStop(0,deep);panel.addColorStop(.5,fill);panel.addColorStop(1,deep);
  ctx.fillStyle=panel;ctx.fill();
  ctx.strokeStyle=edge;ctx.lineWidth=2;ctx.stroke();
  for(const start of [x+34,x+w-100]){
    ctx.fillStyle=edge;ctx.fillRect(start,y+58,66,2);
    ctx.fillStyle=accent;
    for(let i=0;i<3;i++)ctx.fillRect(start+21+i*10,y+54,4,10);
  }
  const railX=x+24,railY=y+h-9,railWidth=w-48;
  ctx.fillStyle=edge;ctx.fillRect(railX,railY,railWidth,2);
  if(view.sweep>0&&view.sweep<1){
    const flareWidth=76,start=railX+(railWidth-flareWidth)*view.sweep;
    const flare=ctx.createLinearGradient(start,0,start+flareWidth,0);
    flare.addColorStop(0,accent+'00');flare.addColorStop(.7,accent);flare.addColorStop(1,accent+'00');
    ctx.fillStyle=flare;ctx.fillRect(start,railY-1,flareWidth,4);
  }
  drawWarningBadge(ctx,center,83,icon,palette);
  ctx.font=`900 50px ${COMBAT_TYPE.family}`;
  ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
  ctx.strokeStyle='#390f1b';ctx.lineWidth=5;ctx.strokeText(view.title,center,y+60);
  ctx.fillStyle='#fff4ed';ctx.fillText(view.title,center,y+60);
  ctx.restore();
}
