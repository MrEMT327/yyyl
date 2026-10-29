import {Vector3} from 'three';
/** World-space XPBD centre-line approximation for a narrow flexible ribbon.
 * External forces: gravity and relative-air quadratic drag. No rest-curve
 * attraction, no boolean wind, no target-pose lerp and no sinusoidal vertices.
 * A short sewn root is kinematic; free points are mass-bearing particles.
 * This is a game-scale tether solver, not CFD or a self-colliding cloth sheet. */
export class TetherDynamics {
 constructor({segments=24,length,rootDirection,gravity=9.81,drag=7,bendCompliance=.015,iterations=14,step=1/120}){
  this.count=segments+1;this.length=length;this.edge=length/segments;
  this.rootDirection=rootDirection.clone().normalize();this.gravity=gravity;this.drag=drag;
  this.bendCompliance=bendCompliance;this.iterations=iterations;this.dt=step;
  this.positions=Array.from({length:this.count},()=>new Vector3());this.velocities=this.positions.map(()=>new Vector3());
  this.old=this.positions.map(()=>new Vector3());this.constraints=[];
  for(let i=0;i<segments;i++)this.constraints.push({a:i,b:i+1,length:this.edge,bend:false,lambda:0});
  for(let i=0;i<segments-1;i++)this.constraints.push({a:i,b:i+2,length:this.edge*2,bend:true,lambda:0});
  this._delta=new Vector3();this._air=new Vector3();this._root1=new Vector3();
  this.tick=null;this.resets=0;this.telemetry={maxStretch:0,maxSpeed:0};
 }
 reset(t,kinematics){
  this.tick=Math.floor(Math.max(0,t)/this.dt+1e-7);const root=kinematics.anchorAt(this.tick*this.dt,new Vector3());
  const q=kinematics.orientationAt(this.tick*this.dt),dir=this.rootDirection.clone().applyQuaternion(q);
  this.positions[0].copy(root);this.positions[1].copy(root).addScaledVector(dir,this.edge);
  for(let i=2;i<this.count;i++)this.positions[i].copy(this.positions[1]).add(new Vector3(0,-this.edge*(i-1),0));
  for(const v of this.velocities)v.set(0,0,0);this.resets++;
 }
 advance(time,kinematics,{gravityScale=1,softness=1,dragScale=1}={}){
  const goal=Math.floor(Math.max(0,time)/this.dt+1e-7);
  if(this.tick===null||goal<this.tick||goal-this.tick>720){
   // On a large seek replay a bounded physical settling window, NOT a target pose.
   this.reset(Math.max(0,time-5),kinematics);
  }
  while(this.tick<goal){this.tick++;this.step(this.tick*this.dt,kinematics,gravityScale,softness,dragScale);}
  return this.positions;
 }
 step(t,k,gravityScale,softness,dragScale){
  const dt=this.dt,root=k.anchorAt(t,this.positions[0]);
  const q=k.orientationAt(t),root1=this._root1.copy(this.rootDirection).applyQuaternion(q).multiplyScalar(this.edge).add(root);
  const anchorSpeed=k.anchorVelocity(t,new Vector3()).length(),invdt=1/dt;
  for(let i=0;i<this.count;i++)this.old[i].copy(this.positions[i]);
  this.positions[1].copy(root1);
  for(let i=2;i<this.count;i++){
   const p=this.positions[i],v=this.velocities[i];
   const air=this._air.set(0,0,0); // world air is still by default
   // Subtle unresolved wake force, amplitude -> 0 as measured socket speed -> 0.
   if(k.turbulence>0){const a=k.turbulence*anchorSpeed*Math.min(1,(i-1)/6);air.set(Math.sin(t*2.31+i*.49)*a,Math.sin(t*3.27+i*.83)*a*.42,Math.cos(t*2.08+i*.59)*a*.25);}
   const relative=this._delta.subVectors(air,v),speed=relative.length();
   // Implicit drag impulse stays stable even at large relative velocities.
   const coeff=this.drag*dragScale,weight=coeff*speed*dt/(1+coeff*speed*dt);
   v.addScaledVector(relative,weight);v.y-=this.gravity*gravityScale*dt;
   v.multiplyScalar(Math.exp(-.15*dt));p.addScaledVector(v,dt);
  }
  for(const c of this.constraints)c.lambda=0;
  for(let iter=0;iter<this.iterations;iter++){
   const reverse=Boolean(iter%2);
   for(let j=0;j<this.constraints.length;j++){
    const c=this.constraints[reverse?this.constraints.length-1-j:j],a=this.positions[c.a],b=this.positions[c.b];
    const wa=c.a<2?0:1,wb=c.b<2?0:1;if(wa+wb===0)continue;
    const delta=this._delta.subVectors(b,a),len=delta.length();if(len<1e-9)continue;
    const compliance=c.bend?this.bendCompliance*(.12+softness*softness):1e-8;
    const alpha=compliance/(dt*dt),dl=(-(len-c.length)-alpha*c.lambda)/(wa+wb+alpha);
    c.lambda+=dl;delta.multiplyScalar(dl/len);a.addScaledVector(delta,-wa);b.addScaledVector(delta,wb);
   }
   this.positions[0].copy(root);this.positions[1].copy(root1);
  }
  // A final forward length projection removes accumulated solver-order stretch.
  // Corrected positions, not prediction velocities, carry into the next step.
  for(let i=2;i<this.count;i++){
   const a=this.positions[i-1],b=this.positions[i],d=this._delta.subVectors(b,a),len=d.length();
   if(len>this.edge*1.002)b.copy(a).addScaledVector(d,this.edge/len);
  }
  let maxStretch=0,maxSpeed=0;
  for(let i=2;i<this.count;i++){
   const v=this.velocities[i].subVectors(this.positions[i],this.old[i]).multiplyScalar(invdt);
   if(![v.x,v.y,v.z].every(Number.isFinite))throw new Error('Ribbon physics became non-finite');
   const speed=v.length();if(speed>40)v.multiplyScalar(40/speed);maxSpeed=Math.max(maxSpeed,speed);
   maxStretch=Math.max(maxStretch,Math.abs(this.positions[i].distanceTo(this.positions[i-1])/this.edge-1));
  }
  this.telemetry={maxStretch,maxSpeed,anchorSpeed,tick:this.tick};
 }
 clear(){this.tick=null;}
}
