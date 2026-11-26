import {CustomBlending,OneFactor,OneMinusSrcAlphaFactor,OneMinusSrcColorFactor} from 'three';
import {createLobbyPanel} from './lobby-panel.js';
import {area,box,pic,titleFont,words} from './menu-art.js';
import {animateMeshes} from './ui-motion.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';

const stageLight='/art/process-feedback-v1/hologram-reveal.png';
const qualityLight=['#e8f2ff','#94efad','#80d5ff','#de9cff','#ffce70','#ff827b'];
function opening(data,w,h,t){
  const a=t.layer('box-opening').art,adv=data.pool==='advanced',caption=adv?'高级装备箱':'普通装备箱';
  const motion={entered:data.start(),reduced:data.reduced};
  t.backdrop(a,.7);
  pic(a,t,'/art/psd-page-chrome-v1/chapter-face.png',box(w*.22,h*.13,w*.56,h*.08));
  words(a,caption,w*.5,h*.17,w*.06,{family:titleFont,color:'#fff2cf'});
  const skipWidth=Math.max(44,.149*w),skip=box(w*.94-skipWidth,h*.05,skipWidth,44);
  words(a,'跳过',skip.x+skip.w*.38,skip.y+22,w*.038,{color:'#e8f5fc'});
  pic(a,t,projectIconUrl('chevron-right'),box(skip.x+skip.w*.70,skip.y+22-w*.02,w*.04,w*.04),true);
  area(t,'skip','跳过开箱动画',skip,'processSkipBox');
  const stage=pic(a,t,stageLight,box(w*.03,h*.15,w*.94,h*.62),true);stage.material.opacity=.6;
  // The original light entrance fades to full opacity, then holds until the receipt opens.
  if(!data.reduced){stage.material.opacity=1;animateMeshes(t,[stage],w*.5,h*.46,{...motion,duration:1,frames:[{at:0,opacity:0,scale:.7},{at:1}]});}
  const chestRect=box(w*.12,h*.35,w*.76,h*.36);
  if(!data.reduced){
    const closed=pic(a,t,adv?'/art/project-equipment-boxes-v1/advanced.png':'/art/shop-comic-v1/weapon-crate-v2.webp',chestRect,true);
    animateMeshes(t,[closed],w*.5,h*.53,{...motion,duration:.8,frames:[{at:0,scale:.94},{at:.30,x:-w*.01,rotation:-1},{at:.45,x:w*.01,rotation:1},{at:.60,scale:1.02},{at:1,opacity:0,scale:1.06}]});
  }
  const open=pic(a,t,adv?'/art/project-equipment-boxes-v1/advanced-open.png':'/art/process-feedback-v1/basic-open.png',chestRect,true);
  animateMeshes(t,[open],w*.5,chestRect.y+.83*chestRect.h,{...motion,delay:.65,duration:.65,frames:[{at:0,scaleY:.5,y:w*.02,opacity:0},{at:.45,scaleY:1.03,y:-w*.0103},{at:1}]});
  const side=Math.min(.84*w,.55*h),cy=.415*h;
  const flare=pic(a,t,stageLight,box((w-side)/2,cy-side/2,side,side),true);
  flare.material.color.set(qualityLight[data.gearRank]||qualityLight[0]);
  flare.material.premultipliedAlpha=true;flare.material.blending=CustomBlending;flare.material.blendSrc=OneFactor;flare.material.blendDst=OneMinusSrcColorFactor;
  flare.material.blendSrcAlpha=OneFactor;flare.material.blendDstAlpha=OneMinusSrcAlphaFactor;
  flare.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',
    'vec4 lamp=texture2D(map,vMapUv);diffuseColor.rgb*=max(lamp.r,max(lamp.g,lamp.b));diffuseColor.a*=lamp.a*clamp((vMapUv.y-.30)/.12,0.,1.);');};
  animateMeshes(t,[flare],w*.5,cy,{...motion,delay:.65,duration:.9,frames:[{at:0,opacity:0,scale:.4},{at:.45,scale:1.15},{at:1,opacity:.55}]});
}
export function openBoxOpening(screen,host,send,sound){
  const reduced=(screen.reducedMotion?.() ?? matchMedia('(prefers-reduced-motion: reduce)').matches);
  let id=null,timer,entered,finished=false;
  function finish(){if(finished)return;finished=true;clearTimeout(timer);send('processSkipBox',{},host);}
  function start(){
    if(entered==null&&!finished){
      entered=performance.now()/1000;timer=setTimeout(finish,reduced?100:1900);
      if(!reduced)sound?.('reward');
    }
    return entered;
  }
  const panel=createLobbyPanel(screen,host,'装备开箱',opening,cmd=>{if(cmd.type==='processSkipBox'||cmd.type==='close')finish();},{overlay:true});
  return {host,close(){finished=true;clearTimeout(timer);panel.close();},update(_snapshot,modal){
    if(id===modal.id)return;id=modal.id;clearTimeout(timer);finished=false;entered=null;
    panel.update({pool:modal.pool,gearRank:modal.gearRank,start,reduced},id,'opening-'+id);
  }};
}

