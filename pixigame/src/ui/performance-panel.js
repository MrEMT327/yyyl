import {performanceMonitor as monitor} from '../performance-monitor.js';
import {createFrameLoop} from '../frame-loop.js';
import {BUILD_IDENTITY} from '../build-info.js';
import {summarizeRendererMetrics} from '../renderer-metrics.js';
import './performance-panel.css';

export function mountPerformancePanel({bridge,documentRef=document}={}) {
  const doc=documentRef,view=doc.defaultView;
  if(doc.getElementById('performancePanel'))return;
  const host=doc.createElement('aside');host.className='performance-tools';
  host.innerHTML=`<button type="button" class="perf-toggle" aria-controls="performancePanel" aria-expanded="false" aria-label="打开性能面板（F8）">性能 · F8</button>
    <section id="performancePanel" class="perf-panel is-compact" aria-label="性能面板" hidden>
      <header><strong>性能</strong><button type="button" data-perf="compact" aria-label="展开性能面板" aria-expanded="false">详情</button><button type="button" data-perf="close" aria-label="关闭性能面板">×</button></header>
      <dl class="perf-summary" aria-label="实时性能指标">
        <div><dt>FPS</dt><dd data-value="fps">—</dd></div>
        <div><dt>Draw Call / 帧</dt><dd data-value="calls">—</dd></div>
        <div><dt>三角面 / 帧</dt><dd data-value="triangles">—</dd></div>
        <div><dt>帧耗时</dt><dd data-value="frame-ms">—</dd></div>
      </dl>
      <div class="perf-details"><p class="perf-build"></p><p class="perf-route"></p><p data-value="p95"></p>
        <canvas width="300" height="50" aria-label="最近帧间隔，横线为 16.7 毫秒"></canvas><dl class="perf-values"></dl>
        <p class="perf-note">Draw Call 和三角面统计正在绘制的 Three.js 与 Live2D 渲染器，含多通道绘制。静态图片与 DOM 不计入；静止预览不重复提交。帧耗时包含浏览器调度，CPU 耗时不等于 GPU 耗时。</p>
        <footer><button type="button" data-perf="reset">重置采样</button><button type="button" data-perf="export">导出报告</button></footer>
      </div>
    </section>`;
  const shell=doc.getElementById('gameShell'),arcade=shell?.closest('.arcade');
  let stage=null;
  if(arcade){stage=doc.createElement('div');stage.className='performance-game-stage';shell.before(stage);stage.append(shell);arcade.append(host);arcade.classList.add('has-performance-tools');}
  else doc.body.append(host);
  const compactButton=host.querySelector('[data-perf="compact"]');
  const panel=host.querySelector('.perf-panel'),toggle=host.querySelector('.perf-toggle'),values=host.querySelector('.perf-values'),chart=host.querySelector('canvas');
  host.querySelector('.perf-build').textContent=`v${BUILD_IDENTITY.version} · ${BUILD_IDENTITY.label}`;
  let open=false,compact=true,lastPaint=-Infinity,longTasks=[],interactions=[],observers=[],latest=null;
  const rendererFrames=new Map();
  const push=(list,value)=>{list.push(value);if(list.length>180)list.shift();};
  const names={battle:'战役',assembly:'装备',shop:'商城',research:'天赋',supply:'招募',aircraft:'战机',pilot:'驾驶员',weapon:'武器',workshop:'改装间'};
  const ms=value=>`${Number(value||0).toFixed(1)} ms`,count=value=>Number(value||0).toLocaleString('zh-CN');
  function collect(){
    const state=bridge?.pixiLobby?.state,game=bridge?.game?.state;
    return {identity:BUILD_IDENTITY,route:state?.visible?`${names[state.tab]||state.tab}${state.subpage?' / '+(names[state.subpage]||state.subpage):''}${state.modal?' / 弹窗':''}`:game||'加载',...monitor.snapshot(),longTasks:longTasks.slice(),interactions:interactions.slice(),domNodes:doc.querySelectorAll('*').length,canvases:doc.querySelectorAll('canvas').length,resources:view.performance.getEntriesByType('resource').length,heapBytes:view.performance.memory?.usedJSHeapSize??null};
  }
  function paint(){
    latest=collect();const frames=latest.frames[bridge?.pixiLobby?.state?.visible?'lobby':'combat'];
    const fps=frames?.active&&frames.mean?Math.round(1000/frames.mean):0;
    host.querySelector('[data-value="fps"]').textContent=fps||'—';
    host.querySelector('[data-value="frame-ms"]').textContent=frames?.active?ms(frames.mean):'—';
    host.querySelector('[data-value="p95"]').textContent=`P95 ${ms(frames?.p95)}`;
    host.querySelector('.perf-route').textContent=latest.route;
    const rendering=summarizeRendererMetrics(latest.renderers,rendererFrames),cpu=latest.costs;
    latest.rendering=rendering;
    host.querySelector('[data-value="calls"]').textContent=count(rendering.calls);
    host.querySelector('[data-value="triangles"]').textContent=count(rendering.triangles);
    const rows=[
      ['最长帧',ms(frames?.max)],
      ['UI 更新 CPU',ms(cpu.ui?.mean)],
      ['界面刷新 CPU',ms(cpu['ui-render']?.mean)],
      ['立绘更新 CPU',ms(cpu.portrait?.mean)],
      ['预览准备 CPU',ms(cpu['preview-setup']?.mean)],
      ['预览绘制 CPU',ms(cpu.preview?.mean)],
      ['战斗更新 CPU',ms(cpu.combat?.mean)],
      ['战斗绘制 CPU',ms(cpu.render?.mean)],
      ['Draw Call / 帧',count(rendering.calls)],
      ['三角面 / 帧',count(rendering.triangles)],
      ['Three 几何 / 纹理',`${count(latest.renderers.reduce((n,r)=>n+(r.geometries||0),0))} / ${count(latest.renderers.reduce((n,r)=>n+(r.textures||0),0))}`],
      ['长任务 ≥50 ms',`${longTasks.length} · 最长 ${ms(Math.max(0,...longTasks))}`],
      ['交互耗时 P95',interactions.length?ms(interactions.slice().sort((a,b)=>a-b)[Math.floor(interactions.length*.95)]):'等待交互'],
      ['DOM / Canvas',`${latest.domNodes} / ${latest.canvases}`],
      ['已完成资源请求',count(latest.resources)],
      ['JS 堆',latest.heapBytes?`${(latest.heapBytes/1048576).toFixed(1)} MB`:'浏览器未提供'],
    ];
    if(compact)return;
    values.innerHTML=rows.map(([label,value])=>`<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
    const ctx=chart.getContext('2d');ctx.clearRect(0,0,300,50);ctx.strokeStyle='#d4b36b';ctx.beginPath();ctx.moveTo(0,37.5);ctx.lineTo(300,37.5);ctx.stroke();ctx.strokeStyle='#78e8c8';ctx.beginPath();(frames?.samples||[]).forEach((v,i)=>{const x=i*300/59,y=50-Math.min(66.7,v)*.75;i?ctx.lineTo(x,y):ctx.moveTo(x,y);});ctx.stroke();
  }
  const loop=createFrameLoop(time=>{if(time-lastPaint>=500){lastPaint=time;paint();}},{documentRef:doc,requestFrame:fn=>view.requestAnimationFrame(fn),cancelFrame:id=>view.cancelAnimationFrame(id)});
  const releaseRenderer=monitor.registerRenderer('combat',()=>{
    const r=bridge?.app?.renderer?.three;if(!r)return null;
    return {active:!doc.hidden&&!bridge?.pixiLobby?.state?.visible&&Boolean(r.domElement?.isConnected),...r.info.render,...r.info.memory};
  });
  function observe(){
    const supported=view.PerformanceObserver?.supportedEntryTypes||[];
    for(const type of ['longtask','event'])if(supported.includes(type)){
      const observer=new view.PerformanceObserver(list=>list.getEntries().forEach(e=>{if(type==='longtask')push(longTasks,e.duration);else if(e.interactionId)push(interactions,e.duration);}));
      observer.observe(type==='event'?{type,durationThreshold:16}:{type});observers.push(observer);
    }
  }
  function setOpen(value){
    if(Boolean(value)===open)return;
    open=Boolean(value);panel.hidden=!open;toggle.hidden=open;host.classList.toggle('is-open',open);toggle.setAttribute('aria-expanded',String(open));toggle.setAttribute('aria-label',`${open?'关闭':'打开'}性能面板（F8）`);
    monitor.setEnabled(open);
    if(open){monitor.reset();rendererFrames.clear();longTasks=[];interactions=[];lastPaint=-Infinity;observe();loop.start();paint();}
    else{loop.stop();observers.forEach(o=>o.disconnect());observers=[];}
  }
  toggle.addEventListener('click',()=>setOpen(!open));
  host.addEventListener('click',event=>{const action=event.target.closest('[data-perf]')?.dataset.perf;
    if(action==='close'){setOpen(false);toggle.focus();}
    if(action==='compact'){compact=!compact;panel.classList.toggle('is-compact',compact);compactButton.textContent=compact?'详情':'收起';compactButton.setAttribute('aria-label',`${compact?'展开':'收起'}性能面板`);compactButton.setAttribute('aria-expanded',String(!compact));if(!compact)paint();}
    if(action==='reset'){monitor.reset();rendererFrames.clear();longTasks=[];interactions=[];paint();}
    if(action==='export'){const url=view.URL.createObjectURL(new Blob([JSON.stringify(latest||collect(),null,2)],{type:'application/json'})),a=doc.createElement('a');a.href=url;a.download=`performance-v${BUILD_IDENTITY.version}.json`;a.click();view.setTimeout(()=>view.URL.revokeObjectURL(url),1000);}
  });
  const keydown=event=>{if(event.key==='F8'&&!event.repeat){event.preventDefault();setOpen(!open);}};view.addEventListener('keydown',keydown);
  const visibility=()=>monitor.resetClocks();doc.addEventListener('visibilitychange',visibility);
  if(new URLSearchParams(view.location.search).get('perf')!=='0')setOpen(true);
  return {setOpen,get state(){return {open,compact,sampling:monitor.enabled,loopStarted:loop.started,observers:observers.length};},destroy(){setOpen(false);loop.destroy();releaseRenderer();doc.removeEventListener('visibilitychange',visibility);view.removeEventListener('keydown',keydown);host.remove();if(stage){stage.before(shell);stage.remove();arcade.classList.remove('has-performance-tools');}}};
}
