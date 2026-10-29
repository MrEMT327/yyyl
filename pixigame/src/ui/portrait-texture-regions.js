// Route selected UV islands to a higher-detail atlas without touching Core memory.
export function createPortraitTextureRegions(model, regions) {
  const getTexture = model.getDrawableTextureIndex;
  const getUvs = model.getDrawableVertexUvs;
  const routes = new Map();
  for (const region of regions) {
    const {index, id, texture, sourceSize, targetSize, source, target} = region;
    if (!Number.isInteger(index) || index < 0 || index >= model.getDrawableCount()
      || model.getModel().drawables.ids[index] !== id || routes.has(index)
      || !Number.isInteger(texture) || texture < 0
      || ![sourceSize,targetSize].every(n=>Number.isFinite(n)&&n>0)
      || ![source,target].every(rect=>Array.isArray(rect)&&rect.length===4&&rect.every(Number.isFinite)&&rect[0]>=0&&rect[1]>=0&&rect[2]>0&&rect[3]>0)
      || source[0]+source[2]>sourceSize || source[1]+source[3]>sourceSize
      || target[0]+target[2]>targetSize || target[1]+target[3]>targetSize) {
      throw new Error('Invalid portrait texture region');
    }
    const uv = new Float32Array(getUvs.call(model,index));
    for (let i=0;i<uv.length;i+=2) {
      uv[i]=(target[0]+(uv[i]*sourceSize-source[0])*target[2]/source[2])/targetSize;
      uv[i+1]=1-(target[1]+((1-uv[i+1])*sourceSize-source[1])*target[3]/source[3])/targetSize;
    }
    routes.set(index,{texture,uv});
  }
  model.getDrawableTextureIndex=function(index){return routes.get(index)?.texture ?? getTexture.call(this,index);};
  model.getDrawableVertexUvs=function(index){return routes.get(index)?.uv ?? getUvs.call(this,index);};
  return {detach(){model.getDrawableTextureIndex=getTexture;model.getDrawableVertexUvs=getUvs;routes.clear();}};
}
