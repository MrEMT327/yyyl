import {ParticleFrameCache} from './particle-frame-cache.mjs';
/*
 * Source: Godot 4.7 ParticleProcessMaterial / renderer_rd particles.glsl.
 * Copyright (c) 2014-present Godot Engine contributors.
 * Copyright (c) 2007-2014 Juan Linietsky, Ariel Manzur.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * This is a deterministic CPU port of the source's 2D process formulas, not a
 * claim of bit-identical GPU output. Curves retain their stored tangents and HDR
 * colors remain floating point. See PARTICLE_FIDELITY_LIMITS before acceptance.
 */
export const PARTICLE_FIDELITY_LIMITS = Object.freeze([
  'CPU double precision differs from Godot GPU float precision, especially curl noise.',
  'Birth scheduling and random seeds are deterministic; original runtime seed/phase must be supplied for matching particles.',
  'Curve/gradient values are evaluated from stored curves; GPU baked-texture filtering may differ slightly.',
  'Fixed-step CPU sampling replays the requested fractional step; Godot render interpolation and fractional_delta scheduling are not bit-identical.',
  'Trails expose source-time transform samples; the consumer must construct the source trail mesh and apply its material.',
  'Attractors and SDF collisions are not implemented and explicitly rejected when requested.',
]);
const PI=3.14159, TAU=PI*2, DEG=PI/180, I=[1,0,0,1,0,0];
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const mix=(a,b,t)=>a+(b-a)*t;
const vecmix=(a,b,t)=>a.map((v,i)=>mix(v,b[i],t));
const mul=(a,b)=>a.map((v,i)=>v*b[i]);
const add=(a,b)=>a.map((v,i)=>v+b[i]);
const scale=(a,b)=>a.map(v=>v*b);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0);
const norm=a=>{const l=Math.hypot(...a);return l?scale(a,1/l):a.map(()=>0);};
const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const fract=x=>x-Math.floor(x);
function resource(g,r){return r?.$ref?g.resources[r.$ref]:r?.type?r:undefined;}
function requireResource(g,r){const x=resource(g,r);if(!x)throw Error(`Unresolved particle resource ${JSON.stringify(r)}`);return x;}
export function godotHash(x){x=Math.imul((x>>>16)^x,73244475);x=Math.imul((x>>>16)^x,73244475);return ((x>>>16)^x)>>>0;}
export function godotRandom(seed){let s=seed|0;const next=()=>{if(!s)s=305420679;const k=Math.trunc(s/127773);s=(16807*(s-k*127773)-2836*k)|0;if(s<0)s+=2147483647;return ((s>>>0)%65536)/65535;};Object.defineProperty(next,'state',{get:()=>s,set:v=>{s=v|0;}});return next;}
const curvePoints=new WeakMap();
const gradientPoints=new WeakMap();

