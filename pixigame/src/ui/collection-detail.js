import { itemInspectAttributes } from './item-description-model.js';
import {nativeWeaponGroupId,nativeWeaponVariants} from '../replica/native-weapon-groups.js';
import {nativeCollectionArt} from '../replica/native-collection-art.js';
import {nativeCollectionAccess} from '../replica/native-collection-access.js';
import {collectionQualityRank} from '../replica/native-quality.js';
import {projectIcon} from './project-ui-art.js';
import {nativeWeaponSkillArt} from '../replica/native-weapon-skill-art.js';
import {fleetSkillPreview} from './fleet-catalog-page.js';
import './collection-detail.css';
import './weapon-showcase-detail.css';
import {skillEffectText} from './skill-effect-text.js';
import {qualityDisplayLabel} from './quality-display-label.js';

const plain=value=>String(value??'').replace(/<[^>]*>/g,'');
const button=(action,label,attrs,disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;

export function collectionDetailModel(row,attributeNames={}){
  const commonIds=new Set(row.stage.skills.filter(skill=>row.stages.every(stage=>stage.skills.some(candidate=>candidate.id===skill.id))).map(skill=>skill.id));
  const attributes=stage=>(stage.attributes||[]).map(value=>{
    const separator=value.indexOf('='),key=value.slice(0,separator),amount=value.slice(separator+1);
    return {key,label:attributeNames[key]||key,amount:`${Number(amount)>=0?'+':''}${amount}${key.endsWith('%')?'%':''}`};
  });
  return {
    maxStar:Math.max(row.star,...row.stages.map(stage=>stage.star)),
    attributes:attributes(row.stage),
    skills:row.stage.skills.map(skill=>({id:skill.id,text:plain(skill.description)})),
    stages:row.stages.map(stage=>({star:stage.star,unlocked:row.owned&&row.star>=stage.star,current:row.owned&&row.star===stage.star,
      attributes:attributes(stage),skills:stage.skills.filter(skill=>!commonIds.has(skill.id)).map(skill=>({id:skill.id,text:plain(skill.description)}))})),
  };
}

export function collectionDetail(group,row,snapshot,helpers,{preview=false}={}){
  if(group==='guns')return preview?weaponSkillPreview(row,helpers):weaponShowcaseDetail(row,snapshot,helpers);
  const {escape:e}=helpers,model=collectionDetailModel(row,snapshot.replicaCollection.attributeNames);
  const qualityName=qualityDisplayLabel(row.qualityName,row.qualityKnown);
  const attrs=`data-kind="${group}" data-id="${row.id}" data-revision="${snapshot.replicaCollection.revision}"`;
  const statRows=rows=>rows.map(stat=>`<div><dt>${e(stat.label)}</dt><dd>${e(stat.amount)}</dd></div>`).join('');
  const art=`<img src="${e(nativeCollectionArt(row))}" alt="${e(row.name)}">`;
  const variants=group==='guns'?nativeWeaponVariants(snapshot.replicaCollection.guns,row):[];
  const base=variants.find(item=>item.id===nativeWeaponGroupId(row))||row;
  const isSkin=group==='guns'&&row.skinNumber>0;
  const access=nativeCollectionAccess(group,snapshot,row);
  const state=access.collectionUsing?(isSkin?'已穿戴':'使用中'):row.baseOnly?'可用':access.activated?'已激活':'未激活';
  const appearance=preview||variants.length<2?'':
    `<section class="cd-appearance" aria-label="${e(base.name)}外观选择"><h3>${e(base.name)} · 外观</h3><div class="cd-variant-list">${variants.map(item=>`<button type="button" class="wc-button cd-variant" data-action="nativeWeaponSkinSelect" data-id="${item.id}" aria-pressed="${item.id===row.id}" aria-label="查看${e(item.name)}${item.skinNumber>0?'皮肤':'默认外观'}"><img src="${e(nativeCollectionArt(item))}" alt=""><span><b>${item.skinNumber>0?e(item.name):'默认外观'}</b><small>${item.equipped?'使用中':item.owned?item.star+' 星':'未激活'}</small></span></button>`).join('')}</div>${isSkin&&row.description?`<p class="cd-appearance-desc">${e(plain(row.description))}</p>`:''}</section>`;
  const stages=`<section class="cd-stages" aria-label="星级效果"><h3>星级效果</h3><ol>${model.stages.map(stage=>`<li class="${stage.unlocked?'is-unlocked':'is-locked'}${stage.current?' is-current':''}" data-star="${stage.star}"><details class="cd-stage-details"><summary class="cd-stage-label">${projectIcon(stage.unlocked?'star':'lock')}<b>${stage.star} 星</b>${stage.current?'<small>当前</small>':''}</summary><div>${stage.skills.map(skill=>`<p data-skill-id="${skill.id}">${e(skill.text)}</p>`).join('')||`<p>${model.skills.length?'同当前技能':'无技能效果'}</p>`}</div></details></li>`).join('')}</ol></section>${model.stages.some(stage=>stage.attributes.length)?`<details class="cd-more cd-tier-stats"><summary>各星属性</summary>${model.stages.map(stage=>`<section><b>${stage.star} 星</b><dl class="cd-tier-attributes">${statRows(stage.attributes)}</dl></section>`).join('')}</details>`:''}`;
  const costs=row.costs.map(cost=>`<span ${itemInspectAttributes(cost.id,e)} class="${cost.available<cost.count?'is-short':''}"><span>${e(cost.name)}</span><b>${cost.available} / ${cost.count}</b></span>`).join('');
  const growthAction=group==='pilots'?'nativeCollectionOperation':'nativeOperation';
  // Pilot growth opens a preview even when materials are missing.
  const shortage=group==='pilots'&&!row.maxed&&row.costs.some(cost=>Number(cost.available)<Number(cost.count));
  const growthLabel=row.maxed?'已满星':row.owned?'升星':'激活';
  const selection=access.activated||row.baseOnly?button('nativeOperation',access.using?(isSkin?'已穿戴':'使用中'):(isSkin?'穿戴':group==='guns'?'装备':'使用'),`data-kind="${group}" data-id="${access.selectionId}" data-revision="${snapshot.replicaCollection.revision}" data-operation="select"`,!access.available||access.using):'';
  const footer=preview?button('close','返回',''):selection+button(growthAction,growthLabel,`${attrs} data-operation="${row.owned?'star':'unlock'}"${shortage?' data-shortage="true"':''}`,group==='pilots'?row.maxed:!row.canPurchase);
  return {title:preview?`${row.name} · 星级效果`:row.name,content:`<article class="collection-detail${preview?' is-preview':''}" data-collection-kind="${group}" data-quality="${collectionQualityRank(row.quality)}">
    <div class="cd-scroll"><header class="cd-hero"><div class="cd-badges">${qualityName?`<span>${e(qualityName)}</span>`:''}<span>${state}</span></div><div class="cd-art">${art}</div><div class="cd-stars" aria-label="${row.owned?row.star:0} / ${model.maxStar} 星">${Array.from({length:model.maxStar},(_,index)=>projectIcon('star',row.owned&&index<row.star?'':'is-icon-muted')).join('')}</div><p>${row.owned?`${row.star} / ${model.maxStar} 星`:`未激活 · ${row.stage.star} 星预览`}</p></header>
    ${appearance}${!preview&&model.attributes.length?`<section class="cd-attributes"><h3>${row.owned?'收藏属性':'激活后收藏属性'}</h3><dl>${statRows(model.attributes)}</dl></section>`:''}
    <section class="cd-current"><h3>${projectIcon('nav-skill')}${row.owned?'当前技能':'技能预览'}</h3>${model.skills.map(skill=>`<p data-skill-id="${skill.id}">${e(skill.text)}</p>`).join('')||'<p>当前星级无技能</p>'}</section>
    ${preview?stages:`<div class="cd-preview-link">${button('nativeSkillPreview','星级效果',attrs)}</div>`}${group==='guns'?`<details class="cd-more"><summary>攻击预览</summary><div>${button('nativeWeaponPreview','基础攻击',`data-id="${row.id}" data-mode="base"`)}${button('nativeWeaponPreview','局内成长',`data-id="${row.id}" data-mode="growth"`)}</div></details>`:''}</div>
    <footer class="cd-footer">${!preview&&!row.maxed&&costs?`<div class="cd-costs" aria-label="${row.owned?'升星':'激活'}消耗">${costs}</div>`:''}<div class="cd-actions">${footer}</div></footer>
  </article>`};
}

function weaponSkillPreview(row,{escape:e}){
  const commonIds=new Set(row.stage.skills.filter(skill=>row.stages.every(stage=>stage.skills.some(candidate=>candidate.id===skill.id))).map(skill=>skill.id));
  const effects=stage=>{const specific=stage.skills.filter(skill=>!commonIds.has(skill.id));return specific.length?specific:stage.skills;};
  // Reuse the aircraft/pilot preview itself, including its PSD frame, star
  // rows and dimensions. Only the native weapon skill data is adapted here.
  return fleetSkillPreview({kind:'weapon',item:{id:String(row.id),stars:row.star,owned:row.owned},helpers:{escape:e},
    levels:row.stages.map(stage=>stage.star),formatDescription:skillEffectText,
    skillFor:(_kind,item)=>{
      const stage=row.stages.find(stage=>stage.star===(item.stars||row.defaultStar))||row.stages[0];
      const skills=effects(stage);
      return {name:plain(skills[0]?.name||row.name),ownerName:row.name,
        image:nativeWeaponSkillArt(row),icon:'nav-skill',
        description:skills.map(skill=>skill.description).join('\n')||'该星级无技能效果。'};
    }});
}

// WeaponInfo: one display stage, then the real same-family appearance cards.
// Keep progression data/actions native; the catalogue's art supplies the scene.
function weaponShowcaseDetail(row,snapshot,{escape:e}){
  const collection=snapshot.replicaCollection,model=collectionDetailModel(row,collection.attributeNames);
  const access=nativeCollectionAccess('guns',snapshot,row);
  const variants=nativeWeaponVariants(collection.guns,row);
  const attrs=`data-kind="guns" data-id="${row.id}" data-revision="${collection.revision}"`;
  const stars=item=>Array.from({length:Math.max(item.star,...item.stages.map(stage=>stage.star))},(_,i)=>projectIcon('star',item.owned&&i<item.star?'':'is-icon-muted')).join('');
  const costs=row.costs.map(cost=>`<span ${itemInspectAttributes(cost.id,e)} class="${cost.available<cost.count?'is-short':''}">${e(cost.name)} <b>${cost.available}/${cost.count}</b></span>`).join('');
  const skillArt=nativeWeaponSkillArt(row);
  const equip=access.available&&!access.using?button('nativeOperation','穿戴',`data-kind="guns" data-id="${access.selectionId}" data-revision="${collection.revision}" data-operation="select"`):'';
  return {title:row.name,content:`<article class="wd-showcase" data-collection-kind="guns" data-weapon-id="${row.id}">
    <section class="wd-stage" aria-label="${e(row.name)}展示">
      <div class="wd-stat-block"><div class="wd-stars" aria-label="${row.owned?row.star:0} / ${model.maxStar} 星">${stars(row)}</div><dl>${model.attributes.map(stat=>`<div><dt>${e(stat.label)}</dt><dd>${e(stat.amount)}</dd></div>`).join('')}</dl></div>
      <img class="wd-platform" src="${import.meta.env?.BASE_URL??'/'}art/project-fleet-stage-v2/platform.png" alt="" draggable="false">
      <button type="button" class="wd-weapon" data-action="nativeWeaponPreview" data-id="${row.id}" data-mode="base" aria-label="查看${e(row.name)}基础攻击"><img src="${e(nativeCollectionArt(row))}" alt="${e(row.name)}" draggable="false"></button>
      <button type="button" class="wd-skill" data-action="nativeSkillPreview" ${attrs} aria-label="查看${e(row.name)}技能预览">${skillArt?`<img src="${e(skillArt)}" alt="" draggable="false">`:projectIcon('nav-skill')}<span>${row.owned?'已获得技能':'技能预览'}</span></button>
      <div class="wd-upgrade"><div class="wd-upgrade-actions">${equip}${button('nativeOperation',row.maxed?'已满星':row.owned?'升星':'激活',`${attrs} data-operation="${row.owned?'star':'unlock'}"`,!row.canPurchase||row.maxed)}</div>${!row.maxed&&costs?`<div class="wd-costs" aria-label="${row.owned?'升星':'激活'}消耗">${costs}</div>`:''}</div>
    </section>
    <div class="wd-variants" aria-label="武器外观">${variants.map(item=>`<button type="button" class="wd-variant${item.owned?'':' is-locked'}" data-action="nativeWeaponSkinSelect" data-id="${item.id}" aria-pressed="${item.id===row.id}" aria-label="查看${e(item.name)}${item.skinNumber>0?'皮肤':'默认外观'}" aria-description="${e(item.name)}"><span class="wd-variant-plate" data-psd-quality="${collectionQualityRank(item.quality)}"><span class="fc-card-surface" aria-hidden="true"></span><img class="wd-variant-art" src="${e(nativeCollectionArt(item))}" alt="${e(item.name)}" draggable="false">${item.equipped?projectIcon('check','wd-marker'):!item.owned?projectIcon('lock','wd-marker is-lock'):''}<span class="wd-stars" aria-label="${item.star}星">${stars(item)}</span></span></button>`).join('')}</div>
  </article>`};
}
