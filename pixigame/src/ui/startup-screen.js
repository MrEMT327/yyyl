import { copyDiagnosticReport, diagnosticReport } from '../diagnostic-log.js';

export function createStartupScreen(documentRef=document, { prepareStartButton } = {}) {
  const root=documentRef.getElementById('bootLoading');
  if(!root)return {stage(){},ready:async()=>{},fail(){}};
  const status=root.querySelector('#bootMessage'),progress=root.querySelector('progress');
  const start=root.querySelector('#bootStart'),retry=root.querySelector('#bootRetry');
  const startArtwork=prepareStartButton?.(start);
  const copy=root.querySelector('#bootCopyDiagnostics'),report=root.querySelector('#bootDiagnosticsReport');
  if(copy && report)copy.onclick=async()=>{
    report.value=diagnosticReport();
    report.hidden=false;
    const copied=await copyDiagnosticReport(report);
    report.hidden=copied;
    copy.textContent=copied?'已复制':'请手动复制日志';
  };
  const block=event=>{
    event.stopImmediatePropagation();
    if(event.target===report || event.target===copy)return;
    if(event.key==='Enter'){event.preventDefault();(retry.hidden?start:retry).click();}
    else if(event.key!=='Tab')event.preventDefault();
  };
  window.addEventListener('keydown',block,true);
  window.addEventListener('keyup',block,true);
  const cleanup=()=>{
    window.removeEventListener('keydown',block,true);window.removeEventListener('keyup',block,true);
    documentRef.documentElement.removeAttribute('data-boot');root.remove();
  };
  return {
    stage(value,message){progress.value=Math.max(progress.value,Math.min(3,value));status.textContent=message;},
    ready(onEnter,{automatic=false}={}) {
      if(automatic){cleanup();return Promise.resolve();}
      const reveal = useArtwork => {
        if(!root.isConnected || root.classList.contains('is-failed')) return;
        if(useArtwork===null) start.classList.add('entry-screen__button--art-fallback');
        else useArtwork?.();
        progress.value=3;
        root.classList.add('is-ready');
        status.textContent='准备就绪';
        start.hidden=false;
        start.disabled=false;
        return new Promise(resolve=>{
          start.onclick=()=>{
            if(start.disabled)return;start.disabled=true;onEnter?.();cleanup();resolve();
          };
        });
      };
      return startArtwork ? startArtwork.then(reveal) : reveal();
    },
    fail({message='加载失败，请检查网络后重试'}={}){
      if(!root.isConnected)documentRef.body.append(root);
      documentRef.documentElement.setAttribute('data-boot','loading');
      window.addEventListener('keydown',block,true);window.addEventListener('keyup',block,true);
      root.style.zIndex='2147483647';
      root.classList.add('is-failed');status.textContent=message;
      if(copy)copy.hidden=false;
      start.hidden=true;retry.hidden=false;retry.onclick=()=>location.reload();
    },
  };
}
