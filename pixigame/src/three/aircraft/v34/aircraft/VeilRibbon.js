import * as T from 'three';
import {RibbonGeometry} from '../fighter/upstream/RibbonGeometry.js';
import {TetherDynamics} from './TetherDynamics.js';
export const VEIL_STYLE='hanging-veil/1';
const bounded=(v,lo,hi,fallback)=>Number.isFinite(v)?T.MathUtils.clamp(v,lo,hi):fallback;
/** One upstream ribbon strip; a copied Prism fin material; force-driven points.
 * The physics and UV adapter are independent of the shader definition. */
export class VeilRibbon {
 constructor(spec,library,config,geometries,materials){
  this.spec=spec;this.config=config;this.source=library?.[spec.material];
  if(spec.style!==VEIL_STYLE||!this.source?.materialJSON)throw new Error('Missing persisted reference fin material');
  this.root=new T.Group();this.root.name=spec.name;this.root.position.fromArray(spec.anchor);this.root.scale.set(spec.side===-1?-1:1,1,1);
  this.ribbon=new RibbonGeometry(spec.segments);geometries.push(this.ribbon.geometry);
  this.points=Array.from({length:spec.segments+1},()=>new T.Vector3());
  this.restCurve=new T.CubicBezierCurve3(...spec.restCurve.map(p=>new T.Vector3(...p)));
  this.restLength=this.restCurve.getLength();
  this.material=new T.ObjectLoader().parseMaterials([structuredClone(this.source.materialJSON)],{})[this.source.materialJSON.uuid];
  this.material.name=spec.name+'/Prism-reference-fin';materials.push(this.material);
  this.mesh=new T.Mesh(this.ribbon.geometry,this.material);this.mesh.layers.set(1);this.mesh.renderOrder=12;this.mesh.frustumCulled=false;this.mesh.userData.triangleCategory='vfx';this.root.add(this.mesh);
  this.normal=new T.Vector3(...spec.normal).normalize();this.camera=new T.Vector3(0,10,10);
  this.anchor=new T.Vector3(...spec.anchor);this._world=new T.Vector3();this._pos=new T.Vector3();this._q=new T.Quaternion();this._inv=new T.Quaternion();this._dir=new T.Vector3();this._vel=new T.Vector3();
  const rootDirection=new T.Vector3(.50,-.78,.38);rootDirection.x*=spec.side;
  this.physics=new TetherDynamics({length:this.restLength*config.scale,rootDirection,...spec.physics});
  this.kinematics={turbulence:spec.physics?.turbulence??.018,
   anchorAt:(t,out)=>this.flight.socketAt(t,this.anchor,out),
   anchorVelocity:(t,out)=>this.flight.socketVelocity(t,this.anchor,out),
   orientationAt:t=>{this.flight.pose(t,this._pos,this._q);return this._q;}};
  this.widthProfile=t=>{
   const w=spec.widthProfile;for(let i=1;i<w.length;i++)if(t<=w[i][0]){let u=T.MathUtils.clamp((t-w[i-1][0])/Math.max(1e-6,w[i][0]-w[i-1][0]),0,1);return T.MathUtils.lerp(w[i-1][1],w[i][1],u*u*(3-2*u));}return w.at(-1)[1];
  };
  this._curve=new T.CatmullRomCurve3(this.physics.positions,false,'centripetal');this.lastTime=NaN;this.lastScale=config.scale;
  this.telemetry={};
 }
 update(time,config,globals={},flight){
  if(!Number.isFinite(time))throw new Error('Non-finite ribbon time');
  this.flight=flight;if(!flight)return;
  const body=bounded(config.bodyFx,0,2,1),gain=bounded(globals.glow,0,2,1),opacity=bounded(config.veilOpacity,0,.45,.14);
  this.root.visible=body>0&&gain>0&&opacity>0;
  const u=this.material.uniforms;
  // The original Prism shader and blend state remain byte-for-byte identical.
  u.uTime.value=time*(bounded(config.veilFlow,0,2,.65)/.65);
  u.uGain.value=this.source.gain*body*gain*(opacity/.14);
  if(this.lastScale!==config.scale){this.lastScale=config.scale;this.physics.length=this.restLength*config.scale;this.physics.edge=this.physics.length/(this.physics.count-1);for(const c of this.physics.constraints)c.length=this.physics.edge*(c.bend?2:1);this.physics.clear();}
  this.physics.advance(time,this.kinematics,{gravityScale:bounded(config.veilDroop,0,2.2,1),softness:bounded(config.veilSoftness,0,2,1),dragScale:bounded(config.veilAirDrag,.1,3,1)});
  this.flight.pose(time,this._pos,this._q);this._inv.copy(this._q).invert();
  const invScale=1/Math.max(.001,config.scale),side=this.spec.side;
  for(let i=0;i<this.points.length;i++){
   const p=this.points[i];this._curve.getPoint(i/(this.points.length-1),p);
   p.sub(this._pos).applyQuaternion(this._inv).multiplyScalar(invScale).sub(this.anchor);p.x*=side;
  }
  this.points[0].set(0,0,0); // sewn edge attaches exactly at the rendered current pose
  this.ribbon.build(this.points,{width:this.spec.width,normal:this.normal,cameraPosition:this.camera,widthProfile:this.widthProfile});
  this.ribbon.geometry.computeVertexNormals();
  // Project the strip's chart into the source fin's diagonal UV domain.
  // This is what keeps its intermittent dotted ribs, rather than a white rail.
  const uv=this.ribbon.geometry.attributes.uv,chart=this.source.uvChart||[0,1,0,.72,.28],dots=bounded(config.veilDots,0,2,1);
  for(let i=0;i<uv.count;i++){const s=uv.getX(i),v=uv.getY(i);uv.setXY(i,chart[0]+chart[1]*s,chart[2]+chart[3]*s+chart[4]*(.5+(v-.5)*dots));}uv.needsUpdate=true;
  this.flight.socketVelocity(time,this.anchor,this._vel);const tip=this.points.at(-1);
  this.telemetry={...this.physics.telemetry,socketSpeed:this._vel.length(),relativeAirLocal:this._vel.clone().negate().applyQuaternion(this._inv).toArray(),tip:tip.toArray(),time,sourceMaterial:this.source.source.materialUUID};
  this.lastTime=time;
 }
 clear(){this.root.visible=false;this.physics.clear();this.ribbon.clear();this.lastTime=NaN;}
}
