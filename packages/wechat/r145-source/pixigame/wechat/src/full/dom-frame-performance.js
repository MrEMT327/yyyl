// Collect only timings and counts, never coordinates, input values or device IDs.
// The screen compositor closes each bucket; child work since the previous
// screen callback is included even when the engines use independent RAFs.
export function createDomFramePerformance(now=()=>performance.now(), capacity=360) {
  const names=['layout','paint','input'];
  const domains=['host','battle'];
  const transferNames=['battleBlit','battleSnapshot','frozenBattleBlit','isolatedFrameCopy','aircraftRead','aircraftReadSubmit','aircraftReadCopy','wakeBlit','aircraftUpload','terrainUpload'];
  const ring=new Map(),phases=new Set(['lobby','loading','battle']);
  let bucket=makeBucket();
  const open=new Map();
  function makeBucket(){
    const part=()=>({layout:0,paint:0,input:0,layoutCalls:0,paintCalls:0,inputEvents:0});
    return {host:part(),battle:part(),transfers:{}};
  }
  const index=(domain,name)=>domain+':'+name;
  function measure(domain,name,run){
    const id=index(domain,name);
    if(open.has(id))return run();
    const started=now(),slice=bucket[domain];
    const current={layout:0};open.set(id,current);
    try{return run();}finally{
      const elapsed=now()-started;
      open.delete(id);
      if(name==='layout') {
        slice.layout+=elapsed;slice.layoutCalls++;
        for(const outer of ['paint','input']) {
          const enclosing=open.get(index(domain,outer));
          if(enclosing)enclosing.layout+=elapsed;
        }
        // A battle input dispatch is nested in the screen host's touch event.
        const hostInput=domain==='battle'&&open.get(index('host','input'));
        if(hostInput)hostInput.layout+=elapsed;
        const hostPaint=domain==='battle'&&open.get(index('host','paint'));
        if(hostPaint&&!open.has(index('battle','paint')))hostPaint.layout+=elapsed;
      } else {
        const enclosing=domain==='battle'&&name==='input'&&open.get(index('host','input'));
        const own=Math.max(0,elapsed-current.layout-(current.childTime||0));
        slice[name]+=own;
        if(name==='input') {
          slice.inputEvents++;
          if(enclosing)enclosing.childTime=(enclosing.childTime||0)+own;
        } else {
          slice.paintCalls++;
          const hostPaint=domain==='battle'&&open.get(index('host','paint'));
          if(hostPaint)hostPaint.childTime=(hostPaint.childTime||0)+elapsed;
        }
      }
    }
  }
  function measureTransfer(name,pixels,run) {
    const started=now(),slice=bucket.transfers;
    try{return run();}finally{
      const sample=slice[name]|| (slice[name]={ms:0,calls:0,pixels:0});
      sample.ms+=now()-started;sample.calls++;sample.pixels+=pixels;
    }
  }
  function closeFrame(phase) {
    if(!phases.has(phase))phase='lobby';
    const storage=ring.get(phase)||{rows:[],cursor:0};
    storage.rows[storage.cursor]=bucket;
    storage.cursor=(storage.cursor+1)%capacity;
    ring.set(phase,storage);
    bucket=makeBucket();
  }
  const round=value=>Math.round(value*1000)/1000;
  function stats(values) {
    if(!values.length)return null;
    values.sort((a,b)=>a-b);
    return {mean:round(values.reduce((a,b)=>a+b,0)/values.length),p95:round(values[Math.ceil(values.length*.95)-1])};
  }
  function snapshot(){
    const output={};
    for(const [phase,{rows}] of ring) {
      const part={frames:rows.length};
      for(const domain of domains) {
        const samples=rows.map(row=>row[domain]);
        part[domain]=Object.fromEntries(names.map(name=>[name,stats(samples.map(sample=>sample[name]))]));
        part[domain].inputActiveP95=stats(samples.filter(s=>s.inputEvents).map(s=>s.input))?.p95??null;
        part[domain].paintChecks=samples.reduce((a,s)=>a+s.paintCalls,0);
        part[domain].layoutChecks=samples.reduce((a,s)=>a+s.layoutCalls,0);
        part[domain].inputEvents=samples.reduce((a,s)=>a+s.inputEvents,0);
      }
      output[phase]=part;
    }
    return {unit:'ms',windowFrames:capacity,scope:'CPU; layout excluded from paint/input; active-input P95 also reported',phases:output};
  }
  function transfers(){
    const rows=ring.get('battle')?.rows||[],result={unit:'ms',scope:'CPU call time; read may wait for GPU',frames:rows.length};
    for(const name of transferNames){
      const entries=rows.map(row=>row.transfers[name]);
      const calls=entries.reduce((sum,row)=>sum+(row?.calls||0),0);
      result[name]={calls,rgbaBytes:entries.reduce((sum,row)=>sum+(row?.pixels||0)*4,0),
        ...stats(entries.map(row=>row?.ms||0)),activeP95:stats(entries.filter(Boolean).map(row=>row.ms))?.p95??null};
    }
    return result;
  }
  return {measure,measureTransfer,closeFrame,snapshot,transfers};
}
