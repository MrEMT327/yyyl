import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {instantiateFighterPackage} from '../three/aircraft/fighter-packages.js';
import {createAircraftStyle} from '../three/aircraft/aircraft-style.js';
import {createAircraftLighting} from '../three/aircraft/aircraft-lighting.js';
import {createPreviewBatcher} from './preview-batcher.js';
import {hangarPivot} from './sortie-hangar-pivot.js';
import {hangarPose} from './sortie-hangar-motion.js';

// Identical geometry, pivot, finish and lighting on both rendering paths.
export function createSortieHangarScene(renderer,aircraftId){
  const scene=new THREE.Scene(),mount=new THREE.Group();scene.add(mount);
  const camera=new THREE.OrthographicCamera(-8,8,8,-8,.1,100);
  camera.position.set(0,4.7,-24);camera.up.set(0,1,0);camera.lookAt(0,4.7,0);
  createAircraftLighting(scene);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
  let environment;
  try{environment=pmrem.fromScene(room,.04);}finally{room.dispose();pmrem.dispose();}
  scene.environment=environment.texture;
  const asset=instantiateFighterPackage(aircraftId);
  const bounds=new THREE.Box3().setFromObject(asset.solid,true),size=bounds.getSize(new THREE.Vector3());
  const center=hangarPivot(asset.solid,bounds,asset),normalized=new THREE.Group();
  normalized.scale.setScalar(10/Math.max(size.x,size.z,1));
  const undersideOffset=(center.y-bounds.min.y)*normalized.scale.y;
  asset.solid.position.sub(center);normalized.add(asset.solid);mount.add(normalized);
  asset.solid.traverse(node=>{
    if(node.isLight)node.visible=false;
    for(const material of [].concat(node.material||[])){
      if(material.isMeshPhysicalMaterial)material.transmission=0;
      material.needsUpdate=true;
    }
  });
  const style=createAircraftStyle(normalized,{outlineScale:10/15.75509262084961});style.setEnabled(true);
  // The elevator changes only the outer pose. Bake parked meshes ONCE;
  // do not traverse and rebuild the batch buffers on every animation frame.
  const batcher=createPreviewBatcher(normalized);batcher.update();
  let bufferWidth=-1,bufferHeight=-1;
  return {
    resize(width,height,deckHeight){
      const nextWidth=Math.round(width),nextHeight=Math.round(height);
      // Assigning even identical canvas dimensions clears its drawing buffer.
      if(nextWidth!==bufferWidth||nextHeight!==bufferHeight){
        renderer.setSize(nextWidth,nextHeight,false);bufferWidth=nextWidth;bufferHeight=nextHeight;
      }
      const halfHeight=8,halfWidth=halfHeight*width/height;
      Object.assign(camera,{left:-halfWidth,right:halfWidth,top:halfHeight,bottom:-halfHeight});
      const gap=Math.max(2,Math.min(5,width*.009));
      normalized.position.y=undersideOffset+camera.position.y-halfHeight
        +(deckHeight*(1-.445)+gap)*2*halfHeight/height;
      camera.updateProjectionMatrix();
    },
    warmup(){
      const compiling=renderer.compileAsync(scene,camera);
      // An offscreen canvas has not presented yet. Submit queued shader work
      // before polling completion; otherwise the first frame may wait for a swap.
      renderer.getContext().flush();
      return compiling;
    },
    draw(seconds,reduced=false){
      const pose=hangarPose(seconds,reduced);
      // Vertical travel is the compositor transform of the whole canvas.
      // 5.2 world units / the 16-unit orthographic height = 32.5%.
      mount.rotation.y=pose.yaw;
      // The calibrated pivot stays on the platform axis for the entire turn.
      renderer.render(scene,camera);return pose;
    },
    dispose(){batcher.destroy();style.dispose();asset.dispose();environment.dispose();scene.clear();},
  };
}
