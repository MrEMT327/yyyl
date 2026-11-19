import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {area,box,pic,slice,words,clamp,titleFont} from './menu-art.js';
import {DAILY_TABS,hasReady} from '../../ui/daily-center.js';
import {taskChestArt,taskChestModel} from '../../ui/task-chest-model.js';
import {paintPsdPopup,preparePsdPopupArt} from '../../ui/psd-popup-art.js';
import {paintItemDetail} from './item-details.js';
import {pendingNotice} from './chapter-rewards.js';
import {activityModel,signInCard,achievementRows} from './task-model.js';
import {taskList,rewardSlot,taskPageFade} from './task-list.js';
import art from './receipt-art.json';
const medal='/art/project-task-icons-v1/activity-medal.png';

function drawChest(t,a,w,g,row,model,data){
  const side=(row.step===100?.13:.12)*w,cy=g.top+.065*w,cx=g.x;
  const ready=row.canClaim&&!row.claimed,glow=ready?a.panel(cx-side*.52,cy-side*.37,side*1.04,side*.81,{fill:'#9beaff',opacity:.13,stroke:null,radius:side*.35}):null;
  const m=pic(a,t,taskChestArt(data.period,row.claimed),box(cx-.06*w,cy-side/2,side,side),true);
  m.material.opacity=row.claimed?.5:.9;
  const cyNode=g.top+.138*w;
  for(const [radius,color] of [[.014*w,ready?'#fff0c2':model.value>=row.step?'#c8f2ff':'#6d91a7'],[Math.max(.014*w-1.5,1),ready?'#ffdb85':model.value>=row.step?'#9feaff':'#19364c']])
    a.polygon([[cx,cyNode-radius],[cx+radius,cyNode],[cx,cyNode+radius],[cx-radius,cyNode]],color);
  words(a,row.step,cx,g.top+.175*w,clamp(w*.03,11,15),{color:ready?'#ffdf94':'#a6becd'});
  if(ready&&!data.reduced){
    const ox=m.position.x,oy=m.position.y,px=ox,py=oy+side*.3,keys=[[0,0,0],[.08,-4,-2],[.15,4,-2],[.22,-2,-1],[.30,0,0],[1,0,0]];
    const spark=a.polygon([[-1,-4],[1,-1],[4,0],[1,1],[0,4],[-1,1],[-4,0],[-1,-1]],'#fff1bb');
    spark.position.set(cx+.043*w,cy-.035*w,0);
    t.animate(now=>{const p=((now-data.entered)/3.4)%1,j=keys.findIndex((k,i)=>i>0&&k[0]>=p),lo=keys[Math.max(0,j-1)],hi=keys[Math.max(1,j)];
      const f=clamp((p-lo[0])/(hi[0]-lo[0]),0,1),ease=f*f*(3-2*f),angle=(lo[1]+(hi[1]-lo[1])*ease)*Math.PI/180;
      m.rotation.z=angle;m.position.set(px-(oy-py)*Math.sin(angle),py+(oy-py)*Math.cos(angle)+lo[2]+(hi[2]-lo[2])*ease,0);
      glow.material.opacity=.09+.13*(1+Math.cos((p-.3)*Math.PI*2))/2;spark.material.opacity=p<.15||p>.48?0:.95*Math.sin(Math.PI*(p-.15)/.33);});
  }
  area(t,'chest-'+row.id,model.label+' '+row.step+'奖励，'+(row.status||'未达成'),box(cx-.06*w,g.top,.12*w,.2*w),'taskChest',{id:row.id,period:data.period,revision:model.revision});
}