/** Stored Curve._data: position,left tangent,right tangent,left mode,right mode. */
export function curveSample(g,ref,t){
 const r=requireResource(g,ref),p=r.properties;
 if(r.type==='CurveTexture')return curveSample(g,p.curve,t);
 if(r.type==='CurveXYZTexture')return ['curve_x','curve_y','curve_z'].map(k=>p[k]?curveSample(g,p[k],t):1);
 if(r.type!=='Curve')throw Error(`Expected curve, got ${r.type}`);
 const d=p._data||[];if(!d.length)return 0;
 let pts=curvePoints.get(r);if(!pts){pts=[];for(let i=0;i<d.length;i+=5)pts.push({x:d[i][0],y:d[i][1],left:d[i+1],right:d[i+2],lm:d[i+3],rm:d[i+4]});curvePoints.set(r,pts);}
 if(t<=pts[0].x)return pts[0].y;if(t>=pts.at(-1).x)return pts.at(-1).y;
 const j=pts.findIndex(v=>v.x>=t),a=pts[j-1],b=pts[j],dx=b.x-a.x;
 if(!dx)return b.y;const u=(t-a.x)/dx,u2=u*u,u3=u2*u;
 const slope=(b.y-a.y)/dx,m0=a.rm===1?slope:a.right,m1=b.lm===1?slope:b.left;
 return (2*u3-3*u2+1)*a.y+(u3-2*u2+u)*dx*m0+(-2*u3+3*u2)*b.y+(u3-u2)*dx*m1;
}
export function gradientSample(g,ref,t){
 const r=requireResource(g,ref),p=r.properties;
 if(r.type==='GradientTexture1D'||r.type==='GradientTexture2D')return gradientSample(g,p.gradient,t);
 if(r.type!=='Gradient')throw Error(`Expected gradient, got ${r.type}`);
 if((p.interpolation_color_space??0)!==0)throw Error('Unsupported gradient interpolation color space');
 const os=p.offsets??[0,1],cs=p.colors??[[0,0,0,1],[1,1,1,1]];
 let rows=gradientPoints.get(r);if(!rows){rows=os.map((x,i)=>({x,c:cs[i]})).sort((a,b)=>a.x-b.x);gradientPoints.set(r,rows);}
 if(t<=rows[0].x)return [...rows[0].c];if(t>=rows.at(-1).x)return [...rows.at(-1).c];
 const i=rows.findIndex(v=>v.x>=t),a=rows[i-1],b=rows[i],u=(t-a.x)/(b.x-a.x);
 const mode=p.interpolation_mode??0;if(mode===1)return [...a.c];
 if(mode===0)return vecmix(a.c,b.c,u);
 if(mode===2){const before=rows[Math.max(0,i-2)].c,after=rows[Math.min(rows.length-1,i+1)].c;return a.c.map((v,k)=>.5*((2*v)+(-before[k]+b.c[k])*u+(2*before[k]-5*v+4*b.c[k]-after[k])*u*u+(-before[k]+3*v-3*b.c[k]+after[k])*u*u*u));}
 throw Error(`Unsupported gradient interpolation ${mode}`);
}
const curve=(g,p,k,t,fallback=1)=>p[k]?curveSample(g,p[k],clamp(t)):fallback;
const scalar=(g,p,k,t,fallback=1)=>{const v=curve(g,p,k,t,fallback);return Array.isArray(v)?v[0]:v;};
const vectorCurve=(g,p,k,t)=>{const v=curve(g,p,k,t,1);return Array.isArray(v)?v:[v,v,v];};

