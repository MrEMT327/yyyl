// The Kestrel wing bays use intersecting closed boxes. Their floor, rear wall
// and side walls share some exterior planes with different paint colors.
// Give only those confirmed overlaps deterministic depth precedence; leave
// positions, normals, paint, joints and all exposed wing sheets intact.
export function stabilizeAircraftPanelDepth(root){
  const originals=[],copies=new Map();
  root.traverse(mesh=>{
    if(!mesh.isMesh||Array.isArray(mesh.material))return;
    const match=/^V38\/kestrel-microbay--?1\/(floor|rear-bulkhead)$/.exec(mesh.name);
    if(!match||!mesh.material?.isMeshStandardMaterial||mesh.material.transparent||!mesh.material.depthWrite)return;
    const source=mesh.material,units=match[1]==='floor'?4:2,key=source.uuid+':'+units;
    let material=copies.get(key);
    if(!material){
      material=source.clone();material.polygonOffset=true;
      material.onBeforeCompile=source.onBeforeCompile;material.customProgramCacheKey=source.customProgramCacheKey;
      if(source.uniforms)material.uniforms=source.uniforms;
      // Units alone avoid a large slope-dependent displacement at grazing views.
      material.polygonOffsetFactor=0;material.polygonOffsetUnits=units;
      copies.set(key,material);
    }
    originals.push([mesh,source,material]);mesh.material=material;
  });
  return {
    get count(){return originals.length;},
    dispose(){
      for(const [mesh,source,material]of originals)if(mesh.material===material)mesh.material=source;
      for(const material of copies.values())material.dispose();originals.length=0;copies.clear();
    },
  };
}
