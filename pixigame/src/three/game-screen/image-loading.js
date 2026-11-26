import {Texture} from 'three';

function readImage(url){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    if(!url.startsWith('data:'))image.crossOrigin='anonymous';
    image.onload=()=>{image.onload=image.onerror=null;resolve(image);};
    image.onerror=()=>{image.onload=image.onerror=null;reject(new Error('无法读取贴图 '+url));};
    image.src=url;
  });
}

export function createArtworkLoader({address,openImage,onFailure,cachePixels=0}){
  const pending=new Map(),queue=[];
  const decoded=cachePixels>0?new Map():null;
  let active=0,scheduled=false,cachedPixels=0;
  const canceled=()=>Object.assign(new Error('贴图读取已取消'),{name:'AbortError'});
  function rank(job){
    let value=-Infinity;
    for(const priority of job.priorities)value=Math.max(value,typeof priority==='function'?priority():priority);
    return value;
  }
  function remember(key,image){
    const [w,h]=artworkSize(image),area=w*h;
    if(!(area>0)||area>cachePixels/4)return;
    while(decoded.size>=96||cachedPixels+area>cachePixels){
      const [oldest,entry]=decoded.entries().next().value;
      cachedPixels-=entry.area;decoded.delete(oldest);
    }
    decoded.set(key,{image,area});cachedPixels+=area;
  }
  function pump(){
    while(active<6&&queue.length){
      let first=0,best=-Infinity;
      for(const [index,job] of queue.entries()){
        const value=rank(job);
        if(value>best){first=index;best=value;}
        if(best===2)break;
      }
      if(best===-Infinity){
        const [job]=queue.splice(first,1);
        pending.delete(job.key);job.cancel();
        continue;
      }
      // Catalog prefetch yields to the startup views and leaves transport slots free.
      if((best<-1&&active>=2)||(best<0&&active===5))return;
      const [job]=queue.splice(first,1);
      active++;
      job.run().finally(()=>{active--;pump();});
    }
  }
  function schedule(priority){
    if(priority===undefined){pump();return;}
    if(scheduled)return;
    scheduled=true;
    // A layout submits all its requests before this turn's priorities are read.
    Promise.resolve().then(()=>{scheduled=false;pump();});
  }
  function loadArtwork(url,priority,reuseDecoded=false){
    let key;
    try{key=address(url);}catch(error){onFailure?.(url,error);return Promise.reject(error);}
    const reuse=Boolean(decoded&&reuseDecoded);
    const cached=reuse&&decoded.get(key);
    if(cached){decoded.delete(key);decoded.set(key,cached);return Promise.resolve(cached.image);}
    const existing=pending.get(key);
    if(existing){
      existing.reuse||=reuse;
      existing.priorities.add(priority??0);schedule(priority);
      return existing.promise;
    }
    const job={key,priorities:new Set([priority??0]),reuse};
    job.promise=new Promise((resolve,reject)=>{
      job.cancel=()=>reject(canceled());
      job.run=async()=>{
        const requireConsumer=()=>{if(rank(job)===-Infinity)throw canceled();};
        try{
          let image;
          try{image=await openImage(key,requireConsumer);}
          catch(error){
            if(error?.name==='AbortError'||error?.artworkRetryExhausted)throw error;
            requireConsumer();
            await new Promise(done=>setTimeout(done,220));
            requireConsumer();
            image=await openImage(key,requireConsumer);
          }
          requireConsumer();
          if(job.reuse)remember(key,image);
          resolve(image);
        }catch(error){reject(error);if(error?.name!=='AbortError')onFailure?.(key,error);}
        finally{pending.delete(key);}
      };
    });
    pending.set(key,job);queue.push(job);schedule(priority);return job.promise;
  }
  loadArtwork.decodedCacheStats=()=>({images:decoded?.size??0, pixels:cachedPixels});
  loadArtwork.clearDecoded=()=>{
    decoded?.clear();cachedPixels=0;
    for(const job of pending.values())job.reuse=false;
  };
  return loadArtwork;
}

const browserArtwork=createArtworkLoader({address:url=>new URL(url,document.baseURI).href,openImage:readImage,cachePixels:6400000});
let runtimeArtwork=browserArtwork;
export function useArtworkLoader(loader){
  const original=runtimeArtwork;
  runtimeArtwork=loader;
  return ()=>{if(runtimeArtwork===loader)runtimeArtwork=original;};
}
export function loadArtwork(url,priority,reuseDecoded){return runtimeArtwork(url,priority,reuseDecoded);}

export function artworkSize(image){
  return [image?.naturalWidth||image?.width||0,image?.naturalHeight||image?.height||0];
}

export function uploadArtwork(r,texture,maxPixels){
  const image=texture.image,limit=r.capabilities.maxTextureSize;
  const w=image?.naturalWidth||image?.width,h=image?.naturalHeight||image?.height;
  if(!w||!h||w>limit||h>limit||w*h>maxPixels||r.getContext().isContextLost())return false;
  try{r.initTexture(texture);return true;}catch{return false;}
}

export function createMenuArtworkWarmup(platform){
  const uploaded=new WeakSet();
  return function prepare(textures,maxUploads=4,finishOnSmallUpload=false){
    let count=0,pixels=0;
    for(const texture of textures){
      const image=texture.image;
      if(!image||uploaded.has(texture))continue;
      const area=(image.naturalWidth||image.width)*(image.naturalHeight||image.height);
      if(count&&(count>=maxUploads||pixels+area>400000))return false;
      uploaded.add(texture);
      if(uploadArtwork(platform.renderer,texture,1600000)){count++;pixels+=area;}
    }
    // A small final batch can finish the visible page now. Keep larger
    // uploads and offscreen shader warmup on separate frames.
    return count===0||finishOnSmallUpload&&pixels<=65536;
  };
}

export function artworkTexture(url,ready,failed,priority){
  const texture=new Texture();
  loadArtwork(url,priority).then(image=>{texture.image=image;texture.needsUpdate=true;ready?.(texture);},failed);
  return texture;
}
