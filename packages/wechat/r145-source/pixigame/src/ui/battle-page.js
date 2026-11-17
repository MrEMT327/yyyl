import { chapterRewardsDialog } from './chapter-rewards-panel.js';
import {playerAvatar} from './player-avatar.js';
import { patrolClockState } from './patrol-clock.js';
import { lobbyHeader } from './lobby-header.js';
import { lobbyNavigation } from './lobby-navigation.js';
import { lobbyResources } from './lobby-resources.js';
import { starGoals } from '../campaign-stars.js';
import { STAR_RESOURCE_NAMES } from '../peripheral/star-rewards.js';
import { PILOT_AFFECTION_MAX, pilotAffectionPoints, pilotAffectionVideo } from '../peripheral/pilot-affection.js';
import { pilotVideoMarkup } from './pilot-video-controls.js';
import { characterPortrait, portraitPresentation } from './character-portraits.js';
// Keep the PSD scenery and controls around an independently animated portrait.

export const battleHeader = lobbyHeader;

export function battleChapterIndex(snapshot, requestedChapter) {
  const max = Math.max(0, (snapshot.stages?.length || 0) - 1);
  const current = snapshot.selectedStageIndex || 0;
  return Math.max(0, Math.min(max, Number.isInteger(requestedChapter) ? requestedChapter : current));
}

export function battleNavigation() { return lobbyNavigation('battle'); }

