import {Vector3,Quaternion,Euler} from 'three';
import {createFlightClock,commandFlightClock,evaluateFlightClock} from './FlightClock.js';
/** Aircraft pose and socket derivatives all use ONE saved trajectory.
 * The hangar camera follows position; its movement is NOT counted as airspeed. */
export class FlightKinematics {
 constructor(config,definition){
  this.config=config;this.definition=definition;this.clock=createFlightClock(config);this.external=false;
  this._state={};this._euler=new Euler(0,0,0,'YXZ');
  this._va=new Vector3();this._a=new Vector3();this._b=new Vector3();this._qa=new Quaternion();this._qb=new Quaternion();
 }
 reset(){if(!this.external)this.clock=createFlightClock(this.config);}
 useClock(clock){if(clock?.version===1){this.external=true;this.clock=clock;}}
 observe(t){if(!this.external)commandFlightClock(this.clock,t,this.config);}
 pose(t,pos,quat){
  const s=evaluateFlightClock(this.clock,t,this._state),d=this.definition;
  const phase=s.phase*d.phaseRate,rx=d.radii[0],rz=d.radii[1];
  // Closed C1 path, initial heading -Z. Nose is tangent to actual travel.
  const dx=rx*Math.sin(phase),dz=-rz*Math.cos(phase);
  pos.set(rx*(1-Math.cos(phase)),this.config.altitude,-rz*Math.sin(phase));
  const yaw=Math.atan2(-dx,-dz),bank=-Math.min(.12,s.rate*.048)*Math.cos(phase);
  this._euler.set(0,yaw,bank);quat.setFromEuler(this._euler);return pos;
 }
 socketAt(t,anchor,out){this.pose(t,this._a,this._qa);return out.copy(anchor).multiplyScalar(this.config.scale).applyQuaternion(this._qa).add(this._a);}
 socketVelocity(t,anchor,out){
  // Central derivative includes translation AND angular velocity x socket offset.
  const h=1/480,lo=Math.max(0,t-h),hi=t+h;
  this.pose(lo,this._a,this._qa);this.pose(hi,this._b,this._qb);
  const ax=anchor.x*this.config.scale,ay=anchor.y*this.config.scale,az=anchor.z*this.config.scale;
  const va=this._va.set(ax,ay,az).applyQuaternion(this._qa).add(this._a);
  out.set(ax,ay,az).applyQuaternion(this._qb).add(this._b).sub(va).multiplyScalar(1/(hi-lo));return out;
 }
 centreVelocity(t,out){
  const s=evaluateFlightClock(this.clock,t,this._state),p=s.phase*this.definition.phaseRate,k=s.rate*this.definition.phaseRate;
  return out.set(this.definition.radii[0]*Math.sin(p)*k,0,-this.definition.radii[1]*Math.cos(p)*k);
 }
}
