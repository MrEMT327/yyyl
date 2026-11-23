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

export function createArtworkLoader({address,openImage,onFailure}){
  const pending=new Map(),queue=[];
  let active=0,scheduled=false;
  function pump(){
    while(active<6&&queue.length){
      let first=0,best=-Infinity;
      for(const [index,job] of queue.entries()){
        let rank=-1;
        for(const priority of job.priorities)rank=Math.max(rank,typeof priority==='function'?priority():priority);
        if(rank>best){first=index;best=rank;}
        if(best===2)break;
      }
      // Leave one slot available when only offscreen or prewarm jobs are waiting.
      if(best<0&&active===5)return;
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
  return function loadArtwork(url,priority){
    let key;
    try{key=address(url);}catch(error){onFailure?.(url,error);return Promise.reject(error);}
    const existing=pending.get(key);
    if(existing){
      if(existing.priorities){existing.priorities.add(priority??0);schedule(priority);}
      return existing.promise;
    }
    const job={priorities:new Set([priority??0])};
    job.promise=new Promise((resolve,reject)=>{
      job.run=async()=>{
        try{
          let image;
          try{image=await openImage(key);}
          catch{await new Promise(done=>setTimeout(done,220));image=await openImage(key);}
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
export function loadArtwork(url,priority){return runtimeArtwork(url,priority);}

export function artworkSize(image){
  return [image?.naturalWidth||image?.width||0,image?.naturalHeight||image?.height||0];
}

export function artworkTexture(url,ready,failed){
  const texture=new Texture();
  loadArtwork(url).then(image=>{texture.image=image;texture.needsUpdate=true;ready?.(texture);},failed);
  return texture;
}
