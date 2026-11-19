import {createLobbyPanel} from './lobby-panel.js';
import {detailSheet,sheetMetrics} from './detail-sheet.js';
import {box,words} from './menu-art.js';
import {normalFit,skill} from './catalog-art.js';
import {paintItemDetail} from './item-details.js';
import {weaponShowcase} from './collection-showcase.js';
import {weaponPreview,skillPreview} from './collection-previews.js';
import {activation} from './collection-activation.js';
import {plain} from './catalog-model.js';
import {collectionDetailModel} from '../../ui/collection-detail-model.js';
import {nativeCollectionAccess,nativeCollectionRows} from '../../replica/native-collection-access.js';
import {nativeCollectionArt,nativeSkillArt} from '../../replica/native-collection-art.js';
import {qualityDisplayLabel} from '../../ui/quality-display-label.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';

const supported=new Set(['nativeCollectionDetail','nativeWeaponPreview','nativeSkillPreview','nativeCollectionOperation','aircraftActivation']);
export const supportsCollectionPanel=k=>supported.has(k);
const label=row=>row.maxed?'已满星':row.owned?'升星':'激活';
function pair(r,name,value,color='#254359'){
  r.custom(31,(a,b)=>{words(a,name,b.x,b.y+b.h/2,14,{align:'left',color:'#385468',weight:400,maxWidth:b.w*.64});words(a,value,b.x+b.w,b.y+b.h/2,14,{align:'right',color,weight:700,maxWidth:b.w*.48});});
}
function rule(r,data,icon,title,description){
  const w=r.width-78,ctx=data.sheetMetrics.context;ctx.font='400 14px "Microsoft YaHei", sans-serif';
  const count=String(description||'').split('\n').reduce((c,l)=>c+Math.max(1,Math.ceil(ctx.measureText(l).width/w)),0),height=Math.max(70,36+count*22);
  r.custom(height,(a,b)=>{
    a.quad(b.x,b.y,b.w,b.h,'#c5d6e2',.72);skill(a,r.t,icon||projectIconUrl('skill-tab'),box(b.x+5,b.y+(b.h-58)/2,58,58));
    const x=b.x+72;words(a,title,x,b.y+15,16,{align:'left',color:'#243d52',weight:700,maxWidth:w});
    const m=words(a,description,x,b.y+30,14,{align:'left',color:'#2a4357',weight:400,wrap:true,lineHeight:22,maxWidth:w});m.position.y+=m.userData.uiTextLines.length*11;
  });
}
function fleetDetail(d,w,h,t,row){
  const s=d.snapshot,col=s.replicaCollection,group=d.modal.kind,plane=group==='skins',args={kind:group,id:row.id,revision:col.revision};
  const access=nativeCollectionAccess(group,s,row),model=collectionDetailModel(row,col.attributeNames);
  const name=row.stage.skills.map(v=>plain(v.name)).join('、'),description=row.stage.skills.map(v=>plain(v.description)).join('\n');
  detailSheet(t,d,w,h,{title:row.name,secondary:true,width:w*.92,build:r=>{
    if(plane)r.custom(120,(a,b)=>normalFit(a,t,nativeCollectionArt(row,'default'),b,false,{x:.18,y:.12,width:.64,height:.76}));
    r.text((plane?row.star:row.owned?row.star:0)+' / '+(plane?5:model.maxStar)+' 星',{size:14,pad:5});
    if(plane){
      r.line();model.attributes.forEach(v=>pair(r,v.label,v.amount));r.line();r.text(name||'技能',{size:16,weight:700,pad:5});
      r.text(description);
    }else rule(r,d,row.stage.skills[0]&&nativeSkillArt(row.stage.skills[0]),name||(row.owned?'当前技能':'技能预览'),description||'当前星级无技能');
    if(!row.baseOnly){r.gap(8);r.action('grow',label(row),'nativeOperation',{...args,operation:row.owned?'star':'unlock'},{disabled:row.maxed||s.rewardPending||s.rewardBusy});}
    if(plane){
      if(!row.baseOnly&&!row.closed)r.text('获取：高级装备箱。重复获得同名卡用于升星。',{size:13,pad:5});
    }else{
      const quality=qualityDisplayLabel(row.qualityName,row.qualityKnown),state=access.collectionUsing?'使用中':row.baseOnly?'可用':access.activated?'已激活':'未激活';
      r.text([quality,state,...(!row.owned?[row.stage.star+' 星预览']:[])].filter(Boolean).join(' · '),{pad:5});
      if(model.attributes.length){r.text(row.owned?'收藏属性':'激活后收藏属性',{size:16,weight:700});r.line();model.attributes.forEach(v=>pair(r,v.label,v.amount));r.line();}
      if(!row.maxed)for(const c of row.costs)pair(r,c.name,c.available+' / '+c.count,c.available<c.count?'#a22e31':'#294e5e');
      r.gap(6);r.action('stars','星级效果','nativeSkillPreview',args);
    }
    if(access.activated||row.baseOnly){r.gap(6);r.action('equip',access.using?'使用中':'使用','nativeOperation',{...args,id:access.selectionId,operation:'select'},{disabled:!access.available||access.using});}
  }});
}
function operation(d,w,h,t,row){
  const m=d.modal,s=d.snapshot,group=m.kind,plane=group==='skins',receipt=m.result,op=receipt?m.operation:row.owned?'star':'unlock';
  const target=receipt?row.stage:row.stages.find(st=>st.star===(row.owned?row.star+1:row.defaultStar))||row.stage;
  const ns=plane?'战机':'驾驶员',title=receipt?(op==='unlock'?'激活成功':'升星成功'):op==='unlock'?'激活'+ns:ns+'升星';
  detailSheet(t,d,w,h,{title,width:.92*w,build:r=>{
    r.custom(74,(a,b)=>{normalFit(a,t,nativeCollectionArt(row,plane?'default':undefined),box(b.x,b.y,82,72),false,plane?{x:.18,y:.12,width:.64,height:.76}:null);
      words(a,row.name,b.x+96,b.y+24,17,{align:'left',color:'#17384c'});words(a,(receipt?receipt.previousStars:row.star)+' → '+target.star+' 星',b.x+96,b.y+49,14,{align:'left',color:'#345267'});});
    if(plane&&!receipt&&op==='star')for(const value of target.attributes||[]){const [key,n]=value.split('='),before=row.stage.attributes.find(v=>v.startsWith(key+'='))?.split('=')[1];
      pair(r,s.replicaCollection.attributeNames[key]||key,(before===undefined?'':before+' → ')+n);}
    if(target.skills.length)r.block(v=>{v.text(target.skills.map(sk=>plain(sk.name)).join('、'),{size:16,weight:700});v.text(target.skills.map(sk=>plain(sk.description)).join('\n'));});
    if(!receipt)for(const c of row.costs)pair(r,c.name,c.available+' / '+c.count,c.available<c.count?'#a22e31':'#294e5e');
    if(m.error)r.text(m.error,{color:'#a22e31'});r.gap(7);
    if(receipt)r.action('confirm','确定','close');
    else r.action('grow',label(row),'nativeOperation',{kind:group,id:row.id,revision:s.replicaCollection.revision,operation:op},{disabled:row.maxed||s.rewardPending||s.rewardBusy});
  }});
}
export function openCollectionPanel(screen,host,send){
  const metrics=sheetMetrics();let model,key,inspect=null,identity='',entered=0;
  function refresh(){if(model)panel.update({...model,inspect},String(key)+'|'+identity+'|'+(inspect?.itemId||''),identity);}
  const panel=createLobbyPanel(screen,host,'图鉴',(d,w,h,t)=>{
    const m=d.modal,g=m.type==='nativeWeaponPreview'?'guns':m.type==='aircraftActivation'?'skins':m.kind;
    const row=nativeCollectionRows(g,d.snapshot).find(v=>v.id===Number(m.id));
    if(!row)detailSheet(t,d,w,h,{title:m.type==='nativeCollectionOperation'?'内容已更新':'详情',build:r=>r.text(m.type==='nativeCollectionOperation'?'请返回列表重新选择。':'记录不存在')});
    else if(m.type==='nativeWeaponPreview')weaponPreview(d,w,h,t,row);
    else if(m.type==='nativeSkillPreview')skillPreview(d,w,h,t,row);
    else if(m.type==='aircraftActivation')activation(d,w,h,t,row);
    else if(m.type==='nativeCollectionOperation')operation(d,w,h,t,row);
    else if(g==='guns')weaponShowcase(d,w,h,t,row);else fleetDetail(d,w,h,t,row);
    if(inspect){paintItemDetail(d,w,h,t);return 'inspect';}return 'base';
  },cmd=>{
    if(cmd.type==='inspect'){inspect=cmd.data;panel.scroll('inspect',0);refresh();}
    else if(cmd.type==='close'&&inspect){inspect=null;refresh();}
    else if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  });
  return {host,close:panel.close,update(snapshot,modal,signature){
    const id=[modal.type,modal.kind,modal.id,modal.mode,modal.operation].join('|');
    if(identity!==id){entered=performance.now()/1000;inspect=null;panel.scroll('base',0);}identity=id;
    key=[signature,modal.error,modal.result?.previousStars,snapshot.replicaCollection.revision,snapshot.rewardBusy].join('|');
    model={snapshot,modal,sheetMetrics:metrics,reduced:matchMedia('(prefers-reduced-motion:reduce)').matches,entered,
      safeBottom:screen.menuView?.safeBottom||0,coverNavigation:!!host.closest('[data-subpage]:not([data-subpage=""])')};refresh();
  }};
}

