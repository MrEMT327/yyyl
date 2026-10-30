import { researchTabs, researchUnlockMessage } from './research-tabs.js';
import labPresentation from '../replica/native-lab-presentation.json' with {type:'json'};
import './native-lab-page.css';
import { nativeLabArt } from '../replica/native-collection-art.js';
import { UNLOCK_ALL_CONTENT } from '../development-resources.js';
import { nativeLabView } from '../replica/native-client-rules.js';
const plain=value=>String(value||'').replace(/<[^>]*>/g,'');
const button=(action,label,attrs='',cls='')=>`<button type="button" class="wc-button ${cls}" data-action="${action}" ${attrs}>${label}</button>`;
const attr=(value,names,e)=>{
  const at=value.indexOf('='),key=value.slice(0,at).trim(),amount=value.slice(at+1).trim();
  return e(`${names[key]||key} ${Number(amount)>=0?'+':''}${amount}${key.endsWith('%')?'%':''}`);
};
const artBase=`${import.meta.env?.BASE_URL??'/'}replica-battle`;
const compact=(value,h)=>value>=1e8?`${Number((value/1e8).toFixed(1))}亿`:value>=1e4?`${Number((value/1e4).toFixed(1))}万`:h.number(value);
export function nativeLabPage({snapshot:s,helpers:h}) {
  const e=h.escape;
  const rows=[...s.replicaCollection.labs].sort((a,b)=>Number(b.active)-Number(a.active)||labPresentation[b.id].sort-labPresentation[a.id].sort);
  const cards=rows.map(row=>{
    const level=row.levels.find(level=>level.level===row.level)||row.levels[0];
    const material=level.costs.find(cost=>cost.id>=801&&cost.id<=811);
    const maxed=row.active&&!level.nextId,view=nativeLabView(row,s.replicaCampaign);
    const chapterLocked=Boolean(researchUnlockMessage(s.replicaCampaign,row));
    const label=chapterLocked?'未开启':row.active?`等级${row.level}，${maxed?'已满级':`图纸${material?.available||0}/${material?.count||0}`}`:'尚未解锁';
    const count=row.needActive?'待激活':maxed?'MAX':`${compact(material?.available||0,h)}/${h.number(material?.count||0)}`;
    const progress=material?Math.min(100,(material.available/material.count)*100):maxed?100:0;
    return `<button type="button" class="research-card native-lab-card ${row.active&&!chapterLocked?'':'is-locked'}${chapterLocked?' is-chapter-locked':''}" data-action="nativeLab" data-id="${row.id}" title="${e(row.name)}" aria-label="${e(row.name)}科研，${e(label)}"${chapterLocked?' aria-disabled="true"':''}><span class="research-card-shell" data-psd-quality="0"><img class="native-lab-face" src="${e(artBase+labPresentation[row.id].card)}" alt="${e(row.name)}" draggable="false">${view.canActivate||view.canUpgrade?`<span class="native-lab-notice">${view.canActivate?'激活':'升级'}</span>`:''}${row.active&&!chapterLocked?`<span class="native-lab-progress" aria-label="${e(label)}"><i style="width:${progress}%"></i><b>${count}</b></span><span class="native-lab-level" aria-label="等级${row.level}">${row.level}</span>`:`<span class="native-lab-lock">${h.icon('lock')}</span>${chapterLocked?'':`<span class="native-lab-locked-text">${e(label)}</span>`}`}</span></button>`;
  }).join('');
  return `<section class="research-page rg-page native-lab-page" aria-label="科研实验室"><header class="research-banner has-research-tabs">${researchTabs(s,'lab')}${button('nativeStats','出击属性','','research-summary')}</header><div class="research-scroll" tabindex="0" aria-label="科研项目列表"><div class="research-grid">${cards}</div></div></section>`;
}
export function nativeLabDetail(id,s,h) {
  const e=h.escape,row=s.replicaCollection.labs.find(row=>row.id===id);
  if(!row)return {title:'实验室',content:'<p>项目不存在</p>'};
  const names=s.replicaCollection.attributeNames,view=nativeLabView(row,s.replicaCampaign);
  const source=`<details class="clarity-rules"><summary>图纸获取</summary><p>图纸可通过巡逻、快速巡逻、章节奖励和每日商店获得。</p>${button('patrol','前往巡逻领取')}${button('chapterRewards','查看章节奖励')}</details>`;
  const current=row.levels.find(level=>level.level===row.level),next=view.next;
  const data=`data-id="${row.id}" data-revision="${s.replicaCollection.revision}"`;
  const attributes=level=>level.attributes.map(value=>attr(value,names,e)).join(' · ');
  const costs=view.currentCosts.map(cost=>`<p class="${cost.available<cost.count?'native-lab-shortage':''}">${e(cost.name)}：${h.number(cost.available)} / ${h.number(cost.count)}</p>`).join('');
  const pending=row.needActive?current.skills.map(skill=>`<p><b>${e(plain(skill.name))}</b>：${e(plain(skill.description))}</p>`).join(''):'';
  const control=view.canActivate
    ? `<section class="native-lab-operation"><h3>技能待激活</h3>${pending}${button('nativeLabActivate','激活技能',data)}</section>`
    : row.active&&view.gate.reached&&next
      ? `<section class="native-lab-operation"><h3>升级至 Lv.${next.level}</h3><p>${attributes(next)}</p>${next.skills.map(skill=>`<p>本级解锁：${e(plain(skill.name))}（升级后激活）</p>`).join('')}<div aria-label="升级消耗">${costs}</div>${button('nativeLabUpgrade','研究升级',`${data} ${view.canUpgrade?'':'disabled'}`)}</section>`
      : view.gate.reached?`<p>${e(view.status)}</p>`:'';
  const developer=UNLOCK_ALL_CONTENT?`<details class="native-lab-developer"><summary>开发模式 · 等级预览</summary><p>不消耗材料，直接应用该等级及此前全部技能。普通研究按钮仍按原表扣费。</p><label>研究等级 <select data-native-lab-level="${row.id}" aria-label="${e(row.name)}研究等级">${row.levels.map(level=>`<option value="${level.level}" ${level.level===row.level?'selected':''}>Lv.${level.level}</option>`).join('')}</select></label>${button('nativeLabLevel','应用预览等级',data)}</details>`:'';
  return {title:`${row.name}科研`,content:`<article class="wc-skill-detail native-lab-detail clarity-page"><div class="wc-skill-detail-head"><div class="wc-skill-detail-art">${h.img(nativeLabArt(row),row.name)}</div></div><p>${row.active?`当前等级 Lv.${row.level}`:'尚未解锁'}</p>${current?`<h3>当前属性</h3><p>${attributes(current)}</p>`:''}${control}<details class="clarity-rules"><summary>技能里程碑</summary>${view.milestones.map(level=>`<details ${level.level===row.level?'open':''}><summary>Lv.${level.level} · ${e(level.status)} · ${level.skills.map(skill=>e(plain(skill.name))).join('、')}</summary>${level.skills.map(skill=>`<p>${e(plain(skill.description))}</p>`).join('')}</details>`).join('')}</details>${source}${developer}<details><summary>全部等级属性与升级费用</summary>${row.levels.map(level=>`<details><summary>Lv.${level.level}${row.active&&row.level===level.level?' · 当前':''}</summary><p>${attributes(level)}</p><p>${level.nextId?`升到下一级所需：${level.costs.map(cost=>`${e(cost.name)} ${h.number(cost.count)}`).join('、')}`:'最高等级'}</p></details>`).join('')}</details></article>`};
}
export function nativeStatsDetail(result,h) {
  const e=h.escape;
  if(!result)return {title:'出击属性',content:'<p role="status">正在读取当前配置…</p>'};
  if(result.error)return {title:'出击属性',content:`<p>${e(result.error)}</p>${button('nativeStats','重新读取')}`};
  const entries=values=>Object.entries(values).map(([key,value])=>`<p>${attr(`${key}=${value}`,result.names,e)}</p>`).join('');
  return {title:'出击属性',content:`<article class="wc-skill-detail clarity-page"><h3>战力 ${e(result.power)}</h3><p>攻击 ${e(result.attack)} · 生命 ${e(result.hp)}</p>${result.unsupported.length?`<p>当前配置包含未接通效果，暂不能正式出击：</p>${result.unsupported.map(row=>`<p>${e(plain(row.description))}</p>`).join('')}`:''}<h4>合并属性</h4>${entries(result.attributes)}<details class="clarity-rules"><summary>属性来源</summary>${result.contributions.map(row=>`<details><summary>${e(row.name)}</summary>${entries(row.attributes)}</details>`).join('')}</details><details class="clarity-rules"><summary>初始技能</summary>${result.skills.map(skill=>`<p><b>${e(plain(skill.name))}</b>：${e(plain(skill.description))}${skill.supported?'':'（尚未接通）'}</p>`).join('')}</details></article>`};
}
