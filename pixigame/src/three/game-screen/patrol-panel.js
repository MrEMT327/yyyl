import {createLobbyPanel} from './lobby-panel.js';
import {menuAircraft} from './menu-aircraft.js';
import {paintLobbyPaper} from './panel-paper.js';
import {paintItemDetail} from './item-details.js';
import {area,box,pic,words,clamp,titleFont} from './menu-art.js';
import {patrolClockState} from '../../ui/patrol-clock.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {aircraftUiImage} from '../../aircraft-ui-images.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';
import {patrolSceneHeight,patrolAircraftRect,paintPatrolScene,clockDigits,patrolNumbers as n,patrolItems,gridLayout,patrolGrid,patrolButton,quickPaper} from './patrol-art.js';

const rateNames={105:'装备图纸',801:'科研图纸',113:'普通箱券',112:'高级箱券'};
const rates=p=>p.native?(p.rateItems||[]).map(r=>({...r,itemId:r.id,name:rateNames[r.id]||r.name,image:nativeItemArt(r.artId||r.id)}))
  :['coins','weaponParts','aircraftShards'].map((id,i)=>({itemId:id,name:['金币','强化零件','飞机碎片'][i],perHour:p.perHour?.[id],image:RESOURCE_ICONS[id].url}));
function recover(s){
  const p=s.patrol;
  if(p.adPending)return {text:'广告已完成，奖励待保存',action:'quickPatrolAd',disabled:p.adBusy};
  if(s.pendingReward?.type==='patrol')return {text:s.pendingReward.unsaved?'广告已完成，奖励待保存':'奖励已记录，等待保存',action:'recoverDailyRewards',disabled:s.rewardBusy};
  if(s.rewardPending||s.rewardBusy)return {text:s.rewardPending?'已有奖励待保存':'奖励正在处理，请稍候',action:s.rewardPending?'recoverDailyRewards':null,disabled:s.rewardBusy};
  return null;
}
function recoveryHeight(message,w){return message?(message.action?75:27)+.03*w:0;}
function paintRecovery(a,t,w,b,row,p){
  if(!row)return;
  a.quad(b.x,b.y,b.w,recoveryHeight(row,w)-.01*w,'#f1d4c6');
  words(a,row.text,b.x+.02*w,b.y+15,13,{align:'left',color:'#7e3c2d'});
  if(row.action)patrolButton(a,t,w,box(b.x+.02*w,b.y+28,b.w-.04*w,44),'recover','重试保存',row.action,{revision:p.revision},Boolean(row.disabled),{zone:'base',size:14});
}
function rateGrid(a,t,w,x,y,bw,rows,locked){
  const cols=Math.max(1,Math.min(w<=(locked?325:300)?3:5,rows.length)),gap=locked?6:4,width=(bw-gap*(cols-1))/cols;
  const icon=locked?clamp(.08*w,24,36):clamp(.06*w,19,27),font=locked?clamp(.035*w,12,15):clamp(.026*w,9,12);
  const valueFont=locked?clamp(.036*w,13,17):clamp(.032*w,11,15);
  const rowH=locked?icon+8+font*1.3+valueFont*1.2:50+4+valueFont*1.2;
  const top=y+(locked?2:5);
  for(const [i,r] of rows.entries()){
    const sx=x+(i%cols)*(width+gap),sy=top+Math.floor(i/cols)*(rowH+gap),cx=sx+width/2;
    const iy=locked?sy:sy+(50-icon-3-font*1.25)/2;
    pic(a,t,r.image,box(cx-icon/2,iy,icon,icon),true);
    area(t,'rate-'+r.itemId,r.name,box(cx-icon/2,iy,icon,icon),'inspect',r,'base');
    words(a,r.name,cx,iy+icon+(locked?4:3)+font*.64,font,{color:'#303039',weight:500,maxWidth:width-3});
    const val=locked?'×0':n(r.displayAmount??r.perHour);
    const unit=locked||!r.id?'':r.displayPeriodHours?'/'+r.displayPeriodHours+'小时':'/小时';
    const actual=words(a,val,cx,sy+rowH-valueFont*.63,valueFont,{color:'#303039',weight:700});
    if(unit){const s=clamp(w*.024,9,12),small=words(a,unit,cx,actual.position.y+(valueFont-s)*.45,s,{color:'#303039',weight:500});
      actual.position.x-=(small.scale.x-4+.005*w)/2;small.position.x=actual.position.x+(actual.scale.x+small.scale.x-8)/2+.005*w;}
    if(!locked&&i%cols<cols-1)a.quad(sx+width-1,sy,1,rowH,'#7c95aa');
  }
  const lines=Math.ceil(rows.length/cols),height=(locked?6:14)+lines*rowH+Math.max(0,lines-1)*gap;
  if(!locked)a.quad(x,y+height-1,bw,1,'#7c95aa');return height;
}
function idle(data,w,h,t){
  const s=data.snapshot,p=s.patrol,locked=!p.unlocked,ratesList=rates(p),wPaper=w*696/750,bw=wPaper-80*w/750,x=(w-bw)/2;
  const a=t.layer('patrol-sheet').art,body=t.layer('patrol-body','base').art,foot=t.layer('patrol-footer').art;
  const heading=clamp(.04*w,16,17),headingH=heading*1.5,capFont=clamp(.035*w,12,15),footerH=1+6+capFont*1.3+6+48;
  const cols=w<=300?4:5,items=patrolItems(p.sampleBased?p.rewardRows:null,p.rewards),grid=gridLayout(items,bw,cols,6);
  const available=p.unlocked&&!p.clockRollback&&Object.values(p.rewards||{}).some(v=>v>0),pending=Boolean(s.rewardPending||s.rewardBusy||p.adBusy||p.adPending);
  const timingSize=clamp(.048*w,17,23),timeH=7+timingSize*1.4+4,noteSize=clamp(.028*w,10,12),noteH=5+noteSize*1.3+2,skyH=patrolSceneHeight(w);
  const clock=patrolClockState(p),bonus=p.researchBonus??(p.bonus||0)*100,rec=recover(s);
  const rateCols=Math.max(1,Math.min(w<=(locked?325:300)?3:5,ratesList.length)),lines=Math.ceil(ratesList.length/rateCols);
  const rateH=locked?6+lines*(clamp(.08*w,24,36)+8+clamp(.035*w,12,15)*1.3+clamp(.036*w,13,17)*1.2)+Math.max(0,lines-1)*6
    :14+lines*(54+clamp(.032*w,11,15)*1.2)+Math.max(0,lines-1)*4;
  const rewardsH=available&&!p.nativeSettlementPending?grid.height:Math.max(42,.12*w);
  const content=skyH+(locked?(ratesList.length?8+headingH+6+rateH:0):
    (p.nativeSettlementPending?0:timeH)+noteH+rateH+8+headingH+6+rewardsH+(p.development?48:0))+recoveryHeight(rec,w)+.02*w;
  const header=w/6,tail=52*w/750,ph=Math.min(h*.88,header+content+footerH+tail);
  const sheet=paintLobbyPaper(t,data,w,h,wPaper,ph,header,'巡逻收益',a);
  const top=sheet.top,footY=sheet.y+ph-tail-footerH;
  t.region('base',box(x,top,bw,Math.max(1,footY-top)),content,'y',{initial:data.initial});
  paintPatrolScene(body,t,data,w,x,top,bw);let y=top+skyH;
  if(!locked){
    if(!p.nativeSettlementPending){
      words(body,clock.label,x+2,y+7+timingSize*.7,clamp(.03*w,11,14),{align:'left',color:'#303039',weight:500});
      data.bindClock(clockDigits(body,x+bw-2,y+7+timingSize*.7,timingSize,clock));y+=timeH;
    }
    words(body,'收益速率'+(bonus?' · 科技加成 +'+n(bonus)+'%':''),w/2,y+5+noteSize*.65,noteSize,{color:'#65625b',weight:500});y+=noteH;
    y+=rateGrid(body,t,w,x,y,bw,ratesList,false);
  }
  if(!locked||ratesList.length){
    words(body,locked?'当前奖励':'累计奖励',x,y+8+headingH/2,heading,{align:'left',color:'#303039',family:titleFont});y+=8+headingH+6;
    if(locked)y+=rateGrid(body,t,w,x,y,bw,ratesList,true);
    else if(available&&!p.nativeSettlementPending){patrolGrid(body,t,items,w,x,y,grid,false);y+=grid.height;}
    else{words(body,p.nativeSettlementPending?'奖励暂不可领取':p.clockRollback?'设备日期异常，请恢复后领取':'奖励积累中',w/2,y+rewardsH/2,clamp(.03*w,11,14),{color:'#65625b',weight:500});y+=rewardsH;}
  }
  if(p.development&&!locked){patrolButton(body,t,w,box(x,y,bw,48),'sample','领取测试奖励','devPatrolSample',{revision:p.revision},pending,{zone:'base'});y+=48;}
  paintRecovery(body,t,w,box(x,y,bw,0),rec,p);
  foot.quad(x,footY,bw,1,'#7c95aa');
  const limit=(clock.status==='full'?'收益已满 · ':'')+'最长巡逻'+n(p.nativeSettlementPending?8:p.capHours||8)+'小时';
  words(foot,limit,w/2,footY+7+capFont*.65,capFont,{color:'#304b65'});
  const by=footY+footerH-48,buttonSize=clamp(.037*w,13,18);
  if(locked)patrolButton(foot,t,w,box(x,by,bw,48),'battle','前往战役','tab',{tab:'battle'},false,{size:buttonSize});
  else{const gap=.02*w,width=(bw-gap)/2;
    patrolButton(foot,t,w,box(x,by,width,48),'quick','快速巡逻','patrolQuick',{},pending,{size:buttonSize});
    patrolButton(foot,t,w,box(x+width+gap,by,width,48),'collect','领取','claimPatrol',{revision:p.revision},!available||pending,{size:buttonSize});}
}
function quick(data,w,h,t){
  const s=data.snapshot,p=s.patrol,width=.92*w,ph=Math.min(1.06*w,h*.9),paper=quickPaper(t,w,h,width,ph,'快速巡逻');
  const x=paper.x+40*w/750,bw=width-80*w/750,top=paper.top,body=t.layer('quick-body','base').art,foot=t.layer('quick-footer').art;
  const sMissing=!p.staminaUnlimited&&!s.wallet?.unlimited&&s.wallet?.stamina<p.quickStamina;
  const unavailable=!p.unlocked||p.native&&!p.quickUnlocked||p.clockRollback||p.nativeSettlementPending;
  const choiceReason=!p.unlocked&&!p.native?'通关第1章开启':p.native&&!p.quickUnlocked?p.quickLockReason:
    p.clockRollback?'设备日期异常':p.native&&!p.sampleBased?p.settlementReason:'';
  const adReason=choiceReason||(p.sampleBased&&!p.adAvailable||!p.native&&p.quickAdLeft&&!p.adAvailable?'广告暂未就绪':'');
  const fsize=14,reasonH=choiceReason||adReason?clamp(.028*w,10,14)*1.4+.015*w:0;
  const footerH=1+.03*w+fsize*1.4+.015*w+48+reasonH+.005*w,fy=paper.y+ph-52*w/750-footerH;
  const ix=x+.005*w,iw=bw-.01*w,lead=clamp(.038*w,13,19),large=clamp(.12*w,34,58),small=clamp(.045*w,16,23);
  let y=top+.01*w;
  words(body,'立即获得',w/2,y+lead*.7,lead,{color:'#304b65',weight:500});y+=lead*1.4;
  if(p.quickDurationKnown||!p.native){
    const amount=words(body,n(p.quickHours||2),w/2,y+large*.6,large,{color:'#172c40',weight:700});
    const label=words(body,'小时巡逻收益',w/2,y+large*.6+(large-small)*.40,small,{color:'#172c40',weight:700});
    amount.position.x-=(label.scale.x-4+.02*w)/2;label.position.x=amount.position.x+(amount.scale.x+label.scale.x-8)/2+.02*w;
  }else words(body,p.quickLabel||'大量巡逻收益',w/2,y+large*.6,large,{color:'#172c40',maxWidth:iw});
  y+=large*1.2+.03*w;const heading=clamp(.04*w,16,20);
  words(body,'快速巡逻收益',ix,y+heading*.75,heading,{family:titleFont,color:'#172c40',align:'left'});y+=heading*1.5+.03*w;
  const rows=patrolItems(p.sampleBased?p.quickRewardRows:p.native?(p.chapterKnown?p.previewItems:[]):null,p.quickRewards),grid=gridLayout(rows,iw,4,.02*w);
  if(rows.length){patrolGrid(body,t,rows,w,ix,y,grid,true);y+=grid.height;}
  else if(p.native&&!p.chapterKnown){words(body,'巡逻章节待确认',w/2,y+.135*w,14,{color:'#304b65'});y+=.27*w;}
  if(p.nativeSettlementPending){words(body,'奖励暂不可领取',w/2,y+12,14,{color:'#304b65'});y+=24;}
  if(p.adError){y+=.03*w;body.quad(ix,y,iw,30,'#f1d4c6');words(body,p.adError,ix+7,y+15,13,{align:'left',color:'#7e3c2d',maxWidth:iw-14});y+=30;}
  const notice=recover(s);paintRecovery(body,t,w,box(ix,y,iw,0),notice,p);y+=recoveryHeight(notice,w)+.03*w;
  t.region('base',box(x,top,bw,Math.max(1,fy-.02*w-top)),y-top,'y',{initial:data.initial});
  const gap=.02*w,half=(bw-gap)/2,by=fy+1+.03*w+fsize*1.4+.015*w;
  foot.quad(x,fy,bw,1,'#7c95aa');
  const pending=s.rewardPending||s.rewardBusy||p.adBusy||p.adPending;
  const options=[{id:'ad',x,why:adReason,remaining:p.quickAdLeft,limit:p.quickAdLimit,label:p.adBusy?'广告播放中':p.adError?'重试广告':'观看广告',icon:projectIconUrl('ad-play'),action:'quickPatrolAd',disabled:!p.quickAdLeft||!p.adAvailable},
    {id:'pay',x:x+half+gap,why:choiceReason,remaining:p.quickLeft,limit:p.quickLimit,label:n(p.quickStamina)+' 体力',icon:RESOURCE_ICONS.stamina.url,action:'quickPatrol',disabled:!p.quickLeft||sMissing}];
  for(const o of options){
    words(foot,'剩余 '+(o.remaining==null?'—':n(o.remaining))+' / '+(o.limit==null?'—':n(o.limit))+' 次',o.x+half/2,fy+1+.03*w+fsize*.7,fsize,{color:'#304b65',weight:500});
    patrolButton(foot,t,w,box(o.x,by,half,48),o.id,o.label,o.action,{revision:p.revision},Boolean(unavailable||pending||o.disabled),{icon:o.icon,short:o.id==='pay'&&sMissing});
    if(o.why)words(foot,o.why,o.x+half/2,by+48+.015*w+7,clamp(.028*w,10,14),{color:'#874232',maxWidth:half,wrap:true});
  }
}
function receipt(data,w,h,t){
  const width=567*w/750,ph=Math.min(714*w/750,.88*h),sheet=paintLobbyPaper(t,data,w,h,width,ph,w/6,data.modal.title||'获得奖励');
  const x=sheet.x+40*w/750,bw=width-80*w/750,total=ph-w/6-52*w/750,body=t.layer('patrol-result','base').art;
  const raw=data.modal.rewards||[],rows=raw.some(r=>r.nativeItemId)?patrolItems(raw):patrolItems(null,Object.fromEntries(raw.map(r=>[r.type,r.amount])));
  const grid=gridLayout(rows,bw,4,.02*w);patrolGrid(body,t,rows,w,x,sheet.top,grid,true);
  const y=sheet.top+Math.max(grid.height+.04*w,total-48),size=Math.min(160,bw);
  patrolButton(body,t,w,box((w-size)/2,y,size,48),'confirm','确定','close',{},false,{zone:'base'});
  t.region('base',box(x,sheet.top,bw,total),y+48-sheet.top);
}
export function openPatrolPanel(screen,host,send,kind,scrollPositions){
  let latest,inspect=null,preview=null,updateClock=null,closed=false;const entered=performance.now()/1000;
  const scrollKey=kind==='patrol'?'idle':'quick';
  const names={patrol:'巡逻收益',quickPatrol:'快速巡逻',patrolReceipt:'巡逻收益'};
  const panel=createLobbyPanel(screen,host,names[kind],(data,w,h,t)=>{
    updateClock=null;
    if(kind==='patrol')idle({...data,preview,bindClock:fn=>{updateClock=fn;fn(latest.clockTime);}},w,h,t);
    else if(kind==='quickPatrol')quick(data,w,h,t);else receipt(data,w,h,t);
    if(data.inspect){paintItemDetail(data,w,h,t);return 'inspect';}return 'base';
  },cmd=>{
    if(cmd.type==='inspect'){inspect=cmd.data;panel.scroll('inspect',0);refresh();return;}
    if(cmd.type==='close'&&inspect){inspect=null;refresh();return;}
    if(kind==='quickPatrol'&&cmd.type==='close'&&latest?.snapshot.patrol.adBusy)return;
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  },{overlay:kind==='patrolReceipt',onScroll(zone,value){if(zone==='base')scrollPositions?.set(scrollKey,value);}});
  function refresh(){if(!latest||closed)return;panel.update({...latest,entered,inspect,reduced:(screen.reducedMotion?.() ?? matchMedia('(prefers-reduced-motion: reduce)').matches)},
    [latest.signature,latest.modal.title,latest.modal.rewards&&JSON.stringify(latest.modal.rewards),preview?.ready,inspect?.itemId].join('|'),kind);}
  if(kind==='patrol'){
    const open=screen.openPatrolAircraft??((region,...args)=>menuAircraft(screen,region,...args));
    preview=open(host,panel,refresh,()=>screen.repaintHome?.(),()=>!closed&&screen.panel===panel&&!inspect,
      {profile:'patrol',rect:patrolAircraftRect});
  }
  return {host,close(){closed=true;preview?.close();panel.close();},tick(dt){preview?.tick(dt);},
    clock(p){const time=patrolClockState(p).time;if(updateClock&&time!==latest.clockTime){latest.clockTime=time;updateClock(time);screen.repaintHome?.();}},
    update(snapshot,modal,signature){
      const p=snapshot.patrol,stage=snapshot.stages?.find(r=>r.index===p.stageIndex);
      const route=!p.unlocked?(p.native?p.lockReason:'通关第1章开启巡逻'):p.native&&!p.chapterKnown?'巡逻章节待确认':'第'+n(p.stageIndex+1)+'章'+(stage?.name?' · '+stage.name:'');
      latest={snapshot,signature,modal,route:route||'巡逻未开启',aircraftStill:aircraftUiImage(snapshot.aircraftId||'pilot-01'),clockTime:patrolClockState(p).time,initial:scrollPositions?.get(scrollKey)||0};
      preview?.update(snapshot);refresh();
    }};
}
