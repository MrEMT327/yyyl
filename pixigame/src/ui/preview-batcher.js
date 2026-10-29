import * as THREE from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

const properties=['type','side','transparent','depthWrite','depthTest','blending','forceSinglePass','toneMapped','flatShading','alphaTest','envMapIntensity','clearcoat','clearcoatRoughness','transmission','thickness','ior','reflectivity','attenuationDistance','dispersion','wireframe','polygonOffset','polygonOffsetFactor','polygonOffsetUnits'];
// UI aircraft are parked meshes. Share compatible PBR draws while retaining
// source-local coordinates for the authored analytic machining shader.
export function createPreviewBatcher(root){
  const batches=new Map(),programs=new Map(),hidden=[],inverse=new THREE.Matrix4(),anchorInverse=new THREE.Matrix4(),matrix=new THREE.Matrix4();
  let stats={sources:0,batches:0,skipped:0,unbatched:[]};
  function restore(){for(const [mesh,mask]of hidden)mesh.layers.mask=mask;hidden.length=0;for(const batch of batches.values())batch.mesh.visible=false;}
  function materialKey(mesh){
    const m=mesh.material,g=mesh.geometry;
    if(Array.isArray(m)||mesh.isSkinnedMesh||mesh.isInstancedMesh||!g.attributes.position)return null;
    if(g.drawRange.start||g.drawRange.count<(g.index?.count||g.attributes.position.count))return null;
    const palette=(m.isMeshStandardMaterial||m.isMeshBasicMaterial)&&!m.map&&!m.normalMap&&!m.alphaMap&&!m.vertexColors;
    const silhouette=mesh.name==='equipment-silhouette',line=mesh.isLineSegments&&m.isLineBasicMaterial;
    if(!palette&&!silhouette&&!line)return null;
    // Preserve the camera-dependent ordering of translucent surfaces.
    if(palette&&m.transparent&&m.blending!==THREE.AdditiveBlending)return null;
    const program=m.customProgramCacheKey();if(!programs.has(program))programs.set(program,programs.size);
    return `${mesh.isLineSegments?'line':'mesh'}:${palette}:${programs.get(program)}:${properties.map(p=>m[p]).join(',')}:${mesh.castShadow}:${mesh.receiveShadow}:${mesh.layers.mask}:${mesh.renderOrder}:${m.userData.finishDetail?.value}:${m.userData.equipmentInk?.value}:${m.userData.equipmentGlass?.value}`;
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
    const groups=new Map();stats={sources:0,batches:0,skipped:0,unbatched:[],groups:[]};
    root.traverseVisible(mesh=>{
      if(!mesh.geometry||mesh.userData.uiBatch)return;
      const m=mesh.material;
      // Disabled idle effects still have scene nodes, but submit no visible
      // light and do not write depth. Exclude those exact no-op draws.
      if(m&&!Array.isArray(m)&&!m.depthWrite&&m.transparent&&
        (m.opacity===0||m.blending===THREE.AdditiveBlending&&m.uniforms?.uGain?.value===0)){
        hidden.push([mesh,mesh.layers.mask]);mesh.layers.mask=0;stats.skipped++;return;
      }
      const key=materialKey(mesh);
      if(key===null){stats.unbatched.push({name:mesh.material?.name||mesh.name||mesh.type,type:m?.type,blend:m?.blending,uniforms:Object.keys(m?.uniforms||{})});return;}
      if(!groups.has(key))groups.set(key,[]);groups.get(key).push(mesh);
    });
    for(const [key,group]of groups){
      stats.groups.push({count:group.length,material:group[0].material.name,key});
      if(group.length<2)continue;
      const first=group[0],palette=first.material.isMeshStandardMaterial||first.material.isMeshBasicMaterial;
      let anchor=first.parent;
      const contains=(parent,node)=>{for(let p=node;p;p=p.parent)if(p===parent)return true;return false;};
      for(const mesh of group)while(anchor!==root&&!contains(anchor,mesh))anchor=anchor.parent;
      anchorInverse.copy(anchor.matrixWorld).invert();
      let batch=batches.get(key);
      if(!batch){
        const material=makeMaterial(first.material,palette),mesh=first.isLineSegments?new THREE.LineSegments(new THREE.BufferGeometry(),material):new THREE.Mesh(new THREE.BufferGeometry(),material);
        mesh.userData.uiBatch=true;mesh.name='UI batch';mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.layers.mask=first.layers.mask;mesh.renderOrder=first.renderOrder;mesh.frustumCulled=false;
        mesh.matrixAutoUpdate=false;root.add(mesh);batch={mesh,signature:null};batches.set(key,batch);
      }
      batch.mesh.matrix.multiplyMatrices(inverse,anchor.matrixWorld);batch.mesh.matrixWorldNeedsUpdate=true;
      const signature=group.map(mesh=>{const m=mesh.material;matrix.multiplyMatrices(anchorInverse,mesh.matrixWorld);return [mesh.id,mesh.geometry.id,...matrix.elements.map(v=>Math.round(v*1e6)/1e6),mesh.geometry.attributes.position.version,mesh.geometry.attributes.normal?.version,mesh.geometry.attributes.uv?.version,m.color?.r,m.color?.g,m.color?.b,m.opacity,m.roughness,m.metalness,m.emissive?.r,m.emissive?.g,m.emissive?.b,m.emissiveIntensity].join(',');}).join('|');
      if(signature!==batch.signature){
        const parts=group.map(mesh=>{
          const source=mesh.geometry,m=mesh.material,g=source.index?source.toNonIndexed():source.clone();
          const local=g.attributes.position.array.slice();
          for(const name of Object.keys(g.attributes))if(!['position','normal','uv'].includes(name))g.deleteAttribute(name);
          matrix.multiplyMatrices(anchorInverse,mesh.matrixWorld);g.applyMatrix4(matrix);
          if(matrix.determinant()<0&&!mesh.isLineSegments){
            for(const a of Object.values(g.attributes))for(let i=0;i<a.count;i+=3)for(let c=0;c<a.itemSize;c++){const p=(i+1)*a.itemSize+c,q=(i+2)*a.itemSize+c,v=a.array[p];a.array[p]=a.array[q];a.array[q]=v;}
            for(let i=0;i<local.length;i+=9)for(let c=0;c<3;c++){const p=i+3+c,q=i+6+c,v=local[p];local[p]=local[q];local[q]=v;}
          }
          const n=g.attributes.position.count;
          if(!g.attributes.normal)g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(n*3),3));
          if(!g.attributes.uv)g.setAttribute('uv',new THREE.BufferAttribute(new Float32Array(n*2),2));
          if(palette){
            const colors=new Float32Array(n*4),pbr=new Float32Array(n*2),emissive=new Float32Array(n*3);
            for(let i=0;i<n;i++){colors.set([m.color.r,m.color.g,m.color.b,m.opacity],i*4);pbr.set([m.roughness||0,m.metalness||0],i*2);emissive.set([m.emissive?.r*(m.emissiveIntensity||0)||0,m.emissive?.g*(m.emissiveIntensity||0)||0,m.emissive?.b*(m.emissiveIntensity||0)||0],i*3);}
            g.setAttribute('uiColor',new THREE.BufferAttribute(colors,4));g.setAttribute('uiPbr',new THREE.BufferAttribute(pbr,2));g.setAttribute('uiEmissive',new THREE.BufferAttribute(emissive,3));g.setAttribute('uiLocal',new THREE.BufferAttribute(local,3));
          }
          return g;
        });
        const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();
        if(!geometry)throw Error('预览合批顶点格式不一致');
        batch.mesh.geometry.dispose();batch.mesh.geometry=geometry;batch.signature=signature;
      }
      batch.mesh.visible=true;stats.sources+=group.length;stats.batches++;
      for(const mesh of group){hidden.push([mesh,mesh.layers.mask]);mesh.layers.mask=0;}
    }
  }
  return {update,restore,get stats(){return stats;},clear(){restore();for(const {mesh}of batches.values()){mesh.removeFromParent();mesh.geometry.dispose();mesh.material.dispose();}batches.clear();},destroy(){this.clear();programs.clear();}};
}
