import data from './blue-ponytail-neck-planes.json' with {type:'json'};
import {createBluePonytailCollarAdapter} from './blue-ponytail-collar-adapter.js';
import {gunzipSync} from 'three/addons/libs/fflate.module.js';

function decode(text){
  let bytes=Uint8Array.from(atob(text),c=>c.charCodeAt(0));
  if(data.encoding==='float32-xor-gzip-base64'){
    bytes=gunzipSync(bytes);const bits=new Uint32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
    for(let i=data.floatStride;i<bits.length;i++)bits[i]^=bits[i-data.floatStride];
  }
  return new Float32Array(bytes.buffer,bytes.byteOffset,bytes.byteLength/4);
}
const clips=Object.fromEntries(Object.entries(data.clips).map(([name,clip])=>[name,{...clip,values:decode(clip.positions)}]));

// Reproduce the reference neck, collar and back clipping as one group in the
// body's coordinate frame, with one neutral scale throughout both motions.
// Only the blue costume is fitted to the collar seam;
// the reference meshes never receive independent vertex/root corrections.
// Original topology and alpha UVs are retained; colours use the blue artwork.
export function createBluePonytailNeckPlanesAdapter(model,{trimHead=true}={}){
  const core=model.getModel();
  if(core.drawables.count!==23||core.drawables.ids[5]!=='Head'||core.drawables.ids[8]!=='NeckMask')throw Error('Blue ponytail plane reconstruction identity changed');
  if(core.drawables.indexCounts[5]!==data.head.indexCount||!Array.from(core.parameters.ids).includes('ParamPoseTime'))throw Error('Blue ponytail source topology or pose timeline changed');
  const base=createBluePonytailCollarAdapter(model,{bindRoot:false}),hooks=[];
  try{
  const saved=(name,fallback)=>typeof model[name]==='function'?model[name].bind(model):fallback;
  const replace=(name,fn)=>{hooks.push([name,Object.hasOwn(model,name),model[name]]);model[name]=fn;};
  const positions=saved('getDrawableVertexPositions',i=>core.drawables.vertexPositions[i]);
  const uvs=saved('getDrawableVertexUvs',i=>core.drawables.vertexUvs[i]);
  const indices=saved('getDrawableVertexIndices',i=>core.drawables.indices[i]);
  const counts=saved('getDrawableVertexCount',i=>core.drawables.vertexCounts[i]);
  const indexCounts=saved('getDrawableVertexIndexCount',i=>core.drawables.indexCounts[i]);
  const visible=saved('getDrawableDynamicFlagIsVisible',()=>true),changed=saved('getDrawableDynamicFlagVertexPositionsDidChange',()=>true);
  const opacity=saved('getDrawableOpacity',i=>core.drawables.opacities[i]);
  const texture=saved('getDrawableTextureIndex',i=>core.drawables.textureIndices[i]);
  const orderSource=saved('getDrawableRenderOrders',()=>core.drawables.renderOrders);
  const masks=Array.from(core.drawables.masks,ids=>Int32Array.from(ids)),maskCounts=new Int32Array(30),orders=new Int32Array(30);
  maskCounts.set(core.drawables.maskCounts);
  const virtual=new Map(),planeBuffers=[];
  for(const plane of data.planes){
    const xy=new Float32Array(plane.vertices*2),tri=Uint16Array.from(plane.indices);planeBuffers.push(xy);
    virtual.set(plane.mask,{xy,uv:Float32Array.from(plane.maskUv),tri,texture:6,paint:false});
    if(plane.paint!==null){virtual.set(plane.paint,{xy,uv:Float32Array.from(plane.materialUv),tri,texture:plane.texture,paint:true});masks[plane.paint]=Int32Array.of(plane.mask);maskCounts[plane.paint]=1;}
    masks[plane.mask]=new Int32Array();
  }
  const faceSkin=data.head.skinLayer,skinPositions=new Float32Array(faceSkin.sourceVertices.length*2),skinUv=new Float32Array(skinPositions.length);
  faceSkin.sourceVertices.forEach((source,i)=>skinUv.set(core.drawables.vertexUvs[5].subarray(source*2,source*2+2),i*2));
  virtual.set(29,{xy:skinPositions,uv:skinUv,tri:Uint16Array.from(faceSkin.indices),texture:13,paint:true});masks[29]=new Int32Array();
  const nativeHeadIndices=indices(5),trim=new Set([...(trimHead?data.head.trimOffsets:[]),...faceSkin.triangleOffsets]);
  if(nativeHeadIndices.length!==data.head.indexCount)throw Error('Blue ponytail head segmentation changed');
  const headIndices=Uint16Array.from(Array.from(nativeHeadIndices).filter((_,i)=>!trim.has(i-i%3)));
  const torsoIndices=new Map();
  for(const entry of data.collarTrim||[]){
    const remove=new Set(entry.triangles.map(t=>t.join(','))),original=indices(entry.index),filtered=[];
    for(let i=0;i<original.length;i+=3){const triangle=Array.from(original.subarray(i,i+3));if(!remove.has(triangle.join(',')))filtered.push(...triangle);}
    torsoIndices.set(entry.index,Uint16Array.from(filtered));
  }
  const poseIndex=Array.from(core.parameters.ids).indexOf('ParamPoseTime');
  const headBuffers=new Map([5,6,7].map(i=>[i,new Float32Array(positions(i).length)]));
  const garmentBuffers=new Map(data.garment.targets.map(i=>[i,new Float32Array(positions(i).length)]));
  const soft=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
  const garmentWeights=new Map(data.garment.targets.map(index=>{const uv=core.drawables.vertexUvs[index],u=[],w=[];for(let i=0;i<uv.length;i+=2){const x=uv[i]*1159,y=(1-uv[i+1])*1358;u.push(Math.max(0,Math.min(1,(x-360)/340)));w.push((1-soft((y-145)/170))*soft((x-300)/60)*soft((760-x)/60));}return [index,{u,w}];}));
  const headUv=core.drawables.vertexUvs[5],hairUv=core.drawables.vertexUvs[6],key=(uv,i)=>`${Math.round(uv[i]*1159*2)}:${Math.round((1-uv[i+1])*1358*2)}`,shared=new Set();
  for(let i=0;i<headUv.length;i+=2)shared.add(key(headUv,i));
  let rootY=-Infinity;for(let i=0;i<hairUv.length;i+=2)if(shared.has(key(hairUv,i)))rootY=Math.max(rootY,(1-hairUv[i+1])*1358);
  if(!Number.isFinite(rootY))throw Error('Blue ponytail shared hair root cannot be identified');
  const hairWeights=Float32Array.from({length:hairUv.length/2},(_,i)=>{const t=Math.max(0,Math.min(1,((1-hairUv[i*2+1])*1358-rootY-4)/476));return 1-t*t*(3-2*t);});
  let detached=false,prepared=false,matrix=[1,0,0,0];
  const white={r:1,g:1,b:1,a:1},clear={r:0,g:0,b:0,a:0};
  function updateOrder(){
    const original=orderSource(),neckOrder=original[22],entries=Array.from(original,(key,index)=>({key,index}));
    entries.push({key:-3,index:23},{key:neckOrder-.1,index:24},{key:-2,index:25},{key:neckOrder+.1,index:26},{key:-1,index:27},{key:original[5]-.1,index:28},{key:original[5]-.2,index:29});
    entries.sort((a,b)=>a.key-b.key);entries.forEach(({index},i)=>orders[index]=i);
  }
  replace('getDrawableCount',()=>30);
  replace('getDrawableRenderOrders',()=>orders);
  replace('getDrawableMasks',()=>masks);
  replace('getDrawableMaskCounts',()=>maskCounts);
  replace('getDrawableVertexPositions',i=>virtual.get(i)?.xy??(prepared?(headBuffers.get(i)??garmentBuffers.get(i)??positions(i)):positions(i)));
  replace('getDrawableVertices',i=>model.getDrawableVertexPositions(i));
  replace('getDrawableVertexUvs',i=>virtual.get(i)?.uv??uvs(i));
  replace('getDrawableVertexIndices',i=>i===5?headIndices:virtual.get(i)?.tri??torsoIndices.get(i)??indices(i));
  replace('getDrawableVertexCount',i=>virtual.has(i)?virtual.get(i).xy.length/2:counts(i));
  replace('getDrawableVertexIndexCount',i=>i===5?headIndices.length:virtual.get(i)?.tri.length??torsoIndices.get(i)?.length??indexCounts(i));
  replace('getDrawableTextureIndex',i=>virtual.get(i)?.texture??texture(i));
  replace('getDrawableOpacity',i=>virtual.has(i)?1:opacity(i));
  replace('getDrawableDynamicFlagIsVisible',i=>virtual.has(i)?virtual.get(i).paint:visible(i));
  replace('getDrawableDynamicFlagVertexPositionsDidChange',i=>virtual.has(i)||(prepared&&(headBuffers.has(i)||garmentBuffers.has(i)))||changed(i));
  for(const name of ['getMultiplyColor','getDrawableMultiplyColor']){const old=saved(name,()=>white);replace(name,i=>virtual.has(i)?white:old(i));}
  for(const name of ['getScreenColor','getDrawableScreenColor']){const old=saved(name,()=>clear);replace(name,i=>virtual.has(i)?clear:old(i));}
  for(const name of ['getDrawableCulling','getDrawableInvertedMaskBit']){const old=saved(name,()=>false);replace(name,i=>virtual.has(i)?false:old(i));}
  const blend=saved('getDrawableBlendMode',()=>0);replace('getDrawableBlendMode',i=>virtual.has(i)?0:blend(i));
  updateOrder();
  return {
    begin(context){base.begin(context);},
    prepare(context){
      if(detached)throw Error('Blue ponytail neck planes are detached');base.prepare(context);
      const pose=core.parameters.values[poseIndex],touch=pose>=6,clip=clips[touch?'touch_head':'idle'];
      const time=Math.max(0,Math.min(clip.duration,touch?pose-6:pose)),frame=Math.min(clip.frameCount-2,Math.floor(time*data.fps));
      const nextTime=Math.min((frame+1)/data.fps,clip.duration),mix=(time-frame/data.fps)/(nextTime-frame/data.fps);
      matrix=Array.from({length:4},(_,i)=>{const a=clip.values[frame*data.floatStride+i],b=clip.values[(frame+1)*data.floatStride+i];return a+(b-a)*mix;});
      const [c,s,tx,ty]=matrix;
      for(const [index,out] of headBuffers){const native=positions(index);for(let i=0;i<out.length;i+=2){const x=native[i],y=native[i+1],w=index===6?hairWeights[i/2]:1;out[i]=x+(c*x-s*y+tx-x)*w;out[i+1]=y+(s*x+c*y+ty-y)*w;}}
      faceSkin.sourceVertices.forEach((source,i)=>{skinPositions[i*2]=headBuffers.get(5)[source*2];skinPositions[i*2+1]=headBuffers.get(5)[source*2+1];});
      let offset=4;
      for(const xy of planeBuffers){for(let i=0;i<xy.length;i++){const a=clip.values[frame*data.floatStride+offset+i],b=clip.values[(frame+1)*data.floatStride+offset+i];xy[i]=a+(b-a)*mix;}offset+=xy.length;}
      const deltas=Array.from({length:data.garment.controls.length*2},(_,i)=>{const a=clip.values[frame*data.floatStride+offset+i],b=clip.values[(frame+1)*data.floatStride+offset+i];return a+(b-a)*mix;});
      for(const [index,out] of garmentBuffers){const native=positions(index),{u,w}=garmentWeights.get(index),controls=data.garment.controls;for(let i=0;i<u.length;i++){let j=0;while(j<controls.length-2&&controls[j+1].u<u[i])j++;const t=Math.max(0,Math.min(1,(u[i]-controls[j].u)/(controls[j+1].u-controls[j].u)));for(let axis=0;axis<2;axis++)out[i*2+axis]=native[i*2+axis]+(deltas[j*2+axis]+(deltas[(j+1)*2+axis]-deltas[j*2+axis])*t)*w[i];}}
      prepared=true;updateOrder();
    },
    state:()=>({...base.state(),revision:data.revision,headMatrix:[...matrix],sourcePlanes:data.planes.map(d=>({id:d.id,vertices:d.vertices,triangles:d.indices.length/3})),removedHeadNeckTriangles:data.head.trimOffsets.length,separatedFaceTriangles:faceSkin.triangleOffsets.length}),
    detach(){if(detached)return;for(const [name,own,fn] of hooks.reverse()){if(own)model[name]=fn;else delete model[name];}base.detach();detached=true;},
  };
  }catch(error){
    for(const [name,own,fn] of hooks.reverse()){if(own)model[name]=fn;else delete model[name];}
    base.detach();throw error;
  }
}