// The source's 4D gradient noise and curl, translated without substituting sine noise.
const GRAD=[[.143081,.001724,.280166,.262771],[.645401,-.047791,-.146698,.595016],[-.499665,-.095734,.425674,-.207367],[-.013596,-.848588,.423736,.17044]];
function noiseGrad(v){const p=GRAD.map(k=>fract(dot(v,k)));return p.map((x,i)=>fract(x*p[(i+1)%4]*2365.952041)*2-1);}
export function noise4(v){
 const shift=dot(v,[-.1666667,-.1666667,-.1666667,-.5]),q=[v[0]+shift,v[1]+shift,v[2]+shift,dot(v,[.5,.5,.5,.5])];
 const base=q.map(Math.floor),delta=q.map((x,i)=>x-base[i]),fade=delta.map(x=>x*x*x*(10+x*(-15+x*6)));
 const vals=[];for(let mask=0;mask<16;mask++){const bits=[0,1,2,3].map(k=>(mask>>k)&1);vals.push(dot(delta.map((x,i)=>x-bits[i]),noiseGrad(base.map((x,i)=>x+bits[i]))));}
 let values=vals;for(let d=0;d<4;d++){const next=[];for(let i=0;i<values.length;i+=2)next.push(mix(values[i],values[i+1],fade[d]));values=next;}return values[0];
}
function noise3(v){const off=1.7320508*2048.333333;return [noise4(v),noise4([v[0],v[1],v[2],v[3]+off]),noise4([v[0],v[1],v[2],v[3]-off])];}
function noiseDirection(p,pos,time){
 const strength=p.turbulence_noise_strength??1,epsilon=.001+Math.max(strength-1,0)*70;
 // The setter converts the editor's log-scale to the shader multiplier.
 const noiseScale=Math.pow(p.turbulence_noise_scale??9,.25)*(4/Math.pow(10,.25))-4,speed=p.turbulence_noise_speed??[0,0,0];
 const v=[pos[0]*noiseScale+time*speed[0],pos[1]*noiseScale+time*speed[1],pos[2]*noiseScale+time*speed[2],time*(p.turbulence_noise_speed_random??.2)];
 const pairs=[0,1,2].map(d=>{const a=[...v],b=[...v];a[d]-=epsilon;b[d]+=epsilon;return [noise3(a),noise3(b)];});
 const [[x0,x1],[y0,y1],[z0,z1]]=pairs;
 return scale(norm([(y1[2]-y0[2])-(z1[1]-z0[1]),(z1[0]-z0[0])-(x1[2]-x0[2]),(x1[1]-x0[1])-(y1[0]-y0[0])]),mix(.9,1,strength-9));
}
function rotateHue(c,a){
 const co=Math.cos(a),si=Math.sin(a),r=c[0],g=c[1],b=c[2];
 // Keep the original coefficient values and exact scalar operation order.
 // The initial zero matches dot()'s reduction, including signed zero.
 return [
  ((0+(.299+co*.701+si*.168)*r)+(.299+co*(-.299)+si*(-.328))*g)+(.299+co*(-.300)+si*1.250)*b,
  ((0+(.587+co*(-.587)+si*.330)*r)+(.587+co*.413+si*.035)*g)+(.587+co*(-.588)+si*(-1.050))*b,
  ((0+(.114+co*(-.114)+si*(-.497))*r)+(.114+co*(-.114)+si*.292)*g)+(.114+co*.886+si*(-.203))*b,
  c[3],
 ];
}
function range(p,k,r,def=0){const a=p[k+'_min']??def,b=p[k+'_max']??def;return mix(a,b,r());}
function initial(g,p,number,seed){
 const random=godotRandom(godotHash((number+1+seed)>>>0));
 const display={scale:Math.max(.001,range(p,'scale',random,1)),hue:TAU*range(p,'hue_variation',random),animSpeed:range(p,'anim_speed',random),animOffset:range(p,'anim_offset',random),life:1-(p.lifetime_randomness??0)*random(),color:p.color??[1,1,1,1]};
 if(p.color_initial_ramp)display.color=mul(display.color,gradientSample(g,p.color_initial_ramp,random()));
 const dynamic={angle:range(p,'angle',random),angular:range(p,'angular_velocity',random),speed:range(p,'initial_velocity',random),directional:range(p,'directional_velocity',random,1),radial:range(p,'radial_velocity',random),orbit:range(p,'orbit_velocity',random)};
 if(p.turbulence_enabled)dynamic.turbulence=range(p,'turbulence_influence',random,.1);
 const physics={linear:range(p,'linear_accel',random),radial:range(p,'radial_accel',random),tangent:range(p,'tangential_accel',random),damping:range(p,'damping',random)};
 // Godot process() reconstructs these parameter draws each frame, before the
 // start()-only AMOUNT_RATIO and emission-shape draws.
 const processRandomSeed=random.state;
 return {random,display,dynamic,physics,processRandomSeed,amountRandom:random()};
}
function initialPosition(p,r){
 let pos=[0,0,0];const type=p.emission_shape??0;
 if(type===1||type===2){const s=r()*2-1,t=r()*TAU,rad=(p.emission_sphere_radius??1)*Math.sqrt(1-s*s);pos=[rad*Math.cos(t),rad*Math.sin(t),(p.emission_sphere_radius??1)*s];if(type===1)pos=scale(pos,r());}
 else if(type===3)pos=mul([r()*2-1,r()*2-1,r()*2-1],p.emission_box_extents??[1,1,1]);
 else if(type===6){
  const radius=Math.max(.001,p.emission_ring_radius??1),height=p.emission_ring_height??1,top=Math.max(radius-Math.tan((90-(p.emission_ring_cone_angle??90))*DEG)*height,0),skew=Math.max(Math.min(radius,top)/Math.max(radius,top),.5);
  let y=r();y=radius<top?Math.pow(y,skew):1-Math.pow(y,skew);const angle=r()*TAU,inner=p.emission_ring_inner_radius??0;
  let rad=Math.sqrt(r()*(radius*radius-inner*inner)+inner*inner);rad=mix(rad,rad*top/radius,y);
  let axis=p.emission_ring_axis??[0,0,1];axis=Math.hypot(...axis)?norm(axis):[0,0,1];let ortho=norm(cross(axis,Math.abs(axis[0])===1?[0,1,0]:[1,0,0]));
  // GLSL source rotation matrix is column-major and rotates by -angle.
  ortho=add(add(scale(ortho,Math.cos(angle)),scale(cross(axis,ortho),-Math.sin(angle))),scale(axis,dot(axis,ortho)*(1-Math.cos(angle))));
  pos=add(scale(norm(ortho),rad),scale(axis,y*height-height/2));
 } else if(type!==0)throw Error(`Unsupported emission shape ${type}`);
 return add(mul(pos,p.emission_shape_scale??[1,1,1]),p.emission_shape_offset??[0,0,0]);
}
function randomDirection(p,r,spread=p.spread??45){const d=p.direction??[1,0,0];const a=(r()*2-1)*spread*DEG+Math.atan2(d[1],d[0]);return [Math.cos(a),Math.sin(a),0];}
function matrixAt(history,t){if(!history?.length)return I;if(t<=history[0].age)return history[0].matrix;for(let i=1;i<history.length;i++)if(t<=history[i].age){const a=history[i-1],b=history[i],u=(t-a.age)/(b.age-a.age);return vecmix(a.matrix,b.matrix,u);}return history.at(-1).matrix;}
function transform(m,p,position=true){return [m[0]*p[0]+m[2]*p[1]+(position?m[4]:0),m[1]*p[0]+m[3]*p[1]+(position?m[5]:0),0];}
function displayAt(g,p,s,life,seconds,velocity){
 const d=s.display,dy=s.dynamic;let c=[...d.color];
 if(p.color_ramp)c=mul(c,gradientSample(g,p.color_ramp,life));c[3]*=scalar(g,p,'alpha_curve',life);
 c=rotateHue(c,d.hue*scalar(g,p,'hue_variation_curve',life));const emission=1+scalar(g,p,'emission_curve',life,0);c=[c[0]*emission,c[1]*emission,c[2]*emission,c[3]];
 let scales=scale(vectorCurve(g,p,'scale_curve',life),d.scale);
 if(p.scale_over_velocity_curve){const den=(p.scale_over_velocity_max??5)-(p.scale_over_velocity_min??0),len=Math.hypot(...velocity);const v=len>.001?(den===0?1:clamp(len/den)):0;scales=mul(scales,vectorCurve(g,p,'scale_over_velocity_curve',v));}
 const angle=(dy.angle*scalar(g,p,'angle_curve',life)+seconds*dy.angular)*DEG;
 return {rotation:p.particle_flag_align_y?(Math.atan2(velocity[1],velocity[0])-Math.PI/2):-angle,scale:scales.slice(0,2),color:c,custom:[angle,life,fract(d.animOffset+scalar(g,p,'anim_offset_curve',life,0)+seconds*d.animSpeed*scalar(g,p,'anim_speed_curve',life)),d.life]};
}

