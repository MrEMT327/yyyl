// Plays frozen native RGBA renders. Colour and alpha share one portable H.264
// frame, so their timestamps cannot drift and browser alpha-video support is unnecessary.
const VERTEX=`attribute vec2 position;uniform vec2 fit;varying vec2 uv;void main(){uv=vec2(position.x*.5+.5,.5-position.y*.5);gl_Position=vec4(position*fit,0.,1.);}`;
const FRAGMENT=`precision highp float;
uniform sampler2D frame;uniform vec2 packedSize;uniform float repairShirtHoles;varying vec2 uv;
float opacity(vec2 p){return clamp((texture2D(frame,p+vec2(.5,0.)).r-1./255.)/(253./255.),0.,1.);}
void main(){
 vec2 p=vec2(clamp(uv.x*.5,.5/packedSize.x,.5-.5/packedSize.x),clamp(uv.y,.5/packedSize.y,1.-.5/packedSize.y));
 vec3 rgb=texture2D(frame,p).rgb;float a=opacity(p);
 // A few source mesh pinholes expose the background through the white blouse.
 // Restrict the repair to the blouse area and require opaque, pale material on
 // all four sides, so silhouette edges and actual cutouts remain untouched.
 if(repairShirtHoles>.5&&(a<.98||min(min(rgb.r,rgb.g),rgb.b)<.65)&&uv.x>.25&&uv.x<.78&&uv.y>.13&&uv.y<.47){
  vec2 dx=vec2(8./packedSize.x,0.),dy=vec2(0.,26./packedSize.y);
  vec2 p0=p-dx,p1=p+dx,p2=p-dy,p3=p+dy;
  if(min(opacity(p0),opacity(p1))>.96&&min(opacity(p2),opacity(p3))>.96){
   vec3 c0=texture2D(frame,p0).rgb,c1=texture2D(frame,p1).rgb,c2=texture2D(frame,p2).rgb,c3=texture2D(frame,p3).rgb;
   float pale=min(min(min(c0.r,c0.g),c0.b),min(min(min(c1.r,c1.g),c1.b),min(min(min(c2.r,c2.g),c2.b),min(min(c3.r,c3.g),c3.b))));
   if(pale>.68){
    float nearAlpha=1.;
    if(a>=.98){vec2 ex=vec2(4./packedSize.x,0.),ey=vec2(0.,10./packedSize.y);nearAlpha=min(min(opacity(p-ex),opacity(p+ex)),min(opacity(p-ey),opacity(p+ey)));}
    if(a<.98||nearAlpha<.98){rgb=(c0+c1+c2+c3)*.25;a=1.;}
   }
  }
 }
 gl_FragColor=vec4(rgb*a,a);
}`;

