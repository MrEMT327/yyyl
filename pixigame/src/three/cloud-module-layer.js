import * as T from 'three';
import { STAGE1_CLOUD_SPRITES } from './stage1-cloud-modules.js';

// Reusable module pool, not a scrolling fog strip. Opaque cloud bodies come
// from the generated PNGs; only their antialiased outer contour is translucent.
export function createCloudModuleLayer(definition, renderOrder) {
  const mesh = new T.Group();
  mesh.name = `chapter-${definition.id}-layer`;
  const geometry = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const materials = new Map();
  const modules = definition.modules.map(([source,x,z,width], index) => {
    if (!materials.has(source)) {
      const material = new T.MeshBasicMaterial({
        color: definition.tint, transparent:true, opacity:definition.opacity ?? 1, alphaTest:.035,
        depthWrite:false, toneMapped:false,
      });
      // Exported painted cores are 248–255 alpha. Saturate that tiny export
      // variation, retaining the full soft contour instead of a 50% hard cut.
      material.onBeforeCompile=shader=>{
        shader.uniforms.cloudWhiteness={value:definition.whiteness ?? 0};
        shader.fragmentShader='uniform float cloudWhiteness;\n'+shader.fragmentShader;
        shader.fragmentShader=shader.fragmentShader.replace('#include <alphatest_fragment>',
          'diffuseColor.a = min(diffuseColor.a * (255.0 / 248.0) / max(opacity,.001), 1.0) * opacity;\n diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.0),cloudWhiteness);\n#include <alphatest_fragment>');
      };
      material.customProgramCacheKey=()=> 'coastal-cloud-body-v2';
      materials.set(source,material);
    }
    const sprite = new T.Mesh(geometry, materials.get(source));
    sprite.name = `${definition.id}-module-${index}`;
    sprite.renderOrder = renderOrder;
    sprite.position.y = definition.depth;
    mesh.add(sprite);
    return {sprite,source,x,z,width};
  });
  return {definition,mesh,geometry,materials,modules};
}

export function syncCloudModuleLayer(record, textures, sceneId, elapsed, motion = {}) {
  const {definition,mesh,materials,modules} = record;
  const units = motion.moduleUnitsPerWorld ?? 24;
  const period = (motion.moduleLoopLength ?? 200) * units;
  const travel = motion.moduleTravel ?? elapsed * definition.nativeSpeed * units;
  mesh.position.x = 300 + (motion.lateralOffset ?? 0);
  for (const [source,material] of materials) {
    const texture = textures.get(`${sceneId}/${source}`) ?? null;
    if (material.map !== texture) {material.map=texture;material.needsUpdate=true;}
  }
  let visibleModules = 0;
  for (const {sprite,source,x,z,width} of modules) {
    const asset = STAGE1_CLOUD_SPRITES[source];
    const w=width*units, h=w*asset.height/asset.width;
    // The copy wraps half a cycle outside the viewport, never on its edge.
    const centerZ=650+(((-z*units+travel+period/2)%period+period)%period)-period/2;
    sprite.position.x=x*units;
    sprite.position.z=centerZ;
    sprite.scale.set(w,1,h);
    sprite.visible=!!sprite.material.map && centerZ+h/2>=-100 && centerZ-h/2<=1400;
    if(sprite.visible)visibleModules++;
  }
  Object.assign(mesh.userData.terrain ||= {}, {
    id:definition.id,role:definition.role,name:definition.name,depth:definition.depth,
    speed:definition.nativeSpeed,scroll:travel,x:mesh.position.x,
    source:`${sceneId}/modules`,status:[...materials.values()].every(m=>m.map)?'ready':'loading',
    opening:null,moduleCount:modules.length,visibleModules,
    modules:modules.filter(m=>m.sprite.visible).map(m=>({
      source:m.source,x:m.sprite.position.x+mesh.position.x,z:m.sprite.position.z,
      width:m.sprite.scale.x,height:m.sprite.scale.z,
    })),
  });
}
