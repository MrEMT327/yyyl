import { uploadArtwork } from '../../../../../../../pixigame/src/three/game-screen/image-loading.js';
export { createMenuArtworkWarmup } from '../../../../../../../pixigame/src/three/game-screen/image-loading.js';

// Optional work on the existing renderer: one job per turn, yielding when
// the previous frame was slow. Never force the foreground view to wait.
export function frameWork(platform,active,fastInterval=28,covered=()=>false){
  let request=null,last=null,closed=false,ownFrame=true;
  const jobs=[];
  function resume(){
    if(ownFrame&&!closed&&request===null&&jobs.length&&active())request=platform.requestFrame(run);
  }
  function run(time){
    request=null;
    if(!ownFrame||closed||!active())return;
    const interval=last===null?Infinity:time-last;
    last=time;
    // A startup cover can prepare one job even at a slower frame rate.
    if(interval>=0&&(interval<fastInterval||covered()))jobs.shift()();
    resume();
  }
  function clear(){
    jobs.length=0;last=null;
    if(request!==null)platform.cancelFrame(request);
    request=null;
  }
  return {push(job){if(!closed){jobs.push(job);resume();}},resume,clear,
    followForeground(){clear();ownFrame=false;},
    step(){if(!closed&&active())jobs.shift()?.();},
    close(){closed=true;clear();}};
}

// Large battle data reads can finish together. Let the turntable paint between
// their synchronous decompression and JSON work while requests stay parallel.
export function paceSortieData(waitForPaint,signal){
  let tail=Promise.resolve();
  return (byteLength,operation,{shared=false}={})=>{
    const run=()=>{
      if(signal.aborted&&!shared)throw signal.reason??Object.assign(new Error('Battle closed'),{name:'AbortError'});
      return operation();
    };
    if(byteLength<1024*1024)return Promise.resolve().then(run);
    const job=tail.then(async()=>{
      if(!signal.aborted)await waitForPaint();
      return run();
    });
    tail=job.catch(()=>{});
    return job;
  };
}

const earlyBattleArt=new Set(['coins','digits','combat-labels','medkit','shell','modules','crate']);
export function prewarmBattleArtwork(platform){
  const work=frameWork(platform,()=>platform.visible,40);
  const unwatch=platform.onViewport?.(work.resume);
  const uploaded=new WeakMap();
  let count=0,pixels=0,quietFrames=0,queued=new WeakMap();
  const areaOf=({image})=>(image?.naturalWidth||image?.width||0)*(image?.naturalHeight||image?.height||0);
  function warm(texture){
    if(uploaded.get(texture)===texture.version||!areaOf(texture))return false;
    uploaded.set(texture,texture.version);
    return uploadArtwork(platform.renderer,texture,2400000);
  }
  return {add(key,texture,priority=false){
    if(count>=36||!(priority||earlyBattleArt.has(key)||/^host:\/\/(?:ice-weapons|ice-particles|warm-energy-shots)/.test(key)))return;
    const {version}=texture,area=areaOf(texture);
    if(queued.get(texture)===version||uploaded.get(texture)===version||
      !(area>0)||area>2400000||pixels+area>6500000)return;
    queued.set(texture,version);
    count++;pixels+=area;work.push(()=>{
      if(queued.get(texture)===version)queued.delete(texture);
      if(texture.version===version)warm(texture);
    });
  },
  prepare(textures){
    let uploads=0,area=0;
    for(const texture of textures){
      if(uploaded.get(texture)===texture.version)continue;
      const nextArea=areaOf(texture);
      if(uploads&&(uploads>=2||area+nextArea>450000))return false;
      if(warm(texture)){uploads++;area+=nextArea;}
    }
    return uploads===0;
  },
  push(job){work.push(()=>{
    try{if(!platform.renderer.getContext().isContextLost())job();}
    catch(error){console.warn('[Three 战斗预热]',error?.message||error);}
  });},
    // After loading, the battle owns the only frame callback for GPU work.
    reset(){work.followForeground();count=pixels=quietFrames=0;queued=new WeakMap();},
    afterPaint(interval,workMs,playing){
      if(!(interval>0&&interval<(playing?25:40))||workMs>(playing?11:20)){
        quietFrames=0;
        return;
      }
      if(++quietFrames>=(playing?3:1)){quietFrames=0;work.step();}
    },
    close(){work.close();unwatch?.();},
  };
}
