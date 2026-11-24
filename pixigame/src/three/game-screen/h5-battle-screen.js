import {loadArtwork} from './image-loading.js';
import * as T from 'three';
import {createBattleStage} from './three-battle-stage.js';
import {MISSILE_ART_KEYS} from '../../../replica-battle/kernel/pathogenic/missile-presentation.mjs';

export function openBattleScreen(slot,device) {
  const canvas=device.display.input,css=canvas.getAttribute('style');
  return openThreeBattleSurface(device,{
    input:canvas,
    bounds:()=>slot.getBoundingClientRect(),
    attach(){
      slot.appendChild(canvas);canvas.className='';canvas.dataset.battleRenderer='three';
      canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;pointer-events:none';
    },
    detach(){
      delete canvas.dataset.battleRenderer;
      if(!device.cover)device.home.append(canvas);
      if(css===null)canvas.removeAttribute('style');else canvas.setAttribute('style',css);
    },
    begin:()=>device.display.begin(slot,540,960,null),
  });
}

export function openThreeBattleSurface(device,host) {
  const renderer=device.three;
  const saved={
    target:renderer.getRenderTarget(),vp:renderer.getViewport(new T.Vector4()),sc:renderer.getScissor(new T.Vector4()),
    test:renderer.getScissorTest(),clear:renderer.autoClear,color:renderer.getClearColor(new T.Color()),
    alpha:renderer.getClearAlpha(),tone:renderer.toneMapping,exposure:renderer.toneMappingExposure,space:renderer.outputColorSpace,
  };
  const battle={bounds:host.bounds,show:host.attach};
  device.battle=battle;if(!device.cover)battle.show();
  renderer.setRenderTarget(null);renderer.setPixelRatio(1);renderer.setScissorTest(false);
  const stage=createBattleStage(renderer,host);
  stage.refreshViewport=()=>stage.setViewport(host.frame?.());
  stage.refreshViewport();
  stage.outputTarget=()=>{
    const output=device.cover?.battleTarget;
    if(output){const {width,height}=stage.glow.outputSize;if(output.width!==width||output.height!==height)output.setSize(width,height);}
    return output??null;
  };
  stage.beginOutput=()=>host.begin(stage.glow.outputSize);
  stage.afterFrame=()=>{if(device.cover)device.cover.present?.();else device.display.present();};
  let disposed=false;
  return {renderer,stage,canvas:host.input,session:battle,close(){
    if(disposed)return;disposed=true;stage.dispose();
    if(device.battle===battle)device.battle=null;
    host.detach();
    renderer.toneMapping=saved.tone;renderer.toneMappingExposure=saved.exposure;renderer.outputColorSpace=saved.space;
    renderer.autoClear=saved.clear;renderer.setClearColor(saved.color,saved.alpha);
    renderer.setRenderTarget(saved.target);renderer.setViewport(saved.vp);renderer.setScissor(saved.sc);renderer.setScissorTest(saved.test);
  }};
}

export class BattleArt {
  constructor(records,baseURL){
    this.baseURL=baseURL;
    this.records=records;this.bindings=new Map();this.pending=new Map();this.authoredSizes=new Map();this.onDemand=new Map();this.closed=false;
  }
   expectSize(key,width,height){if(width>0&&height>0)this.authoredSizes.set(key,[width,height]);}
  preload(key,url=this.records[key]?.url) {
    if(!url||this.closed)return;
    if(this.bindings.has(key))return this.bindings.get(key);
    if(this.pending.has(key))return this.pending.get(key);
    const loaded=loadArtwork(new URL(url,this.baseURL).href).then(image=>{
      if(this.closed)return;
      const texture=new T.Texture(image);
      const width=image.naturalWidth||image.width,height=image.naturalHeight||image.height;
      const size=this.authoredSizes.get(key);
      const compactMissile=Boolean(size&&width<size[0]&&height<size[1]&&MISSILE_ART_KEYS.includes(key));
      // The compact body uses mipmaps for its solid outline. The exhaust keeps its soft alpha from the prepared image.
      const minFilter=key==='coins'?T.LinearMipmapLinearFilter:
        compactMissile&&key===MISSILE_ART_KEYS[0]?T.LinearMipmapNearestFilter:T.LinearFilter;
      const mipmaps=minFilter!==T.LinearFilter,premultiplied=mipmaps||compactMissile;
      texture.flipY=false;texture.premultiplyAlpha=premultiplied;texture.generateMipmaps=mipmaps;
      texture.minFilter=minFilter;texture.magFilter=T.LinearFilter;
      texture.colorSpace=T.NoColorSpace;texture.needsUpdate=true;
      const result={texture,premultiplied,width,height,frames:new Map()};
      if(size&&(size[0]!==result.width||size[1]!==result.height))result.pathogenicLogicalSize=size;
      this.bindings.set(key,result);return result;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,loaded);return loaded;
  }
  defer(key,url){if(url)this.onDemand.set(key,url);}
  get(key){
    const loaded=this.bindings.get(key),url=this.onDemand.get(key);
    if(!loaded&&url&&!this.closed){
      this.onDemand.delete(key);
      this.preload(key,url)?.catch(error=>{if(!this.closed)console.warn('[Three 按需贴图]',key,error?.message||error);});
    }
    return loaded;
  }
  async loadAll(entries,progress,onDecoded,{workers=12,onFailure}={}){
    const queue=Array.from(new Map(entries));
    let next=0,done=0;progress?.(0);
    await Promise.all(Array.from({length:Math.min(queue.length,workers)},async()=>{
      while(!this.closed&&next<queue.length){
        const [key,url]=queue[next++];
        try{
          const entry=await this.preload(key,url);
          if(entry)onDecoded?.(key,entry.texture);
        }catch(error){if(!onFailure)throw error;onFailure(key,error);}
        if(!this.closed)progress?.(++done/queue.length);
      }
    }));
  }
  dispose(){this.closed=true;for(const b of this.bindings.values())b.texture.dispose();this.bindings.clear();this.onDemand.clear();}
}
