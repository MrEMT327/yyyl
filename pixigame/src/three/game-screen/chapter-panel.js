import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {area,box,button,pic,slice,words,titleFont,clamp,guideMascot,qualityFrame} from './menu-art.js';
import {homePictures} from './home-stage.js';
import {homeArtOffset,homeInsets} from './home-navigation.js';
import {chapterDetailModel} from '../../ui/chapter-detail-model.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {paintItemDetail} from './item-details.js';
import {nativeItemPresentation} from '../../replica/native-item-presentation.js';
import {pendingNotice,rewardPage,starPage} from './chapter-rewards.js';
import portraits from './chapter-art.json';
import homeArt from './home-art.json';

const [,startFile,startBounds]=homePictures.find(([id])=>id==='start');
const titles={firstSortie:'首战引导',chapterDetails:'关卡详情',chapterChest:'通关奖励',chapterRewards:'通关奖励',chapterCoreRewards:'通关奖励',nativeStarRewards:'星级奖励'};
export function supportsChapterPanel(type,snapshot){
  return Object.hasOwn(titles,type);
}

function firstSortie(data,t){
  const a=t.layer('first-sortie').art,frame=t.frameRect;
  const [x,y,w,h]=startBounds,sx=frame.w/750,sy=frame.h/1624;
  const insets=homeInsets({width:frame.w,height:frame.h,safeTop:t.viewport?.safeTop,safeBottom:data.safeBottom});
  const start=box(frame.x+x*sx,frame.y+(y+homeArtOffset('start',insets))*sy,w*sx,h*sy);
  const cx=start.x+start.w/2,padding=4;
  const ring=box(start.x-padding,start.y-padding,start.w+2*padding,start.h+2*padding);
  t.backdrop(a,.6,'#020b13');
  if(!pic(a,t,'/art/psd-main-v1/'+startFile,start).visible){
    a.quad(start.x,start.y,start.w,start.h,'#b35c1f');
    words(a,'开始 ×5',cx,start.y+start.h/2,18,{family:titleFont});
  }
  if(!slice(a,t,qualityFrame(4),ring,6,18,{fill:false}).visible){
    const {x,y,w,h}=ring;
    a.line([[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]],'#ffd971',1,2);
  }

  const side=Math.min(frame.w*.24,100),cue=box(cx-16,ring.y-29,32,24);
  const captionW=114,captionH=56,gap=4;
  const left=cx-(side+gap+captionW)/2,centerY=cue.y-5-side/2;
  const caption=box(left+side+gap,centerY-captionH/2,captionW,captionH);
  const plate=slice(a,t,'/art/onboarding-dialogue-v2/panel.webp',caption,18,64);
  guideMascot(t,a,box(left,centerY-side/2,side,side),data.reduced);
  words(a,'第一关',caption.x+caption.w/2,centerY,16,{color:plate.visible?'#233b53':'#fff'});
  pic(a,t,homeArt.pointer,cue,true);
  area(t,'start','进入第一关，消耗体力×5',start,'start');
}

