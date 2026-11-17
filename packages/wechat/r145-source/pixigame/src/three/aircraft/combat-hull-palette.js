import {Material, MeshPhysicalMaterial, MeshStandardMaterial, ShaderChunk} from 'three';

export const hullMaterialIndex = 'combatMaterialIndex';
export const maxHullMaterialSlots = 16;

const separateValues = new Set([
  'name', 'uuid', 'userData', 'version', '_listeners', 'defines',
  'color', 'emissive', 'emissiveIntensity', 'roughness', 'metalness', '_clearcoat', 'clearcoatRoughness',
]);

function sameValue(a, b) {
  if (Object.is(a, b)) return true;
  if (!a || !b || a.constructor !== b.constructor) return false;
  if (Array.isArray(a)) return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
  return Boolean(a.equals?.(b));
}

// Match the normal PBR shader, maps and render state. Only the listed surface
// factors may differ. The stored clone also detects new maps or state changes.
export function captureHullSurface(material) {
  const {constructor} = material;
  if (constructor !== MeshStandardMaterial && constructor !== MeshPhysicalMaterial) return null;
  const shared = material.clone(), definitions = Object.entries(shared.defines);
  const clearcoat = shared.clearcoat > 0;
  const fields = Object.keys(shared).filter(key => !separateValues.has(key) &&
    (key !== 'envMapIntensity' || shared.envMap !== null));
  const matches = candidate => candidate.constructor === constructor &&
    candidate.onBeforeCompile === Material.prototype.onBeforeCompile &&
    candidate.customProgramCacheKey === Material.prototype.customProgramCacheKey &&
    (candidate.clearcoat > 0) === clearcoat && candidate.defines &&
    Object.keys(candidate.defines).length === definitions.length &&
    definitions.every(([key, value]) => candidate.defines[key] === value) &&
    fields.every(key => sameValue(shared[key], candidate[key]));
  return matches(material) ? {shared, clearcoat, matches} : null;
}

export function createHullSurfacePalette({shared, clearcoat, matches}, materials) {
  const size=materials.length;
  const paint=new Float32Array(size*4), emission=new Float32Array(size*4), coat=new Float32Array(size*2);
  const coatVarying=clearcoat?'flat varying vec2 vCombatCoat;\n':'';
  const varyings='flat varying vec4 vCombatPaint;\nflat varying vec4 vCombatEmission;\n'+coatVarying;
  shared.customProgramCacheKey=()=> 'combat-surface-palette/'+size+'/'+clearcoat;
  shared.onBeforeCompile=shader=>{
    shader.uniforms.combatPaint={value:paint};
    shader.uniforms.combatEmission={value:emission};
    if(clearcoat)shader.uniforms.combatCoat={value:coat};
    shader.vertexShader=
      'attribute float '+hullMaterialIndex+';\n'+varyings+
      'uniform vec4 combatPaint['+size+'], combatEmission['+size+'];\n'+
      (clearcoat?'uniform vec2 combatCoat['+size+'];\n':'')+
      shader.vertexShader.replace('void main() {','void main() {\n'+
        'int surface = int('+hullMaterialIndex+');\nvCombatPaint = combatPaint[surface];\nvCombatEmission = combatEmission[surface];\n'+
        (clearcoat?'vCombatCoat = combatCoat[surface];\n':''));
    shader.fragmentShader=varyings+shader.fragmentShader
      .replace('vec4( diffuse, opacity )','vec4( vCombatPaint.rgb, opacity )')
      .replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vCombatEmission.rgb;')
      .replace('#include <roughnessmap_fragment>', ShaderChunk.roughnessmap_fragment.replace('= roughness;', '= vCombatPaint.a;'))
      .replace('#include <metalnessmap_fragment>', ShaderChunk.metalnessmap_fragment.replace('= metalness;', '= vCombatEmission.a;'));
    if(clearcoat)shader.fragmentShader=shader.fragmentShader.replace('#include <lights_physical_fragment>',
      ShaderChunk.lights_physical_fragment.replace('= clearcoat;', '= vCombatCoat.x;').replace('= clearcoatRoughness;', '= vCombatCoat.y;'));
  };
  return {
    material:shared,
    ready:()=>materials.every(matches),
    update(){
      for(let i=0;i<size;i++){
        const material=materials[i], p=i*4, c=i*2;
        material.color.toArray(paint,p);paint[p+3]=material.roughness;
        const {emissive, emissiveIntensity}=material;
        emission[p]=emissive.r*emissiveIntensity;
        emission[p+1]=emissive.g*emissiveIntensity;
        emission[p+2]=emissive.b*emissiveIntensity;
        emission[p+3]=material.metalness;
        if(clearcoat){coat[c]=material.clearcoat;coat[c+1]=material.clearcoatRoughness;}
      }
    },
  };
}
