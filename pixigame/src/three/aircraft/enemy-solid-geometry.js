import * as T from 'three';

// Spend curvature on the visible crown; the hidden underside is one flat cap.
export function enemyDeckShell(segments=24) {
  const profile=[[0,-.14],[1,-.14],[1,0]];
  for(let i=1;i<=8;i++) {
    const a=i*Math.PI/16;
    profile.push([i===8?0:Math.cos(a),Math.sin(a)]);
  }
  const geo=new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),segments);
  geo.normalizeNormals();
  geo.userData.topFocused=true;
  return geo;
}

// Closed loft with elliptical cross-sections, not a plane with an extruded rim.
// Each section is [z, halfWidth, halfHeight, centerY]. Shared ring vertices give
// continuous side lighting; end caps seal the underside as well as the nose.
export function enemySolidHull(sections,radial=16) {
  const rings=[];
  for(let i=0;i<sections.length-1;i++)for(let step=0;step<3;step++) {
    const t=step/3,e=t*t*(3-2*t);
    rings.push(sections[i].map((v,k)=>v+(sections[i+1][k]-v)*(k===0?t:e)));
  }
  rings.push(sections.at(-1));
  const positions=[],indices=[];
  for(const [z,w,h,y] of rings)for(let j=0;j<radial;j++) {
    const angle=j/radial*Math.PI*2;
    positions.push(Math.sin(angle)*w,y+Math.cos(angle)*h,z);
  }
  for(let i=0;i<rings.length-1;i++)for(let j=0;j<radial;j++) {
    const a=i*radial+j,b=i*radial+(j+1)%radial;
    indices.push(a,a+radial,b,b,a+radial,b+radial);
  }
  for(const [ring,reverse] of [[0,false],[rings.length-1,true]]) {
    const center=positions.length/3,[z,,,y]=rings[ring];positions.push(0,y,z);
    for(let j=0;j<radial;j++) {
      const a=ring*radial+j,b=ring*radial+(j+1)%radial;
      indices.push(center,reverse?b:a,reverse?a:b);
    }
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geo.setIndex(indices);geo.computeVertexNormals();geo.userData.solidHull=true;return geo;
}

export function enemyStrut(start,end,radius=2) {
  const a=new T.Vector3(...start),b=new T.Vector3(...end),delta=b.clone().sub(a);
  const geo=new T.CylinderGeometry(radius*.82,radius,delta.length(),10);
  geo.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize()));
  return geo.translate(...a.add(b).multiplyScalar(.5).toArray());
}

// Convex wing/armor volumes with a raised crown, tapered edge and sealed belly.
// The thick root and thin tip catch different light even from the combat camera.
export function enemyArmorPod(points,y,thickness=4) {
  const center=points.reduce((a,p)=>[a[0]+p[0]/points.length,a[1]+p[1]/points.length],[0,0]);
  const vertices=[center[0],y+thickness,center[1],center[0],y-1,center[1]],indices=[];
  for(const [x,z] of points)vertices.push(x,y+thickness*.15,z,x,y-1,z);
  const signedArea=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p[0]*q[1]-q[0]*p[1];},0);
  const tri=(a,b,c)=>indices.push(...(signedArea>0?[a,c,b]:[a,b,c]));
  for(let i=0;i<points.length;i++) {
    const a=2+i*2,b=2+((i+1)%points.length)*2;
    tri(0,a,b);tri(1,b+1,a+1);tri(a,a+1,b);tri(b,a+1,b+1);
  }
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geo.setIndex(indices);geo.computeVertexNormals();return geo;
}