function activity(data,w,t,r){
  const {snapshot:s,period}=data,a=t.layer('activity').art,m=activityModel(s,period);
  const pad=.025*w+1,head=Math.max(.055*w,20),chestTop=r.y+pad+head+.01*w,ix=r.x+pad,iw=r.w-2*pad-.06*w;
  const height=chestTop-r.y+.20*w+.015*w+1,barY=chestTop+.13*w,barH=Math.max(4,w*.016);
  a.panel(r.x,r.y,r.w,height,{fill:'#29485e',bottomColor:'#1d3549',stroke:'#708fa5',opacity:1,cut:0});
  pic(a,t,medal,box(ix,r.y+pad,.045*w,head),true);
  const label=words(a,m.label,ix+.055*w,r.y+pad+head/2,clamp(.027*w,10,14),{color:'#d9e8f1',align:'left',weight:500});
  const value=words(a,m.value,label.position.x+label.scale.x/2+.01*w-4,r.y+pad+head/2,clamp(w*.045,15,22),{color:'#b8efff',align:'left',weight:700});
  words(a,'/ '+m.max,value.position.x+value.scale.x/2-2,r.y+pad+head*.58,clamp(.026*w,10,13),{align:'left',color:'#91adbf',weight:400});
  words(a,(m.weekly?'周一':'每日')+' 00:00 刷新',r.x+r.w-pad,r.y+pad+head/2,clamp(.025*w,9,12),{align:'right',color:'#a9bfce',weight:400});
  a.quad(ix,barY,iw,barH,'#58798f');a.quad(ix+1,barY+1,iw-2,barH-2,'#12293a');
  if(m.value>0)a.quad(ix+1,barY+1,(iw-2)*m.value/m.max,barH-2,'#70cbe7');
  for(const row of m.milestones)drawChest(t,a,w,{x:ix+iw*row.step/m.max,top:chestTop},row,m,data);
  const note=clamp(.03*w,11,15),noteH=Math.max(note*1.2,.04*w),noteY=r.y+height+.015*w;
  words(a,m.reset,r.x+r.w,noteY+noteH/2,note,{align:'right',color:'#425c72'});
  const top=noteY+noteH+.015*w;
  taskList(s,m.tasks,w,t,box(r.x,top,r.w,Math.max(1,r.y+r.h-top)),period,false,data.switched,data.initial);
}

