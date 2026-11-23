import {BufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial,Color,DoubleSide,AdditiveBlending} from 'three';
import {Container} from '../three/display.js';
export {attachBreakthroughChoiceFrame} from '../three/game-screen/choice-edge.js';
import {EDGE_PALETTES} from './breakthrough-edge-profile.js';
import {prefersReducedMotion} from './status-feedback.js';

// Branch modifiers inherit the parent's weapon tier. Ordinary stage offers,
// passive choices and the two fallback rewards must not acquire this frame.
export function isBreakthroughBranchOffer(offers=[]){
  return offers.length===2&&offers.every(({skill})=>skill?.familyId>0&&skill.familyId===skill.group
    &&Number(skill.raw?.SkillType)===3&&skill.star>0&&skill.star%3===0&&!skill.advance&&!skill.opensBreakthrough);
}

/** The outline and its exterior bloom share a mesh, following the PSD cuts.
 * Its transparent middle leaves the weapon illustration and text clear. */
export function attachBreakthroughChoiceCardAura(card,{width,height,revealAt=0,tier='y',reduced=prefersReducedMotion()}){
  const palette=EDGE_PALETTES[tier]||EDGE_PALETTES.y;
  const scale=Math.min(width/224,height/562),pad=30*scale,inside=18*scale,cut=20*scale;
  const positions=[],indices=[];
  const quad=(x0,y0,x1,y1)=>{const n=positions.length/3;positions.push(x0,y0,0,x1,y0,0,x0,y1,0,x1,y1,0);indices.push(n,n+1,n+2,n+1,n+3,n+2);};
  quad(-pad,-pad,width+pad,inside);quad(-pad,height-inside,width+pad,height+pad);
  quad(-pad,inside,inside,height-inside);quad(width-inside,inside,width+pad,height-inside);
  const geometry=new BufferGeometry();geometry.setAttribute('position',new Float32BufferAttribute(positions,3));geometry.setIndex(indices);
  const material=new ShaderMaterial({
    uniforms:{uTime:{value:0},uOpacity:{value:0},uWidth:{value:width},uHeight:{value:height},uCut:{value:cut},uScale:{value:scale},
      uTint:{value:new Color(palette.near)},uHot:{value:new Color(palette.core)}},
    vertexShader:`varying vec2 vPoint;void main(){vPoint=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying vec2 vPoint;uniform float uTime;uniform float uOpacity;
      uniform float uWidth;uniform float uHeight;uniform float uCut;uniform float uScale;
      uniform vec3 uTint;uniform vec3 uHot;
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
        gl_FragColor=vec4(mix(uTint,uHot,core*.94),alpha);
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
