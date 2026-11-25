import * as T from 'three';
import {BattleGeometry} from './three-battle-geometry.js';
import {enemyBarHitPulse,ENEMY_BAR_HIT_SECONDS} from '../../../replica-battle/kernel/enemy-health-hit-motion.ts';

const clamp=n=>Math.min(1,Math.max(0,n));
function sliced(mesh,binding,frame){
  const mat=mesh.material,u=mat.uniforms;
  u.sourceSize={value:new T.Vector2(binding.width,binding.height)};
  u.cut={value:new T.Vector4(frame.x,frame.w,frame.z,frame.y)};
  u.logical={value:new T.Vector2()};
  mat.fragmentShader=mat.fragmentShader.replace('uniform sampler2D art;',`
  uniform sampler2D art;
  uniform vec2 sourceSize,logical;
  uniform vec4 cut;
  float sliceCoord(float uv,float source,float target,float low,float high){
    float dest=max(target,low+high),p=uv*dest;
    if(p<low)return p/source;
    if(p>=dest-high)return (source-(dest-p))/source;
    return (low+(p-low)*(source-low-high)/max(.00001,dest-low-high))/source;
  }
  `).replace('texture(art,coords)','texture(art,vec2(sliceCoord(coords.x,sourceSize.x,logical.x,cut.x,cut.z),sliceCoord(coords.y,sourceSize.y,logical.y,cut.y,cut.w)))');
}
function makeBar(host,source,entity){
  const root=new T.Group(),layers=[];
  for(const row of source.bars[entity.bar].layers){
    if(!row.active||row.role==='nextHp')continue;
    const record=source.sprites[row.sprite],b=host.art.get(row.sprite);if(!b)continue;
    const mesh=host.stage.makeSprite(b,50+layers.length*.00001,root);
    mesh.material.uniforms.pivot.value.set(0,0);host.stage.tint(mesh,row.role==='hp'?0xff2323:0xffffff);
    if(row.imageType===1)sliced(mesh,b,record.border);layers.push({row,mesh});
  }
  root.userData.health={source,entity,layers,target:1,from:1,reduce:1,at:0,hit:-Infinity};
  host.stage.scene.add(root);return root;
}
function updateBar(root,enemy,time){
  const d=root.userData.health,h=d.source.behavior,q=540/d.source.uiReferenceWidth;
  const hp=d.from+(d.target-d.from)*clamp((time-d.at)/h.hpTweenSeconds),reduce=d.reduce+(d.target-d.reduce)*clamp((time-d.at)/h.reduceTweenSeconds);
  const target=clamp(enemy.hp/enemy.maxHp);
  if(target<d.target&&!enemy.dead&&time-d.hit>=ENEMY_BAR_HIT_SECONDS)d.hit=time;
  if(enemy.dead||time<d.hit)d.hit=-Infinity;
  const pulse=enemyBarHitPulse(time-d.hit);root.scale.set(1+pulse*.1,1-pulse*.16,1);
  if(target!==d.target){d.from=hp;d.reduce=reduce;d.target=target;d.at=time;d.shown??=time;}
  if(enemy.dead)d.died??=time+h.reduceTweenSeconds;
  const alpha=(d.entity.initiallyVisible?1:d.shown===undefined?0:clamp((time-d.shown)/h.showFadeSeconds))*(d.died===undefined?1:1-clamp((time-d.died)/h.deathFadeSeconds));
  root.visible=alpha>0;d.enemy=enemy;
  for(const {mesh,row} of d.layers){
    const fill=row.role==='hp'?hp:row.role==='reduce'?reduce:1,w=row.displayWidth*q,height=row.displayHeight*q;
    const u=mesh.material.uniforms;mesh.visible=fill>0;u.opacity.value=alpha*row.color[3];
    u.logical?.value.set(row.width*fill,row.height);u.size.value.set(Math.max(.0001,w*fill),height);
    mesh.position.set(row.x*q-w*row.pivot[0],-row.y*q-height*(1-row.pivot[1]),0);
  }
}
export function healthAt(host,e,world,time){
  const h=host.content.assets.enemyHealthBars,entity=h.entities[e.entityId];
  if(e.boss||!entity?.showHp||!entity.showHpType)return;
  const key='health:'+e.uid;
  let bar=host.objects.get(key);
  // Normal enemies first reveal the bar on damage. Keep a previously shown bar
  // across healing and death so its existing tween and fade still run.
  if(!bar&&!entity.initiallyVisible&&e.hp>=e.maxHp)return;
  host.active.add(key);
  if(!bar){bar=makeBar(host,h,entity);host.objects.set(key,bar);}
  const model=h.models[e.modelId],c=model.center,angle=world.angle??e.angle,cos=Math.cos(angle),sin=Math.sin(angle);
  const p=host.project(world.x+(c[0]*cos+c[2]*sin)*e.scale,world.z+(-c[0]*sin+c[2]*cos+model.healthDistance)*e.scale);
  bar.position.set(p.x,p.y,0);updateBar(bar,e,time);
}
export function keepDyingBar(node,time){
  const d=node.userData.health;
  if(!d||d.died===undefined||time>=d.died+d.source.behavior.deathFadeSeconds)return false;
  updateBar(node,d.enemy,time);return true;
}
export function urgency(host,e,position){
  const warning=host.source.urgency(e);if(!warning)return;
  for(const row of host.source.urgencyNodes){
    const b=host.art.get(row.sprite);if(!row.active||!b)continue;
    const key='urgency:'+e.uid+':'+row.id;host.active.add(key);
    let node=host.objects.get(key);
    if(!node){node=host.stage.makeSprite(b,55);host.objects.set(key,node);}
    const u=node.material.uniforms;
    node.position.set(position.x+row.position.x*.5,position.y-row.position.y*.5,0);
    u.pivot.value.set(row.pivot.x,1-row.pivot.y);u.size.value.set(row.size.x*row.scale.x*.5,row.size.y*row.scale.y*.5);
    u.opacity.value=warning.alpha*(row.color?.a??1);
  }
}
export function damageBorder(host,age){
  let v=host.damageBorder;
  if(!(age>=0&&age<.2)){if(v)v.visible=false;return;}
  if(!v){v=new BattleGeometry(host.stage.scene,49.95);host.damageBorder=v;}
  const {left,top,width:w,height:h}=host.stage.viewport;
  v.position.set(left,top,0);
  v.clear();const t=clamp((age-.02)/.18),a=.32*(1-t*t*(3-2*t)),c=0xff2838,s=w*.18,b=h*.14;
  v.quad(0,0,s,0,s,h,0,h,c,a,0,0,a);v.quad(w-s,0,w,0,w,h,w-s,h,c,0,a,a,0);
  v.quad(0,0,w,0,w,b,0,b,c,a,a,0,0);v.quad(0,h-b,w,h-b,w,h,0,h,c,0,0,a,a);v.flush();
}
