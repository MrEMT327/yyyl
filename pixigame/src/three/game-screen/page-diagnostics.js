import {OrthographicCamera,Scene} from 'three';
import {createThreeSurface} from '../../ui/three-surface.js';
import {BUILD_IDENTITY} from '../../build-info.js';
import {performanceMonitor as monitor} from '../../performance-monitor.js';
import {summarizeRendererMetrics} from '../../renderer-metrics.js';
import {createFrameLoop} from '../../frame-loop.js';
import '../../ui/performance-panel.css';

const names={battle:'战役',assembly:'装备',shop:'商城',research:'天赋',supply:'招募',aircraft:'战机',pilot:'驾驶员',weapon:'武器',workshop:'改装间'};
const family='system-ui,"Microsoft YaHei",sans-serif',mono='ui-monospace,Consolas,monospace';
const ms=v=>Number.isFinite(v)?v.toFixed(1)+' ms':'—';
const count=v=>Number.isFinite(v)?v.toLocaleString('zh-CN',{useGrouping:false,maximumFractionDigits:1}):'—';
const bounded=(list,n)=>{list.push(n);if(list.length>180)list.shift();};
const badgeText='v'+BUILD_IDENTITY.version+' · '+BUILD_IDENTITY.label;
const note='战斗统计同一个 Three.js 渲染器在完整一帧内提交的绘制和三角面，包括地形、角色、特效和界面。帧间隔包含浏览器调度时间。';

function collect(bridge,previous,longTasks,interactions){
  const sample=monitor.snapshot(),state=bridge.pixiLobby?.state,inBattle=Boolean(bridge.app.renderer.battle);
  const route=inBattle?'战斗 / Three.js':state?.visible?[names[state.tab]||state.tab,names[state.subpage]||state.subpage,state.modal?'弹窗':''].filter(Boolean).join(' / '):bridge.game?.state||'加载';
  const frames=sample.frames[inBattle?'combat':'lobby'],live=frames?.active&&frames.count>0;
  const rendering=summarizeRendererMetrics(sample.renderers,previous),cpu=sample.costs,combat={update:cpu.combat,render:cpu.render};
  const report={...sample,identity:BUILD_IDENTITY,route,rendering,longTasks:longTasks.slice(),interactions:interactions.slice(),
    domNodes:document.querySelectorAll('*').length,canvases:document.querySelectorAll('canvas').length,
    resources:performance.getEntriesByType('resource').length,heapBytes:performance.memory?.usedJSHeapSize??null,
    displayed:{source:inBattle?'three-combat':'lobby',frames,costs:combat,rendering}};
  const values={fps:live?String(Math.round(1000/frames.mean)):'—',calls:count(rendering.calls),triangles:count(rendering.triangles),interval:live?ms(frames.mean):'—',
    fpsLabel:inBattle?'渲染 FPS':'界面 FPS',source:inBattle?'战斗 · Three.js 整帧':'大厅 · Three.js',p95:'P95 '+(live?ms(frames.p95):'—')};
  const rows=[['最长帧间隔',live?ms(frames.max):'—'],['UI 更新 CPU',ms(cpu.ui?.mean)],['界面刷新 CPU',ms(cpu['ui-render']?.mean)],
    ['立绘更新 CPU',ms(cpu.portrait?.mean)],['预览准备 CPU',ms(cpu['preview-setup']?.mean)],['预览绘制 CPU',ms(cpu.preview?.mean)],
    ['战斗更新 CPU',ms(combat.update?.mean)],['绘制提交 CPU',ms(combat.render?.mean)],['战斗帧 CPU',ms(cpu.frame?.mean)],
    ['Draw Call / 帧',values.calls],['三角面 / 帧',values.triangles],['Three 几何 / 纹理',count(sample.renderers.reduce((n,r)=>n+(r.geometries||0),0))+' / '+count(sample.renderers.reduce((n,r)=>n+(r.textures||0),0))],
    ['长任务 ≥50 ms',longTasks.length+' · 最长 '+ms(Math.max(0,...longTasks))],['交互耗时 P95',interactions.length?ms(interactions.slice().sort((a,b)=>a-b)[Math.floor(interactions.length*.95)]):'等待交互'],
    ['DOM / Canvas',report.domNodes+' / '+report.canvases],['已完成资源请求',count(report.resources)],['JS 堆（浏览器估算）',report.heapBytes?(report.heapBytes/1048576).toFixed(1)+' MB':'浏览器未提供']];
  return {report,values,rows,history:frames?.samples||[]};
}

