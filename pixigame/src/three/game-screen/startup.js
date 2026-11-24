import {WebGLRenderer} from 'three';
import {createPageDisplay} from './page-display.js';
import {createStartupScene} from './startup-scene.js';
import {copyDiagnosticReport,diagnosticReport} from '../../diagnostic-log.js';

const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));

// The renderer belongs to this page. Startup, hangar, lobby and combat take turns using its canvas.
export function createH5Startup(){
  const renderer=new WebGLRenderer({alpha:true,antialias:true,premultipliedAlpha:true});
  const display=createPageDisplay(renderer),canvas=display.input,root=document.getElementById('bootLoading');
  let device=null,events=null,resize=null,raf=0,painter=null,report=null;
  let mode='loading',message='正在加载…',progress=0,buttons=[],resolveStart=null,enter=null;
  let focusId=null,pressId=null,keyboard=false,copyLabel='复制诊断',disposed=false;
  function schedule(){if(!raf&&events)raf=requestAnimationFrame(draw);}
  function draw(){
    raf=0;if(!events||!root.isConnected)return;
    const b=canvas.getBoundingClientRect(),w=b.width,h=b.height;if(!w||!h)return;
    const dpr=globalThis.devicePixelRatio||1,bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));
    display.begin(canvas,bw,bh,schedule,true);
    buttons=painter.paint(b,{dpr,bw,bh,mode,message,progress,pressId,focusId,keyboard,copyLabel,
      safeBottom:parseFloat(getComputedStyle(root).scrollPaddingBottom)||0,
      drawReport:report?r=>{drawReport(r);report.style.left=(b.x+r.x)+'px';report.style.top=(b.y+r.y)+'px';report.style.width=r.w+'px';report.style.height=r.h+'px';}:null});
    canvas.dataset.startupState=mode;
    canvas.setAttribute('aria-label',mode==='loading'?message:mode==='ready'?'开始游戏':message+'，'+(buttons.find(b=>b.id===focusId)?.label||'重新加载'));
  }
  let reportCache=null;
  function drawReport(r){
    const {surface}=painter;
    const max=r.w-20,key=report.value+'|'+max;
    if(reportCache?.key!==key){
      const ctx=document.createElement('canvas').getContext('2d');ctx.font='12px monospace';
      const rows=[];let index=0;
      for(const paragraph of report.value.split('\n')){
        let line='',start=index;
        for(const ch of paragraph){
          if(line&&ctx.measureText(line+ch).width>max){rows.push({line,start});line='';start=index;}
          line+=ch;index+=ch.length;
        }
        rows.push({line,start});index++;
      }
      reportCache={key,rows};
    }
    surface.panel(r.x,r.y,r.w,r.h,{fill:'#142738',stroke:'#647989',radius:2,opacity:1});
    const rows=reportCache.rows,first=Math.min(Math.max(0,rows.length-5),Math.floor(report.scrollTop/17.4));
    for(let i=first;i<Math.min(rows.length,first+5);i++){
      const row=rows[i],y=r.y+16+(i-first)*17.4;
      if(report.selectionStart<row.start+row.line.length&&report.selectionEnd>row.start)surface.quad(r.x+6,y-8,max,16,'#385d83');
      surface.text(row.line,r.x+8,y,{size:12,weight:400,family:'monospace',color:'#e0f2ff',maxWidth:max});
    }
  }
  function hit(event){
    const r=canvas.getBoundingClientRect(),x=event.clientX-r.x,y=event.clientY-r.y;
    return buttons.find(b=>x>=b.x&&y>=b.y&&x<=b.x+b.w&&y<=b.y+b.h)?.id;
  }
  async function activate(id){
    if(id==='start'&&mode==='ready'){
      const done=resolveStart;resolveStart=null;enter?.();release();done?.();
    }else if(id==='retry'&&mode==='failed')location.reload();
    else if(id==='copy'&&mode==='failed'){
      if(!report){report=document.createElement('textarea');report.readOnly=true;report.setAttribute('aria-label','诊断日志内容');
        report.style.cssText='position:fixed;box-sizing:border-box;z-index:1;opacity:0;padding:8px;font:12px/1.45 monospace';
        for(const event of ['scroll','select','keyup','pointerup'])report.addEventListener(event,schedule,{signal:events.signal});
        root.append(report);}
      report.value=diagnosticReport();draw();
      const copied=await copyDiagnosticReport(report);
      if(!events)return;
      if(copied){report?.remove();report=null;}
      copyLabel=copied?'已复制':'请手动复制日志';schedule();
    }
  }
  function keys(event){
    if(event.target===report)return;
    event.stopImmediatePropagation();event.preventDefault();
    if(event.type!=='keydown'||!buttons.length||event.repeat)return;
    if(event.key==='Tab'){keyboard=true;const n=buttons.findIndex(b=>b.id===focusId);
      focusId=buttons[(n+(event.shiftKey?-1:1)+buttons.length)%buttons.length].id;schedule();}
    if(event.key==='Enter'||event.key===' ')void activate(focusId||buttons[0].id);
  }
  function present(){
    if(events||disposed)return;
    if(!root.isConnected)document.body.prepend(root);
    document.documentElement.setAttribute('data-boot','loading');
    if(device)device.cover=view;
    root.append(canvas);canvas.style.removeProperty('width');canvas.style.removeProperty('height');
    canvas.className='three-startup-screen';canvas.tabIndex=0;canvas.setAttribute('role','application');
    events=new AbortController();const options={signal:events.signal};
    for(const key of ['keydown','keyup'])window.addEventListener(key,keys,{...options,capture:true});
    canvas.addEventListener('pointerdown',e=>{keyboard=false;pressId=hit(e);canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);schedule();},options);
    canvas.addEventListener('pointerup',e=>{const id=pressId;pressId=null;schedule();if(id&&id===hit(e))void activate(id);},options);
    canvas.addEventListener('pointercancel',()=>{pressId=null;schedule();},options);
    renderer.domElement.addEventListener('webglcontextrestored',schedule,options);
    resize=new ResizeObserver(schedule);resize.observe(canvas);
    painter=createStartupScene(renderer,schedule);document.fonts?.load('18px PsdPopup').then(schedule,()=>{});
    schedule();
  }
  function release(){
    if(!events)return;
    events.abort();events=null;resize.disconnect();cancelAnimationFrame(raf);raf=0;
    painter.close();painter=null;
    report?.remove();report=null;buttons=[];pressId=focusId=null;keyboard=false;
    canvas.removeAttribute('class');canvas.removeAttribute('style');canvas.removeAttribute('aria-label');canvas.removeAttribute('role');
    canvas.removeAttribute('tabindex');delete canvas.dataset.startupState;
    canvas.remove();root.remove();document.documentElement.removeAttribute('data-boot');
    if(device?.cover===view){device.cover=null;device.home.append(canvas);device.repaintHome?.();}
  }
  const view={renderer,display,
    attach(next){device=next;if(events)device.cover=view;},
    stage(value,status){if(mode==='failed')return;progress=Math.max(progress,clamp(value,0,3));message=status;schedule();},
    ready(onEnter,{automatic=false}={}){
      if(automatic){release();return Promise.resolve();}
      if(mode==='failed')return;
      mode='ready';message='准备就绪';progress=3;enter=onEnter;schedule();
      return new Promise(resolve=>{resolveStart=resolve;});
    },
    fail({message:failure='加载失败，请检查网络后重试'}={}){
      mode='failed';message=failure;copyLabel='复制诊断';enter=null;present();schedule();resolveStart?.();resolveStart=null;
    },
    dispose(){if(disposed)return;release();disposed=true;display.close();renderer.dispose();}
  };
  present();
  window.addEventListener('pagehide',()=>queueMicrotask(()=>view.dispose()),{once:true});
  return view;
}

