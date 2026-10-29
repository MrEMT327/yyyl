import {gearCard,gearArt} from './airframe-equipment-page.js';
import {emptySlotMark} from './psd-empty-slot.js';
import {gearMergeDraft} from './gear-merge-selection.js';
import {gearStage} from '../peripheral/equipment-system.js';
import {projectIconUrl} from './project-ui-art.js';
import './gear-workshop-page.css';
const base=import.meta.env?.BASE_URL??'/';
const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs} ${disabled?'disabled':''}>${label}</button>`;
export function gearWorkshopPage({snapshot:s,helpers:h,gearWorkshop,workshopFilter='all'}){
 const gear=s.equipment,{escape:e}=h,draft=gearMergeDraft(gear,gearWorkshop);
 const {target,option,materialIds,tokens,ready,stale}=draft;
 const result=target&&option?.nextQuality?{...target,quality:option.nextQuality,qualityRank:Math.floor(option.nextQuality/10)-1}:null;
 const slot=(item,index,label)=>`<button type="button" class="ws-slot gm-slot ${item?'':'is-empty'}" ${item?`data-psd-quality="${item.qualityRank}"`:''} ${index<0?'disabled':`data-action="workshopGearRemove" data-index="${index}"`} aria-label="${e(label)}${item?'，'+e(item.name):'，空槽'}"><small>${label}</small><span class="ws-slot-art">${item?`<img src="${gearArt(item.art)}" alt="">`:emptySlotMark()}</span>${item?`<b class="ws-slot-level">${item.quality%10?'+'+item.quality%10:'Lv.'+item.level}</b>`:''}</button>`;
 const materialSlots=Array.from({length:Math.max(2,1+(option?.required||0))},(_,index)=>{
  const item=index===0?target:index<=materialIds.length?gear.items.find(i=>i.uid===materialIds[index-1]):index<=materialIds.length+tokens?{...target,name:'合成材料',quality:option.quality,qualityRank:Math.floor(option.quality/10)-1}:null;
  return slot(item,index,index===0?'主装备':`材料${index}`);
 }).join('');
 const filterName=gear.blueprints.find(p=>String(p.type)===workshopFilter)?.name||'全部';
 const items=gear.items.filter(i=>workshopFilter==='all'||String(i.type)===workshopFilter).sort((a,b)=>b.quality-a.quality||a.type-b.type||a.uid.localeCompare(b.uid));
 const eligible=id=>!target||stale||id===target.uid||materialIds.includes(id)||option?.candidates.includes(id);
 const nextCap=result?gearStage(result)?.LevelCap:null;
 const fodder=Object.entries(gear.fodder).filter(([key,count])=>count>0&&(workshopFilter==='all'||key.split(':')[0]===workshopFilter));
 return `<section class="ws-page gm-page" aria-label="改装间" data-workshop-mode="gear"><div class="ws-stage"><header class="ws-header"><h1>改装间</h1></header>
 <div class="ws-recipe gm-recipe">${slot(result,-1,'合成后')}<img class="ws-arrow" src="${projectIconUrl('upgrade-arrow')}" alt=""><div class="gm-materials">${materialSlots}</div></div>
 <div class="ws-message"><h2>${target?e(target.name):'选择主装备'}</h2><p role="status">${stale?'装备已变化，请重新选材':!target?'从仓库选择装备':!option?.required?'已达最高品质':`材料 ${materialIds.length+tokens}/${option.required}`}</p>${option?.required?`<small>${option.any&&materialIds.some(id=>option.protectedIds?.includes(id))?'将消耗同名保留件；降阶仅返通用材料':`${option.any?'同部位普通装备或通用材料':'同系列同部位材料'} · 可强化至 ${nextCap}`}</small>`:''}</div>
 <img class="ws-technician" src="${base}art/project-workshop-technician-v2/technician-v2.webp" alt="" aria-hidden="true" draggable="false"></div>
 <header class="ws-warehouse-heading">${button('workshopFilter',workshopFilter==='all'?'筛选':e(filterName),'aria-label="筛选装备部位"')}<h2>仓库</h2>${button('workshopGearBatch','一键合成','',!gear.items.some(item=>item.quality<40&&!item.locked&&item.merge.available))}</header>
 <div class="ref-warehouse ws-inventory" data-workshop-scroll="gear:${workshopFilter}"><div class="ws-grid ag-grid">${items.map(item=>gearCard(item,h,{action:'workshopGearPick',selected:target?.uid===item.uid||materialIds.includes(item.uid),disabled:!eligible(item.uid)})).join('')}</div>${fodder.length?`<div class="gm-fodder">${fodder.map(([key,count])=>{
 const [type,q]=key.split(':').map(Number),part=gear.blueprints.find(p=>p.type===type),allowed=!stale&&option?.tokenKey===key&&tokens+materialIds.length<option.required;
 return button('workshopGearToken',`<span data-psd-quality="${Math.floor(q/10)-1}" class="gm-fodder-art"><img src="${gearArt(part.id)}" alt=""></span><span>${e(part.name)}材料 ${option?.tokenKey===key?tokens:0}/${count}</span>`,`data-key="${key}"`,!allowed);
 }).join('')}</div>`:''}</div>
 <footer class="ws-footer">${button('catalogBack','返回')}${button('workshopGearCompose','合成','',!ready)}</footer></section>`;
}
