import {equippedSlots,slotLabel} from '../../ui/equipment-labels.js';
import {WEAPON_EQUIP_SLOTS} from '../../ui/weapon-equip-controls.js';
import {weaponCatalogSkills} from '../../ui/weapon-catalog-skills.js';
import {weaponIconUrl} from '../../ui/weapon-icon-source.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {box,fmt,qualityFrame,slice,words} from './menu-art.js';
import {normalFit} from './catalog-art.js';
import {actions,headingValue,hit,label} from './supply-cards.js';

const number=value=>value==null||value===''||!Number.isFinite(Number(value))?null:Number(value);
export function gearTitle(m,weapon){
  if(m.type==='weaponSkillGroup')return '局内成长';
  if(m.type==='weaponSkill')return weaponCatalogSkills(weapon).find(s=>s.key===m.skillKey)?.name||'武器技能';
  return weapon?.name||'武器详情';
}
export function weaponSkills(r,m,g){
  const skills=weaponCatalogSkills(g),group=m.type==='weaponSkillGroup',chosen=skills.find(v=>v.key===m.skillKey);
  r.custom(66,(a,b)=>{normalFit(a,r.t,weaponIconUrl(g.id),box(b.x+4,b.y,66,66));words(a,g.name,b.x+82,b.y+22,17,{align:'left',color:'#233e54'});
    const category=group?'局内升级效果':chosen?.kind==='tuning'?'战斗调校':chosen?.kind==='evolution'?'进化阶段 '+chosen.stage:'';
    if(category)words(a,category,b.x+82,b.y+47,13,{align:'left',color:'#526a80'});});r.gap(9);
  if(!group){if(!chosen)return;r.text(chosen.summary||chosen.description);if(chosen.note)r.text(chosen.note);if(chosen.kind!=='base')r.text('选取后仅本局生效。');return;}
  const groups=[['tuning','调校'],['evolution','进化']].map(([kind,name])=>({name,options:skills.filter(s=>s.kind===kind)})).filter(v=>v.options.length);
  if(!groups.length)r.text('暂无成长效果');
  for(const stage of groups){label(r,stage.name);for(const v of stage.options)r.block(p=>{label(p,v.name);p.text(v.summary||v.description);if(v.note)p.text(v.note,{size:12});});r.gap(9);}
  r.text('候选效果 · 选取后仅本局生效',{align:'center',size:12});
}
export function loadoutDetail(r,d,g){
  const {modal:m,snapshot:s}=d,rank=Math.max(0,Math.min(5,g.qualityRank||0)),fitted=equippedSlots(s,g.id),id=g.id,kind='weapon';
  const upgrade=g.owned&&!m.readonly,coin=number(g.cost?.coins),parts=number(g.cost?.weaponParts),priced=coin!==null&&parts!==null&&coin>=0&&parts>=0;
  const status=fitted.includes('W1')?'本机专武':fitted.length?'已装备 · '+fitted.map(slotLabel).join(' / '):g.owned?'未装备':'未解锁';
  r.art(weaponIconUrl(id),r.width*.44,r.width*.44,{frame:qualityFrame(rank),scale:.83});
  headingValue(r,g.level==null?'—':'Lv.'+fmt(g.level)+(g.maxLevel?' / '+fmt(g.maxLevel):''),status);
  if(upgrade)actions(r,[hit('star',rank>=5?'已满星':'升星','openWorkshop',{kind,id,mode:'quality'},rank>=5)]);
  const damage=number(g.damage??g.stats?.damage),next=number(g.nextDamage),interval=number(g.interval??g.stats?.interval);
  label(r,'装备技能');if(damage!==null&&damage>=0)headingValue(r,'基础伤害',String(damage)+(upgrade&&priced&&next>damage?' → '+next:''));
  if(interval!==null&&interval>0)headingValue(r,'攻击间隔',interval+' 秒');
  if(g.normal||g.description)r.text(g.normal||g.description);r.gap(8);
  if(m.readonly){actions(r,[hit('back','返回','close')]);return;}
  if(upgrade&&priced){const costs=[['coins','金币',coin],['parts','强化零件',parts]];
    r.grid(costs,2,(a,b,[key,name,n],show)=>{if(show){normalFit(a,r.t,RESOURCE_ICONS[key]?.url,box(b.x+3,b.y+5,25,25));
      const short=!(key==='coins'&&s.wallet.unlimited)&&(s.wallet[key==='parts'?'weaponParts':key]??Infinity)<n;
      words(a,fmt(n),b.x+34,b.y+18,15,{align:'left',color:short?'#a33335':'#203e54'});}},{height:36});}
  else if(upgrade)r.text(g.cost===null?g.levelLimitMessage||'已达当前等级上限':'暂不可强化');
  const buttons=[];
  if(!g.owned)buttons.push(hit('equip','前往商城宝箱','equipWeapon',{id}));
  else if(fitted.length){if(!fitted.includes('W1'))buttons.push(hit('unequip','卸下','unequipWeapon',{slot:fitted[0]}));}
  else{
    const equipped=slot=>{const value=s.loadout?.[slot];return s.weapons.find(v=>v.id===(value?.itemId||value?.id||value));};
    const target=WEAPON_EQUIP_SLOTS.includes(m.targetSlot)?m.targetSlot:m.requireSlotSelection?null:WEAPON_EQUIP_SLOTS.find(slot=>!equipped(slot))||'W3';
    label(r,'选择装配位置');r.grid(WEAPON_EQUIP_SLOTS,2,(a,b,slot,show)=>{const item=equipped(slot),title=slotLabel(slot),active=target===slot;
      if(show){a.quad(b.x,b.y,b.w,b.h,active?'#acd6e3':'#cadbe2');words(a,title+'   '+(active?'✓ 已选':item?'已装配':'空闲'),b.x+7,b.y+12,12,{align:'left',color:'#274d60'});
        if(item)normalFit(a,r.t,weaponIconUrl(item.id),box(b.x+4,b.y+20,26,26));words(a,item?.name||'可装配武器',b.x+33,b.y+34,12,{align:'left',maxWidth:b.w-36,color:'#263e4c'});}
      return hit(slot,title,'pickSlot',{slot});},{height:50});
    r.text(!target?'选择要替换的位置':equipped(target)?'替换「'+equipped(target).name+'」':slotLabel(target)+' · 空闲');
    buttons.push(hit('equip','装备','equipWeapon',{id},!target));
  }
  if(g.owned)buttons.push(hit('upgrade',g.cost===null?'等级上限':!priced?'暂不可强化':'升级','upgrade',{kind,id},!g.canUpgrade||!priced,true));
  actions(r,buttons);
}
