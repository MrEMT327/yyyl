import {drawNineSlice} from './canvas-surface.js';
import {COMBAT_TYPE} from './combat-theme.js';

export const BOSS_BAR = Object.freeze({x:92,y:154,width:622,height:34});
export const BOSS_WARNING_LAYER = Object.freeze({y:480,height:420});
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
  const enter=smooth(t/.25);
  return {type:warning.type,title:warning.type===2?'首领来袭':'强敌来袭',elapsed:t,
    alpha:clamp(t/.1)*fade,contentAlpha:smooth((t-.1)/.15)*fade,
    height:reducedMotion?144:26+118*enter,
    iconScale:reducedMotion?1:1+.12*Math.sin(Math.min(1,Math.max(0,(t-.1)/.32))*Math.PI),
    sweep:reducedMotion?0:(t*190)%900,
    stripePhase:reducedMotion?0:(t*48)%44,
    pulse:reducedMotion?1:.92+.08*Math.cos(t*Math.PI*2*1.25)};
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

export function drawBossHealthBar(ctx,boss,health,images) {
  const {x,y,width:w,height:h}=BOSS_BAR,innerW=w-8;
  ctx.save();
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
  if(icon)ctx.drawImage(icon,x-56,y+(h-48)/2,48,48);
  let name=String(boss.visualSpec?.name||boss.config?.title||boss.config?.name||'旗舰');
  ctx.font=`800 23px ${COMBAT_TYPE.family}`;
  while(name.length>1&&ctx.measureText(name).width>w-130)name=name.slice(0,-2)+'…';
  label(ctx,name,Math.max(148,x+12),y-28,23);
  label(ctx,`${Math.ceil(health.ratio*100)}%`,x+w-4,y-28,22,'right','#ffc0b4');
  ctx.restore();
}

const warningFrameArt = new WeakMap();
function redWarningFrame(image) {
  if(warningFrameArt.has(image))return warningFrameArt.get(image);
  const canvas=globalThis.wx?.createCanvas?.()||globalThis.document?.createElement('canvas');
  if(!canvas)return image;
  canvas.width=image.naturalWidth||image.width;canvas.height=image.naturalHeight||image.height;
  const context=canvas.getContext('2d');context.drawImage(image,0,0);
  const pixels=context.getImageData(0,0,canvas.width,canvas.height),data=pixels.data;
  // Retain the PSD's alpha, dark outlines and bevel highlights. Recolour once,
  // then use the same nine-slice geometry as the existing encounter frame.
  for(let i=0;i<data.length;i+=4){
    const light=(data[i]*.2126+data[i+1]*.7152+data[i+2]*.0722)/255;
    data[i]=Math.min(255,32+light*260);data[i+1]=8+light*light*180;data[i+2]=16+light*light*168;
  }
  context.putImageData(pixels,0,0);warningFrameArt.set(image,canvas);return canvas;
}

