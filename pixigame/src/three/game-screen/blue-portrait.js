import * as T from 'three';
import vertexShader from './blue-portrait.vert.glsl?raw';
import fragmentShader from './blue-portrait.frag.glsl?raw';
import {createBluePose} from './blue-pose.js';
import {mountPortraitSurface} from './h5-portrait.js';

async function readArtwork(base,signal){
  const read=async(path,type)=>{
    const r=await fetch(new URL(path,base),{signal});if(!r.ok)throw Error('立绘资源加载失败 '+path);return r[type]();
  };
  async function image(path){
    const element=new Image();
    const abort=()=>element.removeAttribute('src');
    signal.addEventListener('abort',abort,{once:true});
    try{
      signal.throwIfAborted();element.src=new URL(path,base).href;await element.decode();signal.throwIfAborted();return element;
    }finally{signal.removeEventListener('abort',abort);}
  }
  const bundle=await read('bundle.json','json'),images=new Map(),streams=new Map(),parts=[];
  for(const spec of bundle.parts){
    signal.throwIfAborted();
    if(!images.has(spec.texture))images.set(spec.texture,await image(spec.texture));
    const frames={};
    for(const motion of ['main3','idle']){
      const url=spec[motion];
      if(!streams.has(url))streams.set(url,new Float32Array(await read(url,'arrayBuffer')));
      frames[motion]=streams.get(url);
    }
    const projectionModel=spec.rigidProjectionModel?await read(spec.rigidProjectionModel,'json'):null;
    parts.push({...spec,rest:new Float32Array(spec.rest.flat()),uv:new Float32Array(spec.uv??spec.rest.flatMap(([x,y])=>[x/1568,y/1003])),
      streams:frames,projectionModel});
  }
  const original=await image(bundle.headOriginalTexture??'normalized-head__approved-original.png');
  return {parts,bundle,images,original};
}

function meshTexture(image,mipmaps){
  const t=new T.Texture(image);t.flipY=false;t.premultiplyAlpha=true;t.colorSpace=T.NoColorSpace;
  t.generateMipmaps=mipmaps;t.minFilter=mipmaps?T.LinearMipmapLinearFilter:T.LinearFilter;t.magFilter=T.LinearFilter;t.needsUpdate=true;return t;
}

function createJointSupport(view){
  const geometry=new T.BufferGeometry(),segments=16,positions=new Float32Array((segments+1)*4),shades=[],indices=[];
  const attr=new T.BufferAttribute(positions,2).setUsage(T.DynamicDrawUsage);
  for(let row=0;row<2;row++)for(let i=0;i<=segments;i++)shades.push(.40+.30*Math.cos(-Math.PI/2+Math.PI*i/segments+.35));
  for(let i=0;i<segments;i++)indices.push(i,i+1,i+segments+1,i+1,i+segments+2,i+segments+1);
  geometry.setAttribute('aPoint',attr);geometry.setAttribute('aShade',new T.Float32BufferAttribute(shades,1));geometry.setIndex(indices);
  const material=new T.RawShaderMaterial({
    glslVersion:T.GLSL3,
    vertexShader:'in vec2 aPoint;in float aShade;uniform vec4 uView;out float vShade;void main(){vec2 p=(aPoint-uView.xy)/uView.zw;gl_Position=vec4(p.x*2.-1.,1.-p.y*2.,0.,1.);vShade=aShade;}',
    fragmentShader:'precision highp float;in float vShade;out vec4 frag;void main(){frag=vec4(vec3(.18,.20,.24)+vShade*vec3(.35,.36,.39),1.);}',
    uniforms:{uView:{value:view}},depthTest:false,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,transparent:true
  });
  const mesh=new T.Mesh(geometry,material);mesh.frustumCulled=false;
  return {mesh,update(pose){
    if(!pose){mesh.visible=false;return;}
    mesh.visible=true;
    const [angle,tilt,jx,jy]=pose,c=Math.cos(angle),s=Math.sin(angle),q=Math.cos(tilt),t=Math.sin(tilt);let offset=0;
    for(const x of [-2,48])for(let i=0;i<=segments;i++){
      const a=-Math.PI/2+Math.PI*i/segments,r=11.5+Math.max(0,x)/48*1.5,y=Math.sin(a)*r,z=Math.cos(a)*r;
      positions[offset++]=jx+c*q*x-s*y-c*t*z;positions[offset++]=jy+s*q*x+c*y-s*t*z;
    }
    attr.needsUpdate=true;
  },dispose(){material.dispose();geometry.dispose();}};
}

