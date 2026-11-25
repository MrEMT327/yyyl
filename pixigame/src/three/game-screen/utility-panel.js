import {createLobbyPanel} from './lobby-panel.js';
import {detailSheet,sheetMetrics} from './detail-sheet.js';
import {area,box,button,clamp,fmt,pic,qualityFrame,slice,words} from './menu-art.js';
import {normalFit,stars,symbol} from './catalog-art.js';
import {actions,headingValue,hit,label,notice} from './supply-cards.js';
import {developerSkillsEnabled} from '../../developer-battle-settings.js';
import {DEVELOPER_CURRENCY_GRANTS} from '../../developer-tools.js';
import {PILOT_AFFECTION_MAX,PILOT_AFFECTION_VISIBLE} from '../../peripheral/pilot-affection.js';
import {nativeLabProgressGate} from '../../replica/native-client-rules.js';
import {copyDiagnosticReport} from '../../diagnostic-log.js';
import {campaignMapForStage} from '../campaign-map-catalog.js';
import {playerInfoModel} from '../../ui/player-info-model.js';
import {weaponIconUrl} from '../../ui/weapon-icon-source.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {aircraftUiImage} from '../../aircraft-ui-images.js';
import utilityArt from './utility-art.json';

const titles={debug:'开发工具',developerDiagnostics:'诊断日志',formation:'出战阵容',activities:'活动',mail:'航线邮件',chapters:'章节地图',stages:'章节地图'};
export const supportsUtilityPanel=type=>Object.hasOwn(titles,type);
function developer(r,d){
  const {snapshot:s,modal:m}=d,revision=s.nativeAcquisition.revision,busy=s.rewardBusy,pending=s.rewardPending;
  const p=PILOT_AFFECTION_VISIBLE?s.pilots?.find(v=>v.id===s.pilotId):null;
  const lab=nativeLabProgressGate(s.replicaCampaign).reached,chap=s.replicaCampaign?.developmentChaptersUnlocked===true;
  const command=(id,text,cmd,args={},disabled=false)=>r.action(id,text,cmd,args,{height:44,disabled,titleSize:15});
  r.text('开发资源按需领取，局内技能可单独开启。下方领取的资源会写入当前存档，正常消费。');r.gap(12);
  command('diagnostics','诊断日志','developerDiagnostics');r.gap(12);headingValue(r,'金币 '+fmt(s.wallet.coins),'钻石 '+fmt(s.wallet.diamonds));
  for(const [currency,g] of Object.entries(DEVELOPER_CURRENCY_GRANTS)){command('grant-'+currency,g.name+' +'+fmt(g.amount),'developerCurrency',{currency,revision},busy||pending);r.gap(12);}
  command('chapters',chap?'所有关卡已解锁':'解锁所有关卡','developerChaptersUnlock',{revision},busy||pending||chap);
  r.text('开放全部关卡选择，解锁状态随存档保存。通关记录与星级奖励按实际战斗结算。',{pad:7});r.gap(5);
  command('research',lab?'科研界面已解锁':'解锁科研界面','developerResearchUnlock',{revision},busy||pending||lab);
  r.text('提前开放科研入口，解锁状态随存档保存。科研项目仍按章节条件开放，升级照常消耗金币和图纸。',{pad:7});
  if(p){const max=p.affection===PILOT_AFFECTION_MAX;command('affection',max?'好感度已满':'好感度拉满','developerAffectionMax',{pilot:p.id},busy||pending||max);
    r.text(p.name+' · '+fmt(p.affection)+' / '+PILOT_AFFECTION_MAX,{pad:6});}
  command('skills','局内全部技能：'+(developerSkillsEnabled()?'已开启':'未开启'),'developerSkills');r.text('开启后，下次出击可直接选择全部武器、升级、驾驶员和飞机技能；仅影响局内体验。',{pad:6});
  if(busy||pending)r.text('请先完成当前操作或保存奖励，再领取开发资源。',{color:'#97521c'});
  r.line();r.gap(7);label(r,'一键清档 · 恢复新手档');r.text('删除本网址的全部游戏进度、资源、装备、领取记录及旧档备份，然后重新开始。不会删除其他网站或其他应用的数据。');
  r.gap(5);command('reset',m.clearArmed?'确认清档并重新开始':'一键清档，重建新手档','debugClear',{},busy);
  if(m.clearArmed)r.text('此操作无法撤销；再次点击确认。关闭面板即可取消。',{color:'#a52f39',pad:6});if(m.error)r.text(m.error,{color:'#a52f39'});
}
function chapters(r,d){
  const s=d.snapshot,list=s.stages||[];headingValue(r,'章节进度',list.filter(v=>v.bestCleared).length+' / '+list.length);r.gap(6);
  r.grid(list,1,(a,b,v,show)=>{const i=v.index,current=i===s.selectedStageIndex,locked=v.unlocked===false;
    if(show){const map=campaignMapForStage(i);normalFit(a,r.t,map.previewUrl||map.artUrl,b,true);
      a.quad(b.x,b.y,b.w,b.h,current?'#163d53':'#122536',locked?.83:.65);
      words(a,String(i+1).padStart(2,'0'),b.x+14,b.y+b.h/2,20,{align:'left'});words(a,(v.waveCount||15)+' 波',b.x+60,b.y+12,11,{align:'left',color:'#c2deea'});
      words(a,v.name,b.x+60,b.y+32,17,{align:'left',maxWidth:b.w*.55});stars(a,r.t,box(b.x+60,b.y+47,49,13),3,v.stars||0);
      if(locked)symbol(a,r.t,'lock',box(b.x+b.w-39,b.y+b.h/2-11,22,22));
      else words(a,current?'当前战区':v.bestCleared?'已通关':'可挑战',b.x+b.w-14,b.y+b.h/2,12,{align:'right'});}
    return hit('stage-'+i,'第 '+(i+1)+' 章 '+v.name,'stage',{index:i},locked);
  },{height:70});
}
function activities(r,d){
  const s=d.snapshot,p=s.patrol||{},si=s.signIn||{},supply=s.pilotSupply,all=s.tasks||[];
  const readiness=period=>supply?((period==='daily'?supply.activity:supply.week).milestones||[period==='daily'?supply.activity:supply.week]).filter(x=>x.canClaim).length+
    (period==='daily'?supply.tasks:supply.week.tasks||[]).filter(x=>x.canClaim).length:all.filter(x=>x.type===period&&x.claimable).length+(s.activity?.[period]?.items||[]).filter(x=>x.claimable).length;
  const count=readiness('daily')+readiness('weekly')+(s.achievements?.items||[]).filter(v=>v.claimable).length;
  const task=supply?'每日 '+supply.tasks.filter(v=>v.claimed||v.canClaim).length+' / '+supply.tasks.length+' · 每周活跃 '+supply.week.points+' / 100':
    ['daily','weekly'].map((type,i)=>(i?'每周 ':'每日 ')+all.filter(v=>v.type===type&&v.progress>=v.target).length+' / '+all.filter(v=>v.type===type).length).join(' · ');
  const ready=p.unlocked&&!p.clockRollback&&!p.nativeSettlementPending&&Object.values(p.rewards||{}).some(v=>v>0),mins=Math.max(0,p.storedMinutes||0);
  const entries=[['signin','签到','已签到 '+fmt(si.claimedCount||0)+(si.referenceLayout?'':' / 7')+' 天',si.completed?'已领完':si.canClaim?'今日可领':'今日已领'],
    ['tasks','任务中心',task,count?fmt(count)+' 项奖励可领':'查看任务'],['patrol','巡逻',p.unlocked?(p.native?'查看巡逻收益与奖励预览':'已累计 '+Math.floor(mins/60)+' 小时 '+mins%60+' 分钟'):'',p.unlocked?(p.native&&!p.sampleBased?'查看':ready?'奖励可领':'巡逻中'):'']];
  r.text('向下滑动查看更多',{align:'right',size:12,color:'#526f84'});
  for(const [id,name,desc,status] of entries){r.block(c=>{headingValue(c,name,status?(s.rewardPending?'奖励待保存':s.rewardBusy?'奖励处理中':status):'');
    if(desc)c.text(desc);actions(c,[hit(id,'前往',id)]);});r.gap(8);}
}
function formation(r,d){
  const s=d.snapshot,m=playerInfoModel(s),p=m.pilot,plane=m.aircraft,stat=v=>Number.isFinite(v)?fmt(v):'—';
  headingValue(r,'出战战力',stat(m.power));headingValue(r,'攻击 '+stat(m.attack),'耐久 '+stat(m.hp));
  const units=[[p?.name||'未选择驾驶员','驾驶员 · '+fmt(p?.stars||0)+'星',p?.avatar||p?.image],
    [plane?.aircraftName,'战机 · '+(m.native?fmt(plane?.stars)+'星':'Lv.'+fmt(plane?.level)),plane?.id&&aircraftUiImage(plane.id,'hangar')||plane?.image]];
  r.grid(units,2,(a,b,[name,detail,img])=>{a.quad(b.x,b.y,b.w,b.h,'#c6d8e2');normalFit(a,r.t,img,box(b.x+4,b.y+3,b.w-8,b.h-42));words(a,detail,b.x+b.w/2,b.y+b.h-28,12,{color:'#39576d'});words(a,name,b.x+b.w/2,b.y+b.h-12,15,{color:'#1e3e54',maxWidth:b.w-4});},{height:105});
  label(r,p?.passive?.name||p?.skillName||'');r.text(p?.passive?.description||p?.passiveDescription||'');
  const card=(a,b,[it,caption])=>{slice(a,r.t,qualityFrame(it?.qualityRank||0),b,7);
    words(a,caption,b.x+b.w/2,b.y+12,12,{maxWidth:b.w-4});
    if(it)normalFit(a,r.t,it.nativeRow?nativeCollectionArt(it.nativeRow):weaponIconUrl(it.id),box(b.x+3,b.y+21,b.w-6,b.h-54));else words(a,'＋',b.x+b.w/2,b.y+b.h*.5,17,{color:'#b9cad4'});
    words(a,it?.name||'空槽',b.x+b.w/2,b.y+b.h-22,12,{maxWidth:b.w-4});if(it)words(a,it.nativeRow?fmt(it.stars)+' 星':'Lv.'+fmt(it.level),b.x+b.w/2,b.y+b.h-8,11);};
  r.grid([[m.main,m.native?'出战主武器':'本机专武 · 槽1／槽2']],1,card,{height:106});r.gap(6);
  if(m.weapons.length)r.grid(m.weapons.map(({slot,item})=>[item,'槽'+slot.slice(1)]),Math.min(4,m.weapons.length),card,{height:88});
  r.gap(8);actions(r,[hit('equipment','调整装备','tab',{tab:'assembly'})]);
}
export function openUtilityPanel(screen,host,send){
  const metrics=sheetMetrics();let state,key,identity,copyStatus='',clipboardField=null;
  function refresh(){panel.update(state,[key,identity,copyStatus,developerSkillsEnabled(),state.modal.clearArmed,state.modal.error].join('|'),identity);}
  const panel=createLobbyPanel(screen,host,'大厅',(d,w,h,t)=>{const type=d.modal.type;
    detailSheet(t,d,w,h,{title:titles[type],width:.92*w,build:r=>{notice(r,d.snapshot);if(type==='debug')developer(r,d);
      else if(type==='developerDiagnostics'){actions(r,[hit('copy','复制诊断','copy')]);if(copyStatus)r.text(copyStatus,{color:'#375c68',size:13});
        r.block(c=>c.text(d.modal.report,{size:12,lineHeight:18,family:'Consolas,monospace',color:'#203449'}),{color:'#d7e3e9',alpha:1,pad:8});}
      else if(type==='activities')activities(r,d);else if(type==='formation')formation(r,d);else if(type==='mail'){
        headingValue(r,'收件箱','0 封');r.art(utilityArt.mail,w*.50,w*.4);r.text('暂无新邮件',{align:'center',size:17,weight:700,pad:8});
        r.custom(25,(a,b)=>symbol(a,t,'nav-battle',box(w/2-12,b.y,24,24)));
      }else chapters(r,d);
    }});return 'base';
  },async cmd=>{
    if(cmd.type==='copy'){
      if(screen.copyText){const copied=await screen.copyText(state.modal.report);if(!panel.closed){copyStatus=copied?'已复制':'复制失败';refresh();}return;}
      clipboardField?.remove();const field=host.ownerDocument.createElement('textarea');field.value=state.modal.report;field.readOnly=true;
      field.setAttribute('aria-label','诊断日志内容');field.style.cssText='position:absolute;inset:0;width:1px;height:1px;opacity:0;pointer-events:none';host.append(field);clipboardField=field;
      const ok=await copyDiagnosticReport(field);if(!host.isConnected||field!==clipboardField)return;
      copyStatus=ok?'已复制':'请手动复制已选中的日志';if(ok){field.remove();clipboardField=null;}refresh();return;
    }
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  });
  return {host,close(){clipboardField?.remove();clipboardField=null;panel.close();},update(snapshot,modal,signature){
    if(identity!==modal.type){copyStatus='';panel.scroll('base',0);}identity=modal.type;key=signature;
    state={snapshot,modal,sheetMetrics:metrics,safeBottom:screen.menuView?.safeBottom||0};refresh();
  }};
}

