import {LinearFilter,OrthographicCamera,Scene,SRGBColorSpace} from 'three';
import {artworkTexture} from './image-loading.js';
import {createThreeSurface} from '../../ui/three-surface.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';
import {walletGains} from '../../ui/reward-feedback-policy.js';
import {POWER_NOTICE_DURATION,powerNoticeCount,powerNoticePose} from '../../ui/power-notice-motion.js';
import {clamp,words} from './menu-art.js';
import {bottomNavigation,homeInsets,navTabs} from './home-navigation.js';
import art from './utility-art.json';

const compact=new Intl.NumberFormat('zh-CN',{notation:'compact',maximumFractionDigits:1,useGrouping:false});
const number=v=>Math.abs(v)>=1e6?compact.format(v):String(Math.round(v));
export function createLobbyFeedback(screen,{now=()=>performance.now(),requestFrame=callback=>requestAnimationFrame(callback),
  cancelFrame=id=>cancelAnimationFrame(id),reducedMotion,layout}={}){
  const scene=new Scene(),camera=new OrthographicCamera(0,1,0,1,-10,10);
  const ink=createThreeSurface(),marks=createThreeSurface();
  const quiet=reducedMotion?{get matches(){return reducedMotion();}}:matchMedia('(prefers-reduced-motion:reduce)');
  scene.add(ink.group,marks.group);
  let frame=null,skin=null,ready=false,power=null,signature='',count=null,zoom=null,closed=false;
  let effects=[],pendingTab=null;
  function request(){if(!closed)screen.repaintHome?.();}
  function root(){return (screen.homeView||screen.menuView)?.page?.closest?.('#gui-casual-lobby');}
  function key(){const page=layout?layout():root()?.dataset;return page?[page.tab,page.subpage,screen.panel?.name].join('|'):'';}
  const bounds=()=>layout?layout()?.bounds:root()?.getBoundingClientRect();
  function rectFor(id){
    const b=bounds();if(!b)return;
    const owner=screen.panel?.state().controls.find(x=>x.id===id)||screen.menuView?.state().controls.find(x=>x.id===id);
    // Enclose both the icon and the caption using the painted rail height.
    const navHeight=id.startsWith('nav-')?(owner||layout
      ?bottomNavigation(b.width,b.height).height:homeInsets(b).height*b.height/1624):null;
    if(owner)return {x:owner.x-b.x,y:owner.y-b.y,w:owner.w,h:navHeight??owner.h};
    const entry=screen.homeView?.controls().find(x=>x.id===id)?.box;
    if(entry)return {x:entry[0]*b.width/750,y:entry[1]*b.height/1624,w:entry[2]*b.width/750,h:navHeight??entry[3]*b.height/1624};
  }
  function mark(box,color,duration,delay=0,tab=false,page){if(!box||!box.w||!box.h)return;effects.push({box,color,duration,t:now()+delay,tab,page});effects=effects.slice(-28);request();}
  function beginTabFeedback(){
    if(!pendingTab)return;
    if(pendingTab.page!==key()){pendingTab=null;return;}
    const box=rectFor(pendingTab.id);if(!box)return;
    mark(box,'#ffe18a',450,pendingTab.delay,pendingTab.id);
    pendingTab=null;
  }
  function endPower(){power=null;ink.clear();signature='';count=zoom=null;}
  function clear(){if(frame!==null)cancelFrame(frame);frame=null;endPower();effects=[];pendingTab=null;marks.clear();request();}
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
  return {
    wallet(before,after){const gains=walletGains(before,after);if(!screen.panel&&!quiet.matches)for(const {type} of gains)mark(rectFor(type),'#e1f4ff',300);return gains.length>0;},
    equip(slot){mark(rectFor('slot-'+slot)||rectFor(slot),'#8bf4db',650);},
    gearSlot(part){
      if(quiet.matches||screen.panel)return;
      const r=screen.menuView?.anchorRect?.('gear-slot-'+part),b=bounds();if(!r||!b)return;
      effects=effects.filter(e=>e.page===undefined);
      mark({...r,x:r.x-b.x,y:r.y-b.y},'#8bf4db',380,0,false,key());
    },
    pulse(id,delay=0){
      if(quiet.matches)return;
      if(!id.startsWith('nav-')){mark(rectFor(id),'#ffe18a',450,delay);return;}
      // An offscreen or warming page may not have its footer controls yet.
      effects=effects.filter(effect=>!effect.tab);
      pendingTab={id,delay,page:key()};request();
    },
    power(before,after){if(!Number.isFinite(before)||!Number.isFinite(after)||before===after)return;
      if(frame!==null)cancelFrame(frame);frame=requestFrame(()=>{frame=null;show(before,after);});},
    get active(){return !!power||!!pendingTab||effects.length>0;},
    draw(renderer,w,h){beginTabFeedback();if(!power&&!effects.length)return;const t=now();drawPower(w,h,t);
      let used=0;
      effects=effects.filter(e=>t-e.t<e.duration&&(e.page===undefined||e.page===key()));for(const e of effects){const p=(t-e.t)/e.duration;if(p<0)continue;
        const a=Math.max(0,Math.min(e.tab?1:p/.2,(1-p)/.8)),b=e.box;
        const edges=screen.lobbyNavigation?.pose.edges,i=e.tab?navTabs.indexOf(e.tab.slice(4)):-1;
        if(edges&&i>=0){b.x=edges[i]*w/750;b.w=(edges[i+1]-edges[i])*w/750;}
        for(const [x,y,ww,hh] of [[b.x,b.y,b.w,2],[b.x,b.y+b.h-2,b.w,2],[b.x,b.y,2,b.h],[b.x+b.w-2,b.y,2,b.h]]){
          const mesh=marks.group.children[used++]??marks.quad(0,0,1,1);
          mesh.visible=true;mesh.position.set(x+ww/2,y+hh/2,0);mesh.scale.set(ww,-hh,1);
          mesh.material.color.set(e.color);mesh.material.opacity=a*.9;
        }
      }
      for(let i=used;i<marks.group.children.length;i++)marks.group.children[i].visible=false;
      camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();const auto=renderer.autoClear;renderer.autoClear=false;
      try{renderer.render(scene,camera);}finally{renderer.autoClear=auto;}if(power||effects.length)request();},
    clear,close(){closed=true;clear();skin?.dispose();}};
}
