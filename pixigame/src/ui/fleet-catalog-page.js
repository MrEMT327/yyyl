import { characterPortrait } from './character-portraits.js';
import { projectIcon, projectIconUrl } from './project-ui-art.js';
import { lobbyCost } from './lobby-cost.js';
import { FLEET_FILTERS, fleetSkillDefinition, fleetSkillSnapshot } from '../peripheral/fleet-skills.js';
import { emptySlotMark } from './psd-empty-slot.js';
import './fleet-catalog-page.css';
import './pilot-catalog-avatars.css';

const names={aircraft:'战机',pilot:'驾驶员'};
const titleOf=(item,kind)=>kind==='aircraft'?item.aircraftName||item.aircraft||item.name:item.name;
const rank=item=>Math.min(5,Math.max(0,Math.floor(Number(item?.stars)||0)));
const attrs=(item,kind,e)=>`data-id="${e(item.id)}" data-kind="${kind}"`;
const button=(action,label,extra='',cls='',disabled=false)=>`<button type="button" class="wc-button ${cls}" data-action="${action}" ${extra}${disabled?' disabled':''}>${label}</button>`;
const stars=(item,cls='')=>`<span class="wc-stars fc-stars ${cls}" aria-label="${rank(item)}星">${Array.from({length:5},(_,i)=>projectIcon('star',i<rank(item)?'':'is-icon-muted')).join('')}</span>`;
const portrait=(item,kind,h,cls='')=>kind==='pilot'?h.img(item.avatar||item.image,item.name,cls):h.thumbnail(item.id,cls);
const costs=(item,s,h)=>item.cost?lobbyCost(h,{label:'金币',icon:'coin',amount:item.cost.coins||0,available:s.wallet?.coins})+lobbyCost(h,{label:'飞机碎片',icon:'shard',amount:item.cost.aircraftShards||0,available:s.wallet?.aircraftShards}):'';
const copies=item=>Math.max(0,Number(item.copies)||0);
const persistent=item=>item.owned&&!item.temporaryUnlocked;
function bankFor(kind,snapshot) {
  return snapshot.fleet?.[kind]||fleetSkillSnapshot(kind,kind==='pilot'?snapshot.pilots||[]:snapshot.aircraft||[],kind==='pilot'?[snapshot.pilotId]:[]);
}
function skillIcon(skill,cls='') {
  return skill?.image?`<img class="fc-skill-icon ${cls}" src="${String(skill.image).replaceAll('&','&amp;').replaceAll('"','&quot;')}" alt="">`:skill?projectIcon(skill.icon,`fc-skill-icon ${cls}`):emptySlotMark(`fc-skill-icon ${cls}`);
}

