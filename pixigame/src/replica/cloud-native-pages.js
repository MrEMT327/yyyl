import { nativeWeaponDisplayText } from './native-weapon-display.js';
import {nativeWeaponGroupId,nativeWeaponCatalogRows} from './native-weapon-groups.js';
import { NATIVE_AIRCRAFT_SKINS } from './native-aircraft-skins.js';
import {nativeCollectionAccess,nativeCollectionRows} from './native-collection-access.js';
import { nativeCollectionArt, nativeSkillArt } from './native-collection-art.js';
import { nativeWeaponSkillArt } from './native-weapon-skill-art.js';
import { nativeItemArt } from './native-item-presentation.js';
import { NATIVE_PILOT_SKINS } from './native-pilot-roster.js';
import { nativePilotDisplayQuality } from './native-pilot-quality.js';
import { nativePilotAppearance } from './native-pilot-presentation.js';
import { characterPortrait } from '../ui/character-portraits.js';
import { supplyWeaponArt } from '../ui/supply-visuals.js';
import { collectionDetail } from '../ui/collection-detail.js';
import { fleetCatalogPage, fleetSkillPreview, fleetAircraftDetail, fleetPilotDetail, fleetOperationModal } from '../ui/fleet-catalog-page.js';
import { weaponCatalogPage, catalogWeaponArtwork } from '../ui/weapon-catalog-page.js';
import { nativeWeaponSkillPage } from '../ui/native-weapon-skill-page.js';
import { recruitPage } from '../ui/recruit-page.js';
import weaponPreview from './native-weapon-preview-index.json' with {type:'json'};
import { projectIcon } from '../ui/project-ui-art.js';
import { collectionQualityRank } from './native-quality.js';
const groupFor={weapon:'guns',aircraft:'skins',pilot:'pilots'};
// Native pilot IDs do not belong to the retired cloud combat categories.
// Filter the actual collection state without assigning invented skill types.
const nativePilotFilters=Object.freeze([{id:'all',label:'全部'},{id:'owned',label:'已激活'},{id:'locked',label:'未激活'}]);
const plain=value=>nativeWeaponDisplayText(String(value||'').replace(/<[^>]*>/g,''));
const icon=nativeCollectionArt;
const weaponSkillArtwork=(row,e)=>{
  const url=nativeWeaponSkillArt(row);
  return url?`<img class="weapon-skill-icon native-weapon-skill-icon" data-weapon-skill-family="${nativeWeaponGroupId(row)}" src="${e(url)}" alt="${e(row.name)}技能" draggable="false">`:'';
};
const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;
const template=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};

