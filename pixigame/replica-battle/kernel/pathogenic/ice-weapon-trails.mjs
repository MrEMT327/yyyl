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
    const texture=ICE_PARTICLE_TEXTURES[kind==='chips'||kind==='flake'?'chips':'trace'].key;
    const image=this.pool.pop()??this.scene.add.image(0,0,texture);
    if(!image.getData('iceTrail')){image.setData('iceTrail',true);this.created++;}
    const light=kind==='streak'||kind==='spark';
    const tint=kind==='chips'?0xbceef5:kind==='flake'?0xc8f4ff:kind==='spark'?0xdaf7ff:kind==='streak'?0x87deff:kind==='mist'?0x9eddeb:0x91e0ed;
    image.setTexture(texture).setDepth(29.99).setBlendMode(light?1:0).setTint(tint).setVisible(true);
    this.particles.push({image,x,y,vx,vy,size,rotation,at,life,alpha,kind});
  }
  projectile(b,screen){
    const saw=b.familyId===200141&&b.modelId===1000009;
    const blade=b.familyId===200031&&[1000032,1000006].includes(b.modelId);
    if(b.owner!=='player'||b.dead||b.visualHidden||!(b.scale>0)||(!saw&&!blade)||b.age<(b.warmup??0)||b.age<0||b.age>=b.lifetime)return;
    const p=screen(b.x,b.z),x=p.x-this.camera[0],y=p.y-this.camera[1];
    const target=screen(b.x+(b.vx??0),b.z+(b.vz??0));let dx=target.x-p.x,dy=target.y-p.y;
    const length=Math.hypot(dx,dy);
    if(![x,y,length].every(Number.isFinite)||blade&&length<=.001)return;
    if(length>.001){dx/=length;dy/=length;}else{dx=0;dy=-1;}
    let e=this.emitters.get(b.uid);
    if(!e||this.clock-e.at>.2||Math.hypot(x-e.x,y-e.y)>180){e={x,y,at:this.clock,next:this.clock,seq:0,hits:new Map()};this.emitters.set(b.uid,e);}
    const fragment=blade&&b.weaponId===200038;
    const factor=Math.min(1.8,Math.max(.7,b.scale??1)),interval=saw?.04:fragment?.10:.05;
    // Match the existing view-only body transform, not the combat radius.
    const bladeHalf=1254*.16*this.sourcePixelScale*1.15*(b.scale??1)/2;
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
        // Alternate the two tips. Short detached frost replaces the long bright
        // central threads; secondary split blades carry a lighter particle load.
        const sign=e.seq%2?1:-1,side=sign*bladeHalf*.92,back=bladeHalf*.16+3*factor;
        const sx=px-dx*back-dy*side,sy=py-dy*back+dx*side,rotation=Math.atan2(dy,dx)+Math.PI/2;
        const stretch=Math.min(1.2,Math.max(.8,length/600));
        if(!fragment||e.seq%2===0)this.add('mist',sx-dx*4,sy-dy*4,-dx*12-dy*sign*5,-dy*12+dx*sign*5,
          [36*factor,50*factor*stretch],rotation,e.next,.24,fragment?.24:.46);
        if(!fragment)this.add('streak',sx,sy,-dx*14,-dy*14,
          [13*factor,34*factor*stretch],rotation,e.next,.16,.70);
        const spread=sign*(8+r*9);
        this.add('spark',sx,sy,-dx*10-dy*spread,-dy*10+dx*spread,
          [8*factor,(11+r*5)*factor],rotation+(r-.5)*.4,e.next,.20+r*.04,fragment?.52:.85);
        // Tiny solid ice flecks peel outward from the tips. Their short lives
        // share the same bounded pool; split children emit only every other tick.
        if(!fragment||e.seq%2===0){
          const outward=sign*(12+r*14),jitter=(r-.5)*5*factor;
          this.add('flake',sx-dy*jitter,sy+dx*jitter,-dx*12-dy*outward,-dy*12+dx*outward,
            [(5+r*2)*factor,(7+r*2)*factor],rotation+r*2,e.next,.24+r*.06,fragment?.58:.86);
        }
        // A quiet central frost wake starts at the inner rear edge, behind the
        // already-approved body. It is diffuse rather than another bright thread.
        if(!fragment&&e.seq%2===0){
          const tail=bladeHalf*.16;
          this.add('mist',px+dx*tail,py+dy*tail,-dx*18,-dy*18,
            [52*factor,64*factor*stretch],rotation,e.next,.22,.24);
        }
      }
      if(b.hitTimes instanceof Map)for(const[id,at]of b.hitTimes){
        if(e.hits.get(id)===at)continue;e.hits.set(id,at);
        // Ignore historical contacts first observed long after they happened.
        if(b.age-at>.12)continue;
        const count=fragment?2:4;
        for(let i=0;i<count;i++){const angle=i*Math.PI*2/count+this.random(b.uid,i),vx=Math.cos(angle)*30,vy=Math.sin(angle)*30;
          this.add('chips',x,y,vx,vy,[11*factor,11*factor],angle,this.clock,.17,fragment?.45:.72);}
      }
    }else e.next=this.clock+interval;
    e.x=x;e.y=y;e.at=this.clock;
  }
  endFrame(){
    for(const[id,e]of this.emitters)if(e.at!==this.clock)this.emitters.delete(id);
    let keep=0;
    for(const p of this.particles){const age=this.clock-p.at;if(age>=p.life){p.image.setVisible(false);this.pool.push(p.image);continue;}
      const f=Math.max(0,age/p.life),size=p.kind==='mist'?1+f*.8:1-f*.5;
      const fade=(1-f)*(p.kind==='streak'||p.kind==='spark'?1-f*.25:1-f);
      p.image.setPosition(p.x+p.vx*age+this.camera[0],p.y+p.vy*age+this.camera[1]).setRotation(p.rotation+(p.kind==='chips'?age*2:p.kind==='flake'?age*5:0)).setDisplaySize(p.size[0]*size,p.size[1]*size).setAlpha(p.alpha*fade);this.particles[keep++]=p;
    }this.particles.length=keep;
  }
  reset(){for(const p of this.particles)p.image.destroy();for(const p of this.pool)p.destroy();this.particles=[];this.pool=[];this.emitters.clear();this.created=0;}
  destroy(){this.reset();}
}
