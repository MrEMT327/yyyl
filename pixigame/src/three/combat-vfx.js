import * as T from 'three';
import { Container } from './display.js';
import { OrdnanceInstances, projectileAssets } from '../fixed-parts/projectile-art.js';
import { PulseRingBatch } from './pulse-ring.js';
import { ProjectileGlowBatch } from './projectile-glow.js';
import { WeaponFieldBatch } from './weapon-fields.js';
import { CommonWeaponRenderer } from './common-weapon-vfx.js';
import { DeathEffects, DEATH_LIMITS } from './death-effects.js';
import { createCosmeticBudget } from './cosmetic-budget.js';
import { ZBBY_ARSENAL } from '../fixed-parts/zbby-arsenal.js';
import { PROJECTILE_DISPLAY_SCALE } from '../fixed-parts/projectile-style.js';

const TRAILS = {
  twin: { life: .24, width: 4.5, tail: 4, glow: [16,30] },
  rail: { life: .32, width: 5.5, tail: 11, glow: [18,48] },
  missile: { life: .48, width: 5, tail: 14, glow: [16,34], engine: true, gain: .75 },
  hostile: { life: .20, width: 9, tail: 0, glow: [28,28], gain: .70 },
  plasma: { life: .32, width: 8, tail: 5, glow: [28,38] },
  siege: { life: .34, width: 6, tail: 10, glow: [22,38], engine: true },
  blade: { life: .28, width: 4.5, tail: 0, glow: [16,16], gain: .65 },
  drone: { life: .19, width: 3.6, tail: 8, glow: [13,24], engine: true, gain: .6 },
};
for(const [id,a] of Object.entries(ZBBY_ARSENAL)){
  const field=a.tick||a.sourceId==='mine_launcher';
  const pellet=a.pellets||a.side;
  TRAILS[id]={life:field?.28:a.whip?.16:pellet?.2:.26,width:field?5:a.burn?4:4.5,
    tail:field?0:pellet?3:a.harpoon?11:6,
    glow:field?[24,28]:a.harpoon?[18,44]:a.burn?[20,36]:pellet?[14,22]:[16,34],gain:a.burn?.65:.8};
}

// History ages on simulation time, independently of rendering and pausing.
export function sampleTrail(record, point, time, life) {
  const points = record.points;
  while (points.length && time - points[0].time > life) points.shift();
  if (point) {
    const last = points.at(-1);
    if (!last || Math.hypot(point.x - last.x, point.y - last.y) > .7) points.push({ ...point, time });
  }
  if (points.length > 64) points.splice(0, points.length - 64);
  return points;
}

