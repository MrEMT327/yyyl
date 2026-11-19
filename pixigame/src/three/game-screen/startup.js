import {LinearFilter,LinearMipmapLinearFilter,OrthographicCamera,Scene,SRGBColorSpace,WebGLRenderer} from 'three';
import {artworkTexture} from './image-loading.js';
import {createPageDisplay} from './page-display.js';
import {createThreeSurface} from '../../ui/three-surface.js';
import {nineSliceGeometry} from '../../ui/nine-slice-geometry.js';
import {copyDiagnosticReport,diagnosticReport} from '../../diagnostic-log.js';

const artFiles={
  backdrop:'entry-screens-v4/startup.png',
  track:'psd-combat-v1/health-track.png',fill:'psd-combat-v1/health-fill.png',
  start:'psd-buttons-v1/button-orange.png',retry:'psd-equipment-v1/button-gold.png'
};
const clamp=(value,low,high)=>Math.max(low,Math.min(high,value));
const uiFont='"PingFang SC","Microsoft YaHei",sans-serif';
const buttonFont='PsdPopup,"Microsoft YaHei",sans-serif';

function entryLayout(w,h,safeBottom,mode,report){
  const gap=clamp(w*.02,8,12),bar=clamp(w*.025,8,13),size=clamp(w*.035,12,20);
  const width=w*.72,buttonW=mode==='ready'?Math.min(width,clamp(w*.44,160,192)):width*.76;
  const bottom=h-Math.max(h*.045,safeBottom),buttons=[];
  let y=bottom;
  if(report)y-=118;
  function button(id,label){
    const b={id,label,x:(w-buttonW)/2,y:y-44,w:buttonW,h:44};
    buttons.unshift(b);y=b.y;return b;
  }
  if(mode==='failed'){button('copy','复制诊断');y-=6;button('retry','重新加载');}
  if(mode==='ready')button('start','开始游戏');
  if(buttons.length)y-=clamp(w*.015,5,10);
  y-=gap;
  const track=mode==='failed'?null:{x:w*.14,y:y-bar,w:width,h:bar};
  const status=(track?track.y-gap:y)-size*.7;
  return {buttons,track,status,size,report:{x:w*.14,y:bottom-110,w:width,h:110}};
}

// The renderer belongs to this page. Startup, hangar, lobby and combat take turns using its canvas.
export function createH5Startup(){
  const renderer=new WebGLRenderer({alpha:true,antialias:true,premultipliedAlpha:true});
  const display=createPageDisplay(renderer),canvas=display.input,root=document.getElementById('bootLoading');
  const camera=new OrthographicCamera(0,1,0,1,-1,1),scene=new Scene();
  const surface=createThreeSurface();
  scene.add(surface.group);
  let device=null,events=null,resize=null,raf=0,images=null,report=null;
  let mode='loading',message='正在加载…',progress=0,buttons=[],resolveStart=null,enter=null;
  let focusId=null,pressId=null,keyboard=false,copyLabel='复制诊断',disposed=false;
  function schedule(){if(!raf&&events)raf=requestAnimationFrame(draw);}
  function loadArt(){
    const result={};
    for(const [key,path] of Object.entries(artFiles)){
      const texture=artworkTexture((import.meta.env.BASE_URL||'/')+'art/'+path,schedule,schedule);
      texture.colorSpace=SRGBColorSpace;texture.generateMipmaps=key==='backdrop';
      texture.minFilter=texture.generateMipmaps?LinearMipmapLinearFilter:LinearFilter;
      result[key]=texture;
    }
    return result;
  }
  function paintSlice(texture,b,slice,corner){
    if(!texture?.image?.width||b.w<=0||b.h<=0)return;
    const mesh=surface.image(texture,b.x,b.y,b.w,b.h);
    mesh.geometry.dispose();
    mesh.geometry=nineSliceGeometry(b.w,b.h,texture.image.width,texture.image.height,slice,corner);
    return mesh;
  }
  function draw(){
    raf=0;if(!events||!root.isConnected)return;
    const b=canvas.getBoundingClientRect(),w=b.width,h=b.height;if(!w||!h)return;
    const dpr=globalThis.devicePixelRatio||1,bw=Math.max(1,Math.round(w*dpr)),bh=Math.max(1,Math.round(h*dpr));
    display.begin(canvas,bw,bh,schedule,true);
    renderer.setClearColor(0x122b3d,1);renderer.autoClear=false;
    camera.right=w;camera.bottom=h;camera.updateProjectionMatrix();surface.clear();
    const layout=entryLayout(w,h,parseFloat(getComputedStyle(root).scrollPaddingBottom)||0,mode,!!report);
    buttons=layout.buttons;
    if(images.backdrop.image)surface.image(images.backdrop,0,0,w,h);
    surface.text(message,w/2,layout.status-layout.size*.09,{size:layout.size,family:uiFont,weight:500,align:'center',color:'#fff',maxWidth:w*.72,
      shadow:{color:'#14263e',y:1,blur:3}});
    if(layout.track){
      const t=layout.track;
      function pixels(r){
        const x=v=>(Math.round((b.x+v)*dpr)-Math.round(b.x*dpr))*w/bw;
        const y=v=>(Math.round((b.y+v)*dpr)-Math.round(b.y*dpr))*h/bh;
        return {x:x(r.x),y:y(r.y),w:x(r.x+r.w)-x(r.x),h:y(r.y+r.h)-y(r.y)};
      }
      paintSlice(images.track,pixels(t),[18,8],[6,3]);
      paintSlice(images.fill,pixels({x:t.x+3,y:t.y+2,w:(t.w-6)*progress/3,h:t.h-4}),[18,6],[5,2]);
    }
    for(const b of buttons){
      const down=pressId===b.id,focus=keyboard&&focusId===b.id;
      const plate=paintSlice(b.id==='start'?images.start:images.retry,{...b,y:b.y+Number(down)},18,9);
      if(plate&&(down||focus))plate.material.color.multiplyScalar(down?1.35:1.40);
      if(!plate)surface.panel(b.x,b.y,b.w,b.h,{fill:'#8e4519',stroke:'#efb779',radius:5});
      const size=clamp(w*.048,16,22);
      surface.text(b.id==='copy'?copyLabel:b.label,w/2,b.y+b.h/2+Number(down),{size,weight:400,family:buttonFont,color:'#fff',
        align:'center',tracking:size*.03,maxWidth:b.w-20,shadow:{color:b.id==='start'?'#763609':'#81500a',y:2,blur:3}});
    }
    if(report){
      const r=layout.report;drawReport(r);
      report.style.left=(b.x+r.x)+'px';report.style.top=(b.y+r.y)+'px';report.style.width=r.w+'px';report.style.height=r.h+'px';
    }
    let order=0;for(const child of surface.group.children)child.renderOrder=order++;
    renderer.clear();renderer.render(scene,camera);
    canvas.dataset.startupState=mode;
    canvas.setAttribute('aria-label',mode==='loading'?message:mode==='ready'?'开始游戏':message+'，'+(buttons.find(b=>b.id===focusId)?.label||'重新加载'));
  }
  let reportCache=null;
  function drawReport(r){
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
    images=loadArt();document.fonts?.load('18px PsdPopup').then(schedule,()=>{});
    schedule();
  }
  function release(){
    if(!events)return;
    events.abort();events=null;resize.disconnect();cancelAnimationFrame(raf);raf=0;
    surface.clear();for(const texture of Object.values(images))texture.dispose();images=null;
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

