/* Consumer-only unified temporary eye/hand input. Official Core/Framework unchanged.
 * Eye formula matches frozen eye-open-input-adapter-v02. Hand formula follows
 * HAND-RELAXATION-CONSUMER-CONTRACT.json 41065629…38299a.
 * One snapshot/one Core update/one finally restore, never savedParameters writes.
 */
export const smoothstep=x=>{const q=Math.max(0,Math.min(1,x));return q*q*(3-2*q);};
export function handMotionGate(mode,time,contract){
 if(mode==='default'||mode==='idle')return 1;
 if(mode!=='touch_head')return 0;
 if(!Number.isFinite(time))throw Error('Nonfinite hand source time');
 const {duration,fadeSeconds,unchangedTouchMiddle}=contract.motionGate.touchHead;
 const [middleStart,middleEnd]=unchangedTouchMiddle;
 const t=Math.max(0,Math.min(duration,time));
 // Explicit middle gate avoids any floating-point cancellation near boundaries.
 if(t===0||t===duration)return 1;
 if(t>=middleStart&&t<=middleEnd)return 0;
 return Math.max(0,Math.min(1,1-smoothstep(t/fadeSeconds)+smoothstep((t-middleEnd)/fadeSeconds)));
}
const equalBits=(a,b)=>{const aa=new Uint32Array(a.buffer,a.byteOffset,a.length),bb=new Uint32Array(b.buffer,b.byteOffset,b.length);return aa.length===bb.length&&aa.every((x,i)=>x===bb[i]);};
export function createConsumerParameterInputAdapter(model,{eye={},hand={enabled:false},handContract}={}){
 const p=model.getModel().parameters,a=eye.sourceDefault??0.699999988079071,b=eye.targetDefault??a;
 const eyeIds=['ParamEyeLOpen','ParamEyeROpen'],eyeIndices=eyeIds.map(id=>Array.from(p.ids).indexOf(id));
 if(!(a>0&&a<1&&b>=.6&&b<=1))throw Error('Invalid eye-open mapping');
 for(const i of eyeIndices)if(i<0||p.minimumValues[i]!==0||p.maximumValues[i]!==1)throw Error('Eye contract mismatch');
 const mapping=eye.mapping||'piecewise-linear',k=(b-a)/(a*(1-a));
 if(mapping==='endpoint-preserving-quadratic'&&Math.abs(k)>1)throw Error('Nonmonotone eye mapping');
 if(!handContract||handContract.rangeGate.margin!==5||handContract.motionGate.touchHead.duration!==5.417||handContract.motionGate.touchHead.fadeSeconds!==.4)throw Error('Hand contract missing/mismatch');
 const params=handContract.parameters.map(s=>{const i=Array.from(p.ids).indexOf(s.id);if(i<0||i!==s.index||p.minimumValues[i]!==s.min||p.maximumValues[i]!==s.max||p.defaultValues[i]!==s.originalDefault)throw Error('Hand ID/range/default mismatch '+s.id);return {...s,index:i};});
 if(params.length!==2||params[0].id!=='youshoubianhua'||params[0].delta!==-3||params[1].id!=='Param29'||params[1].delta!==-1)throw Error('Unapproved hand targets');
 const alternateIndex=Array.from(p.ids).indexOf('Param86');if(alternateIndex!==88)throw Error('Native alternate-hand ID mismatch');
 let latest=null;
 const eyeMap=x=>x<=0?0:x>=1?1:mapping==='endpoint-preserving-quadratic'?x+k*x*(1-x):x<=a?b*x/a:b+(1-b)*(x-a)/(1-a);
 return {
  update({mode='default',sourceTime=0}={}){
   const source=p.values.slice(),render=source.slice();
   if(eye.enabled)for(const i of eyeIndices)render[i]=eyeMap(source[i]);
   const motionGate=handMotionGate(mode,sourceTime,handContract),rows=[];
   for(const s of params){const raw=source[s.index];if(!Number.isFinite(raw))throw Error('Nonfinite original hand input');
    const rangeGate=smoothstep((raw-s.min)/handContract.rangeGate.margin)*smoothstep((s.max-raw)/handContract.rangeGate.margin);
    if(hand.enabled&&motionGate!==0&&rangeGate!==0)render[s.index]=Math.max(s.min,Math.min(s.max,raw+s.delta*motionGate*rangeGate));
    rows.push({id:s.id,index:s.index,source:raw,render:render[s.index],delta:render[s.index]-raw,rangeGate});
   }
   let thrown=null;p.values.set(render);try{model.update();}catch(e){thrown=e;}finally{p.values.set(source);}
   const sourceRestored=equalBits(source,p.values);
   const summary={enabled:!!eye.enabled,sourceDefault:a,targetDefault:b,mapping,coefficientK:k,indices:eyeIndices,ids:eyeIds,sourceValues:eyeIndices.map(i=>source[i]),renderValues:eyeIndices.map(i=>render[i]),sourceRestored,sourceSavedParametersNeverWritten:true,
    hand:{enabled:!!hand.enabled,mode,sourceTime,motionGate,alternateHandSwitch:{id:'Param86',index:alternateIndex,source:source[alternateIndex],render:render[alternateIndex]},parameters:rows,sourceRestored,wholeParameterBufferRestored:sourceRestored,error:thrown?String(thrown):null},
    scope:'Raw source parameters -> one combined temporary eye/hand input -> original Core XY; local leg renderer adaptation is downstream.'};
   latest={source,render,summary};if(!sourceRestored)throw Error('Source parameter restore failed');if(thrown)throw thrown;return summary;
  },
  state(){if(!latest)throw Error('Input adapter not evaluated');return latest;},
  eyeMap
 };
}
