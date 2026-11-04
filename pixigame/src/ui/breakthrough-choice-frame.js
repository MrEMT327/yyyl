import {BufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial,Color,DoubleSide,AdditiveBlending} from 'three';
import {Container} from '../three/display.js';
import {attachViewportBreakthroughFrame} from './breakthrough-screen-frame.js';

// Branch modifiers inherit the parent's weapon tier. Ordinary stage offers,
// passive choices and the two fallback rewards must not acquire this frame.
export function isBreakthroughBranchOffer(offers=[]){
  return offers.length===2&&offers.every(({skill})=>skill?.familyId>0&&skill.familyId===skill.group
    &&Number(skill.raw?.SkillType)===3&&skill.star>0&&skill.star%3===0&&!skill.advance&&!skill.opensBreakthrough);
}

/** Four narrow strips share one shader in the existing UI pass. The center is
 * never rasterized, and the display tree owns entry/exit opacity and disposal. */
export function attachBreakthroughChoiceFrame(panel,options={}){
  const viewport=globalThis.document?.getElementById?.('stage');
  if(viewport?.isConnected&&viewport.ownerDocument?.createElementNS)return attachViewportBreakthroughFrame(panel,{...options,viewport});
  return attachCanvasChoiceFrame(panel,options);
}
function attachCanvasChoiceFrame(panel,{width=600,height=1300,revealAt=0}={}){
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const band=Math.min(56,width/4,height/4),positions=[],indices=[];
  const quad=(x0,y0,x1,y1)=>{const n=positions.length/3;positions.push(x0,y0,0,x1,y0,0,x0,y1,0,x1,y1,0);indices.push(n,n+1,n+2,n+1,n+3,n+2);};
  quad(0,0,width,band);quad(0,height-band,width,height);
  quad(0,band,band,height-band);quad(width-band,band,width,height-band);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  const material=new ShaderMaterial({
    uniforms:{uTime:{value:0},uOpacity:{value:0},uWidth:{value:width},uHeight:{value:height},uBand:{value:band},
      uGold:{value:new Color(0xffba3b)},uHot:{value:new Color(0xfff4c7)}},
    vertexShader:`varying vec2 vPoint;void main(){vPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vPoint;
      uniform float uTime;uniform float uOpacity;uniform float uWidth;uniform float uHeight;uniform float uBand;
      uniform vec3 uGold;uniform vec3 uHot;
      void main(){
        vec2 p=vPoint;float right=uWidth-p.x;float bottom=uHeight-p.y;
        float edge=min(min(p.x,right),min(p.y,bottom));
        float s=p.y<=min(min(p.x,right),bottom)?p.x:
          right<=min(p.x,bottom)?uWidth+p.y:
          bottom<=p.x?uWidth+uHeight+right:2.*uWidth+uHeight+bottom;
        float perimeter=2.*(uWidth+uHeight);float t=uTime;
        // A gently irregular filament, with three travelling flares.
        float bend=sin(s*.032+t*1.5+sin(s*.013-t*.7)*1.8)*2.0
          +sin(s*.113-t*2.8)*.9+sin(s*.251+t*2.1)*.45;
        float filament=5.8+bend;float distanceToLine=abs(edge-filament);
        float interval=perimeter/3.;float behind=mod(s-t*155.+perimeter,interval);
        float headDistance=min(behind,interval-behind);
        float head=exp(-pow(headDistance/34.,2.));
        float trail=pow(max(0.,1.-behind/310.),1.6);
        float intensity=.78+.18*sin(s*.019-t*1.4)+trail*.30;
        float core=exp(-pow(distanceToLine/(1.6+head*.5),2.));
        float glow=exp(-pow(distanceToLine/(6.5+head*4.),2.));
        float haze=exp(-edge/27.)*(1.-smoothstep(uBand*.62,uBand,edge));
        float forkGate=pow(max(0.,sin(s*.027-t*1.7)),12.);
        float fork=exp(-pow((edge-filament-4.-bend*.55)/.85,2.))*forkGate;
        float alpha=clamp(core*intensity+glow*(.34+head*.5)+haze*(.20+trail*.08)+fork*.32,0.,1.)*uOpacity;
        vec3 color=mix(uGold,uHot,clamp(core*.85+head*.16,0.,1.));
        gl_FragColor=vec4(color,alpha);
        #include <colorspace_fragment>
      }`,
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:DoubleSide,
    forceSinglePass:true,blending:AdditiveBlending,
  });
  const mesh=new Mesh(geometry,material),node=new Container({label:'breakthrough-choice-screen-frame'});
  mesh.frustumCulled=false;node.eventMode='none';node.interactiveChildren=false;node.object3D.add(mesh);panel.addChild(node);
  const born=Math.max(performance.now(),revealAt);let stoppedAt=null,disposed=false;
  mesh.onBeforeRender=()=>{
    const now=performance.now();if(node.__entryCancelled&&stoppedAt===null)stoppedAt=now;
    const age=Math.max(0,(stoppedAt??now)-born),entrance=reduced?1:Math.min(1,age/200);
    const fade=stoppedAt===null?1:Math.max(0,1-(now-stoppedAt)/180);
    material.uniforms.uTime.value=reduced?0:age/1000;
    material.uniforms.uOpacity.value=material.opacity*entrance*fade*(reduced?.38:1);
    if(fade===0)mesh.visible=false;
  };
  node._disposeVisuals=()=>{if(disposed)return;disposed=true;geometry.dispose();material.dispose();node.object3D.clear();};
  return node;
}

