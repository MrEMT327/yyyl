import {button,fmt} from './menu-art.js';
import {detailSheet} from './detail-sheet.js';
import {workshopFilterChoices} from './workshop-weapon.js';
import {gearTile} from './workshop-gear.js';
import {gearName,GEAR_QUALITY_NAMES} from '../../peripheral/equipment-system.js';

export const workshopTitles={workshopFilter:'筛选装备部位',workshopBatch:'一键升星',gearMergeList:'装备合成',gearMerge:'装备合成',gearBatch:'一键合成',gearDowngrade:'品质降阶',gearSources:'装备获取'};
const action=(cmd,label,data={},disabled=false)=>({id:cmd,label,cmd,data,disabled});
function buttonRow(r,list,cols=list.length){
  r.grid(list,cols,(a,b,hit,visible)=>{if(visible)button(a,r.t,b,{title:hit.label,titleSize:14,disabled:hit.disabled,titleColor:hit.disabled?'#bac8d2':'#edf6ff',gold:hit.gold});
    return hit;});r.gap(8);
}
function itemGrid(r,items,cmd,selected=[]){
  r.grid(items,4,(a,b,it,shown)=>{if(shown)gearTile(a,r.t,b,it,{selected:selected.includes(it.uid)});return {id:'gear-'+it.uid,label:it.name,cmd,data:{id:it.uid}};},{height:side=>side});r.gap(8);
}
export function workshopPanel(data,w,h,t){
  const {snapshot:s,modal:m}=data,g=s.equipment,type=m.type,err=r=>{if(m.error)r.text(m.error,{color:'#ad3e38'});};
  const header=(r,text)=>r.text(text,{size:16,weight:700,pad:4});
  let title=workshopTitles[type];if(type==='workshopFilter'&&m.mode!=='gear')title='筛选武器';
  if(type==='gearSources'&&!g.native)title='装备补给';
  const width=w*(type==='workshopFilter'?.78:type==='workshopBatch'?.88:.92);
  detailSheet(t,data,w,h,{title,width,secondary:type==='workshopFilter'||type==='workshopBatch',build:r=>{
    if(type==='workshopFilter'){
      const choices=workshopFilterChoices(m.mode,g);
      r.grid(choices,2,(a,b,[filter,label])=>{
        button(a,t,b,{title:label,titleSize:14,titleColor:filter===m.filter?'#b8f7ff':'#edf6ff'});
        if(filter===m.filter)a.panel(b.x+3,b.y+3,b.w-6,b.h-6,{stroke:'#1f6378',strokeWidth:2,fill:null,cut:0});
        return {id:'filter-'+filter,label,cmd:'workshopFilterSelect',data:{filter}};});return;
    }
    if(type==='workshopBatch'){
      const p=m.plan;r.text('全仓库 '+p.steps.length+' 件武器各升 1 星');r.text('专属碎片 '+fmt(p.totalSpecific)+' · 通用零件 '+fmt(p.totalUniversal));r.gap(8);
      for(const step of p.steps)r.text(step.name+'：'+step.fromQuality+' 星 → '+step.toQuality+' 星',{size:13});
      r.gap(10);r.action('confirm','确认升星','workshopConfirmBatch',{}, {gold:true});return;
    }
    if(type==='gearBatch'){
      r.text('可合成 '+fmt(m.plan?.steps?.length||0)+' 次',{size:16,align:'center',weight:700,pad:12});err(r);
      buttonRow(r,[action('gearBack','取消'),action('gearConfirmBatch','合成',{},!m.plan?.ok)]);return;
    }
    if(type==='gearSources'&&g.native){
      r.block(v=>{header(v,'商城装备箱');buttonRow(v,[action('equipmentShop','前往商城',{section:'boxes'})]);});
      r.gap(8);r.block(v=>{header(v,'巡逻与章节');v.text('装备和箱券：巡逻、快速巡逻、章节奖励。');buttonRow(v,[action('patrol','巡逻收益'),action('chapterRewards','章节奖励')]);});
      r.gap(8);r.block(v=>{header(v,'每周史诗装备自选');v.text('通关第8章，每周满活跃5天可领自选箱 ×1（不含圣环）。');buttonRow(v,[action('growthSupplyOpen','查看每周补给',{period:'week'})]);});
      r.gap(8);buttonRow(r,[action('nativeEquipmentBoxes','装备箱说明'),action('nativeMaterials','打开背包')]);return;
    }
    if(type==='gearSources'){
      header(r,'战役掉落');r.text('完成战斗获得随机部位图纸，胜利额外获得一件普通装备。');header(r,'基础装备补给');
      r.text('普通 70% · 优秀 30%');const keys=g.keys?.basic||0;r.text('基础补给券 ×'+fmt(keys));r.text('五个部位、四个系列均等概率。不包含武器。',{size:13});
      err(r);if(m.drawn)itemGrid(r,m.drawn.map(id=>g.items.find(i=>i.uid===id)).filter(Boolean),'gearDetail');
      buttonRow(r,[1,10].map(n=>({...action('gearSupply','补给'+(n===1?'一次':'十次')+' '+(keys>=n?'补给券 ×'+n:'钻石 ×'+n*60),{count:n},!s.wallet.unlimited&&keys<n&&s.wallet.diamonds<n*60),id:'supply-'+n})));
      buttonRow(r,[action('equipmentShop','前往商城宝箱',{section:'boxes'})]);return;
    }
    if(type==='gearMergeList'){
      r.text('普通、优秀、精良：三件同系列同部位装备合成一件。');r.text('一键合成保留已装配的装备；锁定装备不会被选作材料。',{size:13});r.gap(8);
      itemGrid(r,g.items.filter(i=>i.merge.required),'gearMerge');err(r);if(m.steps)r.text('合成完成，共 '+fmt(m.steps)+' 次。');
      buttonRow(r,[action('gearBatchPreview','一键合成')]);return;
    }
    const item=g.items.find(i=>i.uid===m.id);if(!item){r.text('装备已变化，请关闭后重新选择。');return;}
    r.grid([item],1,(a,b,it,shown)=>{
      if(shown){gearTile(a,t,{x:b.x,y:b.y,w:b.h,h:b.h},it);const x=b.x+b.h+8,width=b.w-b.h-8;
        [it.name,'部位强化 Lv.'+it.level,'当前品质可强化至 Lv.'+it.maxLevel,(it.equipped?'已装配':'未装配')+(it.locked?' · 已锁定':'')].forEach((label,i)=>a.text(label,x,b.y+10+i*20,{size:i?13:15,weight:i?400:700,align:'left',maxWidth:width,color:'#233f53'}));}
      return {id:'gear-summary',label:it.name,cmd:'gearDetail',data:{id:it.uid}};},{height:82});r.gap(8);
    if(type==='gearDowngrade'){
      const p=m.plan;r.text('降阶后：'+(GEAR_QUALITY_NAMES[p?.quality]||'')+' · 部位 Lv.'+(p?.level??item.level));r.text('部位强化等级保留；属性按降阶后的品质及部位等级重新计算。',{size:13});
      header(r,'返还物品');for(const v of p?.returnedGear||[])r.text(gearName(v)+' · '+GEAR_QUALITY_NAMES[v.quality]+' ×1');
      for(const v of p?.returnedFodder||[])r.text(item.part+' · '+GEAR_QUALITY_NAMES[v.quality]+'合成材料 ×'+v.amount);
      if(p?.returnedFodder?.length)r.text('通用材料可用于同部位、对应品质的合成，不能还原成投入时的具体系列装备。',{size:13});
      err(r);buttonRow(r,[action('gearBack','返回'),action('gearDowngrade','确认降阶',{id:item.uid},!p?.ok)]);return;
    }
    const o=item.merge,ids=m.materialIds||[],tokens=m.tokens||0;
    header(r,item.qualityName+' → '+(o.nextQualityName||'最高品质'));r.text('需要 '+o.required+' 件'+(o.any?'同部位':'同系列同部位')+(GEAR_QUALITY_NAMES[o.quality]||'')+'材料');
    r.text('强化等级跟随部位，合成不消耗强化等级。已装配、锁定装备不可作为材料。'+(o.any?'通用升阶使用同部位普通装备或对应通用材料，不能消耗圣环装备。自动选择保留后续升阶需要的同名件，同名件仍可手动选择。':''),{size:13});
    if(o.any&&ids.some(id=>o.protectedIds?.includes(id)))r.text('将消耗同名保留件，降阶仅返通用材料。',{color:'#a83332'});
    const list=o.candidates.map(id=>g.items.find(i=>i.uid===id)).filter(Boolean);itemGrid(r,list,'gearMaterial',ids);
    if(o.tokens)buttonRow(r,[action('gearToggleTokens','合成材料 '+tokens+'/'+o.tokens)]);if(!list.length&&!o.tokens)r.text('暂无符合条件的材料');
    err(r);r.text('已选 '+(ids.length+tokens)+' / '+o.required);
    buttonRow(r,[action('gearAutoFill','安全自动选择',{},o.autoAvailable===false),action('gearConfirmMerge','确认合成',{},ids.length+tokens!==o.required)]);
  }});
}

