import { growthSupplyEntry } from './growth-supply-panel.js';
import { nativeItemArt, nativeItemPresentation } from '../replica/native-item-presentation.js';
import './pilot-supply.css';
import './supply-dialogs.css';

const base=import.meta.env?.BASE_URL ?? '/';
const taskArt=name=>`${base}art/project-task-icons-v1/${name}.png`;
const button=(label,operation,s,extra='',disabled=false)=>`<button type="button" class="wc-button dc-button" data-action="pilotSupply" data-operation="${operation}" data-revision="${s.revision}" ${extra}${disabled?' disabled':''}>${label}</button>`;

// The current supply ledger has one real activity reward per period. Earlier
// milestones are progress markers, not extra claimable chests.
export function pilotSupplyTaskCenter(period,s,h) {
  const p=s.pilotSupply,e=h.escape,n=h.number,weekly=period==='weekly';
  const activity=weekly?p.week:p.activity,max=100;
  const value=Math.max(0,Math.min(max,Number(weekly?(activity.points??activity.days*20):activity.points)||0));
  const blocked=Boolean(s.rewardPending||s.rewardBusy);
  const label=weekly?'每周活跃':'每日活跃';
  const status=s.rewardPending?'待恢复':s.rewardBusy?'处理中':activity.claimed?'已领取':activity.canClaim?'可领取':'未达成';
  const rewardLabel=`角色箱碎片 ×${n(activity.fragments)}`;
  const steps=[20,40,60,80,100];
  const reward=(id,count,name='')=>`<span class="dc-supply-reward" aria-label="${e(name||nativeItemPresentation(id).name)} ×${n(count)}">${h.img(nativeItemArt(id),'','dc-native-reward-icon')}<b>×${n(count)}</b>${name?`<small>${e(name)}</small>`:''}</span>`;
  const taskReward=(id,count,name='',first=false)=>{
    const text=`${first?'首次奖励，':''}${name||nativeItemPresentation(id).name} ×${n(count)}`;
    return `<span class="dc-supply-reward${first?' is-first':''}" title="${e(text)}" aria-label="${e(text)}">${h.img(nativeItemArt(id),'','dc-native-reward-icon')}<b>×${n(count)}</b></span>`;
  };
  const milestones=steps.map(step=>step===max
    ? `<button type="button" class="dc-chest dc-supply-chest${activity.claimed?' is-claimed':activity.canClaim?' is-ready':''}" data-action="pilotSupply" data-operation="${weekly?'weekly':'activity'}" data-revision="${p.revision}" aria-label="${label} ${max}奖励，${e(rewardLabel)}，${status}" ${blocked||!activity.canClaim?'disabled':''}><img src="${taskArt(activity.claimed?'chest-open':'chest-closed')}" alt="" draggable="false"><b>${step}</b></button>`
    : `<span class="dc-supply-step${value>=step?' is-reached':''}" aria-hidden="true"><img src="${taskArt('chest-closed')}" alt="" draggable="false"><b>${step}</b></span>`).join('');
  const header=`<section class="dc-activity dc-supply-activity" aria-label="${label}奖励">
    <div class="dc-activity-meter"><span class="dc-activity-value"><img src="${taskArt('activity-medal')}" alt="" draggable="false"><b>${n(value)}</b></span><progress value="${value}" max="${max}" aria-label="${label} ${n(value)} / ${max}"></progress></div>
    <div class="dc-supply-milestones">${milestones}</div>
  </section>`;
  const tasks=weekly?`<div class="dc-task-list dc-supply-task-list">${(p.week.tasks||[]).map(t=>{
    const progress=Math.max(0,Math.min(t.target,Number(t.progress)||0)),complete=progress>=t.target;
    const action=complete?'<button type="button" class="wc-button dc-button" disabled>已完成</button>'
      :`<button type="button" class="wc-button dc-button" data-action="dailyGo" data-destination="${e(t.destination)}" ${blocked?'disabled':''}>前往</button>`;
    return `<article class="dc-task dc-weekly-task"><div class="dc-task-badge"><img src="${taskArt('activity-medal')}" alt="" draggable="false"><b>+${n(t.points)}</b></div><div class="dc-task-body"><h3>${e(t.name)}</h3><div class="dc-progress"><progress max="${t.target}" value="${progress}" aria-label="${e(t.name)}进度"></progress><span>${n(progress)} / ${n(t.target)}</span></div></div>${action}</article>`;
  }).join('')}</div>`:`<div class="dc-task-list dc-supply-task-list">${p.tasks.map(t=>{
    const taskMax=Math.max(1,Number(t.target)||0);
    const progress=t.target?Math.max(0,Math.min(taskMax,Number(t.progress)||0)):Number(t.claimed||t.canClaim);
    const taskName=t.id==='login'?'每日报到':t.name;
    const starter=s.pilots?.find(pilot=>pilot.name===t.starterName);
    const starterArt=starter?.avatar||starter?.image;
    const starterReward=t.starterName?`<span class="dc-supply-reward is-first" title="首次解锁 ${e(t.starterName)}" aria-label="首次解锁 ${e(t.starterName)}">${starterArt?h.img(starterArt,'','dc-native-reward-icon'):`<span class="dc-supply-pilot-name">${e(t.starterName)}</span>`}<b>×1</b></span>`:'';
    const firstRewards=starterReward+(t.introRewards||[]).map(r=>taskReward(r.id,r.amount,r.name,true)).join('');
    const taskRewards=(t.fragments?taskReward(926,t.fragments):'')+(firstRewards?`<span class="dc-first-rewards">${firstRewards}</span>`:'');
    const destination=t.destination||({battle1:'battle',battle3:'battle',sortie:'battle',victory:'battle',upgrade:'equipment',recruit:'supply'})[t.id];
    const taskAction=!t.claimed&&!t.canClaim&&destination
      ? `<button type="button" class="wc-button dc-button" data-action="dailyGo" data-destination="${e(destination)}" ${blocked?'disabled':''}>前往</button>`
      : button(t.claimed?'已领取':t.canClaim?'领取':'未达成','task',p,`data-id="${e(t.id)}" `,blocked||!t.canClaim);
    return `<article class="dc-task dc-supply-task${t.claimed?' is-claimed':t.canClaim?' is-ready':''}" data-task-id="${e(t.id)}">
      <div class="dc-task-badge"><img src="${taskArt('activity-medal')}" alt="" draggable="false"><b>+${n(t.points)}</b></div>
      <div class="dc-task-body"><h3>${e(taskName)}</h3><div class="dc-rewards">${taskRewards}</div><div class="dc-progress"><progress max="${taskMax}" value="${progress}" aria-label="${e(taskName)}进度"></progress><span>${n(progress)} / ${n(taskMax)}</span></div></div>
      ${taskAction}
    </article>`;
  }).join('')}</div>`;
  const f=s.flightRewards;
  const dailyAd=!weekly&&f?.ad?`<section class="su-card dc-extra-task"><header class="su-card-heading"><h3>每日特惠</h3><span>每日1次</span></header><div class="su-rewards">${f.ad.rewards.map(r=>reward(r.id,r.count??r.amount,r.name)).join('')}</div><button type="button" class="wc-button" data-action="${f.adPending?'recoverDailyRewards':'flightReward'}" data-operation="ad" data-revision="${f.revision}" ${f.adBusy||!f.adPending&&(blocked||!f.ad.canClaim||!f.adAvailable)?'disabled':''}>${f.adPending?'重试保存':f.adBusy?'广告播放中':!f.ad.canClaim?'已领取':!f.adAvailable?'广告暂不可用':'看广告领取'}</button></section>`:'';
  const ad=!weekly?`<section class="su-card dc-extra-task"><header class="su-card-heading"><h3>广告补给</h3><span>${n(p.ad.count)} / ${n(p.ad.limit)}次</span></header><div class="su-card-bottom">${reward(926,p.ad.fragments,'角色箱碎片')}${button(p.adPending?'重试保存':p.adBusy?'广告播放中':!p.ad.canClaim?'已领完':!p.adAvailable?'广告暂不可用':'看广告领取','ad',p,'',p.adBusy||!p.adPending&&(!p.ad.canClaim||!p.adAvailable))}</div>${p.development?button('开发领取','devAd',p,'',!p.ad.canClaim||p.adBusy||p.adPending):''}</section>`:'';
  const extras=`<div class="pilot-supply-panel supply-ui dc-supply-extras">${growthSupplyEntry(weekly?'week':'daily',s,h,{compact:true})}${dailyAd}${ad}</div>`;
  return `${header}<p class="dc-reset">${weekly?'每周一':'每日'} 00:00 刷新</p><div class="dc-scroll dc-restored-scroll" data-daily-scroll="${period}">${tasks}${extras}</div>`;
}