// Use the cloud's page functions verbatim. This adapter supplies native rows,
// costs and IDs, then routes controls to the existing native transactions.
export function cloudNativeCatalog(ctx){
  const {kind,snapshot:s,helpers:h}=ctx,group=groupFor[kind],collection=s.replicaCollection;
  if(!collection||!group)return '';
  if(kind==='weapon'&&ctx.skillTab)return nativeWeaponSkillPage(ctx);
  if(ctx.appearanceOnly&&kind!=='weapon'){
    const t=template(fleetCatalogPage({...ctx,skillTab:false}));
    for(const node of t.content.querySelectorAll('.fc-header-stats,.fc-unlock-skill,.fc-worn-skills,[data-action="fleetStar"],[data-action="fleetUnlock"]'))node.remove();
    for(const node of t.content.querySelectorAll('[data-action="catalogMode"],[data-action="catalogBack"],[data-action="aircraftInfo"],[data-action="pilotInfo"]')){node.dataset.action='nativeAppearance';node.dataset.mode='progression';}
    return t.innerHTML;
  }
  const collectionRows=nativeCollectionRows(group,s);
  const rows=kind==='weapon'?nativeWeaponCatalogRows(collectionRows):collectionRows;
  const byId=new Map(rows.map(row=>[String(row.id),row]));
  const requested=collectionRows.find(row=>String(row.id)===String(ctx.selectedId));
  const selectedId=kind==='weapon'&&requested?nativeWeaponGroupId(requested):ctx.selectedId;
  const selected=byId.get(String(selectedId))||rows.find(row=>nativeCollectionAccess(group,s,row).using)||rows[0];
  if(!selected)return '';
  const e=h.escape;
  const items=rows.map(row=>({...row,id:String(row.id),owned:nativeCollectionAccess(group,s,row).available,activated:row.owned,stars:row.star,qualityRank:collectionQualityRank(row.quality),
    avatar:icon(row),image:nativeCollectionArt(row,'default'),rarity:kind==='pilot'?nativePilotDisplayQuality({nativeId:row.id}).rarity:'R',copies:0,attack:undefined,hp:undefined,temporaryUnlocked:false}));
  const slots=(kind==='aircraft'?collection.slots:collection.pilotSlots||[0,0,0]).map(id=>id?String(id):null);
  const pilotSkills=kind==='pilot'&&ctx.skillTab;
  const selectedSkillSlot=pilotSkills
    ?Number.isInteger(ctx.selectedSkillSlot)&&ctx.selectedSkillSlot>=0&&ctx.selectedSkillSlot<slots.length?ctx.selectedSkillSlot:Math.max(0,slots.indexOf(null))
    :ctx.selectedSkillSlot;
  const nativeSkill=row=>({id:String(row.id),name:row.stage.skills.map(skill=>plain(skill.name)).join('、')||row.name,
    description:row.stage.skills.map(skill=>plain(skill.description)).join('\n'),
    owned:row.owned&&row.stage.skills.length>0,slot:slots.indexOf(String(row.id)),
    image:nativeSkillArt(row.stage.skills[0]),icon:'skill-tab',category:'all'});
  const bank={skills:rows.filter(row=>row.stage.skills.length>0).map(nativeSkill),slots};
  const view={...s,pilots:kind==='pilot'?items:s.pilots,aircraft:kind==='aircraft'?items:s.aircraft,weapons:kind==='weapon'?items:s.weapons,
    aircraftId:kind==='aircraft'?String(rows.find(row=>nativeCollectionAccess(group,s,row).using)?.id??collection.skinId):s.aircraftId,pilotId:kind==='pilot'?String(rows.find(row=>nativeCollectionAccess(group,s,row).using)?.id||''):s.pilotId,
    loadout:kind==='weapon'?Object.fromEntries([0,1].map(slot=>{const row=collectionRows.find(row=>row.id===collection.useWeaponMap[slot]);return ['W'+(slot+1),row?String(nativeWeaponGroupId(row)):''];})):s.loadout,
    fleet:{revision:collection.revision,[kind]:bank},catalogPresentation:{skillFor:item=>nativeSkill(byId.get(item.id)),native:true,...(kind==='pilot'?{filters:nativePilotFilters}:{})}};
  const helpers={...h,weaponSkillArtwork:item=>weaponSkillArtwork(byId.get(String(item.id)),e),pilotPortrait:(item,cls)=>{const skin=nativePilotAppearance(item.id);return skin?characterPortrait({...skin,name:item.name},cls):'';},thumbnail:(id,cls='')=>{const row=byId.get(String(id));return row?`<img class="pl-model-thumb ${e(cls)}" src="${e(icon(row))}" alt="${e(row.name)}">`:h.thumbnail(id,cls);},preview:(id,options)=>{const plane=byId.get(String(id))?.baseAppearanceId||NATIVE_AIRCRAFT_SKINS[id];return plane?h.preview?.(plane,options):null;}};
  const t=template(kind==='weapon'?weaponCatalogPage({...ctx,snapshot:view,selectedId:String(selected.id),helpers}):fleetCatalogPage({...ctx,selectedSkillSlot,snapshot:view,selectedId:String(selected.id),helpers}));
  for(const node of t.content.querySelectorAll('.wc-item[data-id]')){
    const row=byId.get(node.dataset.id);if(!row)continue;
    node.dataset.psdQuality=String(collectionQualityRank(row.quality));
    node.removeAttribute('data-rarity');
    const access=nativeCollectionAccess(group,s,row);
    node.setAttribute('aria-label',`${row.name}，${row.qualityName}，${row.star}星${row.baseOnly||access.basicOnly?'，可用':row.owned?'':'，未激活'}${access.using?'，使用中':''}${node.getAttribute('aria-pressed')==='true'&&!access.using?'，预览中':''}`);
    const stars=node.querySelector('.wc-stars');
    if(stars){
      stars.setAttribute('aria-label',`${row.star}星`);
      stars.innerHTML=Array.from({length:Math.max(1,...row.stages.map(s=>s.star))},
        (_,i)=>projectIcon('star',i<row.star?'':'is-icon-muted')).join('');
    }
  }
  for(const node of t.content.querySelectorAll('.wc-skill[data-id]')){
    const row=byId.get(node.dataset.id),art=node.querySelector('.wc-skill-art');
    if(!row||!art)continue;
    art.dataset.psdQuality=String(collectionQualityRank(row.quality));
    node.setAttribute('aria-label',`浏览${row.name}技能，武器品质${row.qualityName}`);
  }
  // No invented cloud combat attributes or one-copy star costs.
  t.content.querySelector('.fc-header-stats')?.remove();
  if(!selected.stage.skills.length)t.content.querySelector('.fc-unlock-skill')?.remove();
  const empty=t.content.querySelector('.fc-skill-list .fc-empty');
  if(empty&&kind==='pilot')empty.textContent='暂无技能';
  if(empty&&kind==='aircraft')empty.textContent=rows.some(row=>row.owned)
    ?'暂无可携带技能，可在战机详情查看。'
    :'激活战机后可携带技能。';
  const operation=(node,row,op)=>{
    const access=op==='select'?nativeCollectionAccess(group,s,row):null;
    node.dataset.action='nativeOperation';node.dataset.operation=op;node.dataset.kind=group;
    node.dataset.id=String(access?(row.catalogSelectionId??access.selectionId):row.id);node.dataset.revision=String(collection.revision);
    node.disabled=access?!access.available||access.using:op==='slot'?!['skins','pilots'].includes(group)||!row.owned||!row.stage.skills.length:!row.canPurchase;
    if(access)node.textContent=access.using?'使用中':group==='guns'?'装备出战':'使用';
  };
  if(['aircraft','pilot'].includes(kind)){
    const label=t.content.querySelector('.fc-unlock-skill>span:last-child');
    if(label)label.textContent=plain(selected.stage.skills[0]?.name)||'技能';
  }
  for(const node of t.content.querySelectorAll('[data-action]')){
    const action=node.dataset.action,row=byId.get(node.dataset.id)||selected;
    if(row.baseOnly&&['fleetUnlock','fleetStar'].includes(action)){node.remove();continue;}
    if(['fleetUnlock','fleetStar'].includes(action)){
      nativeDetailAction(node,group,row,s,row.owned?'star':'unlock');
      const shortage=!row.maxed&&row.costs.some(cost=>Number(cost.available)<Number(cost.count));if(shortage)node.dataset.shortage='true';
      const costs=row.costs.map(cost=>{
        const art=nativeItemArt(cost.id);
        return `<span class="fc-operation-cost" aria-label="${e(cost.name)} ${cost.available}/${cost.count}">${art?`<span class="fc-operation-cost-art${NATIVE_AIRCRAFT_SKINS[cost.id]?' is-aircraft':''}"><img src="${e(art)}" alt="" draggable="false"></span>`:e(cost.name)}<b class="${cost.available<cost.count?'is-short':''}">${cost.available}/${cost.count}</b></span>`;
      }).join('');
      node.innerHTML=`<strong>${row.maxed?'已满星':row.owned?'升星':'激活'}</strong><small>${costs}</small>`;
    }else if(['selectAircraft','selectPilot','catalogEquipWeapon'].includes(action))operation(node,row,'select');
    else if(action==='fleetSkillPreview'){
      node.dataset.action='nativeSkillPreview';node.dataset.kind=group;node.dataset.id=String(row.id);
      node.title=row.stage.skills.map(skill=>plain(skill.name)+': '+plain(skill.description)).join('\n');
    }else if(action==='catalogGrowth'||action==='catalogSkill'){
      node.dataset.action='nativeWeaponPreview';node.dataset.id=String(row.id);
      node.dataset.mode=action==='catalogGrowth'?'growth':'base';
    }else if(['weapon','weaponInfo','aircraftInfo','pilotInfo','catalogAcquire'].includes(action)){
      node.dataset.action='nativeCollectionDetail';node.dataset.kind=group;node.dataset.id=String(row.catalogSelectionId??row.id);
    }else if(action==='fleetSkillSlot'){
      node.dataset.action='nativeSlotPick';node.dataset.kind=group;
    }else if(['fleetSkillEquip','fleetSkillRemove'].includes(action)){
      operation(node,row,'slot');
      // Removal targets the skill's existing slot, not the newly selected slot.
      const slot=action==='fleetSkillRemove'?Number(node.dataset.slot):selectedSkillSlot;
      node.dataset.slot=String(slot);
      const validSlot=Number.isInteger(slot)&&slot>=0&&slot<slots.length;
      if(action==='fleetSkillRemove'){node.dataset.id='0';node.disabled=!validSlot||slots[slot]!==String(row.id);}
      else node.disabled=node.disabled||!validSlot;
    }
  }
  if(kind==='weapon')t.content.querySelector('.wc-hero-tools')?.insertAdjacentHTML('beforeend',
    button('nativeCollectionDetail','外观',`data-kind="guns" data-id="${selected.catalogSelectionId??selected.id}" aria-label="选择${e(selected.name)}外观"`));
  return t.innerHTML;
}