export function battlePage(ctx,requestedChapter) {
  const pct = (value,extent) => `${(value / extent * 100).toFixed(6)}%`;
  const art = `${import.meta.env?.BASE_URL ?? '/'}art/`;
  const s = ctx.snapshot;
  const patrolClock=patrolClockState(s.patrol);
  const chapter = battleChapterIndex(s,requestedChapter);
  const route = s.stages.slice(chapter,chapter+1);
  const sourceTitle = String(route[0]?.chapterName || '');
  const chapterName = sourceTitle
    .replace(/^第\s*\d+\s*章\s*·\s*/,'')
    .replace(/^(?:第)?[一二三四五六七八九十]+章\s*·?\s*/,'')
    .trim();
  const chineseNumber = value => {
    const digits=['零','一','二','三','四','五','六','七','八','九'];
    if(value<=10)return value===10?'十':digits[value]||String(value);
    if(value<20)return `十${digits[value%10]}`;
    if(value<100)return `${digits[Math.floor(value/10)]}十${value%10?digits[value%10]:''}`;
    return String(value);
  };
  const chapterTitle = `第${chineseNumber(chapter+1)}章·${chapterName || '蔚蓝海岸'}`;
  const stage = route[0];
  const chapterState = stage?.bestCleared ? '已通关' : stage?.unlocked === false ? '未解锁' : '待挑战';
  const waveCount = Number(stage?.waveCount) > 0 ? Number(stage.waveCount) : 15;
  const starTrack = s.starRewards?.modes?.find(mode=>mode.id==='easy');
  const nativeRewards=s.nativeAcquisition?.rewards.filter(row=>row.missionId===stage?.replicaChapterId);
  const starTotal = nativeRewards ? nativeRewards.filter(row=>row.claimed).length : starTrack?.total ?? 0;
  const starMaximum = nativeRewards ? nativeRewards.length : starTrack?.maxStars || s.stages.length*3;
  const pilot = portraitPresentation(ctx.snapshot.pilots?.find(p=>p.id===ctx.snapshot.pilotId) || {id:'pilot-06',name:'06 号驾驶员'});
  const portrait = characterPortrait(pilot, 'psd-main-portrait') || `<div class="psd-main-portrait character-portrait"><img class="character-portrait-fallback" src="${pilot.image || ''}" alt="${pilot.name || ''}" draggable="false"></div>`;
  const hotspot = (name,label,action,box,{data='',face=`buttons/${name}.png`,faceBox=box,staticFace=false,content=''}={}) => {
    const [x,y,w,h]=box, [fx,fy,fw,fh]=faceBox;
    const image=face?`<img class="psd-main-face-art" data-button-face src="${art}psd-main-v1/${face}" style="left:${pct(fx-x,w)};top:${pct(fy-y,h)};width:${pct(fw,w)};height:${pct(fh,h)};pointer-events:none" alt="" draggable="false">`:'';
    return `<button type="button" class="psd-main-hotspot psd-hit-${name}" data-action="${action}" ${data} aria-label="${label}" style="left:${pct(x,750)};top:${pct(y,1624)};width:${pct(w,750)};height:${pct(h,1624)}">${staticFace?image:''}<span class="psd-main-face" data-button-visual aria-hidden="true">${staticFace?'':image}${content}</span></button>`;
  };
  const hitTargets = [
    hotspot('profile','查看名片','playerInfo',[0,27,221,100],{
      face:'profile-live-frame.png?v=cosmetic-avatar-v2',faceBox:[22,27,199,78],
      content:`<span class="psd-main-avatar">${playerAvatar(s,ctx.helpers)}</span><span class="psd-main-identity"><strong>${ctx.helpers.escape(s.playerName)}</strong><span><small>战力</small><b>${Number.isFinite(s.power)?ctx.helpers.number(s.power):'—'}</b></span></span>`,
    }),
    hotspot('chapter-title','查看当前关卡详情','chapterDetails',[172,143,413,70],{
      face:'buttons/chapter-frame.png',faceBox:[116,132,534,94],staticFace:true,
      content:`<span class="psd-main-chapter-copy"><strong>${chapterTitle}</strong><span>${waveCount}波·${chapterState}</span></span>`,
    }),
    hotspot('chapter-prev','上一章','chapterPrev',[136,159,36,39]),
    hotspot('chapter-next','下一章','chapterNext',[585,159,36,39]),
    hotspot('tasks','查看航线任务','tasks',[6,232,101,102],{faceBox:[6,227,101,107]}),
    hotspot('affection','好感度','pilotAffection',[6,338,101,99],{
      face:'',data:'aria-haspopup="dialog"',
      content:`<span class="psd-main-affection"><img src="${art}psd-combat-v1/heart.png" alt="" draggable="false"><strong>好感度</strong></span>`,
    }),
    hotspot('star-rewards',s.nativeAcquisition?'查看章节奖励':'查看星级奖励','chapterChest',[240,239,289,45],{
      content:`<img class="psd-main-face-art psd-main-star-chest" src="${art}psd-main-v1/buttons/star-rewards-chest.png" alt="" draggable="false"><span class="psd-main-star-total">累计${starTotal}/${starMaximum}</span>`,
    }),
    hotspot('switch-pilot','切换驾驶员','catalog',[597,1187,145,147],{data:'data-kind="pilot"'}),
    hotspot('patrol','航线巡逻','patrol',[26,1345,182,111],{
      data:s.patrol?.unlocked===false?'aria-disabled="true" data-chapter-locked="true"':'',
      content:`<span class="psd-main-patrol-clock" data-patrol-clock="home" data-patrol-status="${patrolClock.status}" aria-label="巡逻状态">${ctx.helpers.escape(patrolClock.home)}</span>`,
    }),
    hotspot('backpack','打开背包','backpack',[545,1364,182,92]),
    hotspot('start',stage?.unlocked === false ? '当前章节未解锁' : '开始战役，消耗体力×5','start',[224,1341,301,117],{data:`data-stage-index="${chapter}"`}),
  ].join('');
  return `<section class="bc-page psd-main-page" aria-label="主界面">
    <img class="psd-main-composite" src="${art}psd-main-v1/main-background.png" alt="" aria-hidden="true" draggable="false">
    ${portrait}
    <img class="psd-main-composite psd-main-shades" src="${art}psd-main-v1/buttons/scene-shade.png" alt="" aria-hidden="true" draggable="false">
    ${lobbyResources(ctx)}
    <div class="psd-main-hotspots" aria-label="主界面操作">${hitTargets}<button type="button" class="wc-button psd-main-developer" data-action="debug" aria-label="打开开发工具">开发</button></div>
  </section>`;
}

