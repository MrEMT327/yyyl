import {Texture} from 'three';

const pending=new Map(),queue=[];
let active=0;
function pump(){
  while(active<6&&queue.length){
    const job=queue.shift();active++;
    job().finally(()=>{active--;pump();});
  }
}
function readImage(url){
  return new Promise((resolve,reject)=>{
    const image=new Image();
    if(!url.startsWith('data:'))image.crossOrigin='anonymous';
    image.onload=()=>{image.onload=image.onerror=null;resolve(image);};
    image.onerror=()=>{image.onload=image.onerror=null;reject(new Error('无法读取贴图 '+url));};
    image.src=url;
  });
}
export function loadArtwork(url){
  const key=new URL(url,document.baseURI).href;
  if(pending.has(key))return pending.get(key);
  const promise=new Promise((resolve,reject)=>{
    queue.push(async()=>{
      try{
        let image;
        try{image=await readImage(key);}
        catch{await new Promise(done=>setTimeout(done,220));image=await readImage(key);}
        resolve(image);
      }catch(error){reject(error);}
      finally{pending.delete(key);}
    });
  });
  pending.set(key,promise);pump();return promise;
}
export function artworkTexture(url,ready,failed){
  const texture=new Texture();
  loadArtwork(url).then(image=>{texture.image=image;texture.needsUpdate=true;ready?.(texture);},failed);
  return texture;
}
