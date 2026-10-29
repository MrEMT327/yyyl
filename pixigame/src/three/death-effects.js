import * as T from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';

const PALETTES=[
  [0xffa832,0xdbeaf1,0x253341],[0xffaa44,0xb4ac91,0x302e2a],
  [0xff701c,0xcf7136,0x34231e],[0xffbf58,0x83a6a1,0x253536],
  [0x91cfff,0xc3d8ff,0x272842],
];
export const DEATH_LIMITS=Object.freeze({events:28,quads:280,fragments:224});
export function deathStyle(tier='regular',chapter=0,reduced=false) {
  const boss=tier==='boss',elite=tier==='elite',rupture=tier==='rupture';
  chapter=Math.max(0,Math.min(4,Math.floor(Number(chapter)||0)));
  const [fire,armor,smoke]=PALETTES[chapter];
  return {fire,armor,smoke,chapter,life:reduced?.28:boss?1.25:elite?.86:rupture?.48:.56,
    radius:boss?104:elite?47:rupture?29:tier==='heavy'?34:28,
    fragments:reduced?0:boss?16:elite?9:rupture?3:5,
    lobes:reduced?3:boss?6:elite?5:3,reduced,boss,elite,rupture};
}
// Distinct readable plateau, then fade; no immediate loss of the death silhouette.
export function deathEnvelope(age,life) {
  const t=Math.max(0,Math.min(1,age/life));
  return t<.32?1:Math.pow((1-t)/.68,1.3);
}

