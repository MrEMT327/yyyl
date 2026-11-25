import {createMocPlaneDecoder,MOC_PACK_HEADER_BYTES} from './cubism-moc-codec.js';
import {streamPortraitGzip} from './portrait-gzip.js';

export async function decodePackedCubismMoc(buffer,options={}){
  const {signal}=options;
  if(signal?.aborted)throw signal.reason??Object.assign(new Error('立绘读取已取消'),{name:'AbortError'});
  const bytes=buffer instanceof Uint8Array?buffer:new Uint8Array(buffer);
  const decoder=createMocPlaneDecoder(bytes);
  await streamPortraitGzip(bytes.subarray(MOC_PACK_HEADER_BYTES),decoder.write,options);
  return decoder.finish();
}