export function cloudNativeSkillPreview(group,id,s,h){
  const row=s.replicaCollection[group]?.find(row=>row.id===Number(id));
  if(row&&group==='guns')return collectionDetail(group,row,s,h,{preview:true});
  if(!row)return {title:'技能',content:'<p>记录不存在</p>'};
  if(!row.stages.some(stage=>stage.skills.length||stage.attributes.length))
    return {title:row.name,content:'<p>暂无星级效果。</p>'};
  const panel=fleetSkillPreview({kind:group==='skins'?'aircraft':'pilot',
    item:{id:String(row.id),stars:row.star,owned:row.owned},helpers:h,
    levels:row.stages.map(stage=>stage.star),
    skillFor:(_kind,item)=>{
      const stage=row.stages.find(stage=>stage.star===(item.stars||row.defaultStar));
      return {name:stage.skills.map(skill=>plain(skill.name)).join('、')||'星级效果',ownerName:row.name,
        description:stage.skills.map(skill=>plain(skill.description)).join('\n')||'该星级无技能效果。',
        image:nativeSkillArt(stage.skills[0]),icon:'skill-tab'};
    }});
  const t=template(panel.content);
  for(const [index,node] of [...t.content.querySelectorAll('.fc-star-skill-list>section')].entries()){
    const stage=row.stages[index];
    if(!stage.skills.length&&stage.attributes.length)node.querySelector('p')?.remove();
    if(stage.attributes.length)node.insertAdjacentHTML('beforeend',
      `<div class="fc-detail-stats" aria-label="${stage.star}星收藏属性">${nativeAttributeRows(stage,s,h)}</div>`);
  }
  return {...panel,content:t.innerHTML};
}

