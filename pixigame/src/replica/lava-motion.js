const TAU=Math.PI*2;
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const fract=x=>x-Math.floor(x);
const pools=new Set(['pool','b']);
const cracks=new Set(['a','shelf','fissures']);

export function lavaMotionSeed(id){
  let n=2166136261;for(let i=0;i<id.length;i++){n^=id.charCodeAt(i);n=Math.imul(n,16777619);}return n>>>0;
}

/** Phases wrap individually before reaching GLSL, preserving precision and
 * continuity even during long runs. Buildings never join this animation. */
export function sampleLavaFlow(asset,id,time,reducedMotion=false){
  if(reducedMotion)return null;
  const mode=asset==='river'?4:asset==='cascade'?1:pools.has(asset)?2:cracks.has(asset)?3:0;
  if(!mode)return null;
  const seed=lavaMotionSeed(id)/4294967296,t=Math.max(0,Number.isFinite(time)?time:0);
  const speed=mode===4?.14:mode===1?.32:mode===2?.085:.19;
  return {mode,seed,phases:[fract(t*speed+seed),fract(t*.073+seed*.71),fract(t*.051+seed*.43)]};
}

const molten=(data,i)=>data[i+3]>220&&data[i]>50&&data[i]>data[i+1]*1.30&&data[i]>data[i+2]*1.35&&data[i]-data[i+1]>18&&data[i]-data[i+2]>18;

/** Safe interior points, extracted once from the unmodified painted image.
 * Distance from banks and cold crust bounds every cap, ripple and droplet. */
export function findLavaBubbleSites(data,width,height,asset){
  if(!pools.has(asset))return [];
  const distance=new Float32Array(width*height),diagonal=Math.SQRT2;
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const i=y*width+x;distance[i]=x&&y&&x<width-1&&y<height-1&&molten(data,i*4)?999:0;
  }
  for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){
    const i=y*width+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i-1]+1,distance[i-width]+1,distance[i-width-1]+diagonal,distance[i-width+1]+diagonal);
  }
  for(let y=height-2;y>0;y--)for(let x=width-2;x>0;x--){
    const i=y*width+x;if(distance[i])distance[i]=Math.min(distance[i],distance[i+1]+1,distance[i+width]+1,distance[i+width-1]+diagonal,distance[i+width+1]+diagonal);
  }
  const candidates=[];
  for(let y=3;y<height-3;y+=3)for(let x=3;x<width-3;x+=3){
    const clearance=distance[y*width+x];if(clearance>=5)candidates.push({x:x+.5,y:y+.5,clearance});
  }
  candidates.sort((a,b)=>b.clearance-a.clearance||a.y-b.y||a.x-b.x);
  const sites=[];
  for(const p of candidates){
    if(sites.every(q=>(p.x-q.x)**2+(p.y-q.y)**2>=64))sites.push(p);
    if(sites.length>=16)break;
  }
  return sites;
}

/** One sparse event per pool. Visibility and frame rate do not spawn events;
 * the absolute terrain clock defines the same state on pause and re-entry. */
export function sampleLavaBubble(time,id,sites,reducedMotion=false){
  if(reducedMotion||!sites.length)return null;
  const seed=lavaMotionSeed(id),period=3.35+(seed%5)*.19;
  const t=Math.max(0,Number.isFinite(time)?time:0)+(seed%997)/997*period;
  const cycle=Math.floor(t/period),age=t-cycle*period;
  if(age>=1.34)return null;
  const selection=(Math.imul(cycle+1,1664525)^seed)>>>0;
  const site=sites[selection%sites.length],limit=site.clearance*.80;
  const maxRadius=Math.min(5.2,limit*.48),burstRadius=Math.min(9,limit);
  if(age<.74){
    const progress=clamp(age/.74),grow=1-(1-progress)**2;
    return {stage:'grow',site,age,radius:maxRadius*grow,alpha:clamp(progress*5),burstRadius,rotation:(selection%360)/360*TAU};
  }
  const progress=clamp((age-.74)/.60);
  return {stage:progress<.22?'burst':'ripple',site,age,radius:maxRadius*(1-progress),
    ringRadius:maxRadius+(burstRadius-maxRadius)*progress,alpha:(1-progress)**2,
    burstRadius,progress,rotation:(selection%360)/360*TAU};
}