const MATERIAL_KEYS=new Set(('particle_flag_disable_z particle_flag_align_y particle_flag_damping_as_friction gravity direction spread flatness emission_shape emission_sphere_radius emission_box_extents emission_ring_axis emission_ring_height emission_ring_radius emission_ring_inner_radius emission_ring_cone_angle emission_shape_scale emission_shape_offset color color_ramp color_initial_ramp alpha_curve emission_curve scale_curve angle_curve hue_variation_curve radial_accel_curve tangential_accel_curve damping_curve orbit_velocity_curve linear_accel_curve radial_velocity_curve angular_velocity_curve anim_offset_curve anim_speed_curve scale_over_velocity_curve turbulence_enabled turbulence_noise_strength turbulence_noise_scale turbulence_noise_speed turbulence_noise_speed_random turbulence_influence_over_life lifetime_randomness script').split(' '));
for(const k of ['angle','angular_velocity','initial_velocity','directional_velocity','radial_velocity','orbit_velocity','linear_accel','radial_accel','tangential_accel','damping','scale','hue_variation','anim_offset','anim_speed','turbulence_influence','turbulence_initial_displacement','scale_over_velocity'])for(const q of ['min','max'])MATERIAL_KEYS.add(k+'_'+q);
const NODE_KEYS=new Set(('texture process_material amount lifetime randomness speed_scale emitting one_shot explosiveness z_index modulate self_modulate visibility_rect trail_lifetime light_mask local_coords trail_enabled fixed_fps material trail_sections trail_section_subdivisions amount_ratio scale position rotation script show_behind_parent visible physics_interpolation_mode visibility_layer preprocess fractional_delta interpolate draw_order seed use_fixed_seed interpolate_to_end').split(' '));
export function particleCoverage(g,node){
 const issues=[],p=node.properties??node,r=resource(g,p.process_material);
 if(!r||r.type!=='ParticleProcessMaterial')issues.push('process_material is not a resolved ParticleProcessMaterial');
 for(const k of Object.keys(p))if(!NODE_KEYS.has(k))issues.push(`node.${k}`);
 if(r){for(const k of Object.keys(r.properties))if(!MATERIAL_KEYS.has(k))issues.push(`material.${k}`);if(!r.properties.particle_flag_disable_z)issues.push('3D particle motion');if(r.properties.angular_velocity_curve)issues.push('integrated angular_velocity_curve');}
 if((p.interpolate_to_end??0)!==0)issues.push('interpolate_to_end');
 return issues;
}

