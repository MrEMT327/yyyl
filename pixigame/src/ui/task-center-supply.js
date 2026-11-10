import './pilot-supply.css';
import './supply-dialogs.css';
import {taskStatusMark} from './task-center-icons.js';
import {taskChestArt} from './task-chest-model.js';
import {taskDisplayOrder} from './task-display-order.js';

const base=import.meta.env?.BASE_URL ?? '/';
const taskArt=name=>`${base}art/project-task-icons-v1/${name}.png`;
const button=(label,operation,s,extra='',disabled=false)=>`<button type="button" class="wc-button dc-button" data-action="pilotSupply" data-operation="${operation}" data-revision="${s.revision}" ${extra}${disabled?' disabled':''}>${label}</button>`;

export function pilotSupplyTaskCenter(period,s,h) {
  const p=s.pilotSupply,e=h.escape,n=h.number,weekly=period==='weekly';
  const activity=weekly?p.week:p.activity,max=100;
  const value=Math.max(0,Math.min(max,Number(weekly?(activity.points??activity.days*20):activity.points)||0));
  const blocked=Boolean(s.rewardPending||s.rewardBusy||p.taskGate?.reached===false);
  const label=weekly?'每周活跃':'每日活跃';
  const steps=[20,40,60,80,100];
  const milestones=steps.map(step=>{
    const milestone=activity.milestones?.find(row=>row.step===step)??(step===100?activity:{claimed:false,canClaim:false,rewards:[]});
    const status=s.rewardPending?'待恢复':s.rewardBusy?'处理中':milestone.claimed?'已领取':milestone.canClaim?'可领取':'未达成';
    const rewardLabel=(milestone.rewards||[]).map(r=>`${r.name} ×${n(r.amount)}`).join('、');
    const image=taskChestArt(period,milestone.claimed);
    return `<button type="button" class="dc-chest dc-supply-chest${weekly?' dc-weekly-chest':''}${step===100?' is-final':''}${value>=step?' is-reached':''}${milestone.claimed?' is-claimed':milestone.canClaim&&!blocked?' is-ready':''}" style="left:${step}%" data-action="taskChest" data-period="${period}" data-id="${step}" data-revision="${p.revision}" aria-label="${label} ${step}奖励，${e(rewardLabel)}，${status}" aria-haspopup="dialog"><span class="dc-milestone-art"><img src="${image}" alt="" draggable="false"></span><span class="dc-milestone-node" aria-hidden="true"></span><b>${step}</b></button>`;
  }).join('');
  const header=`<section class="dc-activity dc-supply-activity" aria-label="${label}奖励">
    <div class="dc-supply-heading"><span class="dc-activity-value"><img src="${taskArt('activity-medal')}" alt="" draggable="false"><span>${label}</span><b>${n(value)}<small> / ${max}</small></b></span><span class="dc-supply-reset">${weekly?'周一':'每日'} 00:00 刷新</span></div>
    <div class="dc-supply-milestones"><progress value="${value}" max="${max}" aria-label="${label} ${n(value)} / ${max}"></progress>${milestones}</div>
  </section>`;
  const tasks=weekly?`<div class="dc-task-list dc-supply-task-list">${taskDisplayOrder(p.week.tasks||[],t=>Math.max(0,Number(t.progress)||0)>=t.target).map(t=>{
    const progress=Math.max(0,Math.min(t.target,Number(t.progress)||0)),complete=progress>=t.target;
    const action=t.claimed?taskStatusMark('已领取'):t.canClaim?button('领取','weeklyTask',p,`data-id="${e(t.id)}"`,blocked):complete?taskStatusMark('已完成')
      :`<button type="button" class="wc-button dc-button" aria-label="前往，${e(t.name)}" aria-description="前往" data-action="dailyGo" data-destination="${e(t.destination)}" ${blocked?'disabled':''}>前往</button>`;
    return `<article class="dc-task${complete?' is-claimed':''}" data-task-id="${e(t.id)}"><div class="dc-task-badge"><img src="${taskArt('activity-medal')}" alt="" draggable="false"><b>+${n(t.points)}</b></div><div class="dc-task-body"><h3>${e(t.name)}</h3><div class="dc-progress"><progress max="${t.target}" value="${progress}" aria-label="${e(t.name)}进度"></progress><span>${n(progress)} / ${n(t.target)}</span></div></div>${action}</article>`;
  }).join('')}</div>`:`<div class="dc-task-list dc-supply-task-list">${taskDisplayOrder(p.tasks).map(t=>{
    const taskMax=Math.max(1,Number(t.target)||0);
    const progress=t.target?Math.max(0,Math.min(taskMax,Number(t.progress)||0)):Number(t.claimed||t.canClaim);
    const taskName=t.name;
    const destination=t.destination||({battle1:'battle',battle3:'battle',sortie:'battle',victory:'battle',upgrade:'equipment',recruit:'supply'})[t.id];
    const taskAction=t.claimed?taskStatusMark():!t.canClaim&&destination
      ? `<button type="button" class="wc-button dc-button" aria-label="前往，${e(taskName)}" aria-description="前往" data-action="dailyGo" data-destination="${e(destination)}" ${blocked?'disabled':''}>前往</button>`
      : button(t.canClaim?'领取':'未达成','task',p,`data-id="${e(t.id)}" aria-label="${t.canClaim?'领取':'未达成'}，${e(taskName)}" aria-description="${t.canClaim?'领取':'未达成'}" `,blocked||!t.canClaim);
    return `<article class="dc-task dc-supply-task${t.claimed?' is-claimed':t.canClaim?' is-ready':''}" data-task-id="${e(t.id)}">
      <div class="dc-task-badge"><img src="${taskArt('activity-medal')}" alt="" draggable="false"><b>+${n(t.points)}</b></div>
      <div class="dc-task-body"><h3>${e(taskName)}</h3><div class="dc-progress"><progress max="${taskMax}" value="${progress}" aria-label="${e(taskName)}进度"></progress><span>${n(progress)} / ${n(taskMax)}</span></div></div>
      ${taskAction}
    </article>`;
  }).join('')}</div>`;
  return `${header}<p class="dc-reset">${p.taskGate?.reached===false?e(p.taskGate.reason):`${weekly?'每周一':'每日'} 00:00 刷新`}</p><div class="dc-scroll dc-restored-scroll" data-daily-scroll="${period}">${tasks}</div>`;
}
