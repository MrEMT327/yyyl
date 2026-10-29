import './style.css';
import * as T from 'three';
import { createModuleGeometry } from '../slot-demo/module-geometry.js';
import { ITEM_BY_ID } from '../slot-demo/catalog.js';
import { createPathogenicRange, weaponStats } from './simulation.js';

const sim=createPathogenicRange(),canvas=document.querySelector('#battle'),ctx=canvas.getContext('2d');
const el=id=>document.getElementById(id),sprites={},normalSprites={},homingSprites={},buffers={};
const effects=[];
let paused=false,sound=false,audioContext=null,lastTime=null,raf=0,disposed=false;
for(const id of ['assault','sniper']){
  const im=new Image();
  im.onload=()=>{
    // The original homing modifier multiplies sprite color by PURPLE * 3.
    // This is a runtime texture tint; the stored source image stays intact.
    const base=id==='assault'?[1.79309297,1.79309297,4.41593409,1]:[1.82479632,2.73719448,1.27735742,1];
    for(const guided of [false,true]){
      const tint=base.map((c,i)=>c*(guided?[.627451*3,.1254902*3,.9411765*3,3][i]:1));
      const tinted=document.createElement('canvas');tinted.width=im.naturalWidth;tinted.height=im.naturalHeight;
      const tc=tinted.getContext('2d');tc.drawImage(im,0,0);const pixels=tc.getImageData(0,0,tinted.width,tinted.height);
      for(let i=0;i<pixels.data.length;i+=4)for(let c=0;c<4;c++)pixels.data[i+c]*=tint[c];
      tc.putImageData(pixels,0,0);(guided?homingSprites:normalSprites)[id]=tinted;
    }
  };
  im.src=`${import.meta.env.BASE_URL}assets/reference/pathogenic/${id}.webp`;sprites[id]=im;
}
// Render the existing assembly meshes, without generating or replacing icons.
async function icons(){
  const renderer=new T.WebGLRenderer({alpha:true,antialias:true});renderer.setSize(128,128);renderer.setPixelRatio(1);
  renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.6;
  const scene=new T.Scene();scene.add(new T.HemisphereLight(0xe7f6ff,0x455361,3));
  const key=new T.DirectionalLight(0xfff3dd,4);key.position.set(5,9,7);scene.add(key);
  const camera=new T.PerspectiveCamera(35,1,.01,100);camera.position.set(8,7,9);camera.lookAt(0,0,0);
  for(const item of document.querySelectorAll('[data-icon]')){
    const model=createModuleGeometry(ITEM_BY_ID.get(item.dataset.icon)),bounds=new T.Box3().setFromObject(model),size=bounds.getSize(new T.Vector3()),center=bounds.getCenter(new T.Vector3());
    const scale=5.7/Math.max(size.x,size.y,size.z);model.scale.setScalar(scale);model.position.copy(center).multiplyScalar(-scale);scene.add(model);
    renderer.render(scene,camera);item.src=renderer.domElement.toDataURL('image/png');model.userData.dispose();
  }
  renderer.dispose();
}
icons().catch(e=>{console.error('试射图标加载失败',e);document.querySelectorAll('[data-icon]').forEach(e=>e.hidden=true);});
function sync(){
  effects.length=0;
  document.querySelectorAll('[data-weapon]').forEach(b=>{const active=b.dataset.weapon===sim.config.weapon;b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));});
  for(const [id,key] of [['hit-charge','hitCharge'],['homing','homing']]){const b=el(id),active=sim.config[key];b.classList.toggle('selected',active);b.setAttribute('aria-pressed',String(active));b.querySelector('em').textContent=active?'开':'关';}
  el('rarity').value=String(sim.config.rarity);
  el('tip').textContent=sim.config.homing?'瞄准靶体旁边，观察子弹如何弯过去。高压棘刺更重，转弯也更慢。':sim.config.hitCharge?'命中会抬高过载。切到史诗品质，更容易看到连发数和射速的变化。':'先看裸武器，再打开引力器，瞄准敌人旁边试试。';
}
document.querySelectorAll('[data-weapon]').forEach(b=>b.addEventListener('click',()=>{sim.configure({weapon:b.dataset.weapon});sync();}));
el('hit-charge').addEventListener('click',()=>{sim.configure({hitCharge:!sim.config.hitCharge});sync();});
el('homing').addEventListener('click',()=>{sim.configure({homing:!sim.config.homing});sync();});
el('rarity').addEventListener('change',()=>{sim.configure({rarity:Number(el('rarity').value)});sync();});
el('pause').addEventListener('click',()=>{paused=!paused;el('pause').textContent=paused?'继续':'暂停';});
el('reset').addEventListener('click',()=>{sim.reset();effects.length=0;});
el('moving').addEventListener('click',()=>{sim.config.movingTargets=!sim.config.movingTargets;el('moving').setAttribute('aria-pressed',String(sim.config.movingTargets));el('moving').textContent=`移动靶 ${sim.config.movingTargets?'开':'关'}`;});
el('sound').addEventListener('click',async()=>{
  sound=!sound;el('sound').setAttribute('aria-pressed',String(sound));el('sound').textContent=`声音 ${sound?'开':'关'}`;
  if(!sound)return;
  audioContext||=new AudioContext();await audioContext.resume();
  for(const name of ['assault','sniper'])if(!buffers[name])try{const r=await fetch(`${import.meta.env.BASE_URL}assets/reference/pathogenic/${name}.wav`);buffers[name]=await audioContext.decodeAudioData(await r.arrayBuffer());}catch(e){console.warn('试射音效未能加载',e);}
});
function play(weapon){const name=weapon==='twin'?'assault':'sniper';if(!sound||!buffers[name]||audioContext.state!=='running')return;
  const source=audioContext.createBufferSource(),gain=audioContext.createGain();source.buffer=buffers[name];gain.gain.value=.15;source.connect(gain).connect(audioContext.destination);source.start();source.onended=()=>{source.disconnect();gain.disconnect();};}
