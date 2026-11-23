import {createLobbyPanel} from './lobby-panel.js';
import {detailSheet,sheetMetrics} from './detail-sheet.js';
import {gearTitle,loadoutDetail,weaponSkills} from './loadout-detail.js';
import {actions,headingValue,hit,label,notice} from './supply-cards.js';
import {box,fmt,words} from './menu-art.js';
import {stars,normalFit} from './catalog-art.js';
import {fleetSkillDefinition} from '../../peripheral/fleet-skills.js';
import {aircraftUiImage} from '../../aircraft-ui-images.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';
import {pilotCardQuality} from '../../ui/pilot-card-quality.js';
import {recruitCard} from './recruit-card.js';

const panels=new Set(['weapon','weaponSkill','weaponSkillGroup','fleetOperation','fleetSkill','aircraftInfo','pilotInfo']);
export const supportsFleetPanel=type=>panels.has(type);
const pilotName=(g,kind)=>kind==='aircraft'?g.aircraftName||g.aircraft||g.name:g.name;
const picture=(g,kind)=>kind==='aircraft'?aircraftUiImage(g.id,'hangar'):g.avatar||g.image;
const rank=g=>Math.min(5,Math.max(0,Math.floor(g.stars||0)));
function drawFleet(r,d,g,kind){
  const {modal:m,snapshot:s}=d,current=rank(g),names=kind==='aircraft'?'战机':'驾驶员',name=pilotName(g,kind),title=picture(g,kind),own=g.owned&&!g.temporaryUnlocked;
  const skill=fleetSkillDefinition(kind,g),data={id:g.id,kind};
  if(m.type==='fleetSkill'){
    if(!skill)return;
    r.art(skill.image||projectIconUrl(skill.icon),62,62);label(r,skill.name);
    for(const level of [1,2,3,4,5])r.block(v=>{v.custom(21,(a,b)=>stars(a,r.t,box(b.x,b.y,level*15,15),level,g.owned&&current>=level?level:0));v.text(fleetSkillDefinition(kind,{...g,stars:level})?.description||'');});return;
  }
  if(m.type==='fleetOperation'){
    const result=m.result,activate=m.operation!=='starUp',target=result?current:activate?1:Math.min(5,current+1),copies=Math.max(0,g.copies||0),can=(activate?!own:own&&current<5)&&copies>=1;
    const change=fleetSkillDefinition(kind,{...g,stars:target}),op={...data,operation:activate?'activate':'starUp',revision:s.fleet?.revision??0};
    r.art(title,82,74);headingValue(r,name,(result?result.previousStars||0:current)+' → '+target+' 星');
    if(kind==='aircraft'&&!result&&!activate){headingValue(r,'攻击力',fmt(g.attack)+' → '+fmt(g.nextStarAttack??g.attack));headingValue(r,'耐久',fmt(g.hp)+' → '+fmt(g.nextStarHp??g.hp));}
    if(change)r.block(v=>{label(v,change.name);v.text(change.description);});if(!result)headingValue(r,'同名'+names+'卡',copies+' / 1');
    if(m.error)r.text(m.error,{color:'#a33335'});actions(r,result?[hit('confirm','确定','close')]:[hit('confirm',activate?'激活':current>=5?'已满星':'升星','fleetConfirm',op,!can),...(!can&&current<5?[hit('acquire','获取','fleetAcquire',op)]:[])]);return;
  }
  if(kind==='aircraft'){
    r.art(title,r.width*.72,r.width*.46);r.text('Lv.'+fmt(g.level||1)+' / '+fmt(g.maxLevel||50),{align:'center'});
    for(const [n,v,a] of [['攻击',g.attack,g.nextAttack],['耐久',g.hp,g.nextHp]])headingValue(r,n,fmt(v)+(g.owned&&g.level<(g.maxLevel||50)?' → '+fmt(a):''));
    label(r,'本机专武');r.text(g.weaponName||'');
    if(g.owned&&g.cost){headingValue(r,'金币',fmt(g.cost.coins||0));headingValue(r,'飞机碎片',fmt(g.cost.aircraftShards||0));}
    actions(r,[g.owned?hit('upgrade',g.level>=(g.maxLevel||50)?'已满级':'强化','upgrade',data,!g.canUpgrade):hit('unlock','激活','fleetUnlock',data)]);return;
  }
  const cw=Math.min(r.width*.67,200),ch=cw*1.64,note=g.temporaryUnlocked?'试玩':g.owned?'已激活':g.copies?'待激活':'未激活';
  r.custom(ch,(a,b)=>recruitCard(a,r.t,box(b.x+(b.w-cw)/2,b.y,cw,ch),{pilot:{...g,image:g.image||g.avatar},grade:pilotCardQuality(g.rarity,g.qualityRank,g.qualityKnown),rarity:g.rarity,note,raw:{}},{small:false,index:0,zone:'base',data:d}));
  r.text((g.rarity||'')+' · '+current+' / 5 星',{align:'center'});if(skill){label(r,skill.name);r.text(skill.description);}
  actions(r,[hit('grow',own?current>=5?'已满星':'升星':'激活',own?'fleetStar':'fleetUnlock',data,own&&current>=5)]);
}
export function openFleetPanel(screen,host,send){
  const metrics=sheetMetrics();let identity,entered=0;
  const panel=createLobbyPanel(screen,host,'装备资料',(d,w,h,t)=>{
    const m=d.modal,s=d.snapshot,weapon=m.type.startsWith('weapon'),kind=m.type==='aircraftInfo'?'aircraft':m.type==='pilotInfo'?'pilot':m.kind;
    const g=(weapon?s.weapons:kind==='aircraft'?s.aircraft:s.pilots)?.find(v=>String(v.id)===String(m.id)),result=m.result,activate=m.operation!=='starUp';
    const name=kind==='aircraft'?'战机':'驾驶员',title=weapon?gearTitle(m,g):m.type==='fleetSkill'?'技能预览':m.type==='fleetOperation'?(result?(activate?'激活成功':'升星成功'):activate?'激活'+name:name+'升星'):g?pilotName(g,kind):name;
    detailSheet(t,d,w,h,{title,secondary:weapon&&m.type!=='weapon',build:r=>{notice(r,s);
      if(!g){r.text('请返回列表重新选择。');return;}if(m.type==='weapon')loadoutDetail(r,d,g);else if(weapon)weaponSkills(r,m,g);else drawFleet(r,d,g,kind);}});
    return 'base';
  },cmd=>{if(!['holo','none'].includes(cmd.type))send(cmd.type,cmd.data||{},host);});
  return {host,close:panel.close,update(snapshot,modal,signature){const id=[modal.type,modal.id,modal.kind,modal.skillKey].join('|');
    if(id!==identity){entered=performance.now()/1000;panel.scroll('base',0);}identity=id;
    panel.update({snapshot,modal,entered,reduced:(screen.reducedMotion?.() ?? matchMedia('(prefers-reduced-motion: reduce)').matches),sheetMetrics:metrics,safeBottom:screen.menuView?.safeBottom||0},
      [id,signature,modal.operation,modal.error,modal.result?.previousStars,modal.targetSlot,modal.readonly,modal.requireSlotSelection].join('|'),id);}};
}