/**
 * `age`, `stopAge`, and history ages are seconds on the effect's clock.
 * `emitting:true` explicitly restarts a serialized initially-off one-shot.
 * History matrices must include the particle node's complete emitter transform.
 * World-space output is marked space=world; do not transform it a second time.
 */
export function sampleParticles(g,node,age,seed=1,options={}){
 const np=node.properties??node,unsupported=particleCoverage(g,node);
 if(unsupported.length){if(options.strict!==false)throw Error(`Unsupported particle features: ${unsupported.join(', ')}`);return {instances:[],trails:[],unsupported};}
 const p=requireResource(g,np.process_material).properties,amount=np.amount??8,lifetime=np.lifetime??1,speed=np.speed_scale??1,pre=np.preprocess??0;
 const start=options.startAge??0,clock=(age-start)*speed+pre,stop=(options.stopAge??Infinity)-start,stopClock=stop*speed+pre;
 const enabled=options.emitting??np.emitting??true,instances=[],trails=[];
 if(!Number.isFinite(age)||age<start||clock<0||!(lifetime>0)||!(speed>0)||!(amount>0)||(!enabled&&!Number.isFinite(options.stopAge)))return {instances,trails,unsupported};
 const local=np.local_coords??false,fps=np.fixed_fps??30,dt=fps>0?1/fps:(options.timeStep??1/60);
 const cache=options.cache,cacheSignature=cache?JSON.stringify([lifetime,amount,dt,local,speed,start,pre,seed]):null;
 if(cache&&(cache.signature!==cacheSignature||cache.material!==p)){
  // Lifecycle overrides are owned copies. Equal process parameters must not
  // replay every living particle from birth merely because identity changed.
  const materialSignature=JSON.stringify(p);
  if(cache.signature!==cacheSignature||cache.materialSignature!==materialSignature)cache.clear();
  cache.signature=cacheSignature;cache.material=p;cache.materialSignature=materialSignature;
 }
 const liveCacheKeys=new Set();
 const cycleFirst=np.one_shot?0:Math.max(0,Math.floor((clock-lifetime-(np.trail_lifetime??.3))/lifetime));
 const cycleLast=np.one_shot?0:Math.floor(clock/lifetime);
 for(let cycle=cycleFirst;cycle<=cycleLast;cycle++)for(let index=0;index<amount;index++){
  const number=cycle*amount+index,randomPhase=(godotHash(number) % 65536)/65536;
  const born=(cycle+(index+(np.randomness??0)*randomPhase)/amount*(1-(np.explosiveness??0)))*lifetime;
  if(born>clock||born>=stopClock)continue;
  const cacheKey=number;liveCacheKeys.add(cacheKey);let cached=cache?.get(cacheKey);
  const state=cached?.state??initial(g,p,number,seed),duration=lifetime*state.display.life,particleAge=clock-born;
  if(state.amountRandom>(np.amount_ratio??1)||particleAge>=duration)continue;
  const end=Math.min(particleAge,duration),steps=Math.ceil(end/dt),dy=state.dynamic,phy=state.physics;
  if(cached&&end+1e-10<cached.fullSteps*dt){cache.delete(cacheKey);cached=null;}
  let pos,vel,history,firstStep=1,finalVelocity;
  if(cached){pos=[...cached.pos];vel=[...cached.vel];history=[...cached.history];firstStep=cached.fullSteps+1;finalVelocity=[...cached.finalVelocity];state.random.state=cached.randomSeed;}
  else{
   pos=initialPosition(p,state.random);
   if(p.turbulence_enabled)pos=add(pos,scale(noiseDirection(p,pos,start+(born-pre)/speed),range(p,'turbulence_initial_displacement',state.random)));
   const birthMatrix=local?I:matrixAt(options.history,start+(born-pre)/speed);
   pos=transform(birthMatrix,pos);vel=transform(birthMatrix,scale(randomDirection(p,state.random),state.dynamic.speed),false);pos[2]=vel[2]=0;history=[];finalVelocity=vel;
  }
  function frame(t,v){const life=clamp(t/duration),display=displayAt(g,p,state,life,t,v);return {time:start+(born+t-pre)/speed,position:pos.slice(0,2),velocity:v.slice(0,2),...display};}
  if(!cached){history.push(frame(0,vel));if(cache){cached={state,pos:[...pos],vel:[...vel],history:[...history],finalVelocity:[...vel],fullSteps:0,randomSeed:state.random.state};cache.set(cacheKey,cached);}}
  for(let step=firstStep;step<=steps;step++){
   const previous=(step-1)*dt,t=Math.min(step*dt,end),delta=t-previous,life=clamp(t/duration),now=start+(born+t-pre)/speed;
   const emitter=local?I:matrixAt(options.history,now),origin=[emitter[4],emitter[5],0],diff=add(pos,scale(origin,-1)),dist=Math.hypot(...diff),unit=norm(diff);
   let controlled=[0,0,0];const orbit=dy.orbit*scalar(g,p,'orbit_velocity_curve',life);
   if(Math.abs(dy.orbit)>=.01&&delta>=.001&&orbit!==0){const a=orbit*TAU*delta,co=Math.cos(a),si=Math.sin(a);controlled=[(co*diff[0]+si*diff[1]-diff[0])/delta,(-si*diff[0]+co*diff[1]-diff[1])/delta,0];}
   if(delta>=.001){const radial=dy.radial*scalar(g,p,'radial_velocity_curve',life);state.random.state=state.processRandomSeed;const dir=dist>.01?unit:randomDirection(p,state.random,360);let radialDisplacement=scale(dir,dist>.01?radial:dy.radial);if(radial<0)radialDisplacement=scale(norm(radialDisplacement),Math.min(Math.abs(radial),dist/delta));controlled=add(controlled,radialDisplacement);}
   let force=add(p.gravity??[0,-9.8,0],scale(norm(vel),phy.linear*scalar(g,p,'linear_accel_curve',life)));
   force=add(force,scale(unit,phy.radial*scalar(g,p,'radial_accel_curve',life)));
   force=add(force,scale([-unit[1],unit[0],0],phy.tangent*scalar(g,p,'tangential_accel_curve',life)));
   vel=add(vel,scale(force,delta));vel[2]=0;
   const damping=phy.damping*scalar(g,p,'damping_curve',life);if(damping>0){let magnitude=Math.hypot(...vel);magnitude-=np.particle_flag_damping_as_friction||p.particle_flag_damping_as_friction?magnitude*magnitude*damping*.05*delta:damping*delta;vel=magnitude<0?[0,0,0]:scale(norm(vel),magnitude);}
   if(p.turbulence_enabled){const noise=norm(noiseDirection(p,pos,now)),infl=clamp(dy.turbulence*scalar(g,p,'turbulence_influence_over_life',life));vel=vecmix(vel,scale(noise,Math.hypot(...vel)*(1+(1-infl)*.2)),infl);controlled=vecmix(controlled,scale(noise,Math.hypot(...controlled)*(1+(1-infl)*.2)),infl);}
   finalVelocity=add(controlled,vel);finalVelocity[2]=0;pos=add(pos,scale(finalVelocity,delta));history.push(frame(t,finalVelocity));
   const retain=np.trail_enabled?Math.ceil((np.trail_lifetime??.3)/dt)+2:1;if(history.length>retain)history.splice(0,history.length-retain);
   if(cached&&t===step*dt){cached.pos=[...pos];cached.vel=[...vel];cached.finalVelocity=[...finalVelocity];cached.fullSteps=step;cached.randomSeed=state.random.state;cached.history=[...history];}
  }
  const id=`${node.path??'particles'}:${number}`,common={id,texture:np.texture,material:np.material,space:local?'local':'world',number,birthTime:start+(born-pre)/speed};
  if(particleAge<duration)instances.push({...common,...history.at(-1)});
  if(np.trail_enabled){const tail=np.trail_lifetime??.3;trails.push({...common,points:history,age,speedScale:speed,lifetime:tail,sections:np.trail_sections??8,subdivisions:np.trail_section_subdivisions??4});}
 }
 if(cache)for(const k of cache.keys())if(!liveCacheKeys.has(k))cache.delete(k);
 return {instances,trails,unsupported};
}
/** One player belongs to one effect instance; reset on new run/owner reuse. */
export class ParticlePlayer {
 constructor(){this.nodes=new Map();this.age=-Infinity;this.seed=undefined;this.readonlyFrames=new ParticleFrameCache();}
 reset(){this.readonlyFrames.clear();this.nodes.clear();this.age=-Infinity;this.seed=undefined;}
 sample(graph,node,age,seed=1,options={}){
  if(age<this.age-1e-9||this.seed!==undefined&&seed!==this.seed)this.reset();
  this.age=age;this.seed=seed;
  const key=options.key??`${node.nodePath??node.path??'.'}:${node.properties?.process_material?.$ref??''}`;
  this.readonlyFrames.delete(key);
  let cache=this.nodes.get(key);if(!cache){cache=new Map();this.nodes.set(key,cache);}
  return sampleParticles(graph,node,age,seed,{...options,cache});
 }
 // Returned arrays are read-only. The renderer supplies a revision for every
 // emitter-history mutation; live shader/camera projection still runs each frame.
 sampleReadOnly(graph,node,age,seed=1,options={}){
  if(age<this.age-1e-9||this.seed!==undefined&&seed!==this.seed)this.reset();
  const key=options.key??`${node.nodePath??node.path??'.'}:${node.properties?.process_material?.$ref??''}`;
  return this.readonlyFrames.sample(key,graph,node,age,seed,options,()=>this.sample(graph,node,age,seed,options));
 }
}
export { gradientSample as sampleGradient, curveSample as sampleCurve };
