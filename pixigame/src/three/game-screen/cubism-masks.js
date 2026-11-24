import {CubismClippingManager} from '../../vendor/cubism/src/rendering/cubismclippingmanager';
import {CubismClippingContext} from '../../vendor/cubism/src/rendering/cubismrenderer';

// Reuse the model's original mask membership, drawable bounds, atlas cell and RGBA channel.
// The Three renderer owns the atlas and every draw into it.
class MaskContext extends CubismClippingContext{
  constructor(layout,indices,count){super(indices,count);this.layout=layout;}
  getClippingManager(){return this.layout;}
}

export function createCubismMasks(model){
  if(!model.isUsingMasking())return null;
  const layout=new CubismClippingManager(MaskContext);
  layout.initialize(model,1);
  const byDrawable=Array.from({length:model.getDrawableCount()},(_,index)=>layout.getClippingContextListForDraw().at(index));
  const contexts=new Map();
  for(const context of byDrawable){
    if(context&&!contexts.has(context))contexts.set(context,{context,sx:0,sy:0,tx:0,ty:0,active:false});
  }
  const sources=[];
  for(const clip of contexts.values()){
    const c=clip.context;
    for(let i=0;i<c._clippingIdCount;i++)sources.push({index:c._clippingIdList[i],clip});
  }
  return {
    byDrawable:byDrawable.map(c=>contexts.get(c)||null),sources,size:layout.getClippingMaskBufferSize(),
    update(){
      let count=0;
      for(const {context} of contexts.values()){
        layout.calcClippedDrawTotalBounds(model,context);
        if(context._isUsing)count++;
      }
      if(count)layout.setupLayoutBounds(count);
      for(const clip of contexts.values()){
        const c=clip.context,b=c._allClippedDrawRect,r=c._layoutBounds;
        clip.active=Boolean(c._isUsing&&b.width>0&&b.height>0);
        if(!clip.active)continue;
        // The SDK adds a five percent margin on each side of the model-space bounds.
        clip.sx=r.width/(b.width*1.1);clip.sy=r.height/(b.height*1.1);
        clip.tx=r.x-(b.x-b.width*.05)*clip.sx;clip.ty=r.y-(b.y-b.height*.05)*clip.sy;
      }
    },dispose(){layout.release();}
  };
}

