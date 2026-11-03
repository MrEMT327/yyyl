/** Shared, pure mechanical timeline evaluation: browser, framing and GLB bake
 * use exactly the same curve. Curves are authored [normalized time, amount].
 * Short negative anticipation and small positive overtravel are intentional.
 */
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const smoother = x => { const t=clamp01(x); return t*t*t*(t*(t*6-15)+10); };
export function curveValue(x, keys){
 const t=clamp01(x);
 if(!keys?.length)return smoother(t);
 if(t<=keys[0][0])return keys[0][1];
 for(let i=1;i<keys.length;i++)if(t<=keys[i][0]){
  const a=keys[i-1],b=keys[i],u=smoother((t-a[0])/(b[0]-a[0]));
  return a[1]+(b[1]-a[1])*u;
 }
 return keys.at(-1)[1];
}
export function deploymentAmount(d, time){
 return curveValue((time-Math.max(0,d.delay||0))/Math.max(.05,d.duration||1.5),d.curve);
}
export function validateCurve(keys){
 if(!keys)return;
 if(!Array.isArray(keys)||keys.length<2)throw new Error('变形曲线至少需要两个关键帧');
 for(let i=0;i<keys.length;i++){
  const a=keys[i];
  if(!Array.isArray(a)||a.length!==2||!a.every(Number.isFinite)||a[0]<0||a[0]>1||a[1]<-.15||a[1]>1.15||(i&&a[0]<=keys[i-1][0]))throw new Error('变形曲线关键帧无效');
 }
 if(keys[0][0]!==0||keys[0][1]!==0||keys.at(-1)[0]!==1||keys.at(-1)[1]!==1)throw new Error('变形曲线必须从 0 到 1 准确归位');
}
/** No object allocations in the animation hot path. scratch = {rotation,axis}. */
export function applyDeploymentPose(object,d,value,restPosition,restQuaternion,translation,axis,scratch){
 object.position.copy(restPosition).addScaledVector(translation,value);
 scratch.rotation.setFromAxisAngle(axis,(d.angle||0)*value);
 object.quaternion.copy(restQuaternion).multiply(scratch.rotation);
 if(d.secondaryRotation){
  scratch.axis.fromArray(d.secondaryRotation.axis).normalize();
  scratch.rotation.setFromAxisAngle(scratch.axis,d.secondaryRotation.angle*value);
  object.quaternion.multiply(scratch.rotation);
 }
 if(d.scaleDelta){const base=d.restScale||[1,1,1];object.scale.set(base[0]+d.scaleDelta[0]*value,base[1]+d.scaleDelta[1]*value,base[2]+d.scaleDelta[2]*value);}
 object.updateMatrix();
}
