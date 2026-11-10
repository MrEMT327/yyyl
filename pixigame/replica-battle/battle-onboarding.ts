import { guideCompanionMarkup, guidePointerMarkup } from '../src/ui/guide-presentation.js';
import type { Choice, GameContent } from './kernel/model';

export const FIRST_GUIDE_CHOICES = [10400101,10001701,10000601] as const;
export function firstGuideChoices(combat: GameContent['combat']): Choice[] {
  return FIRST_GUIDE_CHOICES.map(id=>{
    if(id===10400101){
      const card=combat.cards[id];
      if(!card?.supported)throw new Error('首选机炮强化配置缺失');
      return {...card,group:10000101,star:1} as Choice;
    }
    const family=combat.families[id],stage=family?.stages.find((s:any)=>s.skillId===id);
    if(!stage||stage.supported===false)throw new Error('首选武器配置缺失');
    return {...stage,id,name:stage.name||family.name,description:'',icon:family.icon,star:1,group:id,
      advance:undefined,opensBreakthrough:false,
      effects:[{type:'addSecondary',entityId:family.entityId,skillId:id},...(stage.effects||[])]} as Choice;
  });
}

export function createMovementGuide(stage: HTMLElement){
  const hint=document.createElement('div');hint.className='battle-movement-guide';hint.hidden=true;
  hint.innerHTML=`${guideCompanionMarkup()}<span class="battle-guide-cue" aria-hidden="true">${guidePointerMarkup()}</span>`;
  hint.querySelector('.guide-message')!.textContent='滑动屏幕，操作飞机';
  const style=document.createElement('style');
  style.textContent='.battle-movement-guide{position:absolute;top:42%;left:50%;width:min(360px,92%);container-type:inline-size;transform:translateX(-50%);z-index:40;pointer-events:none;--guide-mascot-size:clamp(100px,36cqw,132px);--guide-bubble-inset:calc(var(--guide-mascot-size)*.66);--guide-text-inset:calc(var(--guide-mascot-size)*.3)}.battle-movement-guide[hidden]{display:none}.battle-guide-cue{display:flex;flex-direction:column;align-items:center;width:40px;height:32px;margin:8px auto 0;transform:rotate(-90deg);animation:guide-swipe 1.6s ease-in-out infinite}.battle-guide-cue .guide-pointer-art{display:block;width:40px;height:16px;object-fit:cover}@keyframes guide-swipe{0%,100%{transform:translateX(-28px) rotate(-90deg)}50%{transform:translateX(28px) rotate(-90deg)}}@media(prefers-reduced-motion:reduce){.battle-guide-cue{animation:none}}';
  stage.append(style,hint);
  return {show(value:boolean){hint.hidden=!value;},destroy(){hint.remove();style.remove();}};
}