export function createRgbaVideoPortraitPlayer({assetBase=import.meta.env?.BASE_URL ?? '/',manifestPath}={}) {
  const assetRoot=new URL(assetBase,location.href);
  const sameOrigin=path=>{const u=new URL(path,assetRoot);if(u.origin!==location.origin)throw new Error('角色只允许读取同源资源');return u.href;};
  const manifestUrl=sameOrigin(manifestPath),folder=new URL('./',manifestUrl);
  let host=null,canvas=null,gl=null,program=null,buffer=null,texture=null,fitLocation=null,sizeLocation=null,repairLocation=null;
  let manifest=null,current=null,currentName='idle',state='idle',error=null,loading=null,visible=true,paused=false,destroyed=false,held=false,returnToIdle=false,request=0,rendered=0,callback=null;
  const records=new Map(),controller=new AbortController();
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)');let explicit=false;
  const ready=()=>state==='ready';
  const canPlay=()=>!destroyed&&host&&visible&&!paused&&!held&&!document.hidden&&(!reduced?.matches||explicit)&&current;
  function updateHost(){if(!host)return;host.dataset.portraitState=state;host.dataset.motion=currentName;host.dataset.time=time().toFixed(3);host.dataset.playing=String(Boolean(current&&!current.video.paused&&canPlay()));host.classList.toggle('is-ready',ready());}
  function fail(reason){if(destroyed)return;error=reason;state='error';stopCallback();for(const r of records.values())r.video.pause();updateHost();}
  function shader(kind,source){const s=gl.createShader(kind);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const message=gl.getShaderInfoLog(s);gl.deleteShader(s);throw new Error(message||'角色着色器创建失败');}return s;}
  function createRenderer(){
    gl=canvas.getContext('webgl',{alpha:true,premultipliedAlpha:true,antialias:false,preserveDrawingBuffer:false,depth:false,stencil:false});if(!gl)throw new Error('无法创建角色画布');
    const vs=shader(gl.VERTEX_SHADER,VERTEX),fs=shader(gl.FRAGMENT_SHADER,FRAGMENT);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw new Error(gl.getProgramInfoLog(program));
    gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);const at=gl.getAttribLocation(program,'position');gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,2,gl.FLOAT,false,0,0);
    texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);gl.uniform1i(gl.getUniformLocation(program,'frame'),0);fitLocation=gl.getUniformLocation(program,'fit');sizeLocation=gl.getUniformLocation(program,'packedSize');repairLocation=gl.getUniformLocation(program,'repairShirtHoles');gl.disable(gl.BLEND);gl.disable(gl.DEPTH_TEST);
  }
  function draw(){
    if(destroyed||!gl||!current||current.video.readyState<2)return;
    gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT);gl.useProgram(program);gl.bindTexture(gl.TEXTURE_2D,texture);gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,false);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,current.video);
    const scale=Math.min(canvas.width/manifest.width,canvas.height/manifest.height);gl.uniform2f(fitLocation,manifest.width*scale/canvas.width,manifest.height*scale/canvas.height);gl.uniform2f(sizeLocation,current.video.videoWidth,current.video.videoHeight);gl.uniform1f(repairLocation,manifest.interiorHoleRepair==='blouse-v1'?1:0);gl.drawArrays(gl.TRIANGLES,0,6);rendered++;updateHost();
  }
  function resize(){if(!host||!canvas||!gl)return;const bounds=host.getBoundingClientRect(),dpr=2,w=Math.max(1,Math.round(bounds.width*dpr)),h=Math.max(1,Math.round(bounds.height*dpr));if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;}draw();}
  function stopCallback(){if(callback===null)return;if(callback.kind==='video')callback.video.cancelVideoFrameCallback?.(callback.id);else cancelAnimationFrame(callback.id);callback=null;}
  function schedule(){if(callback||!canPlay())return;const v=current.video,step=()=>{callback=null;if(!canPlay())return;try{draw();schedule();}catch(e){fail(e);}};callback=v.requestVideoFrameCallback?{kind:'video',video:v,id:v.requestVideoFrameCallback(step)}:{kind:'raf',id:requestAnimationFrame(step)};}
  function syncPlayback(){stopCallback();if(!current)return;const record=current;if(canPlay()){record.video.play().then(()=>{if(current===record)schedule();}).catch(reason=>{if(destroyed||current!==record||record.video.paused&&!canPlay())return;fail(reason);});}else record.video.pause();updateHost();}
  function time(){return held&&current?current.spec.duration:current?.video.currentTime||0;}
  function loadClip(name){
    if(records.has(name))return records.get(name).promise;
    const spec=manifest.clips[name];if(!spec)throw new Error('资源没有该动作：'+name);
    const video=document.createElement('video');video.muted=true;video.playsInline=true;video.preload='auto';video.loop=Boolean(spec.loop);video.setAttribute('playsinline','');
    const handlers=new AbortController();const record={video,spec,handlers,promise:null};records.set(name,record);
    record.promise=new Promise((resolve,reject)=>{
      const timeout=setTimeout(()=>{reject(new Error('角色动作读取超时'));},30000);
      const done=()=>{clearTimeout(timeout);if(video.videoWidth!==manifest.packedWidth||video.videoHeight!==manifest.height){reject(new Error('角色动作尺寸不符'));return;}resolve(record);};
      video.addEventListener('loadeddata',done,{once:true,signal:handlers.signal});video.addEventListener('error',()=>{clearTimeout(timeout);reject(new Error('角色动作读取失败'));},{once:true,signal:handlers.signal});
      controller.signal.addEventListener('abort',()=>{clearTimeout(timeout);reject(new DOMException('角色已关闭','AbortError'));},{once:true,signal:handlers.signal});
    });
    video.addEventListener('seeked',()=>{if(current===record)draw();},{signal:handlers.signal});
    video.addEventListener('ended',()=>{
      if(current!==record||spec.loop)return;
      // Game interaction returns to idle; independent GM previews keep their
      // authored held ending unless the caller explicitly requests a return.
      if(returnToIdle){void start('idle',true,{frame:spec.returnToIdleFrame??manifest.clips.idle.startFrame??0}).catch(fail);return;}
      held=true;paused=true;stopCallback();video.pause();video.currentTime=(spec.frames-.5)/manifest.fps;updateHost();
    },{signal:handlers.signal});
    video.src=sameOrigin(new URL(spec.file,folder).href);video.load();return record.promise;
  }
  async function start(name,play,options={}){
    const ticket=++request;stopCallback();current?.video.pause();if(play)paused=false;const record=await loadClip(name);if(destroyed||ticket!==request)return false;
    // Native return clips can rejoin a specific idle phase. Finish seeking
    // before publishing the new motion so a stale decoded frame never flashes.
    const frame=options.frame??record.spec.startFrame??0;
    const targetTime=Math.min(record.spec.frames-1,Math.max(0,frame))/manifest.fps;
    if(Math.abs(record.video.currentTime-targetTime)>1e-5||record.video.seeking)await new Promise((resolve,reject)=>{
      const done=reason=>{clearTimeout(timer);record.video.removeEventListener('seeked',seeked);controller.signal.removeEventListener('abort',aborted);reason?reject(reason):resolve();};
      const seeked=()=>done(),aborted=()=>done(new DOMException('角色已关闭','AbortError'));
      const timer=setTimeout(()=>done(new Error('角色动作定位超时')),15000);
      record.video.addEventListener('seeked',seeked,{once:true});controller.signal.addEventListener('abort',aborted,{once:true});record.video.currentTime=targetTime;
    });
    if(destroyed||ticket!==request)return false;current=record;currentName=name;held=false;returnToIdle=Boolean(options.returnToIdle&&name!=='idle');state='ready';draw();syncPlayback();return true;
  }
  async function initialize(){
    state='loading';updateHost();const response=await fetch(manifestUrl,{signal:controller.signal});if(!response.ok)throw new Error('角色资源清单读取失败');manifest=await response.json();if(!['engineer-ee76-video-v1','rgba-portrait-video-v1'].includes(manifest.schema)||manifest.packedWidth!==manifest.width*2||!manifest.clips?.idle)throw new Error('角色资源格式无效');if(destroyed)return;
    canvas=document.createElement('canvas');canvas.setAttribute('aria-hidden','true');createRenderer();if(host)host.append(canvas);resize();await start('idle',false);resize();
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(resize):null;
  const onVisibility=()=>syncPlayback();document.addEventListener('visibilitychange',onVisibility);
  return {
    async attach(next){
      if(destroyed)return;if(host!==next){if(host){observer?.unobserve(host);host.classList.remove('is-ready');for(const k of ['portraitState','motion','time','playing'])delete host.dataset[k];}host=next;if(!host){canvas?.remove();syncPlayback();return;}if(canvas)host.append(canvas);observer?.observe(host);resize();updateHost();}
      if(!host)return;if(!loading)loading=initialize().catch(fail);await loading;if(!destroyed){resize();syncPlayback();updateHost();}
    },
    async playMotion(name,options={}){if(!ready()||!manifest.clips[name])return false;explicit=true;try{return await start(name,true,options);}catch(e){fail(e);return false;}},
    restart(){return this.playMotion(currentName);},
    // Frame-accurate inspection for video portraits; completion waits for the
    // requested decoded frame so captures cannot use stale playback pixels.
    async seekFrame(frame){
      if(!ready()||!current||!Number.isFinite(frame))return false;
      // Seek into the middle of the frame: browser time quantization can place
      // an exact frame boundary just before it and display the previous frame.
      const record=current,index=Math.min(record.spec.frames-1,Math.max(0,Math.floor(frame)));
      const target=(index+.5)/manifest.fps;
      if(Math.abs(record.video.currentTime-target)>1e-5||record.video.seeking){
        try{await new Promise((resolve,reject)=>{
          const done=reason=>{clearTimeout(timer);record.video.removeEventListener('seeked',seeked);controller.signal.removeEventListener('abort',aborted);reason?reject(reason):resolve();};
          const seeked=()=>done(),aborted=()=>done(new DOMException('角色已关闭','AbortError'));
          const timer=setTimeout(()=>done(new Error('角色动作定位超时')),15000);
          record.video.addEventListener('seeked',seeked,{once:true});controller.signal.addEventListener('abort',aborted,{once:true});record.video.currentTime=target;
        });}catch(reason){if(!destroyed)fail(reason);return false;}
      }
      if(destroyed||current!==record)return false;held=false;draw();return true;
    },
    setPaused(value){paused=Boolean(value);if(!paused){explicit=true;if(held){void start(currentName,true).catch(fail);return;}}syncPlayback();if(paused)draw();},
    setVisible(value){visible=Boolean(value);syncPlayback();},
    captureFrame(size=2048){if(!ready()||!canvas||current.video.readyState<2)return null;const w=canvas.width,h=canvas.height;try{canvas.width=canvas.height=size;draw();return canvas.toDataURL('image/png');}finally{canvas.width=w;canvas.height=h;draw();}},
    destroy(){if(destroyed)return;destroyed=true;request++;controller.abort();stopCallback();observer?.disconnect();document.removeEventListener('visibilitychange',onVisibility);for(const r of records.values()){r.handlers.abort();r.video.pause();r.video.removeAttribute('src');r.video.load();}records.clear();canvas?.remove();if(host){host.classList.remove('is-ready');for(const k of ['portraitState','motion','time','playing'])delete host.dataset[k];}if(gl){gl.deleteTexture(texture);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext();}host=null;canvas=null;gl=null;state='destroyed';},
    get ready(){return ready();},get state(){return state;},get error(){return error;},get paused(){return paused;},get playing(){return Boolean(current&&!current.video.paused&&canPlay());},get motionName(){return currentName;},get currentTime(){return time();},get duration(){return current?.spec.duration||0;},get frameIndex(){return Math.min((current?.spec.frames||1)-1,Math.floor(time()*(manifest?.fps||30)+1e-6));},get sampleFps(){return manifest?.fps||30;},get availableMotions(){return Object.keys(manifest?.clips||{});},get canvas(){return canvas;},get renderedFrames(){return rendered;},
  };
}
