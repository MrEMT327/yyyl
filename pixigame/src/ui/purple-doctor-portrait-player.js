import { createCubismPortraitPlayer } from './cubism-portrait-player.js';
import { createPurpleDoctorModelAdapter } from './purple-doctor-model-adapter.js';

export const PURPLE_DOCTOR_PLAYBACK = Object.freeze({sampleFps:30,transitionSeconds:0});

// Keep the large mesh binding out of the initial game bundle. A closed or
// superseded host must not receive a canvas after its asynchronous load finishes.
export function createPurpleDoctorPortraitPlayer({assetBase=import.meta.env?.BASE_URL ?? '/'}={}) {
  const assetRoot=new URL(assetBase,location.href);
  if(!assetRoot.pathname.endsWith('/'))assetRoot.pathname+='/';
  const folder=new URL('art/purple-doctor-v1/',assetRoot);
  if(folder.origin!==location.origin)throw new Error('角色只允许读取同源资源');
  const controller=new AbortController();
  let player=null,host=null,loading=null,error=null,destroyed=false,visible=true,paused=false;
  let state='idle',runtime=null,revision=0;
  const updateHost=()=>{if(!host||player)return;host.dataset.portraitState=state;host.classList.remove('is-ready');};
  const read=async name=>{
    const response=await fetch(new URL(name,folder),{signal:controller.signal});
    if(!response.ok)throw new Error(`医生立绘资源读取失败 (${response.status}): ${name}`);
    return response.json();
  };
  async function load(){
    state='loading';updateHost();
    try{
      const config=await read('runtime.json');
      const binding=await read(config.bindings||'target-bindings.json');
      if(destroyed)return false;
      if(config.schema!=='purple-doctor-layered-runtime-v1'||!config.motionDurations?.idle||binding.layers?.length!==config.layers?.length)throw new Error('医生立绘资源格式不符');
      runtime=config;
      player=createCubismPortraitPlayer({assetBase,modelPath:new URL(config.sourceModel,folder).href,
        texturePaths:[new URL(config.atlas,folder).href],camera:config.camera,
        createModelAdapter:model=>createPurpleDoctorModelAdapter(model,binding),
        ...PURPLE_DOCTOR_PLAYBACK,minimumResolution:1.5});
      player.setVisible(visible);player.setPaused(paused);
      return true;
    }catch(reason){
      if(destroyed)return false;
      error=reason;state='error';updateHost();console.warn('紫发医生立绘载入失败，保留静态图。',reason);return false;
    }
  }
  const ensureLoaded=()=>destroyed?Promise.resolve(false):(loading ||= load());
  const api={
    async attach(next){
      if(destroyed)return false;
      if(next&&!next.appendChild)throw new TypeError('立绘需要有效的宿主元素');
      const ticket=++revision,previous=host;
      if(previous!==next&&!player){previous?.classList.remove('is-ready');if(previous)delete previous.dataset.portraitState;}
      host=next||null;
      if(player)return player.attach(host);
      if(!host)return false;
      updateHost();
      if(!await ensureLoaded()||destroyed||ticket!==revision||!host)return false;
      return player.attach(host);
    },
    setVisible(value){visible=Boolean(value);return player?.setVisible(visible)??Promise.resolve(false);},
    setPaused(value){paused=Boolean(value);player?.setPaused(paused);},
    async playMotion(name){if(!await ensureLoaded()||destroyed||!host)return false;return player.playMotion(name);},
    restart(){return player?.restart()??false;},seek(time){return player?.seek(time)??false;},
    seekFrame(frame){return player?.seek(frame/PURPLE_DOCTOR_PLAYBACK.sampleFps)??false;},stepFrames(count){return player?.stepFrames(count)??false;},
    captureFrame(size){return player?.captureFrame(size)??null;},
    destroy(){
      if(destroyed)return;destroyed=true;revision++;controller.abort();player?.destroy();
      if(host){host.classList.remove('is-ready');for(const key of ['portraitState','motion','time','frame','playing','transition'])delete host.dataset[key];}
      host=null;state='destroyed';
    },
    get state(){return destroyed?'destroyed':player?.state??state;},get ready(){return !destroyed&&Boolean(player?.ready);},
    get error(){return player?.error??error;},get playing(){return !destroyed&&Boolean(player?.playing);},
    get paused(){return player?.paused??paused;},get motionName(){return player?.motionName??'idle';},
    get currentTime(){return player?.currentTime??0;},get duration(){return player?.duration??0;},
    get sampleFps(){return PURPLE_DOCTOR_PLAYBACK.sampleFps;},get frameIndex(){return player?.frameIndex??0;},
    get renderedFrames(){return player?.renderedFrames??0;},get availableMotions(){return player?.availableMotions??Object.keys(runtime?.motionDurations??{});},
    get canvas(){return player?.canvas??null;},get model(){return player?.model??null;},
    get renderer(){return player?.renderer??null;},get batcher(){return player?.batcher??null;},
    get refinementState(){return player?.refinementState??null;},
  };
  return api;
}
