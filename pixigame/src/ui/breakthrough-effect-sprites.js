import {cloudAssetBase} from './cloud-asset-base.js';
// Original artwork is never loaded. These cached alpha sprites are project
// geometry, driven by the separately audited native numeric particle profile.
const SIZE=256,LIMIT=16,bases=new Map(),tints=new Map();
let atlas=null;
if(typeof Image!=='undefined'){
  const pending=new Image();pending.onload=()=>{atlas=pending;bases.clear();tints.clear();};pending.src=cloudAssetBase+'art/project-breakthrough-vfx-v1/energy-atlas-v1.png';
}
function paintAtlas(c,texture,key,index,columns,rows){
  const cells={ray:key.endsWith('v00')||key.endsWith('v06')?7:0,softGlow:1,shockwave:2,star:3,fleck:4,rune:5,noise:6};
  const cell=cells[texture.kind];if(!atlas||cell===undefined)return false;
  const cw=atlas.naturalWidth/4,ch=atlas.naturalHeight/2,sourceX=(cell%4)*cw,sourceY=Math.floor(cell/4)*ch;
  c.save();if(columns*rows>1)c.rotate((index-4)*.025);
  c.drawImage(atlas,sourceX,sourceY,cw,ch,-1,-1,2,2);c.restore();return true;
}
function surface(){const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;return {canvas,ctx:canvas.getContext('2d')};}
function shape(c,kind,index=0){
  const glow=(stops)=>{const g=c.createRadialGradient(0,0,0,0,0,1);for(const [at,a]of stops)g.addColorStop(at,`rgba(255,255,255,${a})`);c.fillStyle=g;c.fillRect(-1,-1,2,2);};
  if(kind==='whiteWash'){c.fillStyle='#fff';c.fillRect(-1,-1,2,2);return;}
  if(kind==='softGlow'){glow([[0,1],[.22,.84],[.55,.26],[1,0]]);return;}
  if(kind==='shockwave'){glow([[0,0],[.55,0],[.68,.07],[.74,.5],[.78,1],[.83,.38],[.94,0],[1,0]]);return;}
  if(kind==='noise'){
    for(let i=0;i<30;i++){const y=-1+i/15;c.strokeStyle=`rgba(255,255,255,${.12+(i%5)*.12})`;c.lineWidth=.018+(i%3)*.009;c.beginPath();for(let j=0;j<=20;j++){const x=-1+j/10,v=y+.11*Math.sin(x*9+i*2.4)+.045*Math.sin(x*23+i);j?c.lineTo(x,v):c.moveTo(x,v);}c.stroke();}return;
  }
  if(kind==='fleck'){const size=.7-.04*(index%4);c.fillStyle='#fff';c.beginPath();c.moveTo(0,-size);c.lineTo(size*.38,0);c.lineTo(0,size);c.lineTo(-size*.38,0);c.closePath();c.fill();return;}
  if(kind==='rune'){
    c.strokeStyle='rgba(255,255,255,.75)';c.lineWidth=.016;
    for(const side of [-1,1])for(const end of [-1,1]){c.beginPath();c.moveTo(side*.42,end*.88);c.lineTo(side*.73,end*.7);c.lineTo(side*.73,end*.35);c.stroke();c.beginPath();c.moveTo(side*.34,end*.65);c.lineTo(side*.49,end*.52);c.stroke();}return;
  }
  glow([[0,.9],[.16,.4],[.48,.06],[1,0]]);c.globalCompositeOperation='lighter';
  const spikes=kind==='star'?4:8;
  for(let i=0;i<spikes;i++){
    c.save();c.rotate(i*Math.PI*2/spikes);const g=c.createLinearGradient(0,0,0,-1);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.22,'rgba(255,255,255,.66)');g.addColorStop(1,'rgba(255,255,255,0)');c.fillStyle=g;
    c.beginPath();c.moveTo(-.035,0);c.lineTo(-.012,-.45);c.lineTo(0,-1);c.lineTo(.012,-.45);c.lineTo(.035,0);c.fill();c.restore();
  }
}
function base(key,texture){
  if(bases.has(key))return bases.get(key);
  const s=surface(),cols=texture.sheet?.columns||1,rows=texture.sheet?.rows||1;
  for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){s.ctx.save();s.ctx.translate((x+.5)*SIZE/cols,(y+.5)*SIZE/rows);s.ctx.scale(SIZE/(cols*2),SIZE/(rows*2));if(!paintAtlas(s.ctx,texture,key,y*cols+x,cols,rows))shape(s.ctx,texture.kind,y*cols+x);s.ctx.restore();}
  // Interpret grayscale luminance as the optical mask, preserving generated
  // transparency. Color remains controlled by the original numeric gradients.
  if(atlas&&texture.kind!=='whiteWash'){const pixels=s.ctx.getImageData(0,0,SIZE,SIZE);for(let i=0;i<pixels.data.length;i+=4){const light=Math.max(pixels.data[i],pixels.data[i+1],pixels.data[i+2])/255;pixels.data[i+3]=Math.round(pixels.data[i+3]*light);pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=255;}s.ctx.putImageData(pixels,0,0);}
  bases.set(key,s.canvas);return s.canvas;
}
function uvPattern(c,image,st,speed,time){
  const sx=st?.scale?.x??1,sy=st?.scale?.y??1,ox=(st?.offset?.x||0)+(speed?.r||0)*time,oy=(st?.offset?.y||0)+(speed?.g||0)*time;
  const p=c.createPattern(image,'repeat');p.setTransform(new DOMMatrix([1/sx,0,0,1/sy,-ox*SIZE/sx,-oy*SIZE/sy]));c.fillStyle=p;c.fillRect(0,0,SIZE,SIZE);
}
function raster(sprite,material,texture,textures,time){
  const flow=material.shaderName==='Effects/UVFlow',gain=sprite.blend==='add'?1:(sprite.tintGain||1);
  const tint=[16,8,0].reduce((v,shift)=>v|(Math.min(255,Math.round(((sprite.tint>>shift)&255)*gain))<<shift),0);
  const cacheKey=`${sprite.key}/${tint}/${material.name}/${flow?time:0}`;
  if(tints.has(cacheKey)){const found=tints.get(cacheKey);tints.delete(cacheKey);tints.set(cacheKey,found);return found.canvas;}
  let s;if(tints.size>=LIMIT){const key=tints.keys().next().value;s=tints.get(key);tints.delete(key);}else s=surface();
  const c=s.ctx;c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.clearRect(0,0,SIZE,SIZE);
  const main=material.textures.find(t=>t.slot==='_MainTex'),image=base(sprite.key,texture);
  if(flow){uvPattern(c,image,main,material.colors?._MainSpeed,time);const mask=material.textures.find(t=>t.slot==='_MaskTex');if(mask){c.globalCompositeOperation='destination-in';uvPattern(c,base(mask.key,textures[mask.key]),mask,material.colors?._MaskSpeed,time);}}
  else if(main?.scale?.x!==1||main?.scale?.y!==1||main?.offset?.x||main?.offset?.y)uvPattern(c,image,main,null,0);
  else c.drawImage(image,0,0);
  c.globalCompositeOperation='source-in';c.fillStyle=`#${tint.toString(16).padStart(6,'0')}`;c.fillRect(0,0,SIZE,SIZE);c.globalCompositeOperation='source-over';tints.set(cacheKey,s);return s.canvas;
}
export function drawNativeGeometrySprite(ctx,draw,textures,time){
  const {sprite:s,material}=draw,texture=textures[s.key];if(!texture||!s.width||!s.height)return;
  const image=texture.kind==='whiteWash'?null:raster(s,material,texture,textures,time),crop=s.crop;
  const source=crop?{x:crop.x/texture.width*SIZE,y:crop.y/texture.height*SIZE,width:crop.width/texture.width*SIZE,height:crop.height/texture.height*SIZE}:{x:0,y:0,width:SIZE,height:SIZE};
  ctx.save();ctx.translate(s.x,-s.z);ctx.rotate(s.rotation);ctx.scale(Math.sign(s.width),Math.sign(s.height));ctx.imageSmoothingEnabled=texture.settings?.m_FilterMode!==0;
  const w=Math.abs(s.width),h=Math.abs(s.height),gain=s.blend==='add'?(s.tintGain||1):1;
  for(let left=gain;left>1e-6;left-=1){ctx.globalAlpha=s.alpha*Math.min(1,left);if(image)ctx.drawImage(image,source.x,source.y,source.width,source.height,-s.originX*w,-s.originY*h,w,h);else{ctx.fillStyle=`#${s.tint.toString(16).padStart(6,'0')}`;ctx.fillRect(-s.originX*w,-s.originY*h,w,h);}}
  ctx.restore();
}
export function disposeNativeGeometrySprites(){bases.clear();tints.clear();}
