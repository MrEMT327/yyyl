import {Camera,CustomBlending,LinearFilter,Mesh,NoColorSpace,OneFactor,RawShaderMaterial,Scene,TextureLoader,Vector2,Vector3,Vector4} from 'three';
import {Container} from '../../three/display.js';
import {EDGE_PALETTES,edgeTierFromStar,edgeBasePulse,edgeFlashSample} from '../../ui/breakthrough-edge-profile.js';
import {borderGeometry,borderVertex,createEdgeMasks} from './choice-edge-masks.js';
import art from './choice-edge-art.json';

const clamp=n=>Math.min(1,Math.max(0,n));
const color=hex=>new Vector3(...[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255));
const fragment=`precision highp float;varying vec2 pixelUV;
uniform sampler2D wideMask,nearMask,fineMask,flashAtlas;
uniform vec3 base,farColor,nearColor,other,core;uniform vec2 size;
uniform float spread,pulse,strength,inset,flashAlpha,flashTile;uniform vec4 flashPose;
vec4 over(vec4 old,vec3 color,float a){return vec4(color*a+old.rgb*(1.-a),a+old.a*(1.-a));}
float side(float distance){
 float t=clamp(distance/spread,0.,1.);
 if(t<.24)return mix(.34,.20,t/.24);
 if(t<.65)return mix(.20,.07,(t-.24)/.41);
 return mix(.07,0.,(t-.65)/.35);
}
void main(){
 vec2 p=vec2(pixelUV.x,1.-pixelUV.y)*size;
 vec3 wide=texture2D(wideMask,pixelUV).rgb;vec2 nearInk=texture2D(nearMask,pixelUV).rg;vec4 fine=texture2D(fineMask,pixelUV);
 float a=1.-(1.-side(p.x))*(1.-side(size.x-p.x))*(1.-side(p.y))*(1.-side(size.y-p.y));
 vec4 result=over(vec4(0.),base,a*fine.a*pulse);
 vec2 t=clamp((p-inset)/max(size-2.*inset,vec2(1.)),0.,1.);float f=(t.x+t.y)*.5;
 vec3 arc=f<.32?mix(nearColor,other,f/.32):f<.65?mix(other,nearColor,(f-.32)/.33):mix(nearColor,other,(f-.65)/.35);
 result=over(result,farColor,wide.r*.24);result=over(result,arc,wide.g*.60);result=over(result,farColor,wide.b*.46);
 result=over(result,arc,nearInk.r*.94);result=over(result,nearColor,nearInk.g*.78);
 result=over(result,core,fine.r);result=over(result,core,fine.g*.83);result=over(result,other,fine.b*.52);
 if(flashAlpha>0.){
   vec2 delta=p-flashPose.xy;
   vec2 local=vec2(dot(delta,flashPose.zw),dot(delta,vec2(-flashPose.w,flashPose.z)));
   if(all(lessThan(abs(local),vec2(1.)))){
     vec2 tile=vec2(mod(flashTile,3.),floor(flashTile/3.));vec2 uv=(tile+.5+.5*local)/3.;
     vec3 mask=texture2D(flashAtlas,vec2(uv.x,1.-uv.y)).rgb;
     vec4 spark=over(vec4(0.),farColor,mask.r*.36);spark=over(spark,nearColor,mask.g*.87);spark=over(spark,core,mask.b);
     result=spark*flashAlpha+result*(1.-spark.a*flashAlpha);
   }
 }
 gl_FragColor=result*strength;
}`;

