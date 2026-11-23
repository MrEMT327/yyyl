// WeChat exposes callback-based decoding on devices; the browser preview can
// also return a Promise. Present one browser-compatible asynchronous contract.
export function wrapNativeAudioContext(native,{openingPcm=false,decodeTimeout=0}={}) {
  const methods = new Map();
  let closing;
  const close = () => closing ||= Promise.resolve().then(() => native.close());
  function decodeAudioData(data, successCallback, errorCallback) {
    const decoded = new Promise((resolve, reject) => {
      let settled = false,timer;
      const fail = reason => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(reason instanceof Error ? reason : new Error(reason?.errMsg || String(reason || '音频解码失败')));
      };
      const ready = buffer => {
        if (settled) return;
        if (!buffer || typeof buffer.getChannelData !== 'function') {
          fail(new Error('音频解码未返回 AudioBuffer'));
          return;
        }
        settled = true;
        clearTimeout(timer);
        resolve(buffer);
      };
      if (closing) { fail(new Error('音频上下文已关闭')); return; }
      try {
        const opening=openingPcm?decodeOpeningWav(native,data):null;
        if(opening){ready(opening);return;}
        if(decodeTimeout>0)timer=setTimeout(()=>fail(new Error('原生音效解码超时')),decodeTimeout);
        const result = native.decodeAudioData(data, ready, fail);
        if (result && typeof result.then === 'function') result.then(ready, fail);
        else if (result && typeof result.getChannelData === 'function') ready(result);
        // A void return means decoding is still pending, not an empty buffer.
      } catch (error) { fail(error); }
    });
    if (!successCallback && !errorCallback) return decoded;
    return decoded.then(buffer => { successCallback?.(buffer); return buffer; }, error => {
      errorCallback?.(error);
      throw error;
    });
  }
  return new Proxy(native, {
    get(target, key) {
      if (key === 'close') return close;
      if (key === 'decodeAudioData') return decodeAudioData;
      // Native context properties can throw after closing.
      if (key === 'state' && closing) return 'closed';
      const value = Reflect.get(target, key, target);
      if (key === 'resume' || key === 'suspend') {
        // Call during the gesture, even when the native method returns void.
        // Give browser-style callers a Promise for both results and failures.
        if (!methods.has(key)) methods.set(key, () => {
          try { return Promise.resolve(value?.call(target)); }
          catch (error) { return Promise.reject(error); }
        });
        return methods.get(key);
      }
      if (typeof value !== 'function') return value;
      if (!methods.has(key)) methods.set(key, value.bind(target));
      return methods.get(key);
    },
    set(target, key, value) { return Reflect.set(target, key, value, target); },
  });
}

// The packaged opening cues are small mono PCM WAVs. Fill their native audio
// buffers directly so a delayed device decoder cannot suppress the first shot.
function decodeOpeningWav(native,data){
  if(!(data instanceof ArrayBuffer)||data.byteLength<44||data.byteLength>128000)return null;
  const v=new DataView(data);
  if(v.getUint32(0)!==0x52494646||v.getUint32(8)!==0x57415645)return null;
  let ready=false;
  for(let at=12;at+8<=v.byteLength;){
    const tag=v.getUint32(at),size=v.getUint32(at+4,true),start=at+8;
    if(size>v.byteLength-start)return null;
    if(tag===0x666d7420){
      if(size<16||v.getUint16(start,true)!==1||v.getUint16(start+2,true)!==1||
        v.getUint32(start+4,true)!==16000||v.getUint16(start+14,true)!==16)return null;
      ready=true;
    }else if(tag===0x64617461){
      if(!ready||!size||size%2)return null;
      const buffer=native.createBuffer(1,size/2,16000),samples=buffer.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=v.getInt16(start+2*i,true)/32768;
      return buffer;
    }
    at=start+size+(size&1);
  }
  return null;
}