function createBlueScene(renderer,data){
  const scene=new T.Scene(),camera=new T.Camera(),textures=new Map(),view=new T.Vector4(),viewport=new T.Vector2();
  const original=meshTexture(data.original,false),joint=createJointSupport(view),ordered=[];
  scene.add(joint.mesh);
  const cannon=data.parts.find(p=>p.projectionModel);
  for(const p of data.parts){
    const key=p.texture+'|'+Boolean(p.generatedMaterial);
    if(!textures.has(key))textures.set(key,meshTexture(data.images.get(p.texture),Boolean(p.generatedMaterial)));
    const geometry=new T.BufferGeometry(),position=new T.BufferAttribute(p.pose,2).setUsage(T.DynamicDrawUsage);
    geometry.setAttribute('aPosition',position);geometry.setAttribute('aUV',new T.BufferAttribute(p.uv,2));
    geometry.setAttribute('aCoverage',new T.BufferAttribute(p.coverageUV?new Float32Array(p.coverageUV):new Float32Array(p.pose.length),2));
    geometry.setIndex(p.projection?new T.BufferAttribute(p.projection.indices,1).setUsage(T.DynamicDrawUsage):p.indices);
    const uniforms={uView:{value:view},uViewport:{value:viewport},uOriginal:{value:original},uTexture:{value:textures.get(key)},
      uHipFringeRepair:{value:p.name==='body'?1:0},uCoverageFilter:{value:p.generatedMaterial?0:1},uSharedSurfaceAlpha:{value:p.sharedSurfaceAlpha?1:0},
      uNativeMaterial:{value:p.nativeMaterial??0},uNativeMask:{value:original},uNativeMaskReady:{value:false},
      uNativeMultiply:{value:new T.Vector3(1,1,1)},uNativeScreen:{value:new T.Vector3()},
      uOpacity:{value:1},uMaterialDomainMode:{value:0},uMaterialDomain:{value:new T.Vector4()},
      uWire:{value:false},uEyeMask:{value:new T.Vector4(...(p.eyeMask??[0,0,0,0]))},
      uEyeAngle:{value:p.eyeAngle??0},uOpen:{value:1},uAlphaThreshold:{value:p.alphaThreshold??0}};
    const mat=new T.RawShaderMaterial({glslVersion:T.GLSL3,vertexShader,fragmentShader,uniforms,
      transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,toneMapped:false,
      blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor});
    const mesh=new T.Mesh(geometry,mat);mesh.frustumCulled=false;scene.add(mesh);
    ordered.push({p,mesh,position,geometry,uniforms});
  }
  return {draw(frameView,key,frame,width,height){
    view.fromArray(frameView);viewport.set(width,height);
    ordered.sort((a,b)=>a.p.orderNow-b.p.orderNow||a.p.ordinal-b.p.ordinal);
    for(let i=0;i<ordered.length;i++){
      const {p,mesh,position,geometry,uniforms}=ordered[i];
      mesh.renderOrder=i*2+1;mesh.visible=p.alpha>=1e-6;
      if(p.name==='integrated_upper_yoke_v28')joint.mesh.renderOrder=i*2;
      if(!mesh.visible)continue;
      position.needsUpdate=true;
      if(p.projection){geometry.index.needsUpdate=true;geometry.setDrawRange(0,p.projection.count);}
      uniforms.uOpacity.value=p.alpha;uniforms.uOpen.value=1-p.eye;
      const domain=p.materialDomainTracks?.[key]?.[frame];
      uniforms.uMaterialDomainMode.value=domain?p.materialDomainMode:0;if(domain)uniforms.uMaterialDomain.value.fromArray(domain);
      const multiply=p.multiplyTracks?.[frame],screen=p.screenTracks?.[frame];
      if(multiply)uniforms.uNativeMultiply.value.fromArray(multiply);
      if(screen)uniforms.uNativeScreen.value.fromArray(screen);
    }
    joint.update(cannon?.rigidPose);renderer.render(scene,camera);
  },dispose(){
    for(const {mesh,geometry} of ordered){geometry.dispose();mesh.material.dispose();}
    joint.dispose();original.dispose();for(const tex of textures.values())tex.dispose();
  }};
}

export function createBluePortrait(canvas,{assetBase},monitor,device){
  let data=null,player=null,pose=null,closed=false;
  return {
    view:[372,-35,824,1054],
    async load({signal}){
      const loaded=await readArtwork(assetBase,signal);signal.throwIfAborted();if(closed)return;
      data=loaded;data.parts.forEach((p,i)=>{p.ordinal=i;});pose=createBluePose(data.parts,data.bundle);
      player=mountPortraitSurface(canvas,monitor,device,r=>createBlueScene(r,data));
    },
    draw(key,frame,{blend=null}={}){
      if(!player)return;
      pose.update(key,frame,blend);player.resize(canvas.width,canvas.height);player.draw(this.view,key,frame);
    },
    get last(){return pose?.snapshot()??null;},
    get bundle(){return data?.bundle;},get canvas(){return player?.canvas??canvas;},
    captureFrame(size){return player?.captureFrame(size)??null;},
    destroy(){closed=true;player?.destroy();player=null;pose=null;data=null;}
  };
}

