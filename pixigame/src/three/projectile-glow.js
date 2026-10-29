import * as T from 'three';

// A restrained envelope around the real emissive insert. The visible pass and
// bloom pass share this exact source; the blur supplies the outer glow once.
export class ProjectileGlowBatch {
  constructor(root,capacity=2048){
    this.capacity=capacity;this.count=0;
    const q=new T.PlaneGeometry(1,1),g=this.geometry=new T.InstancedBufferGeometry();
    g.index=q.index;g.attributes.position=q.attributes.position;g.attributes.uv=q.attributes.uv;
    for(const [name,size] of [['center',2],['shape',4],['tint',3]])g.setAttribute(name,
      new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage));
    this.material=new T.ShaderMaterial({
      transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending:T.AdditiveBlending,
      vertexShader:`attribute vec2 center;attribute vec4 shape;attribute vec3 tint;
        varying vec2 vUv;varying vec3 vTint;varying float vPower;
        void main(){vUv=uv;vTint=tint;vPower=shape.w;
          vec2 p=position.xy*shape.xy;float c=cos(shape.z),s=sin(shape.z);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(center+vec2(c*p.x-s*p.y,s*p.x+c*p.y),5.,1.);
        }`,
      fragmentShader:`varying vec2 vUv;varying vec3 vTint;varying float vPower;
        void main(){vec2 p=(vUv-.5)*2.;float d=dot(p,p);
          float envelope=exp(-d*5.)*(1.-smoothstep(.55,1.,d));
          gl_FragColor=vec4(vTint*1.15,envelope*.3*vPower);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new T.Mesh(g,this.material);this.mesh.frustumCulled=false;this.mesh.userData.bloom=true;
    this.mesh.name='Projectile hot cores and engine plumes';root.add(this.mesh);
    this.color=new T.Color();this.finish();
  }
  begin(){this.count=0;}
  add(x,y,width,length,angle,color,power=1){
    if(this.count>=this.capacity)return;const i=this.count++,a=this.geometry.attributes;
    a.center.setXY(i,x,y);a.shape.setXYZW(i,width,length,angle,power);
    this.color.set(color);a.tint.setXYZ(i,this.color.r,this.color.g,this.color.b);
  }
  finish(){
    this.geometry.instanceCount=this.count;this.mesh.visible=this.count>0;
    for(const name of ['center','shape','tint']){const a=this.geometry.attributes[name];a.clearUpdateRanges();a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true;}
  }
}
