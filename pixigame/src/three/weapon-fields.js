import * as T from 'three';

// Poison and burning ground need a translucent surface as well as light.
// Additive glow alone either disappears over water or turns stacked clouds white.
export class WeaponFieldBatch {
  constructor(root,capacity=256){
    this.capacity=capacity;this.count=0;const q=new T.PlaneGeometry(1,1),g=this.geometry=new T.InstancedBufferGeometry();g.index=q.index;g.attributes.position=q.attributes.position;g.attributes.uv=q.attributes.uv;
    for(const [name,size] of [['center',2],['shape',4],['tint',3]])g.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage));
    this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,
      vertexShader:`attribute vec2 center;attribute vec4 shape;attribute vec3 tint;varying vec2 vUv;varying vec3 vTint;varying vec4 vShape;
      void main(){vUv=uv;vTint=tint;vShape=shape;gl_Position=projectionMatrix*modelViewMatrix*vec4(center+position.xy*shape.x,3.,1.);}`,
      fragmentShader:`varying vec2 vUv;varying vec3 vTint;varying vec4 vShape;
      void main(){vec2 p=(vUv-.5)*2.;float r=length(p),a=atan(p.y,p.x),t=vShape.y;
      float swirl=sin(a*4.-t+r*9.)*.06+sin(p.x*8.+p.y*5.-t*.7)*.04;
      float edge=1.-smoothstep(.65+swirl,1.+swirl,r);float cloud=.75+.25*sin(p.x*9.+t)*sin(p.y*7.-t*.8);
      gl_FragColor=vec4(vTint*(.75+cloud*.35),edge*cloud*vShape.z);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`,
    });
    this.mesh=new T.Mesh(g,this.material);this.mesh.name='Translucent poison and fire surfaces';this.mesh.frustumCulled=false;root.add(this.mesh);this.color=new T.Color();this.finish();
  }
  begin(){this.count=0;}
  add(x,y,r,color,alpha,time){if(this.count>=this.capacity)return;const i=this.count++,a=this.geometry.attributes;a.center.setXY(i,x,y);a.shape.setXYZW(i,r*2,time,alpha,0);this.color.set(color);a.tint.setXYZ(i,this.color.r,this.color.g,this.color.b);}
  finish(){this.geometry.instanceCount=this.count;this.mesh.visible=this.count>0;for(const n of ['center','shape','tint']){const a=this.geometry.attributes[n];a.clearUpdateRanges();a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true;}}
}