let pointer=null;
function aim(e){const r=canvas.getBoundingClientRect();sim.aim(Math.max(0,Math.min(4000,(e.clientX-r.left)/r.width*4000)),Math.max(0,Math.min(4600,(e.clientY-r.top)/r.height*4600)));}
canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;canvas.setPointerCapture(pointer);aim(e);});
canvas.addEventListener('pointermove',e=>{if(e.pointerId===pointer||e.pointerType==='mouse')aim(e);});
for(const event of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(event,()=>pointer=null);
canvas.addEventListener('keydown',e=>{const delta={ArrowLeft:[-200,0],ArrowRight:[200,0],ArrowUp:[0,-200],ArrowDown:[0,200]}[e.key];if(delta){e.preventDefault();sim.aim(sim.state.aim.x+delta[0],sim.state.aim.y+delta[1]);}});
function resize(){const r=canvas.getBoundingClientRect(),dpr=Math.min(2,window.devicePixelRatio||1);canvas.width=Math.round(r.width*dpr);canvas.height=Math.round(r.height*dpr);}
const observer=new ResizeObserver(resize);observer.observe(canvas);
function draw(){
  const s=sim.state,k=canvas.width/s.width;ctx.setTransform(k,0,0,k,0,0);ctx.clearRect(0,0,s.width,s.height);
  ctx.fillStyle='#0c1721';ctx.fillRect(0,0,s.width,s.height);
  ctx.lineWidth=4;ctx.strokeStyle='#213442';ctx.beginPath();
  for(let x=0;x<4000;x+=400){ctx.moveTo(x,0);ctx.lineTo(x,4600);}for(let y=0;y<4600;y+=400){ctx.moveTo(0,y);ctx.lineTo(4000,y);}ctx.stroke();
  ctx.strokeStyle='#375361';ctx.lineWidth=15;ctx.strokeRect(40,40,3920,4520);
  for(const t of s.targets){
    if(t.dead)continue;ctx.beginPath();ctx.arc(t.x,t.y,t.radius,0,Math.PI*2);ctx.fillStyle=t.flash>0?'#f3c99b':'#30475b';ctx.fill();ctx.strokeStyle=t.flash>0?'#fff6d0':'#7894a2';ctx.lineWidth=10;ctx.stroke();
    ctx.beginPath();ctx.arc(t.x-20,t.y+6,t.radius*.42,0,Math.PI*2);ctx.fillStyle='#567384';ctx.fill();
    ctx.fillStyle='#233240';ctx.fillRect(t.x-t.radius,t.y+t.radius+55,t.radius*2,28);ctx.fillStyle='#d6a765';ctx.fillRect(t.x-t.radius,t.y+t.radius+55,t.radius*2*t.hp/t.maxHp,28);
  }
  const mu=sim.muzzle();ctx.strokeStyle='#7ac4c450';ctx.lineWidth=6;ctx.setLineDash([30,30]);ctx.beginPath();ctx.moveTo(mu.x,mu.y);ctx.lineTo(s.aim.x,s.aim.y);ctx.stroke();ctx.setLineDash([]);
  ctx.strokeStyle='#b6c8cf';ctx.lineWidth=8;ctx.beginPath();ctx.arc(s.aim.x,s.aim.y,72,0,Math.PI*2);ctx.moveTo(s.aim.x-105,s.aim.y);ctx.lineTo(s.aim.x-45,s.aim.y);ctx.moveTo(s.aim.x+45,s.aim.y);ctx.lineTo(s.aim.x+105,s.aim.y);ctx.stroke();
  for(const b of [...s.bullets,...effects]){
    if(b.homing){ctx.strokeStyle='#cda7f366';ctx.lineWidth=10;ctx.beginPath();b.path.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();}
    const key=b.weapon==='twin'?'assault':'sniper',im=sprites[key],explosion=b.endedAt===undefined?null:(s.time-b.endedAt)/.2;
    ctx.save();ctx.translate(b.x+b.vx*(explosion===null?0:s.time-b.endedAt),b.y+b.vy*(explosion===null?0:s.time-b.endedAt));ctx.rotate(Math.atan2(b.vx,-b.vy));
    if(im.complete&&im.naturalWidth){
      const growth=Math.sqrt(b.damage/ORIGINAL_BASE[b.weapon]),spawn=Math.min(1,b.age/.1);
      const spriteScale=explosion===null?.8*ease(spawn,.129408):2.5*(1-ease(explosion,.466518));
      ctx.globalAlpha=explosion===null?ease(spawn,.133972):.673*(1-ease(explosion,.435277));
      const w=im.naturalWidth*spriteScale*growth,h=im.naturalHeight*spriteScale*growth;
      ctx.drawImage((b.homing?homingSprites:normalSprites)[key]||im,-w/2,-h/2+(34.3365*spriteScale+(key==='assault'?4:8))*growth,w,h);
    }
    else{ctx.fillStyle=b.homing?'#c8a0f5':'#a2f26a';ctx.beginPath();ctx.ellipse(0,0,b.radius,b.radius*2,0,0,Math.PI*2);ctx.fill();}
    ctx.restore();
  }
  ctx.fillStyle='#263e50';ctx.strokeStyle='#8ba8b9';ctx.lineWidth=11;ctx.beginPath();ctx.arc(s.player.x,s.player.y,190,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#a8beca';ctx.lineWidth=sim.config.weapon==='rail'?75:55;ctx.lineCap='round';ctx.beginPath();s.barrel.forEach((p,i)=>i?ctx.lineTo(s.player.x+p.y,s.player.y-p.x):ctx.moveTo(s.player.x+p.y,s.player.y-p.x));ctx.stroke();ctx.lineCap='butt';
  ctx.fillStyle='#70909b';ctx.font='90px system-ui';ctx.textAlign='center';ctx.fillText('单门武器',s.player.x,s.player.y+345);
  const stats=weaponStats(sim.config.weapon,sim.config.rarity,s.charge);
  el('attack-stats').textContent=`${stats.shots} 发 / 轮 · ${stats.interval.toFixed(2)} 秒 · 单发 ${Math.round(stats.damage)}`;
  el('hit-stats').textContent=`命中 ${s.hits} · 伤害 ${Math.round(s.damage)}`;
  el('charge-value').textContent=`${Math.round(s.charge*100)}%`;el('charge-fill').style.width=`${s.charge*100}%`;
  el('charge-effect').textContent=!sim.config.hitCharge?'开启恢复线粒体后，命中即可供能':sim.config.weapon==='twin'?`当前每轮 ${stats.shots} 发${sim.config.homing?' · 同时增强追踪':''}`:`当前间隔 ${stats.interval.toFixed(2)} 秒${sim.config.homing?' · 同时增强追踪':''}`;
}
const ORIGINAL_BASE={twin:35,rail:140};
function ease(x,curve){return 1-Math.pow(1-Math.max(0,Math.min(1,x)),1/curve);}
function frame(now){if(disposed)return;if(!paused&&lastTime!==null)sim.advance(Math.min(.1,(now-lastTime)/1000));lastTime=now;
  for(const e of sim.takeEvents()){if(e.type==='shot')play(sim.config.weapon);if(e.type==='expired')effects.push({...e.bullet,endedAt:e.time,path:[]});}
  for(let i=effects.length-1;i>=0;i--)if(sim.state.time-effects[i].endedAt>=.2)effects.splice(i,1);
  draw();raf=requestAnimationFrame(frame);}
function visibility(){lastTime=null;cancelAnimationFrame(raf);if(document.hidden){audioContext?.suspend();}else{if(sound)audioContext?.resume();raf=requestAnimationFrame(frame);}}
document.addEventListener('visibilitychange',visibility);
window.addEventListener('pagehide',e=>{cancelAnimationFrame(raf);if(e.persisted){audioContext?.suspend();return;}disposed=true;observer.disconnect();document.removeEventListener('visibilitychange',visibility);audioContext?.close();});
window.addEventListener('pageshow',e=>{if(e.persisted)visibility();});
window.__PATHOGENIC_RANGE__={sim,get paused(){return paused;},snapshot:()=>JSON.parse(JSON.stringify({config:sim.config,state:sim.state})),ready:true};
sync();resize();raf=requestAnimationFrame(frame);
