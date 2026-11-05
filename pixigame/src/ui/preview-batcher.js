import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cloneIndexedGeometry} from '../three/indexed-geometry.js';

const properties=['type','side','transparent','depthWrite','depthTest','blending','forceSinglePass','toneMapped','flatShading','alphaTest','envMapIntensity','clearcoat','clearcoatRoughness','transmission','thickness','ior','reflectivity','attenuationDistance','dispersion','wireframe','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'];
const usesPalette=m=>(m.isMeshStandardMaterial||m.isMeshBasicMaterial)&&!Object.values(m).some(value=>value?.isTexture)&&!m.vertexColors;
// Compare the values baked into the vertex buffers directly. Building a
// decimal string for every vertex transform was costly even on a cache hit.
function groupChanged(batch, group, anchorInverse, matrix) {
  let changed = batch.inputs.length !== group.length;
  batch.inputs.length = group.length;
  for (let i = 0; i < group.length; i++) {
    const mesh = group[i], geometry = mesh.geometry, m = mesh.material;
    const input = batch.inputs[i] ?? (batch.inputs[i] = { transform: new Float64Array(16) });
    matrix.multiplyMatrices(anchorInverse, mesh.matrixWorld);
    for (let j = 0; j < 16; j++) {
      const value = Math.round(matrix.elements[j] * 1e6);
      if (input.transform[j] !== value) { input.transform[j] = value; changed = true; }
    }
    const attrs = geometry.attributes;
    if (input.mesh !== mesh || input.geometry !== geometry || input.position !== attrs.position.version ||
        input.normal !== attrs.normal?.version || input.uv !== attrs.uv?.version ||
        input.r !== m.color?.r || input.g !== m.color?.g || input.b !== m.color?.b ||
        input.opacity !== m.opacity || input.roughness !== m.roughness || input.metalness !== m.metalness ||
        input.er !== m.emissive?.r || input.eg !== m.emissive?.g || input.eb !== m.emissive?.b ||
        input.intensity !== m.emissiveIntensity) {
      Object.assign(input, { mesh, geometry, position: attrs.position.version, normal: attrs.normal?.version,
        uv: attrs.uv?.version, r: m.color?.r, g: m.color?.g, b: m.color?.b, opacity: m.opacity,
        roughness: m.roughness, metalness: m.metalness, er: m.emissive?.r, eg: m.emissive?.g,
        eb: m.emissive?.b, intensity: m.emissiveIntensity });
      changed = true;
    }
  }
  return changed;
}
// UI aircraft are parked meshes. Share compatible PBR draws while retaining
// source-local coordinates for the authored analytic machining shader.
export function createPreviewBatcher(root){
  const batches=new Map(),programs=new Map(),hidden=[],inverse=new THREE.Matrix4(),anchorInverse=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  let stats={sources:0,batches:0,skipped:0,unbatched:[]};
  function restore(){for(const [mesh,mask]of hidden)mesh.layers.mask=mask;hidden.length=0;for(const batch of batches.values())batch.mesh.visible=false;}
  function materialKey(mesh, materialStates){
    const m=mesh.material,g=mesh.geometry;
    if(Array.isArray(m)||mesh.isSkinnedMesh||mesh.isInstancedMesh||!g.attributes.position)return null;
    if(g.drawRange.start||g.drawRange.count<(g.index?.count||g.attributes.position.count))return null;
    let state = materialStates.get(m);
    if (!state) {
      const palette = usesPalette(m);
      const program = m.customProgramCacheKey();
      if (!programs.has(program)) programs.set(program, programs.size);
      state = { palette, key: programs.get(program)+':'+properties.map(p=>m[p]).join(','),
        exact: !palette && m.isMeshStandardMaterial && m.userData.cleanAircraftSurface && !m.userData.nativeBatchExclude
          && !m.displacementMap && (!m.normalMap || m.normalMapType === THREE.TangentSpaceNormalMap)
          && Object.values(m).every(value=>!value?.isTexture || value.channel===0) };
      materialStates.set(m, state);
    }
    const {palette} = state;
    // Textured V39 armor shares a few immutable materials. Keep its exact
    // material/UVs instead of submitting each small plate separately. Custom
    // local-space shaders and unsupported vertex layouts remain unbatched.
    const exact=state.exact
      &&Object.keys(g.attributes).every(name=>['position','normal','uv'].includes(name))
      &&!Object.keys(g.morphAttributes).length&&g.groups.length<=1;
    const silhouette=mesh.name==='equipment-silhouette',line=mesh.isLineSegments&&m.isLineBasicMaterial;
    if(!palette&&!exact&&!silhouette&&!line)return null;
    // Preserve the camera-dependent ordering of translucent surfaces.
    if((palette||exact)&&m.transparent&&m.blending!==THREE.AdditiveBlending)return null;
    let articulation=mesh;
    while(articulation!==root&&!articulation.userData.uiArticulation)articulation=articulation.parent;
    // A wing's batch follows its own joint. Mixing it with a stationary hull
    // would rebuild merged geometry on every animation frame.
    const joint=articulation.userData.uiArticulation?articulation.id:'';
    return `${joint}:${mesh.isLineSegments?'line':'mesh'}:${palette}:${exact?m.uuid:''}:${state.key}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.layers.mask}:${mesh.renderOrder}:${m.userData.finishDetail?.value}:${m.userData.equipmentInk?.value}:${m.userData.equipmentGlass?.value}`;
  }
  function makeMaterial(source,palette){
    const m=source.clone(),compile=source.onBeforeCompile,key=source.customProgramCacheKey();
    if(palette){m.color.set(0xffffff);m.opacity=1;if(m.emissive)m.emissive.set(0xffffff);}
    m.onBeforeCompile=function(shader,renderer){
      compile.call(source,shader,renderer);
      if(!palette)return;
      shader.vertexShader='attribute vec4 uiColor;attribute vec2 uiPbr;attribute vec3 uiEmissive;attribute vec3 uiLocal;varying vec4 vUiColor;varying vec2 vUiPbr;varying vec3 vUiEmissive;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvUiColor=uiColor;vUiPbr=uiPbr;vUiEmissive=uiEmissive;').replace('vFinishPosition = position;','vFinishPosition = uiLocal;');
      shader.fragmentShader='varying vec4 vUiColor;varying vec2 vUiPbr;varying vec3 vUiEmissive;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor *= vUiColor;')
        .replace('#include <roughnessmap_fragment>','float roughnessFactor=vUiPbr.x;')
        .replace('#include <metalnessmap_fragment>','float metalnessFactor=vUiPbr.y;')
        .replace('vec3 totalEmissiveRadiance = emissive;','vec3 totalEmissiveRadiance = vUiEmissive;');
    };
    m.customProgramCacheKey=()=>`${key}/ui-palette-v1/${palette}`;
    return m;
  }
  function update(){
    restore();root.updateWorldMatrix(true,true);inverse.copy(root.matrixWorld).invert();
    const groups=new Map(),materialStates=new Map();stats={sources:0,batches:0,skipped:0,unbatched:[],groups:[]};
    root.traverseVisible(mesh=>{
      if(!mesh.geometry||mesh.userData.uiBatch)return;
      const m=mesh.material;
      // Disabled idle effects still have scene nodes, but submit no visible
      // light and do not write depth. Exclude those exact no-op draws.
      if(m&&!Array.isArray(m)&&!m.depthWrite&&m.transparent&&
        (m.opacity===0||m.blending===THREE.AdditiveBlending&&m.uniforms?.uGain?.value===0)){
        hidden.push([mesh,mesh.layers.mask]);mesh.layers.mask=0;stats.skipped++;return;
      }
      const key=materialKey(mesh,materialStates);
      if(key===null){stats.unbatched.push({name:mesh.material?.name||mesh.name||mesh.type,type:m?.type,blend:m?.blending,uniforms:Object.keys(m?.uniforms||{})});return;}
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
    });
    for(const [key,group]of groups){
      stats.groups.push({count:group.length,material:group[0].material.name,key});
      if(group.length<2)continue;
      const first=group[0],palette=materialStates.get(first.material).palette;
      let anchor=first.parent;
      const contains=(parent,node)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
      for(const mesh of group)while(anchor!==root&&!contains(anchor,mesh))anchor=anchor.parent;
      anchorInverse.copy(anchor.matrixWorld).invert();
      let batch=batches.get(key);
      if(!batch){
        const material=makeMaterial(first.material,palette),mesh=first.isLineSegments?new THREE.LineSegments(new THREE.BufferGeometry(),material):new THREE.Mesh(new THREE.BufferGeometry(),material);
        mesh.userData.uiBatch=true;mesh.name='UI batch';mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.layers.mask=first.layers.mask;mesh.renderOrder=first.renderOrder;mesh.frustumCulled=false;
        mesh.matrixAutoUpdate=false;root.add(mesh);batch={mesh,inputs:[]};batches.set(key,batch);
      }
      batch.mesh.matrix.multiplyMatrices(inverse,anchor.matrixWorld);batch.mesh.matrixWorldNeedsUpdate=true;
      if(groupChanged(batch,group,anchorInverse,matrix)){
        const parts=group.map(mesh=>{
          const source=mesh.geometry,m=mesh.material;
          matrix.multiplyMatrices(anchorInverse,mesh.matrixWorld);
          const g=cloneIndexedGeometry(source,matrix,!mesh.isLineSegments);
          for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
          const n=g.attributes.position.count;
          if(!g.attributes.normal)g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3),3));
          if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));
          if(palette){
            const colors=new Float32Array(n*4),pbr=new Float32Array(n*2),emissive=new Float32Array(n*3);
            const colorValues=[m.color.r,m.color.g,m.color.b,m.opacity];
            const pbrValues=[m.roughness||0,m.metalness||0];
            const glow=m.emissiveIntensity||0;
            const emissiveValues=[m.emissive?.r*glow||0,m.emissive?.g*glow||0,m.emissive?.b*glow||0];
            for(let i=0;i<n;i++){colors.set(colorValues,i*4);pbr.set(pbrValues,i*2);emissive.set(emissiveValues,i*3);}
            g.setAttribute('uiColor',new THREE.BufferAttribute(colors,4));g.setAttribute('uiPbr',new THREE.BufferAttribute(pbr,2));g.setAttribute('uiEmissive',new THREE.BufferAttribute(emissive,3));g.setAttribute('uiLocal',new THREE.BufferAttribute(source.attributes.position.array,3));
          }
          return g;
        });
        const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();
        if(!geometry){batch.inputs.length=0;throw Error('预览合批顶点格式不一致');}
        batch.mesh.geometry.dispose();batch.mesh.geometry=geometry;
      }
      batch.mesh.visible=true;stats.sources+=group.length;stats.batches++;
      for(const mesh of group){hidden.push([mesh,mesh.layers.mask]);mesh.layers.mask=0;}
    }
  }
  return {update,restore,get stats(){return stats;},clear(){restore();for(const {mesh}of batches.values()){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}batches.clear();},destroy(){this.clear();programs.clear();}};
}
