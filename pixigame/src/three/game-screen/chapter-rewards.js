import {area,box,pic,resourceBar,slice,words,titleFont,clamp} from './menu-art.js';
import {paintLobbyPaper} from './panel-paper.js';
import {chapterRewardEntries,selectedChapterReward,condition,milestone} from '../../ui/chapter-rewards-panel.js';
import {nativeItemPresentation} from '../../replica/native-item-presentation.js';
import {rewardDisplayQuality} from '../../replica/item-display-quality.js';
import {paintRewardItemSlot} from '../../ui/reward-item-slot.js';
import {easing as progress} from './ui-motion.js';

const star='/art/project-ui-icons-v1/star.png',tray='/art/chapter-details-tray-v1/tray.png';
function slot(a,t,item,x,y,size,id,zone,draw=true){
  const row={...nativeItemPresentation(item.id),...rewardDisplayQuality({nativeItemId:item.id}),amount:item.count};
  if(draw){
    paintRewardItemSlot(a,row,{x,y,size},t.image);
    if(!row.image)words(a,item.name||'道具',x+size/2,y+size/2,10,{maxWidth:size*.8,wrap:true,lineHeight:12});
  }
  area(t,id,row.name||item.name||'道具',box(x,y,size,size),'inspect',{itemId:item.id},zone);
}
function claim(t,a,b,title,enabled,font){
  const mesh=slice(a,t,'/art/project-action-buttons-v1/task-claim.png',b,10);
  if(!enabled){
    mesh.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#include <map_fragment>\nfloat gray=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(diffuseColor.rgb,vec3(gray),.94)*.45;');};
  }
  words(a,title,b.x+b.w/2,b.y+b.h/2,font,{family:titleFont,color:enabled?'#edf4f7':'#c2c7ca'});
}
export function pendingNotice(s,a,t,w,x,y,width,zone){
  if(!s.rewardPending&&!s.rewardBusy)return 0;
  words(a,s.rewardPending?'已有奖励待保存':'奖励正在处理，请稍候',x+5,y+19,12,{align:'left',color:'#7c4729'});
  if(s.rewardPending){
    const b=box(x+width-88,y,88,38);
    slice(a,t,'/art/psd-buttons-v1/button-blue.png',b,8);
    words(a,'重试保存',b.x+44,y+19,13,{family:titleFont});
    area(t,'save-retry','重试保存',b,'recoverDailyRewards',{},zone,Boolean(s.rewardBusy));
  }
  return 42;
}
const easeOut=[0,0,.58,1],nodeEase=[.18,.8,.3,1];
// Each entrance uses the authored CSS timing curve, pivot and delay.
function animate(t,meshes,data,steps){
  if(data.reduced||!meshes.length)return;
  const end=Math.max(...steps.map(s=>s.delay+s.duration));
  if(performance.now()/1000-data.entered>=end)return;
  const original=meshes.map(m=>[m,m.position.x,m.position.y,m.scale.x,m.scale.y,m.material.opacity]);
  t.animate(now=>{
    const time=now-data.entered,frames=steps.map(s=>({...s,p:progress((time-s.delay)/s.duration,...(s.ease||easeOut))}));
    for(const [m,x,y,sx,sy,opacity] of original){
      let px=x,py=y,k=1,alpha=1;
      for(const s of frames){const f=1-(1-(s.fromScale??1))*(1-s.p);
        px=s.cx+(px-s.cx)*f;py=s.cy+(py-s.cy)*f+s.fromY*(1-s.p);k*=f;alpha*=s.p;}
      m.position.set(px,py,m.position.z);m.scale.set(sx*k,sy*k,m.scale.z);m.material.opacity=opacity*alpha;
    }
    if(time>=end)return false;
  });
}

