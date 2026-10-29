import {nativeWeaponGroupId,nativeWeaponVariants} from '../replica/native-weapon-groups.js';
import {nativeCollectionArt} from '../replica/native-collection-art.js';
import {collectionQualityRank} from '../replica/native-quality.js';
import {projectIcon} from './project-ui-art.js';
import './collection-detail.css';

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
  const {escape:e}=helpers,model=collectionDetailModel(row,snapshot.replicaCollection.attributeNames);
  const attrs=`data-kind="${group}" data-id="${row.id}" data-revision="${snapshot.replicaCollection.revision}"`;
  const statRows=rows=>rows.map(stat=>`<div><dt>${e(stat.label)}</dt><dd>${e(stat.amount)}</dd></div>`).join('');
  const art=`<img src="${e(nativeCollectionArt(row))}" alt="${e(row.name)}">`;
  const variants=group==='guns'?nativeWeaponVariants(snapshot.replicaCollection.guns,row):[];
  const base=variants.find(item=>item.id===nativeWeaponGroupId(row))||row;
  const isSkin=group==='guns'&&row.skinNumber>0;
  const state=row.equipped?(isSkin?'已穿戴':'使用中'):row.owned?'已激活':'未激活';
  const appearance=preview||variants.length<2?'':
    `<section class="cd-appearance" aria-label="${e(base.name)}外观选择"><h3>${e(base.name)} · 外观</h3><div class="cd-variant-list">${variants.map(item=>`<button type="button" class="wc-button cd-variant" data-action="nativeWeaponSkinSelect" data-id="${item.id}" aria-pressed="${item.id===row.id}" aria-label="查看${e(item.name)}${item.skinNumber>0?'皮肤':'默认外观'}"><img src="${e(nativeCollectionArt(item))}" alt=""><span><b>${item.skinNumber>0?e(item.name):'默认外观'}</b><small>${item.equipped?'使用中':item.owned?item.star+' 星':'未激活'}</small></span></button>`).join('')}</div>${isSkin&&row.description?`<p class="cd-appearance-desc">${e(plain(row.description))}</p>`:''}</section>`;
  const stages=`<section class="cd-stages" aria-label="星级效果"><h3>星级效果</h3><ol>${model.stages.map(stage=>`<li class="${stage.unlocked?'is-unlocked':'is-locked'}${stage.current?' is-current':''}" data-star="${stage.star}"><details class="cd-stage-details"><summary class="cd-stage-label">${projectIcon(stage.unlocked?'star':'lock')}<b>${stage.star} 星</b>${stage.current?'<small>当前</small>':''}</summary><div>${stage.skills.map(skill=>`<p data-skill-id="${skill.id}">${e(skill.text)}</p>`).join('')||`<p>${model.skills.length?'同当前技能':'无技能效果'}</p>`}</div></details></li>`).join('')}</ol></section>${model.stages.some(stage=>stage.attributes.length)?`<details class="cd-more cd-tier-stats"><summary>各星属性</summary>${model.stages.map(stage=>`<section><b>${stage.star} 星</b><dl class="cd-tier-attributes">${statRows(stage.attributes)}</dl></section>`).join('')}</details>`:''}`;
  const costs=row.costs.map(cost=>`<span class="${cost.available<cost.count?'is-short':''}"><span>${e(cost.name)}</span><b>${cost.available} / ${cost.count}</b></span>`).join('');
  const growthAction=group==='pilots'?'nativeCollectionOperation':'nativeOperation';
  // Pilot growth opens a preview even when materials are missing.
  const shortage=group==='pilots'&&!row.maxed&&row.costs.some(cost=>Number(cost.available)<Number(cost.count));
  const growthLabel=row.maxed?'已满星':row.owned?'升星':'激活';
  const footer=preview?button('close','返回',''):button('nativeOperation',row.equipped?(isSkin?'已穿戴':'使用中'):(isSkin?'穿戴':'装备'),`${attrs} data-operation="select"`,!row.owned||row.equipped)+button(growthAction,growthLabel,`${attrs} data-operation="${row.owned?'star':'unlock'}"${shortage?' data-shortage="true"':''}`,group==='pilots'?row.maxed:!row.canPurchase);
  return {title:preview?`${row.name} · 星级效果`:row.name,content:`<article class="collection-detail${preview?' is-preview':''}" data-collection-kind="${group}" data-quality="${collectionQualityRank(row.quality)}">
    <div class="cd-scroll"><header class="cd-hero"><div class="cd-badges"><span>${e(row.qualityName||'')}</span><span>${state}</span></div><div class="cd-art">${art}</div><div class="cd-stars" aria-label="${row.owned?row.star:0} / ${model.maxStar} 星">${Array.from({length:model.maxStar},(_,index)=>projectIcon('star',row.owned&&index<row.star?'':'is-icon-muted')).join('')}</div><p>${row.owned?`${row.star} / ${model.maxStar} 星`:`未激活 · ${row.stage.star} 星预览`}</p></header>
    ${appearance}${!preview&&model.attributes.length?`<section class="cd-attributes"><h3>${row.owned?'收藏属性':'激活后收藏属性'}</h3><dl>${statRows(model.attributes)}</dl></section>`:''}
    <section class="cd-current"><h3>${projectIcon('skill-tab')}${row.owned?'当前技能':'技能预览'}</h3>${model.skills.map(skill=>`<p data-skill-id="${skill.id}">${e(skill.text)}</p>`).join('')||'<p>当前星级无技能</p>'}</section>
    ${preview?stages:`<div class="cd-preview-link">${button('nativeSkillPreview','星级效果',attrs)}</div>`}${!preview&&group==='guns'?`<details class="cd-more"><summary>攻击与获取</summary><div>${button('nativeWeaponPreview','基础攻击',`data-id="${row.id}" data-mode="base"`)}${button('nativeWeaponPreview','局内成长',`data-id="${row.id}" data-mode="growth"`)}${button('collectionSupplyOpen','获取同名卡',`data-kind="guns" data-id="${row.id}"`)}</div></details>`:''}</div>
    <footer class="cd-footer">${!preview&&!row.maxed&&costs?`<div class="cd-costs" aria-label="${row.owned?'升星':'激活'}消耗">${costs}</div>`:''}<div class="cd-actions">${footer}</div></footer>
  </article>`};
}
