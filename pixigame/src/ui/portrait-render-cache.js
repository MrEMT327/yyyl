// Production counterpart of the source's diagnostic adapter. The same fields
// transform copied vertices; cache buffers survive frame and viewport updates.
export function createPortraitRenderCache(model,{targets,transform}) {
  const original=model.getDrawableVertexPositions;
  const originalFlag=model.getDrawableDynamicFlagVertexPositionsDidChange;
  const core=model.getModel();
  if(new Set(targets).size!==targets.length || targets.some(i=>!Number.isInteger(i)||i<0||i>=model.getDrawableCount()))throw new Error('Invalid portrait targets');
  const refreshMasks=new Set(targets);
  for(const i of targets)for(const mask of core.drawables.masks[i]||[])refreshMasks.add(mask);
  const buffers=new Map(targets.map(i=>[i,new Float32Array(original.call(model,i).length)]));
  const context={sourcePositions:i=>original.call(model,i)};
  let prepared=false,detached=false;
  model.getDrawableVertexPositions=function(i){return prepared&&buffers.has(i)?buffers.get(i):original.call(this,i);};
  model.getDrawableDynamicFlagVertexPositionsDidChange=function(i){return (prepared&&refreshMasks.has(i))||originalFlag.call(this,i);};
  return {
    prepare(){
      if(detached)throw new Error('Portrait cache is detached');
      for(const i of targets){
        const buffer=buffers.get(i);buffer.set(original.call(model,i));
        const result=transform(i,buffer,context);
        if(!(result instanceof Float32Array)||result.length!==buffer.length)throw new Error('Invalid portrait geometry');
        for(let j=0;j<result.length;j++)if(!Number.isFinite(result[j]))throw new Error('Nonfinite portrait geometry');
        if(result!==buffer)buffer.set(result);
      }
      prepared=true;
    },
    detach(){if(detached)return;model.getDrawableVertexPositions=original;model.getDrawableDynamicFlagVertexPositionsDidChange=originalFlag;buffers.clear();detached=true;},
  };
}
