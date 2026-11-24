import {area,box,pic,slice,titleFont,words} from './menu-art.js';
import {animateMeshes} from './ui-motion.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';

export const feedbackArt='/art/process-feedback-v1/',hologram=feedbackArt+'hologram-reveal.png';
export const frameBox=(p,x,y,w,h)=>box(p.x+x*p.w,p.y+y*p.h,w*p.w,h*p.h);
export const label=(a,v,x,y,f,opts={})=>words(a,v,x,y,f,{family:titleFont,color:'#edf5f8',...opts});
export const glyph=(a,t,id,b)=>pic(a,t,projectIconUrl(id),b,true);
export const hold=[{at:0},{at:1}],pop=[{at:0,opacity:0,scale:.7},{at:.65,scale:1.08},{at:1}];
export const pulse=[{at:0,opacity:.35,scale:.98},{at:.5,opacity:.7,scale:1.025},{at:1,opacity:.35,scale:.98}];
export const reveal=w=>[{at:0,opacity:0,y:.02*w},{at:1}];
export function groupMotion(t,a,p,data,b,paint,track=null,outer=[]){
  const start=a.group.children.length;paint();
  const parent={duration:.38,cx:p.x+p.w/2,cy:p.y+p.h/2,frames:[{at:0,opacity:0,y:.02*data.w,scale:.96},{at:1}]};
  const inner=track||parent;
  animateMeshes(t,a.group.children.slice(start),track?b.x+b.w/2:parent.cx,track?b.y+b.h/2:parent.cy,
    {...data,...inner,outer:track?[...outer,parent]:outer});
}
export function portion(a,t,url,b,view,size){
  const tex=t.texture(url),[x,y,iw,ih]=view,[sw,sh]=size;
  return a.image(tex,b.x,b.y,b.w,b.h,{x:x/sw,y:y/sh,width:iw/sw,height:ih/sh});
}
export function outerFrame(a,t,p,w,tone){
  const mesh=pic(a,t,tone==='primary'?'/art/psd-popup-v1/primary.png':feedbackArt+tone+'-panel.png',p);
  const geo=slicedFrameGeometry(p.w,p.h,567,714,[110,44,55,255],[.09*w,.05*w,.05*w,.22*w]);
  // The authored middle row uses a narrower left border than the corners.
  const pos=geo.attributes.position,uv=geo.attributes.uv;
  for(let i=18;i<36;i++)if(Math.abs(uv.getX(i)-255/567)<.00001){
    uv.setX(i,27/567);pos.setX(i,.024*w/p.w-.5);
  }
  mesh.geometry.dispose();mesh.geometry=geo;
}
export function inset(a,t,b,w){
  const m=pic(a,t,feedbackArt+'inset-panel.png',b);
  const geo=slicedFrameGeometry(b.w,b.h,2146,359,[45,45,45,45],[.02*w,.02*w,.02*w,.02*w]);
  const uv=geo.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(13+2146*uv.getX(i))/2172,1-(181+359*(1-uv.getY(i)))/724);
  m.geometry.dispose();m.geometry=geo;
}
export function heading(a,t,p,w,title){label(a,title,p.x+.06*w-2,p.y+.025*w+.032*w,.052*w,{align:'left',color:'#fff',shadow:{color:'#73889e',y:1,blur:2}});}
export function submit(a,t,b,w,text,command){
  slice(a,t,'/art/psd-equipment-v1/button-gold.png',b,.025*w);
  label(a,text,b.x+b.w/2,b.y+b.h/2,.045*w);area(t,'submit',text,b,command);
}
export function dismiss(a,t,p,w,y=p.y+p.h+.018*w){
  const b=box(p.x,y,p.w,44);words(a,'点击空白处关闭',b.x+b.w/2,b.y+22,w*.034,{weight:400,color:'#d8eef7',shadow:{color:'#08192b',y:1,blur:2}});
  area(t,'close','点击空白处关闭',b,'close');
}
export function countUp(t,data,from,to,delay,duration,draw){
  if(data.reduced||!Number.isFinite(from)||performance.now()/1000>=data.entered+delay+duration){draw(to);return;}
  const steps=Math.ceil(duration/.03);
  const value=i=>Math.round(from+(to-from)*(1-Math.pow(1-Math.min(1,i*.03/duration),3)));
  const meshes=new Map();
  for(let i=0;i<=steps;i++){const v=value(i);if(!meshes.has(v)){const m=draw(v);m.visible=false;meshes.set(v,m);}}
  let previous;
  function tick(now){
    const i=Math.max(0,Math.min(steps,Math.floor((now-data.entered-delay)/.03))),next=meshes.get(value(i));
    if(previous!==next){if(previous)previous.visible=false;next.visible=true;previous=next;}
    return i<steps;
  }
  tick(performance.now()/1000);t.animate(tick);
}