// Source colours blend in display space, then the completed frame adds to the existing HUD.
export function createChoiceEdgePainter(tier){
  const palette=EDGE_PALETTES[tier]||EDGE_PALETTES.y,atlas=new TextureLoader().load(art.flash);
  atlas.colorSpace=NoColorSpace;atlas.generateMipmaps=false;atlas.minFilter=atlas.magFilter=LinearFilter;
  const value=v=>({value:v}),u={
    wideMask:value(null),nearMask:value(null),fineMask:value(null),flashAtlas:value(atlas),
    base:value(color(palette.base)),farColor:value(color(palette.far)),nearColor:value(color(palette.near)),other:value(color(palette.other)),core:value(color(palette.core)),
    size:value(new Vector2()),spread:value(0),inset:value(0),strength:value(1),pulse:value(1),flashAlpha:value(0),flashTile:value(0),flashPose:value(new Vector4())
  };
  const material=new RawShaderMaterial({vertexShader:borderVertex,fragmentShader:fragment,uniforms:u,
    depthTest:false,depthWrite:false,transparent:true,blending:CustomBlending,blendSrc:OneFactor,blendDst:OneFactor});
  const scene=new Scene(),camera=new Camera(),vp=new Vector4();
  let mesh=null,masks=null,sizeKey='',lastTick=-1,lastSlot=-1;
  function release(){if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh=null;}masks?.dispose();masks=null;}
  return {paint(r,w,h,seconds,opacity,reduced){
    if(!(w>4&&h>4&&opacity>0))return;
    r.getViewport(vp);const ratio=r.getRenderTarget()?1:r.getPixelRatio();
    const pw=Math.max(1,Math.round(vp.z*ratio)),ph=Math.max(1,Math.round(vp.w*ratio));
    const next=[w,h,pw,ph].join('|');
    if(next!==sizeKey){
      release();sizeKey=next;lastTick=-1;lastSlot=-1;
      const scale=Math.min(w/600,h/1300);u.size.value.set(w,h);u.spread.value=Math.max(14,Math.min(34,35*scale));u.inset.value=Math.max(4,8.5*scale);
      masks=createEdgeMasks(r,w,h,pw,ph);mesh=new Mesh(borderGeometry(w,h,Math.max(20,140*scale+2)),material);
      mesh.frustumCulled=false;scene.add(mesh);u.wideMask.value=masks.wide;u.nearMask.value=masks.near;u.fineMask.value=masks.fine;
    }
    const tick=reduced?0:Math.floor(seconds*30);
    if(tick!==lastTick){
      lastTick=tick;masks.render(reduced?0:seconds);u.pulse.value=reduced?1:edgeBasePulse(seconds);u.flashAlpha.value=0;
      if(!reduced){
        let f=edgeFlashSample(w,h,seconds);
        if(f.slot!==lastSlot&&!f.visible)f=edgeFlashSample(w,h,f.slot*.1+.009);
        lastSlot=f.slot;
        if(f.visible){
          const radians=f.angle*Math.PI/180,size=Math.max(.001,f.size*f.scale);
          u.flashPose.value.set(f.x,f.y,Math.cos(radians)/size,Math.sin(radians)/size);
          u.flashTile.value=f.index;u.flashAlpha.value=f.alpha;
        }
      }
    }
    u.strength.value=opacity;const previous=r.autoClear;
    try{r.autoClear=false;r.render(scene,camera);}finally{r.autoClear=previous;}
  },invalidate(){lastTick=-1;},dispose(){release();material.dispose();atlas.dispose();}};
}

export function attachBreakthroughChoiceFrame(panel,{display,revealAt=0,star,tier=edgeTierFromStar(star)}){
  const node=new Container({label:'breakthrough-choice-screen-frame'});node.eventMode='none';node.interactiveChildren=false;panel.addChild(node);
  const born=Math.max(performance.now(),revealAt),reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const painter=createChoiceEdgePainter(tier),canvas=display.canvas;
  let stoppedAt=null,disposed=false;
  function paint(r){
    if(disposed||!node.parent)return;
    const now=performance.now();if(node.__entryCancelled&&stoppedAt===null)stoppedAt=now;
    const age=Math.max(0,(stoppedAt??now)-born);
    let alpha=(reduced?.38:clamp(age/200))*(stoppedAt===null?1:clamp(1-(now-stoppedAt)/180));
    for(let p=node;p;p=p.parent){if(!p.visible||!p.renderable)return;alpha*=p.alpha;}
    const rect=canvas.getBoundingClientRect?.();
    painter.paint(r,rect?.width??canvas.width,rect?.height??canvas.height,age/1000,alpha,reduced);
  }
  const output=display.three.domElement;display.screenOverlays.add(paint);output.addEventListener?.('webglcontextrestored',painter.invalidate);
  node._disposeVisuals=()=>{if(disposed)return;disposed=true;display.screenOverlays.delete(paint);output.removeEventListener?.('webglcontextrestored',painter.invalidate);painter.dispose();};
  return node;
}

