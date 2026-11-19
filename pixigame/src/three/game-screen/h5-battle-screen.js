import {loadArtwork} from './image-loading.js';
import * as T from 'three';
import {createBattleStage} from './three-battle-stage.js';

export function openBattleScreen(slot,device) {
  const renderer=device.three;
  const canvas=device.display.input,oldParent=canvas.parentNode,next=canvas.nextSibling;
  const saved={
    size:renderer.getSize(new T.Vector2()),ratio:renderer.getPixelRatio(),css:canvas.getAttribute('style'),
    target:renderer.getRenderTarget(),vp:renderer.getViewport(new T.Vector4()),sc:renderer.getScissor(new T.Vector4()),
    test:renderer.getScissorTest(),clear:renderer.autoClear,color:renderer.getClearColor(new T.Color()),
    alpha:renderer.getClearAlpha(),tone:renderer.toneMapping,exposure:renderer.toneMappingExposure,space:renderer.outputColorSpace,
  };
  const battle={bounds:()=>slot.getBoundingClientRect(),show(){
    slot.appendChild(canvas);canvas.className='';canvas.dataset.battleRenderer='three';canvas.style.cssText='display:block;width:100%;height:100%;touch-action:none;pointer-events:none';
  }};
  device.battle=battle;if(!device.cover)battle.show();
  renderer.setRenderTarget(null);renderer.setPixelRatio(1);renderer.setScissorTest(false);
  const stage=createBattleStage(renderer);
  stage.outputTarget=()=>device.cover?.battleTarget??null;
  stage.beginOutput=()=>device.display.begin(slot,540,960,null);
  stage.afterFrame=()=>{if(device.cover)device.cover.present?.();else device.display.present();};
  let disposed=false;
  return {renderer,stage,canvas,session:battle,close(){
    if(disposed)return;disposed=true;stage.dispose();
    if(device.battle===battle)device.battle=null;
    delete canvas.dataset.battleRenderer;
    if(!device.cover)device.home.append(canvas);
    if(saved.css===null)canvas.removeAttribute('style');else canvas.setAttribute('style',saved.css);
    renderer.toneMapping=saved.tone;renderer.toneMappingExposure=saved.exposure;renderer.outputColorSpace=saved.space;
    renderer.autoClear=saved.clear;renderer.setClearColor(saved.color,saved.alpha);
    
    renderer.setRenderTarget(saved.target);renderer.setViewport(saved.vp);renderer.setScissor(saved.sc);renderer.setScissorTest(saved.test);
  }};
}

export class BattleArt {
  constructor(records,baseURL){
    this.baseURL=baseURL;
    this.records=records;this.bindings=new Map();this.pending=new Map();this.closed=false;
  }
  preload(key,url=this.records[key]?.url) {
    if(!url||this.closed)return;
    if(this.bindings.has(key))return this.bindings.get(key);
    if(this.pending.has(key))return this.pending.get(key);
    const loaded=loadArtwork(new URL(url,this.baseURL).href).then(image=>{
      if(this.closed)return;
      const texture=new T.Texture(image);
      texture.flipY=false;texture.premultiplyAlpha=false;texture.generateMipmaps=false;
      texture.minFilter=texture.magFilter=T.LinearFilter;
      texture.colorSpace=T.NoColorSpace;texture.needsUpdate=true;
      const result={texture,width:image.naturalWidth,height:image.naturalHeight,frames:new Map()};
      this.bindings.set(key,result);return result;
    }).finally(()=>this.pending.delete(key));
    this.pending.set(key,loaded);return loaded;
  }
  get(key){return this.bindings.get(key);}
  async loadAll(entries,progress){
    const queue=Array.from(new Map(entries));
    let next=0,done=0;progress?.(0);
    await Promise.all(Array.from({length:Math.min(queue.length,12)},async()=>{
      while(!this.closed&&next<queue.length){
        const [key,url]=queue[next++];await this.preload(key,url);progress?.(++done/queue.length);
      }
    }));
  }
  dispose(){this.closed=true;for(const b of this.bindings.values())b.texture.dispose();this.bindings.clear();}
}

