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
        let rank=-Infinity;
        for(const priority of job.priorities)rank=Math.max(rank,typeof priority==='function'?priority():priority);
        if(rank>best){first=index;best=rank;}
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
      job.priorities=null;active++;
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
  return function loadArtwork(url,priority,reuseDecoded=false){
    let key;
    try{key=address(url);}catch(error){onFailure?.(url,error);return Promise.reject(error);}
    const reuse=Boolean(decoded&&reuseDecoded);
    const cached=reuse&&decoded.get(key);
    if(cached){decoded.delete(key);decoded.set(key,cached);return Promise.resolve(cached.image);}
    const existing=pending.get(key);
    if(existing){
      existing.reuse||=reuse;
      if(existing.priorities){existing.priorities.add(priority??0);schedule(priority);}
      return existing.promise;
    }
    const job={key,priorities:new Set([priority??0]),reuse};
    job.promise=new Promise((resolve,reject)=>{
      job.cancel=()=>reject(new Error('贴图读取已取消'));
      job.run=async()=>{
        try{
          let image;
          try{image=await openImage(key);}
          catch{await new Promise(done=>setTimeout(done,220));image=await openImage(key);}
          if(job.reuse)remember(key,image);
          resolve(image);
        }catch(error){reject(error);onFailure?.(key,error);}
        finally{pending.delete(key);}
      };
    });
    pending.set(key,job);queue.push(job);schedule(priority);return job.promise;
  };
}

const browserArtwork=createArtworkLoader({address:url=>new URL(url,document.baseURI).href,openImage:readImage});
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

export function artworkTexture(url,ready,failed){
  const texture=new Texture();
  loadArtwork(url).then(image=>{texture.image=image;texture.needsUpdate=true;ready?.(texture);},failed);
  return texture;
}
