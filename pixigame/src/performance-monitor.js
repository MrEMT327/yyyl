// Measurements run while the performance panel is visible; closing it disables sampling.
// Frame times describe browser delivery; CPU spans exclude asynchronous GPU work.
export function createPerformanceMonitor({now=()=>performance.now(),limit=180}={}) {
  const streams=new Map(),costs=new Map(),renderers=new Map();
  let enabled=false;
  const push=(map,key,value)=>{if(!map.has(key))map.set(key,[]);const values=map.get(key);values.push(value);if(values.length>limit)values.splice(0,values.length-limit);};
  const summarize=values=>{const sorted=values.slice().sort((a,b)=>a-b);return {count:sorted.length,mean:sorted.reduce((a,b)=>a+b,0)/(sorted.length||1),p95:sorted[Math.min(sorted.length-1,Math.floor(sorted.length*.95))]||0,max:sorted.at(-1)||0};};
  return {
    get enabled(){return enabled;},
    setEnabled(value){enabled=Boolean(value);for(const stream of streams.values())stream.last=null;},
    frame(name,time){
      if(!enabled)return;
      time??=now();
      let stream=streams.get(name);if(!stream){stream={last:null,at:time,values:[]};streams.set(name,stream);}
      if(stream.last!==null){const delta=time-stream.last;if(delta>0){stream.values.push(delta);if(stream.values.length>limit)stream.values.shift();}}
      stream.last=time;stream.at=time;
    },
    record(name,duration){if(enabled&&Number.isFinite(duration)&&duration>=0)push(costs,name,duration);},
    measure(name,fn){if(!enabled)return fn();const at=now();try{return fn();}finally{this.record(name,now()-at);}},
    registerRenderer(name,read){renderers.set(name,read);return()=>{if(renderers.get(name)===read)renderers.delete(name);};},
    reset(){streams.clear();costs.clear();},
    resetClocks(){for(const stream of streams.values())stream.last=null;},
    snapshot(){const time=now();return {frames:Object.fromEntries([...streams].map(([name,s])=>[name,{...summarize(s.values),active:time-s.at<1200,samples:s.values.slice(-60)}])),costs:Object.fromEntries([...costs].map(([name,v])=>[name,summarize(v)])),renderers:[...renderers].flatMap(([name,read])=>{try{const value=read();return value?[{name,...value}]:[];}catch{return [];}})};},
  };
}
export const performanceMonitor=createPerformanceMonitor();
