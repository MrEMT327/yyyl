import {UPGRADE_SELECTION_TIMING as timing} from './upgrade-selection-timing.js';

const release=(timing.burst-timing.reveal)/1000;
const end=(timing.finish-timing.reveal)/1000;
const star='geometry-star-main-256x256-1x1-v03';
const flareMaterial={name:'breakthrough-starlight',textures:[{slot:'_MainTex',scale:{x:1,y:1},offset:{x:0,y:0},key:star}]};
// A narrow slice through one arm of the star is a continuous, soft-edged brush.
const ribbonCrop={x:149,y:35,width:6,height:190};
const palettes={
  y:{colors:[0xffaa31,0xffe8a2],turn:3.1,angle:-.35,axes:[-.06],shards:6},
  r:{crossed:true,colors:[0xff3852,0xffae57],turn:-3.85,angle:.65,axes:[-.58,.58],shards:8},
  c:{colors:[0x55eaff,0xff78dd,0xb18bff],turn:4.6,angle:-1.48,axes:[-.34,.72,1.76],shards:10},
};
const clamp=n=>Math.max(0,Math.min(1,n));
const ease=n=>{n=clamp(n);return n*n*(3-2*n);};

function glint(draws,x,y,width,height,rotation,tint,alpha,crop){
  draws.push({material:flareMaterial,sprite:{key:star,x,z:-y,width,height,rotation,tint,alpha,
    originX:.5,originY:.5,blend:'add',crop}});
}

function orbit(progress,angle,turn){
  const p=clamp(progress),angleNow=angle+turn*(.45*p+.55*p*p);
  const radius=1-Math.pow(p,1.85);
  return {x:Math.cos(angleNow)*radius*415,y:Math.sin(angleNow)*radius*530};
}

function blade(progress,index){
  const p=clamp(progress),radius=1-p*p;
  const side=index%2?1:-1,diagonal=index<2?1:-1;
  return {x:side*radius*470,y:side*diagonal*radius*360+diagonal*105*Math.sin(Math.PI*p)};
}

function gather(draws,t,style){
  const p=(t-.065)/(release-.12);
  const alpha=ease(p/.18)*(1-ease((p-.91)/.13));
  if(alpha<=0)return;
  const crossed=style.crossed,lanes=crossed?4:style.colors.length,segments=crossed?4:8;
  const span=.28+.10*clamp(p);
  for(let i=0;i<lanes;i++){
    const angle=style.angle+i*2*Math.PI/lanes;
    const tint=style.colors[crossed?Math.floor(i/2):i];
    const position=u=>crossed?blade(u,i):orbit(u,angle,style.turn);
    let last=position(p-span),heading=angle;
    for(let j=1;j<=segments;j++){
      const along=j/segments,point=position(p-span*(1-along));
      const dx=point.x-last.x,dy=point.y-last.y,length=Math.hypot(dx,dy);
      if(length>.4){
        heading=Math.atan2(dy,dx);
        glint(draws,(last.x+point.x)/2,(last.y+point.y)/2,length+1.5,12+58*along,
          heading,tint,alpha*along,ribbonCrop);
      }
      last=point;
    }
    const size=100+30*clamp(p);
    glint(draws,last.x,last.y,size*1.5,size*.46,heading,tint,alpha);
    glint(draws,last.x,last.y,size*.72,size*.72,heading+.45,0xfff4d7,alpha*.85);
  }
}

function open(draws,t,style){
  const strike=ease((t-release+.16)/.14)*(1-ease((t-release-.015)/.19));
  if(strike>0)for(const [i,axis] of style.axes.entries()){
    const spread=ease((t-release+.16-i*.015)/.18);
    glint(draws,0,0,220+1700*spread,80+92*strike,axis,style.colors[i],strike);
  }
  const p=clamp((t-release+.015)/(end-release+.015));
  const alpha=ease(p/.12)*(1-ease((p-.55)/.45));
  if(alpha<=0)return;
  const travel=1-(1-p)*(1-p);
  for(let i=0;i<style.shards;i++){
    const angle=style.angle+2*Math.PI*i/style.shards+(i%2?.13:-.06);
    const radius=65+travel*(i%2?410:550),tint=style.colors[i%style.colors.length];
    glint(draws,Math.cos(angle)*radius,Math.sin(angle)*radius*1.23,
      110+235*(1-p),44+45*(1-p),angle,tint,alpha);
  }
}

export function appendBreakthroughOpening(draws,seconds,tier){
  const style=palettes[tier]||palettes.y;
  if(seconds<release)gather(draws,seconds,style);
  if(seconds>release-.16&&seconds<end)open(draws,seconds,style);
}

// The column contracts just before the flare crosses it, then springs back to full width.
export function breakthroughFocus(seconds){
  return ease((seconds-release+.34)/.22)*(1-ease((seconds-release+.09)/.09));
}
