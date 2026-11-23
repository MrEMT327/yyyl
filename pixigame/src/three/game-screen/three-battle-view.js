import * as T from 'three';
import {BattleArt} from './h5-battle-screen.js';
import {makeBattleGroup,makeBattlePart,selectBattleRegion} from './three-battle-parts.js';
import {queueBattleArt,floatingText,pickupArt,treasureArt} from './three-battle-items.js';
import {healthAt,keepDyingBar,urgency,damageBorder} from './three-battle-feedback.js';
import {enemyArt} from '../../../replica-battle/three-enemies/index.js';
import {sampleNativeEnemyAnimation} from '../../../replica-battle/kernel/native-enemy-animation.ts';
import {BattleShotPresentation} from '../../../replica-battle/kernel/enemy-recoil-shots.ts';
import {battleTexturePaths} from '../../../replica-battle/kernel/pathogenic/battle-texture-dependencies.mjs';
import {playerVisibility} from '../../../replica-battle/kernel/combat-readability.mjs';

const width=540,height=960;
// Large situational atlases aren't needed for the first presentation. In
// WeChat their download retries must not hold the opening flight hostage.
export function deferWechatBattleArtwork(key,url){
  return key==='res://gfx/environment/explosion_dna.png'||key==='res://gfx/enemies/stomp_wave.png'||
    /\/original-projectiles\/square-yellow-v1\.png(?:[?#]|$)/.test(url);
}
export class NativeBattleView {
  constructor(content,sim,ready,appearance,source) {
    Object.assign(this,{content,sim,ready,appearance,source});
    this.stage=appearance.screen.stage;this.art=new BattleArt(content.assets.sprites,appearance.battleAssetBase);
    this.backgroundBinding=this.stage.ground.userData.binding;
    this.pendingArt=new Map();this.objects=new Map();this.motions=new Map();this.active=new Set();
    this.models=new Map();this.paths=new Map();this.coastBackgroundTime=0;
    this.rawDelta=0;this.closed=false;this.px=width/content.world.width;
    this.cameraView=new source.ViewPosition({x:0,z:0},true);this.mapCameraOffsets=new source.MapOffsets();
    this.cameraRunId=-1;this.cameraTargetRevision=-1;this.renderSamples=new source.Samples();
    this.statusIndex=new source.StatusIndex();this.missileMounts=new source.MissileMounts();
    this.shots=new BattleShotPresentation();this.project=(x,z)=>this.screen(x,z);
    for(const [key,p] of Object.entries(content.assets.prefabs))for(const id of p.modelIds||[])this.models.set(id,key);
    for(const [key,s] of Object.entries(content.assets.sprites))if(s.pathId)this.paths.set(String(s.pathId),key);
    this.fx=source.effects(this);
    this.fx.configureHost({weaponSkinId:()=>content.combat.studyLoadout?.selectedGunIds??Number(content.combat.studyLoadout?.selectedGunId||0),
      playerBulletCount:()=>sim.projectiles.filter(b=>b.owner==='player'&&!b.dead).length,
      raycastBeam:q=>this.sourceRaycast(q),nativeSwordEffects:content.assets.originalEffects});
  }
  get cameraPosition(){return this.cameraView.position;}
  screen(x,z){const c=this.cameraPosition;return {x:width/2+(x-c.x)*this.px,y:height/2-(z-c.z)*this.px};}
  queue(key,url){if(url)this.pendingArt.set(key,url);}
  async preload(progress,onDecoded,prioritize=false){
    const a=this.content.assets,need=key=>this.queue(key,a.sprites[key]?.url);
    const urgent=new Set();
    queueBattleArt(this);for(const row of this.source.urgencyNodes)if(row.sprite)need(row.sprite);
    if(prioritize){
      const earlyModels=[...new Set((this.content.spawns||[]).filter(row=>row.wave<=3)
        .map(row=>this.content.chapter.entities[row.entityId]?.modelId).filter(Number.isFinite))];
      const queueForWarmup={art:this.art,queue:(key,url)=>{urgent.add(key);this.queue(key,url);}};
      for(const author of enemyArt)author.preload(queueForWarmup,earlyModels);
      for(const model of earlyModels){
        const prefab=a.prefabs[this.models.get(model)];
        if(!prefab)continue;
        for(const key of [prefab.composite,...(prefab.renderers||[]).filter(r=>r.active&&r.enabled).map(r=>r.sprite)]){
          if(!a.sprites[key]?.url)continue;
          urgent.add(key);need(key);
        }
      }
    }
    const routed=prioritize?battleTexturePaths(this.fx.graph):null;
    for(const [path,t] of Object.entries(this.fx.graph.textures)){
      this.art.expectSize(path,t.width,t.height);
      if(routed&&!routed.has(path))this.art.defer(path,t.url);
      else this.queue(path,t.url);
    }
    for(const author of enemyArt)author.preload(this,Array.from(this.models.keys()));
    for(const r of a.enemyLocalAnimation?.spriteReferences||[])need(this.paths.get(String(r.pathId)));
    for(const [name,prefab] of Object.entries(a.prefabs)){
      if(this.appearance.replaceTerrain&&name===a.map.prefab)continue;
      if(prefab.composite)need(prefab.composite);
      else{
        const animated=new Set(a.enemyLocalAnimation?.animatedRendererPaths?.[name]||[]);
        for(const r of prefab.renderers||[])if(r.active&&r.enabled||animated.has(r.hierarchy?.join('/')))need(r.sprite);
      }
      for(const f of prefab.sequence?.frames||[])need(f);
    }
    for(const [key,sprite] of Object.entries(a.enemyHealthBars?.sprites||{}))this.queue(key,sprite.url);
    if(!this.appearance.replaceTerrain)for(const r of a.map.nativeLayers?.renderers||[])need(r.sprite);
    const required=new Map(),later=new Map();
    for(const [key,url] of this.pendingArt)(prioritize&&!urgent.has(key)&&deferWechatBattleArtwork(key,url)?later:required).set(key,url);
    await this.art.loadAll(required,progress,(key,texture)=>onDecoded?.(key,texture,urgent.has(key)));
    if(this.closed)return;this.ready();
    if(later.size)void this.art.loadAll(later,null,null,{workers:2,onFailure:(key,error)=>{
      if(!this.closed)console.warn('[Three 延后贴图]',key,error?.message||error);
    }});
  }
  prefab(id,depth){
    const key=this.models.get(id),a=this.content.assets,p=a.prefabs[key];
    for(const author of enemyArt){
      const group=author.create(this,id,this.px,p,author.spriteTable?a.sprites:a);
      if(group){
        group.userData.animate=author.update;
        return this.installGroup(group,depth);
      }
    }
    const group=makeBattleGroup(this);
    if(p?.composite&&this.art.get(p.composite)){
      const art=makeBattlePart(this,0,0,p.composite);
      art.scale.setScalar(this.px/a.sprites[p.composite].ppu);group.add(art);
    }else{
      const local=new Set(a.enemyLocalAnimation?.animatedRendererPaths?.[key]||[]);
      const rows=(p?.renderers||[]).filter(r=>this.art.get(r.sprite)&&((r.active&&r.enabled)||local.has(r.hierarchy?.join('/'))))
        .sort((a,b)=>(a.sortingOrder||0)-(b.sortingOrder||0));
      for(const r of rows){
        const sprite=a.sprites[r.sprite],node=makeBattlePart(this,0,0,r.sprite),piv=sprite.renderPivot||sprite.pivot||{x:.5,y:.5};
        node.material.uniforms.pivot.value.set(piv.x,1-piv.y);
        node.userData.path=r.hierarchy?.join('/');node.userData.sprite=r.sprite;
        const m=r.matrix;
        if(m)this.posePart(node,m.flat(),sprite.ppu,r.color?.a??1);
        else{node.position.set(r.x*this.px,-r.y*this.px,0);node.scale.set(r.scaleX*this.px/sprite.ppu,r.scaleY*this.px/sprite.ppu,1);node.rotation.z=-(r.rotation||0)*Math.PI/180;}
        group.add(node);
      }
    }
    return this.installGroup(group,depth);
  }
  installGroup(group,depth){
    this.stage.scene.add(group);group.children.forEach((n,i)=>{n.renderOrder=depth+i*.000001;});
    return group;
  }
  posePart(node,m,ppu,opacity){
    const a=m[0],b=-m[8],c=-m[1],d=m[9],sx=Math.hypot(a,b),sy=sx?(a*d-b*c)/sx:0;
    node.position.set(m[3]*this.px,-m[11]*this.px,0);node.scale.set(sx*this.px/ppu,sy*this.px/ppu,1);
    node.rotation.z=Math.atan2(b,a);node.material.uniforms.opacity.value=opacity;
  }
  enemy(e,dt,visualClock,status){
    const key='enemy:'+e.uid;this.active.add(key);
    let group=this.objects.get(key);
    if(!group){
      group=this.prefab(e.modelId,20);this.objects.set(key,group);
      let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
      for(const mesh of group.children){
        const u=mesh.material.uniforms,w=u.size.value.x*mesh.scale.x,h=u.size.value.y*mesh.scale.y;
        const cx=Math.cos(mesh.rotation.z),sy=Math.sin(mesh.rotation.z);
        for(const tx of [0,1])for(const ty of [0,1]){
          const x=(tx-u.pivot.value.x)*w,y=(ty-u.pivot.value.y)*h;
          const px=mesh.position.x+cx*x-sy*y,py=mesh.position.y+sy*x+cx*y;
          minX=Math.min(minX,px);maxX=Math.max(maxX,px);minY=Math.min(minY,py);maxY=Math.max(maxY,py);
        }
      }
      if(Number.isFinite(minX))this.source.deathBody(e,maxX-minX,maxY-minY,this.px);
    }
    const revision=e.viewPositionRevision??0,reset=e.viewResetPosition??{x:e.oldX,z:e.oldZ};
    let motion=this.motions.get(e.uid);
    if(!motion){motion={view:new this.source.ViewPosition(reset),target:{...reset},revision};this.motions.set(e.uid,motion);}
    if(motion.revision!==revision){motion.view.setPosition(reset);motion.target={...reset};motion.revision=revision;}
    if(motion.target.x!==e.x||motion.target.z!==e.z){motion.target={x:e.x,z:e.z};motion.view.setTargetPosition(motion.target);}
    const world=motion.view.update(dt),pos=this.project(world.x,world.z);
    if(group.userData.animate)group.userData.animate(group,e,world,dt,this.sim.clock,this.shots.recoilTimes.get(e.uid));
    else{
      const poses=sampleNativeEnemyAnimation(this.content.assets.enemyLocalAnimation,e.entityId,{age:e.age,mainState:e.dead?'Death':e.animationClip,mainTime:e.dead?e.deathAge||0:e.animationTime??e.age});
      if(poses){
        const byPath=new Map(poses.map(row=>[row.path,row]));
        for(const part of group.children){const pose=byPath.get(part.userData.path);
          if(!pose)continue;
          const tex=pose.spritePathId&&this.paths.get(pose.spritePathId);
          if(tex&&this.art.get(tex)){selectBattleRegion(part,tex);part.userData.sprite=tex;
            const pivot=this.content.assets.sprites[tex].renderPivot||this.content.assets.sprites[tex].pivot;
            if(pivot)part.material.uniforms.pivot.value.set(pivot.x,1-pivot.y);}
          this.posePart(part,pose.matrix,this.content.assets.sprites[part.userData.sprite].ppu,pose.spritePathId==='0'?0:pose.alpha);}
      }
      else this.sequence(group,e.modelId,e.age);
    }
    const hit=this.source.hitMotion(e,visualClock,status.frozen.has(e.uid));
    group.position.set(pos.x+hit.x,pos.y+hit.y,0);group.rotation.z=e.angle+hit.rotation;
    group.scale.set(e.scale*hit.scaleX,e.scale*hit.scaleY,1);
    const freezeState=group.userData.freeze??=this.source.freezeState();
    const frost=this.source.freeze(freezeState,status.frozen.has(e.uid),visualClock);
    let pulse=0;
    if(e.boss){
      let when=group.userData.bossHit??-Infinity;
      if(frost.suppressHitFlash||visualClock<(group.userData.lastClock??0))when=-Infinity;
      else if(e.hitFlash>0&&visualClock-when>=.4)when=visualClock;
      group.userData.bossHit=when;group.userData.lastClock=visualClock;
      pulse=.35*Math.max(0,1-(visualClock-when)/.12)**2;
    }
    for(const part of group.children){
      this.stage.tint(part,0xffffff,e.hitFlash>0&&!e.boss&&!frost.suppressHitFlash);
      const tone=part.material.uniforms.statusTint.value;
      if(frost.suppressHitFlash)tone.set(...frost.hitColor,frost.hitValue);else tone.set(1,1,1,pulse);
    }
    healthAt(this,e,world,visualClock);urgency(this,e,pos);
    if(!e.dead&&e.laserWarning){
      const w=e.laserWarning,c=Math.cos(e.angle),s=Math.sin(e.angle);
      w.mounts.forEach((mount,i)=>{const from={x:e.x+mount.x*c+mount.z*s,z:e.z-mount.x*s+mount.z*c};
        const end=this.source.warningEnd(from,w.target,this.content.world.width,this.content.world.height,this.sim.cameraWorldBounds);
        this.fx.warning(e.uid,i,w.until-e.age,this.project(from.x,from.z),this.project(end.x,end.z));});
    }
  }
  sequence(group,model,age){
    const seq=this.content.assets.prefabs[this.models.get(model)]?.sequence;
    if(!seq?.frames?.length)return;
    const frame=Math.floor(Math.max(0,age)*seq.fps),key=seq.frames[seq.loop===false?Math.min(frame,seq.frames.length-1):frame%seq.frames.length];
    if(!this.art.get(key))return;
    for(const part of group.children)if(part.userData.sprite===seq.rendererSprite){
      selectBattleRegion(part,key);const pivot=this.content.assets.sprites[key].pivot;
      part.material.uniforms.pivot.value.set(pivot.x,1-pivot.y);
    }
  }
  update(delta){
    const now=this.profileClock,t0=now?.();
    this.stage.refreshViewport?.();
    this.onFrame?.(delta);this.advanceCameraView(delta);
    const t1=now?.();
    const sim=this.sim,c=this.content,dt=sim.phase==='playing'?Math.min(Math.max(delta/1000,0),.1):0;
    this.active.clear();
    const clock=this.renderSamples.beginFrame(sim.clock,sim.runId,sim.phase,delta/1000),status=this.statusIndex.update(sim);
    const origin=this.project(0,0);this.fx.setCameraOffset(origin.x,origin.y);
    const count=this.shots.update(sim.enemies,sim.projectiles,sim.clock);
    this.fx.beginFrame(sim.clock,sim.runId,{playerBulletCount:count,visualClock:clock,escortSwords:sim.projectiles,escortPlayer:sim.player});
    const player=sim.player,p=this.project(player.x,player.z),selection=this.source.player(c);
    const entity=c.chapter.entities[c.chapter.player.entityId],profile=selection.layers[0];
    if(profile){
      const scale=this.px*profile.scale*Number(selection.plane?.modelScale??entity.modelScale)*sim.playerScale*Number(profile.transformScale??1);
      const body=this.appearance.playerSkin;
      body.update({clock:sim.clock,x:p.x,y:p.y,width:body.width*scale,height:body.height*scale,scaleX:1,scaleY:1,
        shearX:0,alpha:playerVisibility(sim.clock,player.invincible,sim.playerPhantomActive),visible:player.hp>0});
    }
    this.appearance.update({time:sim.time,coastBackgroundTime:this.coastBackgroundTime,clock:sim.clock,camera:this.cameraPosition,
      phantomActive:sim.playerPhantomActive,runId:sim.runId,victoryDeparture:sim.victoryDeparturePresentation,
      aircraftPassiveShot:this.source.passiveShot(sim.projectiles,sim.clock),lightingEffects:sim.effects,projectPoint:this.project,
      playerHitFlash:sim.phase==='playing'&&player.hp>0&&player.hitFlash>.14,renderDelta:dt,displayInterval:this.rawDelta/1000,
      flight:{x:player.x,z:player.z,speed:sim.playerMovementSpeed,radius:entity.stats.shape[0]*sim.playerScale,active:sim.phase==='playing'&&player.hp>0},
      mapCameraOffset:layer=>this.mapCameraOffsets.position(layer)});
    const t2=now?.();
    damageBorder(this,(sim.phase==='playing'||player.hp<=0)&&sim.phase!=='ready'&&player.hitFlash>0?this.renderSamples.age(.3-player.hitFlash):-1);
    for(const e of sim.enemies)this.enemy(e,dt,clock,status);
    for(const t of sim.treasures)treasureArt(this,t);
    for(const uid of this.motions.keys())if(!this.active.has('enemy:'+uid))this.motions.delete(uid);
    const mounts=this.appearance.missileMounts()?.map(m=>({x:player.x+(m.x-p.x)/this.px,z:player.z-(m.y-p.y)/this.px}));
    this.missileMounts.beginFrame(sim.clock,sim.runId,sim.projectiles,mounts);
    for(const b of sim.projectiles){
      const bullet=this.missileMounts.projectile(this.renderSamples.projectile(this.source.thunder(b)??b,c.chapter.player.weaponEntityId));
      this.fx.equipmentAccent(bullet,sim.equipmentProjectileAccent(b),this.project);
      if(!this.fx.weaponSkinProjectile(bullet,this.project))this.fx.projectile(bullet,this.project,Number(c.chapter.bullets[b.bulletId]?.parameters.Element??0));
    }
    for(const source of sim.pickups){
      const pickup=this.renderSamples.pickup(source),alpha=this.source.pickupAlpha(pickup,c.assets.battleItems[pickup.itemId]);
      this.fx.pickup(pickup,this.project,alpha);
      if(pickupArt(this,pickup,alpha))continue;
      const key='pickup:'+pickup.uid;this.active.add(key);let view=this.objects.get(key);
      if(!view){view=this.prefab(pickup.modelId,19);this.objects.set(key,view);}
      const pt=this.project(pickup.x,pickup.z);view.position.set(pt.x,pt.y,0);view.visible=pickup.age>=pickup.delay;
      for(const child of view.children)child.material.uniforms.opacity.value=alpha;
      this.sequence(view,pickup.modelId,pickup.age-pickup.delay);
    }
    for(const buff of status.visuals){
      const point=this.motions.get(buff.targetUid)?.view.position;
      const body=buff.targetUid?status.targets.get(buff.targetUid):null,shape=entity.stats.shape;
      const size=[170002,170001,170004,170012,220022,170000].includes(buff.modelId)?
        {visualRadiusX:body?.radiusX??shape[0]*sim.playerScale,visualRadiusZ:body?.radiusZ??(shape[1]??shape[0])*sim.playerScale}:{};
      this.fx.status({...buff,...size,x:point?.x??buff.x,z:point?.z??buff.z,age:Number.isFinite(buff.age)?this.renderSamples.age(buff.age):buff.age,
        ...(Number.isFinite(buff.remaining)?{remaining:buff.remaining+Math.max(0,sim.clock-clock)}:{})},this.project);
    }
    for(const effect of sim.effects)this.effect(effect);
    for(const effect of this.source.feedback(sim))this.effect(effect);
    this.fx.endFrame();
    for(const [key,obj] of this.objects)if(!this.active.has(key)){
      if(sim.phase!=='ready'&&keepDyingBar(obj,clock))continue;
      this.stage.remove(obj);this.objects.delete(key);
    }
    const t3=now?.(),passes=this.stage.render(now);
    if(now)this.reportSlowFrame?.({interval:this.rawDelta,logic:t1-t0,terrainAndPlane:t2-t1,entitiesAndEffects:t3-t2,draw:now()-t3,...passes});
  }
  effect(e){
    if(!e||e.age<0)return;
    let row=e;
    if(e.followPlayer)row={...e,x:this.sim.player.x+(e.followOffset?.x||0),z:this.sim.player.z+(e.followOffset?.z||0)};
    if(e.ownerUid){const pos=this.motions.get(e.ownerUid)?.view.position;if(!pos)return;row={...row,x:pos.x,z:pos.z};}
    if(e.kind!=='text')this.fx.effect(row,this.project,this.source.deathScale(row));
    else floatingText(this,row,this.source.textLayout(e,this.renderSamples.age(e.age)));
  }
  // Hosts can wrap the update to measure renderer timing.
  paintFrame(update){return update();}
  start(progress,frame,fail,{now=()=>performance.now(),requestFrame=callback=>requestAnimationFrame(callback),cancelFrame=id=>cancelAnimationFrame(id),warmTextures}={}){
    let last=now(),id=0;
    const tick=time=>{
      if(this.closed)return;
      try{this.rawDelta=Math.max(0,time-last);last=time;this.paintFrame(()=>this.update(this.scaledDelta?this.scaledDelta(this.rawDelta):this.rawDelta));
        frame();id=requestFrame(tick);}catch(error){fail(error);}
    };
    for(const job of warmTextures?this.stage.warmupJobs():[])warmTextures.push(job);
    this.preload(progress,warmTextures?.add,Boolean(warmTextures)).then(()=>{warmTextures?.close();if(!this.closed){last=now();id=requestFrame(tick);}})
      .catch(error=>{warmTextures?.close();fail(error);});
    return ()=>{this.closed=true;warmTextures?.close();cancelFrame(id);this.fx.destroy();this.art.dispose();
      this.stage.remove(this.damageBorder);for(const obj of this.objects.values())this.stage.remove(obj);this.objects.clear();};
  }
}
