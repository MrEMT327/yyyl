import {Color,Vector2,Vector3,Vector4} from 'three';
import {area,box,clamp,pic,slice,words} from './menu-art.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {animateMeshes} from './ui-motion.js';
import {tiltMaterial} from './card-tilt.js';
import {artworkSize} from './image-loading.js';

const poses={
  'pilot-03':[6.2,-2.48,0],'pilot-04':[6.2,-2.66,0],'pilot-05':[3.7,-1.39,-.07],'pilot-06':[3.1,-.93,0],
  'pilot-07':[4.2,-2.10,-.02],'pilot-08':[4.8,-1.63,-.17],'pilot-09':[4.2,-1.42,-.03],'pilot-10':[3.6,-1.30,0]
};
const displayColor=c=>new Color(c).convertLinearToSRGB();
const colorFilter=style=>style.color==='#efbd55'?[208,.8]:style.color==='#b38aef'?[76,1]:style.color==='#55a572'?[280,1.2]:style.color==='#8899a2'?[0,0]:[0,1];
const shadow={color:'#081323',y:1,blur:3};
function shader(mesh,key,uniforms,fragHead,ink){
  mesh.material.onBeforeCompile=s=>{
    Object.assign(s.uniforms,uniforms);s.vertexShader='varying vec2 cardPos;\n'+s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\ncardPos=vec2(position.x+.5,.5-position.y);');
    s.fragmentShader='varying vec2 cardPos;\n'+fragHead+'\n'+s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+ink);
  };
  mesh.material.customProgramCacheKey=()=>key;
}
function foiledPlate(a,t,b,style,u){
  const m=slice(a,t,'/art/psd-choice-v1/'+style.choiceFrame,b,9,24),[angle,sat]=colorFilter(style);
  shader(m,'recruit-plate',{...u,filterPair:{value:new Vector2(angle*Math.PI/180,sat)}},'uniform vec2 filterPair;uniform vec3 metal;uniform float reduced;uniform float seconds;',`
    vec3 c=sRGBTransferOETF(diffuseColor).rgb;float co=cos(filterPair.x),si=sin(filterPair.x);
    vec3 tint=vec3(dot(c,vec3(.213+.787*co-.213*si,.715-.715*co-.715*si,.072-.072*co+.928*si)),
      dot(c,vec3(.213-.213*co+.143*si,.715+.285*co+.140*si,.072-.072*co-.283*si)),
      dot(c,vec3(.213-.213*co-.787*si,.715-.715*co+.715*si,.072+.928*co+.072*si)));
    c=mix(vec3(dot(tint,vec3(.213,.715,.072))),tint,filterPair.y);
    vec2 q=(cardPos-vec2(.5,.58))/vec2(.75,.62);float r=length(q);
    float corona=(1.-smoothstep(.0,.24,abs(r-.58)))*.22*(.8+.2*cos(seconds*.65))*smoothstep(.0,.17,cardPos.y)*(1.-smoothstep(.86,1.,cardPos.y));
    float theta=mod(atan(q.y,q.x)+6.283,1.257);
    float orbit=(1.-smoothstep(.005,.036,min(abs(theta-.42),abs(theta-.91))))*(1.-smoothstep(.0,.23,abs(r-.55)))*.12;
    diffuseColor.rgb=sRGBTransferEOTF(vec4(mix(clamp(c,0.,1.),metal,corona+orbit),1.)).rgb;`);
  return m;
}
function portrait(a,t,b,pilot,small,u){
  const bounds=small?box(b.x+b.w*.05,b.y+b.h*.12,b.w*.9,b.h*.83):box(b.x-b.w*.09,b.y+b.h*.14,b.w*1.18,b.h*.77);
  const tex=t.texture(pilot.image),shape=small?(poses[pilot.id]||[3,-1,0]):[1.25,-.125,0],pw=bounds.w*shape[0];
  const [iw,ih]=artworkSize(tex.image);
  if(!iw||!ih)return;
  const ph=pw*ih/iw;
  const uv=new Vector4(shape[1],shape[2],pw/bounds.w,ph/bounds.h);
  const mesh=a.image(tex,bounds.x,bounds.y,bounds.w,bounds.h);
  shader(mesh,'recruit-portrait',{...u,artBox:{value:uv},imageArea:{value:new Vector2(bounds.w,bounds.h)},fade:{value:small ? .82 : .58}},
    'uniform vec4 artBox;uniform vec2 imageArea;uniform float fade;uniform vec3 hand;',`
      vec2 p=(cardPos-artBox.xy+hand.xy*hand.z*7./imageArea)/artBox.zw;
      if(any(lessThan(p,vec2(0.)))||any(greaterThan(p,vec2(1.))))discard;
      vec4 photo=texture2D(map,vec2(p.x,1.-p.y));float mask=fade>.8?1.-smoothstep(fade,1.,cardPos.y):
        1.-.0667*smoothstep(.58,.70,cardPos.y)-.9333*smoothstep(.7,1.,cardPos.y);
      diffuseColor=vec4(photo.rgb,photo.a*opacity*mask);`);
}
function reflections(a,b,u){
  const m=a.quad(b.x,b.y,b.w,b.h,'#fff');
  shader(m,'recruit-holo',u,'uniform vec3 metal,light,hand;uniform vec2 pixels;uniform float seconds,reduced;',`
    vec2 p=cardPos;vec2 rim=min(p-vec2(.03,.018),vec2(.97,.982)-p)*pixels;
    if(min(rim.x,rim.y)<0.||p.x+p.y<.08||p.x+p.y>1.90)discard;
    float edge=1.-smoothstep(.45,1.65,min(rim.x,rim.y));
    float sweep=mod(seconds+2.,4.8)/4.8;
    float band=(1.-smoothstep(0.,.085,abs(p.x*.79+p.y*.21-mix(-.24,1.24,smoothstep(.18,.52,sweep)))))*.17*(1.-reduced);
    float gloss=max(0.,1.-length((p-vec2(.5)-hand.xy)*vec2(1.7,1.05)))*hand.z*.17;
    float foil=smoothstep(.60,.88,p.y)*max(0.,1.-abs(fract(p.x*.65+p.y*.35-seconds*.1538)-.45)*4.)*.07;
    float sparkle=0.;float xs[12]=float[]( .06,.92,.12,.85,.03,.95,.18,.77,.09,.89,.32,.68);
    for(int i=0;i<12;i++){
      float k=float(i),q=mod(seconds*.26+k*.16,1.),y=.17+mod(k*19.,76.)*.01;
      vec2 center=vec2(.02+.96*xs[i],.03+.93*y);
      if(reduced<.5)center.y+=(.5-q)*.064;
      vec2 d=(p-center)*pixels;
      float twinkle=reduced>.5?.6:pow(max(0.,sin(3.1416*q)),2.)*.8;
      float star=exp(-length(d)*.72);
      if(i%3==0)star=max(star,max(exp(-abs(d.x)*1.6-abs(d.y)*.36),exp(-abs(d.y)*1.6-abs(d.x)*.36)));
      sparkle=max(sparkle,star*twinkle);
    }
    float alpha=min(1.,edge*(.35+.20*cos((p.x+p.y)*3.14+seconds*.8))+band+gloss+foil+sparkle);
    diffuseColor=vec4(sRGBTransferEOTF(vec4(mix(light,vec3(1.),sparkle),1.)).rgb,alpha*opacity);`);
}
export function recruitCard(a,t,b,entry,{small,index,zone,data}){
  const {pilot,item,grade,rarity,note,raw}=entry,begin=a.group.children.length,id='draw-card-'+index;
  if(!pilot){
    slice(a,t,'/art/psd-choice-v1/'+(item.qualityRank===5?'card-red.png':'card-blue.png'),b,9,24);
    const side=.82*b.w,ix=b.x+.09*b.w,iy=b.y+.17*b.h;
    paintRewardItemSlot(a,item,{x:ix,y:iy,size:side},t.image);
    const size=small?clamp(.128*b.w,8,10):clamp(.13*b.w,8,14);
    words(a,item.name,b.x+b.w/2,b.y+.86*b.h-.6*size,size,{color:'#d6eafa',maxWidth:b.w*.88,shadow});
    area(t,'result-item-'+index,item.name,box(ix,iy,side,side),'inspect',{index},zone);
  }else{
    const input={value:new Vector3()},rot={value:new Vector3()},center={value:new Vector2(b.x+b.w/2,b.y+b.h/2)};
    const u={metal:{value:displayColor(grade.color)},light:{value:displayColor(grade.light)},seconds:{value:0},reduced:{value:data.reduced?1:0},hand:input,pixels:{value:new Vector2(b.w,b.h)}};
    if(note)words(a,note,b.x+b.w/2,b.y+(small?7.5:9),small?10:12,{weight:500,color:'#bbcede',maxWidth:b.w,wrap:true});
    foiledPlate(a,t,b,grade,u);portrait(a,t,b,pilot,small,u);reflections(a,b,u);
    const cy=b.y+b.h*(small ? .09 : .085);
    if(!small){
      words(a,pilot.name,b.x+.10*b.w-2,cy,clamp(.08*b.w,13,30),{weight:800,align:'left',color:'#f4f8fb',maxWidth:b.w*.60});
      const f=clamp(.085*b.w,16,32),role=clamp(.042*b.w,10,16),by=b.y+.93*b.h,tx=b.x+b.w*.1;
      words(a,pilot.title||'驾驶员',tx-2,by-.6*f,f,{align:'left',weight:800,maxWidth:b.w*.81,shadow});
      a.quad(tx,by-1.2*f-8,b.w*.486,1,'#c4e3f6',.6);
      words(a,'驾驶员',tx-2,by-1.2*f-13-.65*role,role,{align:'left',weight:400,color:'#c2e4f6',shadow});
    }
    if(rarity)words(a,rarity,small?b.x+b.w*.09-2:b.x+b.w*.92+2,cy,small?clamp(.16*b.w,9,14):clamp(.08*b.w,17,30),{align:small?'left':'right',family:'Georgia,serif',weight:'italic 700',color:grade.light,shadow});
    if(raw.isNew){const bw=Math.min(b.w*.8,small?52:96),y=b.y+(small ? .05 : .12)*b.h+(small ? .18*b.w+4 : 0);
      pic(a,t,'/art/recruit-status-labels-v1/new.png',box(b.x+.93*b.w-bw,y,bw,bw*110/384));}
    t.control(id,[pilot.name,rarity,raw.isNew?'新获得':note].filter(Boolean).join('，'),b,{type:'holo'},{zone,trackPointer:true});
    const meshes=a.group.children.slice(begin);meshes.forEach(m=>tiltMaterial(m,rot,center));
    if(!data.reduced){
      let handX=0,handY=0,active=0,release=0;
      t.pressEffect((press,now)=>{const captured=press?.id===id;
        if(captured){active=1;release=now;handX=press.x-.5;handY=press.y-.5;}
        const elapsed=now-data.entered-.065*index-.4,sway=Math.cos(Math.max(0,elapsed)/5.8*Math.PI*2);
        if(!captured)active=Math.max(0,1-(now-release)/.4);
        u.seconds.value=Math.max(0,now-data.entered);input.value.set(handX,handY,active);
        rot.value.set(((-1.5*sway)*(1-active)-handY*17*active)*Math.PI/180,((-4*sway)*(1-active)+handX*21*active)*Math.PI/180,0);
        center.value.y=b.y+b.h/2-(zone?t.offset(zone):0);
      });
      t.animate(()=>true);
    }
  }
  animateMeshes(t,a.group.children.slice(begin),b.x+b.w/2,b.y+b.h/2,{entered:data.entered,reduced:data.reduced,delay:.065*Math.min(9,index),duration:.42,
    curve:[0,0,.58,1],frames:[{at:0,y:12,scale:.96,opacity:0},{at:1}]});
}
