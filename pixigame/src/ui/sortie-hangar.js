import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { loadFighterPackages, instantiateFighterPackage } from '../three/aircraft/fighter-packages.js';
import { hangarPose, HANGAR_VISUAL_TIMEOUT_MS } from './sortie-hangar-motion.js';
import { hangarPivot } from './sortie-hangar-pivot.js';

// Follow the existing aircraft on its elevator inside the illustrated shaft.
// No procedural hangar geometry or graphic radar is used here.
export function createSortieHangar(host, aircraftId, {onPhase=()=>{}}={}) {
  let renderer, asset, environment, observer, scene, camera, mount, normalized;
  let undersideOffset=0;
  const elevator=host.parentElement.querySelector('.sortie-hangar__elevator');
  host.dataset.aircraftId=aircraftId;
  let disposed=false, paused=false, finished=false, frame=0, elapsed=0, last=0;
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)');
  let resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  const settle=()=>{if(finished)return;finished=true;clearTimeout(deadline);resolveReady();};
  const deadline=window.setTimeout(()=>{if(!asset)host.dataset.phase='fallback';settle();},HANGAR_VISUAL_TIMEOUT_MS);
  const pose=()=>{
    if(!mount)return;
    const state=hangarPose(elapsed,reduced.matches);
    mount.position.set(state.x,state.y,state.z);mount.rotation.y=state.yaw;
    host.parentElement.style.setProperty('--elevator-lift',String(state.lift));
    if(host.dataset.phase!==state.phase){host.dataset.phase=state.phase;onPhase(state.phase);}
    if(state.complete)settle();
  };
  function draw() {
    if(disposed||!renderer||!asset)return;
    pose();
    if(!document.hidden)renderer.render(scene,camera);
  }
  function tick(now) {
    frame=0;
    if(disposed||paused||document.hidden||!asset)return;
    elapsed+=last?Math.min(.08,(now-last)/1000):0;last=now;
    draw();
    if(!reduced.matches)frame=requestAnimationFrame(tick);
  }
  const visibility=()=>{
    cancelAnimationFrame(frame);frame=0;last=0;
    if(!document.hidden&&!disposed&&!paused&&asset){draw();if(!reduced.matches)frame=requestAnimationFrame(tick);}
  };
  const reduceChanged=()=>{if(reduced.matches){draw();settle();cancelAnimationFrame(frame);frame=0;}else visibility();};
  document.addEventListener('visibilitychange',visibility);
  reduced.addEventListener('change',reduceChanged);
  const releaseGpu=()=>{
    cancelAnimationFrame(frame);frame=0;observer?.disconnect();
    asset?.dispose();asset=null;environment?.dispose();environment=null;
    if(renderer){renderer.domElement.remove();renderer.dispose();renderer.forceContextLoss();renderer=null;}
    scene?.clear();
  };
  const fallback=()=>{
    host.classList.remove('has-model');host.dataset.phase='fallback';
    releaseGpu();settle();
  };
  const resize=()=>{
    if(disposed||!renderer)return;
    const {width,height}=host.getBoundingClientRect();
    if(width<=0||height<=0)return;
    renderer.setSize(Math.round(width),Math.round(height),false);
    const halfHeight=8,halfWidth=halfHeight*width/height;
    Object.assign(camera,{left:-halfWidth,right:halfWidth,top:halfHeight,bottom:-halfHeight});
    if(normalized){
      // The deck is 44.5% down the raster, including its transparent padding.
      // Anchor each aircraft's lowest point to that surface at every aspect ratio.
      const deckWidth=elevator.getBoundingClientRect().width;
      const deckHeight=deckWidth*(elevator.naturalHeight/elevator.naturalWidth||1/3);
      const gap=Math.max(2,Math.min(5,width*.009));
      normalized.position.y=undersideOffset+camera.position.y-halfHeight
        +(deckHeight*(1-.445)+gap)*2*halfHeight/height;
    }
    camera.updateProjectionMatrix();draw();
  };
  elevator.addEventListener('load',resize);
  void (async()=>{
    try {
      await loadFighterPackages({pilotIds:[aircraftId]});
      if(disposed||finished)return;
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(2,window.devicePixelRatio||1));
      renderer.setClearColor(0,0);renderer.outputColorSpace=THREE.SRGBColorSpace;
      renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;
      scene=new THREE.Scene();mount=new THREE.Group();scene.add(mount);
      camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,100);
      // Straight-on orthographic section: no lateral bearing or camera pitch.
      camera.position.set(0,4.7,-24);camera.up.set(0,1,0);camera.lookAt(0,4.7,0);
      scene.add(new THREE.HemisphereLight('#edf7ff','#42526b',1.6));
      for(const [color,intensity,position] of [['#ffffff',3,[-7,14,-12]],['#9bdfff',2,[9,5,8]]]){
        const light=new THREE.DirectionalLight(color,intensity);light.position.set(...position);scene.add(light);
      }
      const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
      try{environment=pmrem.fromScene(room,.04);}finally{room.dispose();pmrem.dispose();}
      scene.environment=environment.texture;scene.environmentIntensity=.7;
      asset=instantiateFighterPackage(aircraftId);
      const bounds=new THREE.Box3().setFromObject(asset.solid,true),size=bounds.getSize(new THREE.Vector3()),center=hangarPivot(asset.solid,bounds);
      normalized=new THREE.Group();normalized.scale.setScalar(10/Math.max(size.x,size.z,1));
      undersideOffset=(center.y-bounds.min.y)*normalized.scale.y;
      asset.solid.position.sub(center);normalized.add(asset.solid);mount.add(normalized);
      asset.solid.traverse(node=>{
        if(node.isLight)node.visible=false;
        for(const material of [].concat(node.material||[])){
          if(material.isMeshPhysicalMaterial)material.transmission=0;
          material.needsUpdate=true;
        }
      });
      const canvas=renderer.domElement;canvas.className='sortie-hangar__canvas';canvas.setAttribute('aria-hidden','true');
      canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();if(!disposed)fallback();},{once:true});
      host.append(canvas);host.classList.add('has-model');
      observer=new ResizeObserver(resize);observer.observe(host);resize();
      if(reduced.matches){elapsed=99;draw();settle();}else visibility();
    }catch(error){if(!disposed){console.warn('[sortie presentation] using aircraft image',error);fallback();}}
  })();
  if(reduced.matches){host.dataset.phase='fallback';settle();}
  return {
    ready,
    freeze(){paused=true;cancelAnimationFrame(frame);frame=0;draw();settle();},
    dispose(){if(disposed)return;disposed=true;clearTimeout(deadline);settle();document.removeEventListener('visibilitychange',visibility);reduced.removeEventListener('change',reduceChanged);elevator.removeEventListener('load',resize);releaseGpu();},
  };
}
