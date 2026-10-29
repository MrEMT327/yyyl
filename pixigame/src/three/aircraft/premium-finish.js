import * as T from 'three';
// Analytic surface finish: resolution-independent panel seams and brushed metal.
// Derivative filtering keeps the fine engraving stable at thumbnail scale.
export function applyMachinedFinish(material, {panels = false, scale = 1} = {}) {
  material.userData.finishDetail = { value: 1 };
  const compile = material.onBeforeCompile;
  const key = material.customProgramCacheKey();
  material.onBeforeCompile = function(shader, renderer) {
    compile.call(this, shader, renderer);
    shader.uniforms.uFinishDetail = this.userData.finishDetail;
    shader.vertexShader = 'varying vec3 vFinishPosition;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFinishPosition = position;');
    shader.fragmentShader = 'varying vec3 vFinishPosition;\nuniform float uFinishDetail;\n' + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      vec3 fp = vFinishPosition * ${Number(scale).toFixed(3)};
      float brushFootprint = max(fwidth(fp.z * 85.), .001);
      float brush = sin(fp.z * 85.) * (1. - smoothstep(.6, 2.5, brushFootprint));
      roughnessFactor = clamp(roughnessFactor + brush * .024 * uFinishDetail, .12, .85);
    `);
    if (panels) shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 plateUV = vFinishPosition.xz * vec2(.82, .57) * ${Number(scale).toFixed(3)};
      plateUV.x += floor(plateUV.y) * .23;
      vec2 seamDistance = abs(fract(plateUV + .5) - .5);
      vec2 seamAA = max(fwidth(plateUV), vec2(.0001));
      vec2 seamLine = (1. - smoothstep(vec2(.005), vec2(.005) + seamAA, seamDistance))
        * (1. - smoothstep(vec2(.025), vec2(.09), seamAA));
      float seam = max(seamLine.x, seamLine.y);
      diffuseColor.rgb *= 1. - seam * .30 * uFinishDetail;
    `);
  };
  material.customProgramCacheKey = () => `${key}/machined-v2/${panels}/${scale}`;
  material.needsUpdate = true;
  return material;
}

// Only instance-owned materials are changed; package geometry and textures stay shared.
export function refineKestrelMaterials(asset) {
  if (asset.entry.slug !== 'kestrel') return;
  for (const material of asset.materials.values()) {
    const name = material.name || '';
    if (!material.isMeshStandardMaterial) continue;
    if (/kestrel\/(shell|white)$|pearl ceramic/.test(name)) {
      material.color.set('#d5e4ed'); material.metalness = .48; material.roughness = .29; material.envMapIntensity = 1.15;
      applyMachinedFinish(material, {panels:true});
    } else if (/kestrel\/dark$|deep graphite/.test(name)) {
      material.color.set('#10283e'); material.metalness = .72; material.roughness = .28; material.envMapIntensity = 1.2;
      applyMachinedFinish(material);
    } else if (/kestrel\/gun$|chamfer titanium/.test(name)) {
      material.color.set('#758eaa'); material.metalness = .88; material.roughness = .22; material.envMapIntensity = 1.35;
      applyMachinedFinish(material);
    } else if (name === 'kestrel/gold') {
      material.color.set('#efc780'); material.metalness = .82; material.roughness = .23; material.envMapIntensity = 1.3;
    } else if (name === 'kestrel/glass') {
      material.color.set('#247ead'); material.transmission = .42; material.metalness = .2;
      material.roughness = .085; material.clearcoat = 1; material.clearcoatRoughness = .06;
      material.ior = 1.45; material.envMapIntensity = 1.6;
    } else if (/small cyan insets/.test(name)) {
      material.color.set('#279bbd'); material.emissive.set('#57dcff'); material.emissiveIntensity = 1.7;
    }
  }
}

export function refineAircraftMaterials(asset) {
  if(asset.entry.slug==='kestrel'){refineKestrelMaterials(asset);return;}
  for(const material of asset.materials.values()){
    if(!material.isMeshStandardMaterial)continue;
    const role=(material.name||'').split('/').at(-1);
    if(['shell','white','bright','accent'].includes(role)){
      material.metalness=role==='shell'?.55:.48;material.roughness=.29;material.envMapIntensity=1.18;
      if(material.isMeshPhysicalMaterial){material.clearcoat=.65;material.clearcoatRoughness=.16;}
      applyMachinedFinish(material,{panels:true,scale:15.755/(asset.view.bounds.max[0]-asset.view.bounds.min[0])});
    }else if(['dark','black'].includes(role)){
      material.metalness=.66;material.roughness=.32;material.envMapIntensity=1.12;applyMachinedFinish(material);
    }else if(['metal','steel','gun','trim','gold'].includes(role)){
      material.metalness=.84;material.roughness=.23;material.envMapIntensity=1.3;applyMachinedFinish(material);
    }else if(role==='glass'){
      material.color.lerp(new T.Color(asset.entry.defaults.engineColor||'#399fbe'),.48).multiplyScalar(.68);
      material.transmission=.46;material.metalness=.16;material.roughness=.07;material.clearcoat=1;material.clearcoatRoughness=.06;
      material.ior=1.45;material.envMapIntensity=1.5;
    }
  }
}