function collectionDetailArtwork(row,h){
  if(!row.stages||!row.stages.some(stage=>stage.skills.some(skill=>weaponPreview.families[skill.id]))){
    return `<img src="${h.escape(nativeCollectionArt(row,'default'))}" alt="">`;
  }
  return catalogWeaponArtwork(row,{...h,thumbnail:()=>`<img class="pl-model-thumb" src="${h.escape(nativeCollectionArt(row))}" alt="">`});
}

export function cloudNativeWeaponPreview(id,mode,s,h){
  const row=s.replicaCollection.guns.find(row=>row.id===Number(id)),e=h.escape;
  if(!row)return {title:'武器',content:'<p>记录不存在</p>'};
  const base=s.replicaCollection.guns.find(item=>item.id===nativeWeaponGroupId(row))||row;
  const family=base.stage.skills.map(skill=>weaponPreview.families[skill.id]).find(Boolean);
  if(mode==='base'){
    const description=family?.description||row.stage.skills[0]?.description||row.description;
    return {title:'基础攻击',content:`<article class="wc-skill-detail"><div class="wc-skill-detail-head"><div class="wc-skill-detail-art">${weaponSkillArtwork(row,e)}</div><div><h3>${e(row.name)}</h3></div></div><p class="wc-skill-description">${e(plain(description))}</p></article>`};
  }
  const stages=family?.stages.filter(stage=>stage.star>1)||[];
  const rows=stages.map(stage=>`<details class="wc-growth-section"><summary>${stage.star} 星 · ${stage.kind==='breakthrough'?'突破':stage.kind==='minor'?'强化':'升级'}</summary>${stage.options.length?stage.options.map(skill=>`<div class="wc-growth-rule"><h5>${e(plain(skill.name))}</h5><p>${e(plain(skill.description))}</p></div>`).join(''):`<div class="wc-growth-rule"><p>${e(plain(stage.description))}</p></div>`}</details>`).join('');
  return {title:'局内成长',content:`<article class="wc-skill-detail wc-growth-detail"><h3>${e(row.name)}</h3>${rows||'<p>当前模式没有该武器的局内成长配置。</p>'}<p class="wc-skill-timing">候选效果受本局技能与抽取规则限制，选取后仅本局生效。</p></article>`};
}

