import * as THREE from 'three';
import { aircraftFxBudget } from '../three/aircraft/aircraft-fx-budget.js';

/** The package's volumetric exhaust needs the hull/weapon depth buffer. The
 * combat camera is orthographic, unlike the package's perspective showcase. */
const exhaustScratch=new WeakMap();
export function prepareCombatExhaust(fighter, camera, displayWidth = 256) {
  let scratch=exhaustScratch.get(fighter);if(!scratch){scratch={direction:new THREE.Vector3(),inverse:new THREE.Matrix4()};exhaustScratch.set(fighter,scratch);}
  const direction = camera.getWorldDirection(scratch.direction);
  const { jetSteps } = aircraftFxBudget(displayWidth);
  for (const { object } of fighter.runtime.jets) {
    const material = object.material;
    if (material.uniforms.uSteps) material.uniforms.uSteps.value = Math.min(material.uniforms.uSteps.value, jetSteps);
    if (!material.userData.combatExhaustDepth) {
      const ray = 'vec3 rd=normalize(vLocal-uEye);';
      const depth = 'depth=(uNear*uFar)/(uFar-d*(uFar-uNear));';
      if (!material.fragmentShader.includes(ray) || !material.fragmentShader.includes(depth))
        throw new Error('机体尾焰深度接口不匹配');
      material.fragmentShader = 'uniform vec3 uCombatRayDirection;\n' + material.fragmentShader
        .replace(ray, 'vec3 rd=normalize(uCombatRayDirection);vec3 rayOrigin=vLocal-rd*8.;')
        .replaceAll('-uEye)*ir', '-rayOrigin)*ir')
        .replace('vec3 p=uEye+rd*', 'vec3 p=rayOrigin+rd*')
        .replace(depth, 'depth=mix(uNear,uFar,d);');
      material.uniforms.uCombatRayDirection = { value: new THREE.Vector3() };
      material.userData.combatExhaustDepth = true;
      material.needsUpdate = true;
    }
    object.updateWorldMatrix(true, false);
    material.uniforms.uCombatRayDirection.value.copy(direction)
      .transformDirection(scratch.inverse.copy(object.matrixWorld).invert());
  }
}

export function createCombatAircraftRenderer(renderer, width, height = width) {
  const target = new THREE.WebGLRenderTarget(width, height);
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  const resolution = new THREE.Vector2(width, height);
  const states=[];let depth=0;
  return {
    resize(nextWidth, nextHeight = nextWidth) {
      nextWidth=Math.max(1,Math.round(nextWidth));nextHeight=Math.max(1,Math.round(nextHeight));
      if(nextWidth===width&&nextHeight===height)return;
      width=nextWidth;height=nextHeight;target.setSize(width,height);resolution.set(width,height);
    },
    render(scene, camera, fighter, displayWidth = width) {
      const index=depth++,state=states[index]??(states[index]={viewport:new THREE.Vector4(),scissor:new THREE.Vector4(),jets:[],info:{texture:target.depthTexture,resolution,near:0,far:0}});
      const draw=()=>{
        const previousTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(state.viewport),scissor=renderer.getScissor(state.scissor),scissorTest=renderer.getScissorTest();
        const jets=state.jets;let count=0;
        for(const jet of fighter.runtime.jets){const saved=jets[count]??(jets[count]=[]);saved[0]=jet.object;saved[1]=jet.object.visible;count++;}jets.length=count;
        const previousDepth=fighter.runtime.depthInfo;
        try {
          for(const [object]of jets)object.visible=false;
          // RenderTarget.viewport is already in physical pixels. setViewport
          // would multiply it by canvas DPR again and misalign the depth map.
          renderer.setRenderTarget(target);
          renderer.setScissorTest(false);renderer.clear();renderer.render(scene,camera);
        } catch(error){fighter.runtime.depthInfo=previousDepth;throw error;}
        finally {
          for(const [object,visible]of jets)object.visible=visible;
          renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
        }
        state.info.near=camera.near;state.info.far=camera.far;fighter.runtime.depthInfo=state.info;
        prepareCombatExhaust(fighter,camera,displayWidth);
        // The scoped path already prepared the same camera-facing geometry
        // before depth. Legacy callers without that scope retain their hook.
        if(!fighter.withPreparedRender)fighter.runtime.prepareRender?.(camera);
        renderer.render(scene,camera);
      };
      state.info.near=camera.near;state.info.far=camera.far;
      const previousDepth=fighter.runtime.depthInfo;
      try{
        fighter.runtime.depthInfo=state.info;
        return fighter.withPreparedRender ? fighter.withPreparedRender(camera,draw) : draw();
      }catch(error){fighter.runtime.depthInfo=previousDepth;throw error;}
      finally{depth--;}
    },
    dispose() { target.dispose(); },
  };
}