function frameDay(a,t,b,today){
  const edge=slice(a,t,'/art/psd-equipment-v1/frame-blue.png',b,2);
  edge.geometry.setIndex(Array.from({length:54},(_,i)=>i).filter(i=>i<24||i>=30));edge.material.opacity=today?.9:.3;
}
function signIn(data,w,t,clip){
  const s=data.snapshot,a=t.layer('sign-in','signin').art,x=clip.x+.006*w,width=clip.w-.012*w,gap=.013*w,gapY=.016*w,cell=(width-2*gap)/3;
  let y=clip.y+.012*w,column=0,rowHeight=0;
  if(s.signIn?.gate?.reached===false){
    const height=Math.max(clamp(.03*w,11,15)*1.2,.04*w);
    words(a,s.signIn.gate.reason,x+width,y+height/2,clamp(.03*w,11,15),{align:'right',color:'#425c72'});y+=height;
  }
  for(const original of s.signIn?.days||[]){
    const day=signInCard(original,s),wide=day.final,heading=.064*w;
    if(wide&&column){y+=rowHeight+gapY;column=0;rowHeight=0;}
    const cx=x+column*(cell+gap),bw=wide?width:cell,pad=wide?.015*w:.012*w,foot=.05*w;
    const itemGap=.01*w,iw=bw-2*pad,sw=day.pilot?(bw*.56-.04*w)/3:wide?(iw-itemGap*(day.items.length-1))/Math.max(1,day.items.length):Math.min(iw,.17*w);
    const countY=!wide&&day.items.length>1?day.items.length:1,slotsH=countY*sw+(countY-1)*itemGap;
    const height=day.pilot?(w<=360?.43:.47)*w:Math.max(w*(wide?.32:.31),heading+.012*w+slotsH+foot);
    const b=box(cx,y,bw,height),ink=day.claimed?'#bbcedc':day.today?'#d8ebf5':'#c5d7e5';
    a.panel(cx,y,bw,height,{fill:ink,stroke:null,opacity:1,cut:2});frameDay(a,t,b,day.today);
    const enabled=day.today&&!day.busy&&(!s.nativeEconomyPending||Boolean(s.flightRewards));
    area(t,'day-'+day.day,'第 '+day.day+' 天'+(day.claimed?'，已领取':day.today?'，今日可领取':''),b,'claimSignIn',{},'signin',!enabled);
    words(a,'第 '+day.day+' 天',day.pilot?cx+pad+.02*w:cx+bw/2,y+heading/2,clamp(.031*w,11,16),{align:day.pilot?'left':'center',color:'#42617a',weight:700});
    const bodyY=y+heading+.012*w,bodyH=height-heading-.012*w-foot;
    if(day.pilot){
      const pw=.44*w,ph=bodyH+.05*w,portrait=pic(a,t,day.pilot.image,box(cx+bw-pad+.01*w-pw,bodyY-.05*w,pw,ph));
      const im=portrait.material.map?.image;
      if(im?.width){
        const vertical=ph/(2.3*pw*im.height/im.width);
        portrait.material.onBeforeCompile=shader=>{
          shader.uniforms.signinCrop={value:vertical};
          shader.fragmentShader='uniform float signinCrop;\n'+shader.fragmentShader.replace('#include <map_fragment>',
            'vec2 p=vMapUv;vec2 uv=vec2(.5+(p.x-.5)/2.3,1.-(1.-p.y)*signinCrop);vec4 c=texture2D(map,clamp(uv,0.,1.));diffuseColor*=c;diffuseColor.a*=clamp(min(p.x,1.-p.x)/.12,0.,1.)*clamp(p.y/.36,0.,1.)*step(0.,uv.y);');
        };
      }
      portrait.material.opacity=day.claimed?.45:1;
      words(a,day.pilot.name,cx+.035*w,bodyY+.061*w,clamp(w*.045,14,23),{align:'left',color:'#23445c'});
    }
    for(const [i,item] of day.items.entries()){
      const sx=day.pilot?cx+.035*w+i*(sw+itemGap):wide?cx+pad+i*(sw+itemGap):cx+(bw-sw)/2;
      const sy=day.pilot?bodyY+.13*w:bodyY+(bodyH-slotsH)/2+(wide?0:i*(sw+itemGap));
      rewardSlot(t,a,s,item,box(sx,sy,sw,sw),'day-'+day.day+'-item-'+i,'signin',true,day.claimed,true);
    }
    if(day.today&&!day.busy)words(a,'可领取',cx+bw/2,y+height-.023*w,clamp(.029*w,10,14),{color:'#ad580b',weight:700});
    if(day.today&&day.busy){
      const mesh=a.line([[0,-7],[5,-5],[7,0],[5,5],[0,7],[-5,5],[-7,0]],'#7199b2',1,2);mesh.position.set(cx+bw/2,y+height*.52,0);
      if(!data.reduced)t.animate(now=>{mesh.rotation.z=now*Math.PI*2/.7;});
    }
    rowHeight=Math.max(rowHeight,height);column+=wide?3:1;
    if(column===3){y+=rowHeight+gapY;column=0;rowHeight=0;}
  }
  t.region('signin',clip,Math.max(0,y-clip.y+(column?rowHeight:-gapY)+.01*w),'y',{parent:'base',initial:data.initial});
  taskPageFade(a,t,data.switched);
}
function tasks(data,w,h,t){
  const width=.92*w,height=Math.min(w*1.5,h*.9),p=paintLobbyPaper(t,{...data,coverNavigation:true,paperFace:art.taskFace},w,h,width,height,w/6,'任务');
  const margin=40*w/750,x=p.x+margin,bw=width-2*margin,step=bw/4,faceH=step*32/70;
  for(const [i,tab] of DAILY_TABS.entries()){
    const current=data.period===tab.id,left=x+step*i,center=p.top+24;
    pic(p.a,t,'/art/project-tabs-v1/tab-'+(current?'active':'inactive')+'.png',box(left,center-faceH/2,step,faceH));
    words(p.a,tab.label,left+step/2,center,clamp(w*.038,14,18),{family:titleFont,color:current?'#163650':'#d1dce8'});
    if(hasReady(data.snapshot,tab.id))p.a.panel(left+step-14,p.top+3,7,7,{radius:4,cut:0,fill:'#ee5767',stroke:'#80313c',opacity:1});
    area(t,'tab-'+tab.id,tab.label,box(left,p.top,step,48),'taskPeriod',{period:tab.id});
  }
  let top=p.top+48+.015*w;top+=pendingNotice(data.snapshot,p.a,t,w,x,top,bw,null);
  const rect=box(x,top,bw,Math.max(1,p.y+height-52*w/750-top));
  if(data.period==='signin')signIn(data,w,t,rect);
  else if(data.period==='achievements')taskList(data.snapshot,achievementRows(data.snapshot),w,t,rect,'achievements',true,data.switched,data.initial);
  else activity(data,w,t,rect);
}
function chestTip(data,w,h,t){
  const row=taskChestModel(data.snapshot,data.period,data.id),a=t.layer('chest-tip').art;
  const from=data.source.state().controls.find(c=>c.id==='chest-'+data.id),host=data.host.getBoundingClientRect();
  const center=from?from.x+from.w/2-host.x:w/2,top=from?from.y-host.y+.005*w:h*.4;
  const items=row?.rewards||[],side=.16*w,gap=.025*w,cols=clamp(items.length,1,3),width=clamp(cols*side+(cols-1)*gap+.08*w,.24*w,.76*w);
  const height=.07*w+Math.max(1,Math.ceil(items.length/cols))*(side+gap)-gap,x=clamp(center-width/2,.04*w+6,w-.04*w-6-width),y=Math.max(8,top+.18*side*.75-height-7);
  area(t,'outside','关闭宝箱奖励',box(0,0,w,h),'close');area(t,'tip','',box(x,y,width,height),'none');
  if(!preparePsdPopupArt('secondary'))t.waitForArt();
  paintPsdPopup(a,'secondary',x,y,width,height,.0004*w);
  const tip=clamp(center,x+12,x+width-12);a.polygon([[tip-w*.015,y+height-1],[tip+w*.015,y+height-1],[tip,y+height+w*.02-1]],'#a9bacb');
  items.forEach((r,i)=>rewardSlot(t,a,data.snapshot,r,box(x+.04*w+(i%cols)*(side+gap),y+.035*w+Math.floor(i/cols)*(side+gap),side,side),'chest-item-'+i));
  if(!row)words(a,'该奖励已更新，请返回任务查看。',x+width/2,y+height/2,13,{color:'#203b50',maxWidth:width-10,wrap:true});
}
export function openTaskPanel(screen,host,send,kind,scrollPositions){
  const tip=kind==='taskChestPreview',source=tip?screen.panel:null,entered=performance.now()/1000;
  let latest,inspect=null,switched=0;
  const panel=createLobbyPanel(screen,host,tip?'宝箱奖励':'任务',(data,w,h,t)=>{
    if(tip)chestTip(data,w,h,t);else tasks(data,w,h,t);
    if(data.inspect){paintItemDetail(data,w,h,t);return 'inspect';}
    return 'base';
  },cmd=>{
    if(cmd.type==='inspect'){inspect=cmd.data;panel.scroll('inspect',0);refresh();return;}
    if(cmd.type==='close'&&inspect){inspect=null;refresh();return;}
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  },{overlay:tip,onScroll(zone,value){if(DAILY_TABS.some(tab=>tab.id===zone))scrollPositions?.set(zone,value);}});
  panel.surface.addEventListener('keydown',keyTab,true);
  function keyTab(e){
    if(inspect||tip||!panel.focused?.startsWith('tab-')||!['Home','End','ArrowLeft','ArrowRight'].includes(e.key))return;
    const index=DAILY_TABS.findIndex(d=>d.id===latest.period),i=e.key==='Home'?0:e.key==='End'?3:(index+(e.key==='ArrowLeft'?3:1))%4;
    e.preventDefault();e.stopImmediatePropagation();send('taskPeriod',{period:DAILY_TABS[i].id},host);
  }
  function refresh(){const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;panel.update({...latest,source,host,entered,inspect,reduced,switched:reduced?0:switched},
    [latest.signature,latest.period,latest.id,inspect?.itemId,inspect?.name].join('|'),kind);}
  return {host,close(){panel.surface.removeEventListener('keydown',keyTab,true);panel.close();},update(snapshot,modal,signature){
    const period=modal.period||'daily';
    if(latest&&latest.period!==period)switched=performance.now()/1000;
    latest={snapshot,signature,period,id:modal.id,initial:scrollPositions?.get(period)||0};refresh();
  }};
}
