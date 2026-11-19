import './player-info-showcase.css';
import {equipmentArtPath} from '../replica/equipment-art.js';
import {nativeCollectionArt,nativeSkillArt} from '../replica/native-collection-art.js';
import {aircraftUiImage} from '../aircraft-ui-images.js';
import {supplyWeaponArt} from './supply-visuals.js';
import {portraitPresentation} from './character-portraits.js';
import {playerAvatar} from './player-avatar.js';
import {playerInfoModel} from './player-info-model.js';
import {emptySlotMark} from './psd-empty-slot.js';
import {projectIcon} from './project-ui-art.js';
import {rewardDisplayQuality} from '../replica/item-display-quality.js';
import {itemInspectAttributes} from './item-description-model.js';
import {skillEffectText} from './skill-effect-text.js';
import {weaponDeploymentGate} from '../replica/native-weapon-loadout.js';
import {gearTypeBadge} from './airframe-equipment-page.js';

export const PLAYER_INFO_PAGES=Object.freeze([{id:'avatar',label:'头像'},{id:'frame',label:'头像框'},{id:'card',label:'名片'},{id:'info',label:'个人信息'}]);
export const PLAYER_INFO_TABS=Object.freeze([{id:'pilot',label:'驾驶员'},{id:'aircraft',label:'战机'},{id:'weapon',label:'武器'},{id:'equipment',label:'装备'}]);
const base=import.meta.env?.BASE_URL??'/';
const count=value=>Math.max(0,Math.floor(Number(value)||0));
const unique=rows=>[...new Map(rows.filter(Boolean).map(row=>[String(row.id),row])).values()];
export function playerInfoReferenceItems(snapshot,kind){
  const m=playerInfoModel(snapshot);
  if(kind==='pilot')return unique([m.pilot,...m.pilotsOwned]);
  if(kind==='aircraft')return unique([m.aircraft,...m.aircraftOwned]);
  if(kind==='weapon')return snapshot.replicaCollection?unique([m.main&&{...m.main,id:String(m.main.nativeRow.id)},...snapshot.replicaCollection.guns.filter(row=>row.owned).map(row=>({...row,id:String(row.id),nativeRow:row,stars:row.star}))]):unique([m.main,...(snapshot.weapons||[]).filter(row=>row.owned)]);
  return [];
}
export function playerInfoReferenceSkills(snapshot,kind,selectedId){
  const collection=snapshot.replicaCollection;
  if(collection){
    let rows,ids;
    if(kind==='pilot'){rows=collection.pilots;ids=collection.pilotSlots;}
    if(kind==='aircraft'){rows=collection.skins;ids=collection.slots;}
    if(kind==='weapon'||kind==='weapon-secondary'){
      rows=collection.guns;
      const id=kind==='weapon-secondary'?collection.useWeaponMap?.[1]:Number(selectedId)||collection.useWeaponMap?.[0]||rows.find(row=>row.equipped)?.id;
      ids=collection.weaponSkillMap?.[rows.find(row=>row.id===id)?.weaponType]||[0,0];
    }
    return (ids||[]).map(id=>{const row=rows?.find(row=>row.id===id&&row.owned),skill=row?.stage?.skills?.[0];return row?{id:row.id,name:skill?.name||row.name,image:nativeSkillArt(skill),description:(row.stage?.skills||[]).map(skill=>skill.description).join('\n')}:null;});
  }
  const bank=snapshot.fleet?.[kind];return (bank?.slots||[]).map(id=>bank.skills?.find(row=>row.id===id)||null);
}
export function playerInfoSkillModal(snapshot,modal,h){
  const skill=modal.skill;
  return {title:skill?.name||'技能详情',content:`<article class="pi-skill-detail">${skill?.image||nativeSkillArt(skill)?h.img(skill?.image||nativeSkillArt(skill),'',''):''}<p>${skillEffectText(skill?.description||'暂无技能说明',h.escape)}</p></article>`};
}
export function playerInfoPanel(snapshot,modal,h,callsign=''){
  const {escape:e,number:n,img,thumbnail}=h,m=playerInfoModel(snapshot,callsign);
  const page=PLAYER_INFO_PAGES.some(row=>row.id===modal.profilePage)?modal.profilePage:'card';
  const tab=PLAYER_INFO_TABS.some(row=>row.id===modal.profileTab)?modal.profileTab:'pilot';
  const empty=emptySlotMark();
  const qualityAttributes=(item,kind)=>{const q=rewardDisplayQuality({...item,type:kind});return `data-psd-quality="${q.qualityRank}" data-quality-known="${Boolean(item&&q.qualityKnown)}"`;};
  const gearArt=item=>img(base+equipmentArtPath(item.art),item.name||'','pi-item-art');
  const weaponArt=item=>item.nativeRow?img(nativeCollectionArt(item.nativeRow),item.name,'pi-item-art'):supplyWeaponArt(item,thumbnail);
  const tile=(item,label,art,type)=>`<div class="pi-slot ${item?'':'is-empty'}" ${qualityAttributes(item,item?.nativeRow?'weapon':'gear')} ${item?itemInspectAttributes(item.nativeId??item.nativeRow?.id,e):''}><span class="pi-slot-label">${e(label)}</span>${item?art(item):empty}<span class="pi-slot-level">${item?(item.nativeRow?`${n(item.stars)} 星`:`Lv.${n(item.level||1)}`):'未装配'}</span>${type?gearTypeBadge({type,part:label},h,'pi-equipment-type'):''}</div>`;
  const plane=(item=m.aircraft)=>img(aircraftUiImage(item?.id,'equipment'),item?.aircraftName||item?.name||'当前战机','pi-plane');
  const nav=(items,current,cls,action,key,label)=>`<div class="${cls}" role="tablist" aria-label="${label}">${items.map(item=>`<button type="button" class="wc-button psd-tab" role="tab" id="pi-${key}-${item.id}" aria-controls="pi-${key}-panel" aria-selected="${item.id===current}" tabindex="${item.id===current?0:-1}" data-action="${action}" data-${key}="${item.id}"><span class="pi-page-face" aria-hidden="true"></span>${item.label}</button>`).join('')}</div>`;
  const rename=snapshot.playerRename,renameReady=Boolean(rename&&Number.isSafeInteger(rename.cost)&&Number.isSafeInteger(rename.revision));
  const renameLabel=renameReady?(rename.free?'免费保存':`保存${n(rename.cost)}钻`):'改名费用待同步';
  const renameHint=renameReady?(rename.free?`首次改名免费；之后每次${n(rename.paidCost)}钻石。`:`本次改名消耗 ${n(rename.cost)} 钻石。`):'改名费用待同步，请重新打开。';
  const identityName=modal.editingName?`<div class="pi-rename"><label for="player-name">玩家名字</label><input id="player-name" data-player-name value="${e(modal.nameDraft??m.name)}" maxlength="24" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-describedby="player-name-hint" ${modal.nameError?'aria-invalid="true"':''}><small id="player-name-hint">${e(modal.nameError||`2–12 个字符。${renameHint}`)}</small><div><button type="button" class="wc-button" data-action="playerRenameCancel">取消</button><button type="button" class="wc-button" data-action="playerRenameSave" data-rename-revision="${renameReady?rename.revision:''}" data-rename-cost="${renameReady?rename.cost:''}" data-rename-name="${e(snapshot.playerName||m.name)}" ${!renameReady||!rename.canRename?'disabled':''}>${renameLabel}</button></div></div>`:`<h3>${e(m.name)}</h3><button type="button" class="wc-button pi-rename-button" data-action="playerRename" aria-label="修改玩家名字">改名</button>`;

  const showcase=(equipment=false)=>`<section class="pi-showcase ${equipment?'pi-equipment-map':''}" aria-label="当前装备"><img class="pi-showcase-platform" src="${base}art/project-fleet-stage-v2/platform.png" alt="" aria-hidden="true" draggable="false"><div class="pi-showcase-plane">${plane()}</div>${equipment?'':`<strong class="pi-showcase-name">${e(m.aircraft?.aircraftName||m.aircraft?.name||'未选择战机')}</strong>`}<div class="pi-showcase-weapon">${tile(m.main,'主武器',weaponArt)}</div><div class="${equipment?'pi-gear-map':'pi-gear-rail'}" aria-label="已装配装备">${m.gear.map(({item,label,type},index)=>`<div class="pi-gear-position pi-gear-${index}">${tile(item,label,gearArt,type)}</div>`).join('')}</div></section>`;
  const skills=(list,kind,amount=3)=>`<div class="pi-reference-skills" aria-label="已携带技能">${Array.from({length:amount},(_,index)=>{const skill=list[index],art=skill?.image||nativeSkillArt(skill);return `<button type="button" class="pi-reference-skill ${skill?'':'is-empty'}" data-action="playerInfoSkill" data-kind="${kind}" data-index="${index}" ${skill?'':'disabled'} aria-label="${skill?e(skill.name):`技能位置${index+1}，空`}"><span class="pi-skill-number">${index+1}</span>${skill?(art?img(art,'',''):empty):'<span class="pi-skill-empty">空</span>'}</button>`;}).join('')}</div>`;
  const referenceInfo=()=>{
    if(tab==='equipment')return `<section class="pi-reference-info" id="pi-tab-panel" role="tabpanel" aria-labelledby="pi-tab-equipment">${showcase(true)}</section>`;
    const items=playerInfoReferenceItems(snapshot,tab),active=items.find(item=>String(item.id)===modal.profilePreview?.[tab])||items[0];
    const model=tab==='pilot'?img(active?portraitPresentation(active).image:'',active?.name||'','pi-reference-pilot'):tab==='aircraft'?plane(active):active?weaponArt(active):'';
    const gate=weaponDeploymentGate(snapshot.replicaCollection?.playerLevel||1);
    const secondary=gate.secondUnlocked?snapshot.replicaCollection?.guns.find(row=>row.id===snapshot.replicaCollection.useWeaponMap?.[1]&&row.owned):null;
    const stage=tab==='weapon'?`<div class="pi-reference-weapon-pair ${gate.showSecond?'':'is-single'}"><div class="pi-reference-weapon-model">${model}</div>${gate.showSecond?`<div class="pi-reference-weapon-model ${secondary?'':'is-empty'}">${secondary?weaponArt({...secondary,nativeRow:secondary}):`<span class="pi-weapon-unmounted">${gate.secondUnlocked?'第二武器位<br>未装备':`${projectIcon('lock')}第二武器位<br>${gate.unlockLevel}级解锁`}</span>`}</div>`:''}${skills(playerInfoReferenceSkills(snapshot,'weapon',active?.id),'weapon',2)}${gate.showSecond&&gate.secondUnlocked?skills(playerInfoReferenceSkills(snapshot,'weapon-secondary'),'weapon-secondary',2):''}</div>`:`<div class="pi-reference-model pi-reference-model-${tab}">${model}</div>${skills(playerInfoReferenceSkills(snapshot,tab),tab)}`;
    return `<section class="pi-reference-info" id="pi-tab-panel" role="tabpanel" aria-labelledby="pi-tab-${tab}"><div class="pi-reference-stage pi-reference-stage-${tab} ${tab==='weapon'&&!gate.showSecond?'is-single-weapon':''}">${(tab==='weapon'&&gate.showSecond?['is-left','is-right']:['']).map(cls=>`<img class="pi-reference-platform ${cls}" src="${base}art/project-fleet-stage-v2/platform.png" alt="" aria-hidden="true" draggable="false">`).join('')}${stage}</div><h3 class="pi-reference-list-heading">${{pilot:'驾驶员',aircraft:'战机',weapon:'武器'}[tab]}列表</h3><div class="pi-reference-roster" aria-label="${{pilot:'驾驶员',aircraft:'战机',weapon:'武器'}[tab]}列表">${items.map(item=>`<button type="button" class="pi-reference-card" data-action="playerInfoPreview" data-kind="${tab}" data-id="${e(item.id)}" ${qualityAttributes(item,tab)} aria-pressed="${item.id===active?.id}" aria-label="查看${e(item.name)}">${tab==='pilot'?img(item.avatar||item.image,item.name,''):tab==='aircraft'?plane(item):weaponArt(item)}<span class="pi-reference-stars" aria-label="${count(item.stars)}星">${Array.from({length:5},(_,i)=>projectIcon('star',i<count(item.stars)?'':'is-icon-muted')).join('')}</span>${item.id===active?.id?projectIcon('check','pi-reference-selected'):''}</button>`).join('')}</div></section>`;
  };
  let content='',footer='';
  const appearance=snapshot.playerAppearance;
  if(page==='card')content=showcase();
  else if(page==='info')content=`${referenceInfo()}${nav(PLAYER_INFO_TABS,tab,'pi-tabs','playerInfoTab','tab','个人信息分类')}`;
  else if(appearance){
    const kind=page,items=kind==='avatar'?appearance.avatars.filter(row=>row.id!=='auto'):appearance.frames;
    const using=kind==='avatar'&&appearance.avatar==='auto'?appearance.currentPilotId:appearance[kind];
    const chosen=items.find(row=>row.id===modal.appearanceSelection?.[kind])||items.find(row=>row.id===using)||items[0];
    const current=chosen.id===using,locked=chosen.available===false;
    const visual=row=>playerAvatar(snapshot,h,kind==='avatar'?{avatar:row.id}:{frame:row.id});
    content=`<section class="pi-appearance" aria-label="${kind==='avatar'?'头像':'头像框'}选择"><div class="pi-appearance-preview"><div><h3>${e(chosen.name)}</h3><strong>${current?'使用中':locked?'未解锁':'已选中'}</strong></div></div><div class="pi-appearance-grid">${items.map(row=>`<button type="button" class="pi-appearance-item ${row.id===chosen.id?'is-selected':''}" data-action="playerAppearanceSelect" data-kind="${kind}" data-id="${row.id}" aria-pressed="${row.id===chosen.id}" aria-label="${e(row.name)}${row.available===false?'，未解锁':''}${row.id===using?'，使用中':''}">${visual(row)}${row.available===false?projectIcon('lock','pi-avatar-lock'):''}${row.id===chosen.id?`<img class="pi-appearance-check" src="${base}art/equipment-controls-v1/check.svg" alt="" aria-hidden="true">`:''}</button>`).join('')}</div></section>`;
    footer=`<footer class="pi-appearance-footer"><p role="status">${e(modal.appearanceError||'')}</p><button type="button" class="wc-button" data-action="playerAppearanceSave" data-kind="${kind}" data-id="${chosen.id}" data-revision="${appearance.revision}" ${current||locked?'disabled':''}>${current?'使用中':locked?'未解锁':'切换'}</button></footer>`;
  }
  return {title:'个人信息',content:`<div class="pi-profile pi-card-layout pi-video-layout pi-strict-layout" data-profile-page="${page}" data-profile-tab="${tab}"><header class="pi-identity"><div class="pi-avatar">${playerAvatar(snapshot,h)}</div><div class="pi-identity-copy"><small>指挥官${m.native?` · Lv.${n(m.accountLevel)}`:''}</small><div class="pi-name-row">${identityName}</div><div class="pi-summary"><div class="pi-power"><span>战力</span><b>${Number.isFinite(m.power)?n(m.power):'—'}</b></div><div class="pi-progress"><small>最高通关</small><strong>${e(m.progress)}</strong></div></div></div></header>${nav(PLAYER_INFO_PAGES,page,'pi-pages','playerInfoPage','page','个人资料')}<div class="pi-content" id="pi-page-panel" role="tabpanel" aria-labelledby="pi-page-${page}" tabindex="0">${content}</div>${footer}</div>`};
}
