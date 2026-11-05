import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {cloneIndexedGeometry} from '../../../indexed-geometry.js';
import {RibbonGeometry} from '../fighter/upstream/RibbonGeometry.js';
import {compileExpression,makeBindings} from './Expressions.js';
import {poseAt} from './Motion.js';
import {FlightKinematics} from './FlightKinematics.js';
import {buildSpecialFx} from './SpecialFx.js';
import {DeploymentController} from './DeploymentController.js';
import {WeaponSystem} from './WeaponSystem.js';
const hash=n=>{const f=Math.sin(n*127.13+31.74)*43758.5453;return f-Math.floor(f);};
/** One runtime for every aircraft. There are intentionally no aircraft IDs,
 * airframe imports, silhouette points or per-variant material branches here. */
export class ConfigFighter{
 constructor({scene,camera,config,globals,depthInfo,asset}){
  this.config=config;this.globals=globals;this.camera=camera;this.depthInfo=depthInfo;this.asset=asset;this.view=asset.view;
  this.flight=asset.effects.motion.flightDynamics?new FlightKinematics(config,asset.effects.motion.flightDynamics):null;
  this._bridgeA=new T.Vector3();this._bridgeB=new T.Vector3();
  this.veilKinematics=this.flight??{
   pose:(t,p,q)=>this.poseAtTime(t,p,q),
   socketAt:(t,socket,out)=>this.socketPointAt(t,socket,out),
   socketVelocity:(t,socket,out)=>{
    const h=1/240,lo=Math.max(0,t-h),hi=t+h,a=this.socketPointAt(lo,socket,this._bridgeA),b=this.socketPointAt(hi,socket,this._bridgeB);
    return out.subVectors(b,a).multiplyScalar(1/Math.max(1e-6,hi-lo));
   },
   centreVelocity:(t,out)=>{
    const h=1/240,lo=Math.max(0,t-h),hi=t+h;
    this.poseAtTime(lo,this._bridgeA,this._q);this.poseAtTime(hi,this._bridgeB,this._q);
    return out.subVectors(this._bridgeB,this._bridgeA).multiplyScalar(1/Math.max(1e-6,hi-lo));
   }
  };
  this.isContinuous=true;this.variant=asset.entry.slug;this.active=false;this.age=0;this.phase=0;this.quality='high';
  this.group=new T.Group();this.group.name=asset.manifest.name;this.group.visible=false;scene.add(this.group);
  this.ship=new T.Group();this.group.add(this.ship);this.ship.add(asset.solid);
  this.ship.add(asset.nodes.get(asset.effects.attachRoot));this.group.add(asset.nodes.get(asset.effects.worldRoot));
  this.modelBounds=new T.Box3(new T.Vector3().fromArray(this.view.bounds.min),new T.Vector3().fromArray(this.view.bounds.max));
  this.context={time:0,config,global:globals};this.bindings=makeBindings(asset.effects.bindings,asset.nodes,asset.materials);
  this.deployment=new DeploymentController(asset.effects.articulations,asset.nodes,config);
  this._p=new T.Vector3();this._q=new T.Quaternion();this._anchorQ=new T.Quaternion();this._parentQ=new T.Quaternion();this._v=new T.Vector3();this._dir=new T.Vector3();this._world=new T.Vector3();this._local=new T.Vector3();this._inverse=new T.Matrix4();this._localMatrix=new T.Matrix4();
  this.ownedGeometries=[];this.ownedMaterials=[];
  // Referenced nodes must survive batching: anchors and animation targets are
  // semantic parts, not disposable rendering implementation details.
  const protectedNodes=new Set();
  const collect=value=>{if(Array.isArray(value))value.forEach(collect);else if(value&&typeof value==='object'){if(typeof value.node==='string')protectedNodes.add(value.node);Object.values(value).forEach(collect);}};
  collect(asset.effects);
  this._batch(asset.solid,protectedNodes);
  this.attachments=(asset.effects.attachments||[]).map(spec=>{
   const object=asset.nodes.get(spec.node);if(!object)throw new Error('特效挂载目标不存在');
   return {...spec,object,restQuaternion:object.quaternion.clone()};
  });
  this.attributeBindings=(asset.effects.attributeBindings||[]).map(spec=>{
   const object=asset.nodes.get(spec.node),attribute=object?.geometry?.getAttribute(spec.attribute);
   if(!attribute||attribute.itemSize!==3||!Number.isInteger(spec.index)||spec.index<0||spec.index>=attribute.count)throw new Error('特效端点绑定无效');
   return {...spec,object,attribute};
  });
  this.jets=asset.effects.jets.map(spec=>{const object=asset.nodes.get(spec.node);return {...spec,object,restQuaternion:object.quaternion.clone()};});
  this.trails=asset.effects.trails.map(spec=>{
   const object=asset.nodes.get(spec.node),ribbon=new RibbonGeometry(spec.segments);object.geometry=ribbon.geometry;
   this.ownedGeometries.push(ribbon.geometry);object.frustumCulled=false;
   const [base,sine]=spec.widthProfile;
   return {...spec,object,ribbon,points:Array.from({length:spec.segments+1},()=>new T.Vector3()),profile:t=>(1-t)*(base+Math.sin(t*Math.PI)*sine)};
  });
  this.particles=asset.effects.particles.map(spec=>({...spec,object:asset.nodes.get(spec.node),serial:-Infinity,signature:''}));
  // Shader-displaced geometry must not be culled using undeformed base quads.
  for(const object of asset.nodes.values())if(object.isMesh&&object.material?.isShaderMaterial)object.frustumCulled=false;
  this.lights=asset.effects.lights.map(spec=>{
   const light=new T.PointLight(0xffffff,0,12,2);this.group.add(light);
   return {...spec,object:light,colorFn:compileExpression(spec.color),intensityFn:compileExpression(spec.intensity),distanceFn:compileExpression(spec.distance)};
  });
  this._deck(asset.effects.deck);
  this.specialFx=buildSpecialFx(asset.effects.specialFx,config,this.ownedGeometries,this.ownedMaterials,this.variant);
  if(this.specialFx){this.ship.add(this.specialFx.root);if(this.specialFx.ribbonRoot)this.ship.add(this.specialFx.ribbonRoot);}
  this.weapons=asset.effects.arsenal?new WeaponSystem(this,asset.effects.arsenal):null;
 }
 get duration(){return Infinity;}
 _batch(root,animated){
  for(const child of root.children)if(child.isGroup)this._batch(child,animated);
  const batches=new Map();
  for(const obj of [...root.children]){
   if(!obj.isMesh||obj.isInstancedMesh||obj.children.length||animated.has(obj.uuid)||obj.material?.isShaderMaterial||Array.isArray(obj.material))continue;
   obj.updateMatrix();const geo=cloneIndexedGeometry(obj.geometry,obj.matrix);
   if(!geo.attributes.uv)geo.setAttribute('uv',new T.BufferAttribute(new Float32Array(geo.attributes.position.count*2),2));
   const key=[obj.material.uuid,obj.visible,obj.castShadow,obj.receiveShadow,obj.renderOrder,obj.layers.mask,obj.frustumCulled].join('|');
   if(!batches.has(key))batches.set(key,{sample:obj,geos:[]});batches.get(key).geos.push(geo);obj.removeFromParent();
  }
  for(const {sample,geos}of batches.values()){const material=sample.material;
   const geo=mergeGeometries(geos);geos.forEach(g=>g.dispose());if(!geo)throw new Error('刚体合批失败');
   this.ownedGeometries.push(geo);const obj=new T.Mesh(geo,material);obj.name='Batch/'+material.name;obj.castShadow=sample.castShadow;obj.receiveShadow=sample.receiveShadow;obj.visible=sample.visible;obj.layers.mask=sample.layers.mask;obj.renderOrder=sample.renderOrder;obj.frustumCulled=sample.frustumCulled;obj.userData.triangleCategory='model';root.add(obj);
  }
 }
 _deck(c){
  this.deck=new T.Group();this.deck.userData.statsExclude=true;this.group.add(this.deck);
  if(c.enabled===false)return;
  const body=new T.MeshStandardMaterial({color:c.color,metalness:.67,roughness:.49}),line=new T.MeshBasicMaterial({color:'#4195ae'});this.ownedMaterials.push(body,line);
  const base=new T.CylinderGeometry(c.radius,c.radius+.2,c.height,80),disc=new T.Mesh(base,body);disc.position.y=.1;disc.receiveShadow=true;this.deck.add(disc);this.ownedGeometries.push(base);
  for(const r of [.59,.915,.958]){const geo=new T.TorusGeometry(c.radius*r,.014,4,96),o=new T.Mesh(geo,line);o.rotation.x=Math.PI/2;o.position.y=.19;this.deck.add(o);this.ownedGeometries.push(geo);}
 }
 /** Config references can point into a named model assembly; engines and all
  * attached emitters then move as one object, rather than separate magic XYZs. */
 anchorLocal(spec,out){
  if(Array.isArray(spec))return out.fromArray(spec);
  const node=this.asset.nodes.get(spec.node);if(!node)throw new Error('喷口挂点不存在');
  out.fromArray(spec.position||[0,0,0]);this._localMatrix.copy(this.ship.matrixWorld).invert().multiply(node.matrixWorld);return out.applyMatrix4(this._localMatrix);
 }
 anchorDirectionLocal(spec,direction){
  if(Array.isArray(spec))return direction;
  const node=this.asset.nodes.get(spec.node);if(!node)throw new Error('方向挂点不存在');
  this.ship.getWorldQuaternion(this._parentQ).invert();node.getWorldQuaternion(this._anchorQ);this._anchorQ.premultiply(this._parentQ);
  return direction.applyQuaternion(this._anchorQ);
 }
 alignWithAnchor(spec){
  if(!spec.followRotation||Array.isArray(spec.anchor))return;
  const node=this.asset.nodes.get(spec.anchor.node);if(!node)throw new Error('旋转挂点不存在');
  node.getWorldQuaternion(this._anchorQ);spec.object.parent.getWorldQuaternion(this._parentQ).invert();
  spec.object.quaternion.copy(this._parentQ).multiply(this._anchorQ).multiply(spec.restQuaternion);
 }
 poseAtTime(t,p,q){if(this.flight)this.flight.pose(t,p,q);else poseAt(t,this.config,this.asset.effects.motion,p,q);}
 socketPointAt(t,socket,out){
  if(Array.isArray(socket))out.fromArray(socket);else if(socket?.isVector3)out.copy(socket);else this.anchorLocal(socket,out);
  this.poseAtTime(t,this._p,this._q);return out.multiplyScalar(this.config.scale).applyQuaternion(this._q).add(this._p);
 }
 pointAt(t,socket,out){return this.socketPointAt(t,socket,out);}
 spawn(target){this.weapons?.clear();this.flight?.reset();this.group.position.copy(target);this.age=0;this.active=true;this.group.visible=true;this.particles.forEach(p=>p.serial=-Infinity);this.sample(0);}
 update(dt){if(this.active)this.sample(this.age+Math.max(0,dt));}
 sample(t){
  if(!Number.isFinite(t))throw new Error('无效战机时间');this.age=Math.max(0,t);this.context.time=this.age;
  const c=this.config;this.group.visible=this.active;
  this.flight?.observe(this.age);this.poseAtTime(this.age,this.ship.position,this.ship.quaternion);this.ship.scale.setScalar(c.scale);
  this.deployment.sample(this.age);
  for(const update of this.bindings)update(this.context);
  this.group.updateMatrixWorld(true);
  for(const a of this.attachments){
   this.anchorLocal(a.anchor,this._v);this.ship.localToWorld(this._v);a.object.parent.worldToLocal(this._v);a.object.position.copy(this._v);this.alignWithAnchor(a);a.object.updateMatrixWorld(true);
  }
  for(const b of this.attributeBindings){
   this.anchorLocal(b.anchor,this._v);this.ship.localToWorld(this._v);b.object.worldToLocal(this._v);
   if(b.attribute.getX(b.index)!==this._v.x||b.attribute.getY(b.index)!==this._v.y||b.attribute.getZ(b.index)!==this._v.z){b.attribute.setXYZ(b.index,this._v.x,this._v.y,this._v.z);b.attribute.needsUpdate=true;}
  }
  for(const jet of this.jets){
   this.anchorLocal(jet.anchor,jet.object.position);this.alignWithAnchor(jet);
   const u=jet.object.material.uniforms;u.uSteps.value=jet.steps[this.quality]||32;
   if(u.uGain)u.uGain.value=(c.boost?1.85:1.02)*Math.max(.35,c.engineGlow??1)*Math.max(.5,this.globals.glow??1);
   if(u.uThrottle)u.uThrottle.value=c.boost?1:.46;
  }
  for(const tr of this.trails){
   if(c.trails===0||c.trails===false)continue;
   const life=tr.baseLifetime*c.trailLength,speed=(c.boost?tr.speed.boost:tr.speed.idle)*tr.speedFactor;
   for(let i=0;i<tr.points.length;i++){
    const age=i/(tr.points.length-1)*life,birth=Math.max(0,this.age-age),v=tr.points[i];this.pointAt(birth,tr.socket,v);
    this._dir.set(0,0,speed);if(tr.rotateWithSocket)this.anchorDirectionLocal(tr.socket,this._dir);this._dir.applyQuaternion(this._q);v.addScaledVector(this._dir,Math.min(age,this.age));
    if(i){v.y+=Math.sin(age*4+birth)*age*tr.noiseAmplitude;v.x+=Math.sin(age*3.7+birth*.5)*age*tr.noiseAmplitude;}
   }
  }
  for(const ps of this.particles){
   if(c.particles===0||c.particles===false)continue;
   const serial=Math.floor(this.age*ps.rate);let signature=[c.scale,c.altitude,c.cruise,c.boost].join('|');
   for(const anchor of ps.sockets){this.anchorLocal(anchor,this._v);signature+='|'+this._v.x+','+this._v.y+','+this._v.z;if(ps.rotateWithSocket){this._dir.set(0,0,1);this.anchorDirectionLocal(anchor,this._dir);signature+='|'+this._dir.x+','+this._dir.y+','+this._dir.z;}}
   if(serial===ps.serial&&signature===ps.signature)continue;ps.serial=serial;ps.signature=signature;
   const attrs=ps.object.geometry.attributes;
   for(let i=0;i<ps.capacity;i++){
    const number=serial-i,birth=number/ps.rate,lane=((number%ps.sockets.length)+ps.sockets.length)%ps.sockets.length,r=hash(number),r2=hash(number+91.3);
    this.pointAt(birth,ps.sockets[lane],this._v);this._v.x+=(r-.5)*ps.jitter;this._v.y+=(r2-.5)*ps.jitter;
    this._dir.set((r-.5)*ps.spreadVelocity,(r2-.5)*ps.spreadVelocity,c.boost?ps.speed.boost:ps.speed.idle);if(ps.rotateWithSocket)this.anchorDirectionLocal(ps.sockets[lane],this._dir);this._dir.applyQuaternion(this._q);
    attrs.aStart.setXYZ(i,this._v.x,this._v.y,this._v.z);attrs.aVelocity.setXYZ(i,this._dir.x,this._dir.y,this._dir.z);attrs.aBirth.setX(i,birth);
    attrs.aLife.setX(i,number<0?0:ps.life[0]+r*ps.life[1]);attrs.aSize.setX(i,ps.size[0]+r*ps.size[1]);attrs.aSeed.setX(i,r2);
   }
   for(const attr of Object.values(attrs))if(attr.isInstancedBufferAttribute)attr.needsUpdate=true;
  }
  for(const l of this.lights){this.anchorLocal(l.position,this._v);l.object.position.copy(this._v).multiplyScalar(c.scale).applyQuaternion(this.ship.quaternion).add(this.ship.position);l.object.color.set(l.colorFn(this.context));l.object.intensity=l.intensityFn(this.context);l.object.distance=l.distanceFn(this.context);}
  this.specialFx?.update(this.age,c,this.globals,this.veilKinematics);
  this.weapons?.update(this.age);
  this.phase=c.firing?3:c.boost?2:c.cruise?1:0;this.drawnInstances=this.particles.reduce((n,p)=>n+p.object.geometry.instanceCount,0);
  this.group.updateMatrixWorld(true);
 }
 prepareRender(camera){
  // Camera-facing effects need the group and jet transforms. Each lookup
  // updates its ancestor chain; the renderer updates the hull when drawing it.
  camera.updateMatrixWorld(true);camera.getWorldPosition(this._world);this._local.copy(this._world);this.group.worldToLocal(this._local);
  if(this.config.trails!==0&&this.config.trails!==false)for(const tr of this.trails)tr.ribbon.build(tr.points,{width:tr.width,cameraPosition:this._local,widthProfile:tr.profile});
  this.specialFx?.prepareRender(this._local);
  for(const j of this.jets){const o=j.object,u=o.material.uniforms;o.updateWorldMatrix(true,false);this._inverse.copy(o.matrixWorld).invert();u.uEye.value.copy(this._world).applyMatrix4(this._inverse);u.uObjectView.value.multiplyMatrices(camera.matrixWorldInverse,o.matrixWorld);
   const d=this.depthInfo;if(d?.texture){u.uDepth.value=d.texture;u.uUseDepth.value=1;u.uResolution.value.copy(d.resolution);u.uNear.value=d.near;u.uFar.value=d.far;}
  }
 }
 /** Local emergency preview: same saved geometry, no custom shaders or HDR
  * composition. It never changes package/default/LAN state, and restores every
  * visibility/material even when a draw throws. Created fallback materials are
  * reused and released with the aircraft. */
 withCompatibleModel(draw){
  this._safeMaterials??=new Map();const materialState=[],visibleState=[];
  for(const node of [this.asset.nodes.get(this.asset.effects.attachRoot),this.asset.nodes.get(this.asset.effects.worldRoot),this.specialFx?.root,this.specialFx?.ribbonRoot,this.weapons?.root,this.weapons?.attachedRoot]){
   if(node){visibleState.push([node,node.visible]);node.visible=false;}
  }
  const plain=original=>{
   let copy=this._safeMaterials.get(original);
   if(!copy){copy=original.clone();copy.fog=false;copy.onBeforeCompile=()=>{};copy.customProgramCacheKey=()=> 'plain-airframe-v15';copy.name='Compatible/'+original.name;this._safeMaterials.set(original,copy);this.ownedMaterials.push(copy);}
   return copy;
  };
  this.asset.solid.traverse(node=>{if(node.isMesh&&node.material){materialState.push([node,node.material]);node.material=Array.isArray(node.material)?node.material.map(plain):plain(node.material);}});
  try{return draw();}finally{for(const [n,m]of materialState)n.material=m;for(const [n,v]of visibleState)n.visible=v;}
 }
 clear(){this.active=false;this.group.visible=false;for(const l of this.lights)l.object.intensity=0;for(const tr of this.trails)tr.ribbon.clear();this.specialFx?.clear();this.weapons?.clear();}
 dispose(){if(this.disposed)return;this.disposed=true;this.clear();this.weapons?.dispose();this.ownedGeometries.forEach(g=>g.dispose());this.ownedMaterials.forEach(m=>m.dispose());this.asset.dispose();this.group.removeFromParent();this.group.clear();}
}
