// Host-only visual particles. Simulation clock owns emission and expiry;
// positions exclude camera translation so camera scrolling never emits a trail.
export const ICE_PARTICLE_TEXTURES={
  trace:{key:'host://ice-particles-v2/trace',file:'trace_01.png'},
  chips:{key:'host://ice-particles-v2/chips',file:'dirt_01.png'},
};
export class IceWeaponTrails {
  constructor(scene,sourcePixelScale=.25){this.scene=scene;this.sourcePixelScale=sourcePixelScale;this.clock=0;this.camera=[0,0];this.emitters=new Map();this.particles=[];this.pool=[];this.created=0;this.limit=192;scene.events?.once('shutdown',()=>this.reset());}
  beginFrame(clock,camera){if(clock<this.clock)this.reset();this.clock=clock;this.camera=[...camera];}
  random(uid,seq){let v=(Math.imul(uid+1,1664525)+Math.imul(seq+7,1013904223))>>>0;v^=v>>>16;v=Math.imul(v,2246822519);return(v>>>0)/4294967296;}
  add(kind,x,y,vx,vy,size,rotation,at,life,alpha=.7){
    if(this.clock-at>=life)return;
    if(this.particles.length>=this.limit){const old=this.particles.shift();old.image.setVisible(false);this.pool.push(old.image);}
    const image=this.pool.pop()??this.scene.add.image(0,0,ICE_PARTICLE_TEXTURES[kind].key);
    if(!image.getData('iceTrail')){image.setData('iceTrail',true);this.created++;}
    image.setTexture(ICE_PARTICLE_TEXTURES[kind].key).setDepth(29.99).setBlendMode(0).setTint(kind==='chips'?0x91dfff:0x62cfff).setVisible(true);
    this.particles.push({image,x,y,vx,vy,size,rotation,at,life,alpha,kind});
  }
  projectile(b,screen){
    const saw=b.familyId===200141&&b.modelId===1000009;
    const blade=b.familyId===200031&&[1000032,1000006].includes(b.modelId);
    if(b.owner!=='player'||b.dead||b.visualHidden||!(b.scale>0)||(!saw&&!blade)||b.age<(b.warmup??0))return;
    const p=screen(b.x,b.z),x=p.x-this.camera[0],y=p.y-this.camera[1];
    const target=screen(b.x+(b.vx??0),b.z+(b.vz??0));let dx=target.x-p.x,dy=target.y-p.y;
    const length=Math.hypot(dx,dy);if(length>.001){dx/=length;dy/=length;}else{dx=0;dy=-1;}
    let e=this.emitters.get(b.uid);
    if(!e||this.clock-e.at>.2||Math.hypot(x-e.x,y-e.y)>180){e={x,y,at:this.clock,next:this.clock,seq:0,hits:new Map()};this.emitters.set(b.uid,e);}
    const factor=Math.min(1.8,Math.max(.7,b.scale??1)),interval=saw?.04:.045;
    // Match the displayed 1254px saw sprite, outside its opaque serrated rim.
    const sawRadius=1254*.12*this.sourcePixelScale*.8*(b.scale??1)/2;
    const visible=p.x>-80&&p.y>-80&&p.x<(this.scene.scale?.width??540)+80&&p.y<(this.scene.scale?.height??960)+80;
    if(visible){
      for(let count=0;e.next<=this.clock+1e-8&&count<6;count++,e.next+=interval){
        const t=this.clock===e.at?1:Math.max(0,Math.min(1,(e.next-e.at)/(this.clock-e.at))),px=e.x+(x-e.x)*t,py=e.y+(y-e.y)*t;
        const r=this.random(b.uid,e.seq++);
        if(saw){
          // Emit around the rotating edge instead of hiding the entire wake
          // underneath the disc. Detached shards stay in world space.
          for(let i=0;i<2;i++){
            const a=e.next*Math.PI*4+r*Math.PI+i*Math.PI,nx=Math.cos(a),ny=Math.sin(a),rim=sawRadius+5*factor;
            this.add('chips',px+nx*rim,py+ny*rim,nx*30-ny*18,ny*30+nx*18,
              [21*factor,21*factor],a,e.next,.42,.95);
          }
          const side=(r-.5)*sawRadius,back=sawRadius+10*factor;
          this.add('trace',px-dx*back-dy*side,py-dy*back+dx*side,-dx*20,-dy*20,
            [23*factor,42*factor],Math.atan2(dy,dx)+Math.PI/2,e.next,.34,.65);
          continue;
        }
        const side=(r-.5)*30*factor,back=8*factor;
        const sx=px-dx*back-dy*side,sy=py-dy*back+dx*side;
        this.add('trace',sx,sy,-dx*12,-dy*12,[32*factor,(saw?36:52)*factor],Math.atan2(dy,dx)+Math.PI/2,e.next,.22,.8);
        if(e.seq%2===0)this.add('chips',sx,sy,-dx*8-dy*(r-.5)*24,-dy*8+dx*(r-.5)*24,[18*factor,18*factor],r*Math.PI*2,e.next,.32,.75);
      }
      if(b.hitTimes instanceof Map)for(const[id,at]of b.hitTimes){
        if(e.hits.get(id)===at)continue;e.hits.set(id,at);
        // Ignore historical contacts first observed long after they happened.
        if(b.age-at>.12)continue;
        for(let i=0;i<5;i++){const angle=i*Math.PI*2/5+this.random(b.uid,i),vx=Math.cos(angle)*34,vy=Math.sin(angle)*34;
          this.add('chips',x,y,vx,vy,[15*factor,15*factor],angle,this.clock,.22,.8);}
      }
    }else e.next=this.clock+interval;
    e.x=x;e.y=y;e.at=this.clock;
  }
  endFrame(){
    for(const[id,e]of this.emitters)if(e.at!==this.clock)this.emitters.delete(id);
    const keep=[];
    for(const p of this.particles){const age=this.clock-p.at;if(age>=p.life){p.image.setVisible(false);this.pool.push(p.image);continue;}
      const f=Math.max(0,age/p.life),shrink=1-f*.5;
      p.image.setPosition(p.x+p.vx*age+this.camera[0],p.y+p.vy*age+this.camera[1]).setRotation(p.rotation+(p.kind==='chips'?age*2:0)).setDisplaySize(p.size[0]*shrink,p.size[1]*shrink).setAlpha(p.alpha*(1-f)*(1-f));keep.push(p);
    }this.particles=keep;
  }
  reset(){for(const p of this.particles)p.image.destroy();for(const p of this.pool)p.destroy();this.particles=[];this.pool=[];this.emitters.clear();this.created=0;}
  destroy(){this.reset();}
}
