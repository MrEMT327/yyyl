import data from './blue-ponytail-eye-lids.json' with {type:'json'};
import {createBluePonytailNeckPlanesAdapter} from './blue-ponytail-neck-planes-adapter.js';

// Keep the approved open eye/pupil pixels unchanged. Independent eyelid
// surfaces cover them along the original ArtMesh43/ArtMesh108 trajectories.
export function createBluePonytailEyeLidAdapter(model){
  const core=model.getModel(),eyeIndex=Array.from(core.parameters.ids).indexOf(data.eyeParameter);
  if(eyeIndex<0)throw Error('Blue ponytail eye parameter changed');
  const base=createBluePonytailNeckPlanesAdapter(model),hooks=[],save=name=>model[name].bind(model),replace=(name,fn)=>{hooks.push([name,Object.hasOwn(model,name),model[name]]);model[name]=fn;};
  const position=save('getDrawableVertexPositions'),uv=save('getDrawableVertexUvs'),indices=save('getDrawableVertexIndices'),vertexCount=save('getDrawableVertexCount'),indexCount=save('getDrawableVertexIndexCount'),texture=save('getDrawableTextureIndex'),visible=save('getDrawableDynamicFlagIsVisible'),changed=save('getDrawableDynamicFlagVertexPositionsDidChange'),opacity=save('getDrawableOpacity'),baseOrders=save('getDrawableRenderOrders');
  const masks=Array.from(model.getDrawableMasks(),m=>m||new Int32Array()),counts=Array.from(model.getDrawableMaskCounts()),virtual=new Map();
  let next=model.getDrawableCount(),opening=1,detached=false;const feathers=[];
  for(const eye of data.eyes)for(const part of eye.parts){
    const xy=new Float32Array(part.uv.length),index=next++;
    const solid=part.alphaGroups?.find(group=>group.alpha===1),record={...part,xy,uv:Float32Array.from(part.maskUv||part.uv),tri:Uint16Array.from(solid?.indices||part.indices),texture:part.role==='lash'?6:13,rank:part.role==='lash'?3:part.role==='upper-cover'?2:1,coverAlpha:1};virtual.set(index,record);
    for(const group of part.alphaGroups||[])if(group.alpha<1)feathers.push({...record,phases:null,tri:Uint16Array.from(group.indices),coverAlpha:group.alpha});
    // The original Head alpha is also the face/hair silhouette. This prevents
    // the eyelid skin from extending beyond the turned face at the far eye.
    masks[index]=Int32Array.of(5);counts[index]=1;
  }
  for(const feather of feathers){const index=next++;virtual.set(index,feather);masks[index]=Int32Array.of(5);counts[index]=1;}
  const hairIds=[],hairMap=new Map(),hairIndices=[];
  for(const triangle of data.hairTriangles)for(const source of triangle){if(!hairMap.has(source)){hairMap.set(source,hairIds.length);hairIds.push(source);}hairIndices.push(hairMap.get(source));}
  const hairIndex=next++,headUv=core.drawables.vertexUvs[5],hairUv=new Float32Array(hairIds.length*2);
  hairIds.forEach((source,i)=>hairUv.set(headUv.subarray(source*2,source*2+2),i*2));
  virtual.set(hairIndex,{role:'hair',xy:new Float32Array(hairUv.length),uv:hairUv,tri:Uint16Array.from(hairIndices),rank:4});masks[hairIndex]=new Int32Array();counts[hairIndex]=0;
  const maskCounts=Int32Array.from(counts),orders=new Int32Array(next);
  function updateOrder(){const original=baseOrders(),entries=Array.from(original,(key,index)=>({index,key}));for(const[index,p]of virtual)entries.push({index,key:original[5]+p.rank*.01});entries.sort((a,b)=>a.key-b.key);entries.forEach(({index},i)=>orders[index]=i);}
  replace('getDrawableCount',()=>next);replace('getDrawableRenderOrders',()=>orders);replace('getDrawableMasks',()=>masks);replace('getDrawableMaskCounts',()=>maskCounts);
  replace('getDrawableVertexPositions',i=>virtual.get(i)?.xy??position(i));replace('getDrawableVertices',i=>model.getDrawableVertexPositions(i));
  replace('getDrawableVertexUvs',i=>virtual.get(i)?.uv??uv(i));replace('getDrawableVertexIndices',i=>virtual.get(i)?.tri??indices(i));
  replace('getDrawableVertexCount',i=>virtual.has(i)?virtual.get(i).xy.length/2:vertexCount(i));replace('getDrawableVertexIndexCount',i=>virtual.get(i)?.tri.length??indexCount(i));
  replace('getDrawableTextureIndex',i=>virtual.has(i)?virtual.get(i).texture??13:texture(i));
  replace('getDrawableOpacity',i=>virtual.has(i)?Math.min(1,(1-opening)/.15)*(virtual.get(i).coverAlpha??1):opacity(i));
  replace('getDrawableDynamicFlagIsVisible',i=>virtual.has(i)?true:visible(i));replace('getDrawableDynamicFlagVertexPositionsDidChange',i=>virtual.has(i)||i===5||changed(i));
  for(const name of['getMultiplyColor','getDrawableMultiplyColor','getScreenColor','getDrawableScreenColor']){
    const old=save(name),screen=name.includes('Screen'),color=screen?{r:0,g:0,b:0,a:0}:{r:1,g:1,b:1,a:1},pigment=data.lashColour;
    // Zero the reference RGB and fill its alpha with a sampled blue-art colour.
    // Keeping alpha in the colour texture leaves the mask slot for Head.
    const lash=screen?{r:pigment[0],g:pigment[1],b:pigment[2],a:0}:{r:0,g:0,b:0,a:1};
    replace(name,i=>virtual.has(i)?virtual.get(i).role==='lash'?lash:color:old(i));
  }
  for(const name of['getDrawableCulling','getDrawableInvertedMaskBit','getDrawableBlendMode']){const old=save(name);replace(name,i=>virtual.has(i)?(name==='getDrawableBlendMode'?0:false):old(i));}
  updateOrder();
  return {
    begin(context){base.begin(context);},
    prepare(context){
      opening=Math.max(0,Math.min(1,core.parameters.values[eyeIndex]));
      if(opening!==1){
        const flags=core.drawables.dynamicFlags.slice();
        core.parameters.values[eyeIndex]=1;core.update();core.parameters.values[eyeIndex]=opening;
        // The extra eye-neutral evaluation must not erase this frame's body
        // and clipping-mask dirty flags.
        for(let i=0;i<flags.length;i++)core.drawables.dynamicFlags[i]|=flags[i];
      }
      base.prepare(context);const head=position(5),frame=Math.min(9,Math.floor(opening/data.step)),mix=(opening-frame*data.step)/data.step;
      for(const[index,part]of virtual){if(index===hairIndex){hairIds.forEach((source,i)=>{part.xy[i*2]=head[source*2];part.xy[i*2+1]=head[source*2+1];});continue;}
        if(!part.phases)continue;const a=part.phases[frame],b=part.phases[frame+1];for(let i=0;i<a.length;i++)for(let axis=0;axis<2;axis++){const sample=bind=>bind.indices.reduce((n,j,k)=>n+head[j*2+axis]*bind.weights[k],0),x=sample(a[i]),y=sample(b[i]);part.xy[i*2+axis]=x+(y-x)*mix;}
      }
      updateOrder();
    },
    state:()=>({...base.state(),eyeRevision:data.revision,eyeOpening:opening}),
    detach(){if(detached)return;for(const[name,own,fn]of hooks.reverse()){if(own)model[name]=fn;else delete model[name];}base.detach();detached=true;},
  };
}
