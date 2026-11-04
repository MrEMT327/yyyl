import {BufferGeometry,Float32BufferAttribute,Mesh,ShaderMaterial,Color,DoubleSide,AdditiveBlending} from 'three';
import {Container} from '../three/display.js';

// A thin ribbon follows the PSD's top-left and bottom-right cut corners.
// Geometry stays fixed; the existing UI render pass only advances a uniform.
export function attachUpgradeChoiceBorderFlow(card,{width,height,art,index=0}){
  if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)return null;
  const scale=Math.min(width/224,height/562),inset=3*scale,cut=20*scale,halfWidth=4.8*scale;
  const points=[[inset+cut,inset],[width-inset,inset],[width-inset,height-inset-cut],
    [width-inset-cut,height-inset],[inset,height-inset],[inset,inset+cut]];
  const count=points.length,arcs=[0],offsets=[];
  for(let i=0;i<count;i++){
    const previous=points[(i+count-1)%count],current=points[i],next=points[(i+1)%count];
    const incoming=[current[0]-previous[0],current[1]-previous[1]],outgoing=[next[0]-current[0],next[1]-current[1]];
    const a=Math.hypot(...incoming),b=Math.hypot(...outgoing),n0=[-incoming[1]/a,incoming[0]/a],n1=[-outgoing[1]/b,outgoing[0]/b];
    const sum=[n0[0]+n1[0],n0[1]+n1[1]],length=Math.hypot(...sum),miter=[sum[0]/length,sum[1]/length];
    const reach=halfWidth/(miter[0]*n1[0]+miter[1]*n1[1]);offsets.push(miter.map(value=>value*reach));
    arcs.push(arcs[i]+b);
  }
  const positions=[],distances=[],across=[],indices=[];
  for(let i=0;i<=count;i++){
    const p=points[i%count],offset=offsets[i%count];
    for(const side of [-1,1]){positions.push(p[0]+offset[0]*side,p[1]+offset[1]*side,0);distances.push(arcs[i]);across.push(side);}
    if(i<count){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('aDistance',new Float32BufferAttribute(distances,1));
  geometry.setAttribute('aAcross',new Float32BufferAttribute(across,1));geometry.setIndex(indices);
  const colors=art==='card-red'?[0xff8b8d,0xffc1a6]:art==='card-blue'?[0x77dfff,0xc1f4ff]:[0xa6acff,0x83ffe7];
  const material=new ShaderMaterial({
    uniforms:{uPhase:{value:0},uLength:{value:arcs[count]},uOpacity:{value:1},
      uColorA:{value:new Color(colors[0])},uColorB:{value:new Color(colors[1])}},
    vertexShader:`attribute float aDistance; attribute float aAcross;
      varying float vDistance; varying float vAcross;
      void main(){vDistance=aDistance;vAcross=aAcross;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader:`varying float vDistance; varying float vAcross;
      uniform float uPhase; uniform float uLength; uniform float uOpacity;
      uniform vec3 uColorA; uniform vec3 uColorB;
      void main(){
        float behind=mod(uPhase*uLength-vDistance+uLength,uLength);
        float nearHead=min(behind,uLength-behind);
        float head=exp(-pow(nearHead/13.,2.));
        float tail=pow(max(0.,1.-behind/190.),1.65);
        float edge=abs(vAcross);
        float core=1.-smoothstep(.10,.38,edge);
        float halo=exp(-edge*edge*4.4)*(1.-smoothstep(.72,1.,edge));
        float alpha=(core*.64+halo*.32)*max(tail*.8,head)*uOpacity;
        vec3 color=mix(uColorA,uColorB,.5+.5*sin(vDistance/uLength*6.283185));
        gl_FragColor=vec4(mix(color,vec3(1.),head*.58),alpha);
        #include <colorspace_fragment>
      }`,
    transparent:true,depthTest:false,depthWrite:false,toneMapped:false,side:DoubleSide,
    forceSinglePass:true,blending:AdditiveBlending,
  });
  const mesh=new Mesh(geometry,material),node=new Container({label:'upgrade-choice-border-flow'});
  mesh.frustumCulled=false;node.eventMode='none';node.object3D.add(mesh);card.addChild(node);
  let stoppedAt=null,disposed=false;
  mesh.onBeforeRender=()=>{
    const now=performance.now();
    if(card.__entryCancelled&&stoppedAt===null)stoppedAt=now;
    const fade=stoppedAt===null?1:Math.max(0,1-(now-stoppedAt)/120);
    material.uniforms.uPhase.value=((stoppedAt??now)/3800+index*.43)%1;
    material.uniforms.uOpacity.value=material.opacity*fade;
    if(fade===0)mesh.visible=false;
  };
  node._disposeVisuals=()=>{if(disposed)return;disposed=true;geometry.dispose();material.dispose();node.object3D.clear();};
  return node;
}
