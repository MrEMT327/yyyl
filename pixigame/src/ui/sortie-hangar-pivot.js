import * as THREE from 'three';
import centers from './sortie-hangar-centers.json' with {type:'json'};

export function hangarCenterKey(manifest){
  return [manifest?.hashes?.[manifest.files?.structure],manifest?.hashes?.[manifest.files?.buffers]].join(':');
}

// A surface-area centroid shifts toward layered wings/engines. The lift needs
// the whole visible silhouette centered, including the long, narrow nose.
// Calibrate ONCE at load. This pivot never depends on the rotation angle.
export function hangarPivot(root, bounds, asset) {
  const center=bounds.getCenter(new THREE.Vector3());
  const cached=centers.entries[asset?.entry.slug];
  if(cached&&cached.key===hangarCenterKey(asset.manifest)){
    center.x=cached.center[0];center.z=cached.center[1];
    return center;
  }
  root.updateWorldMatrix(true,true);
  const vertex=new THREE.Vector3(),matrix=new THREE.Matrix4(),instance=new THREE.Matrix4();
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;
  root.traverseVisible(node=>{
    if(!node.isMesh)return;
    const geometry=node.geometry,position=geometry.attributes.position,index=geometry.index;
    if(!position)return;
    const count=index?.count??position.count;
    const start=Math.max(0,geometry.drawRange.start),end=Math.min(count,start+geometry.drawRange.count);
    const visited=index?new Uint8Array(position.count):null;
    for(let copy=0;copy<(node.isInstancedMesh?node.count:1);copy++){
      matrix.copy(node.matrixWorld);
      if(node.isInstancedMesh){node.getMatrixAt(copy,instance);matrix.multiply(instance);}
      visited?.fill(0);
      for(let i=start;i<end;i++){
        const material=Array.isArray(node.material)
          ?node.material[geometry.groups.find(group=>i>=group.start&&i<group.start+group.count)?.materialIndex??0]
          :node.material;
        if(!material||!material.visible||material.opacity===0||material.isShaderMaterial)continue;
        const vertexIndex=index?index.getX(i):i;
        if(visited?.[vertexIndex])continue;
        if(visited)visited[vertexIndex]=1;
        vertex.fromBufferAttribute(position,vertexIndex).applyMatrix4(matrix);
        minX=Math.min(minX,vertex.x);maxX=Math.max(maxX,vertex.x);
        minZ=Math.min(minZ,vertex.z);maxZ=Math.max(maxZ,vertex.z);
      }
    }
  });
  if(Number.isFinite(minX)){center.x=(minX+maxX)*.5;center.z=(minZ+maxZ)*.5;}
  return center;
}