export function fleetCatalogPage({kind='aircraft',snapshot:s={},selectedId,skillTab=false,filter='all',filterOpen=false,selectedSkillSlot=null,pendingSkillId=null,helpers:h}) {
  const {escape:e,number:n}=h,items=(kind==='aircraft'?s.aircraft:s.pilots)||[];
  const activeId=kind==='aircraft'?s.aircraftId:s.pilotId;
  const selected=items.find(i=>i.id===selectedId)||items.find(i=>i.id===activeId)||items[0];
  if(!selected)return '<section class="ref-catalog wc-page fc-page"><p>暂无内容</p></section>';
  // PilotViewModule separates SelectedPilotId from DisplayPilotId. A skill-slot
  // operation belongs to the deployed roster, not the avatar currently browsed.
  const displayed=skillTab?(items.find(i=>i.id===activeId)||selected):selected;
  const bank=bankFor(kind,s),revision=s.fleet?.revision??0,skill=bank.skills.find(x=>x.id===selected.id)||fleetSkillDefinition(kind,selected);
  const extra=attrs(selected,kind,e),isUsing=selected.id===activeId;
  const primary=!selected.owned
    ? button('fleetUnlock',`<strong>激活</strong><small>${portrait(selected,kind,h)}${n(copies(selected))}/1</small>`,extra,'fc-operation')
    : button(kind==='aircraft'?'selectAircraft':'selectPilot',selected.temporaryUnlocked?isUsing?'试玩中':'试玩':isUsing?'使用中':'使用',extra,`fc-operation${isUsing?' is-using':''}`,isUsing);
  const starButton=selected.temporaryUnlocked?button('fleetUnlock',`<strong>激活</strong><small>${portrait(selected,kind,h)}${n(copies(selected))}/1</small>`,extra,'fc-operation')
    :persistent(selected)&&rank(selected)<5?button('fleetStar',`<strong>升星</strong><small>${portrait(selected,kind,h)}${n(copies(selected))}/1</small>`,extra,'fc-operation is-star-up'):'';
  const heroArt=kind==='aircraft'?`<div class="ref-catalog-aircraft-model fc-aircraft-model" aria-label="${e(titleOf(displayed,kind))}">${h.preview?.(displayed.id,{name:titleOf(displayed,kind)})||portrait(displayed,kind,h)}</div>`
    :h.pilotPortrait?.(displayed,'fc-pilot-portrait')||characterPortrait(displayed,'fc-pilot-portrait')||h.img(displayed.image,displayed.name,'fc-pilot-portrait');
  const skillPreview=skill&&!skillTab?`<button type="button" class="fc-unlock-skill" data-action="fleetSkillPreview" ${extra} aria-label="查看${e(skill.name)}技能预览">${skillIcon(skill)}<span>${selected.temporaryUnlocked?'试玩技能':persistent(selected)?'已获得':'激活后获得'}</span></button>`:'';
  const slot=(id,index,compact=false)=>{
    const equipped=bank.skills.find(x=>x.id===id),chosen=selectedSkillSlot===index;
    return `<button type="button" class="fc-skill-slot${chosen?' is-selected':''}${pendingSkillId?' is-replace-target':''}${compact?' is-compact':''}" data-action="fleetSkillSlot" data-kind="${kind}" data-slot="${index}" aria-pressed="${chosen}" aria-label="技能位置${index+1}，${equipped?e(equipped.name):'空闲'}"><span class="fc-slot-index">${index+1}</span>${skillIcon(equipped)}${!compact&&equipped?`<span class="fc-slot-name">${e(equipped.name)}</span>`:''}</button>`;
  };
  const selecting=skillTab&&selectedSkillSlot!=null;
  const slots=skillTab?`${selecting?'<button type="button" class="fc-skill-cancel-area" data-action="fleetSkillCancel" aria-label="取消技能选择"></button>':''}<div class="fc-skill-group" aria-label="已装备技能">${bank.slots.map((id,index)=>slot(id,index)).join('')}</div>`
    :kind==='pilot'?`<aside class="fc-worn-skills"><span>当前<br>装备技能</span>${bank.slots.map((id,index)=>slot(id,index,true)).join('')}</aside>`:'';
  const filters=s.catalogPresentation?.filters||FLEET_FILTERS;
  const activeFilter=filters.some(option=>option.id===filter)?filter:'all';
  const filtered=items.filter(item=>activeFilter==='owned'?item.owned:activeFilter==='locked'?!item.owned:activeFilter==='all'||(s.catalogPresentation?.skillFor(item)||fleetSkillDefinition(kind,item))?.category===activeFilter);
  const cards=filtered.map(item=>{
    const chosen=item.id===selected.id,using=item.id===activeId,def=s.catalogPresentation?.skillFor(item)||fleetSkillDefinition(kind,item);
    const label=`${titleOf(item,kind)}，${rank(item)}星${item.temporaryUnlocked?'，试玩':item.owned?'':'，未激活'}${using?item.temporaryUnlocked?'中':'，使用中':''}`;
    return `<div class="fc-item-wrap${chosen?' is-selected':''}"><button type="button" class="wc-item fc-item${item.owned?'':' is-locked'}" data-action="catalogSelect" ${attrs(item,kind,e)} data-rarity="${e(item.rarity||'R')}" aria-label="${e(label)}" aria-pressed="${chosen}"><span class="fc-card-art${kind==='pilot'?' fc-avatar':''}">${portrait(item,kind,h)}</span><span class="fc-card-type" aria-hidden="true">${skillIcon(def)}</span>${stars(item)}${using?projectIcon('check','fc-worn-check'):''}${!item.owned?projectIcon('lock','wc-lock'):''}${chosen?'<i class="fc-browse-corners" aria-hidden="true"></i>':''}</button></div>`;
  }).join('');
  // Native PilotRootController uses three effect rows until a slot is selected;
  // only its selection state creates the wearable rows with Equip/Remove.
  const visibleSkills=selecting?bank.skills.filter(x=>x.owned):bank.slots.map((id,index)=>({...(bank.skills.find(x=>x.id===id)||{}),slot:index}));
  const rows=visibleSkills.map(row=>{
    const equipped=Boolean(row.id)&&row.slot>=0,extra2=`data-kind="${kind}" data-id="${e(row.id||'')}" data-revision="${revision}"`;
    const rowAction=selecting?button(equipped?'fleetSkillRemove':'fleetSkillEquip',equipped?'卸下':'装备',`${extra2}${equipped?` data-slot="${row.slot}"`:''}`,'fc-row-action'):'';
    return `<article class="fc-skill-row${equipped?' is-equipped':''}${selecting?' is-wearable':' is-effect'}" data-skill-id="${e(row.id||'')}" data-skill-slot="${row.slot}"><button type="button" class="fc-row-preview" data-action="${row.id?'fleetSkillPreview':'fleetSkillSlot'}" ${extra2} data-slot="${row.slot}" aria-label="${row.id?`查看${e(row.name)}技能预览`:`选择位置${row.slot+1}的技能`}">${skillIcon(row.id?row:null)}${equipped?`<b>${row.slot+1}</b>`:''}</button><p>${e(row.description||'未装备')}</p>${rowAction}</article>`;
  }).join('');
  const filterLabel=filters.find(x=>x.id===activeFilter)?.label||'全部';
  const options=filterOpen&&!skillTab&&kind==='pilot'?`<button class="fc-filter-dismiss" data-action="fleetFilterClose" aria-label="关闭筛选"></button><div class="fc-filter-options" role="menu" aria-label="驾驶员类型">${filters.map(x=>`<button type="button" class="psd-option" role="menuitemradio" aria-checked="${activeFilter===x.id}" data-action="fleetFilterSet" data-filter="${x.id}">${x.label}</button>`).join('')}</div>`:'';
  return `<section class="ref-catalog wc-page fc-page fc-${kind}" data-catalog-kind="${kind}" data-catalog-mode="${skillTab?'skills':'list'}" data-catalog-selected="${e(selected.id)}" data-display-id="${e(displayed.id)}" aria-label="${names[kind]}目录">
    <div class="fc-hero" aria-hidden="true"></div><img class="fc-platform" src="${import.meta.env?.BASE_URL??'/'}art/project-fleet-stage-v2/platform.png" alt="" aria-hidden="true" draggable="false">
    <div class="fc-identity"><h1><button type="button" class="fc-info" data-action="${kind==='aircraft'?'aircraftInfo':'pilotInfo'}" ${attrs(displayed,kind,e)} aria-label="查看${e(titleOf(displayed,kind))}详情">${e(titleOf(displayed,kind))}${projectIcon('info','fc-info-icon')}</button></h1>${stars(displayed,'fc-header-stars')}${kind==='aircraft'?`<p class="fc-header-stats"><span>攻击力 <b>${n(displayed.attack||0)}</b></span><span>耐久 <b>${n(displayed.hp||0)}</b></span></p>`:''}</div>
    ${heroArt}${skillPreview}${slots}${!skillTab?`<div class="fc-hero-actions">${primary}${starButton}</div>`:''}
    <header class="wc-heading fc-heading">${kind==='pilot'&&!skillTab?button('catalogFilter','筛选',`aria-label="筛选驾驶员，当前${filterLabel}" aria-expanded="${filterOpen}" aria-haspopup="menu"`,'fc-filter'):''}<h2>${skillTab?selecting?'选择技能':'技能效果':`${names[kind]}列表`}</h2></header>
    <div class="ref-catalog-scroll wc-scroll fc-scroll${skillTab?' fc-skill-list':''}" data-catalog-scroll="${kind}:${skillTab?selecting?'skills-select':'skills':'list'}">${skillTab?rows||'<p class="fc-empty">暂无可携带的技能</p>':`<div class="wc-grid fc-grid">${cards}</div>${filtered.length?'':'<p class="fc-empty">暂无符合条件的驾驶员</p>'}`}</div>
    <nav class="wc-footer fc-footer" aria-label="${names[kind]}子页面">${button('catalogBack','返回','aria-label="返回装备"','wc-back')}<span aria-hidden="true"></span>${button('catalogMode',`${projectIcon(kind==='aircraft'?'nav-battle':'nav-recruit','wc-tab-icon')}<span>${names[kind]}</span>`,`data-mode="list" aria-pressed="${!skillTab}"`,`wc-mode${skillTab?'':' is-active'}`)}${button('catalogMode',`${projectIcon('skill-tab','wc-tab-icon')}<span>技能</span>`,`data-mode="skills" aria-pressed="${skillTab}"`,`wc-mode${skillTab?' is-active':''}`)}</nav>${options}
  </section>`;
}

