import {detailSheet,sheetMetrics} from './detail-sheet.js';
import {createLobbyPanel} from './lobby-panel.js';
import {fmt,titleFont} from './menu-art.js';
import {nativeLabArt} from '../../replica/native-collection-art.js';
import {nativeLabView} from '../../replica/native-client-rules.js';
import {nativeWeaponDisplayText} from '../../replica/native-weapon-display.js';
import {UNLOCK_ALL_CONTENT} from '../../development-resources.js';

const plain=s=>nativeWeaponDisplayText(String(s||'').replace(/<[^>]*>/g,''));
function attr(value,names){
  const at=value.indexOf('='),key=value.slice(0,at).trim(),amount=value.slice(at+1).trim();
  return plain(names[key]||key)+' '+(Number(amount)>=0?'+':'')+amount+(key.endsWith('%')?'%':'');
}
const title=(rows,text)=>{rows.gap(8);rows.text(text,{family:titleFont,size:16,color:'#1b3d56',lineHeight:24});rows.gap(4);};
const line=(rows,text,extra={})=>{rows.text(text,{size:14,lineHeight:23,color:'#334f64',...extra});rows.gap(4);};
function section(rows,label,build){
  rows.gap(10);rows.line();rows.text(label,{family:titleFont,size:16,lineHeight:24,pad:10,weight:400});build();
}
function lab(rows,d,item){
  if(!item){line(rows,'项目不存在');return;}
  const {snapshot:s}=d,names=s.replicaCollection.attributeNames,view=nativeLabView(item,s.replicaCampaign);
  const current=item.levels.find(v=>v.level===item.level),next=view.next,atts=level=>level.attributes.map(v=>attr(v,names)).join(' · ');
  const op={id:item.id,revision:s.replicaCollection.revision};
  rows.art(nativeLabArt(item),96,96);line(rows,item.active?'当前等级 Lv.'+item.level:'尚未解锁');
  if(current){title(rows,'当前属性');line(rows,atts(current));}
  if(view.canActivate||item.active&&view.gate.reached&&next){
    rows.gap(8);rows.line();rows.gap(8);
    if(view.canActivate){title(rows,'技能待激活');current.skills.forEach(v=>line(rows,plain(v.name)+'：'+plain(v.description)));
      rows.action('activate','激活技能','nativeLabActivate',op);}
    else{title(rows,'升级至 Lv.'+next.level);line(rows,atts(next));
      next.skills.forEach(v=>line(rows,'本级解锁：'+plain(v.name)+'（升级后激活）'));
      view.currentCosts.forEach(c=>line(rows,c.name+'：'+fmt(c.available)+' / '+fmt(c.count),c.available<c.count?{color:'#ab3b43'}:{}));
      rows.action('upgrade','研究升级','nativeLabUpgrade',op,{disabled:!view.canUpgrade});}
    rows.gap(8);rows.line();rows.gap(8);
  }else if(view.gate.reached)line(rows,view.status);
  section(rows,'技能里程碑',()=>{for(const level of view.milestones){
    section(rows,'Lv.'+level.level+' · '+level.status+' · '+level.skills.map(v=>plain(v.name)).join('、'),
      ()=>level.skills.forEach(v=>line(rows,plain(v.description))));
  }});
  section(rows,'图纸获取',()=>{line(rows,'图纸可通过巡逻、快速巡逻、章节奖励和每日商店获得。');
    rows.action('patrol','前往巡逻领取','patrol');rows.gap(5);rows.action('rewards','查看章节奖励','chapterRewards');});
  if(UNLOCK_ALL_CONTENT)section(rows,'开发模式 · 等级预览',()=>{
    line(rows,'不消耗材料，直接应用该等级及此前全部技能。普通研究按钮仍按原表扣费。');
    rows.fold('level-list','研究等级 Lv.'+d.selected,d.selecting);
    if(d.selecting)for(const level of item.levels)rows.action('pick-'+level.level,'Lv.'+level.level,'select-level',{level:level.level},{height:40});
    rows.action('apply','应用预览等级','nativeLabLevel',{...op,level:d.selected});});
  section(rows,'全部等级属性与升级费用',()=>{for(const level of item.levels){
    section(rows,'Lv.'+level.level+(item.active&&item.level===level.level?' · 当前':''),()=>{
      line(rows,atts(level));line(rows,level.nextId?'升到下一级所需：'+level.costs.map(c=>c.name+' '+fmt(c.count)).join('、'):'最高等级');
    });}});
}
function stats(rows,d,result){
  if(!result){line(rows,'正在读取当前配置…');return;}
  if(result.error){line(rows,result.error);rows.action('reload','重新读取','nativeStats');return;}
  const attributes=values=>Object.entries(values).forEach(([k,v])=>line(rows,attr(k+'='+v,result.names)));
  title(rows,'战力 '+result.power);line(rows,'攻击 '+result.attack+' · 生命 '+result.hp);
  if(result.unsupported.length){line(rows,'当前配置包含未接通效果，暂不能正式出击：');result.unsupported.forEach(i=>line(rows,plain(i.description)));}
  title(rows,'合并属性');attributes(result.attributes);
  section(rows,'属性来源',()=>result.contributions.forEach(c=>section(rows,plain(c.name),()=>attributes(c.attributes))));
  section(rows,'初始技能',()=>result.skills.forEach(v=>line(rows,plain(v.name)+'：'+plain(v.description)+(v.supported?'':'（尚未接通）'))));
}
export function openLabPanel(screen,host,send){
  let model,version=0,selected,identity='',lastResult,lastKey;
  let selecting=false;const metrics=sheetMetrics(),panel=createLobbyPanel(screen,host,'科研', (d,w,h,t)=>{
    const labPanel=d.modal.type==='nativeLab',item=d.snapshot.replicaCollection?.labs.find(v=>v.id===d.modal.id);
    detailSheet(t,d,w,h,{title:labPanel?(item?item.name+'科研':'实验室'):'出击属性',build:rows=>labPanel?lab(rows,d,item):stats(rows,d,d.modal.result)});
  },c=>{
    if(c.type==='fold'){selecting=!selecting;refresh();return;}
    if(c.type==='select-level'){selected=c.data.level;selecting=false;refresh();return;}
    if(c.type!=='none')send(c.type,c.data||{},host);
  });
  function refresh(){panel.update({...model,selecting,selected,sheetMetrics:metrics,safeBottom:screen.menuView?.safeBottom||0},++version,identity);}
  return {host,close:panel.close,update(snapshot,modal,signature){
    const id=modal.type+'-'+modal.id,key=signature+'|'+snapshot.replicaCollection?.revision;
    if(id===identity&&lastResult===modal.result&&lastKey===key)return;
    if(id!==identity){selecting=false;metrics.counts.clear();selected=snapshot.replicaCollection?.labs.find(v=>v.id===modal.id)?.level;}
    identity=id;lastResult=modal.result;lastKey=key;model={snapshot,modal};refresh();
  }};
}
