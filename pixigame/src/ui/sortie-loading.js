import './entry-screens.css';

export const nextLoadingFrame = () => new Promise(resolve => requestAnimationFrame(resolve));

export function showSortieLoading(options={}) {
  if(typeof options==='string')options={stageName:options};
  const resourceCount=options.resourceCount||5;
  const previousFocus = document.activeElement;
  const overlay = document.createElement('div');
  overlay.className = 'entry-screen sortie-loading';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', '出击准备');
  overlay.tabIndex = -1;
  overlay.innerHTML = `<section class="entry-screen__portrait sortie-loading__panel">
    <header class="sortie-loading__heading"><small>即将抵达</small><h2></h2></header>
    <div class="sortie-loading__flight"><img alt="" /></div>
    <div class="sortie-loading__state">
      <p class="sortie-loading__status" role="status" aria-live="polite">正在准备出击…</p>
      <div class="sortie-loading__meter"><progress class="entry-screen__progress" value="0" aria-label="关卡准备进度"></progress></div>
      <div class="sortie-loading__actions" hidden>
        <button type="button" class="entry-screen__button entry-screen__button--secondary" data-loading-action="back">返回</button>
        <button type="button" class="entry-screen__button" data-loading-action="retry">重试</button>
      </div>
    </div>
    <p class="sortie-loading__tip">按住屏幕滑动移动，战机会自动开火</p>
  </section>`;
  overlay.querySelector('h2').textContent=options.stageName||'作战区域';
  const aircraft=/^pilot-\d{2}$/.test(options.aircraftId)?options.aircraftId:'pilot-01';
  const flight=overlay.querySelector('.sortie-loading__flight img');
  flight.src=`${import.meta.env?.BASE_URL||'/'}art/aircraft-ui-v1/${aircraft}-preview.webp`;
  flight.onerror=()=>{flight.onerror=null;flight.src=`${import.meta.env?.BASE_URL||'/'}art/aircraft-ui-v1/pilot-01-preview.webp`;};
  const status = overlay.querySelector('.sortie-loading__status');
  const progress=overlay.querySelector('progress');progress.max=resourceCount+2;progress.value=0;
  if(options.indeterminate){progress.removeAttribute('value');overlay.classList.add('is-pending');}
  const actions=overlay.querySelector('.sortie-loading__actions');
  const back=overlay.querySelector('[data-loading-action="back"]'),retry=overlay.querySelector('[data-loading-action="retry"]');
  let closed=false,closing,failed=false;
  for(const type of ['pointerdown','pointermove','pointerup','click']) {
    overlay.addEventListener(type,event=>event.stopPropagation());
  }
  // Capture keyboard input before the game's global shortcuts.
  const block = event => {
    if (event.type === 'keyup' || actions.hidden) event.preventDefault();
    event.stopImmediatePropagation();
    if(event.type==='keydown' && !actions.hidden) {
      if(event.key==='Escape'){event.preventDefault();back.click();}
      if(event.key==='Tab'){
        event.preventDefault();(document.activeElement===back&&!retry.hidden?retry:back).focus();
      }
    }
  };
  window.addEventListener('keydown', block, true);
  window.addEventListener('keyup', block, true);
  document.body.append(overlay);
  overlay.focus({preventScroll:true});
  const close = ({restoreFocus=true}={}) => {
    if(closing)return closing;
    closed=true;
    closing=(async()=>{
      overlay.classList.add('is-leaving');
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        await new Promise(resolve=>{
          const finish=event=>{
            if(event&&event.target!==overlay)return;
            window.clearTimeout(timer);overlay.removeEventListener('transitionend',finish);resolve();
          };
          const timer=window.setTimeout(finish,350);
          overlay.addEventListener('transitionend',finish);
        });
      }
      window.removeEventListener('keydown',block,true);window.removeEventListener('keyup',block,true);
      overlay.remove();
      if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    })();
    return closing;
  };
  back.onclick=async()=>{await close();options.onDismiss?.();};
  return {
    update(value,message) {
      if(closed||failed||!Number.isFinite(value))return;
      const next=Math.min(1,Math.max(0,value))*progress.max;
      if(next<progress.value)return;
      overlay.classList.remove('is-pending');
      progress.value=next;progress.setAttribute('value',String(next));
      if(message)status.textContent=message;
    },
    resource() {if(!closed&&!failed)progress.value=Math.min(resourceCount,progress.value+1);},
    stage(index) {
      if(closed||failed)return;
      progress.value=Math.max(progress.value,resourceCount+Math.max(0,index));
      status.textContent=['作战资源已就绪','正在准备战场…','出击中…'][index]||'正在准备出击…';
    },
    fail({onRetry}={}) {
      if(closed)return;
      failed=true;
      overlay.classList.remove('is-pending');
      overlay.classList.add('is-failed');
      status.textContent='准备失败，请重试';
      actions.hidden=false;retry.hidden=!onRetry;
      if(!onRetry)status.textContent='准备未完成，请返回';
      retry.onclick=async()=>{retry.disabled=true;back.disabled=true;await close();onRetry?.();};
      (onRetry?retry:back).focus();
    },
    close,
  };
}