function collectionView(row,h) {
  return {...row,id:String(row.id),stars:row.star,temporaryUnlocked:false,copies:0,
    avatar:nativeCollectionArt(row),image:nativeCollectionArt(row,'default'),
    aircraftName:row.name,level:undefined,maxLevel:undefined,
    skillName:row.stage.skills.map(skill=>plain(skill.name)).join('、'),
    description:row.stage.skills.map(skill=>plain(skill.description)).join('\n')};
}
function nativeDetailAction(node,group,row,s,operation,preview=false) {
  const directGrowth=['skins','pilots'].includes(group)&&['unlock','star'].includes(operation);
  node.dataset.action=preview&&!directGrowth?'nativeCollectionOperation':'nativeOperation';
  Object.assign(node.dataset,{kind:group,id:String(row.id),revision:String(s.replicaCollection.revision),operation});
  const access=operation==='select'?nativeCollectionAccess(group,s,row):null;
  if(access)node.dataset.id=String(access.selectionId);
  node.disabled=directGrowth?Boolean(row.maxed||s.rewardPending||s.rewardBusy):preview?row.maxed:access?!access.available||access.using:!row.canPurchase;
  if(access)node.textContent=access.using?'使用中':group==='guns'?'装备出战':'使用';
}
function nativeAttributeRows(stage,s,h) {
  return (stage?.attributes||[]).map(value=>{
    const [key,amount]=value.split('=');
    const display=`${Number(amount)>=0?'+':''}${amount}${key.endsWith('%')?'%':''}`;
    return `<div><span>${h.escape(s.replicaCollection.attributeNames[key]||key)}</span><b>${h.escape(display)}</b></div>`;
  }).join('');
}
export function cloudNativeCollectionDetail(group,id,s,h){
  const row=nativeCollectionRows(group,s).find(row=>row.id===Number(id)),e=h.escape;
  if(!row)return {title:'详情',content:'<p>记录不存在</p>'};
  if(group==='guns')return collectionDetail(group,row,s,h);
  const retained=group==='pilots'?template(collectionDetail(group,row,s,h).content):null;
  const item=collectionView(row,h),kind=group==='skins'?'aircraft':'pilot';
  const helpers={...h,thumbnail:()=>h.img(nativeCollectionArt(row,'default'),row.name,'pl-model-thumb')};
  const t=template(kind==='aircraft'
    ?fleetAircraftDetail({aircraft:item,snapshot:s,helpers})
    :fleetPilotDetail({pilot:item,snapshot:s,helpers,skillFor:()=>({name:item.skillName,description:item.description,image:nativeSkillArt(row.stage.skills[0]),icon:"skill-tab"})}));
  if(kind==='aircraft'){
    t.content.querySelector('.fc-detail>p').textContent=`${row.star} / 5 星`;
    t.content.querySelector('.fc-detail-stats').innerHTML=nativeAttributeRows(row.stage,s,h);
    t.content.querySelector('.fc-detail>h3').textContent=item.skillName||'技能';
    t.content.querySelector('.fc-detail>h3+p').textContent=item.description;
    t.content.querySelector('.fc-detail-cost')?.remove();
  }else{
    t.content.querySelector('.fc-detail>p').textContent=retained?.content.querySelector('.cd-stars')?.getAttribute('aria-label')||`${row.star} / 5 星`;
    const rule=t.content.querySelector('.fc-skill-rule');
    if(rule){
      const art=nativeSkillArt(row.stage.skills[0]);
      rule.querySelector('.fc-skill-rule-art').innerHTML=art?h.img(art,'','fc-skill-icon'):projectIcon('skill-tab','fc-skill-icon');
      rule.querySelector('h3').textContent=item.skillName||(row.owned?'当前技能':'技能预览');
      rule.querySelector('p').textContent=item.description||'当前星级无技能';
    }
  }
  const action=t.content.querySelector('.fc-detail-button');
  const shortage=!row.maxed&&row.costs.some(cost=>Number(cost.available)<Number(cost.count));
  action.textContent=row.maxed?'已满星':row.owned?'升星':'激活';
  if(shortage&&!retained)action.dataset.shortage='true';
  nativeDetailAction(action,group,row,s,row.owned?'star':'unlock',true);
  if(row.baseOnly)action.remove();
  if(retained){
    // Keep the historical detail template intact, then retain the newer data and actions below it.
    const detail=t.content.querySelector('.fc-detail'),source=retained.content;
    detail.dataset.historicalPilot='true';
    const state=document.createElement('p');
    state.textContent=[...source.querySelectorAll('.cd-badges span')].map(node=>node.textContent).filter(Boolean).join(' · ');
    const previewState=source.querySelector('.cd-hero>p')?.textContent;
    if(previewState&&!row.owned)state.textContent+=` · ${previewState.replace(/^未激活\s*·\s*/, '')}`;
    if(state.textContent)detail.append(state);
    const attributes=source.querySelector('.cd-attributes');
    if(attributes){
      const heading=document.createElement('h3');heading.textContent=attributes.querySelector('h3').textContent;detail.append(heading);
      const stats=document.createElement('div');stats.className='fc-detail-stats';
      for(const entry of attributes.querySelectorAll('dl>div')){
        const line=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');
        label.textContent=entry.querySelector('dt').textContent;value.textContent=entry.querySelector('dd').textContent;
        line.append(label,value);stats.append(line);
      }
      detail.append(stats);
    }
    const costs=source.querySelector('.cd-costs');
    if(costs)for(const entry of costs.children){
      const line=document.createElement('div'),label=document.createElement('span'),value=document.createElement('b');
      line.className='fc-card-cost';line.setAttribute('aria-label',costs.getAttribute('aria-label'));
      label.textContent=entry.querySelector('span').textContent;value.textContent=entry.querySelector('b').textContent;
      if(entry.classList.contains('is-short'))value.classList.add('is-short');
      line.append(label,value);detail.append(line);
    }
    for(const node of [source.querySelector('.cd-preview-link button'),source.querySelector('.cd-actions [data-operation="select"]')]){
      if(node){if(node.dataset.operation==='select')nativeDetailAction(node,group,row,s,'select');node.classList.add('fc-detail-button');detail.append(node);}
    }
  }
  if(group==='skins'){
    if(!row.baseOnly&&!row.closed)t.content.querySelector('.fc-detail').insertAdjacentHTML('beforeend','<p class="ag-hint">获取：高级装备箱。重复获得同名卡用于升星。</p>');
    const access=nativeCollectionAccess(group,s,row);
    if(access.isBase){
      t.content.querySelector('.fc-detail').insertAdjacentHTML('beforeend',
        button('nativeOperation',access.using?'使用中':'使用',
          `data-kind="skins" data-id="${access.selectionId}" data-revision="${s.replicaCollection.revision}" data-operation="select"`,access.using).replace('class="wc-button"','class="wc-button fc-detail-button"'));
    }
  }
  return {title:row.name,content:t.innerHTML};
}

