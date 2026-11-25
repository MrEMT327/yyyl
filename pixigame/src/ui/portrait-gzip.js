// Deliver decoded bytes directly to the final frame buffer or MOC plane decoder.
export async function streamPortraitGzip(bytes,write,{signal,native=true}={}){
  function check(){
    if(signal?.aborted)throw signal.reason??Object.assign(new Error('立绘读取已取消'),{name:'AbortError'});
  }
  check();
  let stream;
  if(native&&typeof DecompressionStream==='function'&&typeof Blob==='function'&&Blob.prototype.stream){
    try{stream=new DecompressionStream('gzip');}catch{/* Use the streaming JS decoder below. */}
  }
  if(stream){
    const reader=new Blob([bytes]).stream().pipeThrough(stream).getReader();
    try{
      for(;;){
        const {done,value}=await reader.read();check();
        if(done)break;
        write(value);
      }
    }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
    return;
  }
  const {Gunzip}=await import('three/addons/libs/fflate.module.js');
  const inflater=new Gunzip(write),step=8192;
  let lastYield=Date.now();
  for(let offset=0;offset<bytes.length;offset+=step){
    check();
    const end=Math.min(offset+step,bytes.length);
    inflater.push(bytes.subarray(offset,end),end===bytes.length);
    if(end<bytes.length&&Date.now()-lastYield>=12){
      await new Promise(resolve=>setTimeout(resolve,0));
      lastYield=Date.now();
    }
  }
  check();
}
