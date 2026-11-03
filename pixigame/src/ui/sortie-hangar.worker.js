import * as THREE from 'three';
import {loadFighterPackages} from '../three/aircraft/fighter-packages.js';
import {AIRCRAFT_RENDER_STYLE} from '../three/aircraft/aircraft-lighting.js';
import {createSortieHangarScene} from './sortie-hangar-scene.js';
import {HANGAR_RISE_SECONDS} from './sortie-hangar-motion.js';

// Package nameplates keep their original pixels in workers too. Three's
// ordinary ImageLoader needs a DOM; ImageBitmap decoding does not.
class BitmapObjectLoader extends THREE.ObjectLoader{
  async parseAsync(json){this.textureRows=json.textures||[];return super.parseAsync(json);}
  async parseImagesAsync(rows=[]){
    const images={};
    for(const row of rows){
      const texture=this.textureRows.find(texture=>texture.image===row.uuid);
      const response=await fetch(row.url);if(!response.ok)throw Error('Aircraft nameplate decode failed');
      const bitmap=await createImageBitmap(await response.blob(),{
        imageOrientation:texture?.flipY===false?'none':'flipY',premultiplyAlpha:'none',colorSpaceConversion:'none',
      });
      images[row.uuid]=new THREE.Source(bitmap);
    }
    return images;
  }
}
let renderer,model,frame=0,epoch=null,elapsed=0,paused=true,reduced=false,complete=false,disposed=false;
const now=()=>performance.timeOrigin+performance.now();
function stop(){if(frame)cancelAnimationFrame(frame);frame=0;}
function draw(){
  if(!model)return;
  model.draw(elapsed,reduced);
  if(!complete&&(reduced||elapsed>=HANGAR_RISE_SECONDS)){complete=true;postMessage({type:'complete'});}
}
function tick(){frame=0;if(disposed||paused||!model)return;elapsed=(now()-epoch)/1000;draw();if(!reduced)frame=requestAnimationFrame(tick);}
function dispose(){disposed=true;stop();model?.dispose();renderer?.dispose();renderer?.forceContextLoss();close();}
self.onmessage=async({data})=>{
  try{
    if(data.type==='init'){
      reduced=Boolean(data.reduced);
      const base=data.assetBase;
      await loadFighterPackages({pilotIds:[data.aircraftId],objectLoader:new BitmapObjectLoader(),read:async(slug,name)=>{
        const r=await fetch(new URL(`fighters/${slug}/${name}`,base));if(!r.ok)throw Error(`Aircraft resource ${r.status}`);return r.arrayBuffer();
      }});
      if(disposed)return;
      renderer=new THREE.WebGLRenderer({canvas:data.canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(data.pixelRatio);renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=AIRCRAFT_RENDER_STYLE.exposure;
      data.canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();postMessage({type:'error',message:'context lost'});});
      model=createSortieHangarScene(renderer,data.aircraftId);model.resize(data.width,data.height,data.deckHeight);
      await model.warmup();if(disposed)return;draw();postMessage({type:'ready'});
    }else if(data.type==='start'){
      epoch=data.epoch;elapsed=0;paused=false;stop();draw();if(!reduced)frame=requestAnimationFrame(tick);
    }else if(data.type==='pause'){
      if(!paused&&epoch!==null)elapsed=(now()-epoch)/1000;paused=true;stop();
    }else if(data.type==='resume'){
      if(!model||!paused)return;epoch=now()-elapsed*1000;paused=false;draw();if(!reduced)frame=requestAnimationFrame(tick);
    }else if(data.type==='resize'&&model){model.resize(data.width,data.height,data.deckHeight);draw();}
    else if(data.type==='reduce'){reduced=data.value;stop();draw();if(!reduced&&!paused)frame=requestAnimationFrame(tick);}
    else if(data.type==='dispose')dispose();
  }catch(error){postMessage({type:'error',message:String(error?.message||error)});}
};
