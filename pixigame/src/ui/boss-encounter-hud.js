import {drawNineSlice} from './canvas-surface.js';
import {COMBAT_TYPE} from './combat-theme.js';
import {createTextureCanvas} from './three-surface.js';
import {releaseOwnedCanvas} from './release-owned-canvas.js';
import {prepareEnemyHealthIcon} from './enemy-health-icon.js';

export const BOSS_BAR = Object.freeze({x:92,y:154,width:622,height:34});
export const BOSS_WARNING_LAYER = Object.freeze({y:565,height:268});
const BOSS_ICON_SIZE = 48;
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
  const enterSeconds=.22,settleSeconds=.16;
  const enter=smooth(t/enterSeconds);
  const scale=reducedMotion||t>=enterSeconds+settleSeconds
    ? 1 : 1+.04*(enter-smooth((t-enterSeconds)/settleSeconds));
  return {type:warning.type,title:warning.type===2?'首领来袭':'强敌来袭',elapsed:t,
    alpha:enter*fade,offsetY:reducedMotion?0:-8*(1-enter),scale};
}

export function prepareBossHealthIcon(image){
  const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
  const icon=createTextureCanvas(),source=prepareEnemyHealthIcon(image);
  const scale=BOSS_ICON_SIZE/Math.max(width,height);
  icon.width=Math.max(1,Math.round(width*scale));icon.height=Math.max(1,Math.round(height*scale));
  const out=icon.getContext('2d');
  try{
    if('imageSmoothingQuality' in out)out.imageSmoothingQuality='high';
    out.drawImage(source,0,0,icon.width,icon.height);
  }catch{
    out.drawImage(image,0,0,icon.width,icon.height);
  }finally{if(source!==image)releaseOwnedCanvas(source);}
  return icon;
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

export function drawBossHealthBar(ctx,boss,health,images,motion,offsetX=0,offsetY=0) {
  const {x,y,width:w,height:h}=BOSS_BAR,innerW=w-8;
  const shiftX=offsetX+(motion?.active?motion.x*w:0),shiftY=offsetY+(motion?.active?motion.y*w:0);
  ctx.save();
  if(shiftX||shiftY)ctx.translate(shiftX,shiftY);
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
  let name=String(boss.visualSpec?.name||boss.config?.title||boss.config?.name||'旗舰');
  ctx.font=`800 23px ${COMBAT_TYPE.family}`;
  while(name.length>1&&ctx.measureText(name).width>w-130)name=name.slice(0,-2)+'…';
  label(ctx,name,Math.max(148,x+12),y-28,23);
  label(ctx,`${Math.ceil(health.ratio*100)}%`,x+w-4,y-28,22,'right','#ffc0b4');
  ctx.restore();
  const icon=images.get('boss-health-icon');
  if(icon){
    const left=x-56+(BOSS_ICON_SIZE-icon.width)/2+shiftX+(motion?.iconX??0)*w;
    const top=y+(h-icon.height)/2+shiftY+(motion?.iconY??0)*w;
    ctx.drawImage(icon,Math.round(left),Math.round(top));
  }
}