class RibbonBatch {
  constructor(root, segments = 12000) {
    this.capacity = segments * 6;
    this.geometry = new T.BufferGeometry();
    for (const [key, size] of [['position', 3], ['uv', 2], ['tint', 4]]) {
      this.geometry.setAttribute(key, new T.BufferAttribute(new Float32Array(this.capacity * size), size).setUsage(T.DynamicDrawUsage));
    }
    this.material = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide, forceSinglePass:true, blending: T.AdditiveBlending,
      vertexShader: `attribute vec4 tint; varying vec4 vTint; varying vec2 vUv;
        void main(){vTint=tint;vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec4 vTint; varying vec2 vUv;
        void main(){float d=abs(vUv.x),edge=1.-smoothstep(.65,1.,d);
          float core=exp(-d*d*48.),body=exp(-d*d*5.);
          vec3 light=mix(vTint.rgb,vec3(1.),core*.08)*1.2;
          gl_FragColor=vec4(light,(body*.48+core*.12)*edge*vTint.a);
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new T.Mesh(this.geometry, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.userData.bloom = true;
    this.mesh.name = 'Motion history / energy filaments';
    root.add(this.mesh);
    this.count = 0;
    this.color = new T.Color();
  }
  path(points, time, life, width, color, gain=1) {
    if(points.length<2)return;
    // Shared vertex normals join broad ribbons without bright overlapping
    // rectangles or cracks at homing turns. Only sharp cusps shorten the join.
    const nodes=[];let distance=0;
    for(let i=0;i<points.length;i++){
      const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
      const dx=after.x-before.x,dy=after.y-before.y,n=Math.hypot(dx,dy)||1;
      if(i)distance+=Math.hypot(p.x-before.x,p.y-before.y);
      const fade=Math.max(0,1-(time-p.time)/life),w=width*Math.pow(fade,.65);
      nodes.push({x:p.x,y:p.y,nx:-dy/n*w,ny:dx/n*w,fade,distance});
    }
    this.color.set(color);
    const a=this.geometry.attributes;
    for(let i=1;i<nodes.length;i++){
      if(this.count+6>this.capacity)break;
      for(const [end,side] of [[0,-1],[0,1],[1,-1],[1,-1],[0,1],[1,1]]){
        const p=nodes[i-1+end],at=this.count++;
        a.position.setXYZ(at,p.x+p.nx*side,p.y+p.ny*side,3.5);
        a.uv.setXY(at,side,p.distance);
        a.tint.setXYZW(at,this.color.r,this.color.g,this.color.b,Math.pow(p.fade,1.15)*gain);
      }
    }
  }
  begin() { this.count = 0; }
  segment(a, b, widthA, widthB, color, alphaA, alphaB) {
    if (this.count + 6 > this.capacity) return;
    const dx = b.x - a.x, dy = b.y - a.y, length = Math.hypot(dx, dy);
    if (length < .01) return;
    const nx = -dy / length, ny = dx / length;
    this.color.set(color);
    const p = this.geometry.attributes.position, uv = this.geometry.attributes.uv, c = this.geometry.attributes.tint;
    for (const [end, side] of [[0,-1],[0,1],[1,-1],[1,-1],[0,1],[1,1]]) {
      const at = end ? b : a, w = end ? widthB : widthA;
      const i = this.count++;
      p.setXYZ(i, at.x + nx * w * side, at.y + ny * w * side, 2.5);
      uv.setXY(i, side, at.y);
      c.setXYZW(i, this.color.r, this.color.g, this.color.b, end ? alphaB : alphaA);
    }
  }
  finish() {
    this.geometry.setDrawRange(0, this.count);
    for (const attr of Object.values(this.geometry.attributes)) {
      attr.clearUpdateRanges(); attr.addUpdateRange(0, this.count * attr.itemSize); attr.needsUpdate = true;
    }
    this.mesh.visible = this.count > 0;
  }
}

// Fixed GPU batches: no per-particle meshes or canvas-drawn textures.
class ParticleBatch {
  constructor(root, smoke = false, capacity = 768, fireball = false) {
    this.capacity = capacity; this.smoke = smoke; this.items = [];
    const quad = new T.PlaneGeometry(1, 1);
    const g = this.geometry = new T.InstancedBufferGeometry();
    g.index = quad.index; g.attributes.position = quad.attributes.position; g.attributes.uv = quad.attributes.uv;
    for (const [key, size] of [['center',3],['shape',4],['tint',4]]) {
      g.setAttribute(key, new T.InstancedBufferAttribute(new Float32Array(capacity * size), size).setUsage(T.DynamicDrawUsage));
    }
    const material = new T.ShaderMaterial({
      transparent: true, depthWrite: false, side: T.DoubleSide,
      blending: smoke || fireball ? T.NormalBlending : T.AdditiveBlending,
      vertexShader: `attribute vec3 center;attribute vec4 shape;attribute vec4 tint;
        varying vec2 vUv;varying vec4 vTint;varying float vSeed;
        void main(){vUv=uv;vTint=tint;vSeed=shape.w;
          vec2 p=position.xy*shape.xy;float c=cos(shape.z),s=sin(shape.z);
          vec3 at=center+vec3(c*p.x-s*p.y,s*p.x+c*p.y,0.);
          gl_Position=projectionMatrix*modelViewMatrix*vec4(at,1.);}`,
      fragmentShader: `varying vec2 vUv;varying vec4 vTint;varying float vSeed;
        float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
        float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
          return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+1.),f.x),f.y);}
        void main(){vec2 p=vUv*2.-1.;float d=dot(p,p);
          ${fireball ? `float n=noise(p*5.+vSeed);
            float a=(1.-smoothstep(.28,.85,d+(n-.5)*.22))*vTint.a;
            vec3 hot=mix(vTint.rgb,vec3(1.,.76,.24),exp(-d*6.)*.65);
            gl_FragColor=vec4(hot,a);` : smoke ? `float n=noise(p*3.+vSeed)*.65+noise(p*7.-vSeed)*.35;
            float a=(1.-smoothstep(.12,1.,d))*smoothstep(.18,.75,n)*vTint.a;
            gl_FragColor=vec4(vTint.rgb*(.72+n*.5),a);` :
          `float a=exp(-d*3.8)*(1.-smoothstep(.45,1.,abs(p.y)))*vTint.a;
            gl_FragColor=vec4(vTint.rgb*2.3,a);`}
          #include <tonemapping_fragment>
          #include <colorspace_fragment>
        }`,
    });
    this.mesh = new T.Mesh(g, material);
    this.mesh.frustumCulled = false;
    this.mesh.userData.bloom = !smoke && !fireball;
    this.mesh.name = fireball ? 'Shared enemy explosions' : smoke ? 'Dissipating exhaust' : 'Hot fragments';
    root.add(this.mesh);
    this.color = new T.Color();
  }
  emit(p, priority = 'normal') {
    // Normal decoration cannot consume slots reserved for player damage or
    // explosions, including callers which emit muzzle particles directly.
    const reserve = priority === 'player' ? 0
      : (this.reserve?.player || 0) + (priority === 'explosion' ? 0 : this.reserve?.explosion || 0);
    if (this.items.length < this.capacity - reserve) this.items.push({ ...p, age: 0, seed: Math.random()*100 });
  }
  step(dt) {
    const { center, shape, tint } = this.geometry.attributes;
    let used = 0;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const p = this.items[i]; p.age += dt;
      if (p.age >= p.life) { this.items.splice(i, 1); continue; }
      p.x += p.vx*dt; p.y += p.vy*dt;
      const drag = Math.exp(-(this.smoke ? 2 : 3.5)*dt); p.vx *= drag; p.vy *= drag;
      const t = p.age / p.life, scale = this.smoke ? 1+t*2.2 : p.grow ? .8+t*.7 : 1-t*.4;
      center.setXYZ(used, p.x, p.y, this.smoke ? 1 : 3);
      shape.setXYZW(used, p.size*scale, p.size*scale*(p.stretch || 1), p.angle || 0, p.seed+t*.8);
      this.color.set(p.color);
      tint.setXYZW(used, this.color.r, this.color.g, this.color.b, (p.alpha ?? 1)*(1-t)**(this.smoke ? 1.2 : 1.7));
      used++;
    }
    this.geometry.instanceCount = used;
    this.mesh.visible = used > 0;
    for (const attr of [center, shape, tint]) {
      attr.clearUpdateRanges(); attr.addUpdateRange(0, used*attr.itemSize); attr.needsUpdate = true;
    }
  }
  clear() { this.items.length = 0; this.step(0); }
}

export function createCombatVfx() {
  const view = new Container({ label: 'blender-ordnance-and-vfx' });
  // A separate display container lets gameplay place danger above cosmetic
  // effects. It remains attached here for standalone weapon previews.
  const dangerView = new Container({label:'hostile-projectile-readability'});
  view.addChild(dangerView);
  const hostileInstances = new OrdnanceInstances(dangerView.object3D);
  const deaths = new DeathEffects(view.object3D);
  // Normal-blended shells/clouds must precede emissive filaments; the display
  // adapter assigns render order from child order (including world previews).
  const fields = new WeaponFieldBatch(view.object3D);
  const common = new CommonWeaponRenderer(view.object3D);
  const instances = new OrdnanceInstances(view.object3D);
  const ribbons = new RibbonBatch(view.object3D);
  const rings = new PulseRingBatch(view.object3D);
  const glows = new ProjectileGlowBatch(view.object3D);
  const smoke = new ParticleBatch(view.object3D, true, 128);
  const sparks = new ParticleBatch(view.object3D, false, 320);
  sparks.reserve = {player:16, explosion:64};
  const cosmeticBudget = createCosmeticBudget();
  // Reserved budget: projectile hit spam must not crowd out death feedback.
  const trails = new Set(), seenBlasts = new Map(), actors = new Map();
  let time = 0, energy = [], rays = [];
  ribbons.finish(); smoke.clear(); sparks.clear(); deaths.clear();

  function isNewEffect(key) {
    const seen = seenBlasts.has(key);
    // Expire history after the event disappears, not after its first flash.
    // A held combat snapshot (e.g. during the death sequence) must not replay.
    seenBlasts.set(key, time);
    return !seen;
  }

  function impact(x, y, color = 0xffb56b, scale = 1, explosion = false, options = {}) {
    const priority = options.priority || (explosion ? 'explosion' : 'normal');
    const kind = priority === 'normal' ? 'impact' : priority;
    if (!cosmeticBudget.allow(kind, x, y, time)) return;
    scale = Math.max(.1, Math.min(3, Number(scale) || 1));
    const ambient = priority === 'ambient';
    const count = Math.min(ambient ? 2 : 20, Math.round((explosion ? 12 : 5)*scale));
    for (let i = 0; i < count; i++) {
      const angle = Math.random()*Math.PI*2, speed = (explosion ? 160 : 95)*(.3+Math.random())*Math.sqrt(scale);
      sparks.emit({ x, y, vx: Math.sin(angle)*speed, vy: -Math.cos(angle)*speed,
        life: (explosion ? .27 : .1)+Math.random()*.2, size: 1.6+Math.random()*2,
        stretch: 2.4+Math.random()*3.5, angle, color: ambient || i%3 ? color : 0xffe6c3 }, priority);
    }
    if (!ambient && options.core !== false && (priority === 'player' || cosmeticBudget.allow('core', x, y, time))) {
      sparks.emit({ x, y, vx: 0, vy: 0, life: explosion ? .075 : .045,
        size: (explosion ? 22 : 8)*scale, stretch: .75, color: 0xffdcb0, alpha: .5 }, priority);
    }
    if (explosion && !ambient) for (let i = 0; i < 3; i++) {
      if (!cosmeticBudget.allow('smoke', x, y, time)) break;
      const angle = Math.random()*Math.PI*2, distance = Math.random()*12*scale;
      smoke.emit({ x: x+Math.cos(angle)*distance, y: y+Math.sin(angle)*distance,
        vx: Math.cos(angle)*18, vy: Math.sin(angle)*18+10, size: (18+Math.random()*22)*scale,
        life: .3+Math.random()*.2, color: 0x69717a, alpha: .18, angle });
    }
  }

  function drawGlyph(v){
    const {x,y,radius:r,color,shape}=v,alpha=v.alpha??1,phase=v.rotation??time;
    const line=(points,width=2,c=color,a=alpha)=>{for(let i=1;i<points.length;i++)ribbons.segment(points[i-1],points[i],width,width,c,a,a);};
    const ring=(radius,start=0,sweep=Math.PI*2,c=color,width=1.6)=>line(Array.from({length:33},(_,i)=>({x:x+Math.sin(start+i/32*sweep)*radius,y:y-Math.cos(start+i/32*sweep)*radius})),width,c);
    const glow=(px,py,w,h,c=color,a=.22)=>glows.add(px,py,w,h,0,c,a*alpha);
    if(shape==='orb'||shape==='pyro'){
      glow(x,y,r*2.8,r*2.8,color,1.25);ring(r,0,Math.PI*2,color,2.4);ring(r*.7,phase,Math.PI*1.5,0xe9faff,1.4);
      line(Array.from({length:33},(_,i)=>({x:x+Math.sin(i/32*Math.PI*2)*r,y:y+Math.cos(i/32*Math.PI*2)*r*.35})),1.2);
      glow(x,y,r*1.2,r*1.2,v.rank>=1?0x79ef9d:0xffffff,2.2);
      if(shape==='pyro')for(let i=0;i<5;i++){const a=phase+i*Math.PI*.4;glow(x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.6,r*.9,r*1.3,0xff8e40,1.2);}
    }else if(shape==='shield'){
      const a=v.angle||0;ring(r,a-1.2,2.4,color,6);ring(r*.82,a-1.2,2.4,0xe6f7ff,1.8);
      glow(x,y,r*1.4,r*.65,color,.3);
      if(v.rank>=2)for(let i=0;i<Math.min(16,v.durability||0);i++){const t=a-1.1+i/15*2.2;line([{x:x+Math.sin(t)*r*.92,y:y-Math.cos(t)*r*.92},{x:x+Math.sin(t)*r*1.04,y:y-Math.cos(t)*r*1.04}],1.1);}
    }else if(shape==='mine'||shape==='lightmine'){
      ring(12,phase,Math.PI*2,color,2);ring(6,0,Math.PI*2,shape==='mine'?0xff5a6b:0xffffff,2);
      if(v.rank>=2)ring(r,0,Math.PI*2,0x65b9ff,.55);
      if(v.core){ring(22,phase,Math.PI*1.6,0xffd46a,3);ring(27,-phase,Math.PI*1.5,0xff668e,1.2);}
      glow(x,y,23,23,v.rank>=1?0x79ef9d:0xff7d83,.4);
      if(v.alert)glow(x,y,18,18,0xff334f,.35+Math.sin(time*35)*.3);
    }else if(shape==='toxin'||shape==='cloud'){
      fields.add(x,y,r,color,(shape==='cloud'?.3:.22)*alpha,time);
      for(let i=0;i<6;i++){const a=i*Math.PI/3+time*.15,rad=r*(.32+.05*Math.sin(time+i));glow(x+Math.cos(a)*rad,y+Math.sin(a)*rad,r*1.7,r*1.5,color,.22);}
      line(Array.from({length:49},(_,i)=>{const a=i/48*Math.PI*2,rr=r*(.87+.07*Math.sin(a*5+time));return {x:x+Math.cos(a)*rr,y:y+Math.sin(a)*rr};}),1.6,color,.7*alpha);
      if(v.rank>=2)for(let i=0;i<4;i++){const a=i*1.8;glow(x+Math.cos(a)*r*.6,y+Math.sin(a)*r*.5,6,6,0x9decd9,.6);}
    }else if(shape==='fire'){
      fields.add(x,y,r,0xcc4f24,.22*alpha,time*2);
      glow(x,y,r*2.4,r*2,0xff672f,.7);
      for(let i=0;i<5;i++){const dx=(i-2)*r*.25,tip=r*(.4+.25*Math.sin(time*9+i));line([{x:x+dx-r*.12,y:y+r*.2},{x:x+dx+Math.sin(time*7+i)*r*.12,y:y-tip},{x:x+dx+r*.12,y:y+r*.2}],2.8, i%2?0xffd884:0xff6c4a);}
      if(v.rank>=2)ring(r*.85,0,Math.PI*2,0x66a8ff,.8);
    }else if(shape==='drone'){
      const a=v.angle||0,at=(dx,dy)=>({x:x+dx*Math.cos(a)-dy*Math.sin(a),y:y+dx*Math.sin(a)+dy*Math.cos(a)});
      line([at(0,-r),at(-r*.8,r*.8),at(0,r*.35),at(r*.8,r*.8),at(0,-r)],v.mother?4:2.8,v.mother?0xff668e:color);
      glow(x,y,r*1.2,r*1.2,v.mother?0xff668e:v.rank>=1?0x79ef9d:0xffffff,1.5);line([at(0,r*.6),at(0,r*2.2)],2,0x65b9ff,.9);
      if(v.rank>=2)for(let i=0;i<Math.min(v.hp||0,4);i++){const p=at((i-1)*r*.4,r);glow(p.x,p.y,4,4,0x65b9ff,.7);}
      if(v.mother)for(const dx of [-.55,0,.55]){line([at(dx*r,-r*.3),at(dx*r,-r*1.15)],3.4,0xffffff);const p=at(dx*r,-r*1.15);glow(p.x,p.y,9,12,0xff668e,1.2);}
    }else if(shape==='frost'){
      ring(r,0,Math.PI*2,0x9fd8ff,2*alpha);
      for(let i=0;i<6;i++){const a=i*Math.PI/3;line([{x:x+Math.cos(a)*r*.6,y:y+Math.sin(a)*r*.6},{x:x+Math.cos(a+.2)*r*1.2,y:y+Math.sin(a+.2)*r*1.2}],2,color,alpha);}
      glow(x,y,r*2,r*2,0x89beff,.16);
    }
  }

  return {
    view, dangerView, impact,
    enemyExplosion(x, y, scale = 1, reducedMotion = false, options = {}) {
      deaths.emit(x, y, scale, reducedMotion, options);
    },
    // Cinematics advance only death feedback, not frozen weapon simulations.
    stepDeaths(dt) { deaths.step(dt); },
    muzzle(x,y,angle,color=0xffc78a) {
      if (!cosmeticBudget.allow('muzzle', x, y, time)) return;
      sparks.emit({x,y,vx:Math.sin(angle)*55,vy:-Math.cos(angle)*55,life:.055,size:3.5,stretch:4.5,angle,color});
    },
    setEnergy(nextEnergy, nextRays, blasts) {
      energy = nextEnergy; rays = nextRays;
      for (const blast of blasts) {
        const key = `${blast.source.projectileId}/${blast.key}/${blast.at}`;
        if (!isNewEffect(key)) continue;
        impact(blast.x,blast.y,0xffbe7c,Math.min(2.4,Math.max(.7,blast.radius/65)),true);
      }
    },
    step(dt, projectiles, hostileProjectiles = []) {
      time += dt;
      instances.begin(); hostileInstances.begin(); ribbons.begin(time); rings.begin(time); glows.begin(time);fields.begin();common.begin(time);
      const present = new Set();
      for (const visual of energy) {
        if (visual.common) common.add(visual);
        else if (visual.kind === 'glyph') drawGlyph(visual);
        else if (visual.kind === 'projectile') {
          present.add(visual.id);
          let b = actors.get(visual.id);
          if (!b) {
            b = { active:true, view:{scale:{x:1}} };
            b.artModel = { kind:visual.model, owner:b, points:[], smokeAt:0 };
            actors.set(visual.id,b);
          }
          Object.assign(b,{x:visual.x,y:visual.y,vx:Math.sin(visual.angle),vy:-Math.cos(visual.angle)});
          Object.assign(b.artModel,{scaleX:visual.width,scaleY:Math.sqrt(visual.width),color:visual.color,rotation:visual.rotation,fieldRadius:visual.fieldRadius});
        } else if (dt>0 && ['muzzle','impact','blast'].includes(visual.kind) && isNewEffect(visual.id)) {
          if (visual.kind==='muzzle') {
            if (cosmeticBudget.allow('muzzle', visual.x, visual.y, time)) {
              sparks.emit({x:visual.x,y:visual.y,vx:0,vy:-40,life:.06,size:3,stretch:4,angle:visual.angle,color:visual.color});
            }
          } else impact(visual.x,visual.y,visual.color,
            visual.kind==='blast'?Math.min(2.4,Math.max(.7,visual.radius/65)):.8,visual.kind==='blast');
        } else if (visual.kind==='wave') rings.add(visual);
      }
      for (const [id,b] of actors) if (!present.has(id)) { b.artModel.owner=null; actors.delete(id); }
      const drawProjectile = b => {
        if (!b.artModel || !b.active) return;
        const art = b.artModel, spec = TRAILS[art.kind];
        (art.kind==='hostile'?hostileInstances:instances).add(b); trails.add(art);
        const angle = Math.atan2(b.vx,-b.vy), tail = spec.tail*art.scaleY*1.1*PROJECTILE_DISPLAY_SCALE;
        const point = {x:b.x-Math.sin(angle)*tail,y:b.y+Math.cos(angle)*tail};
        sampleTrail(art,point,time,spec.life);
        const headScale=Math.sqrt(art.scaleX)*PROJECTILE_DISPLAY_SCALE,offset=spec.engine?tail+3*headScale:0;
        if(art.fieldRadius)glows.add(b.x,b.y,art.fieldRadius*2,art.fieldRadius*2,angle,art.color,.08);
        glows.add(b.x-Math.sin(angle)*offset,b.y+Math.cos(angle)*offset,
          spec.glow[0]*headScale,spec.glow[1]*headScale,angle,art.color,spec.gain??1);
        if (dt>0 && art.kind === 'missile' && time >= art.smokeAt) {
          if (cosmeticBudget.allow('smoke', point.x, point.y, time)) {
            smoke.emit({ ...point, vx:-b.vx*.045,vy:-b.vy*.045,size:7,life:.42,color:0x8b929a,alpha:.16 });
          }
          art.smokeAt = time+1/35;
        }
      };
      for (const b of projectiles) drawProjectile(b);
      for (const b of hostileProjectiles) drawProjectile(b);
      for (const b of actors.values()) drawProjectile(b);
      for (const art of trails) {
        const spec = TRAILS[art.kind];
        const points = sampleTrail(art,null,time,spec.life);
        if (!points.length && !art.owner) { trails.delete(art); continue; }
        ribbons.path(points,time,spec.life,spec.width*Math.sqrt(art.scaleX)*PROJECTILE_DISPLAY_SCALE,art.color,spec.gain??.9);
      }
      for (const beam of energy) {
        if (beam.common || beam.kind && !['beam','prism','tesla','link','circuit'].includes(beam.kind)) continue;
        const width = Math.min(100,Math.max(.7,beam.width*.5));
        for(let i=1;i<beam.points.length;i++) ribbons.segment(beam.points[i-1],beam.points[i],width,width,beam.color,beam.alpha*.75,beam.alpha*.75);
      }
      for (const ray of rays) ribbons.segment({x:ray.x,y:ray.y},{x:ray.x2,y:ray.y2},ray.width*.55,ray.width*.55,ray.color,ray.alpha*.7,ray.alpha*.7);
      for (const [key, at] of seenBlasts) if(time-at>2) seenBlasts.delete(key);
      instances.finish(); hostileInstances.finish(); ribbons.finish(); rings.finish(); glows.finish();fields.finish();common.finish(); sparks.step(dt); smoke.step(dt); deaths.step(dt);
    },
    clear() {
      trails.clear(); seenBlasts.clear(); actors.clear(); energy=[]; rays=[]; time=0;
      cosmeticBudget.clear();
      sparks.clear(); smoke.clear(); deaths.clear(); instances.begin(); instances.finish(); hostileInstances.begin();hostileInstances.finish();ribbons.begin(0); ribbons.finish();
      rings.begin(0);rings.finish();glows.begin(0);glows.finish();fields.begin();fields.finish();common.begin(0);common.finish();
    },
    snapshot() {
      return { ...projectileAssets,...common.snapshot(), time, instances:instances.count+hostileInstances.count, hostileInstances:hostileInstances.count, trails:trails.size,
        trailVertices:ribbons.count, sparks:sparks.items.length, smoke:smoke.items.length, ...deaths.snapshot(),
        pulseRings:rings.count,glowingHeads:glows.count,fields:fields.count,
        kinds:[...new Set([...actors.values()].map(b=>b.artModel.kind))],
        batches:[...instances.batches.values(),...hostileInstances.batches.values()].flat().filter(m=>m.count>0).length,
        limits:{instancesPerKind:instances.capacity,sparks:sparks.capacity,smoke:smoke.capacity,deathEvents:DEATH_LIMITS.events,deathQuads:DEATH_LIMITS.quads,deathFragments:DEATH_LIMITS.fragments,
          pulseRings:rings.capacity,glowingHeads:glows.capacity,trailVertices:ribbons.capacity} };
    },
    dispose() {
      this.clear(); instances.dispose();hostileInstances.dispose();dangerView.destroy();common.dispose();deaths.dispose();
      for (const batch of [ribbons,rings,glows,fields,smoke,sparks]) {
        batch.mesh.removeFromParent(); batch.geometry.dispose(); batch.mesh.material.dispose();
      }
      view.destroy();
    },
  };
}
