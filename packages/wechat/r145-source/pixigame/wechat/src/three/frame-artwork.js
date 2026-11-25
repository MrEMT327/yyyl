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
  function clear(){
    jobs.length=0;last=null;
    if(request!==null)platform.cancelFrame(request);
    request=null;
  }
  return {push(job){if(!closed){jobs.push(job);resume();}},resume,clear,
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

function upload(platform,texture,maxPixels){
  const r=platform.renderer,image=texture.image,limit=r.capabilities.maxTextureSize;
  const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
  if(!w||!h||w>limit||h>limit||w*h>maxPixels||r.getContext().isContextLost())return false;
  try{r.initTexture(texture);return true;}catch{return false;}
}

export function createMenuArtworkWarmup(platform){
  const uploaded=new WeakSet();
  return function prepare(textures,maxUploads=4){
    let count=0,pixels=0;
    for(const texture of textures){
      const image=texture.image;
      if(!image||uploaded.has(texture))continue;
      const area=(image.naturalWidth||image.width)*(image.naturalHeight||image.height);
      if(count&&(count>=maxUploads||pixels+area>400000))return false;
      uploaded.add(texture);
      if(upload(platform,texture,1600000)){count++;pixels+=area;}
    }
    // Do not stack the first complete screen draw on an upload frame.
    return count===0;
  };
}

const earlyBattleArt=new Set(['coins','digits','combat-labels','medkit','shell','modules','crate']);
export function prewarmBattleArtwork(platform){
  const work=frameWork(platform,()=>platform.visible,40);
  const unwatch=platform.onViewport?.(work.resume);
  let count=0,pixels=0;
  return {add(key,texture,priority=false){
    if(count>=36||!(priority||earlyBattleArt.has(key)||/^host:\/\/(?:ice-weapons|ice-particles|warm-energy-shots)/.test(key)))return;
    const {image}=texture,area=(image.naturalWidth||image.width)*(image.naturalHeight||image.height);
    if(!(area>0)||area>2400000||pixels+area>6500000)return;
    count++;pixels+=area;work.push(()=>upload(platform,texture,2400000));
  },push(job){work.push(()=>{
    try{if(!platform.renderer.getContext().isContextLost())job();}
    catch(error){console.warn('[Three 战斗预热]',error?.message||error);}
  });},
    reset(){work.clear();count=pixels=0;},
    close(){work.close();unwatch?.();},
  };
}
