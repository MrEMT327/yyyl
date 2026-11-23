import {art,box,pic,slice,words,area,titleFont,qualityFrame,fmt} from './menu-art.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {equipmentArtPath} from '../../replica/equipment-art.js';
import {GEAR_PARTS,GEAR_QUALITY_NAMES} from '../../peripheral/equipment-system.js';
import {compactCombatStat} from '../../ui/compact-combat-stat.js';
import {compactPilotAvatar} from '../../pilot-avatar-icons.js';

const gearArt=id=>'/'+equipmentArtPath(id);
export function equipmentMenu(data,w,h,t,chrome){
  const s=data.snapshot,g=s.equipment,layout=chrome.equipment,{u,scale,rect:r,x,y,adaptive,compacted}=layout;
  const touch=(b,maxHeight=Infinity)=>{
    if(!compacted)return b;
    const bw=Math.max(b.w,44),bh=Math.min(maxHeight,Math.max(b.h,44));
    const top=Math.min(layout.bottom-bh,Math.max(layout.top,b.y+(b.h-bh)/2));
    return box(Math.max(0,Math.min(w-bw,b.x+(b.w-bw)/2)),top,bw,bh);
  };
  const main=t.layer('equipment-deck').art;
  pic(main,t,art['equipment-deck'],box(0,layout.top,w,layout.bottom-layout.top+.1*u));
  const pilot=s.pilots.find(i=>i.id===s.pilotId),a=s.aircraft.find(i=>i.id===s.aircraftId);
  const b=layout.preview,target=data.preview;
  if(target?.ready){
    const ratio=target.target.width/target.target.height,width=Math.min(b.w,b.h*ratio),height=width/ratio;
    target.paint(main,b.x+(b.w-width)/2,b.y+(b.h-height)/2,width,height);
  }else pic(main,t,'/art/aircraft-ui-v1/'+s.aircraftId+'-hangar.webp',b,true);
  area(t,'aircraft',a?.name||'战机三维预览',b,'orbit');
  pic(main,t,art['pilot-card-frame'],r(86.4,71.7,197.3,71.7));
  if(pilot){
    const url=compactPilotAvatar(pilot.avatar||pilot.image).src;
    const m=pic(main,t,url,r(90.1,74.6,81.3,65.8));
    if(m.material.map?.image){
      const uv=m.geometry.attributes.uv,frac=65.8/81.3;
      for(let i=0;i<uv.count;i++)uv.setY(i,(1-frac)/2+uv.getY(i)*frac);
    }
  }
  const text=(v,px,py,size,opts={})=>words(main,v,x(px),y(py),compacted?Math.max(10,size*scale):size*u,opts);
  text('驾驶员',176.6,81,10.4,{align:'left',color:'#bdd6e6'});
  text(pilot?.name||'未选择驾驶员',176.6,96,13,{align:'left',maxWidth:102*scale});
  for(const [i,[icon,value]] of [['attack',s.combatStats?.attack],['durability',s.combatStats?.maxHp]].entries()){
    pic(main,t,art['stat-'+icon],r(176.6+i*51.7,118.2,19.9,19.9),true);
    text(compactCombatStat(value),200+i*52,128,13,{align:'left',weight:800});
  }
  area(t,'stats','查看战斗属性',touch(r(86.4,71.7,197.3,71.7)),'gearAttributes');
  function card(target,b,item,slot,zone){
    const {x,y,w:side}=b,part=GEAR_PARTS.find(p=>p.type===(item?.type||slot));
    slice(target,t,item?qualityFrame(item.qualityRank):'/art/psd-equipment-v1/frame-empty.png',b,9*(slot?scale:u));
    if(item)pic(target,t,gearArt(item.art),box(x+side*.08,y+side*.155,side*.84,side*.69),true);
    else words(target,'＋',x+side/2,y+side*.50,side*.40,{color:'#aec3d0'});
    words(target,item?'Lv.'+item.level:'未装配',x+side/2,y+side*.87,Math.max(11,side*.17),{weight:600,maxWidth:side*.9,outline:'#102538'});
    if(part){
      const size=side*.339;pic(target,t,art['slot-badge-'+part.type],box(x,y,size,size));
    }
    if(item?.quality%10)words(target,'+'+(item.quality%10),x+side*.82,y+side*.15,10,{color:'#ffe48a'});
    if(item?.locked)words(target,'锁',x+side*.8,y+side*.2,10);
    if(item&&(slot?item.canUpgrade:item.canReplace))pic(target,t,'/art/equipment-better-arrow-v1/arrow-64.png',box(x+side*.72,y,side*.28,side*.28),true);
    const hit=slot?touch(b,84.4*scale):b;
    if(item)area(t,'gear-'+item.uid,item.name,hit,'gearDetail',{id:item.uid,gearOrigin:slot?'slot':'warehouse'},zone);
    else area(t,'slot-'+slot,part?.name||'空槽',hit,'gearChoosePart',{part:String(slot)},zone);
  }
  const gun=s.replicaCollection?.guns?.find(item=>item.equipped);
  const weapon=r(15.5,112.7,55.8,55.8,0);
  slice(main,t,gun?qualityFrame(gun.qualityRank):'/art/psd-equipment-v1/frame-empty.png',weapon,9*scale);
  if(gun){
    pic(main,t,'/art/weapon-slot-contour-v4/frame-192.webp',r(2.67,99.87,81.47,81.47,0));
    pic(main,t,nativeCollectionArt(gun),r(20,120.5,46.9,40.2,0),true);
  }
  else words(main,'＋',x(44,0),y(141),20*scale);
  area(t,'weapon','主武器',touch(weapon,84.4*scale),'equipmentWeapons');
  for(let part=1;part<=5;part++){
    const right=part%2,px=right?298.9:15.5,py=112.7+Math.floor(part/2)*84.4;
    card(main,r(px,py,55.8,55.8,right?w/u:0),g.items.find(i=>i.uid===g.slots[part]),part);
  }
  ['weapon','aircraft','pilot'].forEach((kind,i)=>{
    const left=96.1+i*61;
    const b=r(left,371,55.4,52,left+55.4/2);pic(main,t,art['gear-entry-'+kind],b);
    area(t,'catalog-'+kind,['武器','战机','驾驶员'][i],touch(b),i?'catalog':'equipmentWeapons',i?{kind}:{});
  });
  const toolbar=t.layer('inventory-toolbar').art,{bottom,toolbarH}=layout;
  pic(toolbar,t,art['warehouse-toolbar'],box(0,bottom,w,toolbarH));
  const tool=(px,width)=>{
    const height=adaptive?Math.max(44,44*u):44*u;
    return box(px*u,bottom+(adaptive?(toolbarH-height)/2:4.4*u),width*u,height);
  };
  const sort=tool(9.8,97.5),workshop=tool(260.1,97.5);
  const sorts={quality:'按品质排序',part:'按部位排序',level:'按等级排序'};
  function toolbarLabel(b,label){
    const height=w*.089333;
    slice(toolbar,t,'/art/psd-equipment-v1/button-gold-native.png',box(b.x,b.y+(b.h-height)/2,b.w,height),w*.024,18);
    words(toolbar,label,b.x+b.w/2,b.y+b.h/2,Math.max(12,w*.04),{family:titleFont,outline:'#071725'});
  }
  toolbarLabel(sort,sorts[data.gearSort]);area(t,'sort','装备排序',sort,'sortGear');
  words(toolbar,data.gearFilter==='all'?'装备':'全部装备',w/2,bottom+(adaptive?toolbarH/2:26.7*u),19*u,{family:titleFont});
  if(data.gearFilter!=='all')area(t,'clear-filter','全部装备',adaptive?tool(130,109):box(130*u,447*u,109*u,44*u),'gearClearFilter');
  toolbarLabel(workshop,'改装间');area(t,'workshop','改装间',workshop,'openWorkshop');
  if(g.items.some(i=>!i.locked&&i.merge?.available))pic(toolbar,t,'/art/project-notification-dot-v1/red-dot.png',box(346*u,workshop.y+1.3*u,12*u,12*u),true);
  const {warehouse,side,gap,pad}=layout,{y:iy,h:ih}=warehouse,inv=t.layer('warehouse-background').art;
  if(ih>0)pic(inv,t,art['gear-grid'],warehouse);
  const list=g.items.filter(i=>!i.equipped&&(data.gearFilter==='all'||String(i.type)===data.gearFilter)).sort((a,b)=>(data.gearSort==='level'?b.level-a.level:data.gearSort==='part'?a.type-b.type:b.quality-a.quality)||a.type-b.type||a.uid.localeCompare(b.uid));
  const grid=t.layer('equipment','warehouse').art,step=side+gap,ox=(w-5*side-4*gap)/2;
  list.forEach((item,i)=>card(grid,box(ox+i%5*step,iy+pad+Math.floor(i/5)*step,side,side),item,null,'warehouse'));
  const fodder=Object.entries(g.fodder||{}).filter(([,n])=>n>0),rows=Math.ceil(list.length/5),materialRows=Math.ceil(fodder.length/5);
  let fy=iy+(adaptive?pad+rows*step:Math.max(ih,pad+rows*step));
  if(!list.length&&(!adaptive||!fodder.length)){
    words(grid,'暂无闲置装备',w/2,adaptive?iy+ih/2:fy+16,13,{color:'#b1c2d2'});
    if(!adaptive)fy+=37;
  }
  for(const [i,[key,count]] of fodder.entries()){
    const [type,q]=key.split(':').map(Number),part=g.blueprints.find(row=>row.type===type),b=box(ox+i%5*step,fy+Math.floor(i/5)*step,side,side);
    slice(grid,t,qualityFrame(Math.max(0,Math.floor(q/10)-1)),b,8*u);pic(grid,t,gearArt(part.id),b,true);
    words(grid,'×'+fmt(count),b.x+b.w*.68,b.y+b.h*.83,11);
    area(t,'fodder-'+key,part.name+GEAR_QUALITY_NAMES[q]+'材料',b,'gearMaterialInfo',{part:type,quality:q},'warehouse');
  }
  const length=adaptive?layout.rowsHeight(rows+materialRows):fy-iy+materialRows*step;
  t.region('warehouse',warehouse,length);
  if(data.sortOpen){
    const pop=t.layer('sort-list').art;area(t,'sort-outside','关闭排序',box(0,0,w,h),'sortGear');
    const start=adaptive&&sort.y+sort.h+108>chrome.navY?sort.y-108:sort.y+sort.h;
    Object.entries(sorts).forEach(([id,name],i)=>{const b=box(sort.x,start+i*36,sort.w+12,36);
      pop.panel(b.x,b.y,b.w,b.h,{fill:id===data.gearSort?'#567c94':'#203747',stroke:'#7fa8bd',radius:2});words(pop,name,b.x+b.w/2,b.y+b.h/2,13);
      area(t,'sort-'+id,name,b,'sortGear',{value:id});
    });
  }
}
