import * as THREE from 'three';

// Preserve mesh order while carrying each plain material's PBR properties in
// vertex attributes. Textured, physical and custom shader materials are barriers.
export class NativeBatcher {
  constructor() {
    this.layers = new Map(); this.hidden = [];
    this.inverse = new THREE.Matrix4(); this.matrix = new THREE.Matrix4(); this.normal = new THREE.Matrix3(); this.color = new THREE.Vector4();
    this.anchorInverse = new THREE.Matrix4();
    this.stats = { sources: 0, batches: 0 };
  }
  restore() {
    for (const mesh of this.hidden) mesh.visible = true;
    this.hidden.length = 0;
    for (const batches of this.layers.values()) for (const batch of batches) batch.visible = false;
  }
  candidate(mesh) {
    const m=mesh.material,g=mesh.geometry;
    if (!m || Array.isArray(m) || m.userData.nativeBatchExclude || !(m.isMeshStandardMaterial || m.isMeshBasicMaterial)
      || m.isMeshPhysicalMaterial || !m.depthTest || !m.depthWrite || !m.transparent
      || m.side!==THREE.FrontSide || m.blending!==THREE.NormalBlending || m.vertexColors
      || m.map || m.envMap || m.normalMap || m.roughnessMap || m.metalnessMap || m.emissiveMap
      || m.alphaMap || m.aoMap || m.lightMap || m.bumpMap || m.displacementMap
      || m.alphaTest || m.clippingPlanes?.length || m.polygonOffset || m.premultipliedAlpha
      || !g.attributes.normal || mesh.isSkinnedMesh || mesh.isInstancedMesh) return null;
    return `${mesh.layers.mask}:${m.toneMapped}:${m.flatShading || false}:${mesh.receiveShadow}:${mesh.castShadow}`;
  }
  material(source) {
    const m=new THREE.MeshStandardMaterial({vertexColors:true,transparent:true,depthTest:true,depthWrite:true,toneMapped:source.toneMapped,flatShading:source.flatShading || false});
    m.customProgramCacheKey=()=> 'native-palette-v1';
    m.onBeforeCompile=shader=>{
      shader.vertexShader='attribute vec3 batchPbr; attribute vec3 batchEmissive; varying vec3 vBatchPbr; varying vec3 vBatchEmissive;\n'+shader.vertexShader;
      shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvBatchPbr=batchPbr; vBatchEmissive=batchEmissive;');
      shader.fragmentShader='varying vec3 vBatchPbr; varying vec3 vBatchEmissive;\n'+shader.fragmentShader;
      shader.fragmentShader=shader.fragmentShader.replace('vec3 totalEmissiveRadiance = emissive;', 'vec3 totalEmissiveRadiance = vBatchEmissive;')
        .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = vBatchPbr.x;')
        .replace('#include <metalnessmap_fragment>', 'float metalnessFactor = vBatchPbr.y;')
        .replace('#include <opaque_fragment>', 'if(vBatchPbr.z > 0.5) outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>');
    };
    return m;
  }
  update(layers, matricesReady = false) {
    this.stats={sources:0,batches:0};
    for(const layer of layers) {
      if(!layer.visible || !layer.renderable)continue;
      if (!matricesReady) layer.object3D.updateWorldMatrix(true,true);
      this.inverse.copy(layer.object3D.matrixWorld).invert();
      const list=[];layer.object3D.traverseVisible(n=>{if(n.isMesh && !n.userData.nativeBatch)list.push(n);});
      // Three sorts transparent meshes by the nearest Group's renderOrder
      // before mesh.renderOrder. The batch holder must retain that group order,
      // otherwise model surfaces jump ahead of flat effects and glass.
      const groupOrder=mesh=>{for(let p=mesh.parent;p;p=p.parent)if(p.isGroup)return p.renderOrder;return 0;};
      list.sort((a,b)=>groupOrder(a)-groupOrder(b)||a.renderOrder-b.renderOrder);
      let batches=this.layers.get(layer);if(!batches)this.layers.set(layer,batches=[]);
      let used=0,group=[],key;
      const flush=()=>{
        if(group.length>1){let batch=batches[used];const first=group[0];
          if(!batch){batch=new THREE.Mesh(new THREE.BufferGeometry(),this.material(first.material));batch.userData.nativeBatch=true;batch.frustumCulled=false;const holder=new THREE.Group();holder.userData.nativeBatch=true;holder.add(batch);layer.object3D.add(holder);batches[used]=batch;}
          if(batch.userData.paletteKey!==key){batch.material.dispose();batch.material=this.material(first.material);batch.userData.paletteKey=key;}
          batch.parent.renderOrder=groupOrder(first);used++;this.write(batch,group);this.stats.sources+=group.length;this.stats.batches++;
        }group=[];
      };
      for(const mesh of list){const next=this.candidate(mesh);if(next===null){flush();key=null;continue;}if(next!==key){flush();key=next;}group.push(mesh);}flush();
      for(let i=used;i<batches.length;i++)batches[i].visible=false;
    }
  }
  write(batch,group) {
    const length=m=>Math.min(m.geometry.drawRange.count,(m.geometry.index?.count||m.geometry.attributes.position.count)-m.geometry.drawRange.start);
    // Use the first rigid body's local space so its movement/roll changes only
    // one GPU matrix. Unchanged hardware keeps its vertex buffers and uploads.
    const anchor=group[0].parent;
    this.anchorInverse.copy(anchor.matrixWorld).invert();
    batch.matrixAutoUpdate=false;
    batch.matrix.multiplyMatrices(this.inverse,anchor.matrixWorld);
    batch.matrixWorldNeedsUpdate=true;
    const previous=batch.userData.paletteState || [];
    const state=batch.userData.paletteScratch ||= [];state.length=0;
    const transforms=batch.userData.paletteTransforms ||= [];
    const hitStates=batch.userData.paletteHitStates ||= [];
    const anchorWorld=anchor.matrixWorld.elements,anchorScale=Math.max(Math.hypot(anchorWorld[0],anchorWorld[1],anchorWorld[2]),Math.hypot(anchorWorld[4],anchorWorld[5],anchorWorld[6]),Math.hypot(anchorWorld[8],anchorWorld[9],anchorWorld[10]));
    let transformsUsed=0;
    for(const mesh of group){
      const m=mesh.material,g=mesh.geometry;
      const transform=mesh.parent===anchor?mesh.matrix:this.matrix.multiplyMatrices(this.anchorInverse,mesh.matrixWorld);
      (transforms[transformsUsed] ||= new THREE.Matrix4()).copy(transform);
      const hit=hitStates[transformsUsed] ||= new Float64Array(8),feedback=m.userData.nativeHitFeedback;
      hit.fill(0);
      if(feedback?.uniforms.enemyHitGain.value>0){
        feedback.syncWorld();const u=feedback.uniforms,v=u.enemyHitCenter.value,inv=this.anchorInverse.elements,color=u.enemyHitColor.value;
        hit[0]=inv[0]*v.x+inv[4]*v.y+inv[8]*v.z+inv[12];hit[1]=inv[1]*v.x+inv[5]*v.y+inv[9]*v.z+inv[13];hit[2]=inv[2]*v.x+inv[6]*v.y+inv[10]*v.z+inv[14];
        hit[3]=u.enemyHitRadius.value/Math.max(.001,anchorScale);hit[4]=u.enemyHitGain.value;hit[5]=color.r;hit[6]=color.g;hit[7]=color.b;
      }
      transformsUsed++;
      state.push(mesh.id,g.id,g.attributes.position.version,g.attributes.normal.version,g.index?.version??-1,g.drawRange.start,g.drawRange.count,...transform.elements,
        m.color.r,m.color.g,m.color.b,m.opacity,m.roughness,m.metalness,m.emissive?.r,m.emissive?.g,m.emissive?.b,m.emissiveIntensity,m.isMeshBasicMaterial);
      state.push(...hit);
      const filter=m.userData.colorTransform;
      if(filter)state.push(...filter.displayColorMatrix.value.elements,filter.displayColorOffset.value.x,filter.displayColorOffset.value.y,filter.displayColorOffset.value.z,filter.displayColorOffset.value.w);
    }
    const changed=state.length!==previous.length||state.some((value,i)=>value!==previous[i]);
    batch.renderOrder=group[0].renderOrder;batch.layers.mask=group[0].layers.mask;batch.castShadow=group[0].castShadow;batch.receiveShadow=group[0].receiveShadow;batch.visible=true;
    if(!changed){for(const mesh of group){mesh.visible=false;this.hidden.push(mesh);}return;}
    batch.userData.paletteState=state;batch.userData.paletteScratch=previous;
    const count=group.reduce((n,m)=>n+length(m),0);let g=batch.geometry;
    const sizes={position:3,normal:3,color:4,batchPbr:3,batchEmissive:3};
    if(count>(g.attributes.position?.count||0)){g.dispose();g=batch.geometry=new THREE.BufferGeometry();const capacity=Math.max(256,2**Math.ceil(Math.log2(count)));for(const [name,size]of Object.entries(sizes))g.setAttribute(name,new THREE.BufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage));}
    const p=g.attributes.position.array,n=g.attributes.normal.array,c=g.attributes.color.array,params=g.attributes.batchPbr.array,em=g.attributes.batchEmissive.array;
    let out=0;
    for(let meshIndex=0;meshIndex<group.length;meshIndex++){const mesh=group[meshIndex],source=mesh.geometry,m=mesh.material,index=source.index,sp=source.attributes.position,sn=source.attributes.normal;
      this.matrix.copy(transforms[meshIndex]);const e=this.matrix.elements,flip=this.matrix.determinant()<0,normal=this.normal.getNormalMatrix(this.matrix).elements;
      const color=this.color.set(m.color.r,m.color.g,m.color.b,m.opacity),filter=m.userData.colorTransform;
      if(filter){color.applyMatrix4(filter.displayColorMatrix.value).add(filter.displayColorOffset.value);color.set(THREE.MathUtils.clamp(color.x,0,1),THREE.MathUtils.clamp(color.y,0,1),THREE.MathUtils.clamp(color.z,0,1),THREE.MathUtils.clamp(color.w,0,1));}
      const vertexCount=length(mesh);
      const hit=hitStates[meshIndex];
      for(let i=0;i<vertexCount;i++,out++){const local=flip?Math.floor(i/3)*3+(i%3===0?0:i%3===1?2:1):i;const at=source.drawRange.start+local,vi=index?index.getX(at):at;
        const x=sp.getX(vi),y=sp.getY(vi),z=sp.getZ(vi),nx=sn.getX(vi),ny=sn.getY(vi),nz=sn.getZ(vi);
        p[out*3]=e[0]*x+e[4]*y+e[8]*z+e[12];p[out*3+1]=e[1]*x+e[5]*y+e[9]*z+e[13];p[out*3+2]=e[2]*x+e[6]*y+e[10]*z+e[14];
        n[out*3]=normal[0]*nx+normal[3]*ny+normal[6]*nz;n[out*3+1]=normal[1]*nx+normal[4]*ny+normal[7]*nz;n[out*3+2]=normal[2]*nx+normal[5]*ny+normal[8]*nz;
        c[out*4]=color.x;c[out*4+1]=color.y;c[out*4+2]=color.z;c[out*4+3]=color.w;
        params[out*3]=m.roughness??1;params[out*3+1]=m.metalness??0;params[out*3+2]=m.isMeshBasicMaterial?1:0;
        const intensity=m.emissiveIntensity??0;em[out*3]=(m.emissive?.r||0)*intensity;em[out*3+1]=(m.emissive?.g||0)*intensity;em[out*3+2]=(m.emissive?.b||0)*intensity;
        // Contact lighting rides the existing emissive buffer. Keep the same
        // material palette, vertex layout, draw calls and idle upload caching.
        if(hit[4]>0){
          const dx=p[out*3]-hit[0],dy=p[out*3+1]-hit[1],dz=p[out*3+2]-hit[2];
          const t=THREE.MathUtils.clamp((Math.sqrt(dx*dx+dy*dy+dz*dz)/Math.max(.001,hit[3])-.12)/.88,0,1),gain=hit[4]*(1-t*t*(3-2*t));
          em[out*3]+=hit[5]*gain;em[out*3+1]+=hit[6]*gain;em[out*3+2]+=hit[7]*gain;
        }
      }mesh.visible=false;this.hidden.push(mesh);
    }
    for(const [name,size]of Object.entries(sizes)){const attr=g.attributes[name];attr.clearUpdateRanges();attr.addUpdateRange(0,count*size);attr.needsUpdate=true;}
    g.setDrawRange(0,count);
  }
  destroy(){this.restore();for(const batches of this.layers.values())for(const b of batches){b.parent.removeFromParent();b.geometry.dispose();b.material.dispose();}this.layers.clear();}
}