export function fleetCatalogSkills({kind,item,snapshot,helpers:h,showGrowthRule=true,skillFor=fleetSkillDefinition}) {
  const {escape:e}=h,skill=skillFor(kind,item);
  if(!skill)return '';
  return `<article class="fc-skill-rule"><div class="fc-skill-rule-art">${skillIcon(skill)}</div><div><h3>${e(skill.name)}</h3><p>${e(skill.description)}</p></div></article>`;
}

export function fleetSkillPreview({kind,item,helpers:h,skillFor=fleetSkillDefinition,levels=[1,2,3,4,5]}) {
  const {escape:e}=h,skill=skillFor(kind,item);if(!skill)return null;
  return {title:skill.name,content:`<article class="fc-skill-preview"><header>${skillIcon(skill)}<div><h3>${e(skill.ownerName)}</h3><p>${rank(item)} / 5 星</p></div></header><p class="fc-current-effect">${e(skill.description)}</p><div class="fc-skill-levels">${levels.map(level=>`<section class="${item.owned&&rank(item)>=level?'is-unlocked':'is-locked'}"><details><summary>${level} 星${item.owned&&rank(item)===level?' · 当前':''}</summary><p>${e(skillFor(kind,{...item,stars:level}).description)}</p></details></section>`).join('')}</div></article>`};
}

