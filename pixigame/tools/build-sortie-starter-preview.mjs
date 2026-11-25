import {readFile,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {Box3,Matrix3,Matrix4,Vector3} from 'three';
import {MeshoptSimplifier} from 'three/addons/libs/meshopt_simplifier.module.js';
import {instantiateFighterPackage,loadFighterPackages} from '../src/three/aircraft/fighter-packages.js';
import {hangarCenterKey,hangarPivot} from '../src/ui/sortie-hangar-pivot.js';

const pilot='pilot-01',positionUnit=1/4096;
const source=(slug,file)=>readFile(new URL(`../public/fighters/${slug}/${file}`,import.meta.url));
await loadFighterPackages({pilotIds:[pilot],skipTextures:true,read:source});
await MeshoptSimplifier.ready;
const asset=instantiateFighterPackage(pilot);

function buildMesh(){
  const root=asset.solid,bounds=new Box3().setFromObject(root,true);
  const center=hangarPivot(root,bounds,asset),size=bounds.getSize(new Vector3());
  center.y=bounds.min.y;
  const scale=10/Math.max(size.x,size.z)/positionUnit;
  const groups=new Map(),point=new Vector3(),normal=new Vector3(),normalMatrix=new Matrix3();
  const matrix=new Matrix4(),instance=new Matrix4();
  root.updateWorldMatrix(true,true);
  root.traverseVisible(node=>{
    if(!node.isMesh)return;
    const {geometry,material}=node,index=geometry.index,position=geometry.attributes.position;
    if(Array.isArray(material))throw new Error('Unexpected starter aircraft material groups');
    if(!material.color||!material.visible||!(material.opacity>0))return;
    const color=material.color.getHexString();
    if(!geometry.attributes.normal)geometry.computeVertexNormals();
    if(!groups.has(color))groups.set(color,{positions:[],normals:[],indices:[],vertices:new Map()});
    const part=groups.get(color);
    const start=geometry.drawRange.start,end=Math.min(index?.count??position.count,start+geometry.drawRange.count);
    for(let copy=0;copy<(node.isInstancedMesh?node.count:1);copy++){
      matrix.copy(node.matrixWorld);
      if(node.isInstancedMesh){node.getMatrixAt(copy,instance);matrix.multiply(instance);}
      normalMatrix.getNormalMatrix(matrix);
      const order=matrix.determinant()<0?[0,2,1]:[0,1,2],remap=new Map();
      for(let i=start;i+2<end;i+=3){
        const triangle=[];
        for(const corner of order){
          const vertex=index?index.getX(i+corner):i+corner;
          if(!remap.has(vertex)){
            point.fromBufferAttribute(position,vertex).applyMatrix4(matrix).sub(center).multiplyScalar(scale);
            normal.fromBufferAttribute(geometry.attributes.normal,vertex).applyNormalMatrix(normalMatrix);
            const coordinates=point.toArray().map(Math.round);
            const orientation=normal.toArray().map(value=>Math.round(value*127));
            const key=coordinates.join(',')+'/'+orientation.join(',');
            if(!part.vertices.has(key)){
              part.vertices.set(key,part.positions.length/3);
              part.positions.push(...coordinates);
              part.normals.push(...orientation);
            }
            remap.set(vertex,part.vertices.get(key));
          }
          triangle.push(remap.get(vertex));
        }
        if(new Set(triangle).size===3)part.indices.push(...triangle);
      }
    }
  });
  return Buffer.concat([...groups].map(([color,{positions,normals,indices}])=>{
    const target=Math.max(60,Math.floor(indices.length*.22/3)*3);
    const [simplified]=indices.length<=target?[indices]:MeshoptSimplifier.simplifyWithAttributes(
      Uint32Array.from(indices),Float32Array.from(positions,value=>value*positionUnit),3,
      Float32Array.from(normals,value=>value/127),3,[.05,.05,.05],null,target,.008,['Permissive','Prune']);
    const vertices=new Map(),compact=[],compactNormals=[];
    for(const index of simplified){
      if(vertices.has(index))continue;
      vertices.set(index,vertices.size);
      compact.push(...positions.slice(index*3,index*3+3));
      compactNormals.push(...normals.slice(index*3,index*3+3));
    }
    const data=Buffer.alloc(7+(compact.length+simplified.length)*2+compactNormals.length);
    data.write(color,0,3,'hex');
    data.writeUInt16LE(vertices.size,3);
    data.writeUInt16LE(simplified.length,5);
    compact.forEach((value,index)=>data.writeInt16LE(value,7+index*2));
    const normalsOffset=7+compact.length*2;
    compactNormals.forEach((value,index)=>data.writeInt8(value,normalsOffset+index));
    const indicesOffset=normalsOffset+compactNormals.length;
    simplified.forEach((vertex,index)=>data.writeUInt16LE(vertices.get(vertex),indicesOffset+index*2));
    return data;
  }));
}

try {
  const mesh=gzipSync(buildMesh(),{level:9}).toString('base64');
  const output=new URL('../src/ui/sortie-starter-aircraft.json',import.meta.url);
  const preview=JSON.stringify({source:hangarCenterKey(asset.manifest),positionUnit,mesh})+'\n';
  if(process.argv.includes('--check')){
    if(await readFile(output,'utf8')!==preview)throw new Error('Stale starter aircraft preview');
  }else await writeFile(output,preview);
}finally{asset.dispose();}
