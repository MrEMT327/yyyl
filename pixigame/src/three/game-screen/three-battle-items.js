import * as T from 'three';
import baked from './battle-art.json';
import {moduleProfile,airdropModulePose} from '../../../replica-battle/kernel/pickup-presentation.ts';
import {updateSupplyChestVisual} from './supply-motion.js';
import {BattleGeometry} from './three-battle-geometry.js';

const files={digits:'/art/project-damage-numbers-v1/digits.png',medkit:'./assets/project-medkit-v1/medical-case-front-v1.png',
  shell:'./assets/airdrop-modules-v1/module-shell.png',crate:'./assets/project-airdrop-supply/airdrop-crate-front-v1.png'};
export const supplyCanopyKey='project-supply-parachute-v1';
export function queueBattleArt(host){
  for(const [key,url] of Object.entries({...files,...baked.images}))host.queue(key,url);
}
export function region(mesh,b,x,y,w,h){
  mesh.material.uniforms.art.value=b.texture;mesh.material.uniforms.region.value.set(x/b.width,y/b.height,w/b.width,h/b.height);
}
function part(host,group,key,depth){
  const mesh=host.stage.makeSprite(host.art.get(key),depth,group);
  return mesh;
}
function additive(mesh){mesh.material.blendDst=T.OneFactor;return mesh;}
function obtain(host,key,create){
  host.active.add(key);let node=host.objects.get(key);
  if(!node){node=create();host.objects.set(key,node);host.stage.scene.add(node);}
  return node;
}
function opacity(node,a){node.material.uniforms.opacity.value=a;}
function sized(node,w,h){node.material.uniforms.size.value.set(w,h);return node;}
function locate(node,x,y){node.position.set(x,y,0);return node;}
function group(){return new T.Group();}

// Keep each damage label in draw order as a single mesh. Positions are in
// atlas font units so scaling or moving a label never rebuilds its buffers.
function writeGlyphRun(mesh,table,text,height,art){
  const runs=Array.from(text,c=>table[c]||table['?']).filter(Boolean);
  const advance=runs.reduce((sum,r)=>sum+r[6],0);
  let geometry=mesh.geometry;
  if(!geometry.hasAttribute('position')||geometry.getAttribute('position').count<runs.length*4){
    const capacity=Math.max(8,runs.length),indices=[];
    geometry.dispose();mesh.geometry=geometry=new T.BufferGeometry();
    geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(capacity*12),3).setUsage(T.DynamicDrawUsage));
    geometry.setAttribute('uv',new T.BufferAttribute(new Float32Array(capacity*8),2).setUsage(T.DynamicDrawUsage));
    for(let i=0;i<capacity*4;i+=4)indices.push(i,i+2,i+1,i+2,i+3,i+1);
    geometry.setIndex(indices);
  }
  const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
  let cursor=-advance/2,i=0;
  for(const [x,y,w,h,dx,dy,step] of runs){
    const left=cursor+dx,top=dy-height*.5,right=left+w,bottom=top+h;
    const u0=x/art.width,u1=(x+w)/art.width;
    const v0=(art.framebuffer?y+h:y)/art.height,v1=(art.framebuffer?y:y+h)/art.height;
    positions.setXY(i,left,top);positions.setXY(i+1,right,top);
    positions.setXY(i+2,left,bottom);positions.setXY(i+3,right,bottom);
    uv.setXY(i,u0,v0);uv.setXY(i+1,u1,v0);uv.setXY(i+2,u0,v1);uv.setXY(i+3,u1,v1);
    cursor+=step;i+=4;
  }
  positions.needsUpdate=true;uv.needsUpdate=true;geometry.setDrawRange(0,runs.length*6);geometry.boundingSphere=null;
  return advance;
}

export function floatingText(host,fx,layout){
  const text=String(fx.value??'');if(!text)return;
  const numeric=/^[+\-−]?\d+$/.test(text),table=numeric?baked.digits:baked.glyphs,key=numeric?'digits':'combat-labels';
  const ref=numeric?72:64,height=numeric?76:84,unit=layout.fontSize/ref;
  const node=obtain(host,'text:'+fx.uid,group),art=host.art.get(key);
  if(!art)return;
  let glyph=node.children[0];
  if(node.userData.text!==text||node.userData.art!==art){
    if(glyph)host.stage.remove(glyph);
    glyph=host.stage.makeLabelSprite(art,layout.depth,node);
    node.userData.advance=writeGlyphRun(glyph,table,text,height,art);
    node.userData.text=text;node.userData.art=art;
  }
  glyph.scale.set(unit,unit,1);glyph.renderOrder=layout.depth;
  const pt=host.project(fx.x,fx.z),margin=node.userData.advance*unit*layout.scale/2+4,color=parseInt(layout.color.slice(1),16);
  locate(node,Math.max(margin,Math.min(540-margin,pt.x+layout.x)),Math.max(30,Math.min(948,pt.y+layout.y)));
  node.scale.set(layout.scale,layout.scale,1);
  node.matrixAutoUpdate=!layout.slant;
  if(layout.slant){
    node.updateMatrix();
    // Give the Chinese label the same forward lean as the damage digits.
    node.matrix.elements[4]=layout.slant*layout.scale;
  }
  host.stage.tint(glyph,color);opacity(glyph,layout.alpha);
}

