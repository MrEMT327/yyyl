import * as THREE from 'three';

// The nose and antenna tips skew an extent midpoint. Use the opaque airframe's
// horizontal surface area so the visible body and wings balance around the axis.
export function hangarPivot(root, bounds) {
  root.updateWorldMatrix(true,true);
  const center=bounds.getCenter(new THREE.Vector3());
  const vertices=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
  const matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
  let weight=0,x=0,z=0;
  root.traverseVisible(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry,position=geometry.attributes.position,index=geometry.index;
    if(!position)return;
    const count=index?.count??position.count;
    for(let copy=0;copy<(node.isInstancedMesh?node.count:1);copy++){
      matrix.copy(node.matrixWorld);
      if(node.isInstancedMesh){node.getMatrixAt(copy,instance);matrix.multiply(instance);}
      for(let i=0;i+2<count;i+=3){
        const material=Array.isArray(node.material)
          ?node.material[geometry.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex??0]
          :node.material;
        if(!material||!material.visible||material.transparent||material.transmission>0)continue;
        for(let j=0;j<3;j++)vertices[j].fromBufferAttribute(position,index?index.getX(i+j):i+j).applyMatrix4(matrix);
        const [a,b,c]=vertices;
        const area=Math.abs((b.x-a.x)*(c.z-a.z)-(c.x-a.x)*(b.z-a.z));
        weight+=area;x+=area*(a.x+b.x+c.x)/3;z+=area*(a.z+b.z+c.z)/3;
      }
    }
  });
  if(weight>1e-8){center.x=x/weight;center.z=z/weight;}
  // Keep the previous vertical fit and clearance above the lift.
  return center;
}
