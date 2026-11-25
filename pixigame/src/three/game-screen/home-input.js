import {createButtonPressMotion} from '../../ui/button-press-motion.js';
import {homePictures} from './home-stage.js';
import {PILOT_AFFECTION_VISIBLE} from '../../peripheral/pilot-affection.js';
import {homeArtOffset,homeInsets,navBounds,carnivalEntryBox,affectionY} from './home-navigation.js';

const commands=[
  ['profile','查看名片','playerInfo'],['chapter-prev','上一章','chapterPrev'],
  ['chapter-title','查看当前关卡详情','chapterDetails'],['chapter-next','下一章','chapterNext'],
  ['tasks','查看航线任务','tasks'],['carnival','七日嘉年华','carnival'],
  ...(PILOT_AFFECTION_VISIBLE?[['affection','好感度','pilotAffection']]:[]),
  ['star-rewards','查看章节奖励','chapterChest'],['switch-pilot','切换驾驶员','catalog',{kind:'pilot'}],
  ['patrol','航线巡逻','patrol'],['backpack','打开背包','backpack'],['start','开始战役，消耗体力×5','start'],
  ['stamina','体力','stamina'],['coins','金币','shopSection',{section:'resources'}],['diamonds','钻石','shopSection',{section:'supply'}],
  ['developer','打开开发工具','debug'],
  ...[['shop','商城'],['assembly','装备'],['battle','战役'],['research','天赋'],['supply','招募']]
    .map(([tab,label])=>['nav-'+tab,label,'tab',{tab}]),
  ['portrait','驾驶员互动','portraitFeedback']
];
const artBounds=new Map(homePictures.map(([id,,art,hit=art])=>[id,hit]));
export function homeControls(state,viewport,portrait){
  const unit=750/viewport.width,layout=homeInsets(viewport);
  const boxes=new Map(artBounds);
  boxes.set('chapter-title',[172,143,413,70]);
  if(PILOT_AFFECTION_VISIBLE)boxes.set('affection',[6,affectionY(state.carnival),101,99]);
  if(state.carnival)boxes.set('carnival',carnivalEntryBox);
  for(const id of ['stamina','coins','diamonds'])boxes.set(id,artBounds.get(id+'-background'));
  const width=Math.max(105,44*unit);
  boxes.set('developer',[736.5-width,470.96,width,Math.max(67.5,38*unit)]);
  for(const [id,[x,y,w,h]] of boxes)boxes.set(id,[x,y+homeArtOffset(id,layout),w,h]);
  ['shop','assembly','battle','research','supply'].forEach((id,i)=>boxes.set('nav-'+id,navBounds(i,layout)));
  boxes.set('portrait',portrait);
  return commands.filter(([id])=>boxes.has(id)&&(id!=='developer'||state.developer)).map(([id,label,action,data])=>
    ({id,label,box:boxes.get(id),action,data:id==='portrait'?{characterPortrait:state.pilotId}:data||{}}));
}
// Shared command hit testing and press animation in the lobby's design coordinates.
export function createHomePointer({bounds,controls,enabled,guide,scale,immediateTabs=false},clock){
  let held=null;
  const motion=createButtonPressMotion(scale,enabled,clock);
  const allowed=()=>{const g=guide();return controls().filter(c=>!g?.strong||c.id===g.id);};
  function hit(x,y){
    const r=bounds();if(!r?.width||!r.height)return;
    const a=(x-r.x)*750/r.width,b=(y-r.y)*1624/r.height;
    return allowed().find(({box:[left,top,w,h]})=>a>=left&&a<left+w&&b>=top&&b<top+h);
  }
  function release(){
    if(held.immediate)scale(held.control.id,1);else motion.release(held.control.id);
  }
  function reset(){if(held&&!held.moved)release();held=null;}
  return {allowed,
    start(x,y,pointer){
      if(!enabled()||held)return;
      const control=hit(x,y);if(!control)return;
      const immediate=immediateTabs&&control.action==='tab';
      held={control,pointer,x,y,moved:false,immediate};
      if(immediate)scale(control.id,.94);else motion.start(control.id);
      return control;
    },
    move(x,y,pointer){
      if(held?.pointer!==pointer)return;
      if(!held.moved&&Math.hypot(x-held.x,y-held.y)>10){held.moved=true;release();}
    },
    end(x,y,pointer){
      if(held?.pointer!==pointer)return;
      const {control,moved}=held;reset();
      if(enabled()&&!moved&&hit(x,y)?.id===control.id)return control;
    },
    reset,
    close(){reset();motion.clear();},
  };
}

export function bindHomeInput(canvas,{controls,enabled,guide,activate,scale,focus}){
  let focusId=null,clickTarget=null;
  const events=new AbortController(),opts={signal:events.signal};
  const pointer=createHomePointer({bounds:()=>canvas.getBoundingClientRect(),controls,enabled,guide,scale});
  canvas.addEventListener('pointerdown',e=>{
    if(e.button>0)return;
    const control=pointer.start(e.clientX,e.clientY,e.pointerId);if(!control)return;
    clickTarget=null;focusId=control.id;focus(null);canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
  },opts);
  canvas.addEventListener('pointermove',e=>pointer.move(e.clientX,e.clientY,e.pointerId),opts);
  canvas.addEventListener('pointerup',e=>{const target=pointer.end(e.clientX,e.clientY,e.pointerId);if(target)clickTarget=target;},opts);
  // Browser taps commit on click: the panel backdrop must not receive the opening tap.
  canvas.addEventListener('click',e=>{
    const control=clickTarget;clickTarget=null;
    if(control&&enabled()){e.stopPropagation();activate(control);}
  },opts);
  canvas.addEventListener('lostpointercapture',pointer.reset,opts);canvas.addEventListener('pointercancel',pointer.reset,opts);
  canvas.addEventListener('blur',()=>{pointer.reset();focus(null);},opts);
  canvas.addEventListener('keydown',e=>{
    if(!enabled()||e.metaKey||e.altKey||e.ctrlKey)return;
    const list=pointer.allowed(),index=list.findIndex(c=>c.id===focusId);if(!list.length)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)activate(list[Math.max(index,0)]);return;}
    if(!['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const backward=e.shiftKey||e.key==='ArrowLeft'||e.key==='ArrowUp';
    const i=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(backward?-1:1)+list.length)%list.length;
    e.preventDefault();const selected=list[i];focusId=selected.id;focus(selected.box);
    canvas.setAttribute('aria-label','少女航线，'+selected.label);
  },opts);
  return ()=>{events.abort();pointer.close();};
}