export function pilotAffectionDialog(snapshot, selectedPilotId, {escape, img}, {playing=false}={}) {
  const pilots=(snapshot.pilots || []).filter(pilot=>pilot.owned || pilot.id===snapshot.pilotId);
  const pilot=pilots.find(row=>row.id===selectedPilotId) || pilots.find(row=>row.id===snapshot.pilotId) || pilots[0];
  if(!pilot)return {title:'好感度',content:'<p class="bc-modal-empty">暂无驾驶员</p>'};

  const points=pilotAffectionPoints(pilot.affection);
  const video=pilotAffectionVideo(pilot.id);
  const unlocked=points===PILOT_AFFECTION_MAX;
  if(playing&&video&&unlocked){
    const source=(import.meta.env?.BASE_URL ?? '/')+video;
    return {title:`${pilot.name} · 专属视频`,content:pilotVideoMarkup(source, `${pilot.name}专属视频`, escape)};
  }
  const reward=video?(unlocked
    ? `<button type="button" class="pl-button pl-primary" data-action="playAffectionVideo" data-id="${escape(pilot.id)}">观看专属视频</button>`
    : `<p class="bc-affection-reward">好感度达到 ${PILOT_AFFECTION_MAX} 解锁专属视频</p>`):'';

  const choices=pilots.length>1?`<div class="bc-affection-pilots" role="group" aria-label="选择驾驶员">${pilots.map(row=>
    `<button type="button" class="pl-button pl-secondary" data-action="browseAffectionPilot" data-id="${escape(row.id)}" aria-pressed="${row.id===pilot.id}">${img(row.avatar,'')}${escape(row.name)}</button>`
  ).join('')}</div>`:'';
  return {title:'好感度',content:`<div class="bc-affection">
    <div class="bc-affection-pilot">${img(pilot.avatar,'')}<div><h3>${escape(pilot.name)}</h3>${pilot.id===snapshot.pilotId?'<span>当前出战</span>':''}</div></div>
    <div class="bc-affection-progress">
      <div><span>好感度</span><strong>${points} / ${PILOT_AFFECTION_MAX}</strong></div>
      <progress aria-label="好感度" max="${PILOT_AFFECTION_MAX}" value="${points}"></progress>
    </div>
    ${reward}
    ${choices}
  </div>`};
}

export function battleSupplementalModal(type, snapshot, requestedChapter) {
  const chapter = battleChapterIndex(snapshot, requestedChapter);
  const route = snapshot.stages.slice(chapter, chapter + 1);
  const stars = route.reduce((sum,item) => sum + (item.stars || 0), 0);
  if(type==='chapterChest'&&snapshot.nativeAcquisition) {
    return chapterRewardsDialog(snapshot);
  }
  if (type === 'chapterChest') {
    const rewardMode = 'easy';
    const track = snapshot.starRewards?.modes?.find(mode=>mode.id===rewardMode);
    const goals = starGoals(rewardMode);
    return {title:'星级奖励',content:`<div class="bc-star-rewards">
      <ul class="bc-star-goals" aria-label="通关判星条件">${goals.map(goal=>`<li><span aria-hidden="true">★</span>${goal.label}</li>`).join('')}</ul>
      <div class="bc-star-total"><strong>累计 ${track?.total || 0}<small> / ${track?.maxStars || snapshot.stages.length*3} 星</small></strong><span>每档仅领一次</span></div>
      <div class="bc-star-reward-list">${(track?.items||[]).map(item=>`<div class="bc-star-reward ${item.claimed?'is-claimed':''}"><b>★ ${item.stars}</b><span>${item.rewardItems?item.rewardItems.map(row=>`${row.name} ×${row.amount}`).join('<br>'):Object.entries(item.reward).map(([key,amount])=>`${STAR_RESOURCE_NAMES[key]} ×${amount}`).join('<br>')}</span><button type="button" class="pl-button ${item.claimable?'pl-primary':'pl-secondary'}" data-action="claimStarReward" data-mode="${rewardMode}" data-id="${item.id}" ${!item.claimable?'disabled':''}>${item.claimed?'已领取':item.claimable?'领取':'未达成'}</button></div>`).join('')}</div>
    </div>`};
  }
  if (type === 'mail') return {title:'邮件',content:'<div class="bc-modal-empty">当前没有邮件。</div>'};
  if (type === 'activities') return {title:'活动',content:`<div class="bc-modal-actions"><button type="button" class="pl-button pl-primary pl-wide" data-action="signin">每日签到</button><button type="button" class="pl-button pl-secondary pl-wide" data-action="tasks">每日任务</button>${snapshot.patrol?.unlocked ? '<button type="button" class="pl-button pl-secondary pl-wide" data-action="patrol">航线巡逻</button>' : ''}</div>`};
  return null;
}
