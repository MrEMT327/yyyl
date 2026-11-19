export class NativeIceTrail {
  constructor(host,sourcePixelScale=.25){
    this.scene=host;this.sourcePixelScale=sourcePixelScale;this.clock=0;this.camera=[0,0];this.emitters=new Map();this.particles=[];this.limit=192;
  }
  beginFrame(clock,camera){if(clock<this.clock)this.reset();this.clock=clock;this.camera=camera;}
  random(uid,seq){let v=(Math.imul(uid+1,1664525)+Math.imul(seq+7,1013904223))>>>0;v^=v>>>16;v=Math.imul(v,2246822519);return (v>>>0)/4294967296;}
  add(kind,x,y,vx,vy,size,rotation,at,life,alpha=.7){
    if(this.clock-at>=life)return;
    if(this.particles.length>=this.limit)this.scene.stage.remove(this.particles.shift().mesh);
    const key='host://ice-particles-v2/'+(kind==='chips'||kind==='flake'?'chips':'trace');
    const binding=this.scene.art.get(key);if(!binding)return;
    const mesh=this.scene.stage.makeSprite(binding,29.99),light=kind==='streak'||kind==='spark';
    if(light){mesh.material.blendDst=201;mesh.material.needsUpdate=true;}
    this.scene.stage.tint(mesh,{chips:0xbceef5,flake:0xc8f4ff,spark:0xdaf7ff,streak:0x87deff,mist:0x9eddeb}[kind]??0x91e0ed);
    this.particles.push({mesh,x,y,vx,vy,size,rotation,at,life,alpha,kind});
  }
  endFrame(){
    for(const [id,e] of this.emitters)if(e.at!==this.clock)this.emitters.delete(id);
    let used=0;
    for(const p of this.particles){
      const age=this.clock-p.at;if(age>=p.life){this.scene.stage.remove(p.mesh);continue;}
      const f=Math.max(0,age/p.life),s=p.kind==='mist'?1+f*.8:1-f*.5;
      p.mesh.position.set(p.x+p.vx*age+this.camera[0],p.y+p.vy*age+this.camera[1],0);
      p.mesh.rotation.z=p.rotation+(p.kind==='chips'?age*2:p.kind==='flake'?age*5:0);
      p.mesh.material.uniforms.size.value.set(p.size[0]*s,p.size[1]*s);
      p.mesh.material.uniforms.opacity.value=p.alpha*(1-f)*(p.kind==='streak'||p.kind==='spark'?1-f*.25:1-f);
      this.particles[used++]=p;
    }
    this.particles.length=used;
  }
  reset(){for(const p of this.particles)this.scene.stage.remove(p.mesh);this.particles.length=0;this.emitters.clear();}
  destroy(){this.reset();}
}

