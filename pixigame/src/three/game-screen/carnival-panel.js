import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {area,box,clamp,pic,words} from './menu-art.js';
import {paintItemDetail} from './item-details.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {rewardDisplayQuality} from '../../replica/item-display-quality.js';
import {taskDisplayOrder} from '../../ui/task-display-order.js';
import art from './receipt-art.json';
import {projectIconUrl} from '../../ui/project-ui-art.js';
import {taskButton,taskList,taskMedal,taskPlate,taskProgress,taskTab} from './task-list.js';

const ink='#213c50',badge='/art/project-notification-dot-v1/red-dot.png';
function timer(activity,time){
  if(activity.clockRollback&&!activity.expired)return '请恢复设备时间';
  if(activity.expired||time>=activity.expiresAt)return '活动已结束';
  const minutes=Math.ceil((activity.expiresAt-time)/60000);
  const clock=[Math.floor(minutes/60)%24,minutes%60].map(n=>String(n).padStart(2,'0')).join(':');
  return `剩余 ${Math.floor(minutes/1440)}天 ${clock}`;
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
  taskPlate(a,box(x,top,iw,34*u));
  label(w<350?'每日解锁 · 活跃领奖':'每日解锁任务，累积活跃领装备',x+8*u,top+17*u,11,{align:'left',maxWidth:iw*.58});
  label(data.countdown,r-8*u,top+17*u,11,{align:'right',maxWidth:iw*.48,color:unavailable?'#974d46':ink});
  pic(a,t,taskMedal,box(x+4*u,top+42*u,15*u,16*u),true);
  label('嘉年华活跃',x+23*u,top+50*u,12,{align:'left'});
  taskProgress(a,box(x+4*u,top+61*u,iw-8*u,Math.max(13,16*u)),w,{progress:s.points,target:s.maxPoints});
  const rowY=top+84*u,cell=iw/7,side=Math.min(cell-6*u,39*u),selectH=side+25*u;
  for(const [i,row] of s.milestones.entries()){
    const left=x+i*cell,b=box(left,rowY,cell,selectH),reward=row.rewards[0];
    if(row===selected)taskPlate(a,box(left+1,rowY-3*u,cell-2,selectH+6*u),true,row.claimed);
    const icon=box(left+(cell-side)/2,rowY+2*u,side,side);
    slot(a,t,reward,icon.x,icon.y,side);
    if(row.canClaim&&!blocked)pic(a,t,badge,box(left+cell-13*u,rowY,9*u,9*u),true);
    if(row.claimed)pic(a,t,projectIconUrl('check'),box(left+cell-16*u,rowY,13*u,13*u),true);
    label(row.points,left+cell/2,rowY+side+15*u,12,{weight:700});
    area(t,'milestone-'+row.points,`${row.points}活跃：${reward.name}${row.claimed?'，已领取':row.canClaim?'，可领取':''}`,b,'carnivalMilestone',{id:row.points});
    area(t,'milestone-reward-'+row.points,reward.name,icon,'inspectMilestone',{id:row.points});
  }
  const previewY=rowY+selectH+10*u,previewH=Math.max(48,52*u),claimW=clamp(75*u,60,80),ready=selected.canClaim&&!blocked;
  taskPlate(a,box(x,previewY,iw,previewH),ready,selected.claimed);
  label(`${selected.points} 活跃奖励`,x+9*u,previewY+previewH/2,13,{align:'left',weight:800,maxWidth:iw-claimW-24*u});
  const claim=box(r-claimW-9*u,previewY+(previewH-44)/2,claimW,44);
  const claimText=selected.claimed?'已领取':ready?'领取':selected.canClaim?'待保存':'未达成';
  taskButton(a,t,w,claim,{label:claimText,disabled:!ready});
  area(t,'claim-milestone',claimText,claim,'carnivalClaim',{...payload,kind:'milestone',id:selected.points},null,!ready);

  const listY=previewY+previewH+10*u,listEnd=p.y+ph-20*u,viewH=Math.max(1,listEnd-listY);
  const tabW=Math.min(iw*.21,64*u),tabH=Math.min(42*u,(viewH-6*3*u)/7),tabGap=3*u;
  if(tabH<12)return;
  for(const [i,row] of s.days.entries()){
    const b=box(x,listY+i*(tabH+tabGap),tabW,tabH),selectedDay=row.day===day.day;
    const dayLabel=`第${row.day}天`;
    taskTab(a,t,b,dayLabel,selectedDay,Math.max(10,12*u),!row.unlocked);
    if(row.unlocked&&!blocked&&row.tasks.some(task=>task.canClaim))
      pic(a,t,badge,box(x+tabW-11*u,b.y+3*u,8*u,8*u),true);
    area(t,'day-'+row.day,`${dayLabel}${row.unlocked?'':'，待开启'}`,b,'carnivalDay',{id:row.day});
  }
  const listX=x+tabW+10*u,rewards=[s.taskReward];
  const rows=taskDisplayOrder(day.tasks).map(task=>{
    const complete=task.progress>=task.target,ready=task.canClaim&&!blocked;
    const label=task.claimed?'已领取':!day.unlocked?'待开启':unavailable?'已关闭':complete?(ready?'领取':'待保存'):'前往';
    return {...task,points:s.taskPoints,rewards,ready,label,
      disabled:task.claimed||!day.unlocked||blocked||complete&&!ready,
      action:complete?'carnivalClaim':'carnivalGo',
      payload:complete?{...payload,kind:'task',id:task.id}:{id:task.id}};
  });
  taskList(data.snapshot,rows,w,t,box(listX,listY,r-listX,viewH),'carnival-tasks-'+day.day);
}

export function openCarnivalPanel(screen,host,send,options){
  let data,key,inspect=null,revision=0;
  const panel=createLobbyPanel(screen,host,'七日嘉年华',(next,w,h,t)=>{
    paint(next,w,h,t);
    if(next.inspect){paintItemDetail(next,w,h,t);return 'inspect';}
    return 'base';
  },cmd=>{
    if(cmd.type==='inspectMilestone'){
      const row=data.activity?.milestones.find(entry=>entry.points===cmd.data.id);
      const reward=row?.rewards[0];
      if(!reward)return;
      // Equipment milestones grant a random item. Their preview IDs are not inventory items.
      const {name,image,qualityRank,qualityName,qualityKnown}=reward;
      inspect=row.reward.kind==='equipment'
        ?{name,image,qualityRank,qualityName,qualityKnown,description:row.reward.rank===1
          ?'领取时随机获得一件史诗圣环装备。':'领取时随机获得一件史诗装备。'}
        :reward;
      panel.scroll('inspect',0);
      if(data.modal.milestone!==row.points)send('carnivalMilestone',{id:row.points},host);
      refresh();return;
    }
    if(cmd.type==='close'&&inspect){inspect=null;refresh();return;}
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  },options);
  const refresh=()=>panel.update({...data,inspect},++revision,'carnival');
  return {host,close:panel.close,prepareOffscreen:panel.prepareOffscreen,activate:panel.activate,update(snapshot,modal,signature){
    const activity=snapshot.carnival,countdown=activity?timer(activity,activity.observedAt):'';
    const next=[signature,activity?.day,modal.day,modal.milestone,countdown].join('|');
    if(key===next)return;
    key=next;data={snapshot,activity,modal,countdown,blocked:snapshot.rewardBusy||snapshot.rewardPending};refresh();
  },activityClock(time){
    if(!data?.activity)return;
    const next=timer(data.activity,time);
    if(next===data.countdown)return;
    data={...data,countdown:next};refresh();
  }};
}
