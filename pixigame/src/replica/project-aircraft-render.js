import * as THREE from 'three';

/** The package's volumetric exhaust needs the hull/weapon depth buffer. The
 * combat camera is orthographic, unlike the package's perspective showcase. */
const exhaustScratch=new WeakMap();
export function prepareCombatExhaust(fighter, camera) {
  let scratch=exhaustScratch.get(fighter);if(!scratch){scratch={direction:new THREE.Vector3(),inverse:new THREE.Matrix4()};exhaustScratch.set(fighter,scratch);}
  const direction = camera.getWorldDirection(scratch.direction);
  for (const { object } of fighter.runtime.jets) {
    const material = object.material;
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
    render(scene, camera, fighter) {
      const index=depth++,state=states[index]??(states[index]={viewport:new THREE.Vector4(),scissor:new THREE.Vector4(),jets:[],info:{texture:target.depthTexture,resolution,near:0,far:0}});
      const draw=()=>{
        const previousTarget=renderer.getRenderTarget(),viewport=renderer.getViewport(state.viewport),scissor=renderer.getScissor(state.scissor),scissorTest=renderer.getScissorTest();
        const jets=state.jets;let count=0;
        for(const jet of fighter.runtime.jets){const saved=jets[count]??(jets[count]=[]);saved[0]=jet.object;saved[1]=jet.object.visible;count++;}jets.length=count;
        const previousDepth=fighter.runtime.depthInfo;
        try {
          for(const [object]of jets)object.visible=false;
          renderer.setRenderTarget(target);renderer.setViewport(0,0,width,height);
          renderer.setScissorTest(false);renderer.clear();renderer.render(scene,camera);
        } catch(error){fighter.runtime.depthInfo=previousDepth;throw error;}
        finally {
          for(const [object,visible]of jets)object.visible=visible;
          renderer.setRenderTarget(previousTarget);renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(scissorTest);
        }
        state.info.near=camera.near;state.info.far=camera.far;fighter.runtime.depthInfo=state.info;
        prepareCombatExhaust(fighter,camera);renderer.render(scene,camera);
      };
      try{return draw();}finally{depth--;}
    },
    dispose() { target.dispose(); },
  };
}
