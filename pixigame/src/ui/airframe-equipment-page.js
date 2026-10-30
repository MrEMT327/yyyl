import {compactPilotAvatar} from '../pilot-avatar-icons.js';
import {emptySlotMark} from './psd-empty-slot.js';
import {weaponIconUrl} from './weapon-icon-source.js';
import {supplyWeaponArt} from './supply-visuals.js';
import {nativeCollectionArt} from '../replica/native-collection-art.js';
import {GEAR_PARTS,GEAR_QUALITY_NAMES,gearName} from '../peripheral/equipment-system.js';
import {gearDetailSkills,gearDetailIncrease} from './gear-detail-model.js';
import {equipmentArtPath} from '../replica/equipment-art.js';
import {nativeItemArt} from '../replica/native-item-presentation.js';
import './airframe-equipment-page.css';
const base=import.meta.env?.BASE_URL??'/';
// Configuration changes invalidate native combat details until recalculation finishes.
const combatStat=(value,format)=>Number.isFinite(value)?format(value):'—';
export const gearArt=id=>base+equipmentArtPath(id);
const btn=(action,label,data='',disabled=false)=>`<button type="button" class="wc-button ag-button" data-action="${action}" ${data} ${disabled?'disabled':''}>${label}</button>`;
export const gearCard=(item,h,{action='gearDetail',selected=false,mount=false,disabled=false}={})=>{
  const e=h.escape;
  const mergeReady=!mount&&action==='gearDetail'&&!item.locked&&item.merge?.available;
  return `<button type="button" class="ag-card ${mount?'ag-mount':''} ${selected?'is-selected':''}" data-quality="${item.qualityRank}" data-psd-quality="${item.qualityRank}" data-action="${action}" data-id="${e(item.uid)}" ${action==='gearDetail'?`data-gear-origin="${mount?'slot':'warehouse'}"`: ''} ${disabled?'disabled':''} ${action==='gearMaterial'?`aria-pressed="${selected}"`:''} aria-label="${e(item.name)}，${e(item.qualityName)}，等级${item.level}${item.equipped?'，已装配':''}${item.locked?'，已锁定':''}${mergeReady?'，可合成':''}"><strong>${e(mount?item.part:item.name)}</strong><img src="${gearArt(item.art)}" alt="" draggable="false"><b>Lv.${item.level}</b>${item.quality%10?`<small class="ag-tier" aria-label="品质加${item.quality%10}">+${item.quality%10}</small>`:''}${item.equipped&&!mount?'<i class="ag-tag">已装</i>':''}${item.locked?'<i class="ag-lock" aria-label="已锁定">锁</i>':mergeReady?'<i class="ag-ready">可合</i>':''}${selected?'<span class="ag-selected">✓</span>':''}</button>`;
};
const card=gearCard;
export function airframeEquipmentPage({snapshot:s,helpers:h},{sort='quality',filter='all'}={}){
  const {escape:e,number:n}=h,gear=s.equipment,a=s.aircraft.find(item=>item.id===s.aircraftId)||s.aircraft[0];
  const pilot=s.pilots?.find(item=>item.id===s.pilotId)||s.pilots?.[0];
  const pilotAvatar=compactPilotAvatar(pilot?.avatar||pilot?.image);
  const mainSlot=s.loadout?.W1;
  const innateId=(typeof mainSlot==='object'?mainSlot?.itemId||mainSlot?.id:mainSlot)||s.innateWeapon||a?.weaponId;
  const innate=s.weapons.find(w=>w.id===innateId);
  const nativeGun=s.replicaCollection?.guns.find(row=>row.equipped);
  const weaponButton=s.replicaCollection
    ? `<button type="button" class="ag-weapon ag-card ${nativeGun?'is-filled':'is-empty'}" data-action="equipmentWeapons" aria-label="主武器，${e(nativeGun?.name||'选择武器')}"><strong>主武器</strong><span>${nativeGun?`<img src="${e(nativeCollectionArt(nativeGun))}" alt="${e(nativeGun.name)}" draggable="false">`:emptySlotMark()}</span><b>${nativeGun?`${nativeGun.star} 星`:''}</b></button>`
    : null;
  const list=gear.items.filter(item=>filter==='all'||String(item.type)===filter).sort((x,y)=>(sort==='level'?y.level-x.level:sort==='part'?x.type-y.type:y.quality-x.quality)||Number(y.equipped)-Number(x.equipped)||x.type-y.type||x.uid.localeCompare(y.uid));
  const slot=type=>{
    const item=gear.items.find(item=>item.uid===gear.slots[type]),part=gear.blueprints.find(part=>part.type===type);
    return `<div class="ag-position ag-position-${type}">${item?card(item,h,{mount:true}):`<button type="button" class="ag-card ag-mount is-empty" data-action="gearChoosePart" data-part="${type}" aria-label="${e(part.name)}，空槽"><strong>${e(part.name)}</strong>${emptySlotMark()}<b>未装配</b></button>`}</div>`;
  };
  return `<section class="ag-page eq-page" aria-label="驾驶员装备"><div class="ag-hangar eq-hangar">
    <div class="ag-pilot-card" data-pilot-id="${e(pilot?.id||'')}"><button type="button" class="ag-pilot-select" data-action="catalog" data-kind="pilot" aria-label="查看驾驶员：${e(pilot?.name||'未选择驾驶员')}"><span class="ag-pilot-avatar">${h.img(pilotAvatar.src,'','ag-pilot-avatar-art',pilotAvatar.srcset?`srcset="${e(pilotAvatar.srcset)}" sizes="min(165px, 22vw, 10.17dvh)" width="320" height="320"`:'')}</span><span class="ag-pilot-info"><small>驾驶员</small><strong>${e(pilot?.name||'未选择驾驶员')}</strong></span></button><button type="button" class="ag-pilot-stats" data-action="gearAttributes" aria-label="查看战斗属性，攻击${combatStat(s.combatStats?.attack,n)}，耐久${combatStat(s.combatStats?.maxHp,n)}"><span><small>攻击</small><b>${combatStat(s.combatStats?.attack,n)}</b></span><span><small>耐久</small><b>${combatStat(s.combatStats?.maxHp,n)}</b></span></button></div>
    <div class="eq-aircraft-stage pl-live-model" aria-label="${e(a?.name||'当前战机')}">${h.preview?.(a?.id,{name:a?.name,view:'equipment'})||h.thumbnail(a?.id,'eq-aircraft-fallback')}</div>
    ${weaponButton ?? `<button type="button" class="ag-weapon ag-card ${innate?'is-filled':'is-empty'}" ${innate?`data-psd-quality="${innate.qualityRank||0}" data-action="weapon" data-id="${e(innate.id)}"`:'data-action="equipmentWeapons"'} aria-label="主武器，${e(innate?.name||'选择武器')}${innate?'，本机专武':''}"><strong>主武器</strong><span>${innate?supplyWeaponArt(innate,h.thumbnail):emptySlotMark()}</span>${innate?`<b>Lv.${n(innate.level||1)}</b>`:''}</button>`}
    ${[1,2,3,4,5].map(slot).join('')}
    <div class="ag-catalog" role="group" aria-label="装备功能">${btn('equipmentWeapons',`${h.icon('weapon')}<span>武器</span>`)}${btn('catalog',`${h.icon('plane')}<span>战机</span>`,'data-kind="aircraft"')}${btn('catalog',`${h.icon('pilot')}<span>驾驶员</span>`,'data-kind="pilot"')}</div>
  </div><div class="ag-toolbar"><label class="ag-select"><span class="ag-sr">装备排序</span><select data-gear-select="sort" aria-label="装备排序">${[['quality','按品质排序'],['part','按部位排序'],['level','按等级排序']].map(([id,name])=>`<option value="${id}" ${id===sort?'selected':''}>${name}</option>`).join('')}</select></label>${filter==='all'?'<strong class="ag-toolbar-title">装备</strong>':btn('gearClearFilter','全部装备')}${btn('openWorkshop','改装间')}</div>
    <div class="ag-inventory eq-inventory"><h2 class="ag-sr">驾驶员装备</h2><div class="ag-grid">${list.map(item=>card(item,h)).join('')}</div>${!list.length?'<p class="ag-empty">暂无该部位装备</p>':''}${Object.values(gear.fodder).some(n=>n>0)?`<div class="ag-inventory-extra"><h2>合成材料</h2><div class="ag-materials">${Object.entries(gear.fodder).filter(([,count])=>count>0).map(([key,count])=>{const [type,q]=key.split(':').map(Number),part=gear.blueprints.find(p=>p.type===type);return `<button type="button" class="ag-material" data-action="gearMaterialInfo" data-part="${type}" data-quality="${q}"><img src="${gearArt(part.id)}" alt=""><span>${e(part.name)}</span><span>${e(GEAR_QUALITY_NAMES[q])}材料</span><b>×${n(count)}</b></button>`;}).join('')}</div></div>`:''}</div></section>`;
}
function attributesTable(item,h,next=false){return `<div class="ag-attr-table"><p><span>${h.escape(item.attributeName)}</span><b>${h.number(item.attribute)}${next&&item.nextAttribute!=null?` → <em>${h.number(item.nextAttribute)}</em>`:''}</b></p><p><span>可强化至</span><b>${item.maxLevel}</b></p></div>`;}
function costRow(item,gear,s,h){
  if(!item.cost)return '';
  const part=gear.blueprints.find(part=>part.type===item.type),have=part?.count||0;
  const blueprint=GEAR_PARTS.find(part=>part.type===item.type)?.blueprintId;
  const wallet=gear.wallet||s.wallet,coins=wallet.unlimited?'∞':h.number(wallet.coins);
  return `<div class="ag-slot-cost" role="group" aria-label="升级消耗"><span class="${have<item.cost.blueprints?'is-short':''}" aria-label="强化图纸 ${have}/${item.cost.blueprints}"><img src="${nativeItemArt(blueprint)}" alt="强化图纸"><b>${h.number(have)}</b><span>/${h.number(item.cost.blueprints)}</span></span><span class="${!wallet.unlimited&&wallet.coins<item.cost.coins?'is-short':''}" aria-label="金币 ${coins}/${item.cost.coins}"><img src="${nativeItemArt(1)}" alt="金币"><b>${coins}</b><span>/${h.number(item.cost.coins)}</span></span></div>`;
}
export function gearModal(modal,{snapshot:s,helpers:h}){
  const gear=s.equipment,{escape:e,number:n}=h,item=gear?.items.find(item=>item.uid===modal.id),error=modal.error?`<p class="ag-error" role="alert">${e(modal.error)}</p>`:'';
  if(modal.type==='gearAttributes'){
    const total=gear.totals;
    return {title:'战斗属性',content:`<div class="ag-modal"><div class="ag-attr-table"><p><span>总攻击</span><b>${Number.isFinite(s.combatStats?.attack)?combatStat(s.combatStats?.attack,n):'—'}</b></p><p><span>总耐久</span><b>${Number.isFinite(s.combatStats?.maxHp)?combatStat(s.combatStats?.maxHp,n):'—'}</b></p><p><span>装备攻击</span><b>+${n(total.attack)}</b></p><p><span>装备耐久</span><b>+${n(total.hp)}</b></p></div><h3>当前装备</h3>${gear.items.filter(item=>item.equipped).map(item=>`<p class="ag-breakdown"><span>${e(item.name)} · Lv.${item.level}</span><b>${e(item.attributeName)} +${n(item.attribute)}</b></p>`).join('')}<p class="ag-hint">${s.replicaCollection?'总属性按当前出战配置计算。':'总属性包含机体成长、装备、已携带技能和科技加成。'}</p></div>`};
  }
  if(modal.type==='gearMaterialInfo'){
    const part=gear.blueprints.find(p=>p.type===modal.part),q=modal.quality;
    return {title:'合成材料',content:`<div class="ag-modal"><h3>${e(part?.name)} · ${e(GEAR_QUALITY_NAMES[q])}材料</h3><p>拥有 ×${n(gear.fodder[`${modal.part}:${q}`]||0)}</p><p>用于同部位的${e(GEAR_QUALITY_NAMES[q])}装备升阶，不能替代指定系列装备。</p><p class="ag-hint">来源：装备品质降阶。</p></div>`};
  }
  if(modal.type==='gearSources'&&gear.native){
    return {title:'装备获取',content:`<div class="supply-ui su-gear-sources">
      <section class="su-card"><h3>商城装备箱</h3><div class="su-actions">${btn('equipmentShop','前往商城','data-section="boxes"')}</div></section>
      <section class="su-card"><h3>巡逻与章节</h3><p class="su-subtitle">装备和箱券：巡逻、快速巡逻、章节奖励。</p><div class="su-actions">${btn('patrol','巡逻收益')}${btn('chapterRewards','章节奖励')}</div></section>
      <section class="su-card"><h3>每周史诗装备自选</h3><p class="su-subtitle">通关第8章，每周满活跃5天可领自选箱 ×1（不含圣环）。</p><div class="su-actions">${btn('growthSupplyOpen','查看每周补给','data-period="week"')}</div></section>
      <div class="su-footer-actions">${btn('nativeEquipmentBoxes','装备箱说明')}${btn('nativeMaterials','打开背包')}</div></div>`};
  }
  if(modal.type==='gearSources')return {title:'装备补给',content:`<div class="ag-modal"><h3>战役掉落</h3><p>完成战斗获得随机部位图纸，胜利额外获得一件普通装备。</p><h3>基础装备补给</h3><p>普通 70% · 优秀 30%</p><p>基础补给券 ×${n(gear.keys?.basic||0)}</p><p class="ag-hint">五个部位、四个系列均等概率。不包含武器。</p>${error}${modal.drawn?.length?`<div class="ag-grid ag-draw-results">${modal.drawn.map(id=>gear.items.find(item=>item.uid===id)).filter(Boolean).map(item=>card(item,h)).join('')}</div>`:''}<div class="ag-actions">${btn('gearSupply',`补给一次<br>${gear.keys?.basic>=1?'补给券 ×1':'钻石 ×60'}`,'data-count="1"',!s.wallet.unlimited&&s.wallet.diamonds<60&&(gear.keys?.basic||0)<1)}${btn('gearSupply',`补给十次<br>${gear.keys?.basic>=10?'补给券 ×10':'钻石 ×600'}`,'data-count="10"',!s.wallet.unlimited&&s.wallet.diamonds<600&&(gear.keys?.basic||0)<10)}</div>${btn('equipmentShop','前往商城宝箱','data-section="boxes"')}</div>`};
  if(modal.type==='gearMergeList')return {title:'装备合成',content:`<div class="ag-modal"><p>普通、优秀、精良：三件同系列同部位装备合成一件。</p><p class="ag-hint">一键合成保留已装配的装备；锁定装备不会被选作材料。</p><div class="ag-grid">${gear.items.filter(item=>item.merge.required).map(item=>card(item,h,{action:'gearMerge'})).join('')}</div>${error}${modal.steps?`<p role="status">合成完成，共 ${n(modal.steps)} 次。</p>`:''}${btn('gearBatchPreview','一键合成')}</div>`};
  if(modal.type==='gearBatch'){
    const plan=modal.plan;
    return {title:'一键合成',content:`<div class="ag-modal"><p>将进行 ${n(plan?.steps?.length||0)} 次合成</p><p>范围：普通 → 优秀 → 精良 → 史诗</p><p class="ag-hint">已装配装备仅作为保留目标；锁定装备和高阶装备不参与。</p>${error}<div class="ag-actions">${btn('gearBack','返回')}${btn('gearConfirmBatch','确认合成','',!plan?.ok)}</div></div>`};
  }
  if(!item)return {title:'驾驶员装备',content:'<p class="ag-hint">装备已变化，请关闭后重新选择。</p>'};
  const summary=`<div class="ag-detail-head">${card(item,h)}<div><h3>${e(item.name)}</h3><p>部位强化 Lv.${item.level}</p><p>当前品质可强化至 Lv.${item.maxLevel}</p><p>${item.equipped?'已装配':'未装配'}${item.locked?' · 已锁定':''}</p></div></div>`;
  if(modal.type==='gearDetail'){
    const increase=gearDetailIncrease(item),data=`data-id="${e(item.uid)}"`;
    const skills=gearDetailSkills(item);
    const slotDetail=modal.detailOrigin==='slot'&&item.equipped;
    return {title:'装备详情',content:`<div class="ag-modal ag-equipment-detail" data-quality="${item.qualityRank}" data-detail-origin="${slotDetail?'slot':'warehouse'}">
      <div class="ag-equipment-hero"><div class="ag-equipment-art ag-card" data-quality="${item.qualityRank}" data-psd-quality="${item.qualityRank}"><img src="${gearArt(item.art)}" alt="${e(item.name)}"></div><div class="ag-equipment-heading"><h3>${e(item.name)}</h3><span class="ag-quality">${e(item.qualityName)}</span><p>${e(item.part)}${item.equipped?' · 已装配':''}${item.locked?' · 已锁定':''}</p>${slotDetail&&item.canDowngrade?btn('gearDowngradePreview','降阶',data):''}</div><p class="ag-equipment-level">强化等级 <b>Lv.${item.level} / ${item.maxLevel}</b></p></div>
      <div class="ag-equipment-stat"><strong>${e(item.attributeName)} +${n(item.attribute)}</strong>${increase!=null?`<em aria-label="下一级增加${n(increase)}">(+${n(increase)})</em>`:''}</div>
      <section class="ag-equipment-skills" aria-label="装备技能"><h3>装备技能</h3><ul>${skills.map(feature=>`<li data-quality="${feature.quality}" class="${feature.unlocked?'is-unlocked':'is-locked'}"><span class="ag-skill-mark ${feature.unlocked?'':'is-lock'}" aria-hidden="true"></span><span><span class="ag-sr">${e(feature.qualityName)}${feature.unlocked?'已解锁':'解锁'}：</span>${e(feature.text)}</span></li>`).join('')}</ul></section>
      ${error}${modal.result?`<p class="ag-success" role="status">${e(modal.result)}</p>`:''}
      <footer class="ag-equipment-footer">${slotDetail?`${costRow(item,gear,s,h)}<div class="ag-actions ag-slot-actions" role="group" aria-label="已装配装备操作">${btn('gearUnequip','卸下',data)}${btn('gearUpgrade','升级',data,!item.canUpgrade)}${btn('gearUpgradeAll','一键升级',data,!item.canUpgrade)}</div>`:`<div class="ag-actions ag-equipment-primary">${btn(item.equipped?'gearReplace':'gearEquip','替换',data)}</div>`}</footer>
    </div>`};
  }
  if(modal.type==='gearDowngrade'){
    const refund=modal.plan;
    return {title:'品质降阶',content:`<div class="ag-modal">${summary}<p>降阶后：${e(GEAR_QUALITY_NAMES[refund?.quality]||'')} · 部位 Lv.${refund?.level??item.level}</p><p class="ag-hint">部位强化等级保留；属性按降阶后的品质及部位等级重新计算。</p><h3>返还物品</h3>${(refund?.returnedGear||[]).map(i=>`<p>${e(gearName(i))} · ${e(GEAR_QUALITY_NAMES[i.quality])} ×1</p>`).join('')}${(refund?.returnedFodder||[]).map(i=>`<p>${e(item.part)} · ${e(GEAR_QUALITY_NAMES[i.quality])}合成材料 ×${i.amount}</p>`).join('')}${refund?.returnedFodder?.length?'<p class="ag-hint">通用材料可用于同部位、对应品质的合成，不能还原成投入时的具体系列装备。</p>':''}${error}<div class="ag-actions">${btn('gearBack','返回')}${btn('gearDowngrade','确认降阶',`data-id="${e(item.uid)}"`,!refund?.ok)}</div></div>`};
  }
  const option=item.merge,selected=modal.materialIds||[],tokens=modal.tokens||0;
  const eligible=option.candidates.map(id=>gear.items.find(item=>item.uid===id)).filter(Boolean);const protectedSelected=option.any&&selected.some(id=>option.protectedIds?.includes(id));
  return {title:'装备合成',content:`<div class="ag-modal">${summary}<p class="ag-merge-arrow">${e(item.qualityName)} → ${e(option.nextQualityName||'最高品质')}</p><p>需要 ${option.required} 件${option.any?'同部位':'同系列同部位'}${e(option.quality?({10:'普通',20:'优秀',30:'精良',40:'史诗',42:'史诗+2',50:'传说'}[option.quality]||''):'')}材料</p><p class="ag-hint">强化等级跟随部位，合成不消耗强化等级。已装配、锁定装备不可作为材料。${option.any?'通用升阶使用同部位普通装备或对应通用材料，不能消耗圣环装备。自动选择保留后续升阶需要的同名件，同名件仍可手动选择。':''}</p>${protectedSelected?'<p class="ag-error">将消耗同名保留件，降阶仅返通用材料。</p>':''}<div class="ag-grid">${eligible.map(item=>card(item,h,{action:'gearMaterial',selected:selected.includes(item.uid)})).join('')}</div>${option.tokens?btn('gearToggleTokens',`合成材料 ${tokens}/${option.tokens}`,`aria-pressed="${tokens>0}"`):''}${!eligible.length&&!option.tokens?'<p class="ag-hint">暂无符合条件的材料</p>':''}${error}<p class="ag-merge-count">已选 ${selected.length+tokens} / ${option.required}</p><div class="ag-actions">${btn('gearAutoFill','安全自动选择','',option.autoAvailable===false)}${btn('gearConfirmMerge','确认合成','',selected.length+tokens!==option.required)}</div></div>`};
}
