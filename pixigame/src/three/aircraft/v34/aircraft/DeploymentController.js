import {Quaternion,Vector3} from 'three';
import {clamp01,deploymentAmount,validateCurve,applyDeploymentPose} from './DeploymentPose.js';

/** V37: one reversible timeline, not eight unrelated interpolators.
 * An interrupted return retraces the exact safe path, so a cover cannot close
 * over a partially raised cannon. Pauses and seeks preserve the current pose.
 */
export class DeploymentController{
 constructor(definitions,nodes,config){
  this.config=config;this.target=Boolean(config.deployed);this.lastTime=null;
  this.parts=(definitions||[]).map(d=>{
   const object=nodes.get(d.node);if(!object)throw new Error('变形转轴不存在：'+d.name);
   validateCurve(d.curve);
   const axis=new Vector3().fromArray(d.axis||[0,1,0]);if(axis.lengthSq()<1e-12)throw new Error('变形转轴方向无效');axis.normalize();
   if(d.secondaryRotation&&(!d.secondaryRotation.axis?.every(Number.isFinite)||new Vector3(...d.secondaryRotation.axis).lengthSq()<1e-12||!Number.isFinite(d.secondaryRotation.angle)))throw new Error('二级转轴无效');
   return {definition:d,object,axis,restPosition:new Vector3().fromArray(d.restPosition||object.position.toArray()),restQuaternion:new Quaternion().fromArray(d.restQuaternion||object.quaternion.toArray()),translation:new Vector3().fromArray(d.translation||[0,0,0]),value:this.target?1:0,from:this.target?1:0};
  });
  this.duration=Math.max(0,...this.parts.map(p=>(p.definition.delay||0)+Math.max(.05,p.definition.duration||1.5)));
  this.timeline=this.target?this.duration:0;this.started=0;
  this.scratch={rotation:new Quaternion(),axis:new Vector3()};this.apply();
 }
 get progress(){return this.duration?clamp01(this.timeline/this.duration):0;}
 get moving(){return this.target?this.timeline<this.duration-1e-8:this.timeline>1e-8;}
 get phase(){
  if(!this.moving)return this.target?'战斗形态 · 已锁定':'巡航形态';
  if(!this.target)return '机构收回';
  const p=this.progress;return p<.17?'预备解锁':p<.49?'主机构展开':p<.82?'二级机构部署':'回弹锁定';
 }
 sample(time){
  if(!Number.isFinite(time))throw new Error('无效变形时间');
  const wanted=Boolean(this.config.deployed),changed=wanted!==this.target;
  const dt=this.lastTime===null?0:Math.max(0,time-this.lastTime);
  if(changed){this.target=wanted;this.started=time;for(const p of this.parts)p.from=p.value;}
  else if(dt>0)this.timeline=Math.max(0,Math.min(this.duration,this.timeline+(this.target?dt:-dt)));
  this.lastTime=time;
  for(const p of this.parts)p.value=deploymentAmount(p.definition,this.timeline);
  this.apply();return this.progress;
 }
 apply(){for(const p of this.parts)applyDeploymentPose(p.object,p.definition,p.value,p.restPosition,p.restQuaternion,p.translation,p.axis,this.scratch);}
 setImmediate(deployed){
  this.config.deployed=Boolean(deployed);this.target=Boolean(deployed);this.timeline=this.target?this.duration:0;this.started=this.lastTime??0;
  for(const p of this.parts)p.from=p.value=deploymentAmount(p.definition,this.timeline);this.apply();
 }
 /** Deterministic offline capture/scrubbing; normal gameplay uses sample(). */
 seekTimeline(time){this.timeline=Math.max(0,Math.min(this.duration,time));for(const p of this.parts)p.value=deploymentAmount(p.definition,this.timeline);this.apply();return this.progress;}
}
