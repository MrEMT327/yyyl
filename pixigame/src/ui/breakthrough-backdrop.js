import profile from './breakthrough-native-particles.json';
import {sampleOriginalEffect} from '../../replica-battle/kernel/original-effects.ts';
import {samplePresentedShow,upgradeEffectOpacity} from './upgrade-transition-motion.js';
import {drawNativeGeometrySprite} from './breakthrough-effect-sprites.js';
import {appendBreakthroughOpening,breakthroughFocus} from './breakthrough-opening.js';
const plans=new Map();
const softEntry=t=>{t=Math.max(0,Math.min(1,t));return t*t*(3-2*t);};

function plan(tier){
  tier=profile.tiers[tier]?tier:'y';
  if(plans.has(tier))return plans.get(tier);
  const groups=[],surfaces=[];
  for(const side of ['rear','front'])for(const group of profile.tiers[tier][side]){
    const effect=profile.data.effects[group.effectId];
    const rank=new Map(effect.particleOrder.map((id,i)=>[String(id),i]));
    const ordered=effect.layers.filter(layer=>layer.materials.length).sort((a,b)=>rank.get(String(a.id))-rank.get(String(b.id)));
    const layers=[];
    let run;
    for(const layer of ordered){
      const material=layer.materials[0],id=String(layer.id);
      if(!run||run.blend!==material.blend){
        run={key:group.effectId+'-'+surfaces.length,side,blend:material.blend,group,layerIds:[]};
        surfaces.push(run);
      }
      run.layerIds.push(id);
      layers.push({id,material,surface:surfaces.length-1});
    }
    groups.push({group,side,layers});
  }
  const layout={groups,surfaces,front:surfaces.findIndex(s=>s.side==='front'&&s.blend==='add')};
  plans.set(tier,layout);
  return layout;
}
export function breakthroughBackdropPose(seconds){
  const t=Number.isFinite(seconds)?Math.fround(seconds):-1,end=profile.tiers.y.hostEndTime;
  return {visible:t>=0&&t<end,seconds:t,frontActive:t>=profile.tiers.y.front[0].enableTime&&t<end,rearActive:t>=profile.tiers.y.rear[0].enableTime&&t<end};
}
export function sampleBreakthroughFrame(seconds,tier='y',reducedMotion=false,shaderTime=seconds){
  const pose=breakthroughBackdropPose(seconds),layout=plan(tier),surfaces=layout.surfaces.map(s=>({...s,draws:[]}));
  const focus=reducedMotion?0:breakthroughFocus(pose.seconds),tail=upgradeEffectOpacity(pose.seconds);
  let flashAlpha=0,particleCount=0;
  if(pose.visible)for(const {group,side,layers} of layout.groups){
    if(pose.seconds<group.enableTime||pose.seconds>=group.hostEndTime||(reducedMotion&&side==='front'))continue;
    const age=pose.seconds-group.enableTime;
    const opacity=tail*(reducedMotion?.12:softEntry(age/(side==='front'?.09:.035)));
    const byLayer=new Map();
    for(const sprite of sampleOriginalEffect(profile.data,group.effectId,age,71,{projection:'xy'})){
      const id=sprite.layerId.replace(/^mesh:/,'');
      if(!byLayer.has(id))byLayer.set(id,[]);
      byLayer.get(id).push(sprite);
    }
    // Preserve the authored order of normal-blended layers without sorting every frame.
    for(const {id,material,surface} of layers){
      const sprites=byLayer.get(id);
      if(!sprites)continue;
      for(const sprite of sprites){
        const kind=profile.data.textures[sprite.key]?.kind;
        if(reducedMotion&&kind!=='softGlow')continue;
        if(side==='front'&&kind==='ray'){
          sprite.width*=1-.46*focus;
          sprite.alpha*=1-.29*focus;
        }
        sprite.alpha*=opacity*(kind==='whiteWash'?.72:1);
        surfaces[surface].draws.push({sprite,material});
        if(kind==='whiteWash')flashAlpha=Math.max(flashAlpha,sprite.alpha);
        particleCount++;
      }
    }
  }
  if(pose.frontActive&&!reducedMotion&&layout.front>=0){
    const draws=surfaces[layout.front].draws,previous=draws.length;
    appendBreakthroughOpening(draws,pose.seconds,tier);
    particleCount+=draws.length-previous;
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
