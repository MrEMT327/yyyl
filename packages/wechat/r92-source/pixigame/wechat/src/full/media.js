import { nativeSurface } from './dom-environment.js';
import { attachNativeVideoPlayer } from './video-player.js';
import { wrapNativeAudioContext } from './web-audio.js';
import { RELEASE_OWNED_VIDEO } from '../../../src/ui/release-owned-video.js';

export function installNativeMedia(host) {
  const { api, scope, document, emit } = host, sounds = new Set(), videos = new Set(), contexts = new Set();
  function attachAudio(element) {
    if (element._nativeMedia) return element;
    const audio = api.createInnerAudioContext(); sounds.add(audio); element._nativeMedia = audio;
    let source = '', paused = true;
    const properties = { volume: 'volume', loop: 'loop', playbackRate: 'playbackRate' };
    for (const [name, native] of Object.entries(properties)) Object.defineProperty(element, name, { configurable: true, get: () => audio[native], set: value => { audio[native] = value; } });
    Object.defineProperties(element, {
      src: { configurable: true, get: () => source, set: value => { source = String(value || ''); if (source) audio.src = host.resources.resolve(source, document.baseURI); else audio.stop(); } },
      currentTime: { configurable: true, get: () => audio.currentTime || 0, set: value => audio.seek(Number(value)) },
      duration: { configurable: true, get: () => audio.duration || 0 },
      paused: { configurable: true, get: () => paused },
      muted: { configurable: true, get: () => audio.volume === 0, set: value => { audio.volume = value ? 0 : 1; } },
    });
    audio.onPlay(() => { paused = false; emit(element,'play'); emit(element,'playing'); });
    audio.onPause(() => { paused = true; emit(element,'pause'); });
    audio.onEnded(() => { paused = true; emit(element,'ended'); });
    audio.onCanplay(() => { emit(element,'loadedmetadata'); emit(element,'canplay'); });
    audio.onTimeUpdate(() => emit(element,'timeupdate'));
    audio.onError(error => emit(element,'error',{ error }));
    element.play = () => { audio.play(); return Promise.resolve(); };
    element.pause = () => { paused = true; audio.pause(); };
    element.load = () => { const src = element.getAttribute('src'); if (src) element.src = src; else if (!source) audio.stop(); };
    element.canPlayType = type => /audio\/(mp3|mpeg|wav|ogg|aac|mp4)/.test(type) ? 'probably' : '';
    return element;
  }
  scope.Audio = function (src) { const audio = attachAudio(document.createElement('audio')); if (src) audio.src = src; return audio; };
  scope.AudioContext = scope.webkitAudioContext = function () {
    const context=wrapNativeAudioContext(api.createWebAudioContext());
    contexts.add(context); return context;
  };
  function attachVideo(element) {
    if (element._nativeVideo) return element;
    if(element.classList.contains('bc-affection-video')&&typeof api.createVideo==='function'){
      const record=attachNativeVideoPlayer(host,element);videos.add(record);return element;
    }
    const canvas = api.createCanvas(), context = canvas.getContext('2d');
    canvas.width=canvas.height=0;
    let decoder;
    element[nativeSurface] = canvas;
    let source = '', loadedSource = '', pending, paused = true, ended = false, seeking = false, time = 0, duration = NaN, ready = 0, stopped = false, frameId = 0, serial = 0, loadId = 0;
    let callbacks = new Map(), callbackId = 0, firstFrame = null, resolveFrame, rejectFrame;
    const record = { element, get decoder(){return decoder;}, dispose }; element._nativeVideo = record; videos.add(record);
    Object.defineProperty(element, RELEASE_OWNED_VIDEO, { value: dispose });
    function getDecoder(){
      if(decoder)return decoder;
      decoder=api.createVideoDecoder();
      decoder.on('start', size => { if(!source||stopped)return;canvas.width = size.width; canvas.height = size.height; emit(element,'loadedmetadata'); });
      decoder.on('ended', () => { if(paused)return; ended = true; duration = time; emit(element,'durationchange'); if (element.loop) { void seek(0).catch(error=>emit(element,'error',{error})); ended = false; } else { paused = true; emit(element,'ended'); } });
      return decoder;
    }
    function scheduleFrame(){if(!stopped&&!frameId)frameId=scope.requestAnimationFrame(drawFrame);}
    function drawFrame() {
      frameId=0;
      if (stopped) return;
      if (!paused || ready < 2 || seeking) {
        const frame = decoder?.getFrameData();
        if (frame?.data && frame.width && frame.height) {
          if (canvas.width !== frame.width || canvas.height !== frame.height) { canvas.width = frame.width; canvas.height = frame.height; }
          const image = context.createImageData(frame.width, frame.height); image.data.set(new Uint8ClampedArray(frame.data)); context.putImageData(image,0,0);
          time = Number(frame.pkPts || 0) / 1000;
          const first = ready < 2; ready = 4;
          if (first) { emit(element,'loadeddata'); emit(element,'canplay'); resolveFrame?.(); }
          if (seeking) { seeking = false; emit(element,'seeked'); }
          emit(element,'timeupdate');
          const readyCallbacks = callbacks; callbacks = new Map();
          for (const callback of readyCallbacks.values()) callback(scope.performance.now(), { mediaTime: time, width: canvas.width, height: canvas.height, presentedFrames: ++serial });
        }
      }
      if(!paused||ready<2||seeking)scheduleFrame();
    }
    async function load() {
      if(stopped)return;
      const src = element.getAttribute('src') || '';
      if (!src) { loadId++;source=loadedSource='';paused=true;ready=0;pending=null;scope.cancelAnimationFrame(frameId);frameId=0;callbacks.clear();rejectFrame?.(new scope.DOMException('Video source cleared','AbortError'));await decoder?.stop();canvas.width=canvas.height=0;return; }
      if (src === loadedSource && pending) return pending;
      source = loadedSource = src; stopped = false; ready = 0; ended = false;
      const ticket=++loadId;
      rejectFrame?.(new scope.DOMException('Video source replaced','AbortError'));
      firstFrame = new Promise((ok, fail) => { resolveFrame = ok; rejectFrame = fail; }); firstFrame.catch(() => {});
      const frameReady=firstFrame;
      pending = Promise.resolve().then(()=>getDecoder().start({ source: host.resources.resolve(src, document.baseURI), mode: 0, abortAudio: true })).then(() => {
        if(ticket!==loadId||stopped)return;
        scope.cancelAnimationFrame(frameId);frameId=0;scheduleFrame();return frameReady;
      }).catch(error => { if(ticket!==loadId||stopped)return;rejectFrame?.(error); emit(element,'error',{error}); throw error; });
      pending.catch(() => {}); return pending;
    }
    async function seek(value) { if(!decoder)return;seeking = true; ended = false; await decoder.seek(value * 1000); time = value;scheduleFrame(); }
    function dispose() {
      if(stopped)return;
      stopped=true;paused=true;seeking=false;loadId++;source=loadedSource='';ready=0;
      scope.cancelAnimationFrame(frameId);frameId=0;callbacks.clear();
      rejectFrame?.(new scope.DOMException('Video disposed','AbortError'));
      firstFrame=pending=resolveFrame=rejectFrame=null;
      const previous=decoder;decoder=null;
      void previous?.remove().catch(error=>console.warn('[wechat-video-dispose]',error));
      canvas.width=canvas.height=0;element[nativeSurface]=undefined;
      videos.delete(record);
    }
    Object.defineProperties(element, {
      src: { configurable: true, get: () => element.getAttribute('src')||'', set: value => { source = String(value || ''); element.setAttribute('src',source); } },
      currentTime: { configurable: true, get: () => time, set: value => { void seek(Number(value)).catch(error => emit(element,'error',{error})); } },
      duration: { configurable: true, get: () => duration }, paused: { configurable: true, get: () => paused }, ended: { configurable: true, get: () => ended },
      readyState: { configurable: true, get: () => ready }, seeking: { configurable: true, get: () => seeking },
      videoWidth: { configurable: true, get: () => canvas.width }, videoHeight: { configurable: true, get: () => canvas.height },
    });
    element.load = load;
    element.play = async () => { await load();if(!source||stopped)return;if(paused||ended)await seek(ended?0:time);paused=false;scheduleFrame();emit(element,'play');emit(element,'playing'); };
    element.pause = () => { paused = true;if(ready>=2&&!seeking){scope.cancelAnimationFrame(frameId);frameId=0;}emit(element,'pause'); };
    element.requestVideoFrameCallback = callback => { const id = ++callbackId; callbacks.set(id,callback); return id; };
    element.cancelVideoFrameCallback = id => callbacks.delete(id);
    element.canPlayType = type => /video\/(mp4|webm)/.test(type) ? 'probably' : '';
    return element;
  }
  const createElement = document.createElement.bind(document);
  document.createElement = (name, ...args) => { const element = createElement(name,...args); return name.toLowerCase() === 'video' ? attachVideo(element) : name.toLowerCase() === 'audio' ? attachAudio(element) : element; };
  const previousMarkupChanged=host.onMarkupChanged;
  const prepare=root=>{for(const video of root.querySelectorAll?.('video')||[])attachVideo(video);};
  const markupChanged=root=>{previousMarkupChanged?.(root);prepare(root);};
  host.onMarkupChanged=markupChanged;prepare(document);
  const observer = new scope.MutationObserver(() => {
    prepare(document);
    for (const record of [...videos]) {
      const video=record.element;
      if(video.isConnected){
        record.wasConnected=true;
        if(!record.autoplayStarted&&(video.autoplay||video.hasAttribute('autoplay'))){record.autoplayStarted=true;void video.play().catch(()=>{});}
      }else if(record.wasConnected){record.dispose();videos.delete(record);}
    }
  });
  observer.observe(document.documentElement,{childList:true,subtree:true});
  return { destroy() { observer.disconnect(); if(host.onMarkupChanged===markupChanged)host.onMarkupChanged=previousMarkupChanged;for (const audio of sounds) audio.destroy(); for (const video of [...videos]) video.dispose(); for (const context of contexts) void context.close().catch(error=>console.warn('[wechat-audio-dispose]',error)); sounds.clear();videos.clear();contexts.clear(); } };
}
