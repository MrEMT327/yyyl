/** Adapted from achrefelouafi/LinearAbilityExtThreeJS (MIT).
 * Source src/effects/RibbonGeometry.js, blob b12fb3d9501e58b5031bcc89ab1df056c9767c2b.
 * Same preallocated strip, arc-length UVs, tangent/view cross-product and profiles.
 * Only BILLBOARD/ORIENTED paths are needed here; unused attributes removed.
 * Copyright (c) 2026 mohamedachrefelouafi. See docs/UPSTREAM_LICENSE.txt. */
import {BufferGeometry,BufferAttribute,Vector3,DynamicDrawUsage,Sphere} from 'three';
const tangent=new Vector3(),side=new Vector3(),view=new Vector3();
export class RibbonGeometry {
 constructor(maxSegments=64){
  this.maxSegments=maxSegments;this.geometry=new BufferGeometry();
  this.positions=new Float32Array((maxSegments+1)*6);this.uvs=new Float32Array((maxSegments+1)*4);
  this.geometry.setAttribute('position',new BufferAttribute(this.positions,3).setUsage(DynamicDrawUsage));
  this.geometry.setAttribute('uv',new BufferAttribute(this.uvs,2).setUsage(DynamicDrawUsage));
  const indices=new Uint16Array(maxSegments*6);
  for(let i=0;i<maxSegments;i++){const a=i*2;indices.set([a,a+1,a+2,a+2,a+1,a+3],i*6);}
  this.geometry.setIndex(new BufferAttribute(indices,1));this.geometry.setDrawRange(0,0);
  this.geometry.boundingSphere=new Sphere(new Vector3(),1000);
 }
 build(points,{width=.5,cameraPosition,normal=null,widthProfile=null,count=points.length}){
  count=Math.min(count,this.maxSegments+1);if(count<2){this.clear();return this;}
  let total=0,d=0;for(let i=1;i<count;i++)total+=points[i].distanceTo(points[i-1]);
  const inverse=total>1e-5?1/total:0;
  for(let i=0;i<count;i++){
   const p=points[i];if(i)d+=p.distanceTo(points[i-1]);const t=d*inverse;
   if(!i)tangent.copy(points[1]).sub(p);else if(i===count-1)tangent.copy(p).sub(points[i-1]);else tangent.copy(points[i+1]).sub(points[i-1]);
   if(tangent.lengthSq()<1e-10)tangent.set(0,0,1);tangent.normalize();
   if(normal)side.crossVectors(tangent,normal);else{view.copy(cameraPosition).sub(p);side.crossVectors(tangent,view);}
   if(side.lengthSq()<1e-10)side.set(1,0,0);side.normalize();
   const w=width*(widthProfile?widthProfile(t,i):1)*.5;
   for(let s=0;s<2;s++){const k=(i*2+s)*3,j=(i*2+s)*2,sign=s?1:-1;
    this.positions[k]=p.x+side.x*w*sign;this.positions[k+1]=p.y+side.y*w*sign;this.positions[k+2]=p.z+side.z*w*sign;
    this.uvs[j]=t;this.uvs[j+1]=s;
   }
  }
  for(const a of Object.values(this.geometry.attributes)){a.needsUpdate=true;a.clearUpdateRanges();a.addUpdateRange(0,count*2*a.itemSize);}
  this.geometry.setDrawRange(0,(count-1)*6);return this;
 }
 clear(){this.geometry.setDrawRange(0,0);}
 dispose(){this.geometry.dispose();}
}