export function drawBossWarning(ctx,view,images) {
  if(!view)return;
  const centerY=278,top=centerY-view.height/2,boss=view.type===2;
  const red=boss?'#ff344b':'#ff493b',dark=boss?'#731322':'#791b1c';
  const pulse=view.pulse??1,stripePhase=view.stripePhase??0;
  ctx.save();ctx.globalAlpha=view.alpha;

  // A broad, quiet red spill separates this danger cue from the blue sea/map.
  const spill=ctx.createRadialGradient(375,centerY,70,375,centerY,405);
  spill.addColorStop(0,`rgba(255,32,54,${.24*pulse})`);spill.addColorStop(1,'rgba(255,24,42,0)');
  ctx.fillStyle=spill;ctx.fillRect(0,top-35,750,view.height+70);

  polygon(ctx,[10,top+14,24,top,726,top,740,top+14,740,top+view.height-14,726,top+view.height,24,top+view.height,10,top+view.height-14]);
  const bg=ctx.createLinearGradient(0,top,0,top+view.height);
  bg.addColorStop(0,dark);bg.addColorStop(.22,boss?'#bd2638':'#c4322b');
  bg.addColorStop(.55,boss?'#9c1c2d':'#a82525');bg.addColorStop(1,'#490d19');
  ctx.fillStyle=bg;ctx.fill();
  ctx.save();ctx.clip();

  // Sliding warning tape moves inside the supplied frame, never its corners.
  for(const y of [top+6,top+view.height-17]){
    ctx.fillStyle='#210b14';ctx.fillRect(20,y,710,11);
    ctx.save();ctx.beginPath();ctx.rect(24,y,702,11);ctx.clip();
    ctx.fillStyle=red;
    for(let x=-44+stripePhase;x<780;x+=44){polygon(ctx,[x,y,x+20,y,x+9,y+11,x-11,y+11]);ctx.fill();}
    ctx.restore();
  }
  const center=ctx.createLinearGradient(20,0,730,0);
  center.addColorStop(0,'rgba(23,4,12,0)');center.addColorStop(.22,'rgba(35,5,15,.35)');
  center.addColorStop(.5,'rgba(35,5,15,.53)');center.addColorStop(.78,'rgba(35,5,15,.35)');center.addColorStop(1,'rgba(23,4,12,0)');
  ctx.fillStyle=center;ctx.fillRect(16,centerY-33,718,67);
  ctx.fillStyle=`rgba(255,177,171,${.55+.2*pulse})`;ctx.fillRect(26,top+2,698,2);
  ctx.fillStyle=red;ctx.fillRect(26,top+view.height-4,698,2);
  ctx.restore();
  const frame=images.get('encounter-frame');
  if(frame)drawNineSlice(ctx,redWarningFrame(frame),10,top,730,view.height,[24,24,40,24],.86);

  ctx.globalAlpha=view.contentAlpha;
  for(const side of [-1,1])for(let i=0;i<2;i++){
    const x=375+side*(238+i*27),y=282;
    polygon(ctx,[x-side*10,y-17,x+side*4,y-17,x+side*20,y,x+side*4,y+17,x-side*10,y+17,x+side*6,y]);
    ctx.fillStyle=i?red:'#ffe2d9';ctx.fill();
  }
  ctx.save();ctx.translate(375,165);ctx.scale(view.iconScale,view.iconScale);
  const halo=ctx.createRadialGradient(0,0,32,0,0,118);
  halo.addColorStop(0,`rgba(255,42,55,${.42*pulse})`);halo.addColorStop(1,'rgba(255,42,55,0)');
  ctx.fillStyle=halo;ctx.fillRect(-118,-118,236,236);
  polygon(ctx,[-64,-75,64,-75,98,0,64,75,-64,75,-98,0]);
  const badge=ctx.createLinearGradient(0,-75,0,75);
  badge.addColorStop(0,'#8e1c2b');badge.addColorStop(.48,'#3a0d1d');badge.addColorStop(1,'#6e1223');
  ctx.fillStyle=badge;ctx.fill();ctx.lineWidth=4;ctx.strokeStyle=red;ctx.stroke();
  ctx.lineWidth=2;ctx.strokeStyle='#ffada7';
  polygon(ctx,[-56,-66,56,-66,85,0,56,66,-56,66,-85,0]);ctx.stroke();
  const icon=images.get(view.type===2?'encounter-boss':'encounter-warning');
  if(icon)ctx.drawImage(icon,-64,-64,128,128);
  ctx.restore();
  ctx.font=`900 52px ${COMBAT_TYPE.family}`;ctx.textAlign='center';ctx.textBaseline='middle';
  ctx.lineJoin='round';ctx.lineWidth=6;ctx.strokeStyle='#360814';ctx.strokeText(view.title,375,282);
  ctx.fillStyle='#fff4ed';ctx.fillText(view.title,375,282);
  ctx.restore();
}
