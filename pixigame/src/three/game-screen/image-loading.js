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
  let active=0;
  function pump(){
    while(active<6&&queue.length){
      const job=queue.shift();active++;
      job().finally(()=>{active--;pump();});
    }
  }
  return function loadArtwork(url){
    let key;
    try{key=address(url);}catch(error){onFailure?.(url,error);return Promise.reject(error);}
    if(pending.has(key))return pending.get(key);
    const promise=new Promise((resolve,reject)=>{
      queue.push(async()=>{
        try{
          let image;
          try{image=await openImage(key);}
          catch{await new Promise(done=>setTimeout(done,220));image=await openImage(key);}
          resolve(image);
        }catch(error){reject(error);onFailure?.(key,error);}
        finally{pending.delete(key);}
      });
    });
    pending.set(key,promise);pump();return promise;
  };
}

const browserArtwork=createArtworkLoader({address:url=>new URL(url,document.baseURI).href,openImage:readImage});
let runtimeArtwork=browserArtwork;
export function useArtworkLoader(loader){
  const original=runtimeArtwork;
  runtimeArtwork=loader;
  return ()=>{if(runtimeArtwork===loader)runtimeArtwork=original;};
}
export function loadArtwork(url){return runtimeArtwork(url);}

export function artworkSize(image){
  return [image?.naturalWidth||image?.width||0,image?.naturalHeight||image?.height||0];
}

export function artworkTexture(url,ready,failed){
  const texture=new Texture();
  loadArtwork(url).then(image=>{texture.image=image;texture.needsUpdate=true;ready?.(texture);},failed);
  return texture;
}
