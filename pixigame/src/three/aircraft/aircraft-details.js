import * as T from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {applyMachinedFinish} from './premium-finish.js';

const profiles={
 kestrel:{trim:'#d5b47b',light:'#68ddff',panels:3,vent:5,radius:.41},
 verdant:{trim:'#b6cb90',light:'#69ffd6',panels:4,vent:4,radius:.38},
 crimson:{trim:'#da9a6d',light:'#ff7656',panels:3,vent:6,radius:.35},
 azure:{trim:'#a4c9e3',light:'#72caff',panels:4,vent:6,radius:.4},
 wraith:{trim:'#bacbd5',light:'#82e9fc',panels:3,vent:3,radius:.29},
 scarlet:{trim:'#d5a393',light:'#ff8461',panels:4,vent:5,radius:.29},
 verdure:{trim:'#bed69a',light:'#78efbd',panels:4,vent:4,radius:.31},
 prism:{trim:'#cbd895',light:'#95ffdb',panels:3,vent:5,radius:.37},
 bastion:{trim:'#b3cbdd',light:'#7bd5ff',panels:5,vent:7,radius:.31},
 auric:{trim:'#edcf8b',light:'#88f9df',panels:4,vent:4,radius:.33},
};

// Detail patches follow their original surface mesh, including articulated wings.
// Package-local IDs, shared buffers and the author's effect bindings are untouched.
export function addAircraftDetails(asset){
 const p=profiles[asset.entry.slug];
 const root=asset.solid;root.updateMatrixWorld(true);
 const ownedGeometry=new Set(),materials=[],parents=new Map(),parts=[];
 const material=(name,color,metalness,roughness)=>{const m=applyMachinedFinish(new T.MeshStandardMaterial({name,color,metalness,roughness,envMapIntensity:1.15}));materials.push(m);return m;};
 const dark=material('Detail / graphite','#132532',.62,.35),metal=material('Detail / titanium','#7e9cab',.83,.25),trim=material('Detail / trim',p.trim,.8,.26);
 const glow=new T.MeshStandardMaterial({name:'Detail / status light',color:p.light,emissive:p.light,emissiveIntensity:1.35,roughness:.26,metalness:.3});materials.push(glow);
 const span=asset.view.bounds.max[0]-asset.view.bounds.min[0],unit=span/15.755;
 const top=asset.view.bounds.max[1]+2,minZ=asset.view.bounds.min[2],depth=asset.view.bounds.max[2]-minZ;
 const surfaces=[];
 root.traverse(n=>{if(n.isMesh&&!n.isInstancedMesh&&n.material?.isMeshStandardMaterial&&!n.material.transparent&&!n.material.transmission&&/\/(shell|white|bright|accent)$|pearl ceramic/.test(n.material.name))surfaces.push(n);});
 const ray=new T.Raycaster(),normalMatrix=new T.Matrix3();
 const rootWorld=root.matrixWorld.clone(),rootInverse=rootWorld.clone().invert();
 function cast(x,z){
   const origin=new T.Vector3(x,top,z).applyMatrix4(rootWorld),direction=new T.Vector3(0,-1,0).transformDirection(rootWorld);
   ray.set(origin,direction);const hit=ray.intersectObjects(surfaces,false)[0];
   if(!hit)return null;
   const normal=hit.face.normal.clone().applyNormalMatrix(normalMatrix.getNormalMatrix(hit.object.matrixWorld));
   if(normal.dot(new T.Vector3(0,1,0).transformDirection(rootWorld))<.45)return null;
   return {hit,normal,point:hit.point.clone().applyMatrix4(rootInverse)};
 }
 function patchGroup(hit,normal){
   const g=new T.Group();g.name='Precision service panel';
   const world=new T.Matrix4().compose(hit.point.clone().addScaledVector(normal,.022*unit),new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),normal),new T.Vector3(unit,unit,unit));
   g.applyMatrix4(new T.Matrix4().copy(hit.object.matrixWorld).invert().multiply(world));
   hit.object.add(g);parents.set(g,[]);return g;
 }
 function add(parent,geometry,mat,pos=[0,0,0],rot=[0,0,0]){
   const mesh=new T.Mesh(geometry,mat);mesh.position.fromArray(pos);mesh.rotation.fromArray(rot);parent.add(mesh);ownedGeometry.add(geometry);parents.get(parent).push(mesh);parts.push(mesh);return mesh;
 }
 function panel(parent,halfX,halfZ,mat,y=0){
   const c=.09,shape=new T.Shape([[-halfX+c,-halfZ],[halfX-c,-halfZ],[halfX,-halfZ+c],[halfX,halfZ-c],[halfX-c,halfZ],[-halfX+c,halfZ],[-halfX,halfZ-c],[-halfX,-halfZ+c]].map(v=>new T.Vector2(...v)));
   const g=new T.ExtrudeGeometry(shape,{depth:.027,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:1,steps:1});g.rotateX(-Math.PI/2);add(parent,g,mat,[0,y,0]);
 }
 let patchCount=0;
 for(const side of [-1,1])for(let row=0;row<p.panels;row++){
   const z=minZ+depth*((asset.entry.slug==='kestrel'?.44:.30)+row*.13);let sample,patchScale=1;
   search: for(const scale of [1,.6])for(const dz of [0,-.035,.035])for(const fraction of [.19,.25,.31,.13,.07,.37,.43]){
     const x=side*span*fraction,zz=z+depth*dz,a=cast(x,zz);if(!a)continue;
     const corners=[[-.28,-.37],[.28,-.37],[-.28,.37],[.28,.37]].map(([dx,dz])=>cast(x+dx*unit*scale,zz+dz*unit*scale));
     if(corners.every(c=>c&&c.hit.object===a.hit.object&&Math.abs(c.hit.point.clone().sub(a.hit.point).dot(a.normal))<.045*unit)){sample=a;patchScale=scale;break search;}
   }
   if(!sample)continue;
   const g=patchGroup(sample.hit,sample.normal);g.scale.multiplyScalar(patchScale);patchCount++;
   panel(g,.25,.33,dark);panel(g,.21,.29,metal,.034);
   for(let i=0;i<p.vent;i++)add(g,new T.BoxGeometry(.28,.022,.028),dark,[0,.076,-.20+i*(.4/Math.max(1,p.vent-1))],[0,0,.13]);
   for(const x of [-.18,.18])for(const z of [-.26,.26])add(g,new T.CylinderGeometry(.025,.025,.024,6),trim,[x,.082,z]);
   add(g,new T.BoxGeometry(.035,.025,.13),glow,[.22,.055,-.12]);
 }
 // Fine collars and nozzle petals use the authored jet sockets. An anchored
 // engine's added detail remains its child and follows every moving assembly.
 const nozzleGroups=[];
 for(const jet of asset.effects.jets){
   const anchor=jet.anchor,parent=Array.isArray(anchor)?root:asset.nodes.get(anchor.node);
   if(!parent)continue;
   const point=Array.isArray(anchor)?new T.Vector3(...anchor).applyMatrix4(rootWorld):new T.Vector3(...(anchor.position||[0,0,0])).applyMatrix4(parent.matrixWorld);
   const g=new T.Group();g.name='Precision nozzle';
   const world=new T.Matrix4().compose(point,new T.Quaternion().setFromRotationMatrix(rootWorld),new T.Vector3(unit,unit,unit));
   g.applyMatrix4(new T.Matrix4().copy(parent.matrixWorld).invert().multiply(world));parent.add(g);parents.set(g,[]);nozzleGroups.push(g);
   const r=p.radius;
   for(const [offset,thickness,mat] of [[-.10,.032,metal],[-.025,.02,trim],[.025,.018,glow]])add(g,new T.TorusGeometry(r,thickness,6,32),mat,[0,0,offset]);
   for(let i=0;i<12;i++){
     const a=i*Math.PI/6;
     add(g,new T.BoxGeometry(.045,.095,.20),metal,[Math.cos(a)*r,Math.sin(a)*r,-.115],[0,0,a-Math.PI/2]);
   }
 }
 // Each surface patch is just 4 batches, regardless of the number of fasteners.
 for(const [parent,list] of parents){
   for(const mat of materials){
     const shapes=list.filter(n=>n.material===mat).map(n=>{n.updateMatrix();const g=n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone();g.deleteAttribute('uv');return g.applyMatrix4(n.matrix);});
     if(!shapes.length)continue;
     const geometry=mergeGeometries(shapes);shapes.forEach(g=>g.dispose());ownedGeometry.add(geometry);
     const mesh=new T.Mesh(geometry,mat);mesh.name=`${asset.entry.slug}/${mat.name}`;parent.add(mesh);
   }
   for(const n of list){ownedGeometry.delete(n.geometry);n.geometry.dispose();n.removeFromParent();}
 }
 root.userData.precisionDetails={panels:patchCount,nozzles:nozzleGroups.length,components:parts.length};
 let disposed=false;
 return {dispose(){if(disposed)return;disposed=true;for(const parent of parents.keys())parent.removeFromParent();ownedGeometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
