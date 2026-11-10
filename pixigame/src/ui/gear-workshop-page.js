import {gearCard,gearArt} from './airframe-equipment-page.js';

import {emptySlotMark} from './psd-empty-slot.js';

import {gearMergeDraft} from './gear-merge-selection.js';

import {gearAttributes,GEAR_PARTS} from '../peripheral/equipment-system.js';
import {gearDetailSkills} from './gear-detail-model.js';

import {projectIconUrl} from './project-ui-art.js';
import {guideMascotMarkup} from './guide-presentation.js';

import './gear-workshop-page.css';

const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs} ${disabled?'disabled':''}>${label}</button>`;

export function gearWorkshopPage({snapshot:s,helpers:h,gearWorkshop,workshopFilter='all',workshopBackLabel='返回装备'}){

 const gear=s.equipment,{escape:e}=h,draft=gearMergeDraft(gear,gearWorkshop);

 const {target,option,materialIds,tokens,ready,stale}=draft;

 const result=target&&option?.nextQuality?{...target,quality:option.nextQuality,qualityRank:Math.floor(option.nextQuality/10)-1}:null;

 const slot=(item,index,label,ghost=false)=>`<button type="button" class="ws-slot gm-slot ${item?'':'is-empty'}${ghost?' is-needed':''}" ${item?`data-psd-quality="${item.qualityRank}"`:''} ${index<0||ghost?'disabled':!target?'data-action="workshopChoose"':`data-action="workshopGearRemove" data-index="${index}"`} aria-label="${e(label)}${item?'，'+e(item.name):'，空槽'}"><span class="ws-slot-art">${item?`<img src="${gearArt(item.art)}" alt="" draggable="false">`:emptySlotMark()}</span></button>`;

 const materialSlots=Array.from({length:1+(option?.required||0)},(_,index)=>{

  const item=index===0?target:index<=materialIds.length?gear.items.find(i=>i.uid===materialIds[index-1]):index<=materialIds.length+tokens?{...target,name:'合成材料',quality:option.quality,qualityRank:Math.floor(option.quality/10)-1}:null;

  const ghost=!item&&index>0;
  const placeholder=ghost?{...target,quality:option.quality,qualityRank:Math.floor(option.quality/10)-1}:item;
  return `${index===1?emptySlotMark('gm-plus'):''}${slot(placeholder,index,index===0?'主装备':`材料${index}${ghost?'，待添加':''}`,ghost)}`;

 }).join('');

 const filterName=gear.blueprints.find(p=>String(p.type)===workshopFilter)?.name||'全部';

 const items=gear.items.filter(i=>workshopFilter==='all'||String(i.type)===workshopFilter).sort((a,b)=>b.quality-a.quality||a.type-b.type||a.uid.localeCompare(b.uid));

 const eligible=id=>!target||stale||id===target.uid||materialIds.includes(id)||option?.candidates.includes(id);

 const part=GEAR_PARTS.find(part=>part.type===target?.type);
 const nextAttribute=result&&part?gearAttributes(result).value?.[part.attribute]:null;
 const newSkills=result?gearDetailSkills(result).filter(skill=>skill.unlocked&&skill.quality>target.quality):[];
 const remaining=Math.max(0,(option?.required||0)-materialIds.length-tokens);
 const protectedMaterial=option?.any&&materialIds.some(id=>option.protectedIds?.includes(id));
 const notice=stale?'装备已变化，请重新选择':!target?'':!option?.required?'已达最高品质':protectedMaterial?'将消耗同名保留件；降阶仅返通用材料':remaining?`还需要 <b>${remaining}</b> 件${option.any?'同部位材料':'相同装备'}`:'材料已齐全';

 const fodder=Object.entries(gear.fodder).filter(([key,count])=>count>0&&(workshopFilter==='all'||key.split(':')[0]===workshopFilter));

 return `<section class="ws-page gm-page" aria-label="改装间" data-workshop-mode="gear" data-has-target="${Boolean(target)}"><div class="ws-stage"><header class="ws-header"><h1>改装间</h1></header>

 <div class="ws-recipe gm-recipe">${slot(result,-1,'合成后')}<img class="ws-arrow" src="${projectIconUrl('equipment-upgrade')}" alt=""><div class="gm-materials">${materialSlots}</div></div>

 <div class="ws-assistant">
  <div class="ws-message"><div class="ws-message-body"${target?' role="region" aria-label="合成属性与技能预览" tabindex="0"':''}>${!target?'<p>请选择要合成的装备</p>':`<p class="gm-stat-preview"><span>${e(target.attributeName||part?.attributeName||'属性')}</span><b>+${e(String(target.attribute??0))}</b>${Number.isFinite(nextAttribute)?`<img src="${projectIconUrl('equipment-upgrade')}" alt="提升至"><strong>+${e(String(nextAttribute))}</strong>`:''}</p>${newSkills.map(skill=>`<p class="gm-new-skill">${e(skill.text)}</p>`).join('')}`}</div></div>
  <div class="ws-assistant-art">${guideMascotMarkup()}</div>
 </div>${notice?`<p class="gm-notice" role="status">${notice}</p>`:''}</div>

 <header class="ws-warehouse-heading">${button('workshopFilter',workshopFilter==='all'?'筛选':e(filterName),'aria-label="筛选装备部位"')}<h2>仓库</h2>${button('workshopGearBatch','一键合成','',!gear.items.some(item=>item.quality<40&&!item.locked&&item.merge.available))}</header>

 <div class="ref-warehouse ws-inventory" data-workshop-scroll="gear:${workshopFilter}"><div class="ws-grid ag-grid">${items.map(item=>gearCard(item,h,{action:'workshopGearPick',selected:target?.uid===item.uid||materialIds.includes(item.uid),disabled:!eligible(item.uid)})).join('')}</div>${fodder.length?`<div class="gm-fodder">${fodder.map(([key,count])=>{

 const [type,q]=key.split(':').map(Number),part=gear.blueprints.find(p=>p.type===type),allowed=!stale&&option?.tokenKey===key&&tokens+materialIds.length<option.required;

 return button('workshopGearToken',`<span data-psd-quality="${Math.floor(q/10)-1}" class="gm-fodder-art"><img src="${gearArt(part.id)}" alt=""></span><span>${e(part.name)}材料 ${option?.tokenKey===key?tokens:0}/${count}</span>`,`data-key="${key}"`,!allowed);

 }).join('')}</div>`:''}</div>

 <footer class="ws-footer">${button('catalogBack','',`aria-label="${e(workshopBackLabel)}"`)}${button('workshopGearCompose','合成','',!ready)}</footer></section>`;

}