export function rewardPage(data,w,h,t){
  const s=data.snapshot,acq=s.nativeAcquisition,entries=chapterRewardEntries(acq),selected=selectedChapterReward(entries);
  const root=t.layer('reward-scene').art,bgH=Math.max(h*1.30,w*2.817),bgW=bgH*852/1846;
  pic(root,t,'/art/chapter-reward-scene-v2/background.png',box((w-bgW)/2,0,bgW,bgH));
  const headerH=.29*w,bottomH=clamp(.15*w,58,70),bodyH=h-headerH-bottomH;
  const top=t.layer('chapter-reward-heading').art;resourceBar(t,top,s,w);
  const bannerY=.015*w+36+(w<=350 ? .06 : .09)*w,bannerH=Math.max(1,headerH-.015*w-36);
  const titleStart=top.group.children.length,banner=pic(top,t,'/art/psd-choice-v1/banner.png',box(0,bannerY,w,bannerH));
  const visible=bannerH/(w*239/756),uv=banner.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setY(i,.5+(uv.getY(i)-.5)*visible);
  words(top,'通关奖励',w/2,bannerY+bannerH/2,clamp(w*.057,21,26),{family:titleFont,shadow:{color:'#102232',y:1,blur:2}});
  animate(t,top.group.children.slice(titleStart),data,[{cx:w/2,cy:bannerY,fromY:-8,delay:0,duration:.35}]);
  const a=t.layer('chapter-reward-list','base').art,footer=t.layer('chapter-return').art;
  const back=box(.03*w,h-bottomH+(bottomH-Math.max(3,data.safeBottom)-44)/2,48,44);
  const faceH=clamp(.093*w,38,42);
  slice(footer,t,'/art/project-return-button-v1/face.png',box(back.x,back.y+(44-faceH)/2,48,faceH),8);
  const chevron=pic(footer,t,'/art/project-ui-icons-v1/chevron-right.png',box(back.x+11,back.y+9,26,26),true);
  chevron.rotation.z=Math.PI;area(t,'close','返回',back,'close');
  const saveH=pendingNotice(s,a,t,w,.055*w,headerH,.89*w,'base');
  if(!acq||!entries.length){
    words(a,acq?'暂无章节奖励。':'章节奖励暂未就绪。',16,headerH+saveH+24,14,{align:'left'});
    t.region('base',box(0,headerH,w,bodyH),saveH+55);return;
  }
  const row=selected?.row,items=row?.rewards||[],hasStars=s.starRewards?.native&&s.starRewards.modes?.length;
  const note=items.some(i=>i.unverified),gap=.03*w,nodeH=.871*w,slotSize=w*(items.length>=4 ? .16 : .22);
  const trayW=.89*w,space=.024*w,cols=Math.max(1,Math.floor((trayW-.06*w+space)/(slotSize+space)));
  const lines=Math.ceil(items.length/cols),titleSize=clamp(w*.045,17,21),labelH=titleSize*1.4;
  const trayH=selected?Math.max(.34*w,.065*w+labelH+lines*slotSize+Math.max(0,lines-1)*space+(note ? .02*w+15.4 : 0)):0;
  const starsHeight=hasStars ? .015*w+44 : 0,footH=Math.max(.24*w,48+starsHeight);
  const total=nodeH+(selected?gap+trayH:0)+gap+footH;
  const y=headerH+saveH+.025*w+Math.max(0,(bodyH-saveH-.045*w-total)/2);
  t.region('base',box(0,headerH,w,bodyH),Math.max(bodyH,saveH+.045*w+total));
  const nodeStart=a.group.children.length,node=box(.13*w,y,.74*w,nodeH);
  pic(a,t,'/art/chapter-reward-node-v1/node.png',node,true);
  words(a,selected?milestone(selected):'已领完',w/2,y+nodeH*.41,clamp(w*.084,28,38),{family:titleFont,shadow:{color:'#0b182a',y:2,blur:3}});
  words(a,selected?'第 '+selected.chapter+' 章':'章节奖励',w/2,y+nodeH*.67,clamp(w*.041,15,19),{family:titleFont});
  animate(t,a.group.children.slice(nodeStart),data,[{cx:w/2,cy:y+nodeH/2,fromScale:.88,fromY:12,delay:0,duration:.45,ease:nodeEase}]);
  if(selected){
    const ty=y+nodeH+gap,first=a.group.children.length,trayStep={cx:w/2,cy:ty+trayH/2,fromY:10,delay:.12,duration:.35};
    slice(a,t,tray,box((w-trayW)/2,ty,trayW,trayH),9,64);
    words(a,'奖励',w/2,ty+.02*w+labelH/2,titleSize,{family:titleFont});
    if(note)words(a,'随机奖励以实际获得为准',w/2,ty+trayH-.025*w-7.7,11,{weight:400,color:'#d6e8f3'});
    animate(t,a.group.children.slice(first),data,[trayStep]);
    items.forEach((item,i)=>{
      const line=Math.floor(i/cols),count=Math.min(cols,items.length-line*cols);
      const x=(w-(count*slotSize+(count-1)*space))/2+(i%cols)*(slotSize+space);
      const sy=ty+.04*w+labelH+line*(slotSize+space),start=a.group.children.length;
      slot(a,t,item,x,sy,slotSize,'reward-item-'+i,'base');
      animate(t,a.group.children.slice(start),data,[{cx:x+slotSize/2,cy:sy+slotSize/2,fromScale:.85,fromY:6,delay:Math.min(.3,.2+.05*i),duration:.3},trayStep]);
    });
  }
  const footY=y+nodeH+(selected?gap+trayH:0)+gap;
  const actionY=footY+(footH-48-starsHeight)/2;
  if(row?.canClaim){
    const b=box(.26*w,actionY,.48*w,48),enabled=!s.rewardPending&&!s.rewardBusy;
    claim(t,a,b,'获取奖励',enabled,clamp(.05*w,18,23));
    area(t,'claim','获取奖励',b,selected.core?'nativeChapterCoreReward':'nativeChapterReward',{id:row.id,revision:acq.revision},'base',!enabled);
  }else words(a,selected?condition(selected):'全部奖励已领取',w/2,actionY+24,clamp(.038*w,14,17),{weight:400,shadow:{color:'#102232',y:1,blur:2}});
  if(hasStars){
    const cy=actionY+48+.015*w+22;
    pic(a,t,star,box(w/2-36.5,cy-9,17,18),true);words(a,'星级奖励',w/2-15.5,cy,13,{align:'left',weight:600});
    area(t,'stars','星级奖励',box(w/2-41,cy-22,82,44),'nativeStarRewards',{},'base');
  }
}

