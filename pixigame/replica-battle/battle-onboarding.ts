import { projectIcon } from '../src/ui/project-ui-art.js';
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
  hint.setAttribute('role','status');hint.innerHTML=`<span aria-hidden="true">${projectIcon('upgrade-arrow','guide-pointer-art')}</span><b class="psd-guide-panel">滑动屏幕，操作飞机</b>`;
  const style=document.createElement('style');
  style.textContent='.battle-movement-guide{position:absolute;inset:56% 5% auto;z-index:40;pointer-events:none;text-align:center;color:white;text-shadow:0 2px 4px #001}.battle-movement-guide[hidden]{display:none}.battle-movement-guide span{display:block;width:46px;height:46px;margin:0 auto;animation:guide-swipe 1.6s ease-in-out infinite}.battle-movement-guide b{display:inline-flex;align-items:center;justify-content:center;min-width:220px;font-size:17px}@keyframes guide-swipe{0%,100%{transform:translateX(-35px)}50%{transform:translateX(35px)}}@media(prefers-reduced-motion:reduce){.battle-movement-guide span{animation:none}}';
  stage.append(style,hint);
  return {show(value:boolean){hint.hidden=!value;},destroy(){hint.remove();style.remove();}};
}