function moduleArt(host,node,profile){
  const index=baked.moduleProfiles.indexOf(profile),b=host.art.get('modules');
  const body=group();node.add(body);
  const shell=sized(part(host,body,'shell',19.0002),60,60);
  function tile(parent,row,layer){
    const m=part(host,parent,'modules',layer);
    region(m,b,index*128,row*128,128,128);return sized(m,64,64);
  }
  const frame=tile(body,0,19.0003),lamp=tile(body,1,19.0004),mark=tile(body,2,19.0005);
  const shadow=tile(node,3,19),beacon=tile(node,4,19.0001);
  return {body,shell,frame,lamp,mark,shadow,beacon};
}
export function pickupArt(host,pickup,alpha){
  const profile=moduleProfile(pickup),healing=pickup.kind==='heart'||pickup.kind==='trigger'&&pickup.modelId===1300008;
  const type=profile?'module':healing?'medkit':pickup.kind==='gold'?'coins':null;
  if(!type)return false;
  const node=obtain(host,'pickup:'+pickup.uid,()=>{
    const g=group();
    if(profile)g.userData.module=moduleArt(host,g,profile);
    else{
      const mesh=part(host,g,type,19);g.userData.art=mesh;
      if(healing){
        const b=host.art.get(type),sx=b.width/1254,sy=b.height/1254;
        region(mesh,b,Math.round(115*sx),Math.round(94*sy),Math.round(1024*sx),Math.round(1024*sy));sized(mesh,42,42);
      }
    }
    return g;
  });
  const pos=host.project(pickup.x,pickup.z);locate(node,pos.x,pos.y);node.visible=pickup.age>=pickup.delay;
  if(profile){
    const m=node.userData.module,s=airdropModulePose(pickup);
    locate(m.body,0,s.y);m.body.scale.set(s.scale,s.scale,1);
    [m.frame,m.shell,m.mark,m.shadow].forEach(n=>opacity(n,alpha));
    opacity(m.lamp,s.glow*alpha);opacity(m.beacon,(.35+s.glow)*alpha);
    m.beacon.scale.setScalar(.93+s.glow*.3);
  }else{
    const mesh=node.userData.art;opacity(mesh,alpha);
    if(type==='coins'){
      const p=host.source.coinPose(pickup),atlas=host.art.get(type),s=atlas.width/8;
      region(mesh,atlas,(p.frame%8)*s,Math.floor(p.frame/8)*s,s,s);sized(mesh,p.width,p.height);
    }
  }
  return true;
}
function chest(host){
  const node=group(),data=node.userData;let layer=22;
  function image(key,add=false){
    const m=part(host,node,key,layer+=.00001);return add?additive(m):m;
  }
  function lines(add=false){return new BattleGeometry(node,layer+=.00001,add);}
  const bulb='project-supply-arrival-glow-v1',shaft='project-supply-arrival-beam-v1',smokeKey='project-supply-signal-smoke-v1';
  const idle=locate(sized(image(bulb,true),138,47),0,19);
  const rings=[image('project-supply-arrival-ring-v1',true),image('project-supply-arrival-ring-v1',true)];
  const impact=locate(image(bulb,true),0,18);
  const beamSprite=()=>{const n=image(shaft,true);n.material.uniforms.pivot.value.set(.5,1);return n;};
  const halo=beamSprite(),beam=beamSprite(),streaks=Array.from({length:7},beamSprite);
  const dust=Array.from({length:5},()=>{const n=image(smokeKey);host.stage.tint(n,0xc2b8a5);return n;});
  const smoke=Array.from({length:16},(_,i)=>{const n=image(smokeKey);host.stage.tint(n,[0xe06b6a,0xcc394b,0xaf263b][i%3]);return n;});
  const cords=lines(),canopyArt=host.art.get(supplyCanopyKey);
  cords.reserve(420);
  const canopy=host.stage.makeSprite(canopyArt??host.stage.white,layer+=.00001,node);
  canopy.visible=Boolean(canopyArt);
  const crate=image('crate'),sparks=lines(true),b=host.art.get('crate');
  data.supplyChestHeight=76*b.height/b.width;data.supplyChestBody=crate;
  data.supplyChestLights={height:960,halo,beam,impact,idle,rings,streaks,dust,sparks,canopy,cords,smoke};
  data.progress=new BattleGeometry(node,50);return node;
}
export function treasureArt(host,t,animationAge){
  const node=obtain(host,'treasure:'+t.uid,()=>chest(host)),pos=host.project(t.x,t.z);
  const f=node.userData.supplyChestLights;
  if(!f.canopy.visible){
    const binding=host.art.get(supplyCanopyKey);
    if(binding){
      f.canopy.material.uniforms.art.value=binding.texture;
      f.canopy.visible=true;
    }
  }
  locate(node,pos.x,pos.y);updateSupplyChestVisual(node,t,host.source.supplyDuration(t),animationAge);
  f.cords.flush();f.sparks.flush();
  const bar=node.userData.progress;bar.clear();
  if(t.progress>0&&t.animation!=='Death'){
    bar.quad(-27,30,27,30,27,39,-27,39,0x091014,.9);const right=-25+50*t.progress;
    bar.quad(-25,32,right,32,right,37,-25,37,0xffdc45,1);
  }
  bar.flush();
}

