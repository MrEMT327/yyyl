import {performanceMonitor} from '../../performance-monitor.js';

// A screen frame can contain several Three scenes, masks and post-processing passes.
export function measureScreen(renderer,name,visible,ownsMemory=true){
  const info=renderer.info,stats={frame:0,calls:0,triangles:0};
  const release=performanceMonitor.registerRenderer(name,()=>{
    if(!visible())return null;
    return {...stats,active:stats.frame>0,...(ownsMemory?info.memory:{})};
  });
  return {release,draw(paint){
    if(!performanceMonitor.enabled)return paint();
    const auto=info.autoReset;
    if(auto)info.reset();
    info.autoReset=false;
    const calls=info.render.calls,triangles=info.render.triangles;
    try{return paint();}
    finally{
      stats.frame++;stats.calls=info.render.calls-calls;stats.triangles=info.render.triangles-triangles;
      info.autoReset=auto;
    }
  }};
}

