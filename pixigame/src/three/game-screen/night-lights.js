import {Vector3} from 'three';
import {sampleLavaFlow,sampleLavaBubble} from '../../replica/lava-motion.js';
import {sampleNightCombatLights} from '../../replica/night-atmosphere.js';
import {BattleGeometry} from './three-battle-geometry.js';

const flowCode=`
  if(flowMode>0.){
    vec2 direction=flowMode>3.5?vec2(.14,7.1):flowMode<1.5?vec2(.35,6.2):flowMode<2.5?vec2(2.1,2.7):vec2(3.8,4.6);
    float warp=sin(coords.x*11.7+phases.y*6.2831853)*.23+cos(coords.y*9.3-phases.z*6.2831853)*.18;
    if(flowMode>1.5&&flowMode<2.5)warp*=2.;
    float phase=dot(coords,direction)+warp-phases.x+flowSeed;
    float current=pow(max(0.,sin(phase*6.2831853)),7.);
    color.rgb*=.87+.34*current+.055*sin((coords.x*4.3-coords.y*2.1+phases.y)*6.2831853);
  }`;
function flowMaterial(mesh){
  const material=mesh.material,u=material.uniforms;
  u.flowMode={value:0};u.flowSeed={value:0};u.phases={value:new Vector3()};
  material.fragmentShader=material.fragmentShader.replace('uniform sampler2D art;', 'uniform float flowMode,flowSeed;uniform vec3 phases;uniform sampler2D art;')
    .replace(/}\s*$/,flowCode+'\n}');
}
function drawBubble(batch,light,asset,b){
  const sx=light.coreWidth/asset.width,sy=light.coreHeight/asset.height,angle=light.angle||0,co=Math.cos(angle),si=Math.sin(angle);
  const x=b.site.x-asset.width/2,y=b.site.y-asset.height/2,r=b.radius,a=b.alpha;
  const world=(dx,dy)=>[light.x+(x+dx)*sx*co-(y+dy)*sy*si,light.y+(x+dx)*sx*si+(y+dy)*sy*co];
  const ellipse=(dx,dy,w,h,color,alpha)=>batch.ellipse(...world(dx,dy),w*sx/2,h*sy/2,color,alpha,angle);
  if(b.stage==='grow'){
    ellipse(0,0,r*2.25,r*1.52,0x742b12,a*.90);ellipse(0,-r*.14,r*1.93,r*1.29,0xec721c,a*.94);
    ellipse(-r*.25,-r*.37,r*.78,r*.31,0xffbf54,a*.72);return;
  }
  let prev=world(b.ringRadius,0);
  for(let i=1;i<=28;i++){const t=i*Math.PI/14,point=world(Math.cos(t)*b.ringRadius,Math.sin(t)*b.ringRadius*.68);batch.line(...prev,...point,.8*(sx+sy)/2,0xf9942a,a*.84);prev=point;}
  if(b.progress>=.78)return;
  const p=b.progress/.78,travel=b.burstRadius*.68*p,jump=Math.sin(p*Math.PI)*b.burstRadius*.32;
  for(let i=0;i<3;i++){const t=b.rotation+i*2.0944;ellipse(Math.cos(t)*travel,Math.sin(t)*travel*.58-jump,(1-p)*1.75,(1-p)*2.15,i===0?0xffc365:0xf58525,a*.90);}
}
export function createNightLights(stage,art){
  const bubbles=new BattleGeometry(stage.scene,18.2),pool=[];let points=[];
  function update(landmarks,state,frame){
    if(landmarks!==undefined)points=landmarks;
    if(!state)return;
    const night=state.profile.id==='night',emission=state.profile.id==='day'?.34:state.profile.id==='rain'?.76:1;
    const picks=(night?points:points.filter(p=>p.shape==='lava-surface')).slice(0,24);
    if(night)picks.push(...sampleNightCombatLights(frame.lightingEffects,frame.projectPoint,state.reducedMotion));
    bubbles.clear();
    while(pool.length<picks.length){const core=art.sprite(18,true),halo=art.sprite(18,true);
      halo.renderOrder=18+pool.length*.0001;core.renderOrder=halo.renderOrder+.00001;flowMaterial(core);pool.push({halo,core});}
    for(let i=0;i<pool.length;i++){
      const {halo,core}=pool[i],p=picks[i];halo.visible=core.visible=false;core.material.uniforms.flowMode.value=0;
      if(!p)continue;
      if(p.shape==='lava-surface'||p.shape==='building-windows'){
        const lava=p.shape==='lava-surface',key=lava?p.emissionAsset:p.windowAsset,color=lava?0xffffff:p.color;
        art.place(halo,key+'-halo',p.x,p.y,p.coreWidth,p.coreHeight,color,p.strength*(lava?emission*.70:.72),p.angle);
        art.place(core,key+'-core',p.x,p.y,p.coreWidth,p.coreHeight,color,p.strength*(lava?emission*.88:.8),p.angle);
        if(lava&&art.lava[key]){
          const asset=art.lava[key],flow=sampleLavaFlow(key,p.id,p.time||0,state.reducedMotion);
          if(flow){const u=core.material.uniforms;u.flowMode.value=flow.mode;u.flowSeed.value=flow.seed;u.phases.value.fromArray(flow.phases);}
          const bubble=sampleLavaBubble(p.time||0,p.id,asset.sites,state.reducedMotion);if(bubble)drawBubble(bubbles,p,asset,bubble);
        }
      }else if(p.shape==='streetlamp'){
        art.place(halo,'street',p.poolX??p.x,p.poolY??p.y,p.poolWidth??88,p.poolHeight??62,p.color,Math.min(.82,p.strength*.80),p.poolAngle);
        art.place(core,'halo',p.x,p.y,11,9,0xffedc7,.98);
      }else{
        const spread=p.size>45?1.65:2.6;
        art.place(halo,'halo',p.x,p.y,p.size*spread,p.size*spread*.82,p.color,Math.min(.72,p.strength*.72));
        if(p.shape==='window')art.place(core,'window',p.x,p.y,Math.max(1.2,p.coreWidth),Math.max(1.2,p.coreHeight),0xffce78,Math.min(.95,p.strength*.9));
        else art.place(core,'halo',p.x,p.y,p.size*.62,p.size*.48,0xfff0d4,Math.min(1,p.strength*1.15));
      }
    }
    bubbles.flush();
  }
  return {update,dispose(){stage.remove(bubbles);points=[];pool.length=0;}};
}
