import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {area,box,clamp,pic,words} from './menu-art.js';
import {paintItemDetail} from './item-details.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {rewardDisplayQuality} from '../../replica/item-display-quality.js';
import {taskDisplayOrder} from '../../ui/task-display-order.js';
import art from './receipt-art.json';
import {projectIconUrl} from '../../ui/project-ui-art.js';
import {carnivalTaskList,taskMedal,taskTab} from './task-list.js';

const ink='#213c50',badge='/art/project-notification-dot-v1/red-dot.png';
const claimRevision=activity=>({expectedRevision:activity.revision,expectedInventoryRevision:activity.inventoryRevision,
  expectedEquipmentRevision:activity.equipmentRevision});
function timer(activity,time){
  if(activity.expired||time>=activity.expiresAt)return '活动已结束';
  if(activity.clockRollback)return '请恢复设备时间';
  const minutes=Math.ceil((activity.expiresAt-time)/60000);
  const clock=[Math.floor(minutes/60)%24,minutes%60].map(n=>String(n).padStart(2,'0')).join(':');
  return `剩余 ${Math.floor(minutes/1440)}天 ${clock}`;
}
function paintRewards(a,t,{activity,countdown,unavailable,blocked},x,y,width,u){
  const {points,maxPoints,milestones}=activity;
  const bannerH=68*u,textX=x+12*u,artW=Math.min(134*u,width*.4),artX=x+width-artW-8*u;
  a.quad(x,y,width,bannerH,'#678da6');
  a.quad(x+1,y+1,width-2,bannerH-2,'#213b54');
  a.quad(x+1,y+bannerH-3*u,width-2,2*u,'#4e8ba6');
  const featured=milestones.at(-1)?.rewards[0];
  if(featured?.image)pic(a,t,featured.image,box(artX,y+4*u,artW,bannerH-8*u),true);
  const maxWidth=artX-textX-4*u;
  words(a,'完成每日任务积累活跃',textX,y+21*u,Math.max(10,13*u),
    {align:'left',color:'#eaf3fa',maxWidth});
  words(a,countdown,textX,y+48*u,Math.max(11,15*u),
    {align:'left',color:unavailable?'#ffc4a6':'#a7edff',maxWidth,weight:800});

  const rackY=y+bannerH+6*u,left=x+4*u,cell=(width-8*u)/(milestones.length+1);
  const side=Math.min(cell-5*u,39*u),iconY=rackY+7*u,trackY=iconY+side+7*u;
  const pointsX=left+cell/2,trackW=cell*milestones.length,rackEnd=trackY+21*u;
  a.quad(x,rackY,width,rackEnd-rackY,'#678da6');
  a.quad(x+1,rackY+1,width-2,rackEnd-rackY-2,'#183147');
  a.quad(pointsX,trackY-2*u,trackW,4*u,'#091d2e');
  const progress=clamp(points/Math.max(1,maxPoints),0,1);
  if(progress>0)a.quad(pointsX,trackY-2*u,trackW*progress,4*u,'#5ad5ed');

  const medal=Math.min(side,30*u);
  pic(a,t,taskMedal,box(pointsX-medal/2,iconY+(side-medal)/2,medal,medal),true);
  a.quad(left+3*u,trackY+4*u,cell-6*u,14*u,'#2f5469');
  words(a,points,pointsX,trackY+11*u,Math.max(10,13*u),
    {color:'#b8f3ff',weight:800,maxWidth:cell-7*u});

  const revisions=claimRevision(activity);
  for(const [i,row] of milestones.entries()){
    const tileX=left+(i+1)*cell,cx=tileX+cell/2,reward=row.rewards[0];
    const icon=box(cx-side/2,iconY,side,side),ready=row.canClaim&&!row.claimed&&!blocked;
    if(ready)a.quad(icon.x-2*u,icon.y-2*u,side+4*u,side+4*u,'#f1cf70');
    paintRewardItemSlot(a,{...reward,...rewardDisplayQuality(reward)},{x:icon.x,y:icon.y,size:side},t.image);
    if(ready)pic(a,t,badge,box(icon.x+side-7*u,icon.y-3*u,9*u,9*u),true);
    if(row.claimed)pic(a,t,projectIconUrl('check'),box(icon.x+side-15*u,icon.y+2*u,13*u,13*u),true);
    const reached=points>=row.points;
    a.quad(cx-2*u,trackY-2*u,4*u,4*u,reached?'#83e8f8':'#658096');
    words(a,row.points,cx,trackY+11*u,Math.max(10,12*u),
      {weight:800,color:ready?'#ffe1a1':reached?'#c6eff9':'#cedde8',maxWidth:cell-2*u});
    const status=row.claimed?'已领取':ready?'可领取':'查看奖励';
    const claim=ready?{...revisions,kind:'milestone',id:row.points}:{id:row.points};
    area(t,'milestone-reward-'+row.points,row.points+'活跃，'+reward.name+'，'+status,
      box(tileX,iconY-3*u,cell,rackEnd-iconY+3*u),ready?'carnivalClaim':'inspectMilestone',claim,null,row.claimed);
  }
  return rackEnd;
}

