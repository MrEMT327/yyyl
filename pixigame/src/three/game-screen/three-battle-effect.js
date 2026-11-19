import * as Three from 'three';
import {compilePathogenicCanvasShader} from './battle-material-compiler.ts';

// Geometry and time come from the original battle simulation and authored
// effect sampler. Texture loading, the screen target and bloom belong to
// the enclosing scene and can all use the same Three renderer.
const blendFactors={
  mix:[Three.SrcAlphaFactor,Three.OneMinusSrcAlphaFactor,Three.OneFactor,Three.OneMinusSrcAlphaFactor],
  add:[Three.SrcAlphaFactor,Three.OneFactor,Three.SrcAlphaFactor,Three.OneFactor],
  sub:[Three.SrcAlphaFactor,Three.OneFactor,Three.SrcAlphaFactor,Three.OneFactor],
  mul:[Three.DstColorFactor,Three.ZeroFactor,Three.DstAlphaFactor,Three.ZeroFactor],
  premul_alpha:[Three.OneFactor,Three.OneMinusSrcAlphaFactor,Three.OneFactor,Three.OneMinusSrcAlphaFactor],
};
const white=[1,1,1,1],neutral=[0,0,0,0],fullUV=[0,0,1,1];
const identity3=[1,0,0,0,1,0,0,0,1],identity4=[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const uniform=value=>({value});

export function createBattleEffectPass(renderer,width,height,scene=new Three.Scene()) {
  const camera=new Three.Camera();
  const meshes=new Map(),programs=new Map();
  const projection=new Three.Matrix4(),resolution=new Three.Vector2();
  let frame=0;
  function resize(w,h){
    resolution.set(w,h);
    projection.set(2/w,0,0,-1, 0,-2/h,0,1, 0,0,0,0, 0,0,0,1);
  }
  resize(width,height);
  function compile(source,zeroLights){
    const key=(zeroLights?'0:':'u:')+source.code;
    let program=programs.get(key);
    if(!program){
      program=compilePathogenicCanvasShader(source,{compatibilityZeroLights:zeroLights});
      programs.set(key,program);
    }
    return program;
  }
  function make(program){
    const defaults={
      uProjectionMatrix:projection,uResolution:resolution,uPgViewport:new Three.Vector4(0,0,540,960),uMainSampler:null,uPgTexturePixelSize:new Three.Vector2(),
      uPgTime:0,uPgColor:white,uPgCanvasModulate:white,uPgProjectilePalette:neutral,uPgUvRect:fullUV,
      uPgMainRepeat:0,pgPremult_TEXTURE:0,pgLinearPixelSize_TEXTURE:new Three.Vector2(),
      uPgScreenToLocal:identity3,uPgLocalToScreen:identity3,MODEL_MATRIX:identity4,
    };
    for(const {type,name,defaultValue} of program.uniforms){
      defaults[name]=type==='sampler2D'?null:defaultValue;
      if(type==='sampler2D'){
        defaults['pgPremult_'+name]=0;
        defaults['pgLinearPixelSize_'+name]=new Three.Vector2();
      }
    }
    const [src,dst,alphaSrc,alphaDst]=blendFactors[program.blend];
    const equation=program.blend==='sub'?Three.ReverseSubtractEquation:Three.AddEquation;
    const material=new Three.RawShaderMaterial({
      vertexShader:program.vertex,fragmentShader:program.fragment,
      uniforms:Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,uniform(value)])),
      transparent:true,depthTest:false,depthWrite:false,side:Three.DoubleSide,forceSinglePass:true,
      blending:Three.CustomBlending,blendSrc:src,blendDst:dst,blendSrcAlpha:alphaSrc,blendDstAlpha:alphaDst,
      blendEquation:equation,blendEquationAlpha:equation,
    });
    const geometry=new Three.BufferGeometry();
    geometry.boundingSphere=new Three.Sphere(new Three.Vector3(),1);
    const mesh=new Three.Mesh(geometry,material);
    mesh.onBeforeRender=renderer=>{renderer.getCurrentViewport(material.uniforms.uPgViewport.value);};
    mesh.frustumCulled=false;
    scene.add(mesh);
    return {mesh,program,frame:-1};
  }
  function attribute(geometry,name,count,size,ArrayType,normalized=false){
    let field=geometry.getAttribute(name);
    if(!field||field.count<count){
      let capacity=4;while(capacity<count)capacity*=2;
      field=new Three.BufferAttribute(new ArrayType(capacity*size),size,normalized).setUsage(Three.DynamicDrawUsage);
      geometry.setAttribute(name,field);
    }
    return field;
  }
  function bindTexture(uniforms,name,binding){
    if(!binding?.texture?.isTexture)throw Error('战斗贴图缺失 '+name);
    uniforms[name==='TEXTURE'?'uMainSampler':name].value=binding.texture;
    uniforms['pgPremult_'+name].value=Number(!!binding.premultiplied);
    const linear=uniforms['pgLinearPixelSize_'+name].value;
    if(binding.manualLinear)linear.set(1/binding.width,1/binding.height);
    else linear.set(0,0);
  }
  function disposeEntry(entry){
    scene.remove(entry.mesh);entry.mesh.geometry.dispose();entry.mesh.material.dispose();
  }
  // Inputs are the source sampler's pixel-space vertices; batches with a
  // gradient retain their independent vertex colours, opacity and HDR gain.
  function submit(id,{source,geometry,main,draw,depth=0,line=false,zeroLights=true}){
    const {vertices,indices}=geometry;
    if(!indices.length)return;
    const program=compile(source,zeroLights);
    let entry=meshes.get(id);
    if(!entry||entry.program!==program){
      if(entry)disposeEntry(entry);
      entry=make(program);meshes.set(id,entry);
    }
    const {mesh}=entry,g=mesh.geometry,u=mesh.material.uniforms;
    mesh.visible=true;mesh.renderOrder=depth;entry.frame=frame;
    const oldPositions=g.getAttribute('inPosition');
    // Three releases attribute buffers through the owning geometry. Dispose
    // its GPU allocation before replacing an undersized attribute or index.
    if(oldPositions&&(vertices.length>oldPositions.count||indices.length>g.index.count))g.dispose();
    const position=attribute(g,'inPosition',vertices.length,2,Float32Array);
    const uv=attribute(g,'inTexCoord',vertices.length,2,Float32Array);
    const tint=attribute(g,'inTint',vertices.length,4,Uint8Array,true);
    const [ox,oy]=main.atlasOrigin||[0,0];
    let gain=1;
    if(line)for(const vertex of vertices)gain=Math.max(gain,vertex.color[0],vertex.color[1],vertex.color[2]);
    for(let i=0;i<vertices.length;i++){
      const vertex=vertices[i],[x,y]=vertex.uv;
      position.setXY(i,vertex.position[0],vertex.position[1]);
      uv.setXY(i,line?x:(x-ox)/main.width,line?y:(y-oy)/main.height);
      const color=line?vertex.color:white;
      // The authored vertex program expects the little-endian B,G,R,A tint
      // byte layout. Preserve the reference's 8-bit quantization.
      for(let k=0;k<3;k++)tint.array[i*4+k]=Math.round(Math.max(0,Math.min(1,color[2-k]/gain))*255);
      tint.array[i*4+3]=Math.floor(Math.max(0,Math.min(1,color[3]))*255);
    }
    position.needsUpdate=uv.needsUpdate=tint.needsUpdate=true;
    let index=g.index;
    if(!index||index.count<indices.length){
      let capacity=6;while(capacity<indices.length)capacity*=2;
      index=new Three.Uint32BufferAttribute(capacity,1).setUsage(Three.DynamicDrawUsage);g.setIndex(index);
    }
    index.array.set(indices);index.needsUpdate=true;g.setDrawRange(0,indices.length);
    u.uPgTime.value=draw.time;u.uPgColor.value=draw.color||white;
    u.uPgProjectilePalette.value=draw.projectilePalette||neutral;u.uPgCanvasModulate.value=draw.canvasModulate||white;
    u.uPgUvRect.value=draw.uvRect||fullUV;u.uPgMainRepeat.value=Number(!!draw.mainRepeat);
    u.uPgTexturePixelSize.value.set(1/main.width,1/main.height);
    u.uPgScreenToLocal.value=draw.screenToLocal||identity3;
    u.uPgLocalToScreen.value=draw.localToScreen||identity3;u.MODEL_MATRIX.value=draw.modelMatrix||identity4;
    bindTexture(u,'TEXTURE',main);
    for(const {name,type,defaultValue} of program.uniforms){
      if(type==='sampler2D')bindTexture(u,name,draw.textures?.[name]);
      else u[name].value=draw.uniforms?.[name]??defaultValue;
    }
    return mesh;
  }
  function finish(){
      for(const [id,entry] of meshes){
        if(entry.frame===frame)continue;
        disposeEntry(entry);meshes.delete(id);
      }
  }
  return {
    begin(){frame++;},resize,submit,scene,compile,finish,
    draw(){finish();renderer.render(scene,camera);},
    dispose(){for(const entry of meshes.values())disposeEntry(entry);meshes.clear();programs.clear();}
  };
}
