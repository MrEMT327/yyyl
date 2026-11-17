// Layout-only trimming: keep shared artwork and texture data unchanged.
const boundsCache=new WeakMap();
export function opaqueIconBounds(data,width,height) {
  let left=width,top=height,right=-1,bottom=-1;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(data[(y*width+x)*4+3]>24) {
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  if(right<left)return {x:0,y:0,width:1,height:1};
  left=Math.max(0,left-2);top=Math.max(0,top-2);
  right=Math.min(width,right+3);bottom=Math.min(height,bottom+3);
  return {x:left/width,y:top/height,width:(right-left)/width,height:(bottom-top)/height};
}
export function fitUpgradeIcon(imageWidth,imageHeight,crop,box) {
  const aspect=imageWidth*crop.width/(imageHeight*crop.height);
  const width=Math.min(box.width,box.height*aspect),height=width/aspect;
  return {x:box.x+(box.width-width)/2,y:box.y+(box.height-height)/2,width,height};
}
export function upgradeIconLayout(texture,box) {
  const image=texture.image,w=image?.naturalWidth||image?.width,h=image?.naturalHeight||image?.height;
  if(!texture.userData.inventoryIcon||!w||!h)return {...box,crop:null};
  let crop=boundsCache.get(texture);
  if(!crop) {
    try {
      const canvas=globalThis.wx?.createCanvas?.()||document.createElement('canvas');
      canvas.width=128;canvas.height=Math.max(1,Math.round(128*h/w));
      const ctx=canvas.getContext('2d',{willReadFrequently:true});
      ctx.drawImage(image,0,0,canvas.width,canvas.height);
      crop=opaqueIconBounds(ctx.getImageData(0,0,canvas.width,canvas.height).data,canvas.width,canvas.height);
    }catch {crop={x:0,y:0,width:1,height:1};}
    boundsCache.set(texture,crop);
  }
  return {...fitUpgradeIcon(w,h,crop,box),crop};
}
