import './equipment-toolbar.css';
const base=`${import.meta.env?.BASE_URL??'/'}art/equipment-controls-v1/`;
const choices={
  sort:{label:'武器排序',items:[['quality','按品质'],['level','按等级'],['name','按名称']]},
  filter:{label:'筛选武器',items:[['owned','已拥有'],['equipped','已装备'],['available','可装备'],['all','全部武器'],['locked','未解锁']]},
};

export function equipmentToolbar({sort='quality',filter='owned',prefix='eq'}={},escape=String) {
  const control=(kind,value)=>{
    const {label,items}=choices[kind],selected=items.find(([id])=>id===value)||items[0],id=`${prefix}-${kind}-options`;
    return `<div class="eq-choice eq-choice-${kind}"><button type="button" class="eq-choice-trigger psd-button" data-equipment-select="${kind}" value="${selected[0]}" aria-label="${label}：${selected[1]}" aria-haspopup="listbox" aria-expanded="false" aria-controls="${escape(id)}"><span>${selected[1]}</span><img class="eq-choice-chevron" src="${base}chevron-down.svg" alt="" draggable="false"></button><div class="eq-choice-menu" id="${escape(id)}" role="listbox" aria-label="${label}" hidden>${items.map(([key,text])=>`<button type="button" class="eq-choice-option psd-option" role="option" data-equipment-option="${key}" aria-selected="${key===selected[0]}" tabindex="${key===selected[0]?'0':'-1'}"><span>${text}</span><img src="${base}check.svg" alt="" draggable="false"></button>`).join('')}</div></div>`;
  };
  return `<div class="eq-inventory-toolbar eq-toolbar-authored"><h2 id="eq-inventory-title" tabindex="-1">武器仓库</h2>${control('sort',sort)}${control('filter',filter)}<button class="eq-workshop-button psd-button" type="button" data-action="openWorkshop"><strong>改装间</strong></button></div>`;
}

// Keep the existing change/value contract, including equipment state and focus restoration.
export function bindEquipmentChoices(root) {
  const doc=root.ownerDocument,view=doc.defaultView;
  let active=null;
  const trigger=choice=>choice.querySelector('.eq-choice-trigger');
  const panel=choice=>choice.querySelector('.eq-choice-menu');
  const options=choice=>[...choice.querySelectorAll('.eq-choice-option:not(:disabled)')];
  function close(restore=false) {
    if(!active)return;
    const old=active;active=null;
    trigger(old).setAttribute('aria-expanded','false');panel(old).hidden=true;
    if(restore&&root.contains(old))trigger(old).focus({preventScroll:true});
  }
  function open(choice) {
    close();active=choice;
    trigger(choice).setAttribute('aria-expanded','true');
    const menu=panel(choice);menu.hidden=false;menu.dataset.side='below';menu.style.maxHeight='';
    const frame=root.getBoundingClientRect(),button=trigger(choice).getBoundingClientRect();
    const footer=root.querySelector('.pl-nav')?.getBoundingClientRect();
    const bottom=footer?.height?Math.min(frame.bottom,footer.top):frame.bottom;
    const below=Math.max(0,bottom-button.bottom-8),above=Math.max(0,button.top-frame.top-8);
    const up=menu.scrollHeight>below&&above>below;
    menu.dataset.side=up?'above':'below';menu.style.maxHeight=`${Math.min(264,up?above:below)}px`;
    if(!view.matchMedia('(prefers-reduced-motion: reduce)').matches){
      menu.getAnimations().forEach(a=>a.cancel());
      const animation=menu.animate([{opacity:0,translate:`0 ${up?5:-5}px`},{opacity:1,translate:'0 0'}],{duration:160,easing:'cubic-bezier(.16,1,.3,1)'});
      animation.id='ui-dropdown';
    }
  }
  function select(option) {
    const choice=option.closest('.eq-choice'),button=trigger(choice);
    close();button.value=option.dataset.equipmentOption;
    button.dispatchEvent(new view.Event('change',{bubbles:true}));
  }
  function click(event) {
    if(root.classList.contains('is-busy'))return;
    const button=event.target.closest('.eq-choice-trigger');
    if(button&&root.contains(button)&&!button.disabled){const choice=button.closest('.eq-choice');if(choice===active)close();else open(choice);return;}
    const option=event.target.closest('.eq-choice-option');
    if(option&&root.contains(option)&&!option.disabled)select(option);
  }
  function keydown(event) {
    const choice=event.target.closest('.eq-choice');
    if(!choice||!root.contains(choice))return;
    if(event.key==='Escape'&&active){event.preventDefault();event.stopPropagation();close(true);return;}
    if(event.key==='Tab'&&active){close(true);return;}
    const option=event.target.closest('.eq-choice-option');
    if(['ArrowDown','ArrowUp','Home','End'].includes(event.key)) {
      event.preventDefault();event.stopPropagation();
      if(active!==choice)open(choice);
      const list=options(choice),current=list.indexOf(option);
      const next=event.key==='Home'?0:event.key==='End'?list.length-1:current<0?Math.max(0,list.findIndex(node=>node.getAttribute('aria-selected')==='true')):(current+(event.key==='ArrowDown'?1:-1)+list.length)%list.length;
      list[next]?.focus({preventScroll:true});list[next]?.scrollIntoView({block:'nearest'});
    }else if(option&&['Enter',' '].includes(event.key)){event.preventDefault();event.stopPropagation();select(option);}
  }
  const outside=event=>{if(active&&!active.contains(event.target))close();};
  const scroll=event=>{if(active&&!active.hasAttribute('data-choice-inline')&&event.target!==panel(active)&&!panel(active).contains(event.target))close();};
  const resize=()=>close();
  root.addEventListener('click',click);root.addEventListener('keydown',keydown);
  root.addEventListener('scroll',scroll,true);doc.addEventListener('pointerdown',outside,true);doc.addEventListener('focusin',outside);
  view.addEventListener('resize',resize);
  return ()=>{close();root.removeEventListener('click',click);root.removeEventListener('keydown',keydown);root.removeEventListener('scroll',scroll,true);doc.removeEventListener('pointerdown',outside,true);doc.removeEventListener('focusin',outside);view.removeEventListener('resize',resize);};
}
