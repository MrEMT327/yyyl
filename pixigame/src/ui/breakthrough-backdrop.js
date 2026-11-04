import profile from './breakthrough-native-particles.json';
import {sampleOriginalEffect} from '../../replica-battle/kernel/original-effects.ts';
import {samplePresentedShow,upgradeEffectOpacity} from './upgrade-transition-motion.js';
import {drawNativeGeometrySprite} from './breakthrough-effect-sprites.js';
const plans=new Map();
function plan(tier){
  tier=profile.tiers[tier]?tier:'y';if(plans.has(tier))return plans.get(tier);
  const groups=profile.tiers[tier],surfaces=[];
  for(const side of ['rear','front'])for(const group of groups[side]){
    const effect=profile.data.effects[group.effectId],rank=new Map(effect.particleOrder.map((id,i)=>[String(id),i]));
    const ordered=effect.layers.filter(l=>l.materials.length).sort((a,b)=>rank.get(String(a.id))-rank.get(String(b.id)));
    let run=null;
    for(const layer of ordered){const blend=layer.materials[0].blend;
      if(!run||run.blend!==blend){run={key:`${group.effectId}-${surfaces.length}`,side,blend,group,layerIds:[]};surfaces.push(run);}run.layerIds.push(String(layer.id));
    }
  }
  plans.set(tier,surfaces);return surfaces;
}
export function breakthroughBackdropPose(seconds){
  const t=Number.isFinite(seconds)?Math.fround(seconds):-1,end=profile.tiers.y.hostEndTime;
  return {visible:t>=0&&t<end,seconds:t,frontActive:t>=profile.tiers.y.front[0].enableTime&&t<end,rearActive:t>=profile.tiers.y.rear[0].enableTime&&t<end};
}
export function sampleBreakthroughFrame(seconds,tier='y',reducedMotion=false,shaderTime=seconds){
  const pose=breakthroughBackdropPose(seconds),surfaces=plan(tier).map(p=>({...p,draws:[]})),sampled=new Map();
  let flashAlpha=0,particleCount=0;
  if(pose.visible)for(const surface of surfaces){
    const {group}=surface;if(pose.seconds<group.enableTime||pose.seconds>=group.hostEndTime)continue;
    if(!sampled.has(group.effectId)){
      const effect=profile.data.effects[group.effectId],layers=new Map(effect.layers.map(l=>[String(l.id),l]));
      const order=new Map(effect.particleOrder.map((id,i)=>[String(id),i]));
      const draws=sampleOriginalEffect(profile.data,group.effectId,Math.max(0,pose.seconds-group.enableTime),71,{projection:'xy'})
        .map(sprite=>({sprite,layer:layers.get(sprite.layerId.replace(/^mesh:/,''))}))
        .filter(d=>d.layer).sort((a,b)=>order.get(String(a.layer.id))-order.get(String(b.layer.id)));
      sampled.set(group.effectId,draws);
    }
    for(const draw of sampled.get(group.effectId))if(surface.layerIds.includes(String(draw.layer.id))){
      const kind=profile.data.textures[draw.sprite.key]?.kind;
      if(reducedMotion&&(surface.side==='front'||kind!=='softGlow'))continue;
      const opacity=upgradeEffectOpacity(pose.seconds)*(reducedMotion?.12:1);
      const sprite=opacity<1?{...draw.sprite,alpha:draw.sprite.alpha*opacity}:draw.sprite;
      surface.draws.push({sprite,material:draw.layer.materials[0]});particleCount++;
      if(kind==='whiteWash')flashAlpha=Math.max(flashAlpha,sprite.alpha);
    }
  }
  return {...pose,tier,surfaces,flashAlpha,particleCount,shaderTime,offset:samplePresentedShow(Math.max(0,pose.seconds),tier)};
}
export function drawBreakthroughSurface(ctx,{width,height,ratio=1,cardWidth=179.2},surface,frame){
  ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);
  if(!frame.visible||!surface.draws.length||width<=0||height<=0)return;
  const unit=Math.min(width/600,height/1300)*(cardWidth/328)*1.2;
  ctx.save();ctx.translate(width/2+frame.offset.x*unit,height/2-frame.offset.y*unit);ctx.scale(unit,unit);
  ctx.globalCompositeOperation=surface.blend==='add'?'lighter':'source-over';
  for(const draw of surface.draws)drawNativeGeometrySprite(ctx,draw,profile.data.textures,frame.shaderTime);
  ctx.restore();
}
