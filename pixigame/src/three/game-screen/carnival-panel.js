import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {area,box,button,clamp,fmt,pic,slice,titleFont,words} from './menu-art.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {rewardDisplayQuality} from '../../replica/item-display-quality.js';
import {taskDisplayOrder} from '../../ui/task-display-order.js';
import art from './receipt-art.json';
import {carnivalMedal} from './carnival-art.js';

const ink='#213c50',muted='#526e83',tabBlue='/art/psd-page-chrome-v1/chapter-face.png',
  tabIdle='/art/psd-page-chrome-v1/chapter-idle.png',badge='/art/project-notification-dot-v1/red-dot.png';
function timer(activity,time){
  if(activity.clockRollback&&!activity.expired)return '请恢复设备时间';
  if(activity.expired||time>=activity.expiresAt)return '活动已结束';
  const minutes=Math.ceil((activity.expiresAt-time)/60000);
  const clock=[Math.floor(minutes/60)%24,minutes%60].map(n=>String(n).padStart(2,'0')).join(':');
  return `剩余 ${Math.floor(minutes/1440)}天 ${clock}`;
}
function progress(a,x,y,w,h,rate){
  a.quad(x,y,w,h,'#566d80');a.quad(x+1,y+1,w-2,h-2,'#263e51');
  const fill=Math.max(0,Math.min(1,rate))*(w-2);
  if(fill>0)a.quad(x+1,y+1,fill,h-2,'#6bbed7');
}
function slot(a,t,reward,x,y,size){
  paintRewardItemSlot(a,{...reward,...rewardDisplayQuality(reward)},{x,y,size},t.image);
}
function paint(data,w,h,t){
  const {activity:s,modal}=data,ph=Math.min(h-18,w*1.55),pw=w*.94,u=Math.min(w/390,h/550),
    header=clamp(64*u,41,67),p=paintLobbyPaper(t,{paperFace:art.taskFace},w,h,pw,ph,header,'七日嘉年华');
  if(!s||ph<=0)return;
  const a=p.a,x=p.x+18*u,r=p.x+pw-18*u,iw=r-x,top=p.top;
  const day=s.days.find(row=>row.day===modal.day)??s.days[s.day-1];
  const selected=s.milestones.find(row=>row.points===modal.milestone)??s.milestones.at(-1);
  const unavailable=s.expired||s.clockRollback,blocked=data.blocked||unavailable;
  const payload={expectedRevision:s.revision,expectedInventoryRevision:s.inventoryRevision,expectedEquipmentRevision:s.equipmentRevision};
  const label=(value,px,py,size,opts={})=>words(a,value,px,py,Math.max(10,size*u),{color:ink,...opts});
  a.quad(x,top,iw,34*u,'#dbe7ee');a.quad(x,top+33*u,iw,1,'#7a96a9');
  label(w<350?'每日解锁 · 活跃领奖':'每日解锁任务，累积活跃领装备',x+8*u,top+17*u,11,{align:'left',maxWidth:iw*.58});
  label(data.countdown,r-8*u,top+17*u,11,{align:'right',maxWidth:iw*.48,color:unavailable?'#974d46':ink});
  label('嘉年华活跃',x+4*u,top+57*u,12,{align:'left'});
  label(`${fmt(s.points)} / ${s.maxPoints}`,r-4*u,top+57*u,15,{align:'right',weight:800});
  progress(a,x+4*u,top+69*u,iw-8*u,5*u,s.points/s.maxPoints);
  const rowY=top+84*u,cell=iw/7,side=Math.min(cell-6*u,39*u),selectH=side+25*u;
  for(const [i,row] of s.milestones.entries()){
    const left=x+i*cell,b=box(left,rowY,cell,selectH),reward=row.rewards[0];
    if(row===selected)a.panel(left+1,rowY-3*u,cell-2,selectH+6*u,{cut:0,fill:'#97b4c5',stroke:'#518aa6',opacity:.95});
    slot(a,t,reward,left+(cell-side)/2,rowY+2*u,side);
    if(row.canClaim&&!blocked)pic(a,t,badge,box(left+cell-13*u,rowY,9*u,9*u),true);
    if(row.claimed)label('✓',left+cell-9*u,rowY+9*u,13,{color:'#caffeb',outline:'#204751'});
    label(row.points,left+cell/2,rowY+side+15*u,12,{weight:700});
    area(t,'milestone-'+row.points,`${row.points}活跃：${reward.name}${row.claimed?'，已领取':row.canClaim?'，可领取':''}`,b,'carnivalMilestone',{id:row.points});
  }
  const previewY=rowY+selectH+10*u,previewH=66*u,claimW=60*u;
  const preview=selected.rewards[0],showGear=selected.reward.kind==='equipment';
  a.panel(x,previewY,iw,previewH,{cut:0,fill:'#c4d6e1',stroke:'#7898ad',opacity:1});
  label(`${selected.points} 活跃奖励`,x+9*u,previewY+16*u,13,{align:'left',weight:800});
  label(`${preview.name} ×${fmt(preview.amount)}`,x+9*u,previewY+36*u,12,{align:'left',maxWidth:iw-claimW-24*u});
  if(showGear)label('领取后直接存入装备仓库',x+9*u,previewY+53*u,10,{align:'left',color:muted,maxWidth:iw-claimW-24*u});
  const claim=box(r-claimW-9*u,previewY+(previewH-44)/2,claimW,44),ready=selected.canClaim&&!blocked;
  const claimText=selected.claimed?'已领取':ready?'领取':selected.canClaim?'待保存':'未达成';
  button(a,t,claim,{title:claimText,gold:ready,disabled:!ready,titleSize:Math.max(11,13*u)});
  area(t,'claim-milestone',claimText,claim,'carnivalClaim',{...payload,kind:'milestone',id:selected.points},null,!ready);

  const listY=previewY+previewH+10*u,listEnd=p.y+ph-20*u,viewH=Math.max(1,listEnd-listY);
  const tabW=Math.min(iw*.21,64*u),tabH=Math.min(42*u,(viewH-6*3*u)/7),tabGap=3*u;
  if(tabH<12)return;
  for(const [i,row] of s.days.entries()){
    const b=box(x,listY+i*(tabH+tabGap),tabW,tabH),selectedDay=row.day===day.day;
    const skin=slice(a,t,selectedDay?tabBlue:tabIdle,b,Math.min(8*u,tabH/3));
    if(!row.unlocked){skin.material.color.set('#a3b8c9');skin.material.opacity=.65;}
    if(selectedDay)a.quad(b.x+tabW*.18,b.y+tabH-4*u,tabW*.64,2*u,'#7de4f4');
    label(`第${row.day}天`,x+tabW/2,b.y+tabH*(row.unlocked?.53:.41),12,{color:selectedDay?'#effaff':'#b8cee0',family:titleFont});
    if(!row.unlocked&&tabH>25)label('待开启',x+tabW/2,b.y+tabH*.76,9,{color:'#d4e2e9'});
    if(row.unlocked&&!blocked&&row.tasks.some(task=>task.canClaim))
      pic(a,t,badge,box(x+tabW-11*u,b.y+3*u,8*u,8*u),true);
    area(t,'day-'+row.day,`第${row.day}天${row.unlocked?'':'，待开启'}`,b,'carnivalDay',{id:row.day});
  }
  const listX=x+tabW+10*u,listW=r-listX,zone='carnival-tasks-'+day.day,rows=taskDisplayOrder(day.tasks);
  const cards=t.layer('carnival-list',zone).art,rh=94*u,step=rh+8*u;
  t.region(zone,box(listX,listY,listW,viewH),rows.length*step-8*u,'y',{parent:'base'});
  for(const [i,task] of rows.entries()){
    const py=listY+i*step,px=listX+8*u,bw=listW-16*u,complete=task.progress>=task.target;
    cards.panel(listX,py,listW,rh,{cut:0,fill:task.claimed?'#bdcdd8':'#d8e5ec',stroke:'#90a9ba',opacity:1});
    words(cards,task.name,px,py+18*u,Math.max(11,14*u),{align:'left',color:ink,maxWidth:bw,weight:700});
    progress(cards,px,py+37*u,bw,6*u,task.progress/task.target);
    words(cards,`${fmt(task.progress)} / ${fmt(task.target)}`,listX+listW/2,py+40*u,Math.max(10,10*u),
      {color:'#f2f9ff',outline:'#152a39'});
    const side=29*u,ry=py+54*u;
    slot(cards,t,s.taskReward,px,ry,side);
    pic(cards,t,carnivalMedal,box(px+side+8*u,ry+6*u,14*u,15*u),true);
    words(cards,`+${s.taskPoints} 活跃`,px+side+25*u,ry+side/2,Math.max(10,11*u),{align:'left',color:ink});
    const go=box(r-60*u-8*u,py+rh-45*u,60*u,Math.min(44,43*u));
    const ready=task.canClaim&&!blocked;
    const disabled=task.claimed||!day.unlocked||unavailable||complete&&!ready||data.blocked;
    const text=task.claimed?'已领取':!day.unlocked?'待开启':unavailable?'已关闭':complete?(ready?'领取':'待保存'):'前往';
    button(cards,t,go,{title:text,gold:ready,disabled,titleSize:Math.max(11,13*u)});
    area(t,'task-'+task.id,`${text}：${task.name}`,go,complete?'carnivalClaim':'carnivalGo',
      complete?{...payload,kind:'task',id:task.id}:{id:task.id},zone,disabled);
  }
}

export function openCarnivalPanel(screen,host,send,options){
  let data,key,revision=0;
  const panel=createLobbyPanel(screen,host,'七日嘉年华',paint,cmd=>{
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  },options);
  const refresh=()=>panel.update(data,++revision,'carnival');
  return {host,close:panel.close,prepareOffscreen:panel.prepareOffscreen,activate:panel.activate,update(snapshot,modal,signature){
    const activity=snapshot.carnival,countdown=activity?timer(activity,activity.observedAt):'';
    const next=[signature,modal.day,modal.milestone,countdown].join('|');
    if(key===next)return;
    key=next;data={activity,modal,countdown,blocked:snapshot.rewardBusy||snapshot.rewardPending};refresh();
  },activityClock(time){
    if(!data?.activity)return;
    const next=timer(data.activity,time);
    if(next===data.countdown)return;
    data={...data,countdown:next};refresh();
  }};
}
