import {Texture,SRGBColorSpace,LinearFilter,LinearMipmapLinearFilter} from 'three';
import {art} from '../../../../../../../pixigame/src/three/game-screen/menu-art.js';
import {optimizeUiAssetUrls} from '../../../../../../../pixigame/src/ui/ui-image-source.js';

// Optional work on the existing renderer: one job per turn, yielding when
// the previous frame was slow. Never force the foreground view to wait.
export function frameWork(platform,active,fastInterval=28){
  let request=null,last=null,closed=false;
  const jobs=[];
  function resume(){
    if(!closed&&request===null&&jobs.length&&active())request=platform.requestFrame(run);
  }
  function run(time){
    request=null;
    if(closed||!active())return;
    const interval=last===null?0:time-last;
    last=time;
    if(interval<fastInterval||interval>80)jobs.shift()();
    resume();
  }
  return {push(job){if(!closed){jobs.push(job);resume();}},resume,
    close(){closed=true;jobs.length=0;if(request!==null)platform.cancelFrame(request);request=null;}};
}

function upload(platform,texture,maxPixels){
  const r=platform.renderer,image=texture.image,limit=r.capabilities.maxTextureSize;
  const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
  if(!w||!h||w>limit||h>limit||w*h>maxPixels||r.getContext().isContextLost())return false;
  try{r.initTexture(texture);return true;}catch{return false;}
}

export function createMenuArtworkWarmup(platform){
  const uploaded=new WeakSet();
  return function prepare(textures){
    let count=0,pixels=0;
    for(const texture of textures){
      const image=texture.image;
      if(!image||uploaded.has(texture))continue;
      const area=(image.naturalWidth||image.width)*(image.naturalHeight||image.height);
      if(count&&(count>=4||pixels+area>400000))return false;
      uploaded.add(texture);
      if(texture.userData.menuPrewarmed)continue;
      if(upload(platform,texture,1600000)){count++;pixels+=area;}
    }
    // Do not stack the first complete screen draw on an upload frame.
    return count===0;
  };
}

export function prewarmLobbyArtwork(platform,device,active){
  const cache=new Map(),queue=frameWork(platform,active);
  let closed=false,planned=false,last=0,pixels=0;
  const urls=[
    '/art/psd-equipment-v1/equipment-background.webp',art['shop-background'],art['assembly-footer'],art['shop-footer'],
    art['warehouse-toolbar'],art['gear-grid'],art['advanced-tray'],art['basic-tray'],
    art['assembly-heading'],art['shop-heading'],
  ];
  function step(){
    const url=urls.shift();
    if(!url||closed)return;
    const key=optimizeUiAssetUrls(url);
    // A single decode in flight leaves slots for player-triggered artwork.
    platform.loadArtwork(key).then(image=>{
      if(closed)return;
      queue.push(()=>{
        const area=(image.naturalWidth||image.width)*(image.naturalHeight||image.height);
        const texture=new Texture(image);
        texture.colorSpace=SRGBColorSpace;texture.minFilter=LinearMipmapLinearFilter;texture.magFilter=LinearFilter;
        texture.generateMipmaps=true;texture.needsUpdate=true;
        if(pixels+area<=3500000&&upload(platform,texture,1400000)){
          texture.userData.menuPrewarmed=true;cache.set(key,texture);pixels+=area;
        }
        else texture.dispose();
        stepLater();
      });
    },stepLater);
  }
  function stepLater(){queue.push(step);}
  device.preparedArtwork=cache;
  return {tick(){
    if(closed||!active())return;
    const now=platform.now();
    if(!planned){if(!last){last=now;return;}if(now-last<600)return;
      planned=true;stepLater();
    }
    queue.resume();
  },close(){
    closed=true;queue.close();for(const texture of cache.values())texture.dispose();cache.clear();
    if(device.preparedArtwork===cache)delete device.preparedArtwork;
  }};
}

const earlyBattleArt=new Set(['coins','digits','combat-labels','medkit','shell','modules','crate']);
export function prewarmBattleArtwork(platform){
  const work=frameWork(platform,()=>platform.visible,40);
  let count=0,pixels=0;
  return {add(key,texture,priority=false){
    if(count>=36||!(priority||earlyBattleArt.has(key)||/^host:\/\/(?:ice-weapons|ice-particles|warm-energy-shots)/.test(key)))return;
    const {image}=texture,area=(image.naturalWidth||image.width)*(image.naturalHeight||image.height);
    if(!(area>0)||area>2400000||pixels+area>6500000)return;
    count++;pixels+=area;work.push(()=>upload(platform,texture,2400000));
  },push(job){work.push(()=>{
    try{if(!platform.renderer.getContext().isContextLost())job();}
    catch(error){console.warn('[Three 战斗预热]',error?.message||error);}
  });},close:work.close};
}