export class DeathEffects {
  constructor(root) {
    this.events=[];this.time=0;this.serial=0;this.root=root;
    const plane=new T.PlaneGeometry(1,1),g=this.geometry=new T.InstancedBufferGeometry();
    g.index=plane.index.clone();g.setAttribute('position',plane.attributes.position.clone());g.setAttribute('uv',plane.attributes.uv.clone());plane.dispose();
    for(const [name,n] of [['center',3],['shape',4],['tint',3],['detail',4]])
      g.setAttribute(name,new T.InstancedBufferAttribute(new Float32Array(DEATH_LIMITS.quads*n),n).setUsage(T.DynamicDrawUsage));
    this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,
      vertexShader:`attribute vec3 center,tint;attribute vec4 shape,detail;
        varying vec2 vUv;varying vec3 vTint;varying vec4 vDetail;
        void main(){vUv=uv;vTint=tint;vDetail=detail;vec2 p=position.xy*shape.xy;
          float c=cos(shape.z),s=sin(shape.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(center+vec3(c*p.x-s*p.y,s*p.x+c*p.y,0.),1.);}`,
      fragmentShader:`varying vec2 vUv;varying vec3 vTint;varying vec4 vDetail;
        void main(){vec2 p=vUv*2.-1.;float r=length(p),a=atan(p.y,p.x),alpha=0.;vec3 col=vTint;
          float kind=vDetail.x,age=vDetail.y,seed=vDetail.z,gain=vDetail.w;
          if(kind<.5){
            float edge=.74+.10*sin(a*5.+seed)+.065*sin(a*9.-seed)+.025*sin(a*17.+seed);
            float d=r/edge;alpha=(1.-smoothstep(.92,1.,d))*gain;
            float core=1.-smoothstep(.12,.79,d);
            vec3 hot=mix(vec3(1.,.97,.87),vTint,.12);
            // The white contact peak finishes first; the orange rupture and
            // debris remain readable without holding a white disk over bullets.
            float hotPeak=1.-smoothstep(.12,.4,age);
            col=mix(vTint,hot,core*hotPeak);
            col=mix(col,vTint*.5,smoothstep(.83,.99,d)*.38);
          }else if(kind<1.5){
            float spikes=.22+.7*pow(abs(cos(a*4.+seed)),12.);
            alpha=(1.-smoothstep(spikes*.72,spikes,r))*gain;
            col=mix(vTint,vec3(1.,.97,.85),.6);
          }else if(kind<2.5){
            float edge=.7+.07*sin(a*5.+seed)+.04*sin(a*9.-seed);
            alpha=(1.-smoothstep(edge*.55,edge,r))*gain;col=vTint;
          }else{
            alpha=(1.-smoothstep(.025,.065,abs(r-.78)))*gain;
            if(kind>3.5)alpha*=smoothstep(.12,.3,abs(sin(a*3.+seed)));
          }
          gl_FragColor=vec4(col,alpha);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh=new T.Mesh(g,this.material);this.mesh.name='Death silhouettes / reserved';this.mesh.frustumCulled=false;root.add(this.mesh);
    this.shardMaterial=new T.MeshStandardMaterial({color:0xffffff,roughness:.65,metalness:.3,transparent:true,depthWrite:false});
    this.plates=new T.InstancedMesh(new RoundedBoxGeometry(1,.7,.25,1,.09),this.shardMaterial,DEATH_LIMITS.fragments);
    this.crystals=new T.InstancedMesh(new T.OctahedronGeometry(.7),this.shardMaterial,DEATH_LIMITS.fragments);
    for(const mesh of [this.plates,this.crystals]){mesh.frustumCulled=false;mesh.name='Death debris / no collision';mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);root.add(mesh);}
    this.dummy=new T.Object3D();this.color=new T.Color();this.clear();
  }
  emit(x,y,scale=1,reduced=false,{tier='regular',chapter=0,vx=0,vy=0}={}) {
    if(!Number.isFinite(x)||!Number.isFinite(y))return;
    const style=deathStyle(tier,chapter,reduced);
    const nearby=this.events.filter(e=>e.age<.24&&Math.hypot(e.x-x,e.y-y)<120).length;
    // Every kill retains its silhouette and debris. Dense chain kills spend
    // less budget on bright cores and smoke, not on gameplay feedback itself.
    const clarity=style.boss?1:Math.max(.38,1/(1+nearby*.35));
    if(this.events.length>=DEATH_LIMITS.events){
      // Retire the oldest small explosion, never evict an in-progress boss blast.
      const old=this.events.findIndex(e=>!e.style.boss);if(old<0)return;this.events.splice(old,1);
    }
    this.events.push({x,y,age:0,vx:Number.isFinite(vx)?Math.max(-180,Math.min(180,vx))*.4:0,
      vy:Number.isFinite(vy)?Math.max(-180,Math.min(180,vy))*.4:0,
      scale:Number.isFinite(scale)?Math.max(.7,Math.min(1.5,scale)):1,
      style,clarity,smoke:style.boss||nearby<2,seed:++this.serial*2.399});
  }
  quad(x,y,size,color,kind,age,seed,alpha,stretch=1,angle=0) {
    if(this.quads>=DEATH_LIMITS.quads||alpha<=0)return;
    const i=this.quads++,a=this.geometry.attributes;
    a.center.setXYZ(i,x,y,2);a.shape.setXYZW(i,size,size*stretch,angle,0);
    this.color.set(color);a.tint.setXYZ(i,this.color.r,this.color.g,this.color.b);
    a.detail.setXYZW(i,kind,age,seed,alpha);
  }
  step(dt) {
    dt=Number.isFinite(dt)?Math.max(0,dt):0;this.time+=dt;this.quads=0;let plates=0,crystals=0;
    this.events=this.events.filter(e=>(e.age+=dt)<e.style.life);
    for(const e of this.events){
      const s=e.style,t=e.age/s.life,r=s.radius*e.scale;
      // Only two small residual clouds, behind the hot core, never a screen blanket.
      if(!s.reduced&&e.smoke&&e.age>.13)for(let i=0;i<2;i++)
        this.quad(e.x+(i?1:-1)*r*.3,e.y-8*t,r*(.65+t*.5),s.smoke,2,t,e.seed+i,Math.sin(Math.PI*t)*.13*e.clarity);
      const fireLife=s.reduced?.28:s.boss?.5:s.elite?.36:.24;
      const age=e.age-(s.elite?.08:0),ft=Math.max(0,age/fireLife);
      if(s.elite&&e.age<.14)this.quad(e.x,e.y,r*.9,s.fire,1,t,e.seed,(1-e.age/.14)*e.clarity);
      if(age>=0&&age<fireLife)for(let i=s.lobes-1;i>=0;i--){
        const a=e.seed+i*Math.PI*2/s.lobes,offset=i?r*(.31+i%2*.12)*Math.min(1,ft*5):0;
        const expand=s.reduced?1:.68+Math.min(1,ft*4)*.36;
        // Space releases a compact energy pulse that contracts instead of smoke fire.
        const shrink=s.chapter===4?1-ft*.36:1;
        this.quad(e.x+Math.cos(a)*offset,e.y+Math.sin(a)*offset,r*(i?.85+i%3*.13:1.65)*expand*shrink,s.fire,0,ft,e.seed+i,deathEnvelope(age,fireLife)*e.clarity,i?.85:1,a+ft*.2);
      }
      if(!s.reduced&&e.age<.055)this.quad(e.x,e.y,r*2.2,s.fire,1,t,e.seed,(1-e.age/.055)*(s.boss?.9:.65)*e.clarity);
      if(!s.reduced&&(s.elite||s.boss||s.chapter===4)&&t<.55)
        this.quad(e.x,e.y,r*(1.1+t*3.2),s.armor,s.chapter===4?4:3,t,e.seed,(1-t/.55)*.65);
      for(let i=0;i<s.fragments;i++){
        if(plates+crystals>=DEATH_LIMITS.fragments)break;
        const a=e.seed+i*Math.PI*2/s.fragments,dist=r*.4+(1-Math.exp(-Math.max(0,e.age-.025)*4))*r*(1.6+(i%3)*.25);
        const fade=t<.55?1:Math.max(0,(1-t)/.45);
        const size=(s.boss?12:s.elite?8:6)*e.scale*(1+i%3*.18)*fade;
        const mesh=s.chapter===4?this.crystals:this.plates,index=s.chapter===4?crystals++:plates++;
        if(index>=DEATH_LIMITS.fragments)continue;
        const drift=(1-Math.exp(-e.age*3))/3;
        this.dummy.position.set(e.x+Math.cos(a)*dist+e.vx*drift,e.y+Math.sin(a)*dist+e.vy*drift+e.age*e.age*35,4+Math.sin(t*Math.PI)*8);
        this.dummy.rotation.set(a+e.age*(i%2?7:-5),e.age*5,a+e.age*3);
        this.dummy.scale.set(size*(s.chapter===2?1.55:1),size,size*(s.chapter===3?1.8:1));this.dummy.updateMatrix();
        mesh.setMatrixAt(index,this.dummy.matrix);mesh.setColorAt(index,this.color.set(s.chapter===2||i%3===0?s.fire:s.armor));
      }
    }
    this.geometry.instanceCount=this.quads;this.mesh.visible=this.quads>0;
    for(const name of ['center','shape','tint','detail']){const a=this.geometry.attributes[name];a.clearUpdateRanges();a.addUpdateRange(0,this.quads*a.itemSize);a.needsUpdate=true;}
    for(const [mesh,count] of [[this.plates,plates],[this.crystals,crystals]]){mesh.count=Math.min(count,DEATH_LIMITS.fragments);mesh.visible=mesh.count>0;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;}
  }
  snapshot(){return {deathEvents:this.events.length,deathParticles:this.events.reduce((n,e)=>n+e.style.lobes+e.style.fragments,0),deathTime:this.time,deathQuads:this.quads,deathFragments:this.plates.count+this.crystals.count};}
  clear(){this.events.length=0;this.time=0;this.step(0);}
  dispose(){for(const mesh of [this.mesh,this.plates,this.crystals]){mesh.removeFromParent();mesh.geometry.dispose();}this.material.dispose();this.shardMaterial.dispose();}
}
