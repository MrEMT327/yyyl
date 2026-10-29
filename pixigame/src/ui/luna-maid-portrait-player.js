import {createCubismPortraitPlayer} from './cubism-portrait-player.js';
import {createLunaMaidModelAdapter} from './luna-maid-model-adapter.js';

export const LUNA_MAID_ASSET_REVISION='2026-10-26-v10';
export const LUNA_MAID_PLAYBACK=Object.freeze({sampleFps:30,transitionSeconds:.24});

/** Lazy target mesh loading with safe detach/destroy during fetch. */
export function createLunaMaidPortraitPlayer({assetBase=import.meta.env?.BASE_URL??'/'}={}){
 const root=new URL(assetBase,location.href);if(!root.pathname.endsWith('/'))root.pathname+='/';
 const folder=new URL('art/luna-maid-v1/',root);
 if(folder.origin!==location.origin)throw Error('女仆立绘只允许读取同源资源');
 const versioned=name=>{const url=new URL(name,folder);url.searchParams.set('rev',LUNA_MAID_ASSET_REVISION);return url;};
 const controller=new AbortController();let player=null,host=null,loading=null,error=null,destroyed=false,visible=true,paused=false,state='idle',runtime=null,revision=0;
 const updateHost=()=>{if(host&&!player){host.dataset.portraitState=state;host.classList.remove('is-ready');}};
 const read=async name=>{const response=await fetch(versioned(name),{signal:controller.signal});if(!response.ok)throw Error(`女仆立绘读取失败 (${response.status}): ${name}`);return response.json();};
 async function load(){
  state='loading';updateHost();
  try{
   const [config,binding]=await Promise.all([read('runtime.json'),read('target-bindings.json')]);if(destroyed)return false;
   if(config.schema!=='luna-maid-layered-runtime-v1'||binding.schema!=='luna-maid-target-binding-v1'||binding.layers?.length!==config.layers?.length||!config.motionDurations?.idle||!binding.retarget?.armSegmentLimits||!binding.retarget?.continuousHands||!binding.retarget?.sleeveAttachment||!binding.retarget?.bodyVolume||!binding.retarget?.eyeArticulation||!binding.retarget?.completeRearFoot)throw Error('女仆立绘格式不符');
   runtime=config;
   player=createCubismPortraitPlayer({assetBase,modelPath:new URL(config.sourceModel,folder).href,texturePaths:[versioned(config.atlas).href],camera:config.camera,createModelAdapter:model=>createLunaMaidModelAdapter(model,binding),...LUNA_MAID_PLAYBACK,minimumResolution:1.5,initialMemoryBytes:128*1024*1024});
   player.setVisible(visible);player.setPaused(paused);return true;
  }catch(reason){if(destroyed)return false;error=reason;state='error';updateHost();console.warn('女仆动态立绘载入失败，保留静态图。',reason);return false;}
 }
 const ensureLoaded=()=>destroyed?Promise.resolve(false):(loading||=load());
 return{
  async attach(next){
   if(destroyed)return false;if(next&&!next.appendChild)throw new TypeError('立绘需要有效的宿主元素');
   const ticket=++revision,previous=host;
   if(previous!==next&&!player){previous?.classList.remove('is-ready');if(previous)delete previous.dataset.portraitState;}
   host=next||null;if(player)return player.attach(host);if(!host)return false;updateHost();
   if(!await ensureLoaded()||destroyed||ticket!==revision||!host)return false;return player.attach(host);
  },
  setVisible(value){visible=Boolean(value);return player?.setVisible(visible)??Promise.resolve(false);},
  setPaused(value){paused=Boolean(value);player?.setPaused(paused);},
  async playMotion(name,options){if(!await ensureLoaded()||destroyed||!host||!Object.hasOwn(runtime.motionDurations,name))return false;return player.playMotion(name,options);},
  restart(){return player?.restart()??false;},seek(time){return player?.seek(time)??false;},
  seekFrame(frame){return player?.seek(frame/LUNA_MAID_PLAYBACK.sampleFps)??false;},stepFrames(count){return player?.stepFrames(count)??false;},
  captureFrame(size){return player?.captureFrame(size)??null;},
  destroy(){if(destroyed)return;destroyed=true;revision++;controller.abort();player?.destroy();if(host){host.classList.remove('is-ready');for(const key of ['portraitState','motion','time','frame','playing','transition'])delete host.dataset[key];}host=null;state='destroyed';},
  get state(){return destroyed?'destroyed':player?.state??state;},get ready(){return !destroyed&&Boolean(player?.ready);},
  get error(){return player?.error??error;},get playing(){return !destroyed&&Boolean(player?.playing);},get paused(){return player?.paused??paused;},
  get motionName(){return player?.motionName??'idle';},get currentTime(){return player?.currentTime??0;},get duration(){return player?.duration??0;},
  get sampleFps(){return LUNA_MAID_PLAYBACK.sampleFps;},get frameIndex(){return player?.frameIndex??0;},get renderedFrames(){return player?.renderedFrames??0;},
  get availableMotions(){return Object.keys(runtime?.motionDurations??{idle:0,touch_head:0});},get canvas(){return player?.canvas??null;},
  get model(){return player?.model??null;},get renderer(){return player?.renderer??null;},get batcher(){return player?.batcher??null;},get refinementState(){return player?.refinementState??null;},
 };
}
