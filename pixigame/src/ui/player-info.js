import {nativeCollectionArt} from '../replica/native-collection-art.js';
import {aircraftUiImage} from '../aircraft-ui-images.js';
import {supplyWeaponArt} from './supply-visuals.js';

export const PLAYER_INFO_TABS = Object.freeze([
  {id:'equipment',label:'装备'}, {id:'weapon',label:'武器'},
  {id:'aircraft',label:'战机'}, {id:'pilot',label:'驾驶员'},
]);
const base=import.meta.env?.BASE_URL??'/';
import {emptySlotMark} from './psd-empty-slot.js';
import {playerInfoModel} from './player-info-model.js';
const count=value=>Math.max(0,Math.floor(Number(value)||0));

export function playerInfoPanel(snapshot,modal,h,callsign='') {
  const {escape:e,number:n,img,thumbnail}=h,m=playerInfoModel(snapshot,callsign);
  const tab=PLAYER_INFO_TABS.some(item=>item.id===modal.profileTab)?modal.profileTab:'equipment';
  const stars=item=>`<span class="pi-stars" aria-label="${count(item?.stars)}星">${'★'.repeat(Math.min(5,count(item?.stars)))}${'☆'.repeat(5-Math.min(5,count(item?.stars)))}</span>`;
  const empty=emptySlotMark();
  const portrait=item=>item?.id==='pilot-06'?`${base}art/psd-equipment-v1/pilot-06-crew-portrait.png`:item?.image;
  const avatar=item=>item?.avatar||item?.image;
  const gearArt=item=>img(`${base}art/project-flight-gear-v1/${e(item.art)}.webp`,'','pi-item-art');
  const weaponArt=item=>item.nativeRow?img(nativeCollectionArt(item.nativeRow),item.name,'pi-item-art'):supplyWeaponArt(item,thumbnail);
  const tile=(item,label,art,cls='')=>`<div class="pi-slot ${cls} ${item?'':'is-empty'}" data-psd-quality="${count(item?.qualityRank)}"><span class="pi-slot-label">${e(label)}</span>${item?art(item):empty}<span class="pi-slot-level">${item?(item.nativeRow?`${n(item.stars)} 星`:`Lv.${n(item.level||1)}`):'未装配'}</span><span class="pi-sr">${e(item?.name||'')}</span></div>`;
  const plane=()=>img(aircraftUiImage(m.aircraft?.id,'equipment'),m.aircraft?.name||'当前战机','pi-plane');
  const stats=()=>`<dl class="pi-stats"><div><dt>总攻击</dt><dd>${Number.isFinite(m.attack)?n(m.attack):'—'}</dd></div><div><dt>总耐久</dt><dd>${Number.isFinite(m.hp)?n(m.hp):'—'}</dd></div></dl>`;
  const skills=kind=>{
    const list=m.skills(kind);
    return `<section class="pi-skill-list"><h3>已携带技能 <small>${list.length}${m.native&&kind==='pilot'?'':' / 3'}</small></h3>${list.length?list.map(skill=>`<article><strong>${e(skill.name)}</strong><p>${e(skill.description||'')}</p></article>`).join(''):'<p class="pi-note">暂无携带技能</p>'}</section>`;
  };
  const roster=(items,kind)=>`<section class="pi-roster"><h3>${kind==='pilot'?'已拥有驾驶员':m.native?'已激活战机':'已拥有战机'} <small>${items.length}</small></h3><div class="pi-roster-list">${items.map(item=>`<div class="pi-roster-item ${item.id===(kind==='pilot'?m.pilot?.id:m.aircraft?.id)?'is-current':''}">${kind==='pilot'?img(avatar(item),'',''):thumbnail(item.id)}<span>${e(kind==='aircraft'?item.aircraftName||item.name:item.name)}</span>${item.id===(kind==='pilot'?m.pilot?.id:m.aircraft?.id)?'<b>出战</b>':''}</div>`).join('')||'<p class="pi-note">暂无已激活收藏</p>'}</div></section>`;
  let content='';
  const rename=snapshot.playerRename,renameReady=Boolean(rename&&Number.isSafeInteger(rename.cost)&&Number.isSafeInteger(rename.revision));
  const renameLabel=renameReady?(rename.free?'免费保存':`保存${n(rename.cost)}钻`):'改名费用待同步';
  const renameHint=renameReady?(rename.free?`首次改名免费；之后每次${n(rename.paidCost)}钻石。`:`本次改名消耗 ${n(rename.cost)} 钻石。${rename.canRename?'':'当前钻石不足。'}`):'改名费用待同步，请重新打开。';
  const identityName=modal.editingName?`<div class="pi-rename"><label for="player-name">玩家名字</label><input id="player-name" data-player-name value="${e(modal.nameDraft??m.name)}" maxlength="24" autocomplete="off" spellcheck="false" enterkeyhint="done" aria-describedby="player-name-hint" ${modal.nameError?'aria-invalid="true"':''}><small id="player-name-hint">${e(modal.nameError||`2–12 个字符。${renameHint}`)}</small><div><button type="button" class="wc-button" data-action="playerRenameCancel">取消</button><button type="button" class="wc-button" data-action="playerRenameSave" data-rename-revision="${renameReady?rename.revision:''}" data-rename-cost="${renameReady?rename.cost:''}" data-rename-name="${e(snapshot.playerName||m.name)}" ${!renameReady||!rename.canRename?'disabled':''}>${renameLabel}</button></div></div>`:`<h3>${e(m.name)}</h3><button type="button" class="wc-button pi-rename-button" data-action="playerRename" aria-label="修改玩家名字">改名</button>`;
  if(tab==='equipment') content=`<section class="pi-loadout" aria-label="当前机体装备"><div class="pi-loadout-plane">${plane()}<strong>${e(m.aircraft?.aircraftName||m.aircraft?.name||'未选择战机')}</strong></div>${tile(m.main,'主武器',weaponArt,'pi-pos-0')}${m.gear.map(({item,label},i)=>tile(item,label,gearArt,`pi-pos-${i+1}`)).join('')}</section>${stats()}`;
  if(tab==='weapon') content=`<section class="pi-primary-weapon">${tile(m.main,'主武器',weaponArt)}<div><small>${m.native?'出战主武器':'本机专武'}</small><h3>${e(m.main?.name||'尚未选择')}</h3></div></section>`;
  if(tab==='aircraft') content=`<section class="pi-aircraft-hero">${plane()}<h3>${e(m.aircraft?.aircraftName||m.aircraft?.name||'未选择战机')}</h3><div>${m.native?'':`Lv.${n(m.aircraft?.level||1)}`} ${stars(m.aircraft)}</div></section>${stats()}${skills('aircraft')}${roster(m.aircraftOwned,'aircraft')}`;
  if(tab==='pilot') content=`<section class="pi-pilot-hero">${img(portrait(m.pilot),m.pilot?.name||'','pi-pilot-art')}<div><small>当前驾驶员${m.pilot?.temporaryUnlocked?' · 试玩':''}</small><h3>${e(m.pilot?.name||'未选择驾驶员')}</h3>${stars(m.pilot)}<strong>${e(m.pilot?.skillName||'')}</strong><p>${e(m.pilot?.passiveDescription||m.pilot?.description||'')}</p></div></section>${skills('pilot')}${roster(m.pilotsOwned,'pilot')}`;
return {title:'个人信息',content:`<div class="pi-profile" data-profile-tab="${tab}"><header class="pi-identity"><div class="pi-avatar" data-psd-quality="2">${img(avatar(m.pilot),'当前驾驶员头像','')}</div><div class="pi-identity-copy"><small>指挥官</small>${identityName}<div class="pi-power"><span>战力</span><b>${Number.isFinite(m.power)?n(m.power):'—'}</b></div></div><div class="pi-progress"><small>最高通关</small><strong>${e(m.progress)}</strong><span>累计 ${m.cleared} 章</span></div></header><div class="pi-tabs" role="tablist" aria-label="个人配置">${PLAYER_INFO_TABS.map(item=>`<button type="button" class="wc-button psd-tab" role="tab" id="pi-tab-${item.id}" aria-controls="pi-tab-panel" aria-selected="${item.id===tab}" tabindex="${item.id===tab?0:-1}" data-action="playerInfoTab" data-tab="${item.id}">${item.label}</button>`).join('')}</div><div class="pi-content" id="pi-tab-panel" role="tabpanel" aria-labelledby="pi-tab-${tab}" tabindex="0">${content}</div><footer class="pi-footer"><button type="button" class="wc-button" data-action="playerInfoManage" data-kind="${tab}">${{equipment:'管理装备',weapon:'武器目录',aircraft:'管理战机',pilot:'管理驾驶员'}[tab]}</button></footer></div>`};
}
