import {createLobbyPanel} from './lobby-panel.js';
import {art,box,pic,slice,words,button,area,qualityFrame,clamp,fmt,titleFont} from './menu-art.js';
import {paintLobbyPaper} from './panel-paper.js';
import {gearDetailIncrease,gearDetailSkills} from '../../ui/gear-detail-model.js';
import {GEAR_PARTS,GEAR_QUALITY_NAMES} from '../../peripheral/equipment-system.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {equipmentArtPath} from '../../replica/equipment-art.js';
import {workshopPanel,workshopTitles} from './workshop-panels.js';
import {sheetMetrics} from './detail-sheet.js';

const titles={gearAttributes:'战斗属性',gearDetail:'装备详情',gearMaterialInfo:'合成材料'};
const qualityInk=['#557080','#337e55','#296a91','#754a96','#93601c','#a43f42'];
export const supportsGearPanel=type=>Object.hasOwn(titles,type)||Object.hasOwn(workshopTitles,type);
function paper(t,data,w,h,width,height,header,a){
  return paintLobbyPaper(t,data,w,h,width,height,header,titles[data.modal.type],a);
}
function attributes(data,w,h,t){
  const s=data.snapshot,u=w/369.453,width=w*.86,header=61.6*u;
  const p=paper(t,data,w,h,width,290.1*u,header),innerX=p.x+19.6*u,bw=width-39.2*u;
  const rows=[['总攻击','attack',s.combatStats?.attack],['总耐久','durability',s.combatStats?.maxHp],
    ['装备攻击','attack',s.equipment.totals.attack],['装备耐久','durability',s.equipment.totals.hp]];
  let y=p.top;
  rows.forEach(([label,icon,value],i)=>{
    const total=i<2,rh=(total?46.8:44.3)*u;
    p.a.quad(innerX,y,bw,rh,total?'#dceaf2':'#c6d9e6');p.a.quad(innerX,y+rh-1,bw,1,'#8eaabd');
    const cy=y+rh/2;pic(p.a,t,art['stat-'+icon],box(innerX+11*u,cy-13*u,26*u,26*u));
    words(p.a,label,innerX+44*u,cy,clamp(w*.04,14,20),{align:'left',weight:400,color:'#1d394d'});
    const n=Number.isFinite(value)?fmt(value):'—';
    words(p.a,total?n:'+'+n,innerX+bw-11*u,cy,clamp(w*(total ? .057 : .045),total?20:16,total?29:23),{align:'right',color:'#1d394d',weight:700});
    y+=rh+4.4*u+(i===1?7.4*u:0);
  });
}
const skillColors={20:'#26766b',30:'#2872a6',40:'#8550af',50:'#a66e1c',60:'#b74750'};
function detail(data,w,h,t){
  const s=data.snapshot,g=s.equipment,item=g.items.find(i=>i.uid===data.modal.id),u=w/369.453,width=.92*w;
  if(!item){
    const p=paper(t,data,w,h,width,162*u,61.6*u);
    words(p.a,'装备已变化，请关闭后重新选择。',w/2,p.top+24*u,14,{color:'#425d71'});return;
  }
  // Measure actual wrapped skill text and reserve the footer before clipping the scroll area.
  const frame=t.layer('gear-paper').art;
  const bodyX=(w-width)/2+23.7*u,bw=width-47.4*u,block=t.layer('gear-content','base');
  const a=block.art,left=bodyX,header=49.3*u,ink='#203b51',quality=qualityInk[item.qualityRank]||qualityInk[0];
  const heroH=item.canDowngrade&&item.equipped?141:97.7;
  const commands=[];
  a.quad(left,0,bw,heroH,'#bdcfdb');a.quad(left,heroH-1,bw,1,'#8aa2b3');
  const side=72,ix=left+10,iy=(heroH-side)/2,tx=ix+side+12,ty=10;
  slice(a,t,qualityFrame(item.qualityRank),box(ix,iy,side,side),10,18);
  pic(a,t,'/'+equipmentArtPath(item.art),box(ix+side*.08,iy+side*.155,side*.84,side*.69),true);
  pic(a,t,art['slot-badge-'+item.type],box(ix-9.8,iy-9.8,32.5,32.5));
  const text=(v,x,y,size,opts={})=>words(a,v,x,y,size,{align:'left',weight:400,color:ink,...opts});
  text(item.name,tx,ty+13,clamp(w*.046,17,20),{family:titleFont,color:'#17374e',maxWidth:left+bw-tx-10});
  const gradeBox=box(tx,ty+31,Math.max(42,item.qualityName.length*12+16),20);
  a.panel(gradeBox.x,gradeBox.y,gradeBox.w,gradeBox.h,{cut:0,fill:'#e0edf1',stroke:quality,opacity:1});
  text(item.qualityName,tx+8,ty+41,12,{color:quality,weight:700});
  text((item.equipped?'已装配':'未装配')+(item.locked?' · 已锁定':''),tx+gradeBox.w+8,ty+41,12,{color:'#344f63'});
  text('等级',tx,ty+65,13,{color:'#344f63'});text('Lv.'+item.level+' / '+item.maxLevel,tx+36,ty+65,13,{color:quality,weight:700});
  if(item.canDowngrade&&item.equipped){
    const b=box(tx,ty+80,Math.min(106,left+bw-tx-6),42);button(a,t,b,{title:'降阶',titleSize:13});
    commands.push({id:'downgrade',label:'降阶',b,type:'gearDowngradePreview'});
  }
  let y=heroH+8;
  a.quad(left,y,bw,37.6,'#dce8ef');
  const stat=text(item.attributeName+' +'+fmt(item.attribute),left+11,y+19,16,{weight:700});
  const inc=gearDetailIncrease(item);
  if(inc!=null)text('(+'+fmt(inc)+')',stat.position.x+stat.scale.x/2+8,y+19,16,{color:'#23734a',weight:700});
  y+=45.6;
  const skillHeader=y;
  const panel=a.quad(left,y,bw,35,'#d4e0e9');a.quad(left,y,bw,35,'#a8bdce');
  text('装备技能',left+10,y+17.5,14,{weight:700,color:'#243f53'});y+=38;
  for(const skill of gearDetailSkills(item)){
    const q=Object.hasOwn(skillColors,skill.quality)?skill.quality:20,sz=13;
    pic(a,t,'/art/equipment-skill-'+(skill.unlocked?'unlocked':'lock')+'-v1/'+q+'.webp',box(left+9,y+4,18,18),true);
    const row=text(skill.text,left+33,y,sz,{color:skill.unlocked?skillColors[q]:'#4c6172',weight:skill.unlocked?700:400,maxWidth:bw-42,wrap:true,lineHeight:18});
    const rh=Math.max(26,8+row.userData.uiTextLines.length*18);row.position.y+=rh/2;y+=rh;
  }
  y+=4;panel.position.y=(y+skillHeader)/2;panel.scale.y=-(y-skillHeader);
  if(data.modal.error){
    const note=text(data.modal.error,left,y,13,{color:'#ad3b3b',wrap:true,maxWidth:bw,lineHeight:18});
    const rh=note.userData.uiTextLines.length*18+8;note.position.y+=rh/2;y+=rh;
  }
  const showCosts=item.equipped&&item.cost,footH=48+(showCosts?36:0)+20;
  const ph=Math.min(h*.85,header+y+footH+25.7*u);
  const p=paper(t,data,w,h,width,ph,header,frame);
  for(const mesh of a.group.children)mesh.position.y+=p.top;
  const innerH=Math.max(1,ph-header-footH-25.7*u);
  t.region('base',box(left,p.top,bw,innerH),y);
  for(const c of commands)area(t,c.id,c.label,{...c.b,y:c.b.y+p.top},c.type,{id:item.uid},'base');
  const foot=t.layer('gear-actions').art,fy=p.top+innerH+14;
  if(showCosts){
    const part=g.blueprints.find(p=>p.type===item.type),blueprint=GEAR_PARTS.find(p=>p.type===item.type)?.blueprintId,coins=g.wallet||s.wallet;
    const rows=[[nativeItemArt(blueprint),part?.count||0,item.cost.blueprints],[nativeItemArt(1),coins.unlimited?'∞':coins.coins,item.cost.coins]];
    rows.forEach(([url,current,cost],i)=>{
      const x=w/2+(i?4:-78)*u;pic(foot,t,url,box(x,fy,24,26),true);
      const m=words(foot,current==='∞'?current:fmt(current),x+27,fy+13,14,{align:'left',color:Number(current)<cost?'#ad3b3b':'#247349',weight:700});
      words(foot,'/'+fmt(cost),m.position.x+m.scale.x/2,fy+13,14,{align:'left',color:ink,weight:400});
    });
  }
  const actions=item.equipped?[['gearUnequip','卸下'],['gearUpgrade','升级',!item.canUpgrade],['gearUpgradeAll','一键升级',!item.canUpgrade]]:
    [['gearEquip',g.items.some(i=>i.type===item.type&&i.equipped)?'替换':'装备']];
  const full=bw+4*u,bwidth=item.equipped?(full-16)/3:full*.58;
  actions.forEach(([type,title,disabled],i)=>{
    const b=box(item.equipped?left-2*u+i*(bwidth+8):(w-bwidth)/2,fy+(showCosts?36:0),bwidth,48);
    if(type==='gearUpgrade'||type==='gearUpgradeAll')pic(foot,t,art['gear-upgrade-'+(disabled?'off':'on')],b);
    else slice(foot,t,item.equipped?'/art/psd-buttons-v1/button-blue.png':'/art/psd-equipment-v1/button-gold.png',b,9);
    words(foot,title,b.x+b.w/2,b.y+24,item.equipped?clamp(w*.035,12,16):20,{family:titleFont,color:disabled?'#bac8d2':'#edf4f7'});
    area(t,type,title,b,type,{id:item.uid},null,disabled);
  });
}
function material(data,w,h,t){
  const g=data.snapshot.equipment,{part,quality}=data.modal;
  const p=paper(t,data,w,h,w*.92,254*w/369.453,61.6*w/369.453),x=p.x+w*.06,bw=w*.8;
  const name=g.blueprints.find(i=>i.type===part)?.name||'',grade=GEAR_QUALITY_NAMES[quality]||'';
  [[name+' · '+grade+'材料',15,700],['拥有 ×'+fmt(g.fodder[part+':'+quality]||0),13,400],
    ['用于同部位的'+grade+'装备升阶，不能替代指定系列装备。',13,400],['来源：装备品质降阶。',13,400]].forEach(([text,size,weight],i)=>{
    words(p.a,text,x,p.top+[14,46,83,125][i]*w/369.453,size,{align:'left',color:'#344f63',weight,wrap:true,maxWidth:bw});
  });
}
export function openGearPanel(screen,host,send){
  const metrics=sheetMetrics();
  const panel=createLobbyPanel(screen,host,'装备',(data,w,h,t)=>{
    if(Object.hasOwn(workshopTitles,data.modal.type))workshopPanel(data,w,h,t);
    else if(data.modal.type==='gearAttributes')attributes(data,w,h,t);
    else if(data.modal.type==='gearMaterialInfo')material(data,w,h,t);
    else detail(data,w,h,t);
    return 'base';
  },command=>{if(command.type!=='none')send(command.type,command.data||{},host);});
  return {host,close:panel.close,update(snapshot,modal,signature){
    const id=modal.type+'|'+(modal.id||'')+'|'+(modal.part||'')+'|'+(modal.quality||'');
    panel.update({snapshot,modal:{...modal},sheetMetrics:metrics,coverNavigation:screen.menuView?.page?.closest('[data-subpage="workshop"]')!=null,safeBottom:parseFloat(getComputedStyle(host).paddingBottom)||0},
      [signature,id,modal.revision,modal.error,snapshot.equipment?.revision,modal.mode,modal.filter,modal.tokens,modal.materialIds?.join(','),modal.plan?.token,modal.drawn?.join(',')].join('|'),id);
  }};
}

