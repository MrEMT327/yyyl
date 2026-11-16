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

export function queueSourceTexture(scene,key,url,delivery=mobileTextureSizes[key]) {
  if(scene.textures.exists(key)||imagesFor(scene.textures).has(key))return;
  const gl=scene.game.renderer.gl,limit=gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const file=new Phaser.Loader.FileTypes.ImageFile(scene.load,key,url),add=file.addToCache;
  file.addToCache=function(){
    const image=this.data,width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    // Old CDN/cache images remain valid. Only a verified delivery size receives
    // authored coordinates, keeping animation geometry independent of its LOD.
    const scaled=delivery&&width===delivery.size[0]&&height===delivery.size[1];
    const logicalWidth=scaled?delivery.sourceSize[0]:width,logicalHeight=scaled?delivery.sourceSize[1]:height;
    if(width<=limit&&height<=limit){
      const result=add.call(this);
      if(scaled)scene.textures.get(key).source[0].pathogenicLogicalSize=[logicalWidth,logicalHeight];
      return result;
    }
    imagesFor(scene.textures).set(key,{image,width,height,logicalWidth,logicalHeight,limit});
  };
  scene.load.addFile(file);
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
    const texture=scene.textures.addCanvas(regionKey,canvas);
    texture.source[0].pathogenicAtlasOffset=[x/sx,y/sy];
    if(sx!==1||sy!==1)texture.source[0].pathogenicLogicalSize=[width/sx,height/sy];
  }
  return regionKey;
}