function paint(data,w,h,t){
  const {activity:s,modal}=data,ph=Math.min(h-18,w*1.55),pw=w*.94,u=Math.min(w/390,h/550),
    header=clamp(64*u,41,67),p=paintLobbyPaper(t,{paperFace:art.taskFace},w,h,pw,ph,header,'七日嘉年华');
  if(!s||ph<=0)return;
  const a=p.a,x=p.x+18*u,r=p.x+pw-18*u,iw=r-x;
  const day=s.days.find(row=>row.day===modal.day&&row.unlocked)??s.days[s.day-1];
  const unavailable=s.expired||s.clockRollback||data.time>=s.expiresAt,blocked=data.blocked||unavailable;
  const payload=claimRevision(s);
  const rewardsEnd=paintRewards(a,t,{activity:s,countdown:data.countdown,unavailable,blocked},x,p.top,iw,u);
  const listY=rewardsEnd+9*u,listEnd=p.y+ph-20*u,viewH=Math.max(1,listEnd-listY);
  const tabW=Math.min(iw*.21,64*u),tabH=Math.min(42*u,(viewH-6*3*u)/7),tabGap=3*u;
  if(tabH<12)return;
  for(const [i,row] of s.days.entries()){
    const b=box(x,listY+i*(tabH+tabGap),tabW,tabH),selectedDay=row.day===day.day;
    const dayLabel=`第${row.day}天`,locked=!row.unlocked;
    taskTab(a,t,b,dayLabel,selectedDay,Math.max(10,12*u),locked);
    if(locked){
      const size=Math.min(17*u,b.h*.48);
      pic(a,t,projectIconUrl('lock'),box(b.x+b.w-size+2*u,b.y-2*u,size,size),true);
    }else if(!blocked&&row.tasks.some(task=>task.canClaim)){
      pic(a,t,badge,box(x+tabW-11*u,b.y+3*u,8*u,8*u),true);
    }
    area(t,'day-'+row.day,dayLabel+(locked?'，未解锁':''),b,'carnivalDay',{id:row.day},null,locked);
  }
  const listX=x+tabW+10*u;
  const rows=taskDisplayOrder(day.tasks).map(task=>{
    const complete=task.progress>=task.target,ready=task.canClaim&&!blocked;
    const label=task.claimed?'已领取':!day.unlocked?'待开启':unavailable?'已关闭':complete?(ready?'领取':'待保存'):'前往';
    return {...task,points:s.taskPoints,ready,label,
      disabled:task.claimed||!day.unlocked||blocked||complete&&!ready,
      action:complete?'carnivalClaim':'carnivalGo',
      payload:complete?{...payload,kind:'task',id:task.id}:{id:task.id}};
  });
  carnivalTaskList(data.snapshot,rows,s.taskReward,w,t,box(listX,listY,r-listX,viewH),'carnival-tasks-'+day.day);
}

export function openCarnivalPanel(screen,host,send,options){
  let data,key,inspect=null,revision=0;
  const panel=createLobbyPanel(screen,host,'七日嘉年华',(next,w,h,t)=>{
    paint(next,w,h,t);
    const row=next.activity?.milestones.find(entry=>entry.points===next.inspect);
    if(!row?.rewards[0])return 'base';
    const reward=row.rewards[0],{name,image,qualityRank,qualityName,qualityKnown}=reward;
    // Describe the random equipment reward.
    const detail=row.reward.kind==='equipment'
      ?{name,image,qualityRank,qualityName,qualityKnown,description:row.reward.rank===1
        ?'领取时随机获得一件史诗圣环装备。':'领取时随机获得一件史诗装备。'}
      :reward;
    paintItemDetail({...next,inspect:detail},w,h,t);
    return 'inspect';
  },cmd=>{
    if(cmd.type==='inspectMilestone'){
      const row=data.activity?.milestones.find(entry=>entry.points===cmd.data.id);
      if(!row?.rewards[0])return;
      inspect=row.points;
      panel.scroll('inspect',0);
      refresh();return;
    }
    if(cmd.type==='close'&&inspect!==null){inspect=null;refresh();return;}
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  },options);
  const refresh=()=>panel.update({...data,inspect},++revision,'carnival');
  return {host,close:panel.close,prepareOffscreen:panel.prepareOffscreen,activate:panel.activate,update(snapshot,modal,signature){
    const activity=snapshot.carnival,time=activity?.observedAt,countdown=activity?timer(activity,time):'';
    const next=[signature,activity?.day,modal.day,countdown].join('|');
    if(key===next)return;
    key=next;data={snapshot,activity,modal,time,countdown,blocked:snapshot.rewardBusy||snapshot.rewardPending};refresh();
  },activityClock(time){
    if(!data?.activity)return;
    const next=timer(data.activity,time);
    if(next===data.countdown)return;
    data={...data,time,countdown:next};refresh();
  }};
}
