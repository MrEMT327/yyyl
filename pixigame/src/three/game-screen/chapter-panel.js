import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {area,box,button,pic,slice,words,titleFont,clamp} from './menu-art.js';
import {chapterDetailModel} from '../../ui/chapter-details.js';
import {paintRewardItemSlot} from '../../ui/reward-item-slot.js';
import {paintItemDetail} from './item-details.js';
import {nativeItemPresentation} from '../../replica/native-item-presentation.js';
import {pendingNotice,rewardPage,starPage} from './chapter-rewards.js';
import portraits from './chapter-art.json';

const titles={chapterDetails:'关卡详情',chapterChest:'通关奖励',chapterRewards:'通关奖励',chapterCoreRewards:'通关奖励',nativeStarRewards:'星级奖励'};
export function supportsChapterPanel(type,snapshot){
  return Object.hasOwn(titles,type);
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
    if(kind==='chapterDetails')details(data,w,h,t);
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
    panel.update({...latest,inspect,entered,reduced:matchMedia('(prefers-reduced-motion: reduce)').matches},
      [signature,id,latest.snapshot.nativeAcquisition?.revision,latest.snapshot.starRewards?.revision,Boolean(latest.snapshot.rewardBusy),Boolean(latest.snapshot.rewardPending),inspect?.itemId].join('|'),id);
  }
  return {host,close:panel.close,update(snapshot,modal,key){
    latest={snapshot,modal:{...modal},backdropAlpha:.55,coverNavigation:kind==='nativeStarRewards',safeBottom:parseFloat(getComputedStyle(host).paddingBottom)||0};
    signature=key;refresh();
  }};
}
