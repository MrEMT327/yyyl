import * as THREE from 'three';

/** The package's volumetric exhaust needs the hull/weapon depth buffer. The
 * combat camera is orthographic, unlike the package's perspective showcase. */
export function prepareCombatExhaust(fighter, camera) {
  const direction = camera.getWorldDirection(new THREE.Vector3());
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
      .transformDirection(new THREE.Matrix4().copy(object.matrixWorld).invert());
  }
}

export function createCombatAircraftRenderer(renderer, width, height = width) {
  const target = new THREE.WebGLRenderTarget(width, height);
  target.depthTexture = new THREE.DepthTexture(width, height, THREE.UnsignedIntType);
  const resolution = new THREE.Vector2(width, height);
  return {
    render(scene, camera, fighter) {
      const previousTarget = renderer.getRenderTarget();
      const viewport = renderer.getViewport(new THREE.Vector4());
      const scissor = renderer.getScissor(new THREE.Vector4());
      const scissorTest = renderer.getScissorTest();
      const jets = fighter.runtime.jets.map(jet => [jet.object, jet.object.visible]);
      try {
        for (const [object] of jets) object.visible = false;
        renderer.setRenderTarget(target); renderer.setViewport(0, 0, width, height);
        renderer.setScissorTest(false); renderer.clear(); renderer.render(scene, camera);
      } finally {
        for (const [object, visible] of jets) object.visible = visible;
        renderer.setRenderTarget(previousTarget); renderer.setViewport(viewport);
        renderer.setScissor(scissor); renderer.setScissorTest(scissorTest);
      }
      fighter.runtime.depthInfo = { texture: target.depthTexture, resolution, near: camera.near, far: camera.far };
      prepareCombatExhaust(fighter, camera);
      renderer.render(scene, camera);
    },
    dispose() { target.dispose(); },
  };
}
