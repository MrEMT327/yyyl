// Target RGBA layers and target grids are original project art. Compiled
// hemin_3 remains the motion/physics driver; this does not create a new moc3.
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
const smooth=v=>{v=clamp(v);return v*v*(3-2*v);};
const WHITE={r:1,g:1,b:1,a:1},BLACK={r:0,g:0,b:0,a:0};

export function createPurpleDoctorModelAdapter(model, payload) {
  const core=model.getModel(),native=core.drawables;
  if(native.count!==payload.sourceDrawableCount)throw Error('Purple doctor source drawable count changed');
  const descriptors=new Map(Object.entries(payload.drivers).map(([key,row])=>{
    const index=Number(key);
    if(native.ids[index]!==row.id)throw Error(`Purple doctor source ID changed: ${index}`);
    return [index,{...row,rest:new Float64Array(row.rest),inverse:new Float64Array(row.pseudoinverse),frame:new Float64Array(6)}];
  }));
  const layers=payload.layers.map(row=>({...row,rest:new Float32Array(row.rest),positions:new Float32Array(row.rest),
    uv:new Float32Array(row.uv),indices:new Uint16Array(row.indices)}));
  const layerMap=new Map(layers.map((row,i)=>[row.name,{row,index:i}]));
  const order=Int32Array.from(layers,(_,i)=>i),opacities=new Float32Array(layers.length).fill(1);
  const parameters=new Map(Array.from(core.parameters.ids,(id,i)=>[id,i]));
  for(const id of ['ParamEyeROpen','ParamEyeLOpen','ParamMouthOpenY'])if(!parameters.has(id))throw Error(`Source parameter missing: ${id}`);
  const methods={
    getDrawableCount:()=>layers.length,getDrawableRenderOrders:()=>order,
    getDrawableVertexPositions:i=>layers[i].positions,getDrawableVertices:i=>layers[i].positions,
    getDrawableVertexUvs:i=>layers[i].uv,getDrawableVertexIndices:i=>layers[i].indices,
    getDrawableVertexCount:i=>layers[i].positions.length/2,getDrawableVertexIndexCount:i=>layers[i].indices.length,
    getDrawableOpacity:i=>opacities[i],getDrawableTextureIndex:()=>0,
    getDrawableDynamicFlagVertexPositionsDidChange:()=>true,getDrawableDynamicFlagIsVisible:i=>opacities[i]>.0001,
    getDrawableCulling:()=>false,getDrawableBlendMode:()=>0,getDrawableInvertedMaskBit:()=>false,
    isUsingMasking:()=>false,getDrawableMaskCounts:()=>new Int32Array(layers.length),getDrawableMasks:()=>layers.map(()=>new Int32Array()),
    getMultiplyColor:()=>WHITE,getScreenColor:()=>BLACK,getDrawableMultiplyColor:()=>WHITE,getDrawableScreenColor:()=>BLACK,
  };
  const original=Object.fromEntries(Object.keys(methods).map(name=>[name,{own:Object.hasOwn(model,name),value:model[name]}]));
  Object.assign(model,methods);
  let detached=false,prepared=false,transition=null;
  const state={layers:layers.length,vertices:layers.reduce((sum,row)=>sum+row.rest.length/2,0),
    source:'hemin_3',eyeOpen:[1,1],mouthOpen:0,transitioning:false,maximumDisplacementPixels:0,nonfinite:0};
  const first=new Float64Array(2),second=new Float64Array(2),child=new Float64Array(2),parent=new Float64Array(2);
  function frames(){
    for(const [index,d] of descriptors){
      const xy=native.vertexPositions[index],n=xy.length/2,inv=d.inverse,f=d.frame;f.fill(0);
      for(let j=0;j<n;j++)for(let axis=0;axis<3;axis++){
        f[axis]+=inv[axis*n+j]*xy[j*2];f[axis+3]+=inv[axis*n+j]*xy[j*2+1];
      }
    }
    // Fit each bone directly to its real deformed source drawable, then align
    // the child's pivot to the parent's pivot. This preserves authored motion
    // angles without opening gaps between differently shaped target pieces.
    for(const bone of payload.coherentFrames||[]){
      const f=descriptors.get(bone.index).frame,p=descriptors.get(bone.parent).frame,[x,y]=bone.q;
      let px=p[0]*x+p[1]*y+p[2],py=p[3]*x+p[4]*y+p[5];
      if(bone.parentBinding){sample(bone.parentBinding,parent);px=x+parent[0];py=y+parent[1];}
      f[2]+=px-(f[0]*x+f[1]*y+f[2]);f[5]+=py-(f[3]*x+f[4]*y+f[5]);
    }
  }

  function delta(binding,out){
    const [index,mode,a,b,c,u,v,w]=binding,d=descriptors.get(index),xy=native.vertexPositions[index];
    if(mode===1){const f=d.frame;out[0]=f[0]*v+f[1]*w+f[2]-v;out[1]=f[3]*v+f[4]*w+f[5]-w;return;}
    out[0]=(xy[a*2]-d.rest[a*2])*u+(xy[b*2]-d.rest[b*2])*v+(xy[c*2]-d.rest[c*2])*w;
    out[1]=(xy[a*2+1]-d.rest[a*2+1])*u+(xy[b*2+1]-d.rest[b*2+1])*v+(xy[c*2+1]-d.rest[c*2+1])*w;
  }

  // A global-frame binding stores q in slots 5/6. Keep it separate from the
  // barycentric record interpretation above.
  function sample(binding,out){
    if(binding[1]===1){
      const d=descriptors.get(binding[0]),x=binding[5],y=binding[6],f=d.frame;
      out[0]=f[0]*x+f[1]*y+f[2]-x;out[1]=f[3]*x+f[4]*y+f[5]-y;
    }else{
      delta(binding,out);
      if(binding[1]===2){
        const f=descriptors.get(binding[0]).frame,x=binding[8],y=binding[9];
        out[0]+=(f[0]-1)*x+f[1]*y;out[1]+=f[3]*x+(f[4]-1)*y;
      }
    }
  }

  function prepare({delta:elapsed=0}={}){
    if(detached)throw Error('Purple doctor adapter detached');
    if(payload.renderOrderSources){
      // Cubism uses this array as a permutation into its drawable list, so
      // preserve source relative order but remap it to dense target ranks.
      const sorted=Array.from(layers,(_,i)=>i).sort((a,b)=>native.renderOrders[payload.renderOrderSources[a]]-native.renderOrders[payload.renderOrderSources[b]]||a-b);
      sorted.forEach((index,rank)=>{order[index]=rank;});
    }
    frames();let maximum=0,nonfinite=0;
    for(const layer of layers){
      const out=layer.positions,rest=layer.rest;
      for(let j=0;j<rest.length/2;j++){
        const mix=layer.mix[j]||0;
        if(mix===1)sample(layer.secondary[j],first);
        else{
          sample(layer.primary[j],first);
          if(mix>0){sample(layer.secondary[j],second);first[0]+=(second[0]-first[0])*mix;first[1]+=(second[1]-first[1])*mix;}
        }
        out[j*2]=rest[j*2]+first[0]*payload.motionScale;out[j*2+1]=rest[j*2+1]+first[1]*payload.motionScale;
        maximum=Math.max(maximum,Math.hypot(first[0],first[1])*80*payload.motionScale);
        if(!Number.isFinite(out[j*2])||!Number.isFinite(out[j*2+1]))nonfinite++;
      }
    }
    for(const attachment of payload.coherentFrames?.length?[]:payload.attachments){
      sample(attachment.childBinding,child);sample(attachment.parentBinding,parent);
      const positions=layerMap.get(attachment.child).row.positions;
      const dx=(parent[0]-child[0])*payload.motionScale,dy=(parent[1]-child[1])*payload.motionScale;
      for(let j=0;j<positions.length;j+=2){positions[j]+=dx;positions[j+1]+=dy;}
    }
    opacities.fill(1);
    if(payload.mergedHead)opacities[layerMap.get('hair_front').index]=0;
    const eyeRight=clamp(core.parameters.values[parameters.get('ParamEyeROpen')]);
    const eyeLeft=clamp(core.parameters.values[parameters.get('ParamEyeLOpen')]);
    const mouth=clamp(core.parameters.values[parameters.get('ParamMouthOpenY')]);
    opacities[layerMap.get('eye_screen_left').index]=smooth((eyeRight-.08)/.72);
    opacities[layerMap.get('eye_screen_right').index]=smooth((eyeLeft-.08)/.72);
    opacities[layerMap.get('mouth_open').index]=smooth(mouth/.65);
    if(transition){
      transition.time+=elapsed;const q=clamp(transition.time/transition.duration),mix=smooth(q);
      for(let i=0;i<layers.length;i++){
        const out=layers[i].positions,previous=transition.positions[i];
        for(let j=0;j<out.length;j++)out[j]=previous[j]+(out[j]-previous[j])*mix;
        opacities[i]=transition.opacities[i]+(opacities[i]-transition.opacities[i])*mix;
      }
      if(q>=1)transition=null;
    }
    Object.assign(state,{eyeOpen:[eyeRight,eyeLeft],mouthOpen:mouth,transitioning:Boolean(transition),maximumDisplacementPixels:maximum,nonfinite});
    prepared=true;
    if(nonfinite)throw Error(`Purple doctor has ${nonfinite} invalid target vertices`);
  }

  return {
    begin({duration=0}={}){transition=prepared&&duration>0?{time:0,duration,positions:layers.map(row=>row.positions.slice()),opacities:opacities.slice()}:null;},
    prepare,state:()=>({...state,eyeOpen:[...state.eyeOpen]}),
    detach(){if(detached)return;for(const [name,record] of Object.entries(original)){if(record.own)model[name]=record.value;else delete model[name];}detached=true;},
  };
}
