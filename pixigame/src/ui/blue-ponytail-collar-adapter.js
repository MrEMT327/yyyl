import bindings from './blue-ponytail-collar-bindings.json' with {type:'json'};

// BackMask and GarmentMask are clipping sources for Torso. Drawing their
// colour surfaces a second time exposes detached red skin and duplicated edges.
export function createBluePonytailCollarAdapter(model,{bindRoot=true}={}){
  const core=model.getModel(),mask=17,garmentMask=18,torso=4;
  if(core.drawables.ids[mask]!=='BackMask'||core.drawables.ids[garmentMask]!=='GarmentMask'||core.drawables.ids[torso]!=='Torso'||![mask,garmentMask].every(i=>Array.from(core.drawables.masks[torso]).includes(i)))throw Error('Blue ponytail collar clipping identity changed');
  if(core.drawables.vertexCounts[torso]!==bindings.torso.vertices||core.drawables.vertexCounts[8]!==36||core.drawables.vertexCounts[22]!==36)throw Error('Blue ponytail collar topology changed');
  const original=model.getDrawableDynamicFlagIsVisible;
  const own=Object.hasOwn(model,'getDrawableDynamicFlagIsVisible');
  const positions=model.getDrawableVertexPositions,changed=model.getDrawableDynamicFlagVertexPositionsDidChange;
  const positionsOwn=Object.hasOwn(model,'getDrawableVertexPositions'),changedOwn=Object.hasOwn(model,'getDrawableDynamicFlagVertexPositionsDidChange');
  const indices=model.getDrawableVertexIndices,indexCount=model.getDrawableVertexIndexCount;
  const indicesOwn=Object.hasOwn(model,'getDrawableVertexIndices'),indexCountOwn=Object.hasOwn(model,'getDrawableVertexIndexCount');
  const filtered=new Map();
  // Discard only atlas-verified skin slivers above the painted collar rim.
  // Mixed skin/cloth triangles remain in both the colour and clipping meshes.
  for(const trim of bindings.trim){
    const source=indices.call(model,trim.index);
    if(core.drawables.ids[trim.index]!==trim.id||source.length!==trim.indexCount||trim.removed.some(t=>t.indices.some((v,j)=>source[t.offset+j]!==v)))throw Error('Blue ponytail collar paint boundary changed');
    const removed=new Set(trim.removed.map(t=>t.offset));
    filtered.set(trim.index,Uint16Array.from(Array.from(source).filter((_,i)=>!removed.has(i-i%3))));
  }
  const neck=new Float32Array(core.drawables.vertexPositions[8].length);
  let prepared=false;
  let detached=false;
  model.getDrawableDynamicFlagIsVisible=function(index){return index!==mask&&index!==garmentMask&&original.call(this,index);};
  model.getDrawableVertexPositions=function(index){return bindRoot&&prepared&&(index===8||index===22)?neck:positions.call(this,index);};
  model.getDrawableDynamicFlagVertexPositionsDidChange=function(index){return bindRoot&&prepared&&(index===8||index===22)||changed.call(this,index);};
  model.getDrawableVertexIndices=function(index){return filtered.get(index)??indices.call(this,index);};
  model.getDrawableVertexIndexCount=function(index){return filtered.get(index)?.length??indexCount.call(this,index);};
  return {
    begin(){},
    prepare(){
      if(detached)throw Error('Blue ponytail collar adapter is detached');
      if(!bindRoot)return;
      const p=positions.call(model,torso),native=positions.call(model,8);
      const sample=c=>[0,1].map(axis=>c.indices.reduce((s,j,k)=>s+p[j*2+axis]*c.weights[k],0));
      const [left,right,bottom]=bindings.controls.map(sample);
      const dx=[right[0]-left[0],right[1]-left[1]],dy=[bottom[0]-(left[0]+right[0])/2,bottom[1]-(left[1]+right[1])/2];
      // Keep the lower neck in the collar's local frame. Reference vertices
      // supporting the earlobe have zero weight and preserve the V3 head joint.
      for(let i=0;i<bindings.vertices.length;i++){
        const {u,v,weight}=bindings.vertices[i];
        for(let axis=0;axis<2;axis++){const k=i*2+axis;neck[k]=native[k]+(left[axis]+dx[axis]*u+dy[axis]*v-native[k])*weight;}
      }
      prepared=true;
    },
    state:()=>({revision:'collar-root-v4',colourSuppressedMasks:[mask,garmentMask],clipConsumers:[torso],boundRootVertices:bindRoot?bindings.vertices.filter(v=>v.weight>0).length:0,removedSkinTriangles:bindings.trim.reduce((n,t)=>n+t.removed.length,0)}),
    detach(){if(detached)return;if(own)model.getDrawableDynamicFlagIsVisible=original;else delete model.getDrawableDynamicFlagIsVisible;if(positionsOwn)model.getDrawableVertexPositions=positions;else delete model.getDrawableVertexPositions;if(changedOwn)model.getDrawableDynamicFlagVertexPositionsDidChange=changed;else delete model.getDrawableDynamicFlagVertexPositionsDidChange;if(indicesOwn)model.getDrawableVertexIndices=indices;else delete model.getDrawableVertexIndices;if(indexCountOwn)model.getDrawableVertexIndexCount=indexCount;else delete model.getDrawableVertexIndexCount;detached=true;},
  };
}
