import {Matrix3,Vector3} from 'three';

// Representative-only surface cleanup. Source paint, silhouette, topology,
// joints and sockets remain authored; no camera or opacity changes.
export function softenArmorSeams({entry,solid,materials}) {
  // V40 has authored clean surfaces; do not layer the older pilot patch on it.
  if(entry.slug!=='kestrel'||Number(entry.version.split('.')[0])!==39)return;
  const surfaces=new Map(),original=new Map(),owned=[];
  solid.traverse(node=>{if(node.isMesh){surfaces.set(node.name,node);original.set(node,node.material);}});
  const shell=[...materials.values()].find(m=>m.name==='kestrel/shell');
  const dark=[...materials.values()].find(m=>m.name==='kestrel/dark');
  if(!shell||!dark)return;
  const variants=new Map();
  function finish(source,role,thin=false) {
    const key=`${source.uuid}/${role}/${thin}`;
    if(variants.has(key))return variants.get(key);
    const material=source.clone();
    material.name=`${source.name}/seam-${role}`;
    material.userData={...material.userData,armorSeamTreatment:role};
    if(role!=='plate') {
      material.roughness=.82;material.metalness=.1;material.envMapIntensity=.18;
      material.normalMap=null;material.roughnessMap=null;material.metalnessMap=null;
      if(material.isMeshPhysicalMaterial)material.clearcoat=0;
    }
    if(thin) {
      const compile=source.onBeforeCompile,program=source.customProgramCacheKey();
      material.onBeforeCompile=function(shader,renderer) {
        compile.call(this,shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
          // Thin overlapping armor becomes subpixel strips at grazing views.
          // Reduce that local contrast while keeping the full opaque surface,
          // original front-facing PBR response and all large paint regions.
          float seamFacing=abs(dot(normalize(vNormal),isOrthographic?vec3(0.,0.,1.):normalize(vViewPosition)));
          outgoingLight*=mix(.12,1.,smoothstep(.08,.32,seamFacing));
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey=()=>`${program}/armor-seam-grazing-v1`;
    }
    variants.set(key,material);materials.set(material.uuid,material);
    return material;
  }
  solid.updateWorldMatrix(true,true);
  for(const [name,node] of surfaces) {
    if(/\/(navigation-access|inspection-hatch)\/(joint|lock-[^/]+|handle)(\/|$)/.test(name)
      ||/^wing--?1\/fastener-/.test(name)) {
      const material=finish(shell,'service-joint');
      material.color.copy(shell.color).lerp(dark.color,.10);
      node.material=material;continue;
    }
    if(/^intake--?1\/inset-vane-/.test(name)
      ||/^wing--?1\/structural-airfoil\//.test(name)
      ||/^intake--?1\/raked-black-opening\//.test(name)
      ||/^shoulder--?1\/visible-engine-inner-housing\//.test(name)) {
      node.material=finish(dark,'core');continue;
    }
    const thin=/^wing--?1\/(?!structural-airfoil|rear-navigation-light)/.test(name)
      ||/^shoulder--?1\/(ivory-lower-wrap|ivory-shoulder-field)\//.test(name);
    if(thin&&name.endsWith('/face')) {node.material=finish(original.get(node),'plate',true);continue;}
    if(!/\/(bevel|edge)$/.test(name)
      ||!/^(wing--?1\/|keel\/ivory-spear\/|intake--?1\/|shoulder--?1\/)/.test(name))continue;
    const face=surfaces.get(name.replace(/\/(bevel|edge)$/,'/face'));
    const paint=original.get(face);
    if(!paint?.isMeshStandardMaterial||paint.transparent)continue;
    node.material=finish(paint,'edge',thin);
    if(!thin)continue;
    // Tiny bevels share their plate's broad lighting instead of creating an
    // independent bright stripe. Only instance normals change, not thickness.
    const normals=face.geometry?.attributes.normal,target=node.geometry?.attributes.normal;
    if(!normals||!target)continue;
    const direction=new Vector3(),sample=new Vector3();
    for(let i=0;i<normals.count;i++)direction.add(sample.fromBufferAttribute(normals,i));
    if(direction.lengthSq()<1e-8)continue;
    direction.normalize().applyNormalMatrix(new Matrix3().getNormalMatrix(face.matrixWorld));
    direction.applyNormalMatrix(new Matrix3().getNormalMatrix(node.matrixWorld).invert());
    const geometry=node.geometry.clone();
    geometry.userData={...geometry.userData,armorSeamNormals:true};
    for(let i=0;i<target.count;i++)geometry.attributes.normal.setXYZ(i,direction.x,direction.y,direction.z);
    node.geometry=geometry;owned.push(geometry);
  }
  return {dispose(){for(const geometry of owned)geometry.dispose();}};
}