export function fleetAircraftDetail({aircraft:a,snapshot:s,helpers:h}) {
  if(!a)return '';const {escape:e,number:n}=h;
  const stat=(label,current,next)=>`<div><span>${label}</span><b>${n(current)}</b>${a.owned&&a.level<(a.maxLevel||50)?`<span class="fc-detail-next">→ ${n(next)}</span>`:''}</div>`;
  return `<article class="fc-detail"><div class="fc-detail-art">${portrait(a,'aircraft',h)}</div><p>Lv.${n(a.level||1)} / ${n(a.maxLevel||50)}</p><div class="fc-detail-stats">${stat('攻击',a.attack,a.nextAttack)}${stat('耐久',a.hp,a.nextHp)}</div><h3>本机专武</h3><p>${e(a.weaponName||'')}</p>${a.owned?`<div class="fc-detail-cost">${costs(a,s,h)}</div>${button('upgrade',a.level>=(a.maxLevel||50)?'已满级':a.canUpgrade?'强化':'材料不足',attrs(a,'aircraft',e),'fc-detail-button',!a.canUpgrade)}`:button('fleetUnlock','激活',attrs(a,'aircraft',e),'fc-detail-button')}</article>`;
}
export function fleetPilotDetail({pilot,snapshot,helpers:h,skillFor=fleetSkillDefinition}) {
  if(!pilot)return '';const {escape:e}=h;
  return `<article class="fc-detail"><p>${e(pilot.rarity||'')} · ${rank(pilot)} / 5 星</p>${fleetCatalogSkills({kind:'pilot',item:pilot,snapshot,helpers:h,skillFor})}${button(persistent(pilot)?'fleetStar':'fleetUnlock',persistent(pilot)?rank(pilot)>=5?'已满星':'升星':'激活',attrs(pilot,'pilot',e),'fc-detail-button',persistent(pilot)&&rank(pilot)>=5)}</article>`;
}

export function fleetOperationModal({kind,item,snapshot:s,operation='activate',result,helpers:h,error=''}) {
  if(!item)return {title:'内容已更新',content:'请返回列表重新选择。'};
  const {escape:e,number:n}=h,isResult=Boolean(result),current=rank(item);
  const target=isResult?current:operation==='activate'?1:Math.min(5,current+1);
  const skill=fleetSkillDefinition(kind,{...item,stars:target});
  const available=copies(item),can=operation==='activate'?(!persistent(item)&&available>=1):(persistent(item)&&current<5&&available>=1);
  const title=isResult?(operation==='activate'?'激活成功':'升星成功'):operation==='activate'?`激活${names[kind]}`:`${names[kind]}升星`;
  const extra=`${attrs(item,kind,e)} data-operation="${operation}" data-revision="${s.fleet?.revision??0}"`;
  const starLine=isResult?`${n(result.previousStars||0)} → ${n(current)} 星`:`${n(current)} → ${n(target)} 星`;
  const nextStats=kind==='aircraft'&&!isResult&&operation==='starUp'?`<div class="fc-operation-stats"><p><span>攻击力</span><b>${n(item.attack)} → ${n(item.nextStarAttack??item.attack)}</b></p><p><span>耐久</span><b>${n(item.hp)} → ${n(item.nextStarHp??item.hp)}</b></p></div>`:'';
  return {title,content:`<article class="fc-operation-preview"><header><span class="fc-operation-portrait">${portrait(item,kind,h)}</span><div><h3>${e(titleOf(item,kind))}</h3><p>${starLine}</p></div></header>${nextStats}<section class="fc-operation-effect"><h4>${e(skill?.name||'')}</h4><p>${e(skill?.description||'')}</p></section>${!isResult?`<div class="fc-card-cost">${portrait(item,kind,h)}<span>同名${names[kind]}卡</span><b class="${available<1?'is-short':''}">${n(available)} / 1</b></div>`:''}${error?`<p class="fc-operation-error" role="status">${e(error)}</p>`:''}<div class="fc-operation-actions">${isResult?button('close','确定','','fc-detail-button'):button('fleetConfirm',can?operation==='activate'?'激活':'升星':current>=5?'已满星':'同名卡不足',extra,'fc-detail-button',!can)+(!can&&current<5?button('fleetAcquire','获取',extra,'fc-detail-button'):'')}</div></article>`};
}