export function cloudNativeCollectionOperation(modal,s,h){
  const group=modal.kind,row=s.replicaCollection[group]?.find(row=>row.id===Number(modal.id));
  if(!row)return {title:'内容已更新',content:'请返回列表重新选择。'};
  const item=collectionView(row,h),kind=group==='skins'?'aircraft':'pilot',e=h.escape;
  const result=modal.result,operation=modal.operation==='unlock'?'activate':'starUp';
  const target=result?row.stage:row.stages.find(stage=>stage.star===(row.owned?row.star+1:row.defaultStar));
  const panel=fleetOperationModal({kind,item,snapshot:s,operation,result,error:modal.error,helpers:{...h,thumbnail:()=>h.img(nativeCollectionArt(row,'default'),row.name,'pl-model-thumb')}});
  const t=template(panel.content),stage=target||row.stage;
  t.content.querySelector('header p').textContent=`${result?result.previousStars:row.star} → ${stage.star} 星`;
  t.content.querySelector('.fc-operation-effect h4').textContent=stage.skills.map(skill=>plain(skill.name)).join('、');
  t.content.querySelector('.fc-operation-effect p').textContent=stage.skills.map(skill=>plain(skill.description)).join('\n');
  if(!stage.skills.length)t.content.querySelector('.fc-operation-effect').remove();
  const stats=t.content.querySelector('.fc-operation-stats');
  if(stats)stats.innerHTML=(stage.attributes||[]).map(value=>{
    const [key,amount]=value.split('='),before=row.stage.attributes.find(value=>value.startsWith(key+'='))?.split('=')[1];
    return `<p><span>${e(s.replicaCollection.attributeNames[key]||key)}</span><b>${before===undefined?'':e(before)+' → '}${e(amount)}</b></p>`;
  }).join('');
  const cost=t.content.querySelector('.fc-card-cost');
  if(cost)cost.outerHTML=row.costs.map(value=>`<div class="fc-card-cost"><span>${e(value.name)}</span><b class="${value.available<value.count?'is-short':''}">${value.available} / ${value.count}</b></div>`).join('');
  const actions=t.content.querySelector('.fc-operation-actions');
  if(!result){
    actions.innerHTML=h.button('nativeOperation',row.maxed?'已满星':row.owned?'升星':'激活','wc-button fc-detail-button','',!row.canPurchase);
    nativeDetailAction(actions.querySelector('button'),group,row,s,modal.operation);
  }
  return {...panel,content:t.innerHTML};
}


