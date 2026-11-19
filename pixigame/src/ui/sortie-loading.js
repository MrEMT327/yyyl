import './entry-screens.css';
import { createSortieHangar } from './sortie-hangar.js';
import {sortieAircraftImageUrl} from './sortie-aircraft-image.js';
import {currentAircraftId} from '../three/aircraft/aircraft-roster.js';

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
    <div class="sortie-loading__shaft" aria-hidden="true"><div class="sortie-loading__shaft-strip"><img class="sortie-loading__backdrop" alt="" /><img class="sortie-loading__backdrop" alt="" /></div></div>
    <div class="sortie-loading__shade" aria-hidden="true"></div>
    <header class="sortie-loading__heading"><h2></h2></header>
    <div class="sortie-hangar" aria-hidden="true">
      <img class="sortie-hangar__elevator" src="${import.meta.env?.BASE_URL||'/'}art/sortie-hangar-v1/lift-front.webp" alt="" />
      <div class="sortie-hangar__model"><img class="sortie-hangar__fallback" alt="" /></div>
    </div>
    <div class="sortie-loading__state" hidden>
      <p class="sortie-loading__status" role="status" aria-live="polite"></p>
      <progress class="entry-screen__progress" value="0" aria-label="关卡准备进度"></progress>
      <div class="sortie-loading__actions" hidden>
        <button type="button" class="entry-screen__button entry-screen__button--secondary" data-loading-action="back">返回</button>
        <button type="button" class="entry-screen__button" data-loading-action="retry">重试</button>
      </div>
    </div>
  </section>`;
  overlay.querySelector('h2').textContent=options.stageName||'作战区域';
  const aircraft=currentAircraftId(options.aircraftId);
  for(const backdrop of overlay.querySelectorAll('.sortie-loading__backdrop')){
    backdrop.src=`${import.meta.env?.BASE_URL||'/'}art/sortie-hangar-v1/shaft-section.webp`;
    backdrop.onerror=()=>{backdrop.onerror=null;backdrop.src=`${import.meta.env?.BASE_URL||'/'}art/psd-main-v1/main-background.png`;};
  }
  const flight=overlay.querySelector('.sortie-hangar__fallback');
  flight.decoding='sync';flight.fetchPriority='high';
  flight.src=sortieAircraftImageUrl(aircraft);
  flight.onerror=()=>{flight.onerror=null;flight.hidden=true;};
  const status = overlay.querySelector('.sortie-loading__status');
  const progress=overlay.querySelector('progress');progress.max=resourceCount+2;
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
  document.documentElement.classList.add('sortie-loading-active');
  document.body.append(overlay);
  const presentation=createSortieHangar(overlay.querySelector('.sortie-hangar__model'),aircraft);
  const heading=overlay.querySelector('.sortie-loading__heading');
  const titleTimer=window.setTimeout(()=>heading.classList.add('is-muted'),1600);
  overlay.focus({preventScroll:true});
  const close = ({restoreFocus=true,keepMotion=false}={}) => {
    if(closing)return closing;
    closed=true;
    window.clearTimeout(titleTimer);
    if(keepMotion) presentation.finish();
    else presentation.freeze();
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
      presentation.dispose();
      overlay.remove();
      if(!document.querySelector('.sortie-loading'))document.documentElement.classList.remove('sortie-loading-active');
      if(restoreFocus&&previousFocus?.isConnected)previousFocus.focus({preventScroll:true});
    })();
    return closing;
  };
  back.onclick=async()=>{await close();options.onDismiss?.();};
  return {
    update(value,message) {
      if(closed||failed||!Number.isFinite(value))return;
      progress.value=Math.max(progress.value,Math.min(1,Math.max(0,value))*progress.max);
      if(message)status.textContent=message;
    },
    resource() {if(!closed&&!failed)progress.value=Math.min(resourceCount,progress.value+1);},
    stage(index) {
      if(closed||failed)return;
      progress.value=Math.max(progress.value,resourceCount+Math.max(0,index));
      status.textContent=['作战资源已就绪','正在准备战场…','出击中…'][index]||'正在准备出击…';
    },
    fail({onRetry,message}={}) {
      if(closed)return;
      failed=true;
      window.clearTimeout(titleTimer);heading.classList.remove('is-muted');
      presentation.freeze();
      overlay.classList.add('is-failed');
      overlay.querySelector('.sortie-loading__state').hidden=false;progress.hidden=true;
      status.textContent=message||'准备失败';
      actions.hidden=false;retry.hidden=!onRetry;
      if(!onRetry&&!message)status.textContent='准备未完成，请返回';
      retry.onclick=async()=>{retry.disabled=true;back.disabled=true;await close();onRetry?.();};
      (onRetry?retry:back).focus();
    },
    close,
  };
}
