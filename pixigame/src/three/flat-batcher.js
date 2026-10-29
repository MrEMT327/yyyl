import * as THREE from 'three';
import {GraphicsBatcher} from './graphics-batcher.js';

// Extend the ordered Graphics path to nested display nodes and bitmap text.
// A font atlas and untextured shapes share a pass using a per-vertex map weight.
// Premultiplied output with zero alpha implements additive RGB inside the same
// ordered blend pass. Bloom-only rendering discards unselected triangles;
// the main camera still draws both kinds in their original triangle order.
export class FlatBatcher extends GraphicsBatcher {
  constructor(){super();this.inverse=new THREE.Matrix4();this.legacy=new GraphicsBatcher();}
  restore(){super.restore();this.legacy.restore();}
  destroy(){super.destroy();this.legacy.destroy();}
  candidateMesh(mesh){
    const n=mesh.parent?.userData.display,m=mesh.material,g=mesh.geometry;
    if(!n || !(n._mesh===mesh || n._meshes?.includes(mesh)) || !m?.isMeshBasicMaterial
      || m.depthTest || m.depthWrite || m.userData.colorTransform || m.clippingPlanes?.length
      || m.alphaTest || !m.forceSinglePass || !m.transparent || m.side!==THREE.DoubleSide
      || ![THREE.NormalBlending,THREE.AdditiveBlending].includes(m.blending))return null;
    if(m.map && (m.map.offset.x || m.map.offset.y || m.map.rotation || m.map.repeat.x!==1 || m.map.repeat.y!==1))return null;
    const count=Math.min(g.drawRange.count,(g.index?.count||g.attributes.position.count)-g.drawRange.start);
    if(!(count>0))return null;
    return {mesh,count,key:`${m.toneMapped}`};
  }
  update(layers,bloomEnabled=true,recursive=true,matricesReady=false){
    if(!recursive){this.legacy.update(layers,bloomEnabled);this.stats=this.legacy.stats;return;}
    this.stats={sources:0,batches:0,savedDraws:0};
    for(const layer of layers){
      if(!layer.visible || !layer.renderable)continue;
      if(!matricesReady)layer.object3D.updateWorldMatrix(true,true);this.inverse.copy(layer.object3D.matrixWorld).invert();
      const list=[];layer.object3D.traverseVisible(n=>{if(n.isMesh && !n.userData.graphicsBatch && !n.userData.nativeBatch)list.push(n);});list.sort((a,b)=>a.renderOrder-b.renderOrder);
      let batches=this.layers.get(layer);if(!batches)this.layers.set(layer,batches=[]);
      let used=0,group=[],key,map=null;
      const flush=()=>{if(group.length>1){let batch=batches[used];
        if(!batch){const material=new THREE.MeshBasicMaterial({vertexColors:true,transparent:true,toneMapped:false,depthTest:false,depthWrite:false,side:THREE.DoubleSide,forceSinglePass:true,premultipliedAlpha:true});
          material.userData.bloomPass={value:0};
          material.customProgramCacheKey=()=> 'flat-atlas-v2';material.onBeforeCompile=shader=>{
            shader.uniforms.batchBloomPass=material.userData.bloomPass;
            shader.vertexShader='attribute float batchMap; attribute float batchAdditive; attribute float batchBloom; varying float vBatchMap; varying float vBatchAdditive; varying float vBatchBloom;\n'+shader.vertexShader;
            shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvBatchMap=batchMap;vBatchAdditive=batchAdditive;vBatchBloom=batchBloom;');
            shader.fragmentShader='varying float vBatchMap; varying float vBatchAdditive; varying float vBatchBloom; uniform float batchBloomPass;\n'+shader.fragmentShader;
            shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\nif(batchBloomPass>0.5 && vBatchBloom<0.5) discard;')
              .replace('#include <premultiplied_alpha_fragment>', 'gl_FragColor.rgb *= gl_FragColor.a; if(vBatchAdditive>0.5)gl_FragColor.a=0.;');
            shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#ifdef USE_MAP\nif(vBatchMap>0.5) diffuseColor *= texture2D(map,vMapUv);\n#endif');
          };
          batch=new THREE.Mesh(new THREE.BufferGeometry(),material);batch.frustumCulled=false;batch.userData.graphicsBatch=true;batch.onBeforeRender=(_r,_s,camera)=>{material.userData.bloomPass.value=camera.layers.mask===2?1:0;};layer.object3D.add(batch);batches[used]=batch;
        }
        used++;this.writeFlat(batch,group,map);this.stats.sources+=group.length;this.stats.batches++;this.stats.savedDraws+=group.reduce((n,{mesh})=>n+1+(bloomEnabled&&(mesh.layers.mask&2)?1:0),0)-1-(bloomEnabled&&(batch.layers.mask&2)?1:0);
      }group=[];map=null;};
      for(const mesh of list){const candidate=this.candidateMesh(mesh);if(!candidate){flush();key=null;continue;}
        if(candidate.key!==key || (map && mesh.material.map && map!==mesh.material.map)){flush();key=candidate.key;}
        map ||= mesh.material.map;group.push(candidate);
      }flush();for(let i=used;i<batches.length;i++)batches[i].visible=false;
    }
  }
  writeFlat(batch,group,map){
    const sizes={position:3,color:4,uv:2,batchMap:1,batchAdditive:1,batchBloom:1};
    const count=group.reduce((n,g)=>n+g.count,0);
    let geo=batch.geometry,reset=false;
    if(count>(geo.attributes.position?.count||0)){
      geo.dispose();geo=batch.geometry=new THREE.BufferGeometry();reset=true;
      const capacity=Math.max(128,2**Math.ceil(Math.log2(count)));
      for(const[name,size]of Object.entries(sizes))geo.setAttribute(name,new THREE.BufferAttribute(new Float32Array(capacity*size),size).setUsage(THREE.DynamicDrawUsage));
    }
    const states=batch.userData.flatStates ||= [];
    const dirty={};
    for(const name of Object.keys(sizes))dirty[name]=[Infinity,0];
    const mark=(name,start,end)=>{dirty[name][0]=Math.min(dirty[name][0],start);dirty[name][1]=Math.max(dirty[name][1],end);};
    const p=geo.attributes.position.array,c=geo.attributes.color.array,uv=geo.attributes.uv.array;
    let offset=0,slot=0;
    for(const{mesh,count}of group){
      const g=mesh.geometry,mat=mesh.material,sp=g.attributes.position,sc=g.attributes.color,suv=g.attributes.uv,index=g.index;
      const e=this.matrix.multiplyMatrices(this.inverse,mesh.matrixWorld).elements;
      const old=states[slot] ||= {matrix:new Float64Array(16)};
      const layout=reset||old.mesh!==mesh.id||old.geometry!==g.id||old.offset!==offset||old.count!==count||old.start!==g.drawRange.start||old.index!==index||old.indexVersion!==index?.version;
      let moved=layout;for(let j=0;j<16;j++)if(old.matrix[j]!==e[j]){moved=true;break;}
      const positionChanged=moved||old.position!==sp||old.positionVersion!==sp.version;
      const colorChanged=layout||old.color!==sc||old.colorVersion!==sc?.version||old.r!==mat.color.r||old.g!==mat.color.g||old.b!==mat.color.b||old.alpha!==mat.opacity;
      const uvChanged=layout||old.uv!==suv||old.uvVersion!==suv?.version;
      const mapped=mat.map?1:0,additive=mat.blending===THREE.AdditiveBlending?1:0,bloom=(mesh.layers.mask&2)?1:0;
      if(positionChanged||colorChanged||uvChanged){
        for(let i=0;i<count;i++){
          const out=offset+i,at=g.drawRange.start+i,vi=index?index.getX(at):at;
          if(positionChanged){const x=sp.getX(vi),y=sp.getY(vi),z=sp.getZ(vi);
            p[out*3]=e[0]*x+e[4]*y+e[8]*z+e[12];p[out*3+1]=e[1]*x+e[5]*y+e[9]*z+e[13];p[out*3+2]=e[2]*x+e[6]*y+e[10]*z+e[14];}
          if(colorChanged){c[out*4]=(sc?.getX(vi)??1)*mat.color.r;c[out*4+1]=(sc?.getY(vi)??1)*mat.color.g;c[out*4+2]=(sc?.getZ(vi)??1)*mat.color.b;c[out*4+3]=(sc?.itemSize===4?sc.getW(vi):1)*mat.opacity;}
          if(uvChanged){uv[out*2]=suv?.getX(vi)||0;uv[out*2+1]=suv?.getY(vi)||0;}
        }
      }
      if(layout||mapped!==old.mapped){geo.attributes.batchMap.array.fill(mapped,offset,offset+count);mark('batchMap',offset,offset+count);}
      if(layout||additive!==old.additive){geo.attributes.batchAdditive.array.fill(additive,offset,offset+count);mark('batchAdditive',offset,offset+count);}
      if(layout||bloom!==old.bloom){geo.attributes.batchBloom.array.fill(bloom,offset,offset+count);mark('batchBloom',offset,offset+count);}
      if(positionChanged)mark('position',offset,offset+count);
      if(colorChanged)mark('color',offset,offset+count);
      if(uvChanged)mark('uv',offset,offset+count);
      old.matrix.set(e);old.mesh=mesh.id;old.geometry=g.id;old.offset=offset;old.count=count;old.start=g.drawRange.start;
      old.index=index;old.indexVersion=index?.version;old.position=sp;old.positionVersion=sp.version;
      old.color=sc;old.colorVersion=sc?.version;old.uv=suv;old.uvVersion=suv?.version;
      old.r=mat.color.r;old.g=mat.color.g;old.b=mat.color.b;old.alpha=mat.opacity;
      old.mapped=mapped;old.additive=additive;old.bloom=bloom;
      offset+=count;slot++;mesh.visible=false;this.hidden.push(mesh);
    }
    // Keep state bounded when particle counts shrink; no references to removed
    // source geometry survive beyond the active ordered batch.
    states.length=slot;
    for(const[name,size]of Object.entries(sizes)){
      const[start,end]=dirty[name];if(end<=start)continue;
      const attr=geo.attributes[name];
      // Keep pending ranges until Three uploads them; multiple preparations may
      // happen before a draw, including after a hidden/off-screen interval.
      attr.addUpdateRange(start*size,(end-start)*size);attr.needsUpdate=true;
    }
    geo.setDrawRange(0,count);batch.renderOrder=group[0].mesh.renderOrder;batch.layers.mask=group.reduce((mask,{mesh})=>mask|mesh.layers.mask,0);
    if(batch.material.map!==map||batch.material.toneMapped!==group[0].mesh.material.toneMapped){batch.material.map=map;batch.material.toneMapped=group[0].mesh.material.toneMapped;batch.material.needsUpdate=true;}
    batch.material.blending=THREE.NormalBlending;batch.visible=true;
  }

}
