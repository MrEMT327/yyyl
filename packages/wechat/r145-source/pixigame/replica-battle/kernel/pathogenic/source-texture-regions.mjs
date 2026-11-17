import Phaser from 'phaser';
import {mobileTextureSizes} from './mobile-texture-sizes.mjs';

// Keep oversized animation strips decoded on the CPU. Each requested frame
// receives a full-resolution GPU region instead of an invalid giant upload.
const originalImages = new WeakMap();
function imagesFor(manager) {
  let images=originalImages.get(manager);
  if(!images){images=new Map();originalImages.set(manager,images);}
  return images;
}

// These images are owned by the source-shader renderer. Upload the decoded
// art straight once instead of making a premultiplied texture and replacing
// it on the first shot. Phaser's wrapper retains the image for context restore.
function addSourceImage(scene,key,image,width,height) {
  const renderer=scene.game.renderer,gl=renderer.gl;
  const pot=width>0&&height>0&&(width&(width-1))===0&&(height&(height-1))===0;
  const wrap=pot?gl.REPEAT:gl.CLAMP_TO_EDGE;
  const mag=renderer.config.antialias?gl.LINEAR:gl.NEAREST;
  const min=mag===gl.LINEAR&&pot?renderer.mipmapFilter||mag:mag;
  const active=gl.getParameter(gl.ACTIVE_TEXTURE);
  const pma=gl.getParameter(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL),flip=gl.getParameter(gl.UNPACK_FLIP_Y_WEBGL);
  try{
    const wrapper=renderer.createTexture2D(0,min,mag,wrap,wrap,gl.RGBA,image,width,height,false,true,false);
    const texture=scene.textures.addGLTexture(key,wrapper);
    if(!texture)renderer.deleteTexture(wrapper);
    return texture;
  }finally{
    gl.activeTexture(active);gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL,pma);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,flip);
  }
}

export function queueSourceTexture(scene,key,url,delivery=mobileTextureSizes[key]) {
  if(scene.textures.exists(key)||imagesFor(scene.textures).has(key))return;
  const gl=scene.game.renderer.gl,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const file=new Phaser.Loader.FileTypes.ImageFile(scene.load,key,url);
  file.addToCache=function(){
    const image=this.data,width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    // Old CDN/cache images remain valid. Only a verified delivery size receives
    // authored coordinates, keeping animation geometry independent of its LOD.
    const scaled=delivery&&width===delivery.size[0]&&height===delivery.size[1];
    const logicalWidth=scaled?delivery.sourceSize[0]:width,logicalHeight=scaled?delivery.sourceSize[1]:height;
    if(width<=limit&&height<=limit){
      const texture=addSourceImage(scene,key,image,width,height);
      if(scaled&&texture)texture.source[0].pathogenicLogicalSize=[logicalWidth,logicalHeight];
      return;
    }
    imagesFor(scene.textures).set(key,{image,width,height,logicalWidth,logicalHeight,limit});
  };
  scene.load.addFile(file);
}

export function installMissingSourceTexture(scene,key,descriptor) {
  if(scene.textures.exists(key))return;
  const size=32,center=size/2;
  const texture=scene.textures.createCanvas(key,size,size);
  const ctx=texture.context;
  const halo=ctx.createRadialGradient(center,center,0,center,center,center);
  halo.addColorStop(0,'white');
  halo.addColorStop(.65,'white');
  halo.addColorStop(1,'rgba(255,255,255,0)');
  ctx.fillStyle=halo;
  ctx.fillRect(0,0,size,size);
  texture.source[0].pathogenicLogicalSize=[descriptor.width,descriptor.height];
  texture.source[0].pathogenicFallback=true;
  texture.refresh();
}

export function textureRegion(crop,width,height,limit) {
  const [x,y,w,h]=crop||[0,0,width,height];
  if(![x,y,w,h].every(Number.isFinite)||x<0||y<0||w<=0||h<=0||x+w>width+.01||y+h>height+.01)
    throw new Error('Animation texture region is outside the source image');
  // Preserve neighbouring texels for the same bilinear edge sampling.
  const left=Math.max(0,Math.floor(x)-1),top=Math.max(0,Math.floor(y)-1);
  const right=Math.min(width,Math.ceil(x+w)+1),bottom=Math.min(height,Math.ceil(y+h)+1);
  if(right-left>limit||bottom-top>limit)throw new Error(`Animation frame exceeds the GPU texture limit ${limit}: ${w} x ${h}`);
  return [left,top,right-left,bottom-top];
}

export function sourceTextureKey(scene,descriptor) {
  const key=descriptor?.key,image=originalImages.get(scene.textures)?.get(key);
  if(!image)return key;
  const sx=image.width/image.logicalWidth,sy=image.height/image.logicalHeight;
  const crop=descriptor.crop?.map((value,index)=>value*(index%2?sy:sx));
  const [x,y,width,height]=textureRegion(crop,image.width,image.height,image.limit);
  const regionKey=`pathogenic-region:${key}:${x},${y},${width},${height}`;
  if(!scene.textures.exists(regionKey)) {
    const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
    canvas.getContext('2d').drawImage(image.image,x,y,width,height,0,0,width,height);
    const texture=addSourceImage(scene,regionKey,canvas,width,height);
    texture.source[0].pathogenicAtlasOffset=[x/sx,y/sy];
    if(sx!==1||sy!==1)texture.source[0].pathogenicLogicalSize=[width/sx,height/sy];
  }
  return regionKey;
}
