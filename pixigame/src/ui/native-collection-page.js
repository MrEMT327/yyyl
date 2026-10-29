import { nativeCollectionArt } from '../replica/native-collection-art.js';
import { projectIcon } from './project-ui-art.js';
import { catalogWeaponArtwork } from './weapon-catalog-page.js';
import './native-collection-page.css';
import { collectionQualityRank } from '../replica/native-quality.js';

const kinds={weapon:'guns',aircraft:'skins',pilot:'pilots'};
const titles={weapon:'武器',aircraft:'飞机',pilot:'驾驶员'};
const plain=value=>String(value||'').replace(/<[^>]*>/g,'');
const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;
export function nativeCollectionPage({kind,snapshot:s,selectedId,skillTab,helpers:h,appearanceOnly=false}) {
  const {escape:e}=h,collection=s.replicaCollection,group=kinds[kind];
  if (!collection || !group) return '';
  if (appearanceOnly && kind!=='weapon') return appearancePage({kind,snapshot:s,helpers:h});
  const rows=collection[group],selected=rows.find(row=>row.id===Number(selectedId))||rows.find(row=>row.equipped)||rows[0];
  if (!selected) return '<section class="ref-catalog wc-page"><p>暂无内容</p></section>';
  const attrs=row=>`data-kind="${group}" data-id="${row.id}" data-revision="${collection.revision}"`;
  const artwork=row=>row.appearance ? catalogWeaponArtwork({id:row.appearance},h)
    : `<span class="wc-art"><span><img class="nc-original-art" src="${e(nativeCollectionArt(row))}" alt="${e(row.name)}"></span></span>`;
  const stars=row=>`<span class="wc-stars" aria-label="${row.star}星">${Array.from({length:Math.max(1,...row.stages.map(s=>s.star))},(_,i)=>projectIcon('star',i<row.star?'':'is-icon-muted')).join('')}</span>`;
  const attrText=value=>{
    const at=value.indexOf('='),key=value.slice(0,at),amount=value.slice(at+1);
    return `${collection.attributeNames[key]||key} ${Number(amount)>=0?'+':''}${amount}${key.endsWith('%')?'%':''}`;
  };
  const stageText=stage=>`<p>收藏属性：${stage.attributes.length?stage.attributes.map(value=>e(attrText(value))).join(' · '):'无'}</p>${stage.skills.map(skill=>`<p><b>${e(plain(skill.name))}</b>：${e(plain(skill.description))}</p>`).join('')}`;
  const costs=selected.costs.map(cost=>`${e(cost.name)} ${cost.available}/${cost.count}`).join('、');
  const purchase=selected.maxed?'已满星':selected.owned?'升星':'激活';
  const operation=`${button('nativeOperation',selected.equipped?'使用中':'使用',`${attrs(selected)} data-operation="select"`,!selected.owned||selected.equipped)}${button('nativeOperation',purchase,`${attrs(selected)} data-operation="${selected.owned?'star':'unlock'}"`,!selected.canPurchase)}`;
  const slotName=id=>rows.find(row=>row.id===id)?.name||'空';
  const slots=kind==='aircraft'?`<section class="nc-slots"><h3>飞机技能</h3>${collection.slots.map((id,index)=>`<div><span>${index+1} · ${e(slotName(id))}</span>${button('nativeOperation','装入',`${attrs(selected)} data-operation="slot" data-slot="${index}"`,!selected.owned||!selected.stage.skills.length||id===selected.id)}${button('nativeOperation','卸下',`data-kind="skins" data-id="0" data-revision="${collection.revision}" data-operation="slot" data-slot="${index}"`,!id)}</div>`).join('')}</section>`:'';
  const reset=kind!=='weapon'?button('nativeOperation',kind==='aircraft'?'基础飞机':'不带驾驶员',`data-kind="${group}" data-id="0" data-revision="${collection.revision}" data-operation="select"`):'';
  const details=skillTab?selected.stages.map(stage=>`<section class="nc-stage"><h3>${stage.star} 星${stage.star===selected.star?' · 当前':''}</h3>${stageText(stage)}</section>`).join('')
    :`<section class="nc-detail"><h3>${e(selected.name)} · ${e(selected.qualityName||'未标注品质')} · ${selected.owned?`${selected.star} 星`:'未激活'}</h3>${stageText(selected.stage)}<p class="nc-cost">${selected.maxed?'已达到最高星级':costs||'暂无可用消耗配置'}</p><div class="nc-actions">${operation}${reset}</div></section>${slots}<div class="wc-grid">${rows.map(row=>`<div class="wc-item-wrap"><button type="button" class="wc-item${row.owned?'':' is-locked'}" data-psd-quality="${collectionQualityRank(row.quality)}" data-action="catalogSelect" data-id="${row.id}" aria-pressed="${row.id===selected.id}" aria-label="${e(row.name)}，${e(row.qualityName||'未标注品质')}，${row.star}星${row.equipped?'，使用中':''}">${artwork(row)}${stars(row)}${row.equipped?projectIcon('check','wc-selected'):''}${!row.owned?projectIcon('lock','wc-lock'):''}</button><span class="wc-item-name">${e(row.name)}</span></div>`).join('')}</div>`;
  return `<section class="ref-catalog wc-page nc-page" data-catalog-kind="${kind}" aria-label="${titles[kind]}养成"><div class="wc-hero"><h1 class="wc-page-title">${titles[kind]}</h1><div class="wc-hero-art">${artwork(selected)}</div>${kind!=='weapon'?`<div class="wc-hero-tools">${button('nativeAppearance','外观','data-mode="appearance"')}</div>`:''}</div><header class="wc-heading"><h2>${e(selected.name)}</h2></header><div class="ref-catalog-scroll wc-scroll" data-catalog-scroll="${kind}:${skillTab?'skills':'list'}">${details}</div><nav class="wc-footer">${button('catalogBack','返回')}${button('nativeStats','属性')}${button('nativeMaterials','材料')}${button('catalogMode','养成','data-mode="list"')}${button('catalogMode','星级技能','data-mode="skills"')}</nav></section>`;
}
function appearancePage({kind,snapshot:s,helpers:h}) {
  const e=h.escape,rows=(kind==='aircraft'?s.aircraft:s.pilots)||[],active=kind==='aircraft'?s.aircraftId:s.pilotId;
  return `<section class="ref-catalog wc-page nc-page nc-appearance"><header class="wc-heading"><h2>${titles[kind]}外观</h2></header><div class="ref-catalog-scroll wc-scroll"><p class="nc-cost">外观选择不改变已装备的属性和技能。</p><div class="wc-grid">${rows.map(row=>`<div class="wc-item-wrap"><button type="button" class="wc-item" data-action="${kind==='aircraft'?'selectAircraft':'selectPilot'}" data-id="${e(row.id)}" aria-label="使用${e(row.name)}外观" aria-pressed="${row.id===active}"${!row.owned||row.id===active?' disabled':''}><span class="wc-art"><span>${kind==='aircraft'?h.thumbnail(row.id):h.img(row.avatar||row.image,row.name,'nc-original-art')}</span></span>${row.id===active?projectIcon('check','wc-selected'):''}${!row.owned?projectIcon('lock','wc-lock'):''}</button><span class="wc-item-name">${e(row.name)}</span></div>`).join('')}</div></div><nav class="wc-footer">${button('nativeAppearance','返回','data-mode="progression"')}</nav></section>`;
}
