// Project-owned vector art. Native reference: eight arc frames, independent
// 40–60ms edge flashes and a masked base. No competitor texture is loaded.
export const EDGE_FRAME_COUNT=8;
export const EDGE_FRAME_RATE=10;
export const EDGE_PALETTES=Object.freeze({
  y:{core:'#fff9e5',near:'#ffd36d',far:'#ffb237',base:'#e9a22e',other:'#ffe6a0'},
  r:{core:'#fff2e7',near:'#ff947c',far:'#ff4f58',base:'#d6314e',other:'#ffb69b'},
  c:{core:'#f2fcff',near:'#dd9dff',far:'#a45bff',base:'#864ed2',other:'#53e7ff'},
});
const clamp=(n,a=0,b=1)=>Math.max(a,Math.min(b,n));
const random=n=>{n=(n^0x9e3779b9)>>>0;n=Math.imul(n^(n>>>16),0x21f0aaad);n=Math.imul(n^(n>>>15),0x735a2d97);return((n^(n>>>15))>>>0)/4294967296;};
export const edgeTierFromStar=star=>Number(star)>=9?'c':Number(star)>=6?'r':'y';
export const edgeFrameIndex=seconds=>Math.floor(Math.max(0,Number.isFinite(seconds)?seconds:0)*EDGE_FRAME_RATE)%EDGE_FRAME_COUNT;
export function edgePoint(width,height,distance,inward){
  const w=Math.max(1,width),h=Math.max(1,height),p=2*(w+h),s=((distance%p)+p)%p;
  if(s<w)return[s,inward];
  if(s<w+h)return[w-inward,s-w];
  if(s<2*w+h)return[2*w+h-s,h-inward];
  return[inward,p-s];
}
const path=points=>'M'+points.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' L');
function spinePoint(width,height,distance,frame,extra=0){
  const scale=Math.min(width/600,height/1300),p=2*(width+height),s=((distance%p)+p)%p;
  let side,at,length;
  if(s<width){side=0;at=s;length=width;}
  else if(s<width+height){side=1;at=s-width;length=height;}
  else if(s<2*width+height){side=2;at=s-width-height;length=width;}
  else{side=3;at=s-2*width-height;length=height;}
  const u=at/length,inset=Math.max(4,8.5*scale),taper=Math.sqrt(Math.max(0,Math.sin(u*Math.PI)));
  const jag=(random(frame*971+side*307+Math.floor(at/Math.max(6,14*scale))*19)-.5)*6.2*scale*taper;
  const depth=Math.max(3,inset+jag+extra),x=inset+(width-2*inset)*u,y=inset+(height-2*inset)*u;
  return side===0?[x,depth]:side===1?[width-depth,y]:side===2?[width-x,height-depth]:[depth,height-y];
}
export function sampleEdgeMainPath(frames,seconds){
  if(!frames.length||!frames[0].points?.length)return'';
  const phase=Math.max(0,Number.isFinite(seconds)?seconds:0)*EDGE_FRAME_RATE,index=Math.floor(phase)%frames.length,mix=phase-Math.floor(phase);
  const a=frames[index].points,b=frames[(index+1)%frames.length].points;
  return path(a.map((p,i)=>[p[0]+(b[i][0]-p[0])*mix,p[1]+(b[i][1]-p[1])*mix]))+' Z';
}


