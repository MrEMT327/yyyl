import {nativeWeaponGroupId,nativeWeaponGroupRows} from './native-weapon-groups.js';
import { NATIVE_AIRCRAFT_SKINS } from './native-aircraft-skins.js';
import { nativeCollectionArt, nativeSkillArt } from './native-collection-art.js';
import { NATIVE_PILOT_SKINS } from './native-pilot-roster.js';
import { nativePilotAppearance } from './native-pilot-presentation.js';
import { characterPortrait } from '../ui/character-portraits.js';
import { supplyWeaponArt } from '../ui/supply-visuals.js';
import { collectionDetail } from '../ui/collection-detail.js';
import { fleetCatalogPage, fleetSkillPreview, fleetAircraftDetail, fleetPilotDetail, fleetOperationModal } from '../ui/fleet-catalog-page.js';
import { weaponCatalogPage, catalogWeaponArtwork } from '../ui/weapon-catalog-page.js';
import { recruitPage } from '../ui/recruit-page.js';
import weaponPreview from './native-weapon-preview-index.json' with {type:'json'};
import { projectIcon } from '../ui/project-ui-art.js';
import { collectionQualityRank } from './native-quality.js';
const groupFor={weapon:'guns',aircraft:'skins',pilot:'pilots'};
// Native pilot IDs do not belong to the retired cloud combat categories.
// Filter the actual collection state without assigning invented skill types.
const nativePilotFilters=Object.freeze([{id:'all',label:'全部'},{id:'owned',label:'已激活'},{id:'locked',label:'未激活'}]);
const plain=value=>String(value||'').replace(/<[^>]*>/g,'');
const icon=nativeCollectionArt;
const button=(action,label,attrs='',disabled=false)=>`<button type="button" class="wc-button" data-action="${action}" ${attrs}${disabled?' disabled':''}>${label}</button>`;
const template=html=>{const t=document.createElement('template');t.innerHTML=html;return t;};

