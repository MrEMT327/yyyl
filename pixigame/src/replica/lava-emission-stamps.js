import {findLavaBubbleSites} from './lava-motion.js';

const unit=value=>Math.max(0,Math.min(1,value));

// Red/orange melt only. The pale warm highlights on purple basalt, sulfur
// deposits, dark holes and transparent edge pixels must not become lamps.
export function lavaEmissionStrength(r,g,b,a){
  return a/255*unit((r-Math.max(g,b)-12)/48)*unit((r-1.45*b-8)/48)*unit((r-1.3*g-6)/36);
}

/** Extract once from an already-loaded texture; keep both masks on the GPU.
 * This is a lighting pass, so the original terrain artwork stays unchanged. */
export function createLavaEmissionStamps(scene,prefix){
  const cache=new Map();
  function release(item){
    for(const key of [item.coreKey,item.haloKey])if(scene.textures?.exists(key))scene.textures.remove(key);
    item.core.width=item.core.height=item.halo.width=item.halo.height=0;
  }
  return {
    get(asset,sourceImage){
      const old=cache.get(asset);if(old?.sourceImage===sourceImage)return old;
      const iw=sourceImage?.naturalWidth||sourceImage?.width,ih=sourceImage?.naturalHeight||sourceImage?.height;
      if(!(iw>0&&ih>0))return null;
      if(old)release(old);
      const core=document.createElement('canvas'),halo=document.createElement('canvas');
      const ratio=Math.min(1,256/Math.max(iw,ih));
      core.width=halo.width=Math.max(1,Math.round(iw*ratio));core.height=halo.height=Math.max(1,Math.round(ih*ratio));
      const c=core.getContext('2d',{willReadFrequently:true}),h=halo.getContext('2d');
      c.drawImage(sourceImage,0,0,core.width,core.height);
      const pixels=c.getImageData(0,0,core.width,core.height),data=pixels.data;
      const bubbleSites=findLavaBubbleSites(data,core.width,core.height,asset);
      for(let i=0;i<data.length;i+=4){
        const baseAlpha=lavaEmissionStrength(data[i],data[i+1],data[i+2],data[i+3]);
        // The long river keeps its dark moving surface. Only its painted hot
        // streaks receive strong bloom, rather than flattening the whole bed.
        const alpha=asset==='river'?baseAlpha*(.20+.80*unit((data[i]-90)/140)):baseAlpha;
        // A warm orange core retains structure; it never becomes white-hot.
        data[i]=255;data[i+1]=84+data[i+1]*.32;data[i+2]=12;data[i+3]=Math.round(alpha*230);
      }
      c.putImageData(pixels,0,0);
      h.filter='blur(9px)';h.globalAlpha=.58;h.drawImage(core,0,0);
      h.filter='blur(3px)';h.globalAlpha=.42;h.drawImage(core,0,0);h.filter='none';h.globalAlpha=1;
      const item={sourceImage,core,halo,bubbleSites,coreKey:`${prefix}-${asset}-core`,haloKey:`${prefix}-${asset}-halo`};
      scene.textures.addCanvas(item.coreKey,core);scene.textures.addCanvas(item.haloKey,halo);cache.set(asset,item);
      return item;
    },
    dispose(){for(const item of cache.values())release(item);cache.clear();},
  };
}
