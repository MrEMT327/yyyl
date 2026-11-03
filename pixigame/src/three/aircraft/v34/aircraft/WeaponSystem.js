import * as T from 'three';
import {WeaponTimeline} from './WeaponTimeline.js';
const MISSILES=new Set(['missile','rocket','interceptor']);
const BEAMS=new Set(['laser','laserLance','laserRapid','judgement','prism','array','opticDrone','rail']);
const clamp=x=>Math.max(0,Math.min(1,x));
const FORWARD=new T.Vector3(0,0,-1);
function ramp(a,b,x){const t=clamp((x-a)/(b-a));return t*t*(3-2*t);}
/** Rendering adapter for the saved V38 arsenal. Physics data lives in
 * WeaponTimeline/shot records; transient effect meshes are pooled and reused.
 * Missile birth transforms are captured, so shots do NOT follow a moving wing.
 */
export class WeaponSystem{
 constructor(fighter,definition){
  this.fighter=fighter;this.definition=definition;this.timeline=new WeaponTimeline(definition.weapons);this.config=fighter.config;
  this.geometries=new Set();this.materials=new Set();this.textures=new Set();this.disposed=false;
  this.root=new T.Group();this.root.name='V38/WeaponWorldFX';fighter.group.add(this.root);
  this.attachedRoot=new T.Group();this.attachedRoot.name='V38/DeploymentFX';fighter.ship.add(this.attachedRoot);
  this._p=new T.Vector3();this._q=new T.Quaternion();this._q2=new T.Quaternion();this._dir=new T.Vector3();this._inverse=new T.Matrix4();
  this._geo={};this._mat={};this.radial=this._radial();this.lastTime=null;this.renderedShots=0;
  this.channels=definition.weapons.map((spec,index)=>this._channel(spec,index));
  this.charged=(definition.chargeMaterials||[]).map(id=>fighter.asset.materials.get(id)).filter(Boolean);
  this.bladeMaterials=(definition.bladeMaterials||[]).map(id=>fighter.asset.materials.get(id)).filter(Boolean);
  this.blades=(definition.blades||[]).map((spec,i)=>this._blade(spec,i));
  this.focusKnot=null;
  if(definition.weapons.some(w=>w.converge)){
   const point=definition.weapons.find(w=>w.converge).converge,group=new T.Group();group.position.fromArray(point);group.visible=false;this.attachedRoot.add(group);
   const optical=this.mesh(this.geometry('convergence-crystal',()=>new T.OctahedronGeometry(.13,0)),this.material('convergence-core','#f5eaff',.85),group);
   const orbit=this.mesh(this.geometry('convergence-orbit',()=>new T.TorusGeometry(.32,.010,6,4)),this.material('convergence-ring',definition.color,.6),group);this.focusKnot={root:group,optical,orbit};
  }
  this.rings=Array.from({length:3},(_,i)=>{
   const m=this.material('deploy-ring-'+i,definition.color,.3),mesh=this.mesh(this.geometry('deployment-ring',()=>new T.TorusGeometry(1,.006,6,96)),m,this.attachedRoot);
   mesh.rotation.x=Math.PI/2;mesh.visible=false;return mesh;
  });
  const data=new Float32Array(48*3),g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(data,3));this.geometries.add(g);
  const pm=new T.PointsMaterial({map:this.radial,color:definition.color,size:.12,transparent:true,opacity:.65,blending:T.AdditiveBlending,depthWrite:false,sizeAttenuation:true});this.materials.add(pm);
  this.sparks=new T.Points(g,pm);this.sparks.frustumCulled=false;this.sparks.layers.set(1);this.sparks.userData.triangleCategory='vfx';this.attachedRoot.add(this.sparks);this.sparks.visible=false;
 }
 geometry(key,create){if(!this._geo[key]){this._geo[key]=create();this.geometries.add(this._geo[key]);}return this._geo[key];}
 material(key,color,opacity=1){
  if(!this._mat[key]){const m=new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide,toneMapped:false});this.materials.add(m);this._mat[key]=m;}return this._mat[key];
 }
 mesh(g,m,parent){const o=new T.Mesh(g,m);o.layers.set(1);o.userData.triangleCategory='vfx';o.frustumCulled=false;(parent||this.root).add(o);return o;}
 _radial(){const size=48,a=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const r=Math.hypot((x+.5)/size*2-1,(y+.5)/size*2-1),v=Math.pow(Math.max(0,1-r),2);const i=(y*size+x)*4;a[i]=a[i+1]=a[i+2]=255;a[i+3]=Math.round(v*255);
 }const t=new T.DataTexture(a,size,size);t.needsUpdate=true;this.textures.add(t);return t;}
 sprite(color,parent,size=.5){const m=new T.SpriteMaterial({color,map:this.radial,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});this.materials.add(m);const s=new T.Sprite(m);s.layers.set(1);s.scale.setScalar(size);parent.add(s);return s;}
 _channel(spec,index){
  const node=this.fighter.asset.nodes.get(spec.node);if(!node)throw new Error('V38 weapon socket missing: '+spec.id);
  const c={spec,index,node,pool:[],nextPool:0,beam:null,loaded:null};
  const group=new T.Group();group.name='V38/Muzzle/'+spec.id;group.visible=false;this.root.add(group);c.muzzle=group;
  c.glint=this.sprite(spec.color||this.definition.color,group,.46);
  const ring=this.mesh(this.geometry('muzzle-ring',()=>new T.TorusGeometry(1,.025,6,32)),this.material('ring-'+index,spec.color||this.definition.color,.4),group);ring.scale.setScalar(.15);c.ring=ring;
  if(BEAMS.has(spec.kind)){
   const beam=new T.Group();beam.name='V38/Beam/'+spec.id;this.root.add(beam);beam.visible=false;
   const geometry=this.geometry('beam',()=>{const g=new T.CylinderGeometry(1,1,1,12);g.rotateX(Math.PI/2);g.translate(0,0,-.5);return g;});
   c.beam={root:beam,outer:this.mesh(geometry,this.material('beam-'+index,spec.color||this.definition.color,.38),beam),inner:this.mesh(geometry,this.material('core-'+index,'#f5faff',.88),beam)};
  }
  if(MISSILES.has(spec.kind)){
   c.loaded=this.fighter.asset.nodes.get(spec.source?.node);if(!c.loaded)throw new Error('V38 missile solid missing: '+spec.id);
   c.pool.push(this._shotObject(c,true));
  }else if(!BEAMS.has(spec.kind))for(let i=0;i<(spec.kind==='autocannon'?9:4);i++)c.pool.push(this._shotObject(c,false));
  return c;
 }
 _shotObject(channel,missile){
  const spec=channel.spec,root=new T.Group();root.name='V38/Shot/'+spec.id;root.visible=false;this.root.add(root);
  const color=spec.color||this.definition.color;
  let body,tail,trail,smoke,material;
  if(missile){
   body=channel.loaded.clone(true);body.visible=true;body.position.set(0,0,0);body.quaternion.identity();body.scale.set(1,1,1);body.traverse(n=>{if(n.isMesh){n.castShadow=false;n.receiveShadow=false;n.userData={triangleCategory:'vfx'};}});root.add(body);
   const flameG=this.geometry('missile-flame',()=>{const g=new T.ConeGeometry(1,1,16);g.rotateX(Math.PI/2);g.translate(0,0,.5);return g;});
   tail=this.mesh(flameG,this.material('flame-'+channel.index,color,.75),root);tail.position.z=(spec.length||1)*.48;tail.scale.set(.09,.09,.65);
   const tg=new T.BufferGeometry();tg.setAttribute('position',new T.BufferAttribute(new Float32Array(20*3),3));this.geometries.add(tg);
   material=new T.LineBasicMaterial({color,transparent:true,opacity:.65,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});this.materials.add(material);
   trail=new T.Line(tg,material);trail.layers.set(1);trail.frustumCulled=false;trail.visible=false;this.root.add(trail);
   const sg=new T.BufferGeometry();sg.setAttribute('position',new T.BufferAttribute(new Float32Array(14*3),3));this.geometries.add(sg);
   const sm=new T.PointsMaterial({map:this.radial,color:'#a7b0ba',size:.28,transparent:true,opacity:.22,depthWrite:false,sizeAttenuation:true});this.materials.add(sm);
   smoke=new T.Points(sg,sm);smoke.layers.set(1);smoke.frustumCulled=false;smoke.visible=false;this.root.add(smoke);
  }else if(spec.kind==='pulse'||spec.kind==='pulseDrone'){
   body=this.mesh(this.geometry('pulse',()=>new T.TorusGeometry(1,.055,8,40)),this.material('pulse-'+channel.index,color,.8),root);
   const core=this.mesh(this.geometry('orb',()=>new T.SphereGeometry(1,12,8)),this.material('orb-'+channel.index,'#e0ffff',.55),root);core.scale.setScalar(.08);root.userData.core=core;
  }else{
   body=this.mesh(this.geometry('slug',()=>new T.SphereGeometry(1,12,8)),this.material('slug-'+channel.index,color,.9),root);body.scale.set(spec.kind==='siege'?.14:.045,spec.kind==='siege'?.14:.045,spec.kind==='siege'?.48:.27);
  }
  return {root,body,tail,trail,smoke,born:-Infinity,origin:new T.Vector3(),direction:new T.Vector3(),right:new T.Vector3(),up:new T.Vector3(),quaternion:new T.Quaternion(),lifetime:missile?1.55:(spec.kind==='siege'?1.15:1),spec};
 }
 _blade(spec,i){
  const node=this.fighter.asset.nodes.get(spec.node);if(!node)throw new Error('Missing blade anchor');
  const g=new T.Group();g.name='V38/CuttingWing/'+i;this.attachedRoot.add(g);
  const curve=new T.CatmullRomCurve3(spec.points.map(p=>new T.Vector3(...p)));
  const geometry=new T.TubeGeometry(curve,80,spec.width||.055,6,false);this.geometries.add(geometry);
  const material=this.material('blade-field-'+i,spec.color,.6),mesh=this.mesh(geometry,material,g);
  const points=[],indices=[];const sign=Math.sign(spec.points.at(-1)[0]);
  for(let n=0;n<=60;n++){const p=curve.getPoint(n/60),w=Math.sin(n/60*Math.PI)*.32+.04;points.push(p.x,p.y,p.z,p.x+sign*w,p.y+.055,p.z-.10);if(n<60){const k=n*2;indices.push(k,k+1,k+2,k+1,k+3,k+2);}}
  const sheetGeo=new T.BufferGeometry();sheetGeo.setAttribute('position',new T.Float32BufferAttribute(points,3));sheetGeo.setIndex(indices);sheetGeo.computeVertexNormals();this.geometries.add(sheetGeo);
  const sheet=this.mesh(sheetGeo,this.material('blade-sheet-'+i,spec.color,.18),g);
  return {node,root:g,mesh,sheet};
 }
 _socket(c){
  c.node.updateWorldMatrix(true,false);this.fighter.group.updateWorldMatrix(true,false);
  this._inverse.copy(this.fighter.group.matrixWorld).invert();this._p.setFromMatrixPosition(c.node.matrixWorld).applyMatrix4(this._inverse);
  this.fighter.group.getWorldQuaternion(this._q2).invert();c.node.getWorldQuaternion(this._q);this._q.premultiply(this._q2);
  return this._p;
 }
 _spawn(c,event){
  if(!c.pool.length)return;
  const shot=c.pool[c.nextPool++%c.pool.length];shot.born=event.time;
  if(c.loaded){
   c.loaded.updateWorldMatrix(true,false);this._inverse.copy(this.fighter.group.matrixWorld).invert();shot.origin.setFromMatrixPosition(c.loaded.matrixWorld).applyMatrix4(this._inverse);
   c.loaded.getWorldQuaternion(shot.quaternion);this.fighter.group.getWorldQuaternion(this._q2).invert();shot.quaternion.premultiply(this._q2);
  }else {this._socket(c);shot.origin.copy(this._p);shot.quaternion.copy(this._q);}
  if(c.loaded){c.loaded.getWorldScale(shot.root.scale);this.fighter.group.getWorldScale(this._p);shot.root.scale.divide(this._p);}else shot.root.scale.setScalar(this.config.scale||1);
  shot.direction.copy(FORWARD).applyQuaternion(shot.quaternion);shot.right.set(1,0,0).applyQuaternion(shot.quaternion);shot.up.set(0,1,0).applyQuaternion(shot.quaternion);
  this.renderedShots++;
 }
 _trajectory(shot,age,out){
  const missile=MISSILES.has(shot.spec.kind),s=shot.spec;
  if(missile){
   const thrust=Math.max(0,age-.14),distance=age*1.7+thrust*thrust*16;
   out.copy(shot.origin).addScaledVector(shot.direction,distance).addScaledVector(shot.up,-(s.launchDrop||0)*ramp(0,.24,age)+Math.sin(age*1.8)*.18);
   out.addScaledVector(shot.right,(s.side||1)*thrust*thrust*(s.kind==='interceptor'?1.8:.58));
  }else out.copy(shot.origin).addScaledVector(shot.direction,age*(s.kind==='siege'?27:s.kind==='autocannon'?40:17));
  return out;
 }
 update(time){
  if(this.disposed)return;
  if(this.lastTime!==null&&time<this.lastTime-1e-6)this.clear();this.lastTime=time;
  const cfg=this.config,rig=this.fighter.deployment,ready=rig.progress>=.985&&Boolean(cfg.deployed),gain=Math.max(0,Math.min(2,cfg.weaponEffectScale??1))*(cfg.weaponGlow??1)*(this.fighter.globals.glow??1);
  const fireFxEnabled=cfg.weaponFireEffects===true;
  const events=this.timeline.step(time,{ready,firing:fireFxEnabled&&cfg.firing});if(fireFxEnabled)for(const event of events)this._spawn(this.channels[event.index],event);
  const live=fireFxEnabled&&this.timeline.enabled;
  for(const m of this.charged)m.emissiveIntensity=gain*(.08+rig.progress*.48+(live?.32:0));
  for(const m of this.bladeMaterials)m.emissiveIntensity=gain*rig.progress*.8;
  for(let i=0;i<this.channels.length;i++){
   const c=this.channels[i],spec=c.spec,age=time-this.timeline.channels[i].last;
   this._socket(c);c.muzzle.position.copy(this._p);c.muzzle.quaternion.copy(this._q);
   let envelope=0,charge=0;
   if(live&&Number.isFinite(age)){
    if(spec.kind==='rail'){charge=age<.16?1-age/.16:0;envelope=age<.14?Math.sin(clamp(age/.14)*Math.PI):0;}
    else if(spec.kind==='laserRapid'){envelope=age<.14?1-ramp(.04,.14,age):0;charge=envelope;}
    else if(BEAMS.has(spec.kind)){
     const warm=spec.kind==='prism'?.53:spec.kind==='array'?.40:spec.kind==='opticDrone'?.14:.37;
     const hold=spec.kind==='laserLance'?1.12:spec.kind==='judgement'?1.08:spec.kind==='opticDrone'?.42:1.0;
     charge=age<warm?ramp(0,warm,age):1-ramp(hold,hold+.20,age);
     envelope=ramp(warm,warm+.06,age)*(1-ramp(hold,hold+.20,age));
    }else charge=age<.16?1-age/.16:0;
   }
   const deployCharge=ready?.09:(rig.progress>.5?Math.sin(rig.progress*Math.PI)*.15:0);
   c.muzzle.visible=fireFxEnabled&&gain>0&&(charge>0||deployCharge>0);
   c.glint.material.opacity=(charge*.9+deployCharge)*gain;c.glint.scale.setScalar((spec.radius||.08)*5.5+.13+charge*.18);
   c.ring.material.opacity=(charge*.55+deployCharge*.6)*gain;c.ring.scale.setScalar((spec.radius||.1)*1.7+charge*.18);c.ring.rotation.z=time*.6;
   if(c.beam){
    c.beam.root.visible=fireFxEnabled&&envelope>.001&&gain>0;c.beam.root.position.copy(this._p);
    this._dir.copy(FORWARD).applyQuaternion(this._q);let length=spec.beamLength||17;
    if(spec.converge){const end=new T.Vector3(...spec.converge);this.fighter.ship.localToWorld(end);this.fighter.group.worldToLocal(end);this._dir.subVectors(end,this._p);length=this._dir.length();this._dir.normalize();}
    c.beam.root.quaternion.setFromUnitVectors(FORWARD,this._dir);
    const width=(spec.beamWidth||.055)*(spec.kind==='prism'?1.7:1)*(1+Math.sin(time*33+i)*.045);
    c.beam.outer.scale.set(width,width,length);c.beam.inner.scale.set(width*.25,width*.25,length);
    c.beam.outer.material.opacity=envelope*.34*gain;c.beam.inner.material.opacity=envelope*.91*gain;
   }
   if(c.loaded)c.loaded.visible=!live||!Number.isFinite(age)||age>Math.min(2.5,(spec.cycle||4)*.67);
   for(const shot of c.pool){
    const age=time-shot.born,visible=age>=0&&age<shot.lifetime&&gain>0;
    shot.root.visible=visible;if(shot.trail)shot.trail.visible=visible&&age>.14;if(shot.smoke)shot.smoke.visible=visible&&age>.22;
    if(!visible)continue;
    this._trajectory(shot,age,shot.root.position);shot.root.quaternion.copy(shot.quaternion);
    if(shot.tail){
     this._trajectory(shot,age+.01,this._p);this._dir.subVectors(this._p,shot.root.position).normalize();shot.root.quaternion.setFromUnitVectors(FORWARD,this._dir);
     shot.tail.visible=age>.14;shot.tail.scale.z=(.46+Math.sin(time*47)*.06)*(spec.kind==='rocket'?.8:1.2);
     const attr=shot.trail.geometry.attributes.position;
     for(let n=0;n<attr.count;n++){const t=Math.max(.14,age-(attr.count-1-n)*.022);this._trajectory(shot,t,this._p);attr.setXYZ(n,this._p.x,this._p.y,this._p.z);}attr.needsUpdate=true;
     const smoke=shot.smoke.geometry.attributes.position;
     for(let n=0;n<smoke.count;n++){const t=Math.max(.14,age-.05-n*.027);this._trajectory(shot,t,this._p);this._p.addScaledVector(shot.up,n*.006);smoke.setXYZ(n,this._p.x,this._p.y,this._p.z);}smoke.needsUpdate=true;
     shot.trail.material.opacity=.56*gain*(1-ramp(shot.lifetime*.8,shot.lifetime,age));
    }else if(spec.kind==='pulse'||spec.kind==='pulseDrone'){
     const radius=(spec.kind==='pulse'?.20:.09)+age*.28;shot.body.scale.setScalar(radius);shot.body.material.opacity=(1-age/shot.lifetime)*.85*gain;
    }
   }
  }
  for(const b of this.blades){
   b.node.updateWorldMatrix(true,false);this._inverse.copy(this.attachedRoot.matrixWorld).invert();const matrix=new T.Matrix4().multiplyMatrices(this._inverse,b.node.matrixWorld);matrix.decompose(b.root.position,b.root.quaternion,b.root.scale);
   b.root.visible=fireFxEnabled&&rig.progress>.52&&gain>0;const amount=ramp(.52,.98,rig.progress);b.mesh.material.opacity=amount*(live?.78:.48)*gain;b.sheet.material.opacity=amount*(live?.27:.14)*gain;
  }
  if(this.focusKnot){const active=this.channels.some(c=>c.spec.kind==='array'&&c.beam?.root.visible);this.focusKnot.root.visible=active&&gain>0;this.focusKnot.optical.rotation.y=time*1.6;this.focusKnot.orbit.rotation.z=-time*.8;this.focusKnot.orbit.material.opacity=(.35+Math.sin(time*15)*.10)*gain;}
  const enabled=cfg.deploymentEffects!==false&&gain>0&&rig.target&&rig.moving;
  for(let i=0;i<this.rings.length;i++){
   const ring=this.rings[i],u=(rig.progress-[.25,.51,.80][i])/.20;
   ring.visible=enabled&&u>=0&&u<1;if(ring.visible){ring.position.set(0,.15+i*.06,.65);ring.scale.setScalar(1.4+u*(4.5+i*.5));ring.material.opacity=Math.sin(u*Math.PI)*.20*gain;}
  }
  this.sparks.visible=enabled&&rig.progress>.42&&rig.progress<.98;
  if(this.sparks.visible){const a=this.sparks.geometry.attributes.position,p=rig.progress;for(let i=0;i<a.count;i++){const angle=i*2.39996,r=1.6+(i%7)*.30+Math.max(0,p-.45)*2.4;a.setXYZ(i,Math.cos(angle)*r,.35+((i*17)%13)/13*(.4+p),Math.sin(angle)*r+.55);}a.needsUpdate=true;this.sparks.material.opacity=Math.sin(p*Math.PI)*.52*gain;}
  this.root.visible=this.fighter.active;this.attachedRoot.visible=this.fighter.active;
 }
 snapshot(){return {...this.timeline.snapshot(),role:this.definition.role,mounts:this.channels.length,ready:this.fighter.deployment.progress>=.985,activeProjectiles:this.channels.reduce((n,c)=>n+c.pool.filter(p=>p.root.visible).length,0),activeBeams:this.channels.filter(c=>c.beam?.root.visible).length,loadedMissiles:this.channels.filter(c=>c.loaded?.visible).length};}
 clear(){this.timeline.reset();this.lastTime=null;for(const c of this.channels){c.muzzle.visible=false;if(c.beam)c.beam.root.visible=false;if(c.loaded)c.loaded.visible=true;for(const s of c.pool){s.born=-Infinity;s.root.visible=false;if(s.trail)s.trail.visible=false;if(s.smoke)s.smoke.visible=false;}}for(const r of this.rings)r.visible=false;this.sparks.visible=false;}
 dispose(){if(this.disposed)return;this.clear();this.disposed=true;this.root.removeFromParent();this.attachedRoot.removeFromParent();this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());this.textures.forEach(t=>t.dispose());this.root.clear();this.attachedRoot.clear();}
}
