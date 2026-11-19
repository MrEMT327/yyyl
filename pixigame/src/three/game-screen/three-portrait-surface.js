import * as T from 'three';
import fragmentShader from './jetboard-fragment.glsl?raw';

const vertexShader=`
precision highp float;
in vec2 position;
in vec2 texcoord;
uniform vec2 sceneSize, cameraOffset, containFit;
uniform float cameraScale;
out vec2 uv,maskUV;
void main(){
  vec2 normalized=(position*cameraScale+cameraOffset)/sceneSize;
  uv=texcoord;
  maskUV=vec2(normalized.x,1.0-normalized.y);
  gl_Position=vec4(vec2(normalized.x*2.0-1.0,1.0-normalized.y*2.0)*containFit,0.0,1.0);
}`;
const uniform=value=>({value});
const full=[0,0,1,1];

/** Owns drawables and optional alpha-mask targets on the supplied Three device.
 * Caller owns the frame, output target, viewport, clear and renderer lifetime. */
export function createPortraitSurface(renderer,manifest,images) {
  const scene=new T.Scene(),camera=new T.Camera();
  const textures=new Map(),meshes=[],masks=new Map(),extra=[];
  const white=new T.DataTexture(new Uint8Array(4),1,1);white.needsUpdate=true;
  const byId=new Map(),fit=new T.Vector2(1,1),unitFit=new T.Vector2(1,1);
  const sceneSize=new T.Vector2(manifest.width,manifest.height);
  const weights=new Set();
  for(const d of manifest.meshes)for(const r of [d.materialRepair,d.rgbMaterialRepair])if(r)weights.add(r.weightTexture);
  for(const [key,img] of images){
    const texture=new T.Texture(img);texture.flipY=false;texture.colorSpace=T.NoColorSpace;
    texture.premultiplyAlpha=true;texture.generateMipmaps=!weights.has(key);
    texture.minFilter=texture.generateMipmaps?T.LinearMipmapLinearFilter:T.LinearFilter;
    texture.needsUpdate=true;textures.set(key,texture);
  }
  function texture(key){if(!key)return white;const result=textures.get(key);if(!result)throw Error('角色贴图缺失 '+key);return result;}
  function material(d,op){
    const seam=d.seamUnderlay,skin=d.fixedSkinPatch,hair=d.fixedHairPatch,hole=d.alphaOpening;
    const repair=d.materialRepair,rgb=d.rgbMaterialRepair,points=new Float32Array(96);
    if(hole)points.set(hole.polygon.flat());
    const values={sceneSize,cameraScale:manifest.camera.scale,cameraOffset:manifest.camera.offset,containFit:fit,
      rgbaTexture:texture(d.texture),clipTexture:white,repairRgbaTexture:texture(repair?.rgbaTexture),
      repairWeightTexture:texture(repair?.weightTexture),rgbRepairTexture:texture(rgb?.rgbTexture),rgbRepairWeightTexture:texture(rgb?.weightTexture),
      seamUnderlayTexture:texture(seam?.texture),fixedHairTexture:texture(hair?.texture),
      seamUnderlayEnabled:+!!seam,seamBodyCrop:seam?.bodyCrop||full,seamUnderlayCrop:seam?.underlayCrop||full,seamFadeY:seam?.fadeY||[0,1],
      fixedSkinPatchEnabled:+!!skin,fixedSkinPatchSize:skin?.size||[1,1],fixedSkinPatchRect:skin?.rect||full,fixedSkinPatchSample:skin?.sample||[0,0],
      fixedHairEnabled:+!!hair,fixedHairCrop:hair?.crop||full,repairEnabled:+!!repair,rgbRepairEnabled:+!!rgb,
      repairUVRect:repair?.uvRect||full,rgbRepairUVRect:rgb?.uvRect||full,openingCount:hole?.polygon.length||0,
      openingKeepInside:+!!hole?.keepInside,openingPoints:points,openingArtworkSize:hole?.artworkSize||[1,1],openingEdge:[hole?.feather||0,hole?.outline||0],
      hemOverlayEnabled:0,hemOverlayCrop:full,opacity:1,operation:op,masked:0,invertedMask:+!!d.invertedMask};
    return new T.RawShaderMaterial({vertexShader,fragmentShader,glslVersion:T.GLSL3,
      uniforms:Object.fromEntries(Object.entries(values).map(([key,value])=>[key,uniform(value)])),
      depthTest:false,depthWrite:false,transparent:true,side:T.DoubleSide,forceSinglePass:true,blending:T.CustomBlending,
      blendSrc:op===2?T.DstColorFactor:T.OneFactor,blendDst:op===2?T.ZeroFactor:T.OneMinusSrcAlphaFactor,
      blendSrcAlpha:op===2?T.ZeroFactor:T.OneFactor,blendDstAlpha:op===2?T.OneFactor:T.OneMinusSrcAlphaFactor});
  }
  function makeMesh(d,geometry,op){
    const mesh=new T.Mesh(geometry,material(d,op));mesh.frustumCulled=false;mesh.name=d.id;return mesh;
  }
  function dispose(){
    for(const {mesh} of meshes){mesh.geometry.dispose();mesh.material.dispose();}
    for(const m of extra)m.material.dispose();
    for(const mask of masks.values())mask.target.dispose();
    for(const tex of textures.values())tex.dispose();white.dispose();scene.clear();
  }
  try {
    for(const [index,d] of manifest.meshes.entries()){
      const g=new T.BufferGeometry();
      // Positions are authored vec2. Sorting uses explicit layer order, so the
      // generic vec3 bounding-sphere computation has no role for these meshes.
      g.boundingSphere=new T.Sphere(new T.Vector3(),1);
      g.setAttribute('position',new T.BufferAttribute(new Float32Array(d.vertices.length),2).setUsage(T.DynamicDrawUsage));
      g.setAttribute('texcoord',new T.Float32BufferAttribute(d.uvs,2));g.setIndex(d.indices);
      const mesh=makeMesh(d,g,d.blend==='add'?1:d.blend==='multiply'?2:0);
      const record={mesh,d,index};scene.add(mesh);meshes.push(record);byId.set(d.id,record);
    }
    for(const record of meshes){
      const {d,mesh}=record;
      const ids=[...new Set(d.masks||[])].sort();
      if(ids.length){
        const key=JSON.stringify(ids);
        if(!masks.has(key)){
          const maskScene=new T.Scene(),target=new T.WebGLRenderTarget(manifest.width,manifest.height,{depthBuffer:false,stencilBuffer:false});
          masks.set(key,{scene:maskScene,target});
          for(const [i,id] of ids.entries()){
            const parent=byId.get(id);if(!parent)throw Error('遮罩来源缺失 '+id);
            const mask=makeMesh(parent.d,parent.mesh.geometry,3);
            mask.material.uniforms.containFit.value=unitFit;mask.renderOrder=i;maskScene.add(mask);extra.push(mask);
          }
        }
        mesh.material.uniforms.masked.value=1;mesh.material.uniforms.clipTexture.value=masks.get(key).target.texture;
      }
      if(d.frontHemOverlay){
        const src=byId.get(d.frontHemOverlay.source);if(!src)throw Error('角色衣摆图层缺失');
        const hem=makeMesh(src.d,src.mesh.geometry,0);
        hem.material.uniforms.hemOverlayEnabled.value=1;hem.material.uniforms.hemOverlayCrop.value=d.frontHemOverlay.crop;
        scene.add(hem);extra.push(hem);record.hem={mesh:hem,sourceIndex:src.index};
      }
    }
  }catch(e){dispose();throw e;}
  const ordered=meshes.slice(),clearColor=new T.Color(),viewport=new T.Vector4(),scissor=new T.Vector4();
  const oldOrder=new Float32Array(meshes.length).fill(NaN);
  function draw(positions,alphas,orders,visible,width,height) {
    if(oldOrder.some((val,i)=>val!==orders[i])){
      ordered.sort((a,b)=>orders[a.index]-orders[b.index]||a.index-b.index);oldOrder.set(orders);
      ordered.forEach((r,i)=>{r.mesh.renderOrder=i*2;if(r.hem)r.hem.mesh.renderOrder=i*2+1;});
    }
    for(const {mesh,d,index,hem} of meshes){
      const pos=mesh.geometry.attributes.position;
      pos.array.set(positions.subarray(d.stateOffset,d.stateOffset+pos.array.length));pos.needsUpdate=true;
      mesh.visible=!d.maskOnly&&!!visible[index]&&alphas[index]>0;
      mesh.material.uniforms.opacity.value=alphas[index];
      if(hem){const i=hem.sourceIndex;hem.mesh.visible=mesh.visible&&!!visible[i]&&alphas[i]>0;hem.mesh.material.uniforms.opacity.value=alphas[i];}
    }
    const k=Math.min(width/manifest.width,height/manifest.height);
    fit.set(manifest.width*k/width,manifest.height*k/height);
    if(masks.size){
      const target=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),clipped=renderer.getScissorTest();
      renderer.getClearColor(clearColor);renderer.getViewport(viewport);renderer.getScissor(scissor);
      try{
        renderer.setClearColor(0,0);
        for(const mask of masks.values()){
          renderer.setRenderTarget(mask.target);renderer.clear();renderer.render(mask.scene,camera);
        }
      }finally{
        renderer.setRenderTarget(target);renderer.setClearColor(clearColor,alpha);
        // setRenderTarget restores that target's own physical viewport and
        // scissor. The default canvas can have a different size and density.
        if(!target){renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(clipped);}
      }
    }
    renderer.render(scene,camera);
  }
  return {draw,dispose};
}

