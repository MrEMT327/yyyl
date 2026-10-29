import { ARSENAL } from '../fixed-parts/airframe-arsenal.js';
import { airframeWeaponStats } from '../fixed-parts/airframe-growth.js';


// A schematic of the actual attack family, using the combat's own rank counts.
export function drawWeaponDiagram(ui, id, level, x, y, w, h) {
  const a=ARSENAL[id];if(!a)return;
  // Common weapons are rendered from Blender assets by common-weapon-thumbnails.
  if(a.common)return;
  const stats=airframeWeaponStats({id,itemId:id},{state:{nodes:{[id]:Array(Math.max(0,Math.min(5,level-1))).fill('preview')}}});
  const n=stats.count+(a.pattern==='cross'||a.pattern==='helix'||a.pattern==='blade'||a.pattern==='orbit'?1:0);
  const color=`#${a.color.toString(16).padStart(6,'0')}`,cx=x+w/2,base=y+h*.9;
  const line=points=>{ui.line(points,color,.12,7*stats.width);ui.line(points,color,.95,1.8*stats.width);};
  const ring=(px,py,r)=>line(Array.from({length:33},(_,i)=>[px+Math.cos(i/32*Math.PI*2)*r,py+Math.sin(i/32*Math.PI*2)*r]));
  if(a.sourceId){
    if(a.beam){for(const dx of [-3,0,3])line([[cx+dx,base],[cx+dx,y+h*.1]]);return;}
    if(a.side){for(const side of [-1,1])for(let j=0;j<3;j++)line([[cx+side*w*j*.11,base-j*h*.06],[cx+side*w*(j+.7)*.11,base-(j+.7)*h*.06]]);return;}
    if(a.tick||a.sourceId==='mine_launcher'){ring(cx,y+h*.56,Math.min(w,h)*(a.tick?.29:.13));line([[cx,base],[cx,y+h*.69]]);return;}
    if(a.crossLaser){const cy=y+h*.42;line([[cx,base],[cx,cy]]);line([[cx-w*.35,cy],[cx+w*.35,cy]]);line([[cx,cy-h*.28],[cx,cy+h*.28]]);return;}
    if(a.whip){line(Array.from({length:25},(_,j)=>[cx+Math.sin(j*.4)*w*.1,base-j/24*h*.8]));return;}
    if(a.harpoon){line([[cx,base],[cx,y+h*.1]]);for(let j=0;j<Math.min(5,stats.pierces+1);j++)ring(cx,base-(j+1)/(stats.pierces+2)*h*.8,4);return;}
    if(a.burst){for(let j=0;j<n;j++){const t=(j+.3)/(n+1);line([[cx,base-t*h*.8],[cx,base-(t+.5/(n+1))*h*.8]]);}return;}
  }
  for(let i=0;i<n;i++){
    const f=n===1?0:i/(n-1)-.5,dx=f*w*.72;
    if(a.pattern==='ring') {ring(cx,y+h*.54,(i+1)/(n+1)*Math.min(w*.43,h*.44));continue;}
    if(a.pattern==='orbit'){const angle=i/n*Math.PI*2,px=cx+Math.cos(angle)*w*.29,py=y+h*.56+Math.sin(angle)*h*.3;ring(px,py,3);line([[px,py],[px,y+h*.08]]);continue;}
    if(a.pattern==='chain'){const px=cx+Math.sin(i*2.3)*w*.3,py=base-(i+1)/(n+1)*h*.84;line([[i?cx+Math.sin((i-1)*2.3)*w*.3:cx,i?base-i/(n+1)*h*.84:base],[(cx+px)/2+8,py+9],[px,py]]);ring(px,py,4);continue;}
    if(a.pattern==='blade'){const px=cx+dx;line(Array.from({length:19},(_,j)=>{const t=j/18*Math.PI;return [px+Math.sign(f)*Math.sin(t)*w*.11,y+h*.15+j/18*h*.69];}));continue;}
    if(a.pattern==='helix'||a.pattern==='swarm'){const phase=Math.min(i,n-1-i)*Math.PI*2/n;line(Array.from({length:25},(_,j)=>{const t=j/24;return [cx+dx*t-Math.sign(f)*(Math.sin(t*Math.PI*(a.pattern==='helix'?3:1)+phase)-Math.sin(phase))*w*.08,base-t*h*.78];}));continue;}
    const parallel=['pulse','slug','cannon'].includes(a.pattern),endX=cx+dx;
    const startX=parallel?endX:a.pattern==='cross'?cx-dx:cx;
    if(['nova','siege','rocket'].includes(a.pattern)){
      line([[startX,base],[endX,y+h*.32]]);ring(endX,y+h*.25,Math.min(12,h*.1)*stats.width);
    }else if(['cannon','scatter'].includes(a.pattern)){
      for(let j=0;j<3;j++){const t=.18+j*.27;line([[startX+(endX-startX)*t,base-t*h*.8],[startX+(endX-startX)*(t+.1),base-(t+.1)*h*.8]]);}
    }else line([[startX,base],[endX,y+h*.1]]);
  }
  ui.polygon([[cx,base-4],[cx-5,base+5],[cx+5,base+5]],'#dbe9ed',.9);
}

export const TRAIT_LABELS={echo:'每3轮 · 追加50%回声',hunt:'全弹追踪',nova:'首击爆破 +35%',tide:'宽度、爆破范围 +30%',phase:'穿透 +2',rapid:'开火间隔 −20%',chain:'首击跳电 40%',prism:'折射 +35%',siege:'每4轮 · 伤害+80% / 范围+50%',star:'伴星补射 25%'};
export const TRAIT_SYMBOLS={common:'grid',echo:'refresh',hunt:'target',nova:'star',tide:'coverage',phase:'arrow',rapid:'cadence',chain:'link',prism:'image',siege:'power',star:'star'};
TRAIT_LABELS.common='自由装配 · 碎片升品 · 金币强化';
