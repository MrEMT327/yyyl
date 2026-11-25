import {Vector2,Vector3} from 'three';
import {RESEARCH_DRAW_TIMINGS} from '../../ui/draw-presentation-plan.js';
import {researchResultChanges} from '../../ui/research-result-model.js';
import {researchArt,researchCardQuality} from '../../ui/research-art.js';
import {animateMeshes,easing} from './ui-motion.js';
import {tiltMaterial} from './card-tilt.js';
import {area,box,clamp,pic,qualityFrame,slice,titleFont,words} from './menu-art.js';
import {artworkSize} from './image-loading.js';
const aura='/art/project-research-draw-reference-v5/card-aura.png',burst='/art/project-research-draw-reference-v5/reveal-rays.png',question='/art/research-comic-v1/question.svg';
const shades=['#d6e8f2','#92e3b1','#81cfff','#d5adff','#ffda8a'],linear=[0,0,1,1],easeOut=[0,0,.58,1],easeIn=[.42,0,1,1];
function mask(mesh,ink){
  mesh.material.color.set(ink);
  mesh.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\ndiffuseColor.a*=texture2D(map,vMapUv).a;\n#endif');};return mesh;
}
function mystery(a,t,b,rank=0){
  const frame=slice(a,t,qualityFrame(rank),b,clamp(.028*b.w/.34,9,13));frame.material.color.set('#ddd');
  const q=mask(pic(a,t,question,box(b.x+b.w*.34,b.y+b.h*.26,b.w*.32,b.h*.48),true),'#ddd');q.material.opacity=.85;return [frame,q];
}
function light(a,t,src,b,color){return mask(pic(a,t,src,b),color);}
function opening(d,t,a,b){
  const {rank}=d,timing=RESEARCH_DRAW_TIMINGS[rank],dur=timing.reveal/1000,cx=b.x+b.w/2,cy=b.y+b.h/2;
  const needed=[aura,burst,question,qualityFrame(0),researchArt(d.card.icon)].map(url=>t.texture(url));
  if(needed.some(tx=>!artworkSize(tx.image)[0]&&!tx.userData.failed))return;
  const entered=d.startCharge(needed.some(tx=>tx.userData.failed)),opts={entered,reduced:false};
  const shake=[{at:0}];
  for(const p of timing.pulses){for(const [off,y,rotation,scale] of [[0,0,0,1],[67,.12,-6,.85],[117,-.01,2.8,1.0708],[167,0,-1.59,1.0155],[300,0,0,1]])shake.push({at:(p+off)/timing.reveal,y:y*b.h,rotation,scale});}
  shake.push({at:1});const outer=[{cx,cy,duration:dur,frames:shake,curve:linear}];
  for(let i=0;i<3;i++){
    const meshes=mystery(a,t,b),x=(i-1)*.85*b.w,y=(i===1?-.85:.30)*b.h,r=(i-1)*24;
    animateMeshes(t,meshes,cx,cy,{...opts,outer,duration:1.1,curve:[.25,.6,.3,1],
      frames:[{at:0,opacity:0,x,y,rotation:r,scale:.7},{at:.22,opacity:.85,x:.76*x,y:.76*y,rotation:.7*r,scale:.8},{at:.70,opacity:.90,x:.24*x,y:.24*y,rotation:.2*r,scale:.95},{at:.99,opacity:.6},{at:1,opacity:0}]});
  }
  const bLight=box(b.x-.39*b.w,b.y-.10*b.h,1.78*b.w,1.2*b.h),ink=shades[rank];
  const glow=light(a,t,aura,bLight,ink),delay=[1.35,1.35,1.817,2.2,2.567][rank];
  animateMeshes(t,[glow],cx,cy,{...opts,outer,duration:dur-delay,delay,curve:easeIn,frames:[{at:0,opacity:0,scale:.94},{at:.7,opacity:.28,scale:1.02},{at:1,opacity:.55,scale:1.06}]});
  const [plate,q]=mystery(a,t,b),pivot={value:new Vector2(cx,cy)},rot={value:new Vector3()},turn=[1.35,1.35,1.433,1.817,2.2][rank];
  [plate,q].forEach(m=>tiltMaterial(m,rot,pivot,700));
  const steps=timing.pulses.length?timing.pulses:[1350],frames=[0,...steps.map((_,i)=>Math.round((i+1)*rank/steps.length))].map(i=>t.texture(qualityFrame(i)));
  animateMeshes(t,[plate,q],cx,cy,{...opts,outer,duration:dur,curve:easeOut,frames:[{at:0,opacity:0,scale:.7},{at:.35/dur},{at:turn/dur},{at:1,scale:1.12}]});
  t.animate(now=>{const elapsed=now-entered,frac=easing(clamp((elapsed-turn)/(dur-turn),0,1),...easeIn);
    rot.value.y=frac*[1,1,2,3,3][rank]*2*Math.PI;plate.material.map=frames[steps.filter(ms=>elapsed*1000>=ms).length];return elapsed<dur;});
  for(const p of timing.pulses){const pulse=light(a,t,aura,bLight,ink);animateMeshes(t,[pulse],cx,cy,{...opts,outer,duration:.33,delay:p/1000,curve:easeOut,
    frames:[{at:0,opacity:0,scale:.94},{at:.18,opacity:.68,scale:1.01},{at:1,opacity:0,scale:1.3}]});}
}
function spotlight(d,t,w,h,head,foot,origin,short){
  const {card,modal,rank}=d,r=modal.result,changes=r.nativeChanges||researchResultChanges(card,r.previousLevel,r.level);
  const cw=short?104:clamp(.34*w,108,150),ch=short?132:clamp(.4363*w,138,192),ink=shades[rank];
  const f=clamp(.07*w,24,32),nameH=1.35*f,margin=short?12:22,lvlTop=short?8:12,lvlBottom=short?10:20,statH=short?65:73;
  const statHeight=22+changes.length*statH,newH=r.previousLevel?0:51;
  const width=Math.min(.86*w,360),left=(w-width)/2,coreH=r.earnedCore?40:0,full=newH+ch+margin+nameH+lvlTop+35+lvlBottom+statHeight+coreH;
  const va=box(0,head,w,Math.max(1,h-head-foot)),top=short?head+8:head+Math.max(16,(va.h-full)/2);
  t.region('base',va,Math.max(va.h,full+(short?16:32)));const a=t.layer('tech-reveal','base').art;
  let y=top;
  if(newH){const by=y+16.5;
    words(a,'首次觉醒',w/2,by,14,{weight:400,color:'#f8e4aa',tracking:2});
    for(const yy of [y,y+32])a.quad(w/2-50,yy,100,1,'#e3c27a',.47);y+=newH;}
  const b=box((w-cw)/2,y,cw,ch),cx=w/2,cy=y+ch/2,opts={entered:d.entered,reduced:d.flow.instant};
  if(!opts.reduced){
    const strength=rank>=3?.32:.16;
    const residue=light(a,t,aura,box(b.x-.39*cw,b.y-.1*ch,1.78*cw,1.2*ch),ink);
    const rays=light(a,t,burst,box(b.x-.65*cw,b.y-.35*ch,2.3*cw,1.7*ch),ink);
    animateMeshes(t,[residue],cx,cy,{...opts,duration:.62,curve:easeOut,frames:[{at:0,opacity:.50,scale:.98},{at:1,opacity:0,scale:1.04}]});
    animateMeshes(t,[rays],cx,cy,{...opts,duration:.46,curve:linear,frames:[{at:0,opacity:0,scale:.65},{at:.16,opacity:strength,scale:.94},{at:.48,opacity:strength*.45,scale:1.01},{at:1,opacity:0,scale:1.12}]});
  }
  const plate=slice(a,t,qualityFrame(researchCardQuality(card.quality)),b,clamp(.028*w,9,13));
  const face=pic(a,t,researchArt(card.icon),box(b.x+.11*cw,b.y+.11*ch,.78*cw,.78*ch),true);
  if(!opts.reduced){const duration=RESEARCH_DRAW_TIMINGS[rank].settle/1000,rot={value:new Vector3()},center={value:new Vector2(cx,cy)};
    [plate,face].forEach(m=>tiltMaterial(m,rot,center,700));
    t.animate(now=>{const s=easing(clamp((now-d.entered)/(.7*duration),0,1),.16,1,.3,1);rot.value.y=(1-s)*-65*Math.PI/180;return s<1;});
    animateMeshes(t,[plate,face],cx,cy,{...opts,duration,curve:[.16,1,.3,1],frames:[{at:0,opacity:0,y:origin-cy,scale:.92},{at:.7,scale:1.045},{at:1}]});}
  y+=ch+margin;
  function fade(index,render){const start=a.group.children.length;render();animateMeshes(t,a.group.children.slice(start),0,0,{...opts,duration:.28,delay:.17+.07*Math.min(6,index),curve:[.16,1,.3,1],frames:[{at:0,opacity:0},{at:1}]});}
  fade(0,()=>words(a,card.name,cx,y+nameH/2,f,{family:titleFont,color:'#fff',maxWidth:width}));y+=nameH+lvlTop;
  fade(1,()=>{const old=words(a,'Lv.'+r.previousLevel,0,y+17.5,18,{color:'#d9ecf6',weight:400});
    const value=words(a,'Lv.'+r.level,0,y+17.5,26,{color:ink,weight:700}),gap=20,oldW=old.scale.x-4,newW=value.scale.x-4;
    const x=cx-(oldW+newW+2*gap+18)/2;old.position.x=x+oldW/2;words(a,'→',x+oldW+gap+9,y+17.5,18,{color:'#9cbecb',weight:400});value.position.x=x+oldW+2*gap+18+newW/2;});y+=35+lvlBottom;
  a.quad(left,y,width,statHeight,'#83bbdc',.045);a.quad(left,y,width,1,'#88b5d0',.24);a.quad(left,y+statHeight-1,width,1,'#88b5d0',.24);y+=11;
  const inner=width-28,part=(inner-38)/2;
  changes.forEach((row,i)=>{const ry=y;
    fade(i+2,()=>{const x=left+14,py=ry+(short?6:10);
      words(a,row.label,x-2,py+10.5,14,{color:'#d9ecf6',align:'left',weight:400,maxWidth:inner});
      words(a,row.before,x+part/2,py+41,14,{color:'#d9ecf6',weight:400,maxWidth:part});
      words(a,'→',cx,py+41,16,{color:'#9cbecb'});words(a,row.after,x+inner-part/2,py+41,16,{color:ink,weight:700,maxWidth:part});});y+=statH;
  });y+=11;
  if(coreH)fade(2+changes.length,()=>{pic(a,t,researchArt('technology-core'),box(cx-49,y+12,28,28),true);
    words(a,'星核  ×'+r.earnedCore,cx+15,y+26,14,{color:'#e1edf3'});});
  area(t,'result-card','觉醒结果',box(left,top+newH,width,full-newH),'none',{},'base');
}
export function paintResearchDraw(d,w,h,t,viewportHeight=h){
  const a=t.layer('awakening-stage').art,open=d.flow.phase==='opening',short=viewportHeight<=650,head=short?52:70,foot=56+Math.max(.06*viewportHeight,d.safeBottom);
  t.backdrop(a,.667);area(t,'blank',open?'跳过动画':'点击空白处关闭',t.frameRect,open?'skip':'next');
  const cy=head+(h-head-foot)/2-.16*w,cw=clamp(.34*w,108,150),ch=cw*308/240;
  if(open)opening(d,t,a,box((w-cw)/2,cy-ch/2,cw,ch));
  else spotlight(d,t,w,h,head,foot,cy,short);
  const front=t.layer('awakening-footer').art,bw=Math.min(w*.84,360),b=box((w-bw)/2,h-foot+12,bw,44),caption=open?'点击任意位置跳过动画':'点击空白处关闭';
  words(front,caption,w/2,b.y+22,open?13:14,{weight:500,color:open?'#a7bfce':'#d0dce3',tracking:open?0:1});
  area(t,'confirm',open?'跳过':'确定',b,open?'skip':'next');
}