/** The outline and its exterior bloom share a mesh, following the PSD cuts.
 * Its transparent middle leaves the weapon illustration and text clear. */
export function attachBreakthroughChoiceCardAura(card,{width,height,revealAt=0}){
  const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches??false;
  const scale=Math.min(width/224,height/562),pad=30*scale,inside=18*scale,cut=20*scale;
  const positions=[],indices=[];
  const quad=(x0,y0,x1,y1)=>{const n=positions.length/3;positions.push(x0,y0,0,x1,y0,0,x0,y1,0,x1,y1,0);indices.push(n,n+1,n+2,n+1,n+3,n+2);};
  quad(-pad,-pad,width+pad,inside);quad(-pad,height-inside,width+pad,height+pad);
  quad(-pad,inside,inside,height-inside);quad(width-inside,inside,width+pad,height-inside);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  const material=new ShaderMaterial({
    uniforms:{uTime:{value:0},uOpacity:{value:0},uWidth:{value:width},uHeight:{value:height},uCut:{value:cut},uScale:{value:scale},
      uGold:{value:new Color(0xffb52e)},uHot:{value:new Color(0xfff6dc)}},
    vertexShader:`varying vec2 vPoint;void main(){vPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vPoint;uniform float uTime;uniform float uOpacity;
      uniform float uWidth;uniform float uHeight;uniform float uCut;uniform float uScale;
      uniform vec3 uGold;uniform vec3 uHot;
      void main(){
        vec2 p=vPoint;
        float d=max(max(-p.x,p.x-uWidth),max(-p.y,p.y-uHeight));
        d=max(d,(uCut-p.x-p.y)*.70710678);
        d=max(d,(p.x+p.y-uWidth-uHeight+uCut)*.70710678)/uScale;
        float outer=max(0.,d);float along=(p.x+p.y)*.09/uScale;
        float breath=.92+.08*sin(uTime*2.1);
        float glint=pow(max(0.,sin(along-uTime*2.8)),14.);
        float core=exp(-pow(d/1.9,2.));
        float closeGlow=exp(-pow(d/(5.5+glint),2.));
        float aura=exp(-outer/10.)*smoothstep(-2.,.5,d)*(1.-smoothstep(18.,30.,outer));
        float innerFade=smoothstep(-10.,-5.,d);
        float alpha=clamp((core*.96+closeGlow*(.40+glint*.12)+aura*.28)*breath*innerFade,0.,1.)*uOpacity;
        if(alpha<.001)discard;
        gl_FragColor=vec4(mix(uGold,uHot,core*.94),alpha);
        #include <colorspace_fragment>
      }`,
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:DoubleSide,
    forceSinglePass:true,blending:AdditiveBlending,
  });
  const mesh=new Mesh(geometry,material),node=new Container({label:'breakthrough-choice-card-aura'});
  mesh.frustumCulled=false;node.eventMode='none';node.interactiveChildren=false;node.object3D.add(mesh);card.addChild(node);
  const born=Math.max(performance.now(),revealAt);let stoppedAt=null,disposed=false;
  mesh.onBeforeRender=()=>{
    const now=performance.now();if(card.__entryCancelled&&stoppedAt===null)stoppedAt=now;
    const entrance=reduced?1:Math.min(1,Math.max(0,now-born)/200);
    // Both cards breathe together; accepted selections inherit the card fade.
    material.uniforms.uTime.value=reduced?0:(stoppedAt??now)/1000;
    material.uniforms.uOpacity.value=material.opacity*entrance*(reduced?.5:1);
  };
  node._disposeVisuals=()=>{if(disposed)return;disposed=true;geometry.dispose();material.dispose();node.object3D.clear();};
  return node;
}
