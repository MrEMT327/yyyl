import * as T from 'three';
import {cubismBatchVertex,cubismBatchFragment} from '../../ui/cubism-batcher.js';
import {createCubismMasks} from './cubism-masks.js';
import {mountPortraitSurface} from './h5-portrait.js';

const attributes=[['a_position',4],['a_uv',2],['a_base',4],['a_multiply',3],['a_screen',3],['a_clip',4]];
const stride=20;

function makeMaterial(texture,atlas,mask,multiply){
  return new T.RawShaderMaterial({
    vertexShader:cubismBatchVertex,fragmentShader:cubismBatchFragment,
    uniforms:{u_texture:{value:texture},u_mask:{value:mask?texture:atlas||texture},u_maskPass:{value:mask?1:0}},
    transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
    blending:T.CustomBlending,blendSrc:mask?T.ZeroFactor:multiply?T.DstColorFactor:T.OneFactor,
    blendDst:mask?T.OneMinusSrcColorFactor:T.OneMinusSrcAlphaFactor,
    blendSrcAlpha:mask||multiply?T.ZeroFactor:T.OneFactor,blendDstAlpha:multiply?T.OneFactor:T.OneMinusSrcAlphaFactor
  });
}

// Adjacent meshes with matching atlas and blend state form one draw group. Position,
// opacity, colour and mask coordinates stream into reused buffers in authored order.
function createMeshBatch(model,records,materials,maskPass,atlasCount){
  let vertexCapacity=0,indexCapacity=0;
  for(const {index} of records){
    vertexCapacity+=model.getDrawableVertexCount(index);indexCapacity+=model.getDrawableVertexIndexCount(index);
  }
  const geometry=new T.BufferGeometry(),data=new T.InterleavedBuffer(new Float32Array(vertexCapacity*stride),stride).setUsage(T.DynamicDrawUsage);
  const indexBuffer=new T.BufferAttribute(vertexCapacity>65535?new Uint32Array(indexCapacity):new Uint16Array(indexCapacity),1).setUsage(T.DynamicDrawUsage);
  let offset=0;
  for(const [name,size] of attributes){geometry.setAttribute(name,new T.InterleavedBufferAttribute(data,size,offset));offset+=size;}
  geometry.setIndex(indexBuffer);geometry.boundingSphere=new T.Sphere(new T.Vector3(),1);
  const mesh=new T.Mesh(geometry,materials);mesh.frustumCulled=false;
  const scene=new T.Scene();scene.add(mesh);
  function update(ordered,matrix){
    let vertices=0,indices=0,last=null;
    geometry.clearGroups();
    for(const {index,clip} of ordered){
      if(maskPass){
        if(!clip.active||!model.getDrawableDynamicFlagVertexPositionsDidChange(index))continue;
      }else if(!model.getDrawableDynamicFlagIsVisible(index))continue;
      const p=model.getDrawableVertices(index),uv=model.getDrawableVertexUvs(index),elements=model.getDrawableVertexIndices(index);
      const tex=model.getDrawableTextureIndex(index),blend=maskPass?0:model.getDrawableBlendMode(index),alpha=model.getDrawableOpacity(index);
      if(!elements.length||tex<0||tex>=atlasCount||(!maskPass&&alpha<=0))continue;
      const materialIndex=tex+(blend===2?atlasCount:0);
      if(!last||last.materialIndex!==materialIndex){
        geometry.addGroup(indices,0,materialIndex);last=geometry.groups[geometry.groups.length-1];
      }
      const correction=model.getDrawableColorTransform?.(index)?.multiply;
      const mul=model.getMultiplyColor(index),light=model.getScreenColor(index);
      const channel=clip?.active?(clip.context._layoutChannelIndex+1)*(!maskPass&&model.getDrawableInvertedMaskBit(index)?-1:1):0;
      const face=(model.getDrawableCulling(index)?1:0)+(blend===1?2:0);
      const rect=clip?.context._layoutBounds;
      const baseR=maskPass?rect.x*2-1:alpha,baseG=maskPass?rect.y*2-1:alpha;
      const baseB=maskPass?(rect.x+rect.width)*2-1:alpha,baseA=maskPass?(rect.y+rect.height)*2-1:alpha;
      const packed=data.array;
      let out=vertices*stride;
      for(let j=0;j<p.length/2;j++){
        const x=p[2*j],y=p[2*j+1],u=clip?.active?x*clip.sx+clip.tx:0,v=clip?.active?y*clip.sy+clip.ty:0;
        packed[out++]=maskPass?2*u-1:matrix[0]*x+matrix[4]*y+matrix[12];
        packed[out++]=maskPass?2*v-1:matrix[1]*x+matrix[5]*y+matrix[13];
        packed[out++]=maskPass?0:matrix[2]*x+matrix[6]*y+matrix[14];
        packed[out++]=maskPass?1:matrix[3]*x+matrix[7]*y+matrix[15];
        packed[out++]=uv[2*j];packed[out++]=uv[2*j+1];
        packed[out++]=baseR;packed[out++]=baseG;packed[out++]=baseB;packed[out++]=baseA;
        packed[out++]=mul.r*(correction?correction[3*j]:1);
        packed[out++]=mul.g*(correction?correction[3*j+1]:1);
        packed[out++]=mul.b*(correction?correction[3*j+2]:1);
        packed[out++]=light.r;packed[out++]=light.g;packed[out++]=light.b;
        packed[out++]=u;packed[out++]=v;packed[out++]=channel;packed[out++]=face;
      }
      for(let j=0;j<elements.length;j++)indexBuffer.array[indices++]=vertices+elements[j];
      last.count+=elements.length;vertices+=p.length/2;
    }
    geometry.setDrawRange(0,indices);mesh.visible=indices>0;
    if(indices){
      data.clearUpdateRanges();data.addUpdateRange(0,vertices*stride);data.needsUpdate=true;
      indexBuffer.clearUpdateRanges();indexBuffer.addUpdateRange(0,indices);indexBuffer.needsUpdate=true;
    }
    return indices>0;
  }
  return {scene,update,dispose(){geometry.dispose();}};
}

