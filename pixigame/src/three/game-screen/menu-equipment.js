import {art,box,pic,slice,words,area,titleFont,qualityFrame,fmt} from './menu-art.js';
import {equipmentPreviewRect} from './menu-aircraft.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {equipmentArtPath} from '../../replica/equipment-art.js';
import {GEAR_PARTS,GEAR_QUALITY_NAMES} from '../../peripheral/equipment-system.js';
import {compactCombatStat} from '../../ui/compact-combat-stat.js';
import {compactPilotAvatar} from '../../pilot-avatar-icons.js';

const gearArt=id=>'/'+equipmentArtPath(id);
export function equipmentMenu(data,w,h,t,chrome){
  const s=data.snapshot,g=s.equipment,u=w/369.453,r=(x,y,sw,sh)=>box(x*u,y*u,sw*u,sh*u);
  const main=t.layer('equipment-deck').art;
  pic(main,t,art['equipment-deck'],r(0,46.2,369.453,397.2));
  const pilot=s.pilots.find(i=>i.id===s.pilotId),a=s.aircraft.find(i=>i.id===s.aircraftId);
  const b=equipmentPreviewRect(w,h),target=data.preview;
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
  const text=(v,x,y,size,opts={})=>words(main,v,x*u,y*u,size*u,opts);
  text('驾驶员',176.6,81,10.4,{align:'left',color:'#bdd6e6'});
  text(pilot?.name||'未选择驾驶员',176.6,96,13,{align:'left',maxWidth:102*u});
  for(const [i,[icon,value]] of [['attack',s.combatStats?.attack],['durability',s.combatStats?.maxHp]].entries()){
    pic(main,t,art['stat-'+icon],r(176.6+i*51.7,118.2,19.9,19.9),true);
    text(compactCombatStat(value),200+i*52,128,13,{align:'left',weight:800});
  }
  area(t,'stats','查看战斗属性',r(86.4,71.7,197.3,71.7),'gearAttributes');
  function card(target,b,item,slot,zone){
    const {x,y,w:side}=b,part=GEAR_PARTS.find(p=>p.type===(item?.type||slot));
    slice(target,t,item?qualityFrame(item.qualityRank):'/art/psd-equipment-v1/frame-empty.png',b,9*u);
    if(item)pic(target,t,gearArt(item.art),box(x+side*.08,y+side*.155,side*.84,side*.69),true);
    else words(target,'＋',x+side/2,y+side*.50,side*.40,{color:'#aec3d0'});
    words(target,item?'Lv.'+item.level:'未装配',x+side/2,y+side*.87,Math.max(11,side*.17),{weight:600,maxWidth:side*.9,outline:'#102538'});
    if(part){
      const size=side*.339;pic(target,t,art['slot-badge-'+part.type],box(x,y,size,size));
    }
    if(item?.quality%10)words(target,'+'+(item.quality%10),x+side*.82,y+side*.15,10,{color:'#ffe48a'});
    if(item?.locked)words(target,'锁',x+side*.8,y+side*.2,10);
    if(item&&(slot?item.canUpgrade:item.canReplace))pic(target,t,'/art/equipment-better-arrow-v1/arrow-64.png',box(x+side*.72,y,side*.28,side*.28),true);
    if(item)area(t,'gear-'+item.uid,item.name,b,'gearDetail',{id:item.uid,gearOrigin:slot?'slot':'warehouse'},zone);
    else area(t,'slot-'+slot,part?.name||'空槽',b,'gearChoosePart',{part:String(slot)},zone);
  }
  const gun=s.replicaCollection?.guns?.find(item=>item.equipped);
  const weapon=r(15.5,112.7,55.8,55.8);
  slice(main,t,gun?qualityFrame(gun.qualityRank):'/art/psd-equipment-v1/frame-empty.png',weapon,9*u);
  if(gun){
    pic(main,t,'/art/weapon-slot-contour-v4/frame-192.webp',r(2.67,99.87,81.47,81.47));
    pic(main,t,nativeCollectionArt(gun),r(20,120.5,46.9,40.2),true);
  }
  else text('＋',44,141,20);
  area(t,'weapon','主武器',weapon,'equipmentWeapons');
  for(let part=1;part<=5;part++){
    const x=part%2?298.9:15.5,y=112.7+Math.floor(part/2)*84.4;
    card(main,r(x,y,55.8,55.8),g.items.find(i=>i.uid===g.slots[part]),part);
  }
  ['weapon','aircraft','pilot'].forEach((kind,i)=>{
    const b=r(96.1+i*61,371,55.4,52);pic(main,t,art['gear-entry-'+kind],b);
    area(t,'catalog-'+kind,['武器','战机','驾驶员'][i],b,i?'catalog':'equipmentWeapons',i?{kind}:{});
  });
  const toolbar=t.layer('inventory-toolbar').art;pic(toolbar,t,art['warehouse-toolbar'],r(0,443.3,369.453,52.7));
  const sort=r(9.8,447.7,97.5,44),workshop=r(260.1,447.7,97.5,44);
  const sorts={quality:'按品质排序',part:'按部位排序',level:'按等级排序'};
  function toolbarLabel(b,label){
    const height=w*.089333;
    slice(toolbar,t,'/art/psd-equipment-v1/button-gold-native.png',box(b.x,b.y+(b.h-height)/2,b.w,height),w*.024,18);
    words(toolbar,label,b.x+b.w/2,b.y+b.h/2,Math.max(12,w*.04),{family:titleFont,outline:'#071725'});
  }
  toolbarLabel(sort,sorts[data.gearSort]);area(t,'sort','装备排序',sort,'sortGear');
  words(toolbar,data.gearFilter==='all'?'装备':'全部装备',w/2,470*u,19*u,{family:titleFont});
  if(data.gearFilter!=='all')area(t,'clear-filter','全部装备',r(130,447,109,44),'gearClearFilter');
  toolbarLabel(workshop,'改装间');area(t,'workshop','改装间',workshop,'openWorkshop');
  if(g.items.some(i=>!i.locked&&i.merge?.available))pic(toolbar,t,'/art/project-notification-dot-v1/red-dot.png',r(346,449,12,12),true);
  const iy=496*u,ih=chrome.navY-4*u-iy,inv=t.layer('warehouse-background').art;pic(inv,t,art['gear-grid'],box(0,iy,w,ih));
  const list=g.items.filter(i=>!i.equipped&&(data.gearFilter==='all'||String(i.type)===data.gearFilter)).sort((a,b)=>(data.gearSort==='level'?b.level-a.level:data.gearSort==='part'?a.type-b.type:b.quality-a.quality)||a.type-b.type||a.uid.localeCompare(b.uid));
  const grid=t.layer('equipment','warehouse').art,side=w*.163,gap=w*.016,ox=(w-5*side-4*gap)/2;
  list.forEach((item,i)=>card(grid,box(ox+i%5*(side+gap),iy+7*u+Math.floor(i/5)*(side+gap),side,side),item,null,'warehouse'));
  let fy=iy+Math.max(ih,7*u+Math.ceil(list.length/5)*(side+gap));
  if(!list.length){words(grid,'暂无闲置装备',w/2,fy+16,13,{color:'#b1c2d2'});fy+=37;}
  for(const [i,[key,count]] of Object.entries(g.fodder||{}).filter(([,n])=>n>0).entries()){
    const [type,q]=key.split(':').map(Number),part=g.blueprints.find(row=>row.type===type),b=box(ox+i%5*(side+gap),fy+Math.floor(i/5)*(side+gap),side,side);
    slice(grid,t,qualityFrame(Math.max(0,Math.floor(q/10)-1)),b,8*u);pic(grid,t,gearArt(part.id),b,true);
    words(grid,'×'+fmt(count),b.x+b.w*.68,b.y+b.h*.83,11);
    area(t,'fodder-'+key,part.name+GEAR_QUALITY_NAMES[q]+'材料',b,'gearMaterialInfo',{part:type,quality:q},'warehouse');
  }
  t.region('warehouse',box(0,iy,w,ih),fy-iy+Math.ceil(Object.values(g.fodder||{}).filter(n=>n>0).length/5)*(side+gap));
  if(data.sortOpen){
    const pop=t.layer('sort-list').art;area(t,'sort-outside','关闭排序',box(0,0,w,h),'sortGear');
    Object.entries(sorts).forEach(([id,name],i)=>{const b=box(sort.x,sort.y+sort.h+i*36,sort.w+12,36);
      pop.panel(b.x,b.y,b.w,b.h,{fill:id===data.gearSort?'#567c94':'#203747',stroke:'#7fa8bd',radius:2});words(pop,name,b.x+b.w/2,b.y+b.h/2,13);
      area(t,'sort-'+id,name,b,'sortGear',{value:id});
    });
  }
}

