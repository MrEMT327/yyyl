import { playerInfoModel } from './player-info-model.js';
import { nativeCollectionArt } from '../replica/native-collection-art.js';
import { catalogWeaponArtwork } from './weapon-catalog-page.js';
import { emptySlotMark } from './psd-empty-slot.js';
import './daily-center.css';
import { pilotSupplyTaskCenter } from './task-center-supply.js';
import './task-center-restore.css';

export const DAILY_TABS=Object.freeze([
  {id:'signin',label:'签到'}, {id:'daily',label:'每日'},
  {id:'weekly',label:'每周'}, {id:'achievements',label:'成就'},
]);
const base=import.meta.env?.BASE_URL ?? '/';
const taskArt=name=>`${base}art/project-task-icons-v1/${({'chest-idle':'chest-closed','chest-open':'chest-open','daily-activity':'activity-medal','weekly-activity':'activity-medal'})[name]||name}.png`;
const sprite=(name,cls='')=>`<img class="${cls}" src="${taskArt(name)}" alt="" aria-hidden="true" draggable="false">`;
const names={coins:'金币',diamonds:'钻石',weaponParts:'强化零件',aircraftShards:'飞机碎片',stamina:'体力'};
const icons={coins:'coin',diamonds:'diamond',weaponParts:'parts',aircraftShards:'shard',stamina:'energy'};
const button=(action,label,attrs='',disabled=false,cls='')=>`<button type="button" class="wc-button dc-button ${cls}" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;
function rewards(reward,h,cls='') {
  const {icon,number:n,escape:e,img}=h;
  if(Array.isArray(reward))return `<span class="dc-rewards ${cls}">${reward.map(row=>`<span aria-label="${e(row.name)} ${n(row.count)}">${img(row.image,row.name,'dc-native-reward-icon')}<b>×${n(row.count)}</b></span>`).join('')}</span>`;
  return `<span class="dc-rewards ${cls}">${Object.entries(reward||{}).filter(([,v])=>v>0).map(([key,value])=>`<span aria-label="${names[key]||key} ${n(value)}">${icon(icons[key]||'gift')}<b>×${n(value)}</b></span>`).join('')}</span>`;
}
function readyCount(s,period) {
  const supply=s.pilotSupply;
  if(!supply)return (s.tasks||[]).filter(t=>t.type===period&&t.claimable).length
    +(s.activity?.[period]?.items||[]).filter(t=>t.claimable).length;
  const rewards=period==='weekly'
    ?[supply.week,supply.collection?.skins,supply.growth?.week]
    :[supply.activity,supply.collection?.guns,supply.growth?.daily];
  return rewards.filter(row=>row?.canClaim).length
    +(period==='weekly'?0:supply.tasks.filter(task=>task.canClaim).length);
}
const hasReady=(s,id)=>!s.rewardPending && !s.rewardBusy && (id==='signin'?s.signIn?.canClaim:id==='achievements'?s.achievements?.items?.some(t=>t.claimable):readyCount(s,id)>0);

export function dailyMilestoneAction(row,pending=false) {
  if(!row || pending || row.pending || row.claimed)return null;
  return row.claimable?'claimActivity':'dailyMilestone';
}

function activityHeader(snapshot,modal,h) {
  const {escape:e,number:n}=h,period=modal.period||'daily';
  const activity=snapshot.activity?.[period]||{points:0,max:100,items:[]};
  const selected=activity.items.find(row=>row.id===modal.milestoneId && dailyMilestoneAction(row,snapshot.rewardPending)==='dailyMilestone');
  return `<section class="dc-activity" aria-label="${period==='weekly'?'每周':'每日'}活跃奖励">
    <div class="dc-activity-meter"><span class="dc-activity-value">${sprite(`${period}-activity`)}<b>${n(activity.points)}</b></span><progress value="${activity.points}" max="${activity.max}" aria-label="活跃度 ${n(activity.points)} / ${n(activity.max)}"></progress></div>
    <div class="dc-chests">${activity.items.map(row=>`<button type="button" class="dc-chest${row.claimed?' is-claimed':row.claimable?' is-ready':''}" data-action="${dailyMilestoneAction(row,snapshot.rewardPending)||'dailyMilestone'}" data-id="${e(row.id)}" data-period="${period}" ${dailyMilestoneAction(row,snapshot.rewardPending)?'':'disabled'} aria-label="${n(row.points)}活跃奖励，${row.pending?'待恢复':row.claimed?'已领取':activity.points>=row.points?(snapshot.rewardPending?'待恢复':row.claimable?'可领取':'暂未开放'):'未达成'}" aria-pressed="${selected?.id===row.id}">${sprite(row.claimed?'chest-open':'chest-idle')}<b>${n(row.points)}</b>${row.claimed?`<span>${row.pending?'待恢复':'已领'}</span>`:row.claimable?'<i aria-hidden="true"></i>':''}</button>`).join('')}</div>
    ${selected?`<div class="dc-box-preview" role="region" aria-label="${n(selected.points)}活跃奖励预览"><div><strong>奖励预览</strong>${rewards(selected.reward,h)}</div><button type="button" class="dc-preview-close" data-action="dailyMilestoneClose" aria-label="关闭奖励预览">×</button></div>`:''}
  </section>`;
}
function taskRows(snapshot,period,h) {
  const {escape:e,number:n,icon}=h;
  const tasks=(snapshot.tasks||[]).filter(t=>t.type===period);
  return `<div class="dc-scroll dc-task-list" data-daily-scroll="${period}">${tasks.map(task=>`<article class="dc-task${task.claimed?' is-claimed':task.claimable?' is-ready':''}" data-task-id="${e(task.id)}" tabindex="-1">
    <div class="dc-task-badge">${sprite(`${period}-activity`)}<b>+${n(task.activityPoints)}</b></div>
    <div class="dc-task-body"><h3>${e(task.name)}</h3>${rewards(task.reward,h)}<div class="dc-progress"><progress max="${task.target}" value="${task.progress}" aria-label="${e(task.name)}进度"></progress><span>${n(task.progress)} / ${n(task.target)}</span></div></div>
    ${task.pending?'<span class="dc-claimed">待恢复</span>':task.claimed?`<span class="dc-claimed" aria-label="已领取">${icon('check')}<small>已领取</small></span>`:button(task.progress>=task.target?'claimTask':'dailyGo',task.progress>=task.target?(snapshot.rewardPending?'待恢复':task.claimable?'领取':'暂未开放'):'前往',task.claimable?`data-id="${e(task.id)}"`:`data-destination="${e(task.destination)}" data-id="${e(task.id)}"`,snapshot.rewardPending||task.progress>=task.target&&!task.claimable)}
  </article>`).join('')}</div>`;
}
function prizeArt(day,snapshot,h) {
  if(day.image)return h.img(day.image,day.name||'','dc-signin-art');
  if(day.nativeRow)return h.img(nativeCollectionArt(day.nativeRow,day.type==='aircraft'?'preview':'thumbnail'),day.name||'','dc-signin-art');
  const id=day.itemId?.split(':')[1];
  if(day.type==='weapon') {
    const weapon=snapshot.weapons?.find(w=>w.id===id);
    return weapon?catalogWeaponArtwork(weapon,h):h.thumbnail(id);
  }
  if(day.type==='aircraft') {
    const aircraft=snapshot.aircraft?.find(a=>a.id===id);
    return h.thumbnail(id)||h.img(aircraft?.image,aircraft?.aircraftName||'');
  }
  return h.icon(icons[day.type]||'gift');
}
function signInContent(snapshot,h) {
  const {escape:e,number:n,icon}=h,signin=snapshot.signIn||{},days=signin.days||[];
  const rollback=signin.lastClaimDay>signin.today;
  const label=snapshot.rewardPending?'待恢复':signin.starterPending?'补领新手飞机':signin.completed?'已领完':rollback?'日期异常':signin.canClaim?'领取':'今日已领';
  return `<div class="dc-scroll dc-signin" data-daily-scroll="signin">
    <p class="dc-signin-count">已签到 <b>${n(signin.claimedCount||0)} / 7</b> 天</p>
    <div class="dc-signin-grid">${days.map(day=>{
      const today=day.active&&signin.canClaim&&!snapshot.rewardPending&&!snapshot.rewardBusy;
      const aircraft=day.type==='aircraft'?snapshot.aircraft?.find(a=>a.id===day.itemId?.split(':')[1]):null;
      const title=snapshot.flightRewards?day.title:aircraft?`${aircraft.aircraftName}${day.isCard?'卡':''}`:(day.type==='coins'?`金币 ×${n(day.amount)}`:day.title);
      const items=Array.isArray(day.rewards)&&day.rewards.length?day.rewards:[day];
      const status=day.claimed?'已领取':today?'今日可领':'待签到';
      return `<button type="button" class="dc-signin-day${day.day===7?' is-final':''}${day.claimed?' is-claimed':''}${today?' is-today':''}" data-action="claimSignIn" ${!today?'disabled':''} aria-label="第${day.day}天，${e(title)}，${day.claimed?'已领取':today?'今日可领取':'未领取'}"><strong>第 ${day.day} 天</strong><span class="dc-signin-rewards${items.length===1?' is-single':''}">${items.map(item=>`<span class="dc-signin-reward"${item.id?` data-reward-id="${e(item.id)}"`:''}><span class="dc-prize-art${['weapon','aircraft'].includes(item.type)?' is-equipment':''}">${prizeArt(item,snapshot,h)}</span><span class="dc-signin-reward-copy"><span>${e(item.name||names[item.type]||item.title||'奖励')}</span><b>×${n(item.count??item.amount??1)}</b></span></span>`).join('')}</span><span class="dc-signin-status${day.claimed?' dc-signin-stamp':''}">${day.claimed?icon('check'):''}${status}</span></button>`;
    }).join('')}</div>
  </div><footer class="dc-signin-footer"><div>${snapshot.flightRewards?`<span>断签不重置</span>`:`<span>每日另含</span>${rewards(signin.supplements,h)}`}</div>${button('claimSignIn',label,'',!signin.canClaim||snapshot.rewardPending)}</footer>`;
}
function achievementContent(snapshot,modal,h) {
  const {escape:e,number:n,icon}=h,achievement=snapshot.achievements||{categories:[],items:[]};
  const category=achievement.categories.some(c=>c.id===modal.achievementCategory)?modal.achievementCategory:'combat';
  const items=achievement.items.filter(t=>t.category===category);
  return `<div class="dc-categories" role="group" aria-label="成就分类">${achievement.categories.map(c=>button('achievementCategory',c.name,`data-category="${e(c.id)}" aria-pressed="${c.id===category}"`,false,c.id===category?'is-selected':'')).join('')}</div>
    <p class="dc-reset">已领取 ${n(items.filter(t=>t.claimed).length)} / ${n(items.length)}</p>
    <div class="dc-scroll dc-achievements" data-daily-scroll="achievements:${category}">${items.map(item=>`<article class="dc-achievement${item.claimed?' is-claimed':item.claimable?' is-ready':''}" data-achievement-id="${e(item.id)}" tabindex="-1"><div class="dc-achievement-heading"><h3>${e(item.name)}</h3>${rewards(item.rewardItems||item.reward,h)}</div><div class="dc-progress"><progress max="${item.target}" value="${item.progress}" aria-label="${e(item.name)}进度"></progress><span>${n(item.progress)} / ${n(item.target)}</span></div><div class="dc-achievement-action">${item.pending?'<span class="dc-claimed">待恢复</span>':item.claimed?`<span class="dc-claimed">${icon('check')}已领取</span>`:button(item.progress>=item.target?'claimAchievement':'dailyGo',item.progress>=item.target?(snapshot.rewardPending?'待恢复':item.claimable?'领取':'暂未开放'):'前往',`data-destination="${e(item.destination)}" data-id="${e(item.id)}"`,snapshot.rewardPending||item.progress>=item.target&&!item.claimable,item.claimable?'is-ready':'')}</div></article>`).join('')}</div>`;
}

export function dailyCenter(snapshot,modal,h) {
  const period=DAILY_TABS.some(t=>t.id===modal.period)?modal.period:'daily';
  const page={...modal,period};
  return {title:'任务',content:`<section class="dc-hub" data-daily-page="${period}"><nav class="dc-tabs" aria-label="任务分类">${DAILY_TABS.map(t=>`<button type="button" class="wc-button dc-tab" data-action="taskPeriod" data-period="${t.id}" aria-pressed="${period===t.id}">${t.label}${hasReady(snapshot,t.id)?'<i aria-label="有奖励可领取"></i>':''}</button>`).join('')}</nav>
    ${snapshot.rewardPending?`<div class="dc-pending" role="status"><span>领取记录待恢复</span>${button('recoverDailyRewards','重试')}</div>`:''}
    ${snapshot.pilotSupply&&['daily','weekly'].includes(period)?pilotSupplyTaskCenter(period,snapshot,h):period==='signin'?signInContent(snapshot,h):period==='achievements'?achievementContent(snapshot,page,h):`${activityHeader(snapshot,page,h)}<p class="dc-reset">${period==='weekly'?'每周一':'每日'} 00:00 刷新</p>${taskRows(snapshot,period,h)}`}
  </section>`};
}

// Existing live activities only. No carnival/season reward is invented here.
export function dailyActivities(snapshot,h) {
  const {number:n,icon}=h,signin=snapshot.signIn||{},patrol=snapshot.patrol||{};
  const tasks=snapshot.tasks||[];
  const taskDetail=snapshot.pilotSupply?`每日 ${snapshot.pilotSupply.tasks.filter(t=>t.claimed||t.canClaim).length} / ${snapshot.pilotSupply.tasks.length} · 每周活跃 ${snapshot.pilotSupply.week.days} / 5 天`: `每日 ${tasks.filter(t=>t.type==='daily'&&t.progress>=t.target).length} / ${tasks.filter(t=>t.type==='daily').length} · 每周 ${tasks.filter(t=>t.type==='weekly'&&t.progress>=t.target).length} / ${tasks.filter(t=>t.type==='weekly').length}`;
  const taskReady=readyCount(snapshot,'daily')+readyCount(snapshot,'weekly')+(snapshot.achievements?.items||[]).filter(t=>t.claimable).length;
  const stored=Math.max(0,patrol.storedMinutes||0);
  const patrolReady=patrol.unlocked && !patrol.clockRollback && !patrol.nativeSettlementPending && Object.values(patrol.rewards||{}).some(v=>v>0);
  const entries=[
    {action:'signin',name:'七日签到',art:icon('calendar'),detail:`已签到 ${n(signin.claimedCount||0)} / 7 天`,status:signin.completed?'已领完':signin.canClaim?'今日可领':'今日已领',ready:signin.canClaim},
    {action:'tasks',name:'任务中心',art:sprite('daily-activity'),detail:taskDetail,status:taskReady?`${n(taskReady)} 项奖励可领`:'查看任务',ready:taskReady>0},
    {action:'patrol',name:'巡逻',art:icon('plane'),detail:patrol.native?(patrol.unlocked?'查看巡逻收益与奖励预览':patrol.lockReason):patrol.unlocked?`已累计 ${n(Math.floor(stored/60))} 小时 ${n(stored%60)} 分钟`:'通关第1章开启',status:patrol.native&&!patrol.sampleBased?'查看':patrolReady?'奖励可领':patrol.unlocked?'巡逻中':'未解锁',ready:patrolReady,disabled:!patrol.canPreview&&!patrol.unlocked},
  ];
  return {title:'活动',content:`<section class="dc-activities"><p class="dc-scroll-hint">向下滑动查看更多</p>${entries.map(entry=>`<article class="dc-event"><div class="dc-event-art">${entry.art}</div><div class="dc-event-copy"><h3>${entry.name}</h3><p>${entry.detail}</p><small${entry.ready&&!snapshot.rewardPending&&!snapshot.rewardBusy?' class="is-ready"':''}>${snapshot.rewardPending?'奖励待保存':snapshot.rewardBusy?'奖励处理中':entry.status}</small></div>${button(entry.action,'前往','',entry.disabled)}</article>`).join('')}</section>`};
}

export function formationPanel(snapshot,h) {
  const {escape:e,number:n,icon}=h;
  const model=playerInfoModel(snapshot),pilot=model.pilot,aircraft=model.aircraft,innate=model.main;
  const stat=value=>Number.isFinite(value)?n(value):'—';
  const card=(weapon,label)=>`<article class="fm-weapon${weapon?'':' is-empty'}"${weapon?` data-psd-quality="${weapon.qualityRank??0}"`:''}><strong>${label}</strong><div>${weapon?(weapon.nativeRow?h.img(nativeCollectionArt(weapon.nativeRow),weapon.name,'pl-model-thumb'):catalogWeaponArtwork(weapon,h)):emptySlotMark('fm-plus')}</div><b>${e(weapon?.name||'空槽')}</b>${weapon?`<small>${weapon.nativeRow?`${n(weapon.stars)} 星`:`Lv.${n(weapon.level)}`}</small>`:''}</article>`;
  return `<section class="fm-summary"><div class="fm-power">出战战力 <b>${stat(model.power)}</b></div><div class="fm-stats"><span>攻击 <b>${stat(model.attack)}</b></span><span>耐久 <b>${stat(model.hp)}</b></span></div>
    <div class="fm-units"><article><div class="fm-portrait">${h.img(pilot?.avatar||pilot?.image,pilot?.name||'')}</div><small>驾驶员 · ${n(pilot?.stars||0)}星</small><h3>${e(pilot?.name||'未选择驾驶员')}</h3></article><article><div class="fm-aircraft">${h.thumbnail(aircraft?.id)||h.img(aircraft?.image,aircraft?.aircraftName||'')}</div><small>战机 · ${model.native?`${n(aircraft?.stars)}星`:`Lv.${n(aircraft?.level)}`}</small><h3>${e(aircraft?.aircraftName)}</h3></article></div>
    <div class="fm-passive"><h3>${e(pilot?.passive?.name||pilot?.skillName)}</h3><p>${e(pilot?.passive?.description||pilot?.passiveDescription||'')}</p></div>
    <div class="fm-innate">${card(innate,model.native?'出战主武器':'本机专武 · 槽1／槽2')}</div><div class="fm-weapons">${model.weapons.map(({slot,item})=>card(item,`槽${slot.slice(1)}`)).join('')}</div>
    ${button('tab','调整装备','data-tab="assembly"',false,'fm-edit')}
  </section>`;
}
