import { createGoldenPositionRefiner } from './golden-position-refiner.js';
import { createGoldenMeshRenderer } from './golden-mesh-renderer.js';

// Plays the delivered target rig. Stored 60 Hz states stay discrete; only the
// explicit native target transitions blend geometry and effective opacity.
export function createGoldenMeshPortraitPlayer({ assetBase=import.meta.env?.BASE_URL ?? '/', manifestPath='art/golden-yoga-v12/runtime.json' }={}) {
  const assetRoot=new URL(assetBase,location.href);
  const sameOrigin=path=>{const u=new URL(path,assetRoot);if(u.origin!==location.origin)throw new Error('角色只允许读取同源资源');return u.href;};
  const manifestUrl=sameOrigin(manifestPath),folder=new URL('./',manifestUrl),controller=new AbortController();
  const records=new Map(),images=new Map(),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');
  let host=null,canvas=null,renderer=null,manifest=null,loading=null,current=null,currentName='idle';
  let state='idle',error=null,visible=true,paused=false,destroyed=false,explicit=false,returnToIdle=true;
  let positions=null,rest=null,opacities=null,orders=null,visibilities=null,transition=null,positionRefiner=null;
  let clock=0,frameIndex=0,raf=0,lastTimestamp=null,rendered=0,request=0;
  const ready=()=>state==='ready';
  const canPlay=()=>ready()&&!destroyed&&host?.isConnected&&visible&&!paused&&!document.hidden&&(!reduced?.matches||explicit);
  function updateHost(){if(!host)return;host.dataset.portraitState=state;host.dataset.motion=currentName;host.dataset.time=clock.toFixed(3);host.dataset.frame=String(frameIndex);host.dataset.playing=String(Boolean(canPlay()));host.dataset.transition=String(Boolean(transition));host.classList.toggle('is-ready',ready());}
  function stop(){if(raf)cancelAnimationFrame(raf);raf=0;lastTimestamp=null;}
  function fail(reason){if(destroyed)return;error=reason;state='error';stop();updateHost();console.warn('Golden target portrait failed',reason);}
  function draw(){if(destroyed||!renderer||!current)return;renderer.draw(positions,opacities,orders,visibilities);rendered++;updateHost();}
  function resize(){if(!renderer||!host)return;const b=host.getBoundingClientRect(),dpr=2;renderer.resize(Math.max(1,Math.round(b.width*dpr)),Math.max(1,Math.round(b.height*dpr)));draw();}
  function beginTransition(startFrame=0){transition={positions:positions.slice(),opacity:Float32Array.from(opacities,(v,i)=>visibilities[i]?v:0),startFrame};}
  function applyFrame(index){
    const spec=current.spec,data=current.data,stride=manifest.strideInt16,count=manifest.positionFloatCount;
    frameIndex=Math.min(spec.frames-1,Math.max(0,index));const offset=frameIndex*stride;
    for(let i=0;i<count;i++)positions[i]=rest[i]+data[offset+i]/manifest.positionScale;
    for(let i=0;i<manifest.meshes.length;i++){
      opacities[i]=Math.min(1,Math.max(0,data[offset+count+i*3]/manifest.opacityScale));
      orders[i]=Math.min(3800,Math.max(-4000,data[offset+count+i*3+1]));
      visibilities[i]=data[offset+count+i*3+2]!==0&&opacities[i]>0?1:0;
    }
    positionRefiner?.apply(positions);
    if(transition){
      const tick=Math.max(0,frameIndex-transition.startFrame),u=Math.min(1,tick/manifest.targetTransitionTicks),alpha=u*u*(3-2*u);
      if(u>=1)transition=null;
      else{
        for(let i=0;i<count;i++)positions[i]=transition.positions[i]+(positions[i]-transition.positions[i])*alpha;
        for(let i=0;i<opacities.length;i++){
          const destination=visibilities[i]?opacities[i]:0;
          opacities[i]=transition.opacity[i]+(destination-transition.opacity[i])*alpha;
          visibilities[i]=opacities[i]>0?1:0;
        }
      }
    }
  }
  function advance(index){
    const next=Math.min(current.spec.frames-1,Math.max(0,index));
    for(const event of current.spec.targetTransitionFrames||[]){
      if(event>frameIndex&&event<=next){applyFrame(event-1);beginTransition(event);}
    }
    applyFrame(next);
  }
  function advanceClock(delta){
    clock+=delta;
    const duration=current.spec.duration;
    if(clock>=duration){
      advance(current.spec.frames-1);
      const remainder=clock-duration;
      if(current.spec.loop){beginTransition(0);clock=remainder%duration;frameIndex=0;applyFrame(0);advance(Math.floor(clock*manifest.fps));}
      else if(returnToIdle){
        const idle=records.get('idle');beginTransition(0);current=idle;currentName='idle';clock=remainder%idle.spec.duration;frameIndex=0;applyFrame(0);advance(Math.floor(clock*manifest.fps));
      }else{clock=duration;paused=true;transition=null;}
    }else advance(Math.floor(clock*manifest.fps));
  }
  function schedule(){
    if(raf||!canPlay())return;
    raf=requestAnimationFrame(timestamp=>{
      raf=0;if(!canPlay()){lastTimestamp=null;return;}
      const delta=lastTimestamp===null?0:Math.max(0,(timestamp-lastTimestamp)/1000);lastTimestamp=timestamp;
      try{advanceClock(delta);draw();schedule();}catch(reason){fail(reason);}
    });
  }
  function sync(){if(!canPlay())stop();updateHost();schedule();}
  async function fetchBytes(path){const response=await fetch(sameOrigin(new URL(path,folder).href),{signal:controller.signal});if(!response.ok)throw new Error(`角色资源读取失败 (${response.status})`);return new Uint8Array(await response.arrayBuffer());}
  async function loadClip(name){
    if(records.has(name))return records.get(name).promise;
    const spec=manifest.clips[name];if(!spec)throw new Error('资源没有该动作：'+name);
    const record={spec,data:null,promise:null};records.set(name,record);
    record.promise=(async()=>{
      let bytes=await fetchBytes(spec.file);
      if(bytes[0]===0x1f&&bytes[1]===0x8b){const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));bytes=new Uint8Array(await new Response(stream).arrayBuffer());}
      const expected=spec.frames*manifest.strideInt16*2;
      if(bytes.byteLength!==expected)throw new Error('角色动作状态长度不符');
      const data=new Int16Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/2);
      if(manifest.temporalDelta)for(let i=manifest.strideInt16;i<data.length;i++)data[i]+=data[i-manifest.strideInt16];
      if(destroyed)throw new DOMException('角色已关闭','AbortError');
      record.data=data;return record;
    })();
    return record.promise;
  }
  async function initialize(){
    state='loading';updateHost();const response=await fetch(manifestUrl,{signal:controller.signal});if(!response.ok)throw new Error('角色资源清单读取失败');manifest=await response.json();
    if(manifest.schema!=='golden-target-mesh-v1'||manifest.encoding!=='int16-rest-delta'||manifest.fps!==60||!manifest.clips?.idle||manifest.strideInt16!==manifest.positionFloatCount+manifest.meshes.length*3)throw new Error('角色资源格式无效');
    rest=new Float32Array(manifest.positionFloatCount);
    for(const mesh of manifest.meshes)rest.set(mesh.vertices,mesh.stateOffset);
    positionRefiner=createGoldenPositionRefiner(manifest);
    positions=rest.slice();opacities=new Float32Array(manifest.meshes.length);orders=new Float32Array(manifest.meshes.length);visibilities=new Uint8Array(manifest.meshes.length);
    await Promise.all(Object.entries(manifest.textures).map(async([id,path])=>{const image=new Image();image.src=sameOrigin(new URL(path,folder).href);await image.decode();images.set(id,image);}));
    if(destroyed)return;
    canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');renderer=createGoldenMeshRenderer(canvas,manifest,images);canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();fail(new Error('角色画布连接已中断'));},{signal:controller.signal});
    current=await loadClip('idle');if(destroyed)return;currentName='idle';clock=0;applyFrame(0);state='ready';if(host)host.append(canvas);resize();sync();
    for(const name of Object.keys(manifest.clips))if(name!=='idle')void loadClip(name).catch(()=>{});
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  const visibility=()=>sync();document.addEventListener('visibilitychange',visibility);
  const api={
    async attach(next){
      if(destroyed)return;
      if(host!==next){if(host){observer?.unobserve(host);host.classList.remove('is-ready');for(const k of ['portraitState','motion','time','frame','playing','transition'])delete host.dataset[k];}host=next;if(!host){canvas?.remove();sync();return;}if(canvas)host.append(canvas);observer?.observe(host);updateHost();}
      if(!host)return;if(!loading)loading=initialize().catch(fail);await loading;if(!destroyed){resize();sync();}
    },
    async playMotion(name,options={}){
      if(!ready()||!manifest.clips[name])return false;const ticket=++request;explicit=true;
      try{const record=await loadClip(name);if(destroyed||ticket!==request)return false;stop();beginTransition(0);current=record;currentName=name;clock=0;frameIndex=0;returnToIdle=options.returnToIdle!==false;paused=false;applyFrame(0);draw();sync();return true;}catch(reason){fail(reason);return false;}
    },
    seekFrame(index){if(!ready()||!Number.isFinite(index))return false;paused=true;transition=null;clock=Math.max(0,Math.min(current.spec.frames-1,Math.floor(index)))/manifest.fps;applyFrame(Math.floor(clock*manifest.fps+1e-6));draw();sync();return true;},
    restart(){return api.playMotion(currentName,{returnToIdle});},
    setPaused(value){paused=Boolean(value);if(!paused)explicit=true;sync();if(paused)draw();},
    setVisible(value){const next=Boolean(value);if(next===visible)return;visible=next;sync();},
    captureFrame(size=2048){if(!ready()||!renderer)return null;const w=canvas.width,h=canvas.height;try{renderer.resize(size,size);draw();return canvas.toDataURL('image/png');}finally{renderer.resize(w,h);draw();}},
    destroy(){if(destroyed)return;destroyed=true;request++;stop();controller.abort();observer?.disconnect();document.removeEventListener('visibilitychange',visibility);renderer?.destroy();canvas?.remove();records.clear();images.clear();rest=positions=opacities=orders=visibilities=null;if(host){host.classList.remove('is-ready');for(const k of ['portraitState','motion','time','frame','playing','transition'])delete host.dataset[k];}host=null;canvas=null;renderer=null;state='destroyed';},
    get ready(){return ready();},get state(){return state;},get error(){return error;},get paused(){return paused;},get playing(){return Boolean(canPlay());},get motionName(){return currentName;},get currentTime(){return clock;},get duration(){return current?.spec.duration||0;},get frameIndex(){return frameIndex;},get sampleFps(){return manifest?.fps||60;},get availableMotions(){return Object.keys(manifest?.clips||{});},get canvas(){return canvas;},get renderedFrames(){return rendered;},
  };
  return api;
}
