import {area,box,pic} from './menu-art.js';
import {createLobbyPanel} from './lobby-panel.js';
import {collectionFeedback} from './feedback-collection.js';
import {mergeFeedback,mergeItem} from './feedback-merge.js';
import {hologram,pulse,pop,label,glyph,frameBox,groupMotion,outerFrame,heading,dismiss,countUp,submit} from './feedback-art.js';
import {paintItemDetail} from './item-details.js';

function progression(data,w,h,t){
  const row=data.record,level=row.type==='level',pw=.9*w,ph=Math.min(.85*w,.76*h),p=box((w-pw)/2,(h-ph)/2,pw,ph);
  const a=t.layer('progression').art,part=(b,draw,tr,outer)=>groupMotion(t,a,p,data,b,draw,tr,outer);
  area(t,'paper','',p,'none');
  part(p,()=>{
    outerFrame(a,t,p,w,'primary');
    if(level)label(a,'等级提升',p.x+.035*w,p.y+.051*w,.040*w,{
      align:'left',maxWidth:.165*w,color:'#fff',shadow:{color:'#73889e',y:1,blur:2},
    });
    else heading(a,t,p,w,'功能开启');
  });
  const b=frameBox(p,.28,.16,.44,.43),g=frameBox(b,-.30,-.25,1.60,1.50),icon={cx:w/2,cy:b.y+b.h*.5,delay:.2,duration:.7,frames:pop};
  part(g,()=>pic(a,t,hologram,g,true),{duration:2.8,loop:true,frames:pulse},[icon]);
  part(b,()=>pic(a,t,level?'/art/project-supplement-icons-v1/experience.png':'/art/project-talents-v1/patrol.webp',b,true),icon);
  if(level){
    const cy=p.y+ph*.62+w*.048;
    part(p,()=>{const l=label(a,'Lv.'+row.from,0,cy,.06*w,{color:'#517896'}),r=label(a,'Lv.'+row.to,0,cy,.08*w);
      const rw=r.scale.x-4,lw=l.scale.x-4,width=lw+rw+.12*w,x=(w-width)/2;r.visible=false;l.position.x=x+lw/2;
      glyph(a,t,'chevron-right',box(x+lw+.04*w,cy-.02*w,.04*w,.04*w));
      countUp(t,data,row.from,row.to,.85,.65,v=>label(a,'Lv.'+v,x+lw+.12*w+rw/2,cy,.08*w,{weight:700,color:'#fff1c4',shadow:{color:'#a77432',y:1,blur:3}}));});
  }else{
    part(p,()=>{label(a,row.name,w/2,p.y+.58*ph+.036*w,.06*w,{weight:700,color:'#fff3cf',shadow:{color:'#61768a',y:1,blur:2}});
      label(a,row.description,w/2,p.y+.69*ph+.023*w,.038*w,{color:'#234461',wrap:true,maxWidth:pw*.8});dismiss(a,t,p,w);});
  }
  const sh=Math.max(44,.10*w),btn=box(w*.32,p.y+ph*.94-sh,w*.36,sh);
  part(btn,()=>submit(a,t,btn,w,level?'确定':'前往',level?'close':'processFeatureGo'));
}
function layout(data,w,h,t){
  data={...data,w};const a=t.layer('process-room').art;
  t.backdrop(a,.70);area(t,'outside','关闭',t.frameRect,'close');
  const type=data.record.type;
  if(type==='collection')collectionFeedback(data,w,h,t);
  else if(type==='merge'||type==='mergeBatch')mergeFeedback(data,w,h,t);
  else progression(data,w,h,t);
  if(data.inspect){paintItemDetail(data,w,h,t);return 'inspect';}
  return 'base';
}
export function openProcessFeedback(screen,host,send,sound){
  const reduced=(screen.reducedMotion?.() ?? matchMedia('(prefers-reduced-motion: reduce)').matches);
  let latest,identity,inspect=null,entered;
  const panel=createLobbyPanel(screen,host,'成长结果',layout,cmd=>{
    if(cmd.type==='inspect'){inspect=mergeItem(latest.record.results[cmd.data.index].after);refresh();return;}
    if(cmd.type==='close'&&inspect){inspect=null;refresh();return;}
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  },{overlay:true});
  function refresh(){panel.update({...latest,entered,reduced,inspect},JSON.stringify([identity,inspect?.id]),identity);}
  return {host,close:panel.close,update(snapshot,modal){
    const index=modal.index||0,key=modal.id+'-'+index;
    if(key!==identity){identity=key;inspect=null;entered=performance.now()/1000;if(!reduced)sound?.('upgrade');}
    latest={snapshot,record:modal.records[index]};refresh();
  }};
}
