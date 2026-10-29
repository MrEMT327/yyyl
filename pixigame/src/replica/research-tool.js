import { appearanceOf } from './battle-bridge.js';
import { chapterPresentationForStage } from './chapter-presentation.js';
import chapters from './chapter-correspondence.json' with { type: 'json' };
import './research-tool.css';

const CHANNEL='shnh-replica-battle-v1';
/** Independent research host: no prepareSortie, recordSortie or reward handlers. */
export function mountReplicaResearchTool({bridge}) {
  if (!bridge.openReplicaResearch || document.getElementById('replicaResearchToggle')) return;
  const button=document.createElement('button');button.id='replicaResearchToggle';button.type='button';
  button.textContent='研究配装 · F9';button.setAttribute('aria-haspopup','dialog');
  const tools=document.querySelector('.performance-tools');
  (tools||document.body).prepend(button);
  let dialog=null,frame=null,session='',timer=null,receive=null;
  const close=()=>{
    if(!dialog)return;
    clearTimeout(timer);window.removeEventListener('message',receive);
    frame.contentWindow?.dispatchEvent(new Event('shnh-dispose-replica-battle'));
    frame.src='about:blank';dialog.close();dialog.remove();dialog=null;frame=null;session='';
    bridge.closeReplicaResearch();button.focus({preventScroll:true});
  };
  function open() {
    if(dialog){frame?.focus();return;}
    const accepted=bridge.openReplicaResearch();
    if(!accepted?.ok){button.title=accepted?.message||'请先结束当前战斗';return;}
    try {
      const snapshot=bridge.getPeripheralSnapshot();
      dialog=document.createElement('dialog');dialog.className='replica-research-dialog';dialog.setAttribute('aria-label','研究配装');
      const toolbar=document.createElement('header'),title=document.createElement('strong'),label=document.createElement('label');
      title.textContent='研究配装';label.textContent='试打关卡 ';
      const select=document.createElement('select');select.setAttribute('aria-label','研究试打关卡');
      for(const chapter of chapters.chapters){const option=document.createElement('option');option.value=String(chapter.id);option.textContent=chapterPresentationForStage(chapter.stageIndex).chapterName;select.append(option);}
      label.append(select);
      const back=document.createElement('button');back.type='button';back.textContent='返回大厅';back.addEventListener('click',close);
      toolbar.append(title,label,back);
      const note=document.createElement('p');note.textContent='独立研究存档 · 可手动配置 · 不消耗正式资源，不结算奖励或通关进度';
      const status=document.createElement('p');status.className='replica-research-status';status.setAttribute('role','status');
      frame=document.createElement('iframe');frame.title='独立研究配装与试打';frame.allow='autoplay; fullscreen';
      const load=()=>{
        frame.contentWindow?.dispatchEvent(new Event('shnh-dispose-replica-battle'));
        clearTimeout(timer);
        const chapter=chapters.chapters.find(row=>row.id===Number(select.value));
        session=Array.from(crypto.getRandomValues(new Uint32Array(4)),x=>x.toString(16)).join('-');
        const url=new URL(`${import.meta.env.BASE_URL}replica-battle/index.html`,document.baseURI);
        url.searchParams.set('chapter',String(chapter.id));url.searchParams.set('study','1');url.searchParams.set('session',session);
        frame.src=url.href;status.hidden=false;status.textContent='正在读取研究配装…';
        timer=setTimeout(()=>{status.hidden=false;status.textContent='读取未完成，可切换关卡重新加载或返回大厅';},60000);
      };
      receive=event=>{
        if(!dialog||event.origin!==location.origin||event.source!==frame.contentWindow)return;
        const data=event.data;
        if(data?.channel!==CHANNEL||data.session!==session)return;
        if(data.type==='boot'){
          const chapter=chapters.chapters.find(row=>row.id===Number(data.chapterId ?? select.value));
          if(!chapter)return;
          // The in-frame selector also reloads the study battle. Keep both
          // selectors and the initialization appearance on that same chapter.
          select.value=String(chapter.id);
          frame.contentWindow.postMessage({channel:CHANNEL,session,type:'initialize',appearance:appearanceOf(snapshot,chapter)},location.origin);
        } else if(data.type==='research-ready') {clearTimeout(timer);status.hidden=true;frame.focus();}
        else if(data.type==='error'){clearTimeout(timer);status.hidden=false;status.textContent=data.message||'研究资源加载失败';}
        // Deliberately ignore configure/start/result/retry messages. This host
        // cannot mint a formal battle receipt, currency or campaign progress.
      };
      window.addEventListener('message',receive);select.addEventListener('change',load);
      dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
      dialog.append(toolbar,note,status,frame);document.body.append(dialog);dialog.showModal();load();
    } catch(error) { if(dialog)close();else bridge.closeReplicaResearch();throw error; }
  }
  button.addEventListener('click',open);
  const keydown=event=>{if(event.key==='F9'&&!event.repeat){event.preventDefault();if(dialog)close();else open();}};
  window.addEventListener('keydown',keydown);
  return {open,close,destroy(){close();window.removeEventListener('keydown',keydown);button.remove();}};
}
