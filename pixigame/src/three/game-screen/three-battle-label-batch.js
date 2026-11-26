import * as T from 'three';

const stride=10;
export const minLabelsToBatch=8;
const maxGlyphs=16384;

export function createBattleLabelBatch(scene,mesh){
  mesh.visible=false;
  mesh.geometry=new T.BufferGeometry();
  mesh.geometry.boundingSphere=new T.Sphere(new T.Vector3(),1);
  mesh.userData.ownsGeometry=true;
  mesh.material.defines.GLYPH_RUN=1;
  mesh.material.defines.GLYPH_BATCH=1;
  const u=mesh.material.uniforms;
  u.otherArt={value:u.art.value};
  u.otherPremult={value:0};

  const labels=[],otherDepths=new Set(),matrix=new T.Matrix4();
  let capacity=0,data;
  function reserve(glyphs){
    if(capacity>=glyphs)return;
    const geometry=mesh.geometry;
    if(data)geometry.dispose();
    capacity=Math.max(256,capacity);
    while(capacity<glyphs)capacity*=2;
    data=new T.InterleavedBuffer(new Float32Array(capacity*4*stride),stride).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('position',new T.InterleavedBufferAttribute(data,3,0));
    geometry.setAttribute('uv',new T.InterleavedBufferAttribute(data,2,3));
    geometry.setAttribute('glyphColor',new T.InterleavedBufferAttribute(data,4,5));
    geometry.setAttribute('glyphAtlas',new T.InterleavedBufferAttribute(data,1,9));
    const indices=new Uint16Array(capacity*6);
    for(let i=0;i<capacity;i++){
      const v=i*4,p=i*6;
      indices[p]=v;indices[p+1]=v+2;indices[p+2]=v+1;
      indices[p+3]=v+2;indices[p+4]=v+3;indices[p+5]=v+1;
    }
    geometry.setIndex(new T.BufferAttribute(indices,1));
  }
  reserve(256);

  function collect(node){
    if(node.material?.defines?.GLYPH_RUN&&node.material.visible){
      if(node.geometry.drawRange.count>0)labels.push(node);
    }else otherDepths.add(node.renderOrder);
  }
  function prepare(){
    if(labels.length<minLabelsToBatch)return 0;
    const depth=labels[0].renderOrder;
    if(otherDepths.has(depth))return 0;
    const first=labels[0].material.uniforms;
    let second,glyphs=0;
    for(const label of labels){
      const {start,count}=label.geometry.drawRange,ink=label.material.uniforms;
      if(label.renderOrder!==depth||label.parent?.parent!==scene||label.parent.renderOrder!==0||
        start!==0||count%6||ink.fill.value||ink.statusTint.value.w)return 0;
      if(ink.art.value!==first.art.value||ink.premult.value!==first.premult.value){
        if(second&&(ink.art.value!==second.art.value||ink.premult.value!==second.premult.value))return 0;
        second=ink;
      }
      glyphs+=count/6;
    }
    if(glyphs>maxGlyphs)return 0;
    reserve(glyphs);
    // Transparent meshes at this depth are all at z=0. Keep their original
    // creation order even when digits and Chinese labels overlap.
    labels.sort((a,b)=>a.id-b.id);
    const values=data.array;
    let offset=0;
    for(const label of labels){
      const parent=label.parent;
      if(parent.matrixAutoUpdate)parent.updateMatrix();
      if(label.matrixAutoUpdate)label.updateMatrix();
      const m=matrix.multiplyMatrices(parent.matrix,label.matrix).elements;
      if(m[2]||m[6]||m[14])return 0;
      const geometry=label.geometry,ink=label.material.uniforms;
      const pos=geometry.getAttribute('position').array,uv=geometry.getAttribute('uv').array;
      const {x:r,y:g,z:b}=ink.tint.value,alpha=ink.opacity.value;
      const atlas=ink.art.value===first.art.value&&ink.premult.value===first.premult.value?0:1;
      const count=geometry.drawRange.count/6*4;
      for(let i=0;i<count;i++){
        const x=pos[i*3],y=pos[i*3+1];
        values[offset++]=m[0]*x+m[4]*y+m[12];
        values[offset++]=m[1]*x+m[5]*y+m[13];
        values[offset++]=0;
        values[offset++]=uv[i*2];values[offset++]=uv[i*2+1];
        values[offset++]=r;values[offset++]=g;values[offset++]=b;values[offset++]=alpha;
        values[offset++]=atlas;
      }
    }
    u.art.value=first.art.value;u.premult.value=first.premult.value;
    u.otherArt.value=(second??first).art.value;u.otherPremult.value=(second??first).premult.value;
    data.clearUpdateRanges();data.addUpdateRange(0,offset);data.needsUpdate=true;
    mesh.geometry.setDrawRange(0,glyphs*6);
    mesh.renderOrder=depth;mesh.layers.mask=labels[0].layers.mask;
    mesh.visible=true;
    for(const label of labels)label.visible=false;
    return labels.length-1;
  }
  function restore(){
    if(mesh.visible){
      for(const label of labels)label.visible=true;
      mesh.visible=false;
    }
    labels.length=0;otherDepths.clear();
  }
  return {collect,prepare,restore};
}
