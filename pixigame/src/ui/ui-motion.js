import {UI_MOTION as T,UI_EASE,QUALITY_LIGHT,uiActionPlan} from './ui-motion-plan.js';
import {enterSurface} from './surface-motion.js';
import './ui-motion.css';

// One owner per lobby. No mutation observer, game-clock dependency, or animation
// completion callback that mutates inventory. Re-rendering is not an event.
export function createUiMotion(root) {
  const doc=root.ownerDocument,view=doc.defaultView,media=view.matchMedia('(prefers-reduced-motion: reduce)');
  const motions=new Set(),effects=new Set(),frames=new Set();
  let route=null,modalKey='',menuOpen=false,press=null,epoch=0,disposed=false;
  const layer=doc.createElement('div');layer.className='ui-fx-layer';layer.setAttribute('aria-hidden','true');root.append(layer);
  root.classList.add('ui-motion-active');
  const quiet=()=>disposed||media.matches||doc.hidden||root.hidden||!root.isConnected;
  const animate=(node,keys,options={},name='accent')=>{
    if(!node?.isConnected||quiet())return null;
    node.getAnimations?.().filter(a=>a.id===`ui-${name}`).forEach(a=>a.cancel());
    const a=node.animate(keys,{duration:T.dialog,easing:UI_EASE,...options});a.id=`ui-${name}`;motions.add(a);
    a.finished.then(()=>motions.delete(a),()=>motions.delete(a));return a;
  };
  const later=fn=>{const version=epoch;const id=view.requestAnimationFrame(()=>{frames.delete(id);if(version===epoch&&!quiet())fn();});frames.add(id);};
  function discard(node){node.getAnimations({subtree:true}).forEach(a=>a.cancel());node.remove();effects.delete(node);}
  function effect(cls,rect,color='#9ceaff') {
    while(effects.size>=T.maxEffects)discard(effects.values().next().value);
    const bounds=root.getBoundingClientRect(),node=doc.createElement('span');node.className=cls;
    node.style.cssText=`left:${rect.left-bounds.left}px;top:${rect.top-bounds.top}px;width:${rect.width}px;height:${rect.height}px;--fx-color:${color}`;
    layer.append(node);effects.add(node);return node;
  }
  function transient(node,keys,options,name){const a=animate(node,keys,options,name);if(!a){discard(node);return;}a.finished.then(()=>discard(node),()=>discard(node));}
  function flash(target,{color='#9ceaff',major=false,rank=4,delay=0}={}) {
    if(quiet()||!target?.isConnected)return;
    const rect=target.getBoundingClientRect();if(!rect.width||!rect.height)return;
    // Repeated upgrades replace the previous accent at this slot, rather than
    // stacking light rings until the whole card is obscured.
    const key=target.dataset.id||`${target.className}:${Math.round(rect.left)}:${Math.round(rect.top)}`;
    for(const n of [...effects])if(n.dataset.accentTarget===key)discard(n);
    const ring=effect('ui-fx-ring',rect,color);
    ring.dataset.accentTarget=key;
    transient(ring,[{opacity:0,scale:'.98'},{opacity:.85,scale:'1',offset:.25},{opacity:0,scale:major?'1.1':'1.035'}],{duration:major?640:360,delay,fill:'backwards'},'ring');
    if(!major)return;
    const sweep=effect('ui-fx-sweep',rect,color),beam=doc.createElement('i');sweep.append(beam);
    sweep.dataset.accentTarget=key;
    transient(sweep,[{opacity:0},{opacity:.7,offset:.25},{opacity:0}],{duration:560,delay,fill:'backwards'},'sweep');
    animate(beam,[{translate:'-35% 0'},{translate:'35% 0'}],{duration:560,delay,fill:'backwards'},'beam');
    const sparkCount=rank>=3?8:4;
    for(let i=0;i<sparkCount;i++){
      const angle=(i+.5)*Math.PI*2/sparkCount,distance=Math.min(60,rect.width*.55+12);
      const spark=effect('ui-fx-spark',{left:rect.left+rect.width/2-2,top:rect.top+rect.height/2-5,width:4,height:10},color);
      spark.dataset.accentTarget=key;
      transient(spark,[{opacity:0,translate:'0 0',rotate:`${i*45}deg`},{opacity:1,offset:.15},{opacity:0,translate:`${Math.cos(angle)*distance}px ${Math.sin(angle)*distance}px`,rotate:`${i*45+30}deg`}],{duration:620,delay,fill:'backwards'},'spark');
    }
  }
  function clear(){epoch++;press?.animation?.cancel();press=null;for(const id of frames)view.cancelAnimationFrame(id);frames.clear();for(const a of motions)a.cancel();motions.clear();for(const n of [...effects])discard(n);}
  const control=e=>e.target.closest?.('button,[role="tab"],[role="menuitemradio"]');
  const stopControlFeedback=node=>node.getAnimations?.().filter(a=>['ui-press','ui-release','ui-keyboard'].includes(a.id)).forEach(a=>a.cancel());
  function down(e){const node=control(e);if(e.button!==0||!node||node.disabled||quiet()||root.getAttribute('aria-busy')==='true')return;
    press?.animation?.cancel();stopControlFeedback(node);press={node,id:e.pointerId,x:e.clientX,y:e.clientY};
    press.animation=animate(node,[{filter:'brightness(1)'},{filter:'brightness(.84)'}],{duration:T.press,fill:'forwards',easing:'ease-out'},'press');
  }
  function release(e,cancel=false){if(!press||e.pointerId!==press.id)return;const {node,animation}=press;press=null;animation?.cancel();
    if(!cancel&&node.isConnected&&!node.disabled)animate(node,[{filter:'brightness(.84)'},{filter:'brightness(1)'}],{duration:T.release},'release');
  }
  const move=e=>{if(press&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>8)release(e,true);};
  const up=e=>release(e),cancel=e=>release(e,true);
  function clicked(e){const node=control(e);if(!node||node.disabled||quiet())return;
    if(e.detail===0){stopControlFeedback(node);animate(node,[{filter:'brightness(.84)'},{filter:'brightness(1)'}],{duration:T.release},'keyboard');}
    const data={...node.dataset},action=data.action;
    if(!['gearMaterial','pickSlot','catalogSelect','workshopSelect','fleetSkillSlot','recruitPreview','workshopFilterSet'].includes(action))return;
    later(()=>{const target=[...root.querySelectorAll(`[data-action="${action}"]`)].find(n=>['id','slot','kind'].every(k=>!data[k]||n.dataset[k]===data[k]));if(target)flash(target);});
  }
  root.addEventListener('pointerdown',down,{capture:true,passive:true});root.addEventListener('click',clicked,true);
  view.addEventListener('pointermove',move,{passive:true});view.addEventListener('pointerup',up,{passive:true});view.addEventListener('pointercancel',cancel,{passive:true});
  const visibility=()=>{if(doc.hidden)clear();};doc.addEventListener('visibilitychange',visibility);view.addEventListener('blur',clear);view.addEventListener('resize',clear);media.addEventListener('change',clear);
  return {
    page(key,body) {
      const menu=body.querySelector('.fc-filter-options');
      if(menu&&!menuOpen)animate(menu,[{opacity:0},{opacity:1}],{duration:160},'dropdown');
      menuOpen=Boolean(menu);
      if(route===key)return;const previous=route;route=key;clear();
      if(previous!==null&&!quiet()){
        for(const a of enterSurface(body)){motions.add(a);a.finished.then(()=>motions.delete(a),()=>motions.delete(a));}
      }
    },
    modal(key) {
      if(key===modalKey)return;modalKey=key;if(!key||quiet())return;
      const host=root.querySelector('.pl-modal-host'),dialog=[...host.querySelectorAll('[role="dialog"]')].at(-1);
      if(!dialog||host.querySelector('.draw-stage'))return;
      // All dialogs enter on their final pixel grid. Text, frames and hit areas
      // share one fade instead of competing scale/translation/detail animations.
      animate(dialog,[{opacity:0},{opacity:1}],{},'dialog');
    },
    capture() {
      return [...root.querySelectorAll('.ag-card.is-selected[data-action="gearMaterial"],.workshop-cost [data-cost-resource]')].slice(0,4).map(node=>({rect:node.getBoundingClientRect(),src:node.querySelector('img')?.src}));
    },
    complete(action,result,before,after,payload,materials=[]) {
      const plan=uiActionPlan(action,result,before,after,payload);if(!plan)return;
      later(()=>{
        if(action==='gearSupply'){
          const cards=[...root.querySelectorAll('.sn-results>.sn-result,.ag-draw-results>.ag-card')].slice(0,10);
          cards.forEach((node,i)=>{
            animate(node,[{opacity:0},{opacity:1}],{duration:320,delay:i*55,fill:'backwards'},'box-reveal');
            const rank=Number(node.dataset.psdQuality??after.equipment?.items.find(x=>x.uid===node.dataset.id)?.qualityRank)||0;
            if(rank>=3)flash(node,{color:QUALITY_LIGHT[rank]||QUALITY_LIGHT[0],delay:160+i*55});
          });return;
        }
        const find=(selector)=>[...root.querySelectorAll(selector)].find(n=>!plan.id||n.dataset.id===plan.id);
        const target=plan.gear?find('.ag-detail-head .ag-card')||find('.ag-mount')||root.querySelector('.ag-modal .ag-card')
          :action.startsWith('fleet')?root.querySelector('.fc-operation-portrait,.fc-hero-actions,.fc-skill-group')
          :action==='equipWeapon'||action==='unequipWeapon'?find('.wc-item[data-id]')||root.querySelector('.ag-weapon')
          :root.querySelector('.workshop-scene-slot:not(.is-result),.equipment-weapon-detail__preview,.fc-hero-actions');
        if(!target)return;
        const end=target.getBoundingClientRect();let delay=0;
        if(plan.major&&materials.length){materials.filter(m=>m.src).forEach((m,i)=>{
          const n=effect('ui-fx-flight',{left:end.left+end.width/2-18,top:end.top+end.height/2-18,width:36,height:36});
          const img=doc.createElement('img');img.src=m.src;img.alt='';img.style.cssText='width:100%;height:100%;object-fit:contain';n.append(img);
          transient(n,[{translate:`${m.rect.left+m.rect.width/2-end.left-end.width/2}px ${m.rect.top+m.rect.height/2-end.top-end.height/2}px`,scale:'1',opacity:.9},{translate:'0 0',scale:'.4',opacity:0}],{duration:360,delay:i*40,fill:'backwards'},'material');
        });delay=360;}
        flash(target,{...plan,delay});
        animate(target,[{filter:'brightness(1)'},{filter:plan.major?'brightness(1.2)':'brightness(1.12)',offset:.4},{filter:'brightness(1)'}],{duration:360,delay},'success');
      });
    },
    clear,
    destroy(){clear();disposed=true;layer.remove();root.classList.remove('ui-motion-active');root.removeEventListener('pointerdown',down,true);root.removeEventListener('click',clicked,true);view.removeEventListener('pointermove',move);view.removeEventListener('pointerup',up);view.removeEventListener('pointercancel',cancel);view.removeEventListener('blur',clear);view.removeEventListener('resize',clear);doc.removeEventListener('visibilitychange',visibility);media.removeEventListener('change',clear);},
  };
}
