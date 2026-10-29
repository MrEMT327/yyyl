import * as T from 'three';

// An annular plasma sheet, not a flat line or a disk. Its luminous front sits
// on the simulation radius; a folded, flowing wake trails behind that front.
export class PulseRingBatch {
  constructor(root, capacity = 40) {
    this.capacity = capacity;
    const segments = 256, rows = 8, vertices = [], uv = [], index = [];
    for (let j=0;j<=rows;j++) for (let i=0;i<=segments;i++) {
      const angle = i/segments*Math.PI*2;
      vertices.push(Math.cos(angle),Math.sin(angle),0);
      uv.push(i/segments,j/rows);
    }
    for (let j=0;j<rows;j++) for (let i=0;i<segments;i++) {
      const a=j*(segments+1)+i,b=a+segments+1;
      index.push(a,a+1,b,b,a+1,b+1);
    }
    const g=this.geometry=new T.InstancedBufferGeometry();
    g.setIndex(index);
    g.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
    g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
    for(const [name,size] of [['center',2],['pulse',4],['tint',3]])g.setAttribute(name,
      new T.InstancedBufferAttribute(new Float32Array(capacity*size),size).setUsage(T.DynamicDrawUsage));
    this.material=new T.ShaderMaterial({
      transparent:true,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,blending:T.AdditiveBlending,
      uniforms:{time:{value:0},bloomGain:{value:1}},
      vertexShader:`attribute vec2 center;attribute vec4 pulse;attribute vec3 tint;
        varying vec2 vUv;varying vec4 vPulse;varying vec3 vTint;uniform float time;
        void main(){vUv=uv;vPulse=pulse;vTint=tint;
          float angle=uv.x*6.2831853;
          float fold=sin(angle*9.+time*3.+pulse.z)*.55+sin(angle*17.-time*4.)*.28;
          float offset=(uv.y-.72)*pulse.y;
          float radius=max(.01,pulse.x+offset+fold*pulse.y*.045);
          float lift=sin(uv.y*3.14159)*pulse.y*.17+fold;
          vec3 p=vec3(center+position.xy*radius,3.+lift);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
        }`,
      fragmentShader:`varying vec2 vUv;varying vec4 vPulse;varying vec3 vTint;uniform float time;uniform float bloomGain;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
        void main(){
          float a=vUv.x*6.2831853,radial=(vUv.y-.72)*3.5;
          // Circular noise coordinates have no visible angular seam.
          vec2 p=vec2(cos(a),sin(a));
          float n=noise(p*7.+vec2(time*.7-vUv.y*2.,vPulse.z));
          float detail=noise(p*26.+vec2(-time*1.3,vUv.y*5.+vPulse.z));
          float flow=pow(.5+.5*sin(a*3.+time*2.5+radial*.8),3.);
          float crest=exp(-pow(radial+(detail-.5)*.055,2.)*45.);
          float body=exp(-pow(radial+.33,2.)*4.)*(.28+.45*n+.27*flow);
          float curl=exp(-pow(radial+.82+n*.26,2.)*25.)*(.15+detail*.55+flow*.3);
          float wake=exp(-pow(radial+1.2,2.)*1.6)*(.2+n*.8)*(.3+detail*.7);
          float cut=smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.9,1.,vUv.y));
          vec3 deep=vec3(.003,.07,.72),cyan=mix(vTint,vec3(.005,.25,1.),.85);
          vec3 light=vec3(.16,.72,1.)*crest*(1.6+flow*.5)+cyan*body*1.25+cyan*curl*.8+deep*wake*1.5;
          float opacity=(crest*.7+body*.65+curl*.24+wake*.45)*cut*vPulse.w;
          gl_FragColor=vec4(light*bloomGain,opacity);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new T.Mesh(g,this.material);this.mesh.name='Tidal pulse / flowing plasma crest';
    this.mesh.frustumCulled=false;this.mesh.userData.bloom=true;
    this.mesh.onBeforeRender=(_r,_s,camera)=>{this.material.uniforms.bloomGain.value=camera.layers.mask===2?1.1:1;};
    root.add(this.mesh);this.color=new T.Color();this.count=0;this.finish();
  }
  begin(time){this.count=0;this.material.uniforms.time.value=time;}
  add(wave){
    if(this.count>=this.capacity||wave.radius<=1)return;
    const i=this.count++,a=this.geometry.attributes;
    let seed=0;for(const c of wave.id)seed=(seed*31+c.charCodeAt(0))>>>0;
    const width=Math.min(wave.radius*.55,44+Math.min(2.5,wave.width)*14);
    a.center.setXY(i,wave.x,wave.y);
    a.pulse.setXYZW(i,wave.radius,width,(seed%1000)/100,Math.min(1,wave.radius/28)*wave.alpha*.82);
    this.color.set(wave.color);a.tint.setXYZ(i,this.color.r,this.color.g,this.color.b);
  }
  finish(){
    this.geometry.instanceCount=this.count;this.mesh.visible=this.count>0;
    for(const name of ['center','pulse','tint']){const a=this.geometry.attributes[name];a.clearUpdateRanges();a.addUpdateRange(0,this.count*a.itemSize);a.needsUpdate=true;}
  }
}
