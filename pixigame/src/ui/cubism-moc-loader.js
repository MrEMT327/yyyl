import {createMocPlaneDecoder,MOC_PACK_HEADER_BYTES} from './cubism-moc-codec.js';

export async function decodePackedCubismMoc(buffer,{native=true,signal}={}){
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer),decoder=createMocPlaneDecoder(bytes);
  const aborted=()=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');};
  aborted();
  const compressed=bytes.subarray(MOC_PACK_HEADER_BYTES);
  let stream=null;
  if(native&&typeof DecompressionStream==='function'){
    try {stream=new DecompressionStream('gzip');}catch{/* Use the bundled decoder on older hosts. */}
  }
  if(stream){
    const reader=new Blob([compressed]).stream().pipeThrough(stream).getReader();
    try {for(;;){aborted();const {done,value}=await reader.read();if(done)break;decoder.write(value);}}
    finally {await reader.cancel().catch(()=>{});reader.releaseLock();}
  } else {
    const {gunzipSync}=await import('three/addons/libs/fflate.module.js');
    aborted();decoder.write(gunzipSync(compressed));
  }
  aborted();return decoder.finish();
}