export function buildEdgeArcFrames(width,height){
  if(!(width>4&&height>4))return Array.from({length:EDGE_FRAME_COUNT},()=>({main:'',branches:'',echo:'',points:[]}));
  const scale=Math.min(width/600,height/1300),perimeter=2*(width+height),tile=perimeter/7;
  return Array.from({length:EDGE_FRAME_COUNT},(_,frame)=>{
    const main=[],branches=[],echo=[];
    let travelled=0;
    for(const length of [width,height,width,height]){
      const steps=Math.min(256,Math.max(4,Math.ceil(length/Math.max(5,14*scale))));
      for(let i=0;i<steps;i++)main.push(spinePoint(width,height,travelled+length*i/steps,frame));
      travelled+=length;
    }
    for(let cell=0;cell<7;cell++)for(let half=0;half<2;half++){
      const seed=frame*971+cell*101+half*37+11;
      const start=cell*tile+half*tile*.52+tile*(.015+random(seed)*.045);
      const length=tile*(.34+random(seed+3)*.11),steps=Math.min(48,Math.max(5,Math.ceil(length/Math.max(8,24*scale))));
      // Separate short branches decorate a continuous main perimeter.
      if(random(seed+23)>.18){
        const join=Math.max(1,Math.floor(steps*(.3+random(seed+31)*.4))),s=start+length*join/steps;
        const sign=random(seed+29)>.5?1:-1,span=length*(.18+random(seed+43)*.13),tip=(11+random(seed+47)*13)*scale;
        const split=[spinePoint(width,height,s,frame),spinePoint(width,height,s+sign*span*.36,frame,tip*.36),
          spinePoint(width,height,s+sign*span*.65,frame,tip*.18),spinePoint(width,height,s+sign*span,frame,tip)];
        branches.push(path(split));
        if(random(seed+53)>.62)echo.push(path([split[1],spinePoint(width,height,s-sign*span*.25,frame,tip*.63),split[3]]));
      }
    }
    return{main:path(main)+' Z',branches:branches.join(' '),echo:echo.join(' '),points:main};
  });
}

// Varying inward width gives the broad base a contour rather than a flat bar.
export function edgeBaseMask(width,height){
  if(!(width>4&&height>4))return'';
  const p=2*(width+height),scale=Math.min(width/600,height/1300),steps=Math.min(1024,Math.max(16,Math.ceil(p/(42*scale)))),points=[];
  for(let i=0;i<steps;i++)points.push(edgePoint(width,height,p*i/steps,(22+random(i*43+19)*16)*scale));
  return `M0,0 H${width} V${height} H0 Z `+path(points)+' Z';
}

const FLASHES=[
  [[-.48,-.10],[-.19,-.21],[-.10,.03],[.13,-.08],[.22,.17],[.49,.06]],
  [[-.43,.19],[-.24,-.08],[-.07,.07],[.12,-.23],[.27,-.03],[.46,-.16]],
  [[-.44,-.19],[-.16,-.03],[-.26,.18],[.03,.05],[.23,.23],[.45,-.06]],
  [[-.47,.06],[-.24,.25],[-.02,.03],[-.09,-.20],[.18,-.08],[.44,-.22]],
  [[-.43,-.23],[-.22,.04],[.02,-.12],[.08,.18],[.28,.04],[.47,.20]],
  [[-.47,.17],[-.17,.04],[-.25,-.22],[.02,-.04],[.25,-.15],[.46,.10]],
  [[-.45,-.08],[-.20,-.26],[-.09,-.02],[.17,.14],[.10,.30],[.48,.10]],
  [[-.48,.15],[-.23,-.04],[-.07,.15],[.09,-.14],[.30,.03],[.43,-.22]],
  [[-.43,-.20],[-.20,.05],[.04,-.13],[.10,.19],[.34,.08],[.47,.24]],
];
export function edgeFlashPath(index){
  const points=FLASHES[((index%FLASHES.length)+FLASHES.length)%FLASHES.length];
  return path(points)+' '+path([points[2],[points[2][0]+.06,points[2][1]-.25],[points[2][0]+.24,points[2][1]-.34]]);
}
export function edgeFlashSample(width,height,seconds){
  seconds=Math.max(0,Number.isFinite(seconds)?seconds:0);
  const slot=Math.floor(seconds*10),age=seconds-slot*.1,life=.04+random(slot*73+5)*.02;
  const scale=Math.min(width/600,height/1300),position=edgePoint(width,height,random(slot*197+33)*2*(width+height),7*scale);
  const progress=clamp(age/life),expand=progress<.16884?.11118+(.77972-.11118)*progress/.16884:.77972+(1-.77972)*(progress-.16884)/.83116;
  return{slot,age,life,visible:age<life,x:position[0],y:position[1],angle:random(slot*47+12)*360,
    size:(92+random(slot*31+17)*100)*scale,scale:expand,index:Math.min(8,Math.floor(progress*9)),alpha:.82};
}
export const edgeBasePulse=seconds=>.588235+(1-.588235)*(.5+.5*Math.cos(Math.max(0,seconds)*Math.PI*2));
