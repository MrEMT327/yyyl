import {captureBattleCheckpoint} from './battle-checkpoint.js';
import {appearanceOf as sessionAppearance,createSortieController} from './sortie-controller.js';
import './replica-battle.css';

export function appearanceOf(snapshot,chapter){
  return sessionAppearance(snapshot,chapter,document.baseURI);
}

export function createReplicaBattleBridge({mountBattle,...options}){
  const embedded=Boolean(mountBattle);
  const host={
    baseURL:document.baseURI,hidden:()=>document.hidden,now:()=>performance.now(),
    makeSessionId:()=>Array.from(crypto.getRandomValues(new Uint32Array(4)),value=>value.toString(16).padStart(8,'0')).join('-'),
    setLaunching:value=>document.documentElement.classList.toggle('replica-launch-active',value),
    bind({visibility,checkpoint,leave,resume}){
      document.addEventListener('visibilitychange',visibility);
      document.addEventListener('freeze',checkpoint);
      window.addEventListener('pagehide',leave);
      window.addEventListener('pageshow',resume);
      return ()=>{
        document.removeEventListener('visibilitychange',visibility);
        document.removeEventListener('freeze',checkpoint);
        window.removeEventListener('pagehide',leave);
        window.removeEventListener('pageshow',resume);
      };
    },
    createSurface(label){
      const holder=document.createElement('section'),frame=document.createElement(embedded?'main':'iframe');
      const opener=document.activeElement;
      holder.className='replica-battle-host';
      holder.setAttribute('aria-label',label+'战斗');
      frame.className='replica-battle-frame';
      frame.setAttribute('aria-label','彼方之遥 · '+label);
      if(embedded){frame.id='stage';frame.tabIndex=-1;frame.setAttribute('data-awaiting-start','');}
      else frame.allow='autoplay; fullscreen';
      holder.append(frame);
      return {
        releaseLobbyFocus(){if(opener instanceof HTMLElement)opener.blur();},
        restoreFocus(){opener?.focus?.({preventScroll:true});},
        focus(){if(document.hasFocus())frame.focus({preventScroll:true});},
        show(){document.documentElement.classList.add('replica-battle-active');document.body.append(holder);},
        close(){
          if(!embedded)frame.src='about:blank';
          holder.remove();document.documentElement.classList.remove('replica-battle-active');
        },
        async mount({id,chapterId,emit}){
          const url=new URL(import.meta.env.BASE_URL+'replica-battle/index.html',document.baseURI);
          url.searchParams.set('chapter',String(chapterId));url.searchParams.set('session',id);
          if(embedded){
            const checkpointTarget=new EventTarget();
            const controller=await mountBattle({stage:frame,url,checkpointTarget,emit});
            return {receive:controller.receive,dispose:()=>controller.dispose(),
              checkpoint:()=>captureBattleCheckpoint(checkpointTarget)};
          }
          const receive=event=>{
            if(event.origin===location.origin&&event.source===frame.contentWindow)emit(event.data);
          };
          window.addEventListener('message',receive);
          frame.src=url.href;
          return {
            receive:message=>frame.contentWindow?.postMessage(message,location.origin),
            dispose(){
              window.removeEventListener('message',receive);
              frame.contentWindow?.dispatchEvent(new Event('shnh-dispose-replica-battle'));
            },
            checkpoint:()=>captureBattleCheckpoint(frame.contentWindow),
          };
        }
      };
    },
  };
  return createSortieController({...options,host});
}
