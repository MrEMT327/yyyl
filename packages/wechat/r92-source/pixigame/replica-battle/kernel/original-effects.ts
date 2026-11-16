import { RESTORED_WEAPON_MODELS, admitParticleBirths } from '../weapon-visual-quality.js';
/** Original serialized particle parameters projected into the H5 XZ plane.
 * Burst timing, sprite frames, curves, transforms and blend modes come from APK.
 * Particle random streams, Unity 3D projection, exact damping/noise and custom shader
 * programs are not bit-equivalent. This is deliberately a rendering-only layer.
 */
type RecordData = Record<string, any>;
export interface EffectEmitterPose { age: number; x: number; z: number; angle: number; scale: number }
export interface OriginalEffectMotion {
  velocityX?: number; velocityZ?: number; projection?: 'xz' | 'xy';
  simulationSpeed?: number;
  emitterHistory?: EffectEmitterPose[];
  emitterCurrent?: Omit<EffectEmitterPose, 'age'>;
  /** Let already emitted world-space particles expire without reviving the projectile. */
  emissionStopAge?: number;
  worldParticlesOnly?: boolean;
}
export interface OriginalEffectSprite {
  key: string; x: number; z: number; width: number; height: number;
  rotation: number; alpha: number; tint: number; blend: 'normal' | 'add';
  order: number; originX: number; originY: number;
  /** Unity's positive sorting fudge pushes this transparent renderer backward. */
  sortBias?: number;
  crop?: { x: number; y: number; width: number; height: number };
  /** Gain is applied to RGB only, after texture sampling, before framebuffer blend. */
  tintGain?: number;
  layerId?: string;
  /** Coordinates are relative to the effect origin; UV uses PNG top-left origin. */
  mesh?: { vertices: Array<{x:number;z:number;u:number;v:number}>; indices:number[] };
}
const clamp = (n: number, a = 0, b = 1) => Math.max(a, Math.min(b, n));
function random(seed: number) {
  let n = seed | 0; n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b); return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
}
export function curve(keys: RecordData[] = [], t: number) {
  if (!keys.length) return 1;
  if (t <= keys[0].time) return keys[0].value;
  for (let i = 1; i < keys.length; i++) {
    const a = keys[i - 1], b = keys[i]; if (t > b.time) continue;
    const dt = b.time - a.time; if (!dt) return b.value;
    if (!Number.isFinite(a.outSlope) || !Number.isFinite(b.inSlope)) return a.value;
    let u = clamp((t - a.time) / dt);
    // Unity weighted tangents describe a cubic Bezier; solve its time axis.
    if ((a.weightedMode & 2) || (b.weightedMode & 1)) {
      const wa = a.weightedMode & 2 ? a.outWeight : 1 / 3, wb = b.weightedMode & 1 ? b.inWeight : 1 / 3;
      let lo = 0, hi = 1;
      for (let j = 0; j < 12; j++) {
        const q = (lo + hi) / 2, x = 3 * (1 - q) ** 2 * q * wa + 3 * (1 - q) * q * q * (1 - wb) + q ** 3;
        if (x < u) lo = q; else hi = q;
      }
      u = (lo + hi) / 2;
      return (1-u)**3*a.value + 3*(1-u)**2*u*(a.value+a.outSlope*dt*wa) + 3*(1-u)*u*u*(b.value-b.inSlope*dt*wb) + u**3*b.value;
    }
    return (2*u**3-3*u*u+1)*a.value + (u**3-2*u*u+u)*dt*a.outSlope + (-2*u**3+3*u*u)*b.value + (u**3-u*u)*dt*b.inSlope;
  }
  return keys[keys.length - 1].value;
}
function scalar(v: RecordData | undefined, t = 0, r = .5): number {
  if (!v) return 0;
  const max = Number(v.scalar ?? 0), min = Number(v.minScalar ?? max);
  if (v.minMaxState === 3) return min + (max - min) * r;
  if (v.minMaxState === 1) return max * curve(v.maxCurve?.m_Curve, t);
  if (v.minMaxState === 2) return min * curve(v.minCurve?.m_Curve, t) * (1-r) + max * curve(v.maxCurve?.m_Curve, t) * r;
  return max;
}
export function gradient(g: RecordData, t: number) {
  const out = { r: 1, g: 1, b: 1, a: 1 };
  for (const channel of ['r','g','b','a'] as const) {
    const alpha = channel === 'a', count = g[alpha ? 'm_NumAlphaKeys' : 'm_NumColorKeys'] || 0;
    const keys = Array.from({length:count}, (_,i) => ({ time:g[(alpha?'atime':'ctime')+i]/65535, value:g['key'+i][channel] }));
    if (!keys.length) continue;
    out[channel] = keys[keys.length - 1].value;
    for(let i=0;i<keys.length;i++) if(t<=keys[i].time){
      const a=keys[Math.max(0,i-1)],b=keys[i];const u=g.m_Mode===1?0:clamp((t-a.time)/(b.time-a.time||1));
      out[channel]=a.value+(b.value-a.value)*u;break;
    }
  }
  return out;
}
function color(v: RecordData, t: number, r: number): RecordData {
  if (!v) return {r:1,g:1,b:1,a:1};
  if (v.minMaxState === 1) return gradient(v.maxGradient, t);
  if (v.minMaxState === 2 || v.minMaxState === 3) {
    const a=v.minMaxState===2?v.minColor:gradient(v.minGradient,t),b=v.minMaxState===2?v.maxColor:gradient(v.maxGradient,t);
    return Object.fromEntries(['r','g','b','a'].map(k=>[k,a[k]+(b[k]-a[k])*r]));
  }
  if(v.minMaxState===4)return gradient(v.maxGradient,r);
  return v.maxColor || {r:1,g:1,b:1,a:1};
}
function transform(m: number[][], p: number[]) { return [0,1,2].map(i=>m[i][3]+m[i][0]*p[0]+m[i][1]*p[1]+m[i][2]*p[2]); }
function transformDirection(m: number[][], p: number[]) { return [0,1,2].map(i=>m[i][0]*p[0]+m[i][1]*p[1]+m[i][2]*p[2]); }
function integral(v: RecordData | undefined, age: number, life: number, r: number) {
  if(!v||age<=0)return 0;
  if(v.minMaxState===0||v.minMaxState===3)return scalar(v,0,r)*age;
  // Simpson integration preserves curved angular velocity instead of angle=lastSpeed*age.
  const n=16,h=age/n;let sum=scalar(v,0,r)+scalar(v,age/life,r);
  for(let i=1;i<n;i++)sum+=(i%2?4:2)*scalar(v,i*h/life,r);
  return sum*h/3;
}
function rotateEuler(p: number[], e: RecordData = {}) {
  let [x,y,z]=p;
  for(const axis of ['z','x','y']){
    const a=(e[axis]||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a);
    if(axis==='x')[y,z]=[y*c-z*s,y*s+z*c];
    else if(axis==='y')[x,z]=[x*c+z*s,-x*s+z*c];
    else [x,y]=[x*c-y*s,x*s+y*c];
  }
  return [x,y,z];
}
function shapeSample(s: RecordData | undefined, r: (n:number)=>number, burst?: {index:number;count:number}) {
  let p=[0,0,0],d=[0,0,1]; if(!s)return {p,d};
  let fraction = burst && s.arc?.mode === 3 ? burst.index / Math.max(1, burst.count) : r(1);
  if (s.arc?.spread > 0) fraction = Math.floor(fraction / s.arc.spread + 1e-6) * s.arc.spread;
  const a = fraction * (s.arc?.value ?? 360) * Math.PI / 180;
  const inner = 1 - clamp(s.radiusThickness ?? 1), outerRadius = s.radius?.value || 0;
  const radius=outerRadius*Math.sqrt(inner*inner+(1-inner*inner)*r(2));
  if(s.type===5){p=[r(3)-.5,r(4)-.5,r(5)-.5];}
  else if(s.type<=3){const z=s.type>=2?r(3):r(3)*2-1,k=Math.sqrt(1-z*z);d=[Math.cos(a)*k,Math.sin(a)*k,z];const volumeRadius=outerRadius*Math.cbrt(inner**3+(1-inner**3)*r(2));p=d.map(v=>v*volumeRadius);}
  else {
    p=[Math.cos(a)*radius,Math.sin(a)*radius,0];
    const angle=(s.type===10||s.type===11?90:(s.angle||0))*Math.PI/180;
    // Cone directions interpolate from the centre axis to the cone edge.
    const radial=s.type===10||s.type===11?1:(outerRadius>0?radius/outerRadius:0);
    const tangent=Math.tan(angle)*radial;
    const sin=s.type===10||s.type===11?1:tangent/Math.hypot(1,tangent),cos=s.type===10||s.type===11?0:1/Math.hypot(1,tangent);
    d=[Math.cos(a)*sin,Math.sin(a)*sin,cos];
    if(s.type===8||s.type===9){const depth=r(6)*(s.length||0);p=p.map((v,i)=>v+d[i]*depth/Math.max(1e-5,cos));}
  }
  p=p.map((v,i)=>v*(s.m_Scale?.[['x','y','z'][i]]??1));p=rotateEuler(p,s.m_Rotation).map((v,i)=>v+(s.m_Position?.[['x','y','z'][i]]||0));
  d=rotateEuler(d,s.m_Rotation);return {p,d};
}
function particleMotion(mods:RecordData, start:number[], velocity:number[], age:number, life:number, size:number, r:(n:number)=>number) {
  const lim=mods.ClampVelocityModule,force=mods.ForceModule,vm=mods.VelocityModule;
  if(!lim&&!force&&!vm)return {position:start.map((v,i)=>v+velocity[i]*age),velocity};
  const position=start.slice(),v=velocity.slice();let elapsed=0;
  // Deterministic numerical approximation. Native Unity's damping solver is not in the APK.
  // Use fixed 1/60 steps plus the remainder; never tie damping to H5 render frame rate.
  while(elapsed<age-1e-8){
    const dt=Math.min(1/60,age-elapsed),u=(elapsed+dt*.5)/life;
    for(let i=0;i<3;i++)if(force)v[i]+=scalar(force[['x','y','z'][i]],u,r(7+i))*dt;
    const extra=[0,1,2].map(i=>vm?scalar(vm[['x','y','z'][i]],u,r(6+i)):0);
    let current=v.map((x,i)=>x+extra[i]);
    if(lim){
      const speed=Math.hypot(...current),damp=1-Math.pow(1-clamp(lim.dampen||0),dt*60);
      if(lim.separateAxis){for(let i=0;i<3;i++){const limit=Math.max(0,scalar(lim[['x','y','z'][i]],u,r(20+i)));if(Math.abs(current[i])>limit)current[i]=Math.sign(current[i])*(Math.abs(current[i])-(Math.abs(current[i])-limit)*damp);}}
      else {const limit=Math.max(0,scalar(lim.magnitude,u,r(20)));if(speed>limit&&speed>0){const factor=(speed-(speed-limit)*damp)/speed;current=current.map(x=>x*factor);}}
      let drag=Math.max(0,scalar(lim.drag,u,r(21)));
      if(lim.multiplyDragByParticleSize)drag*=Math.abs(size);
      if(lim.multiplyDragByParticleVelocity)drag*=Math.hypot(...current);
      current=current.map(x=>x*Math.max(0,1-drag*dt));
      for(let i=0;i<3;i++)v[i]=current[i]-extra[i];
    }
    const speedModifier=vm?.speedModifier?scalar(vm.speedModifier,u,r(25)):1;
    for(let i=0;i<3;i++)position[i]+=current[i]*dt*speedModifier;
    if(vm){
      const center=['X','Y','Z'].map((axis,i)=>scalar(vm['orbitalOffset'+axis],u,r(30+i)));
      let relative=position.map((value,i)=>value-center[i]);
      const distance=Math.hypot(...relative),radial=scalar(vm.radial,u,r(26))*dt*speedModifier;
      if(distance>1e-8)relative=relative.map(value=>value*(1+radial/distance));
      // Orbital curves are angular speed, not additional linear XYZ velocity.
      relative=rotateEuler(relative,Object.fromEntries(['x','y','z'].map((axis,i)=>[axis,scalar(vm['orbital'+axis.toUpperCase()],u,r(27+i))*dt*speedModifier*180/Math.PI])));
      for(let i=0;i<3;i++)position[i]=center[i]+relative[i];
    }
    elapsed+=dt;
  }
  const extra=[0,1,2].map(i=>vm?scalar(vm[['x','y','z'][i]],age/life,r(6+i)):0);
  return {position,velocity:v.map((x,i)=>x+extra[i])};
}
export function originalEffectDuration(data: RecordData, id: number): number {
  const e=data.effects?.[id];if(!e)return 0;let end=0;
  for(const s of e.sequences||[])end=Math.max(end,s.delay+s.frames.length/s.fps);
  for(const l of e.layers||[]){if(l.loop)return Infinity;const m=l.modules,i=m.InitialModule;
    const life=scalarUpperBound(i.startLifetime);
    const bursts=m.EmissionModule?.m_Bursts||[];
    const last=Math.max(scalar(m.EmissionModule?.rateOverTime)>0?l.duration:0,...bursts.map((b:RecordData)=>b.time+Math.max(0,b.cycleCount-1)*b.repeatInterval));
    end=Math.max(end,(scalar(l.delay)+last+life)/(l.simulationSpeed||1));
  }return end;
}
/** Convex-hull bound also covers weighted-curve overshoot between the keys. */
function scalarUpperBound(v: RecordData | undefined): number {
  if(!v)return 0;
  if(v.minMaxState===0)return Math.max(0,Number(v.scalar)||0);
  if(v.minMaxState===3)return Math.max(0,Number(v.scalar)||0,Number(v.minScalar)||0);
  const bound=(data:RecordData|undefined,multiplier:number)=>{
    const keys:RecordData[]=data?.m_Curve||[];if(!keys.length)return Math.max(0,multiplier);
    const values=keys.map(key=>key.value*multiplier);
    for(let i=1;i<keys.length;i++){
      const a=keys[i-1],b=keys[i],dt=b.time-a.time;
      if(Number.isFinite(a.outSlope))values.push((a.value+a.outSlope*dt*(a.weightedMode&2?a.outWeight:1/3))*multiplier);
      if(Number.isFinite(b.inSlope))values.push((b.value-b.inSlope*dt*(b.weightedMode&1?b.inWeight:1/3))*multiplier);
    }
    return Math.max(0,...values);
  };
  return Math.max(bound(v.maxCurve,Number(v.scalar)||0),v.minMaxState===2?bound(v.minCurve,Number(v.minScalar??v.scalar)||0):0);
}
export function originalEffectHistoryDuration(data: RecordData, id: number | string): number {
  return Math.max(0,...(data.effects?.[id]?.layers||[]).filter((layer:RecordData)=>layer.moveWithTransform===1)
    .map((layer:RecordData)=>scalarUpperBound(layer.modules.InitialModule.startLifetime)/(layer.simulationSpeed||1)));
}
function emitterPose(history: EffectEmitterPose[], age:number): EffectEmitterPose {
  if(age<=history[0].age)return history[0];
  for(let i=1;i<history.length;i++)if(age<=history[i].age){
    const a=history[i-1],b=history[i],u=clamp((age-a.age)/(b.age-a.age||1));
    const angleDelta=Math.atan2(Math.sin(b.angle-a.angle),Math.cos(b.angle-a.angle));
    return {age,x:a.x+(b.x-a.x)*u,z:a.z+(b.z-a.z)*u,scale:a.scale+(b.scale-a.scale)*u,angle:a.angle+angleDelta*u};
  }
  return history[history.length-1];
}
export function sampleOriginalEffect(data: RecordData, id: number | string, age: number, seed = 1, motion: OriginalEffectMotion = {}): OriginalEffectSprite[] {
  const e=data.effects?.[id];if(!e||age<0)return [];const out:OriginalEffectSprite[]=[];
  const vertical = motion.projection === 'xy' ? 1 : 2;
  for(const s of motion.worldParticlesOnly ? [] : e.sequences||[]){
    const count=s.frames.length;if(!count||s.active===false)continue;
    let frame=Math.floor((age-s.delay)*s.fps);if(frame<0)continue;if(s.loop)frame%=count;
    if(frame>=count)continue;const key=s.frames[frame],tex=data.textures[key];if(!tex)continue;
    const m=s.matrix,sx=Math.hypot(m[0][0],m[1][0],m[2][0]),sy=Math.hypot(m[0][1],m[1][1],m[2][1]);
    const color=s.color||{r:1,g:1,b:1,a:1},gain=Math.max(1,color.r,color.g,color.b),byte=(v:number)=>Math.round(clamp(v/gain)*255);
    out.push({key,x:m[0][3],z:m[vertical][3],width:tex.width/tex.ppu*sx,height:tex.height/tex.ppu*sy,rotation:0,alpha:clamp(color.a),tint:(byte(color.r)<<16)|(byte(color.g)<<8)|byte(color.b),tintGain:gain,blend:'normal',order:s.sortingOrder||0,originX:tex.pivot.x,originY:1-tex.pivot.y});
  }
  // MeshRenderer children do not have a ParticleSystem. Preserve their actual
  // prefab transform, mesh UV and material instead of manufacturing a sprite.
  for (const layer of motion.worldParticlesOnly ? [] : e.staticMeshes || []) {
    if (layer.active === false) continue;
    const mesh = data.meshes?.[layer.meshKey], mat = layer.materials?.[0];
    const st = mat?.textures?.find((entry: RecordData) => entry.slot === '_MainTex');
    if (!mesh || !st || !data.textures[st.key]) continue;
    const tint = mat.colors?._TintColor || { r: 1, g: 1, b: 1, a: 1 };
    // Original WingR uses the built-in Legacy Particles/Additive shader:
    // 2 * vertexColor * _TintColor * texture, SrcAlpha One blending.
    const gain = mat.shaderName === 'Legacy Shaders/Particles/Additive' ? 2 : 1;
    const maximum = Math.max(1, tint.r * gain, tint.g * gain, tint.b * gain);
    const byte = (v: number) => Math.round(clamp(v * gain / maximum) * 255);
    out.push({ key: st.key, x: 0, z: 0, width: 0, height: 0, rotation: 0,
      alpha: clamp(tint.a * gain), tint: (byte(tint.r) << 16) | (byte(tint.g) << 8) | byte(tint.b), tintGain: maximum,
      blend: mat.blend, order: layer.sortingOrder || 0, originX: .5, originY: .5,
      mesh: { indices: mesh.indices, vertices: mesh.vertices.map((vertex: number[], index: number) => {
        const point = transform(layer.matrix, vertex), uv = mesh.uv[index] || [0, 0];
        return { x: point[0], z: point[vertical], u: uv[0] * (st.scale?.x ?? 1) + (st.offset?.x || 0),
          v: 1 - (uv[1] * (st.scale?.y ?? 1) + (st.offset?.y || 0)) };
      }) }, layerId: `mesh:${layer.id}` });
  }
  for(let li=0;li<(e.layers||[]).length;li++){
    const l=e.layers[li],mods=l.modules,initial=mods.InitialModule,em=mods.EmissionModule,mat=l.materials[0];
    if(motion.worldParticlesOnly && l.moveWithTransform!==1)continue;
    const key=mat?.textures?.find((x:RecordData)=>x.slot==='_MainTex')?.key,tex=data.textures[key];if(!tex)continue;
    const time=age*(motion.simulationSpeed ?? l.simulationSpeed ?? 1)-scalar(l.delay),duration=Math.max(.00001,l.duration);if(time<0)continue;
    const maxLife=scalarUpperBound(initial.startLifetime), births:Array<{at:number;n:number;index?:number;count?:number}>=[];
    const particleLimit=RESTORED_WEAPON_MODELS.has(Number(id)) && Number.isFinite(initial.maxNumParticles) ? initial.maxNumParticles : Infinity;
    const bounded=Number.isFinite(particleLimit);
    const minCycle=l.loop&&!bounded?Math.max(0,Math.floor((time-maxLife)/duration)):0,maxCycle=l.loop?Math.floor(time/duration):0;
    for(let cycle=minCycle;cycle<=maxCycle;cycle++){
      const base=cycle*duration;
      for(let bi=0;bi<(em.m_Bursts||[]).length;bi++){
        const b=em.m_Bursts[bi];for(let repeat=0;repeat<Math.max(1,b.cycleCount);repeat++){
          const at=base+b.time+repeat*b.repeatInterval;if(at>time||(!bounded&&time-at>maxLife))continue;
          if(random(seed+li*171+bi*379+repeat*13+cycle*511)>b.probability)continue;
          const count=Math.round(scalar(b.countCurve,0,random(seed+bi+cycle*163)));
          for(let n=0;n<count;n++)births.push({at,n:cycle*100000+bi*1000+repeat*100+n,index:n,count});
        }
      }
      const rate=scalar(em.rateOverTime);if(rate>0){const from=bounded?0:Math.max(0,Math.ceil((time-maxLife-base)*rate)),to=Math.floor(Math.min(duration,time-base)*rate);
        for(let n=from;n<=to;n++)births.push({at:base+n/rate,n:cycle*100000+n+50000});}
    }
    const stop=motion.emissionStopAge===undefined?Infinity:motion.emissionStopAge*(motion.simulationSpeed??l.simulationSpeed??1)-scalar(l.delay);
    const admitted=admitParticleBirths(births.filter(birth=>birth.at<=stop),particleLimit,birth=>scalar(initial.startLifetime,0,random(seed+li*31991+birth.n*101+77)));
    for(const birth of admitted){
      const r=(n:number)=>random(seed+li*31991+birth.n*101+n*77),life=scalar(initial.startLifetime,0,r(1)),t=time-birth.at;if(life<=0||t<0||t>=life)continue;
      const u=t/life,c=color(initial.startColor,0,r(3)),over=mods.ColorModule?color(mods.ColorModule.gradient,u,r(4)):{r:1,g:1,b:1,a:1};
      // Effects/Particle reads _TintColor. Hovl reads _Color and _Emission instead;
      // the exact two chapter materials have white auxiliary textures, no UV flow,
      // and centre-glow disabled (see chapter-particle-shader evidence).
      const mobile=mat.shaderName==='Mobile/Particles/Additive',legacy=mat.shaderName==='Legacy Shaders/Particles/Additive';
      const hovlAdd=mat.shaderPathId==='-6061337258569108267',hovlBlend=mat.shaderPathId==='-8030552132419720960';
      const mc=(mobile?null:mat.colors?.[hovlAdd||hovlBlend?'_Color':'_TintColor'])||{r:1,g:1,b:1,a:1};
      const channel=(name:string)=>(mobile?clamp(c[name]*over[name]):c[name]*over[name])*mc[name]*(legacy?2:1)*(name==='a'?(hovlBlend?(mat.floats?._Opacity??1):1):(hovlAdd||hovlBlend?(mat.floats?._Emission??2):1));
      const alpha=clamp(channel('a'));if(alpha<=0)continue;
      const ss=shapeSample(mods.ShapeModule,n=>r(n+100),birth.count?{index:birth.index??0,count:birth.count}:undefined),speed=scalar(initial.startSpeed,0,r(5));
      const move=particleMotion(mods,ss.p,ss.d.map(v=>v*speed),t,life,scalar(initial.startSize,0,r(9)),r);
      const pos=move.position,p=transform(l.matrix,pos),sx=Math.hypot(l.matrix[0][0],l.matrix[1][0],l.matrix[2][0]),sy=Math.hypot(l.matrix[0][1],l.matrix[1][1],l.matrix[2][1]);
      const sz=mods.SizeModule,size=sz?scalar(sz.curve,u,r(8)):1,ys=sz?.separateAxes?scalar(sz.y,u,r(8)):size;
      const width=scalar(initial.startSize,0,r(9))*size*sx,height=scalar(initial.size3D?initial.startSizeY:initial.startSize,0,r(9))*ys*sy;
      let rotation=scalar(initial.startRotation,0,r(10));if(mods.RotationModule)rotation+=integral(mods.RotationModule.curve,t,life,r(11));
      const tintGain=Math.max(1,...['r','g','b'].map(channel));
      const colorByte=(name:string)=>Math.round(clamp(channel(name)/tintGain)*255);
      const pivot=l.renderer.m_Pivot||{x:0,y:0};
      const item:OriginalEffectSprite={key,x:p[0],z:p[vertical],width,height,rotation:-rotation,alpha,tint:(colorByte('r')<<16)|(colorByte('g')<<8)|colorByte('b'),tintGain,blend:mat.blend,order:l.renderer.m_SortingOrder||0,originX:.5+(pivot.x||0),originY:.5-(pivot.y||0)};
      if(hovlAdd)item.blend='add';else if(hovlBlend)item.blend='normal';
      item.sortBias=-(l.renderer.m_SortingFudge||0);
      if(l.renderer.m_RenderMode===1){
        const v=transformDirection(l.matrix,move.velocity),projectedSpeed=Math.hypot(v[0],v[vertical]);
        // Unity length scale is signed (the original explosion sparks use -1).
        const length=height*(l.renderer.m_LengthScale??1)+projectedSpeed*(l.renderer.m_VelocityScale||0);
        item.height=Math.abs(length);
        if(projectedSpeed>1e-8)item.rotation=Math.atan2(v[0],v[vertical])+(length<0?Math.PI:0);
      }
      const uv=mods.UVModule;if(uv){
        const cols=uv.tilesX||1,rows=uv.tilesY||1,total=uv.animationType===1?cols:cols*rows;
        let progress=u;
        if(uv.timeMode===1){const range=uv.speedRange||{x:0,y:1};progress=clamp((Math.hypot(...move.velocity)-(range.x||0))/((range.y??1)-(range.x||0)||1));}
        // FPS is elapsed particle time, independent of the 99s flying-sword lifetime.
        const advance=uv.timeMode===2?t*(uv.fps||0):scalar(uv.frameOverTime,progress,r(13))*(uv.cycles??1)*total;
        let f=Math.floor(scalar(uv.startFrame,0,r(12))*total+advance);f=((f%total)+total)%total;
        if(uv.animationType===1)f+=cols*(uv.rowMode===1?Math.floor(r(18)*rows):Math.max(0,Math.min(rows-1,uv.rowIndex||0)));
        item.crop={x:(f%cols)*tex.width/cols,y:Math.floor(f/cols)*tex.height/rows,width:tex.width/cols,height:tex.height/rows};
      }
      const localQuad=l.renderer.m_RenderMode===0&&l.renderer.m_RenderAlignment===2&&initial.rotation3D;
      if(l.renderer.m_RenderMode===4||localQuad){
        const mesh=localQuad?{vertices:[[-.5,-.5,0],[.5,-.5,0],[.5,.5,0],[-.5,.5,0]],uv:[[0,0],[1,0],[1,1],[0,1]],indices:[0,1,2,0,2,3]}:data.meshes?.[l.renderer.meshKey];if(!mesh)continue;
        const rot=mods.RotationModule,angles={x:initial.rotation3D?scalar(initial.startRotationX,0,r(14)):0,y:initial.rotation3D?scalar(initial.startRotationY,0,r(15)):0,z:rotation};
        if(rot?.separateAxes){angles.x+=integral(rot.x,t,life,r(16));angles.y+=integral(rot.y,t,life,r(17));}
        const sizes=[scalar(initial.startSize,0,r(9))*size,scalar(initial.size3D?initial.startSizeY:initial.startSize,0,r(9))*ys,scalar(initial.size3D?initial.startSizeZ:initial.startSize,0,r(9))*(sz?.separateAxes?scalar(sz.z,u,r(8)):size)];
        const st=mat.textures.find((x:RecordData)=>x.slot==='_MainTex');
        item.mesh={indices:mesh.indices,vertices:mesh.vertices.map((vertex:number[],index:number)=>{
          let v=rotateEuler(vertex.map((value,i)=>(value-(pivot[['x','y','z'][i]]||0))*sizes[i]),{x:angles.x*180/Math.PI,y:angles.y*180/Math.PI,z:angles.z*180/Math.PI});
          v=transform(l.matrix,v.map((value,i)=>value+pos[i]));
          const coord=mesh.uv[index]||[0,0];let tx=coord[0],ty=1-coord[1];
          if(item.crop){tx=(item.crop.x+tx*item.crop.width)/tex.width;ty=(item.crop.y+ty*item.crop.height)/tex.height;}
          tx=tx*(st?.scale.x??1)+(st?.offset.x||0);ty=1-((1-ty)*(st?.scale.y??1)+(st?.offset.y||0));
          return {x:v[0],z:v[vertical],u:tx,v:ty};
        })};
      }
      if(l.moveWithTransform===1){
        const current=motion.emitterCurrent,history=motion.emitterHistory;
        if(current&&history?.length){
          const born=emitterPose(history,(birth.at+scalar(l.delay))/(l.simulationSpeed||1));
          const bc=Math.cos(born.angle),bs=Math.sin(born.angle),cc=Math.cos(current.angle),cs=Math.sin(current.angle),scale=current.scale||1;
          const toCurrent=(x:number,z:number)=>{
            const dx=born.x+(x*bc+z*bs)*born.scale-current.x,dz=born.z+(-x*bs+z*bc)*born.scale-current.z;
            return {x:(dx*cc-dz*cs)/scale,z:(dx*cs+dz*cc)/scale};
          };
          Object.assign(item,toCurrent(item.x,item.z));
          item.width*=born.scale/scale;item.height*=born.scale/scale;
          // Sprite rotation is a clockwise screen rotation; renderer adds root.angle.
          item.rotation+=born.angle-current.angle;
          if(item.mesh)for(const vertex of item.mesh.vertices)Object.assign(vertex,toCurrent(vertex.x,vertex.z));
        }else{
          const dx=(motion.velocityX||0)*t/(l.simulationSpeed||1),dz=(motion.velocityZ||0)*t/(l.simulationSpeed||1);
          item.x-=dx;item.z-=dz;
          if(item.mesh)for(const vertex of item.mesh.vertices){vertex.x-=dx;vertex.z-=dz;}
        }
      }
      // View-aligned billboards keep their camera-facing angle while the emitter
      // turns. Their spawn/motion positions still follow the declared space.
      if(l.renderer.m_RenderMode===0&&l.renderer.m_RenderAlignment===0&&motion.emitterCurrent&&!item.mesh)item.rotation=-rotation-motion.emitterCurrent.angle;
      item.layerId = String(l.id);
      out.push(item);
    }
  }
  return out.sort((a,b)=>a.order-b.order||(a.sortBias||0)-(b.sortBias||0));
}
