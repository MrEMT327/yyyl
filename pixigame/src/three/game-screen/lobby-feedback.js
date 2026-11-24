import {LinearFilter,OrthographicCamera,Scene,SRGBColorSpace} from 'three';
import {artworkTexture} from './image-loading.js';
import {createThreeSurface} from '../../ui/three-surface.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';
import {walletGains} from '../../ui/reward-feedback-policy.js';
import {POWER_NOTICE_DURATION,powerNoticeCount,powerNoticePose} from '../../ui/power-notice-motion.js';
import {clamp,words} from './menu-art.js';
import art from './utility-art.json';

const compact=new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1,useGrouping:false});
const number=v=>Math.abs(v)>=1e6?compact.format(v):String(Math.round(v));
export function createLobbyFeedback(screen,{now=()=>performance.now(),requestFrame=callback=>requestAnimationFrame(callback),
  cancelFrame=id=>cancelAnimationFrame(id),reducedMotion,layout}={}){
  const scene=new Scene(),camera=new OrthographicCamera(0,1,0,1,-10,10);
  const ink=createThreeSurface(),marks=createThreeSurface();
  const quiet=reducedMotion?{get matches(){return reducedMotion();}}:matchMedia('(prefers-reduced-motion:reduce)');
  scene.add(ink.group,marks.group);
  let frame=null,skin=null,ready=false,power=null,signature='',count=null,zoom=null,touch=null,closed=false;
  let effects=[];
  function request(){if(!closed)screen.repaintHome?.();}
  function root(){return (screen.homeView||screen.menuView)?.page?.closest?.('#gui-casual-lobby');}
  function key(){const page=layout?layout():root()?.dataset;return page?[page.tab,page.subpage,screen.panel?.name].join('|'):'';}
  const bounds=()=>layout?layout()?.bounds:root()?.getBoundingClientRect();
  function rectFor(id){
    const b=bounds();if(!b)return;
    const owner=screen.panel?.state().controls.find(x=>x.id===id)||screen.menuView?.state().controls.find(x=>x.id===id);
    if(owner)return {x:owner.x-b.x,y:owner.y-b.y,w:owner.w,h:owner.h};
    const entry=screen.homeView?.controls().find(x=>x.id===id)?.box;if(entry)return {x:entry[0]*b.width/750,y:entry[1]*b.height/1624,w:entry[2]*b.width/750,h:entry[3]*b.height/1624};
  }
  function mark(box,color,duration,delay=0){if(!box||!box.w||!box.h)return;effects.push({box,color,duration,t:now()+delay});effects=effects.slice(-28);request();}
  function endPower(){power=null;ink.clear();signature='';count=zoom=null;}
  function clear(){if(frame!==null)cancelFrame(frame);frame=null;endPower();effects=[];marks.clear();touch=null;request();}
  function show(before,after){
    if(!Number.isFinite(before)||!Number.isFinite(after)||!bounds()||(layout?layout()?.hidden:root()?.hidden))return;
    before=Math.round(before);after=Math.round(after);if(before===after)return;
    const k=key(),t=now(),base=power?.k===k&&t-power.t<=800&&power.after===before?power.base:before;
    if(base===after){endPower();return;}power={k,t,base,after};signature='';
    if(!skin){skin=artworkTexture(art.toast,()=>{if(closed)return;ready=true;signature='';request();},()=>{});skin.colorSpace=SRGBColorSpace;skin.minFilter=LinearFilter;}
    request();
  }
  function drawPower(w,h,t){
    if(!power)return;
    const elapsed=t-power.t;if(power.k!==key()||elapsed>=(quiet.matches?1800:POWER_NOTICE_DURATION)){endPower();return;}
    const {after,base}=power,value=number(quiet.matches?after:powerNoticeCount(base,after,elapsed)),delta=after-base,stamp=w+'|'+value+'|'+delta;
    if(stamp!==signature){
      signature=stamp;ink.clear();const u=w/1080,gap=54*u;
      const opts={family:'Arial,Helvetica,"Microsoft YaHei",sans-serif',shadow:{color:'#07121f',y:1,blur:2}};
      const label=words(ink,'战力',0,0,clamp(42*u,14,19),{family:'PsdPopup,"Microsoft YaHei",sans-serif',color:'#d4e7f0',weight:400});
      count=words(ink,value,0,0,clamp(84*u,26,36),{...opts,weight:'italic 800'});
      const change=words(ink,(delta>0?'+':'−')+number(Math.abs(delta)),0,0,clamp(50*u,17,23),{...opts,weight:'italic 700',color:delta>0?'#72f28d':'#ff8a78'});
      const ww=Math.max(650*u,label.scale.x+count.scale.x+change.scale.x+2*gap+90*u),hh=Math.max(44,100*u);
      let x=-(label.scale.x+count.scale.x+change.scale.x+2*gap)/2;
      for(const mesh of [label,count,change]){mesh.position.x=x+mesh.scale.x/2;x+=mesh.scale.x+gap;}
      zoom=count.scale.clone();
      if(ready){const back=ink.image(skin,-ww/2,-hh/2,ww,hh);back.geometry.dispose();back.geometry=slicedFrameGeometry(ww,hh,2145,200,[48,130,48,130],[8,22,8,22]);back.renderOrder=-1;}
    }
    const pose=quiet.matches?{rise:0,scale:1,pulse:1}:powerNoticePose(elapsed/1000);
    ink.group.scale.set(pose.scale,pose.scale,1);ink.group.position.set(w/2,h/2-(200+pose.rise)*w/1080,0);count.scale.copy(zoom).multiplyScalar(pose.pulse);
  }
  return {capture(b){const r=bounds();if(r&&b)touch={x:b.x-r.x,y:b.y-r.y,w:b.w??b.width,h:b.h??b.height};},
    wallet(before,after){const gains=walletGains(before,after);if(!screen.panel&&!quiet.matches)for(const {type} of gains)mark(rectFor(type),'#e1f4ff',300);return gains.length>0;},
    failure(){mark(touch,'#ff967f',500);},
    equip(slot){mark(rectFor('slot-'+slot)||rectFor(slot),'#8bf4db',650);},
    pulse(id,delay=0){if(!quiet.matches)mark(rectFor(id),'#ffe18a',450,delay);},
    power(before,after){if(!Number.isFinite(before)||!Number.isFinite(after)||before===after)return;
      if(frame!==null)cancelFrame(frame);frame=requestFrame(()=>{frame=null;show(before,after);});},
    get active(){return !!power||effects.length>0;},
    draw(renderer,w,h){if(!power&&!effects.length)return;const t=now();drawPower(w,h,t);marks.clear();
      effects=effects.filter(e=>t-e.t<e.duration);for(const e of effects){const p=(t-e.t)/e.duration;if(p<0)continue;
        const a=Math.max(0,Math.min(p/.2,(1-p)/.8)),b=e.box;for(const [x,y,ww,hh] of [[b.x,b.y,b.w,2],[b.x,b.y+b.h-2,b.w,2],[b.x,b.y,2,b.h],[b.x+b.w-2,b.y,2,b.h]])marks.quad(x,y,ww,hh,e.color,a*.9);}
      camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();const auto=renderer.autoClear;renderer.autoClear=false;
      try{renderer.render(scene,camera);}finally{renderer.autoClear=auto;}if(power||effects.length)request();},
    clear,close(){closed=true;clear();skin?.dispose();}};
}