// Use the cloud's page functions verbatim. This adapter supplies native rows,
// costs and IDs, then routes controls to the existing native transactions.
export function cloudNativeCatalog(ctx){
  const {kind,snapshot:s,helpers:h}=ctx,group=groupFor[kind],collection=s.replicaCollection;
  if(!collection||!group)return '';
  if(ctx.appearanceOnly&&kind!=='weapon'){
    const t=template(fleetCatalogPage({...ctx,skillTab:false}));
    for(const node of t.content.querySelectorAll('.fc-header-stats,.fc-unlock-skill,.fc-worn-skills,[data-action="fleetStar"],[data-action="fleetUnlock"]'))node.remove();
    for(const node of t.content.querySelectorAll('[data-action="catalogMode"],[data-action="catalogBack"],[data-action="aircraftInfo"],[data-action="pilotInfo"]')){node.dataset.action='nativeAppearance';node.dataset.mode='progression';}
    return t.innerHTML;
  }
  const allRows=collection[group],rows=kind==='weapon'?nativeWeaponGroupRows(allRows):allRows;
  const byId=new Map(rows.map(row=>[String(row.id),row]));
  const requested=allRows.find(row=>String(row.id)===String(ctx.selectedId));
  const selected=(kind==='weapon'&&requested?rows.find(row=>nativeWeaponGroupId(row)===nativeWeaponGroupId(requested)):byId.get(String(ctx.selectedId)))||rows.find(row=>row.equipped)||rows[0];
  if(!selected)return '';
  const e=h.escape;
  const items=rows.map(row=>({...row,id:String(row.id),stars:row.star,qualityRank:collectionQualityRank(row.quality),
    avatar:icon(row),image:nativeCollectionArt(row,'default'),rarity:'R',copies:0,attack:undefined,hp:undefined,temporaryUnlocked:false}));
  const slots=kind==='aircraft'?collection.slots.map(id=>id?String(id):null):[String(rows.find(row=>row.equipped)?.id||'')].filter(Boolean);
  const nativeSkill=row=>({id:String(row.id),name:row.stage.skills.map(skill=>plain(skill.name)).join('、')||row.name,
    description:row.stage.skills.map(skill=>plain(skill.description)).join('\n'),
    owned:row.owned&&row.stage.skills.length>0,slot:slots.indexOf(String(row.id)),
    image:nativeSkillArt(row.stage.skills[0]),icon:'skill-tab',category:'all'});
  const bank={skills:rows.map(nativeSkill),slots};
  const view={...s,pilots:kind==='pilot'?items:s.pilots,aircraft:kind==='aircraft'?items:s.aircraft,weapons:kind==='weapon'?items:s.weapons,
    aircraftId:kind==='aircraft'?String(collection.skinId):s.aircraftId,pilotId:kind==='pilot'?String(rows.find(row=>row.equipped)?.id||''):s.pilotId,
    loadout:kind==='weapon'?{W1:String(rows.find(row=>row.equipped)?.id||'')}:s.loadout,
    fleet:{revision:collection.revision,[kind]:bank},catalogPresentation:{skillFor:item=>nativeSkill(byId.get(item.id)),native:true,...(kind==='pilot'?{filters:nativePilotFilters}:{})}};
  const helpers={...h,weaponSkillArtwork:item=>{
    const row=byId.get(String(item.id));
    const skill=row?.stage.skills.find(skill=>weaponPreview.families[skill.id])||row?.stage.skills[0];
    const url=nativeSkillArt(skill)||nativeSkillArt(row);
    return url?`<img class="weapon-skill-icon native-weapon-skill-icon" src="${e(url)}" alt="${e(row.name)}" draggable="false">`:'';
  },pilotPortrait:(item,cls)=>{const skin=nativePilotAppearance(item.id);return skin?characterPortrait({...skin,name:item.name},cls):'';},thumbnail:(id,cls='')=>{const row=byId.get(String(id));return row?`<img class="pl-model-thumb ${e(cls)}" src="${e(icon(row))}" alt="${e(row.name)}">`:h.thumbnail(id,cls);},preview:(id,options)=>NATIVE_AIRCRAFT_SKINS[id]?h.preview?.(NATIVE_AIRCRAFT_SKINS[id],options):null};
  const t=template(kind==='weapon'?weaponCatalogPage({...ctx,snapshot:view,selectedId:String(selected.id),helpers}):fleetCatalogPage({...ctx,snapshot:view,selectedId:String(selected.id),helpers}));
  for(const node of t.content.querySelectorAll('.wc-item[data-id]')){
    const row=byId.get(node.dataset.id);if(!row)continue;
    node.dataset.psdQuality=String(collectionQualityRank(row.quality));
    node.removeAttribute('data-rarity');
    node.setAttribute('aria-label',`${row.name}，${row.qualityName}，${row.star}星${row.owned?'':'，未激活'}${row.equipped?'，使用中':''}`);
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
  if(empty&&kind==='aircraft')empty.textContent=rows.some(row=>row.owned)
    ?'暂无可携带技能，可在战机详情查看。'
    :'请先激活带技能的战机。选择外观不会解锁技能。';
  const operation=(node,row,op)=>{node.dataset.action='nativeOperation';node.dataset.operation=op;node.dataset.kind=group;node.dataset.id=String(row.id);node.dataset.revision=String(collection.revision);node.disabled=op==='select'?!row.owned||row.equipped:op==='slot'?group!=='skins'||!row.owned||!row.stage.skills.length:!row.canPurchase;};
  for(const node of t.content.querySelectorAll('[data-action]')){
    const action=node.dataset.action,row=byId.get(node.dataset.id)||selected;
    if(['fleetUnlock','fleetStar'].includes(action)){
      nativeDetailAction(node,group,row,s,row.owned?'star':'unlock',true);const shortage=!row.maxed&&row.costs.some(cost=>Number(cost.available)<Number(cost.count));if(shortage)node.dataset.shortage='true';node.innerHTML=`<strong>${row.maxed?'已满星':shortage?(row.owned?'查看升星':'查看激活'):row.owned?'升星':'激活'}</strong><small>${row.costs.map(cost=>`${e(cost.name)} ${cost.available}/${cost.count}`).join('、')}</small>`;
    }else if(['selectAircraft','selectPilot','catalogEquipWeapon'].includes(action))operation(node,row,'select');
    else if(action==='fleetSkillPreview'){
      node.dataset.action='nativeSkillPreview';node.dataset.kind=group;node.dataset.id=String(row.id);
      node.title=row.stage.skills.map(skill=>plain(skill.name)+': '+plain(skill.description)).join('\n');
    }else if(action==='catalogGrowth'||action==='catalogSkill'){
      node.dataset.action='nativeWeaponPreview';node.dataset.id=String(row.id);
      node.dataset.mode=action==='catalogGrowth'?'growth':'base';
    }else if(['weapon','weaponInfo','aircraftInfo','pilotInfo','catalogAcquire'].includes(action)){
      node.dataset.action='nativeCollectionDetail';node.dataset.kind=group;node.dataset.id=String(row.id);
    }else if(action==='fleetSkillSlot'){
      node.dataset.action=group==='skins'?'nativeSlotPick':'nativeCollectionDetail';node.dataset.kind=group;if(group==='pilots')node.dataset.id=String(selected.id);
    }else if(['fleetSkillEquip','fleetSkillRemove'].includes(action)){
      operation(node,row,'slot');
      // Removal targets the skill's existing slot, not the newly selected slot.
      const slot=action==='fleetSkillRemove'?Number(node.dataset.slot):ctx.selectedSkillSlot;
      node.dataset.slot=String(slot);
      const validSlot=Number.isInteger(slot)&&slot>=0&&slot<collection.slots.length;
      if(action==='fleetSkillRemove'){node.dataset.id='0';node.disabled=!validSlot||collection.slots[slot]!==row.id;}
      else node.disabled=node.disabled||!validSlot;
    }
  }
  return t.innerHTML;
}

export function cloudNativeSkillPreview(group,id,s,h){
  const row=s.replicaCollection[group]?.find(row=>row.id===Number(id));
  if(row&&['guns','pilots'].includes(group))return collectionDetail(group,row,s,h,{preview:true});
  if(!row?.stage.skills.length)return {title:'技能',content:'<p>当前星级没有可携带技能。</p>'};
  return fleetSkillPreview({kind:group==='skins'?'aircraft':'pilot',
    item:{id:String(row.id),stars:row.star,owned:row.owned},helpers:h,
    levels:row.stages.map(stage=>stage.star),
    skillFor:(_kind,item)=>{
      const stage=row.stages.find(stage=>stage.star===(item.stars||row.defaultStar));
      return {name:stage.skills.map(skill=>plain(skill.name)).join('、'),ownerName:row.name,
        description:stage.skills.map(skill=>plain(skill.description)).join('\n'),
        image:nativeSkillArt(stage.skills[0]),icon:'skill-tab'};
    }});
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
    return {title:'基础攻击',content:`<article class="wc-skill-detail"><div class="wc-skill-detail-head"><div class="wc-skill-detail-art">${collectionDetailArtwork(row,h)}</div><div><h3>${e(row.name)}</h3></div></div><p class="wc-skill-description">${e(plain(description))}</p></article>`};
  }
  const stages=family?.stages.filter(stage=>stage.star>1)||[];
  const rows=stages.map(stage=>`<details class="wc-growth-section"><summary>${stage.star} 星 · ${stage.kind==='breakthrough'?'突破':stage.kind==='minor'?'强化':'升级'}</summary>${stage.options.length?stage.options.map(skill=>`<div class="wc-growth-rule"><h5>${e(skill.name)}</h5><p>${e(skill.description)}</p></div>`).join(''):`<div class="wc-growth-rule"><p>${e(stage.description)}</p></div>`}</details>`).join('');
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
  node.dataset.action=preview?'nativeCollectionOperation':'nativeOperation';
  Object.assign(node.dataset,{kind:group,id:String(row.id),revision:String(s.replicaCollection.revision),operation});
  node.disabled=preview?row.maxed:operation==='select'?!row.owned||row.equipped:!row.canPurchase;
}
function nativeAttributeRows(stage,s,h) {
  return (stage?.attributes||[]).map(value=>{
    const [key,amount]=value.split('=');
    return `<div><span>${h.escape(s.replicaCollection.attributeNames[key]||key)}</span><b>${h.escape(amount)}</b></div>`;
  }).join('');
}
export function cloudNativeCollectionDetail(group,id,s,h){
  const row=s.replicaCollection[group]?.find(row=>row.id===Number(id)),e=h.escape;
  if(!row)return {title:'详情',content:'<p>记录不存在</p>'};
  if(['guns','pilots'].includes(group))return collectionDetail(group,row,s,h);
  const item=collectionView(row,h),kind=group==='skins'?'aircraft':'pilot';
  const supply=group==='skins'?`<div class="cs-source"><p>每周满活跃5天：自选飞机卡。</p><button type="button" class="wc-button" data-action="collectionSupplyOpen" data-kind="${group}" data-id="${row.id}">获取同名卡</button></div>`:'';
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
    t.content.querySelector('.fc-detail>p').textContent=`${row.star} / 5 星`;
    const rule=t.content.querySelector('.fc-skill-rule');
    if(rule){
      rule.querySelector('.fc-skill-rule-art').innerHTML=h.img(nativeSkillArt(row.stage.skills[0]),'','fc-skill-icon');
      rule.querySelector('h3').textContent=item.skillName;
      rule.querySelector('p').textContent=item.description;
    }
  }
  const action=t.content.querySelector('.fc-detail-button');
  const shortage=!row.maxed&&row.costs.some(cost=>Number(cost.available)<Number(cost.count));
  action.textContent=row.maxed?'已满星':shortage?(row.owned?'查看升星':'查看激活'):row.owned?'升星':'激活';
  if(shortage)action.dataset.shortage='true';
  nativeDetailAction(action,group,row,s,row.owned?'star':'unlock',true);
  if(supply)t.content.querySelector('.fc-detail').insertAdjacentHTML('beforeend',supply);
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
    actions.innerHTML=h.button('nativeOperation',row.maxed?'已满星':row.canPurchase?(row.owned?'升星':'激活'):'材料不足','wc-button fc-detail-button','',!row.canPurchase);
    nativeDetailAction(actions.querySelector('button'),group,row,s,modal.operation);
  }
  return {...panel,content:t.innerHTML};
}


export function cloudNativeRecruitSnapshot(s){
  if(!s.nativeAcquisition)return s;
  // The mixed supply and pilot boxes have separate rewards and guarantees.
  return {...s,pools:{pilot:s.pilotSupply?.pool||{unavailable:true}},recruitHistory:s.pilotSupply?.history||[],
    pilots:s.replicaCollection.pilots.filter(row=>!s.pilotSupply||s.pilotSupply.candidates.some(p=>p.id===row.id)).map(row=>{
      const skin=s.pilots.find(p=>p.id===NATIVE_PILOT_SKINS[row.id]);
      const name=row.stage.skills.map(skill=>plain(skill.name)).join('、');
      const description=row.stage.skills.map(skill=>plain(skill.description)).join('\n');
      return {...skin,nativeId:row.id,owned:row.owned,activated:row.owned,temporaryUnlocked:false,
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