export function mountPerformancePanel({bridge}){
  const device=bridge.app.renderer,display=device.display,renderer=device.three;
  const shell=document.getElementById('gameShell'),arcade=shell.closest('.arcade');
  const stage=document.createElement('div'),host=document.createElement('div'),hit=document.createElement('div');
  stage.className='performance-game-stage';host.className='performance-tools';hit.id='performancePanel';
  hit.tabIndex=0;hit.setAttribute('role','group');hit.setAttribute('aria-label','性能面板');
  hit.style.cssText='position:fixed;box-sizing:border-box;outline:none;touch-action:none;user-select:none;cursor:default;background:transparent';
  host.style.width='85px';shell.before(stage);stage.append(shell);arcade.append(host);host.append(hit);arcade.classList.add('has-performance-tools');
  const make=()=>{const art=createThreeSurface(),scene=new Scene();scene.add(art.group);return {art,scene};};
  const badge=make(),plate=make(),content=make(),camera=new OrthographicCamera(0,1,0,1,-2,2);
  const prev=new Map(),events=new AbortController(),options={signal:events.signal};
  let observers=[],longTasks=[],interactions=[],sample=null,open=false,compact=true,scroll=0,contentHeight=0,closed=false;
  let dirty=true,badgeWidth=0,layout=null,controls=[],focused='',keyboard=false,press=null,last=-Infinity;
  const text=(art,value,x,y,size=12,color='#a7c3cf',extra={})=>art.text(value,x,y,{size,color,family,weight:400,...extra});
  const order=art=>art.group.children.forEach((node,i)=>{node.renderOrder=i;});
  function changed(){dirty=true;display.refresh();}
  function sampleNow(){sample=collect(bridge,prev,longTasks,interactions);changed();}
  function button(art,id,label,x,y,w,h){
    controls.push({id,label,x,y,w,h});
    art.panel(x,y,w,h,{fill:'#1c3542',stroke:keyboard&&focused===id?'#d4f6ff':'#7196a5',radius:5,opacity:1});
    text(art,label,x+w/2,y+h/2,id==='close'?18:id==='compact'?11:12,'#deebef',{align:'center'});
  }
  function build(w,h){
    const anchor=host.getBoundingClientRect(),mobile=w<=760,pad=mobile?8:10;
    const pw=open?Math.min(compact?236:330,w-12):78;
    const left=Math.max(0,anchor.right-pw),top=open?anchor.bottom+4:anchor.top;
    const inner=pw-2*pad,art=content.art;art.clear();plate.art.clear();controls=[];
    if(open){
      const {values:v,rows,report,history}=sample;
      let y=pad+1;
      text(art,'性能',pad,y+12,12,'#a7c3cf',{weight:700});
      button(art,'compact',compact?'详情':'收起',pw-pad-73,y,40,24);button(art,'close','×',pw-pad-27,y,27,24);y+=mobile?28:32;
      const summary=[[v.fpsLabel,v.fps],['Draw Call / 帧',v.calls],['三角面 / 帧',v.triangles],['帧间隔',v.interval]];
      summary.forEach(([label,value],i)=>{const x=pad+(i%2)*(inner+8)/2,ry=y+Math.floor(i/2)*(mobile?40:47);
        text(art,label,x,ry+7,10);text(art,value,x,ry+(mobile?24:26),i===3?(mobile?13:16):mobile?16:19,i===0?'#80ebc7':'#edf8fb',{family:mono,weight:600});});
      y+=mobile?80:94;text(art,v.source,pad,y+7);y+=23;
      if(!compact){
        text(art,badgeText,pad,y+6,10);y+=19;text(art,report.route,pad,y+7);y+=24;text(art,v.p95,pad,y+7);y+=24;
        art.quad(pad,y,inner,50,'#152c39');art.line([[pad,y+37.5],[pad+inner,y+37.5]],'#d4b36b');
        if(history.length>1)art.line(history.map((v,i)=>[pad+i*inner/59,y+50-Math.min(66.7,v)*.75]),'#78e8c8');
        y+=56;
        for(const [k,val] of rows){text(art,k,pad,y+11,12,'#b1c8d2');text(art,val,pw-pad,y+11,12,'#edf8fb',{align:'right'});art.quad(pad,y+22,inner,1,'#385563',.4);y+=23;}
        const noteText=text(art,note,pad,y+10,10,'#a7c3cf',{wrap:true,maxWidth:inner,lineHeight:14});
        const lines=noteText.userData.uiTextLines.length;noteText.position.y+=7*(lines-1);y+=lines*14+14;
        button(art,'reset','重置采样',pad,y,(inner-6)/2,29);button(art,'export','导出报告',pad+(inner+6)/2,y,(inner-6)/2,29);y+=31;
      }
      contentHeight=y+pad;
    }else{button(art,'toggle','性能 · F8',0,0,pw,32);contentHeight=32;}
    const height=Math.max(1,Math.min(contentHeight,h-top-6));
    if(open)plate.art.panel(left,top,pw,height,{fill:'#0e1c27',stroke:'#526d7c',radius:7,opacity:1});
    scroll=Math.max(0,Math.min(scroll,contentHeight-height));
    layout={x:left,y:top,w:pw,h:height,width:w,height:h,anchorX:anchor.right,anchorY:anchor.top};
    Object.assign(hit.style,{left:left+'px',top:top+'px',width:pw+'px',height:height+'px'});
    order(art);order(plate.art);dirty=false;
  }
  function draw(w,h,bw,bh){
    if(closed)return;
    if(badgeWidth!==w){badgeWidth=w;badge.art.clear();const label=text(badge.art,badgeText,7,20,9,'#d6e5ec',{family,maxWidth:Math.max(40,w-190)});
      const width=label.scale.x+6;const bg=badge.art.panel(4,4,width,32,{fill:'#102030',stroke:null,radius:2,opacity:.61});bg.renderOrder=-1;}
    const a=host.getBoundingClientRect();
    if(dirty||layout?.width!==w||layout?.height!==h||layout?.anchorX!==a.right||layout?.anchorY!==a.top)build(w,h);
    camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();
    renderer.render(badge.scene,camera);renderer.render(plate.scene,camera);
    const b=layout;content.art.group.position.set(b.x,b.y-scroll,0);
    renderer.setScissor(Math.round(b.x*bw/w),Math.round((h-b.y-b.h)*bh/h),Math.round(b.w*bw/w),Math.round(b.h*bh/h));renderer.setScissorTest(true);
    renderer.render(content.scene,camera);
  }
  function reset(){monitor.reset();prev.clear();longTasks=[];interactions=[];sampleNow();}
  function observe(){
    const types=window.PerformanceObserver?.supportedEntryTypes||[];
    for(const type of ['longtask','event'])if(types.includes(type)){
      const observer=new PerformanceObserver(list=>{for(const e of list.getEntries())if(type==='longtask')bounded(longTasks,e.duration);else if(e.interactionId)bounded(interactions,e.duration);});
      observer.observe(type==='event'?{type,durationThreshold:16}:{type});observers.push(observer);
    }
  }
  const loop=createFrameLoop(time=>{if(time-last>=500){last=time;sampleNow();}});
  function setOpen(value){
    if(open===Boolean(value))return;open=Boolean(value);scroll=0;focused='';monitor.setEnabled(open);
    if(open){last=-Infinity;reset();observe();loop.start();}
    else{loop.stop();for(const o of observers)o.disconnect();observers=[];changed();}
    hit.setAttribute('aria-label',open?'性能面板':'打开性能面板（F8）');
  }
  function command(id){
    if(id==='toggle'||id==='close')setOpen(!open);
    if(id==='compact'){compact=!compact;scroll=0;changed();}
    if(id==='reset')reset();
    if(id==='export'){
      const url=URL.createObjectURL(new Blob([JSON.stringify(sample.report,null,2)],{type:'application/json'}));
      const a=document.createElement('a');a.href=url;a.download='performance-v'+BUILD_IDENTITY.version+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }
  function hitAt(e){
    if(!layout)return null;const x=e.clientX-layout.x,y=e.clientY-layout.y+scroll;
    return controls.find(c=>x>=c.x&&x<=c.x+c.w&&y>=c.y&&y<=c.y+c.h)?.id;
  }
  function moveScroll(n){if(!layout)return;scroll=Math.max(0,Math.min(n,contentHeight-layout.h));display.refresh();}
  hit.addEventListener('pointerdown',e=>{keyboard=false;hit.focus({preventScroll:true});hit.setPointerCapture(e.pointerId);press={id:hitAt(e),y:e.clientY,scroll};},options);
  hit.addEventListener('pointermove',e=>{if(press&&Math.abs(e.clientY-press.y)>4){press.id=null;moveScroll(press.scroll+press.y-e.clientY);}},options);
  hit.addEventListener('pointerup',e=>{const id=press?.id;press=null;if(id&&id===hitAt(e))command(id);},options);
  hit.addEventListener('pointercancel',()=>press=null,options);
  hit.addEventListener('wheel',e=>{if(open&&!compact){moveScroll(scroll+e.deltaY*(e.deltaMode===1?16:1));e.preventDefault();}},{...options,passive:false});
  hit.addEventListener('keydown',e=>{
    if(e.key==='F8')return;
    if(e.key==='Escape'&&open){e.preventDefault();setOpen(false);return;}
    if(['Enter',' '].includes(e.key)){e.preventDefault();command(focused||controls[0]?.id);return;}
    if(['PageDown','PageUp','Home','End'].includes(e.key)){e.preventDefault();moveScroll(e.key==='Home'?0:e.key==='End'?contentHeight:scroll+(e.key==='PageDown'?1:-1)*layout.h);return;}
    if(['Tab','ArrowDown','ArrowUp'].includes(e.key)){
      const direction=e.shiftKey||e.key==='ArrowUp'?-1:1;let i=controls.findIndex(c=>c.id===focused)+direction;
      if(e.key==='Tab'&&(i<0||i>=controls.length))return;
      e.preventDefault();keyboard=true;const c=controls[(i+controls.length)%controls.length];focused=c.id;hit.setAttribute('aria-label',c.label);
      if(c.y<scroll)moveScroll(c.y);else if(c.y+c.h>scroll+layout.h)moveScroll(c.y+c.h-layout.h);changed();
    }
  },options);
  window.addEventListener('keydown',e=>{if(e.key==='F8'&&!e.repeat){e.preventDefault();setOpen(!open);} },options);
  document.addEventListener('visibilitychange',()=>monitor.resetClocks(),options);
  window.addEventListener('resize',changed,options);
  const view={draw,setOpen,get state(){return {open,compact,sampling:monitor.enabled,loopStarted:loop.started,observers:observers.length,values:sample?.values,
    controls:controls.map(c=>({...c,x:c.x+(layout?.x||0),y:c.y+(layout?.y||0)-scroll})),scroll,build:badgeText};},
    destroy(){if(closed)return;closed=true;setOpen(false);events.abort();loop.destroy();display.attach(null);
      badge.art.clear();plate.art.clear();content.art.clear();host.remove();stage.before(shell);stage.remove();arcade.classList.remove('has-performance-tools');}};
  display.attach(view);
  const pref=new URLSearchParams(location.search).get('perf');
  setOpen(pref==='1'||pref!=='0'&&!matchMedia('(max-width:760px)').matches);
  return view;
}
