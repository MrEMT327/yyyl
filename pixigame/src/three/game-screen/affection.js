import {area,box,clamp,pic,slice,titleFont,words} from './menu-art.js';
import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {PILOT_AFFECTION_MAX,pilotAffectionPoints,pilotAffectionVideo} from '../../peripheral/pilot-affection.js';

function layout(data,w,h,t){
  const {snapshot:s,pilot,pilots}=data,u=w/750,pw=Math.min(567*u,w*.94),header=w/6,side=clamp(.15*w,46,76),font=clamp(.032*w,12,16),line=font*1.65;
  const pts=pilotAffectionPoints(pilot?.affection),film=pilot&&pilotAffectionVideo(pilot.id),unlocked=pts===PILOT_AFFECTION_MAX,choices=pilots.length>1;
  const bh=pilot?side+12+1+8+line+6+9+(film?12+(unlocked?48:line):0)+(choices?12+Math.ceil(pilots.length/2)*44+(Math.ceil(pilots.length/2)-1)*6:0):24;
  const ph=Math.min(.88*h,header+bh+52*u),p=paintLobbyPaper(t,data,w,h,pw,ph,header,'好感度');
  const a=t.layer('pilot-affection','base').art,x=p.x+40*u,bw=pw-80*u,top=p.top;
  t.region('base',box(x-6,top,bw+12,ph-header-40*u),bh+12*u);
  if(!pilot){words(a,'暂无驾驶员',x,top+12,font,{align:'left',color:'#203a50'});return;}
  pic(a,t,pilot.avatar,box(x,top,side,side),true);
  const current=pilot.id===s.pilotId,nx=x+side+12;
  words(a,pilot.name,nx-2,top+side/2-(current?12:0),15.21,{family:titleFont,align:'left',color:'#203a50',maxWidth:bw-side-12});
  if(current)words(a,'当前出战',nx-2,top+side/2+15,font,{weight:400,align:'left',color:'#203a50'});
  let y=top+side+12;a.quad(x,y,bw,1,'#698497',.376);y+=9;
  words(a,'好感度',x-2,y+line/2,font,{align:'left',color:'#203a50',weight:400});
  words(a,pts+' / '+PILOT_AFFECTION_MAX,x+bw+2,y+line/2,font,{align:'right',color:'#203a50',weight:700});y+=line+6;
  a.panel(x,y,bw,9,{fill:'#5c7489',stroke:null,radius:4,opacity:1});
  if(pts)a.panel(x,y,bw*pts/PILOT_AFFECTION_MAX,9,{fill:'#116780',stroke:null,radius:4,opacity:1});
  y+=9;
  if(film){y+=12;
    if(unlocked){const b=box(x,y,bw,48);slice(a,t,'/art/psd-equipment-v1/button-gold.png',b,10);
      words(a,'观看专属视频',w/2,y+24,clamp(.038*w,13,17),{family:titleFont});area(t,'play','观看专属视频',b,'playAffectionVideo',{id:pilot.id},'base');y+=48;}
    else{words(a,'好感度达到 '+PILOT_AFFECTION_MAX+' 解锁专属视频',x-2,y+line/2,font,{color:'#203a50',weight:400,align:'left',maxWidth:bw});y+=line;}
  }
  if(choices){
    y+=12;pilots.forEach((r,i)=>{const cw=(bw-6)/2,b=box(x+i%2*(cw+6),y+Math.floor(i/2)*50,cw,44);
      slice(a,t,'/art/psd-buttons-v1/button-blue.png',b,9);if(r.id===pilot.id)a.line([[b.x+3,b.y+3],[b.x+cw-3,b.y+3],[b.x+cw-3,b.y+41],[b.x+3,b.y+41],[b.x+3,b.y+3]],'#72dafa',1,2);
      pic(a,t,r.avatar,box(b.x+6,b.y+10,24,24),true);words(a,r.name,b.x+35,b.y+22,12,{family:titleFont,align:'left',maxWidth:cw-38});
      area(t,'affection-'+r.id,r.name,b,'browseAffectionPilot',{id:r.id},'base');
    });
  }
}
export function openAffection(screen,host,send){
  const panel=createLobbyPanel(screen,host,'好感度',layout,c=>{if(c.type!=='none')send(c.type,c.data||{},host);});
  return {host,close:panel.close,update(snapshot,modal,signature){
    const pilots=(snapshot.pilots||[]).filter(p=>p.owned||p.id===snapshot.pilotId);
    const pilot=pilots.find(p=>p.id===modal.pilotId)||pilots.find(p=>p.id===snapshot.pilotId)||pilots[0];
    panel.update({snapshot,pilots,pilot,safeBottom:screen.menuView?.safeBottom||0},JSON.stringify([signature,pilot?.id,pilots.map(p=>p.affection)]),'affection');
  }};
}