function details(data,w,h,t){
  const {stage,title,enemies,drops}=chapterDetailModel(data.snapshot,data.modal.stageIndex);
  const width=w*.9,height=Math.min(w*1.30,h*.88),header=w/6;
  const p=paintLobbyPaper(t,data,w,h,width,height,header,title);
  const left=p.x+40*w/750,bw=width-80*w/750,innerH=height-header-52*w/750;
  const body=t.layer('chapter','base').art,saveH=pendingNotice(data.snapshot,body,t,w,left,p.top,bw,'base');
  const headingSize=.044*w,headingH=headingSize*1.5,gap=.03*w,trayY=p.top+saveH+.02*w+headingH+gap;
  const cardW=.23*w,cardH=.329*w,trayH=cardH+.03*w,dropY=trayY+trayH+gap+headingH+gap;
  const side=.136*w,dropGap=.025*w,dropLine=side+.012*w+.028*w*1.3;
  const cols=Math.max(1,Math.floor((bw-.06*w+dropGap)/(side+dropGap)));
  const lines=Math.ceil(drops.length/cols),dropH=Math.max(.25*w,.08*w+lines*dropLine+Math.max(0,lines-1)*dropGap);
  const bH=Math.max(48,Math.min(56,w*.111)),bW=clamp(w*.4,160,210);
  const footTop=Math.max(dropY+dropH+gap+.03*w,p.top+innerH-bH);
  t.region('base',box(left,p.top,bw,innerH),footTop+bH-p.top);
  words(body,'本关敌人',w/2,trayY-gap-headingH/2,headingSize,{family:titleFont,color:'#19394c'});
  words(body,'关卡掉落',w/2,dropY-gap-headingH/2,headingSize,{family:titleFont,color:'#19394c'});
  slice(body,t,'/art/chapter-details-tray-v1/tray.png',box(left,dropY,bw,dropH),9,64);
  drops.forEach(({id,firstClear},i)=>{
    const x=left+.03*w+(i%cols)*(side+dropGap),y=dropY+.04*w+Math.floor(i/cols)*(dropLine+dropGap);
    const item=nativeItemPresentation(id);
    paintRewardItemSlot(body,{...item,showQuantity:false},{x,y,size:side},t.image);
    words(body,firstClear?'首通奖励':'金币',x+side/2,y+side+.012*w+.028*w*.65,.028*w,{weight:400,color:'#edf7ff'});
    area(t,'drop-'+i,item.name,box(x,y,side,side),'inspect',{itemId:id},'base');
  });
  const b=box((w-bW)/2,footTop,bW,bH),locked=stage.unlocked===false,label=locked?'未解锁':'开始';
  button(body,t,b,{title:label,gold:true,disabled:locked,titleSize:clamp(w*.054,18,22)});
  area(t,'chapter-start',label,b,'chapterDetailsStart',{stageIndex:data.modal.stageIndex},'base',locked);
  t.region('enemies',box(left,trayY,bw,trayH),enemies.length*(cardW+.02*w)+.01*w,'x',{parent:'base'});
  const cards=t.layer('enemy-cards','enemies').art;
  for(const [i,e] of enemies.entries()){
    const x=left+i*(cardW+.02*w)-.0015*w,y=trayY+.01*w;
    pic(cards,t,portraits.card,box(x,y,cardW,cardH));
    pic(cards,t,portraits[e.modelId],box(x+.011*w,y+.013*w,cardW-.022*w,.239*w),true);
    words(cards,e.name,x+cardW/2,y+.29*w,.0305*w,{color:'#243e52',weight:700,maxWidth:cardW-.02*w});
  }
}

export function openChapterPanel(screen,host,send,kind){
  let latest,signature,inspect=null;
  const entered=performance.now()/1000;
  const panel=createLobbyPanel(screen,host,titles[kind],(data,w,h,t)=>{
    if(kind==='firstSortie')firstSortie(data,t);
    else if(kind==='chapterDetails')details(data,w,h,t);
    else if(kind==='nativeStarRewards'||kind==='chapterChest'&&!data.snapshot.nativeAcquisition)starPage(data,w,h,t);
    else rewardPage(data,w,h,t);
    if(data.inspect){paintItemDetail(data,w,h,t);return 'inspect';}
    return 'base';
  },command=>{
    if(command.type==='inspect'){inspect=command.data;refresh();return;}
    if(command.type==='close'&&inspect){inspect=null;refresh();return;}
    if(command.type!=='none')send(command.type,command.data||{},host);
  });
  function refresh(){
    const id=kind+'|'+(latest.modal.stageIndex??'');
    panel.update({...latest,inspect,entered,reduced:(screen.reducedMotion?.() ?? matchMedia('(prefers-reduced-motion: reduce)').matches)},
      [signature,id,latest.snapshot.nativeAcquisition?.revision,latest.snapshot.starRewards?.revision,Boolean(latest.snapshot.rewardBusy),Boolean(latest.snapshot.rewardPending),inspect?.itemId].join('|'),id);
  }
  return {host,close:panel.close,update(snapshot,modal,key){
    latest={snapshot,modal:{...modal},backdropAlpha:.55,safeBottom:screen.safeBottom?.() ?? (parseFloat(getComputedStyle(host).paddingBottom)||0)};
    signature=key;refresh();
    if(kind==='firstSortie')panel.prepare();
  }};
}
