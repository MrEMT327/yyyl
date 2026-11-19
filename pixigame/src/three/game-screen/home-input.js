import {createButtonPressMotion} from '../../ui/button-press-motion.js';
import {homePictures} from './home-stage.js';
import {navBounds} from './home-navigation.js';

const commands=[
  ['profile','查看名片','playerInfo'],['chapter-prev','上一章','chapterPrev'],
  ['chapter-title','查看当前关卡详情','chapterDetails'],['chapter-next','下一章','chapterNext'],
  ['tasks','查看航线任务','tasks'],['affection','好感度','pilotAffection'],
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
  const unit=750/viewport.width,safe=(viewport.safeBottom||0)*1624/viewport.height;
  const boxes=new Map(artBounds);
  boxes.set('chapter-title',[172,143,413,70]);boxes.set('affection',[6,338,101,99]);
  for(const id of ['stamina','coins','diamonds'])boxes.set(id,artBounds.get(id+'-background'));
  ['shop','assembly','battle','research','supply'].forEach((id,i)=>boxes.set('nav-'+id,navBounds(i,safe)));
  const width=Math.max(105,44*unit);
  boxes.set('developer',[736.5-width,470.96,width,Math.max(67.5,38*unit)]);
  boxes.set('portrait',portrait);
  return commands.filter(([id])=>id!=='developer'||state.developer).map(([id,label,action,data])=>
    ({id,label,box:boxes.get(id),action,data:id==='portrait'?{characterPortrait:state.pilotId}:data||{}}));
}
export function bindHomeInput(canvas,{controls,enabled,guide,activate,scale,focus}){
  let held=null,focusId=null,clickTarget=null;
  const events=new AbortController(),opts={signal:events.signal};
  const motion=createButtonPressMotion(scale,()=>enabled());
  const allowed=()=>{const g=guide();return controls().filter(c=>!g?.strong||c.id===g.id);};
  function hit(e){
    const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.x)*750/rect.width,y=(e.clientY-rect.y)*1624/rect.height;
    return allowed().find(({box:[a,b,w,h]})=>x>=a&&x<a+w&&y>=b&&y<b+h);
  }
  const reset=()=>{if(held)motion.release(held.control.id);held=null;};
  canvas.addEventListener('pointerdown',e=>{
    if(!enabled()||e.button>0||held)return;
    const control=hit(e);if(!control)return;
    clickTarget=null;held={control,pointer:e.pointerId,x:e.clientX,y:e.clientY,moved:false};
    focusId=control.id;focus(null);canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);
    motion.start(control.id);e.preventDefault();
  },opts);
  canvas.addEventListener('pointermove',e=>{
    if(held?.pointer!==e.pointerId)return;
    if(Math.hypot(e.clientX-held.x,e.clientY-held.y)>10){held.moved=true;motion.release(held.control.id);}
  },opts);
  canvas.addEventListener('pointerup',e=>{
    if(held?.pointer!==e.pointerId)return;const {control,moved}=held;reset();
    if(enabled()&&!moved&&hit(e)?.id===control.id)clickTarget=control;
  },opts);
  // Opening a dialog on pointerup can retarget the trailing touch click to
  // its backdrop. Commit the command on the originating canvas's click.
  canvas.addEventListener('click',e=>{
    const control=clickTarget;clickTarget=null;
    if(control&&enabled()){e.stopPropagation();activate(control);}
  },opts);
  canvas.addEventListener('lostpointercapture',reset,opts);canvas.addEventListener('pointercancel',reset,opts);
  canvas.addEventListener('blur',()=>{reset();focus(null);},opts);
  canvas.addEventListener('keydown',e=>{
    if(!enabled()||e.metaKey||e.altKey||e.ctrlKey)return;
    const list=allowed(),index=list.findIndex(c=>c.id===focusId);if(!list.length)return;
    if(e.key==='Enter'||e.key===' '){e.preventDefault();if(!e.repeat)activate(list[Math.max(index,0)]);return;}
    if(!['Tab','ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;
    const backward=e.shiftKey||e.key==='ArrowLeft'||e.key==='ArrowUp';
    const i=e.key==='Home'?0:e.key==='End'?list.length-1:(index+(backward?-1:1)+list.length)%list.length;
    e.preventDefault();const selected=list[i];focusId=selected.id;focus(selected.box);
    canvas.setAttribute('aria-label','少女航线，'+selected.label);
  },opts);
  return ()=>{events.abort();motion.clear();};
}