function createModelSurface(renderer,model,images,mipmaps){
  const textures=images.map(image=>{
    const t=new T.Texture(image);t.flipY=false;t.premultiplyAlpha=true;t.colorSpace=T.NoColorSpace;
    t.generateMipmaps=mipmaps;t.minFilter=mipmaps?T.LinearMipmapLinearFilter:T.LinearFilter;t.magFilter=T.LinearFilter;t.needsUpdate=true;
    return t;
  });
  const camera=new T.Camera(),masks=createCubismMasks(model);
  const target=masks?new T.WebGLRenderTarget(masks.size,masks.size,{depthBuffer:false,stencilBuffer:false}):null;
  const materials=[false,true].flatMap(multiply=>textures.map(t=>makeMaterial(t,target?.texture,false,multiply)));
  const maskMaterials=masks?textures.map(t=>makeMaterial(t,null,true,false)):[];
  const records=Array.from({length:model.getDrawableCount()},(_,index)=>({index,clip:masks?.byDrawable[index]})),ordered=records.slice();
  const actors=createMeshBatch(model,records,materials,false,textures.length);
  const stencil=masks&&createMeshBatch(model,masks.sources,maskMaterials,true,textures.length);
  const clear=new T.Color(),viewport=new T.Vector4(),scissor=new T.Vector4();
  return {
    draw(matrix){
      if(masks){
        masks.update();
        if(stencil.update(masks.sources,matrix)){
          const destination=renderer.getRenderTarget(),alpha=renderer.getClearAlpha(),clipped=renderer.getScissorTest();
          renderer.getClearColor(clear);renderer.getViewport(viewport);renderer.getScissor(scissor);
          try{
            renderer.setRenderTarget(target);renderer.setClearColor(0xffffff,1);renderer.clear();renderer.render(stencil.scene,camera);
          }finally{
            renderer.setRenderTarget(destination);renderer.setClearColor(clear,alpha);
            if(!destination){renderer.setViewport(viewport);renderer.setScissor(scissor);renderer.setScissorTest(clipped);}
          }
        }
      }
      const order=model.getDrawableRenderOrders();
      for(const r of records)ordered[order[r.index]]=r;
      if(actors.update(ordered,matrix))renderer.render(actors.scene,camera);
    },
    dispose(){
      actors.dispose();stencil?.dispose();target?.dispose();masks?.dispose();
      for(const t of textures)t.dispose();
      for(const m of [...materials,...maskMaterials])m.dispose();
    }
  };
}

export function mountCubismPortrait(canvas,model,images,mipmaps,monitor,screen){
  return mountPortraitSurface(canvas,monitor,screen,renderer=>createModelSurface(renderer,model,images,mipmaps));
}

