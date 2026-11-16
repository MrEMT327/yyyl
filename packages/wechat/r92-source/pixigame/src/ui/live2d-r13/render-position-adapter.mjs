/* Consumer-only render-position accessor adapter. No Cubism/Core source changes.
 * Original Core output buffers are read and copied; never written.
 * prepare() must run after Core model.update() and before renderer.drawModel().
 * The official color shader, mask shader and clipping-bbox calculator all use
 * model.getDrawableVertices -> getDrawableVertexPositions, so one cache is shared.
 */
export function createRenderPositionAdapter(model, {enabled=false, targets=[], transform, label='experimental-local-adapter'}={}) {
  const count=model.getDrawableCount(), core=model.getModel();
  const targetSet=new Set(targets);
  if(targetSet.size!==targets.length || targets.some(i=>!Number.isInteger(i)||i<0||i>=count)) throw Error('Invalid target indices');
  if(enabled && typeof transform!=='function') throw Error('Enabled adapter needs explicit transform');
  const getOriginal=model.getDrawableVertexPositions;
  const getOriginalFlag=model.getDrawableDynamicFlagVertexPositionsDidChange;
  const forcedMaskRefresh=new Set(targets);
  for(const i of targets)for(const m of (core.drawables.masks[i]||[]))forcedMaskRefresh.add(m);
  let cache=new Map(), last={enabled, label, prepared:false}, detached=false;
  if(enabled){
    model.getDrawableVertexPositions=function(i){return cache.get(i)||getOriginal.call(this,i);};
    model.getDrawableDynamicFlagVertexPositionsDidChange=function(i){return cache.has(i)||forcedMaskRefresh.has(i)||getOriginalFlag.call(this,i);};
  }
  const twiceArea=(v,a,b,c)=>(v[b*2]-v[a*2])*(v[c*2+1]-v[a*2+1])-(v[b*2+1]-v[a*2+1])*(v[c*2]-v[a*2]);
  const equalBits=(a,b)=>{const x=new Uint32Array(a.buffer,a.byteOffset,a.length),y=new Uint32Array(b.buffer,b.byteOffset,b.length);return x.every((v,i)=>v===y[i]);};
  return {
    prepare(context={}) {
      if(detached)throw Error('Adapter already detached');
      if(!enabled)return last;
      // Lazy source snapshots isolate transforms from the original Core memory.
      const originals=new Map(), source=i=>{if(!originals.has(i))originals.set(i,getOriginal.call(model,i).slice());return originals.get(i);};
      for(const i of targets)source(i);
      const next=new Map(), rows=[];
      for(const i of targets){
        const input=source(i), output=transform(i,input.slice(),{...context,sourcePositions:source});
        if(!(output instanceof Float32Array)||output.length!==input.length)throw Error('Invalid adapted positions '+i);
        let changed=0,maxDelta=0,minRatio=Infinity,sourceDegenerate=0;
        for(let v=0;v<output.length;v+=2){
          if(!Number.isFinite(output[v])||!Number.isFinite(output[v+1]))throw Error('Nonfinite adapted vertex '+i);
          const dx=output[v]-input[v],dy=output[v+1]-input[v+1];
          if(dx||dy)changed++;maxDelta=Math.max(maxDelta,Math.hypot(dx,dy));
        }
        const indices=core.drawables.indices[i];
        for(let t=0;t<indices.length;t+=3){const a=indices[t],b=indices[t+1],c=indices[t+2],before=twiceArea(input,a,b,c),after=twiceArea(output,a,b,c);if(Math.abs(before)<=1e-10){sourceDegenerate++;continue;}const ratio=after/before;if(!(ratio>0))throw Error('Adapted triangle reversal/collapse '+i+':'+t/3);minRatio=Math.min(minRatio,ratio);}
        next.set(i,output);rows.push({index:i,id:core.drawables.ids[i],vertices:input.length/2,changedVertices:changed,maxDeltaWorld:maxDelta,minSignedAreaRatio:Number.isFinite(minRatio)?minRatio:null,sourceDegenerateTriangles:sourceDegenerate});
      }
      for(const [i,before]of originals)if(!equalBits(before,getOriginal.call(model,i)))throw Error('Core source buffer mutated '+i);
      cache=next;last={enabled:true,label,prepared:true,sourceBuffersUnchanged:true,targetIndices:[...targets],forcedMaskRefreshIndices:[...forcedMaskRefresh].sort((a,b)=>a-b),targets:rows};return last;
    },
    sourcePositions(i){return getOriginal.call(model,i);},
    renderedPositions(i){return cache.get(i)||getOriginal.call(model,i);},
    summary(){return last;},
    detach(){if(enabled){model.getDrawableVertexPositions=getOriginal;model.getDrawableDynamicFlagVertexPositionsDidChange=getOriginalFlag;}cache.clear();detached=true;}
  };
}
