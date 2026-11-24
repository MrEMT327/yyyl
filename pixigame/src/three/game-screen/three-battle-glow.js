import * as T from 'three';
import {GLES_GLOW_GLSL} from '../../../replica-battle/kernel/pathogenic/pathogenic-color-math.mjs';
import {DIMENSION_SWORD_GLSL} from '../../../replica-battle/kernel/pathogenic/dimension-sword-shader.mjs';

const vert=`attribute vec3 position;attribute vec2 uv;varying vec2 vUv;
void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}`;
const frag=`precision highp float;
varying vec2 vUv; uniform sampler2D uInput,uScene;
uniform vec2 uPixel;uniform float uMode,uIntensity;uniform vec4 uFilter;
`+GLES_GLOW_GLSL+DIMENSION_SWORD_GLSL+`
vec3 tap(vec2 uv){vec3 c=texture2D(uInput,uv).rgb;
 if(max(c.r,max(c.g,c.b))<=uFilter.x&&uFilter.z<=0.)return vec3(0.);
 return godotGlowFilter(c,uFilter.x,uFilter.y,uFilter.z,uFilter.w);}
void main(){
 if(uMode<.5){gl_FragColor=texture2D(uInput,vUv);return;}
 if(uMode<1.5){vec2 h=uPixel*.5;vec3 c=tap(vUv)*4.;c+=tap(vUv-h)+tap(vUv+h)+tap(vUv-vec2(h.x,-h.y))+tap(vUv+vec2(h.x,-h.y));gl_FragColor=vec4(c/8.,1.);return;}
 if(uMode<2.5){gl_FragColor=godotGlowDownsample(uInput,vUv,uPixel);return;}
 if(uMode<3.5){gl_FragColor=godotGlowUpsample(uInput,vUv,uPixel);return;}gl_FragColor=dimensionResolve();
}`;

export function createBattleGlow(renderer,w,h){
  const target=(x,y,type=T.HalfFloatType)=>new T.WebGLRenderTarget(x,y,{type,minFilter:T.LinearFilter,magFilter:T.LinearFilter,depthBuffer:false,stencilBuffer:false});
  const world=target(w,h),back=target(w,h,T.UnsignedByteType),down=[],up=[];
  let x=w,y=h;for(let i=0;i<3;i++){x=Math.max(4,Math.floor(x/2));y=Math.max(4,Math.floor(y/2));down.push(target(x,y));if(i<2)up.push(target(x,y));}
  const vectors=()=>Array.from({length:3},()=>new T.Vector4());
  const values={uInput:null,uScene:null,uPixel:new T.Vector2(),uMode:0,uFilter:new T.Vector4(1,.25,0,3),uIntensity:1.45,
    uDimensionCount:0,uDimensionViewport:new T.Vector2(w,h),uDimensionLine:vectors(),uDimensionShape:vectors(),uDimensionStyle:vectors()};
  const u=Object.fromEntries(Object.entries(values).map(([key,value])=>[key,{value}]));
  const geometry=new T.PlaneGeometry(2,2);
  const material=new T.RawShaderMaterial({vertexShader:vert,fragmentShader:frag,uniforms:u,depthTest:false,depthWrite:false,blending:T.NoBlending});
  const scene=new T.Scene(),quad=new T.Mesh(geometry,material),camera=new T.Camera();scene.add(quad);quad.frustumCulled=false;
  const cuts=[];
  let left=0,top=0;
  function pass(output,input,mode,beginOutput){
    if(!output&&beginOutput)beginOutput();
    else{renderer.setRenderTarget(output);renderer.setViewport(0,0,output?.width??w,output?.height??h);}
    u.uMode.value=mode;u.uInput.value=input;u.uScene.value=mode===4?world.texture:input;
    u.uPixel.value.set(1/(output?.width??w),1/(output?.height??h));renderer.render(scene,camera);
  }
  return {
    binding:{texture:back.texture,width:w,height:h},needsBackground:false,
    warmupJobs(){
      return [()=>renderer.compile?.(scene,camera),...[world,back,...down,...up].map(target=>()=>renderer.initRenderTarget?.(target))];
    },
    resize(frame){
      w=frame.width;h=frame.height;left=frame.left;top=frame.top;
      world.setSize(w,h);back.setSize(w,h);this.binding.width=w;this.binding.height=h;
      let x=w,y=h;
      for(let i=0;i<down.length;i++){
        x=Math.max(4,Math.floor(x/2));y=Math.max(4,Math.floor(y/2));
        down[i].setSize(x,y);up[i]?.setSize(x,y);
      }
      u.uDimensionViewport.value.set(w,h);
    },
    begin(){cuts.length=0;this.needsBackground=false;},
    addCut(cut){let i=cuts.findIndex(v=>v.uid===cut.uid);if(i<0){if(cuts.length===3)cuts.shift();i=cuts.length;}cuts[i]=cut;},
    paint(content,view,output=null,beginOutput,hasForeground=true){
      const autoUpdate=content.matrixWorldAutoUpdate;
      if(autoUpdate)content.updateMatrixWorld();
      content.matrixWorldAutoUpdate=false;
      try{
        renderer.setRenderTarget(world);renderer.setViewport(0,0,w,h);renderer.setClearColor(0x315257,1);renderer.clear();
        if(this.needsBackground){
          view.layers.mask=1;renderer.render(content,view);pass(back,world.texture,0);
          renderer.setRenderTarget(world);renderer.setViewport(0,0,w,h);view.layers.mask=2;renderer.render(content,view);
        }else{view.layers.mask=3;renderer.render(content,view);}
        for(let i=0;i<down.length;i++)pass(down[i],i?down[i-1].texture:world.texture,i?2:1);
        for(let i=up.length-1;i>=0;i--)pass(up[i],i===up.length-1?down.at(-1).texture:up[i+1].texture,3);
        u.uDimensionCount.value=cuts.length;
        cuts.forEach(({line,shape,style},i)=>{u.uDimensionLine.value[i].set(line[0]-left,line[1]-top,line[2],line[3]);u.uDimensionShape.value[i].fromArray(shape);u.uDimensionStyle.value[i].fromArray(style);});
        pass(output,up[0].texture,4,beginOutput);
        if(hasForeground){view.layers.mask=4;renderer.render(content,view);}
      }finally{
        view.layers.mask=1;content.matrixWorldAutoUpdate=autoUpdate;
      }
    },
    dispose(){for(const item of [world,back,...up,...down,geometry,material])item.dispose();}
  };
}
