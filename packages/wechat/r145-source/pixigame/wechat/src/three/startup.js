import { createStartupScene } from '../../../../../../../pixigame/src/three/game-screen/startup-scene.js';

export function showWechatStartup(platform,{bounds,retry,copyReport,onRelease}) {
  const {renderer,display}=platform;
  let active=true,mode='loading',message='正在加载…',progress=0;
  let id=null,controls=[],pressed=null,onEnter=null,resolveReady=null,copyLabel='复制诊断',automaticEntry=false;
  const scene=createStartupScene(renderer,schedule,{
    waitForBackdrop:true,backdrop:'entry-screens-v4/startup-wechat.jpg'
  });

  function schedule() {
    if(active&&platform.visible&&id===null)id=platform.requestFrame(paint);
  }
  function paint() {
    id=null;
    if(!active||!platform.visible)return;
    if(mode==='ready'&&automaticEntry){choose('start');return;}
    const box=bounds(),dpr=platform.viewport.density;
    if(!box.width||!box.height)return;
    const bw=Math.max(1,Math.round(box.width*dpr)),bh=Math.max(1,Math.round(box.height*dpr));
    display.begin(box,bw,bh,schedule,true);
    controls=scene.paint(box,{dpr,bw,bh,mode,message,progress,pressId:pressed?.button,keyboard:false,copyLabel,
      safeBottom:Math.max(0,platform.viewport.safeBottom-(platform.viewport.screen.bottom-box.bottom))});
  }
  function hit(x,y) {
    const box=bounds();
    x-=box.left;y-=box.top;
    return controls.find(r=>x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h)?.id;
  }
  function choose(button) {
    if(button==='start'&&mode==='ready'){
      const run=onEnter;
      onEnter=null;
      close();
      run?.();
    }else if(button==='retry'&&mode==='failed')retry();
    else if(button==='copy'&&mode==='failed')Promise.resolve().then(copyReport).then(()=>{
      if(active){copyLabel='已复制';schedule();}
    },()=>{
      if(active){copyLabel='复制失败';schedule();}
    });
  }
  const stopTouch=platform.bindTouches(({phase,x,y,pointerId})=>{
    if(phase==='start'&&!pressed){
      const button=hit(x,y);
      if(button)pressed={button,pointerId};
    }else if((phase==='end'||phase==='cancel')&&pressed?.pointerId===pointerId){
      const button=pressed.button;pressed=null;
      if(phase==='end'&&hit(x,y)===button)choose(button);
    }
    schedule();
  },40);
  const stopResize=platform.onViewport((_window, visible)=>{
    if(visible)schedule();
    else if(id!==null){platform.cancelFrame(id);id=null;}
  });

  function close() {
    if(!active)return;
    active=false;
    if(id!==null)platform.cancelFrame(id);
    id=null;stopTouch();stopResize();scene.close();
    onRelease();
    resolveReady?.();resolveReady=null;
  }
  return {
    stage(value,status){
      if(mode==='failed')return;
      progress=Math.min(3,Math.max(progress,value));
      message=status;schedule();
    },
    ready(callback,{automatic=false}={}){
      if(!active||mode==='failed')return Promise.resolve();
      automaticEntry=automatic;
      mode='ready';progress=3;message='准备就绪';onEnter=callback;schedule();
      return new Promise(resolve=>{resolveReady=resolve;});
    },
    fail(error){
      mode='failed';message=error?.message||'加载失败，请重新进入游戏';
      onEnter=null;schedule();
    },
    close,
  };
}