export function starPage(data,w,h,t){
  const s=data.snapshot,view=s.starRewards,track=view?.modes?.find(row=>row.id==='easy');
  const width=.92*w,height=h*.84,header=w/6;
  const frame=paintLobbyPaper(t,data,w,h,width,height,header,'星级奖励');
  const x=frame.x+40*w/750+3,bw=width-80*w/750-6,summary=frame.top,art=t.layer('stars-header').art;
  if(!view?.native||!track){words(art,'奖励记录尚未就绪。',x,summary+18,14,{align:'left',color:'#203b51'});return;}
  const saveH=pendingNotice(s,art,t,w,x,summary,bw,null),sy=summary+saveH,blocked=Boolean(s.rewardPending||s.rewardBusy);
  art.quad(x,sy,bw,49,'#b4c5d7');art.quad(x,sy+48,bw,1,'#7992a9');
  pic(art,t,star,box(x+8,sy+14.5,20,20),true);words(art,'累计星数',x+35,sy+24.5,14,{align:'left',weight:700,color:'#203b51'});
  const max=words(art,' / '+track.maxStars,x+bw-8,sy+28,13,{align:'right',weight:400,color:'#405b73'});
  words(art,track.total,max.position.x-max.scale.x/2+3,sy+24.5,23,{align:'right',weight:700,color:'#18394f'});
  if(blocked)words(art,'请先完成当前奖励保存。',x,sy+62,12,{align:'left',weight:400,color:'#8a432e'});
  const top=sy+57+(blocked?27:0),listH=Math.max(1,frame.y+height-40*w/750-top),small=w<=350;
  const threshold=small?36:42,buttonW=small?60:76,px=small?5:9,py=small?9:11,gap=small?4:8,slotGap=small?5:7;
  const ix=x+px+threshold+gap,iw=bw-2*px-threshold-buttonW-2*gap;
  const side=clamp(w*.124,small?36:40,small?48:54),cols=Math.max(1,Math.floor((iw+slotGap)/(side+slotGap)));
  const next=track.items.find(row=>row.claimable&&!row.claimed)||track.items.find(row=>!row.claimed);
  let dy=0,initial=0;
  const rows=track.items.map(row=>{
    const lines=Math.ceil(row.rewardItems.length/cols),contentH=lines*side+Math.max(0,lines-1)*slotGap;
    const height=Math.max(small?68:78,contentH+py*2,40+py*2),y=top+dy;
    if(row===next)initial=Math.max(0,dy-3);
    dy+=height+6;return {row,y,height,contentH};
  });
  t.region('base',box(x,top,bw,listH),Math.max(0,dy-6)+8,'y',{initial,redrawStep:40});
  const offset=t.offset('base'),a=t.layer('star-rows','base').art;
  for(const {row,y,height,contentH} of rows){
    const draw=y+height>=top+offset-90&&y<=top+offset+listH+90,cy=y+height/2;
    const first=a.group.children.length;
    if(draw){
      a.panel(x+.5,y+.5,bw-1,height-1,{cut:0,fill:row.claimable&&!row.claimed?'#e4e2cd':'#d9e3ed',opacity:row.claimable ? .74 : .72,stroke:row.claimable&&!row.claimed?'#ba9851':'#8299ae'});
      const n=String(row.stars),tw=(small?14:16)*n.length*.57,cx=x+px+threshold/2;
      pic(a,t,star,box(cx-(tw+18)/2,cy-7,14,14),true);
      words(a,n,cx+(tw+18)/2,cy,small?14:16,{align:'right',weight:700,color:'#203b51'});
    }
    row.rewardItems.forEach((item,i)=>slot(a,t,item,ix+i%cols*(side+slotGap),cy-contentH/2+Math.floor(i/cols)*(side+slotGap),side,'star-'+row.id+'-item-'+i,'base',draw));
    const enabled=!blocked&&row.claimable&&!row.claimed&&row.supported;
    const status=row.claimed?'已领取':!row.supported?'暂不可领':row.claimable?'领取':'未达成';
    const b=box(x+bw-px-buttonW,cy-20,buttonW,40);
    if(draw){claim(t,a,b,status,enabled,13);if(row.claimed)for(const m of a.group.children.slice(first))m.material.opacity*=.65;}
    area(t,'claim-star-'+row.id,status+'，'+row.stars+' 星奖励',b,'claimStarReward',{mode:'easy',id:row.id,revision:view.revision},'base',!enabled);
  }
}
