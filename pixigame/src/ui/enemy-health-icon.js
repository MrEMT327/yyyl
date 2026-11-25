import {createTextureCanvas} from './three-surface.js';
import {releaseOwnedCanvas} from './release-owned-canvas.js';

function tintOuterStroke({data,width,height}){
  const seen=new Uint8Array(width*height),queue=new Uint32Array(seen.length);
  let count=0;
  function visit(index){
    if(seen[index])return;
    const i=index*4,r=data[i],g=data[i+1],b=data[i+2],a=data[i+3];
    // Reach the pale stroke through transparency. The dark contour protects the eyes and teeth.
    if(a>24&&(g<78||Math.max(r,g,b)-Math.min(r,g,b)>65))return;
    seen[index]=1;queue[count++]=index;
    if(a){data[i]=60;data[i+1]=34;data[i+2]=70;}
  }
  for(let x=0;x<width;x++){visit(x);visit((height-1)*width+x);}
  for(let y=0;y<height;y++){visit(y*width);visit((y+1)*width-1);}
  for(let i=0;i<count;i++){
    const index=queue[i],x=index%width;
    if(x>0)visit(index-1);
    if(x+1<width)visit(index+1);
    if(index>=width)visit(index-width);
    if(index+width<seen.length)visit(index+width);
  }
}

export function prepareEnemyHealthIcon(image){
  let surface;
  try{
    const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
    surface=createTextureCanvas();surface.width=width;surface.height=height;
    const ctx=surface.getContext('2d',{willReadFrequently:true});
    ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,width,height);
    tintOuterStroke(pixels);
    ctx.putImageData(pixels,0,0);
    return surface;
  }catch{
    releaseOwnedCanvas(surface);
    return image;
  }
}