export function cloudNativeRecruitSnapshot(s){
  if(!s.nativeAcquisition)return s;
  // Direct recruitment and retained legacy boxes have independent histories and guarantees.
  const candidates=new Set((s.pilotSupply?.candidates||[]).map(row=>row.id));
  return {...s,pools:{pilot:s.pilotSupply?.pool||{unavailable:true}},recruitHistory:s.pilotSupply?.history||[],
    pilots:s.replicaCollection.pilots.filter(row=>NATIVE_PILOT_SKINS[row.id]).map(row=>{
      const skin=s.pilots.find(p=>p.id===NATIVE_PILOT_SKINS[row.id]);
      const name=row.stage.skills.map(skill=>plain(skill.name)).join('、');
      const description=row.stage.skills.map(skill=>plain(skill.description)).join('\n');
      const access=nativeCollectionAccess('pilots',s,row),quality=nativePilotDisplayQuality({nativeId:row.id});
      const starterAvailable=row.id===40100&&access.isBase;
      return {...skin,...quality,nativeId:row.id,recruitable:!s.pilotSupply||candidates.has(row.id),
        owned:row.owned||starterAvailable,activated:row.owned||starterAvailable,temporaryUnlocked:false,
        stars:row.star,copies:0,skillName:name,description,passive:{name,description}};
    })};
}
export function cloudNativeRecruit(ctx){
  const view=cloudNativeRecruitSnapshot(ctx.snapshot);
  const t=template(recruitPage({...ctx,snapshot:view}));
  for(const node of t.content.querySelectorAll('[data-action="pilotInfo"]')){
    const pilot=view.pilots.find(p=>p.id===node.dataset.id);
    if(pilot){node.dataset.action='nativeCollectionDetail';node.dataset.kind='pilots';node.dataset.id=String(pilot.nativeId);}
  }
  return t.innerHTML;
}
