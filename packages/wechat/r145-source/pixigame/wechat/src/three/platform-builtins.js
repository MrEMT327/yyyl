import PureURL from 'core-js-pure/actual/url/index.js';
import PureURLSearchParams from 'core-js-pure/actual/url-search-params/index.js';
import { buf2string, string2buf } from 'pako/lib/utils/strings.js';
import { cloneGameData } from '../platform.js';
import { createNativeRandomPool } from '../full/native-crypto.js';

export const URL=globalThis.URL||PureURL;
export const URLSearchParams=globalThis.URLSearchParams||PureURLSearchParams;
export const TextDecoder=globalThis.TextDecoder||class {
  decode(value){return buf2string(new Uint8Array(value));}
};
export const TextEncoder=globalThis.TextEncoder||class {
  encode(value){return string2buf(String(value));}
};
export const structuredClone=globalThis.structuredClone||cloneGameData;
export const queueMicrotask=globalThis.queueMicrotask||((callback)=>{Promise.resolve().then(callback);});
export const performance=globalThis.performance||{now:Date.now};

let nativeRandom;
export function prepareWechatRandom(api){
  if(globalThis.crypto?.getRandomValues)return;
  nativeRandom??=createNativeRandomPool(api);
  return nativeRandom.prepare();
}
// Module injection supplies only the missing Web Crypto binding for the
// shared code. It does not modify the WeChat global object.
export const crypto={getRandomValues(view){
  if(globalThis.crypto?.getRandomValues)return globalThis.crypto.getRandomValues(view);
  if(nativeRandom)return nativeRandom.getRandomValues(view);
  throw Error('随机数尚未准备好，请稍后重试');
}};
