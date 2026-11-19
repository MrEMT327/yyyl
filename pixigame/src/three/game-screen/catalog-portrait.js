import {CustomBlending,DoubleSide,LinearFilter,OneFactor,OneMinusSrcAlphaFactor,ShaderMaterial,WebGLRenderTarget} from 'three';
import {PORTRAIT_FRAMING} from '../../ui/portrait-framing.js';
import {PILOT_PORTRAITS} from '../../ui/character-portraits.js';
import {catalogBounds} from './catalog-model.js';
import {area,box,pic} from './menu-art.js';

function framing(id,w,h){
  const v=catalogBounds(w,h),f=PORTRAIT_FRAMING[id];
  if(!f)return box(w*.19,v.controls-.712556*w,w*.62,.695*w);
  const [l,tp,r,b]=f.bounds,n=Math.min(.01*f.catalogHeight*w/(b-tp),.74*w/(r-l),(v.content*.5-.286*w)/(f.groundY-f.headY))*f.displayScale;
  return box(w/2-f.groundX*n,v.controls-.011556*w-f.groundY*n,n,n);
}
export function catalogPortrait(device,page,refresh,redraw){
  let id='',marker,pose,target,changed=false;
  function select(next){if(id===next)return;
    marker?.remove();marker=null;pose=null;id=next;changed=true;
    if(!id)return;
    marker=document.createElement('div');marker.dataset.characterPortrait=id;marker.setAttribute('aria-hidden','true');
    marker.style.cssText='visibility:hidden;pointer-events:none;position:absolute';page.prepend(marker);resize();
  }
  function resize(){if(marker){const p=page.getBoundingClientRect(),b=framing(id,p.width,p.height);
    Object.assign(marker.style,{left:b.x+'px',top:b.y+'px',width:b.w+'px',height:b.h+'px'});}}
  function paintPose(renderer){if(!pose?.dirty)return;
    if(!target)target=new WebGLRenderTarget(pose.w,pose.h,{depthBuffer:false,minFilter:LinearFilter});
    else if(target.width!==pose.w||target.height!==pose.h)target.setSize(pose.w,pose.h);
    const prev=renderer.getRenderTarget();try{renderer.setRenderTarget(target);renderer.clear();pose.paint();pose.dirty=false;}finally{renderer.setRenderTarget(prev);}
  }
  return {select,resize,paintPose,changed(){const value=changed;changed=false;return value;},owns:canvas=>!!marker&&canvas.parentElement===marker,
    setPose(canvas,w,h,paint,dirty){if(!marker||canvas.parentElement!==marker)return;const first=!pose;
      pose={canvas,w,h,paint,dirty:first||dirty||pose.dirty||w!==pose.w||h!==pose.h};if(first)refresh();redraw();},
    forget(canvas){if(pose?.canvas===canvas){pose=null;refresh();}},
    draw(a,t,w,h,item){if(!id)return;const b=framing(id,w,h),config=PILOT_PORTRAITS[id]||{};
      if(config.scene)pic(a,t,config.scene,b,true);
      if(!target||!pose)pic(a,t,config.image||item.image,b,true);
      else{const m=a.image(target.texture,b.x,b.y,b.w,b.h);m.material.dispose();
        m.material=new ShaderMaterial({uniforms:{pose:{value:target.texture}},depthTest:false,depthWrite:false,transparent:true,toneMapped:false,side:DoubleSide,forceSinglePass:true,
          blending:CustomBlending,blendSrc:OneFactor,blendDst:OneMinusSrcAlphaFactor,
          vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
          fragmentShader:'uniform sampler2D pose;varying vec2 v;void main(){gl_FragColor=texture2D(pose,v);}'});}
      if(config.feedback)area(t,'portrait',item.name,b,'portraitFeedback',{characterPortrait:id});
    },close(){marker?.remove();marker=null;pose=null;target?.dispose();target=null;}};
}
