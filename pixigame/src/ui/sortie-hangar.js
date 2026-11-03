import * as THREE from 'three';
import {loadFighterPackages} from '../three/aircraft/fighter-packages.js';
import {AIRCRAFT_RENDER_STYLE} from '../three/aircraft/aircraft-lighting.js';
import {HANGAR_RISE_SECONDS,HANGAR_VISUAL_TIMEOUT_MS} from './sortie-hangar-motion.js';
import {createSortieHangarScene} from './sortie-hangar-scene.js';
import {createHangarLift} from './sortie-hangar-lift.js';

export function createSortieHangar(host,aircraftId,{onPhase=()=>{}}={}){
  const elevator=host.parentElement.querySelector('.sortie-hangar__elevator');
  const lift=createHangarLift(host,elevator),reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  host.dataset.aircraftId=aircraftId;
  let renderer,model,worker,canvas,frame=0,epoch=0,elapsed=0,paused=false,disposed=false,finished=false,started=false,mainStarted=false;
  let resolveReady;const ready=new Promise(resolve=>{resolveReady=resolve;});
  const settle=()=>{if(finished)return;finished=true;clearTimeout(deadline);resolveReady();};
  const deadline=setTimeout(()=>{if(!started)fallback();else settle();},HANGAR_VISUAL_TIMEOUT_MS);
  const phase=value=>{if(host.dataset.phase!==value){host.dataset.phase=value;onPhase(value);}};
  function stop(){if(frame)cancelAnimationFrame(frame);frame=0;}
  function release(){
    stop();
    if(worker){
      const retiring=worker;worker=null;retiring.onmessage=null;retiring.onerror=null;
      retiring.postMessage({type:'dispose'});setTimeout(()=>retiring.terminate(),250);
    }
    model?.dispose();model=null;
    renderer?.dispose();renderer?.forceContextLoss();renderer=null;canvas?.remove();canvas=null;
  }
  function fallback(){release();lift.dispose();host.classList.remove('has-model');phase('fallback');settle();}
  function dimensions(){
    const {width,height}=host.getBoundingClientRect();
    const deckWidth=elevator.getBoundingClientRect().width;
    return{width,height,deckHeight:deckWidth*(elevator.naturalHeight/elevator.naturalWidth||1/3)};
  }
  function draw(){
    if(disposed||!model)return;
    model.draw(elapsed,reduced.matches);lift.update(elapsed);
    if(elapsed>=HANGAR_RISE_SECONDS||reduced.matches){phase('ready');settle();}
  }
  function tick(time){
    frame=0;if(disposed||paused||document.hidden||!model)return;
    elapsed=(time-epoch)/1000;draw();if(!reduced.matches)frame=requestAnimationFrame(tick);
  }
  function begin(){
    if(disposed||finished)return;
    started=true;host.classList.add('has-model');host.dataset.aircraftStyle='equipment';phase(reduced.matches?'ready':'elevator');
    resize();lift.start(reduced.matches);epoch=performance.now();elapsed=0;
    if(worker)worker.postMessage({type:'start',epoch:performance.timeOrigin+epoch});
    else{draw();if(!reduced.matches)frame=requestAnimationFrame(tick);}
    if(paused||document.hidden)visibility();
    if(reduced.matches)settle();
  }
  function resize(){
    if(disposed)return;const size=dimensions();if(size.width<=0||size.height<=0)return;
    lift.resize(size.height);
    if(worker)worker.postMessage({type:'resize',...size});
    else if(model){model.resize(size.width,size.height,size.deckHeight);if(started)draw();}
  }
  function visibility(){
    if(disposed||!started)return;
    if(document.hidden||paused){
      if(!worker&&frame)elapsed=(performance.now()-epoch)/1000;
      stop();lift.pause();worker?.postMessage({type:'pause'});
    }else{
      lift.resume();
      if(worker)worker.postMessage({type:'resume'});
      else{epoch=performance.now()-elapsed*1000;stop();draw();if(!reduced.matches)frame=requestAnimationFrame(tick);}
    }
  }
  function reduceChanged(){lift.reduce(reduced.matches);worker?.postMessage({type:'reduce',value:reduced.matches});if(reduced.matches){stop();draw();phase('ready');settle();}else visibility();}
  function newCanvas(){const element=document.createElement('canvas');element.className='sortie-hangar__canvas';element.setAttribute('aria-hidden','true');host.append(element);return element;}
  async function mainThread(){
    if(disposed||finished||mainStarted)return;mainStarted=true;release();host.dataset.renderer='main';
    try{
      await loadFighterPackages({pilotIds:[aircraftId]});if(disposed||finished)return;
      canvas=newCanvas();renderer=new THREE.WebGLRenderer({canvas,alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=AIRCRAFT_RENDER_STYLE.exposure;
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(!disposed)fallback();},{once:true});
      model=createSortieHangarScene(renderer,aircraftId);resize();await model.warmup();if(!disposed&&!finished)begin();
    }catch(error){if(!disposed){console.warn('[sortie presentation] using aircraft image',error);fallback();}}
  }
  const observer=new ResizeObserver(resize);observer.observe(host);
  elevator.addEventListener('load',resize);document.addEventListener('visibilitychange',visibility);reduced.addEventListener('change',reduceChanged);
  resize();
  if(reduced.matches){phase('fallback');settle();}
  else if(typeof Worker!=='undefined'&&HTMLCanvasElement.prototype.transferControlToOffscreen){
    try{
      canvas=newCanvas();const offscreen=canvas.transferControlToOffscreen();
      worker=new Worker(new URL('./sortie-hangar.worker.js',import.meta.url),{type:'module'});host.dataset.renderer='worker';
      worker.onmessage=({data})=>{
        if(disposed)return;
        if(data.type==='ready')begin();
        else if(data.type==='complete'){phase('ready');settle();}
        else if(data.type==='error'){console.warn('[sortie worker]',data.message);if(started)fallback();else void mainThread();}
      };
      worker.onerror=()=>{if(disposed)return;if(started)fallback();else void mainThread();};
      worker.postMessage({type:'init',canvas:offscreen,aircraftId,assetBase:new URL(import.meta.env?.BASE_URL||'/',document.baseURI).href,
        ...dimensions(),pixelRatio:Math.min(2,window.devicePixelRatio||1),reduced:reduced.matches},[offscreen]);
    }catch{void mainThread();}
  }else void mainThread();
  return {
    ready,
    freeze(){paused=true;visibility();settle();},
    dispose(){if(disposed)return;disposed=true;settle();observer.disconnect();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',reduceChanged);elevator.removeEventListener('load',resize);release();lift.dispose();},
  };
}
