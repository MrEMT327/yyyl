import reference from './equipment-reference-data.json' with {type:'json'};
import shopReference from './shop-reference-data.json' with {type:'json'};
import { nativeBoxProgress } from '../replica/native-box-progress.js';
import {normalizeEquipmentPartLevel,NATIVE_EQUIPMENT_LEVEL_MAX} from '../replica/native-equipment-level.js';
import {equipmentArtKey,equipmentBlueprintArtPath} from '../replica/equipment-art.js';

// 1.1.6 numerical tables; original aircraft parts replace the reference art.
export const GEAR_PARTS=[
 {type:1,id:'cockpit',name:'座舱装甲',attribute:'HPMax',attributeName:'耐久',blueprintId:105},
 {type:2,id:'fire-control',name:'火控模组',attribute:'Attack',attributeName:'攻击',blueprintId:106},
 {type:3,id:'fuselage',name:'机身装甲',attribute:'HPMax',attributeName:'耐久',blueprintId:107},
 {type:4,id:'amplifier',name:'增幅核心',attribute:'Attack',attributeName:'攻击',blueprintId:109},
 {type:5,id:'engine-armor',name:'引擎装甲',attribute:'HPMax',attributeName:'耐久',blueprintId:108},
];
export const GEAR_QUALITY_NAMES={10:'普通',20:'优秀',30:'精良',40:'史诗',41:'史诗+1',42:'史诗+2',50:'传说',51:'传说+1',52:'传说+2',53:'传说+3',60:'神话'};
export const GEAR_INVENTORY_CAPACITY=10000;
const series=['航卫','猎隼','雷霆','星盾'];
const rows=new Map(reference.equip.map(row=>[row.ID,row]));
const stages=new Map(reference.quality.map(row=>[row.Rank*1000+row.Quality,row]));
const levels=new Map(reference.level.map(row=>[`${row.Type}:${row.Level}`,row]));
const int=(value,min=0,max=1e9)=>Math.max(min,Math.min(max,Math.floor(Number(value)||0)));
const clone=value=>structuredClone(value),fail=message=>({ok:false,message});
export const gearConfig=item=>rows.get(Number(item?.family)+Number(item?.quality));
export const gearStage=item=>{const row=gearConfig(item);return row&&stages.get(row.rank*1000+row.quality);};
const equipped=(state,uid)=>Object.values(state.slots).includes(uid);
const partFor=item=>GEAR_PARTS[(gearConfig(item)?.equipType||1)-1];
// APK GetDisplayLevel @0x7cb0334 reads the part level without a quality clamp.
// GetEquipBaseAttr @0x6d16860 also uses that full level; IsLvMax @0x768dbfc
// applies the quality cap only when deciding whether reinforcement is allowed.
export const gearEffectiveLevel=(_item,slotLevel)=>normalizeEquipmentPartLevel(slotLevel);
const atPartLevel=(item,state)=>{const slotLevel=state.levels[partFor(item).type]||1;return {...item,slotLevel,level:gearEffectiveLevel(item,slotLevel)};};
const attrs=list=>Object.fromEntries((list||[]).map(value=>{const [key,amount]=value.split('=');return[key,Number(amount)||0];}));
const appendAttrs=(to,from)=>{for(const [key,value]of Object.entries(from))to[key]=(to[key]||0)+value;return to;};
export function gearUpgradeCost(item){
 const row=gearConfig(item),stage=gearStage(item);
 if(!row||!stage||item.level>=stage.LevelCap)return null;
 const cost={coins:0,blueprints:0,type:row.equipType};
 for(const[id,amount]of levels.get(`${row.equipType}:${item.level}`)?.Cost||[]){if(id===1)cost.coins+=amount;else if(id===partFor(item).blueprintId)cost.blueprints+=amount;}
 return cost;
}
// Used only to settle saves from the short-lived individual-item draft.
export function gearInvestment(item){
 const result={coins:0,blueprints:0,type:partFor(item).type};
 for(let level=1;level<(item.level||1);level++){
  for(const[id,amount]of levels.get(`${result.type}:${level}`)?.Cost||[]){if(id===1)result.coins+=amount;else if(id===partFor(item).blueprintId)result.blueprints+=amount;}
 }
 return result;
}
export function gearAttributes(item){
 const row=gearConfig(item);if(!row)return{};
 const base=attrs(row.baseAttribute),growth=attrs(row.AttributeOnLevelUp),quality={};
 for(const candidate of reference.equip){
  if(candidate.ID-candidate.quality!==item.family||candidate.quality>item.quality||!candidate.FeatureJson)continue;
  const feature=JSON.parse(candidate.FeatureJson);if(feature.Type==='Attr')appendAttrs(quality,attrs([feature.Args]));
 }
 const value={...base};for(const[key,perLevel]of Object.entries(growth))value[key]=(value[key]||0)+perLevel*((item.level||1)-1);
 appendAttrs(value,quality);return {base,growth,quality,value};
}
export function createGearState(){
 const items=GEAR_PARTS.map(({type})=>({uid:`gear-${type}`,family:4000000+type*100000+100,quality:10,locked:false}));
 return {version:2,revision:0,serial:5,items,slots:Object.fromEntries(GEAR_PARTS.map(({type},i)=>[type,items[i].uid])),levels:Object.fromEntries(GEAR_PARTS.map(({type})=>[type,1])),blueprints:Object.fromEntries(GEAR_PARTS.map(({type})=>[type,0])),fodder:Object.fromEntries(GEAR_PARTS.flatMap(({type})=>[[`${type}:40`,0],[`${type}:50`,0]])),draws:0,keys:{basic:0,advanced:0},basicRewardClaims:0,nativeBoxProgress:nativeBoxProgress()};
}
export function sanitizeGearState(value){
 if(!value||![1,2].includes(value.version))return createGearState();
 const next={version:2,revision:int(value.revision),serial:int(value.serial),items:[],slots:{},levels:{},blueprints:{},fodder:{},draws:int(value.draws),keys:{basic:int(value.keys?.basic),advanced:int(value.keys?.advanced)},basicRewardClaims:int(value.basicRewardClaims)};
 next.nativeBoxProgress=nativeBoxProgress(value.nativeBoxProgress);
 if(value.localBoxState!==undefined)next.localBoxState=structuredClone(value.localBoxState);
 const seen=new Set(),oldInvestments={};let refundCoins=0;
 for(const item of(Array.isArray(value.items)?value.items:[]).slice(0,GEAR_INVENTORY_CAPACITY)){
  const uid=String(item.uid||''),row=gearConfig(item),stage=gearStage(item);
  if(!uid||seen.has(uid)||!row||!stage)continue;seen.add(uid);
  next.items.push({uid,family:Number(item.family),quality:row.quality,locked:!!item.locked});next.serial=Math.max(next.serial,int(uid.replace(/^gear-/,'')));
  if(value.version===1){const level=int(item.level,1,stage.LevelCap),investment=gearInvestment({...item,level});next.levels[row.equipType]=Math.max(next.levels[row.equipType]||1,level);const sum=oldInvestments[row.equipType]||={coins:0,blueprints:0};sum.coins+=investment.coins;sum.blueprints+=investment.blueprints;}
 }
 for(const{type}of GEAR_PARTS){
  const uid=value.slots?.[type];next.slots[type]=next.items.some(item=>item.uid===uid&&gearConfig(item).equipType===type)?uid:null;
  next.levels[type]=value.version===1?(next.levels[type]||1):int(value.levels?.[type],1,NATIVE_EQUIPMENT_LEVEL_MAX);
  next.blueprints[type]=int(value.blueprints?.[type]);
  if(oldInvestments[type]){
   const sample=next.items.find(item=>gearConfig(item).equipType===type),keep=gearInvestment({...sample,level:next.levels[type]});
   refundCoins+=Math.max(0,oldInvestments[type].coins-keep.coins);next.blueprints[type]+=Math.max(0,oldInvestments[type].blueprints-keep.blueprints);
  }
  for(const q of[40,50])next.fodder[`${type}:${q}`]=int(value.fodder?.[`${type}:${q}`]);
 }
 if(refundCoins||value.migrationRefund)next.migrationRefund={coins:refundCoins+int(value.migrationRefund?.coins)};
 return next;
}
export function gearTotals(state){
 const total={Attack:0,HPMax:0},sources=[];
 for(const{type}of GEAR_PARTS){
  const item=state.items.find(item=>item.uid===state.slots[type]);if(!item)continue;
  const effective=atPartLevel(item,state),attributes=gearAttributes(effective);appendAttrs(total,attributes.value);
  sources.push({uid:item.uid,name:gearName(item),partType:type,level:effective.level,...attributes,qualityCode:item.quality});
 }
 return {attack:total.Attack||0,hp:total.HPMax||0,attackBonus:(total['Attack%']||0)/100,hpBonus:(total['HPMax%']||0)/100,pickupHealBonus:((total['HPPickUpAdd%']||0)+(total['HeartHpAdd%']||0))/100,damageReduction:Math.min(.8,(total['HurtDecrease%']||0)/100),sources};
}
export function gearName(item){const row=gearConfig(item);return `${row?.rank?'圣环':series[(row?.seq||1)-1]}${partFor(item).name}`;}
export function gearView(item,state,wallet={}){
 const row=gearConfig(item),part=partFor(item),stage=gearStage(item),display=atPartLevel(item,state),worn=state.items.find(i=>i.uid===state.slots[row.equipType]);
 const cost=worn?.uid===item.uid?gearUpgradeCost(display):null,attributes=gearAttributes(display);
 const featureNames={Attack:'攻击',HPMax:'耐久','Attack%':'攻击','HPMax%':'耐久','HPPickUpAdd%':'修复道具效果','HeartHpAdd%':'修复道具效果','HurtDecrease%':'受到伤害降低'};
 return {...clone(display),type:row.equipType,rank:row.rank,part:part.name,art:equipmentArtKey(row),name:gearName(item),qualityName:GEAR_QUALITY_NAMES[item.quality],qualityRank:Math.floor(item.quality/10)-1,equipped:equipped(state,item.uid),maxLevel:stage.LevelCap,upgradeCap:worn?gearStage(worn).LevelCap:0,cost,attributes,attributeName:part.attributeName,attribute:attributes.value[part.attribute]||0,nextAttribute:cost?gearAttributes({...display,level:display.level+1}).value[part.attribute]:null,canUpgrade:!!cost&&(wallet.unlimited||wallet.coins>=cost.coins)&&(state.blueprints[row.equipType]||0)>=cost.blueprints,canDowngrade:!!stage.ResetQuality,features:Object.entries(attributes.quality).map(([key,value])=>({key,value,text:`${featureNames[key]||key} +${value}${key.endsWith('%')?'%':''}`}))};
}
export function gearMergeOptions(state,uid){
 const target=state.items.find(item=>item.uid===uid),row=gearConfig(target),stage=gearStage(target);
 if(!target||!row||!stage?.NextQuality)return {required:0,candidates:[],defaultIds:[],defaultTokens:0,available:false,autoAvailable:false,protectedIds:[]};
 const[quality,required,rank]=stage.Cost[0]||[];
 const candidates=state.items.filter(item=>item.uid!==uid&&!item.locked&&!equipped(state,item.uid)&&gearConfig(item).equipType===row.equipType&&item.quality===quality&&(stage.Cost_Any||item.family===target.family)&&gearConfig(item).rank===rank).sort((a,b)=>a.uid.localeCompare(b.uid));
 const tokenKey=`${row.equipType}:${quality}`,tokens=stage.Cost_Any?state.fodder[tokenKey]||0:0;
 // APK CanUseMergeMaterial @0x768fde0 compares costRank exactly, including
 // zero (ordinary), not as a wildcard. S pieces are never ordinary fodder.
 // Automatic selection additionally preserves copies for the next exact merge.
 let exact=stage;const visited=new Set();
 while(exact?.Cost_Any&&exact.NextQuality&&!visited.has(exact.Quality)){
  visited.add(exact.Quality);exact=stages.get(row.rank*1000+exact.NextQuality);
 }
 const reserve=stage.Cost_Any&&!exact?.Cost_Any?(exact?.Cost?.[0]?.[1]||0):0;
 const named=candidates.filter(item=>item.family===target.family);
 const reserved=new Set(named.slice(0,reserve));
 const protectedIds=stage.Cost_Any?candidates.filter(item=>gearConfig(item).rank===1||reserved.has(item)).map(item=>item.uid):[];
 const protectedSet=new Set(protectedIds),automatic=candidates.filter(item=>!protectedSet.has(item.uid));
 // APK TryBuildMergeMaterials @0x76906d4 selects equipment first, then
 // fills any remaining places with the corresponding generic material item.
 const defaultIds=automatic.slice(0,required).map(item=>item.uid);
 const defaultTokens=Math.min(required-defaultIds.length,tokens);
 return {required,quality,nextQuality:stage.NextQuality,nextQualityName:GEAR_QUALITY_NAMES[stage.NextQuality],any:!!stage.Cost_Any,candidates:candidates.map(item=>item.uid),tokenKey,tokens,defaultTokens,defaultIds,protectedIds,
  available:tokens+candidates.length>=required,autoAvailable:defaultTokens+defaultIds.length===required};
}
export function gearSnapshot(state,wallet={}){return {revision:state.revision,items:state.items.map(item=>({...gearView(item,state,wallet),merge:gearMergeOptions(state,item.uid)})),slots:{...state.slots},levels:{...state.levels},blueprints:GEAR_PARTS.map(part=>({...part,count:state.blueprints[part.type]||0})),fodder:{...state.fodder},totals:gearTotals(state),draws:state.draws,keys:{...state.keys},basicRewardClaims:state.basicRewardClaims,basicRewardAvailable:Math.max(0,Math.floor(state.draws/20)-state.basicRewardClaims),basicSupply:{single:60,ten:600,probabilities:[{name:'普通',chance:70},{name:'优秀',chance:30}]},advancedSupply:{single:300,ten:3000,probabilities:shopReference.boxRates.filter(r=>r.ID>=311&&r.ID<=315).map(r=>({id:r.ID,weight:r.items.reduce((s,x)=>s+x[2],0)})),weightTotal:99950}};}
function addGear(state,family,quality){const item={uid:`gear-${++state.serial}`,family,quality,locked:false};state.items.push(item);return item;}
export function planGearAction(state,{operation,uid,revision,materialIds=[],tokens=0,count=1,wallet={},rng=Math.random,pool='basic'}={}){
 if(revision!==state.revision)return fail('装备已变化，请重新确认');
 const next=clone(state),item=next.items.find(item=>item.uid===uid),walletDelta={},result={};
 if(!['supply','batch','claimBasicReward'].includes(operation)&&!item)return fail('装备不存在');
 if(operation==='equip')next.slots[gearConfig(item).equipType]=uid;
 else if(operation==='unequip'){const type=gearConfig(item).equipType;if(next.slots[type]!==uid)return fail('这件装备未装配');next.slots[type]=null;}
 else if(operation==='lock')item.locked=!item.locked;
 else if(operation==='upgrade'||operation==='upgradeAll'){
  const type=gearConfig(item).equipType,worn=next.items.find(i=>i.uid===next.slots[type]);
  if(worn?.uid!==uid)return fail('请先装配这件装备');const cost=gearUpgradeCost(atPartLevel(worn,next));if(!cost)return fail('已达当前装配品质等级上限');
  if(!wallet.unlimited&&wallet.coins<cost.coins)return fail('金币不足');if((next.blueprints[type]||0)<cost.blueprints)return fail(`${partFor(item).name}图纸不足`);
  let coins=0,blueprints=0;result.fromLevel=next.levels[type];
  do{
   const step=gearUpgradeCost(atPartLevel(worn,next));
   if(!step||!wallet.unlimited&&wallet.coins<coins+step.coins||next.blueprints[type]<blueprints+step.blueprints)break;
   coins+=step.coins;blueprints+=step.blueprints;next.levels[type]++;
  }while(operation==='upgradeAll');
  if(!wallet.unlimited)walletDelta.coins=-coins;next.blueprints[type]-=blueprints;result.toLevel=next.levels[type];
 }else if(operation==='downgrade'){
  const targetQuality=gearStage(item).ResetQuality;if(!targetQuality)return fail('当前品质不可降阶');
  // APK 1.1.6 GetResetRefundCost @0x7691298 walks ResetQuality -> current.
  // GetResetRefundItemId @0x76919b4 returns Item_id[type-1] for generic
  // costs, otherwise the same rank/series at the material quality.
  const returnedGear=[],returnedFodder=[];let q=targetQuality;
  while(q<item.quality){
   const rule=gearStage({...item,quality:q});if(!rule?.NextQuality)return fail('降阶配置缺失');
   for(const[materialQuality,amount]of rule.Cost){
    if(rule.Cost_Any){const type=gearConfig(item).equipType,key=`${type}:${materialQuality}`;const balance=(next.fodder[key]||0)+amount;if(!Number.isSafeInteger(balance)||balance!==int(balance))return fail('合成材料数量已达上限，请先使用后再降阶');next.fodder[key]=balance;const existing=returnedFodder.find(x=>x.type===type&&x.quality===materialQuality);if(existing)existing.amount+=amount;else returnedFodder.push({type,quality:materialQuality,amount});}
    else{for(let i=0;i<amount;i++){const grant=addGear(next,item.family,materialQuality);returnedGear.push(clone(grant));}}
   }
   q=rule.NextQuality;
  }
  // A returned exact copy must fit before committing; sanitize caps the saved
  // inventory at the same limit, so accepting overflow would lose that refund.
  if(next.items.length>GEAR_INVENTORY_CAPACITY)return fail('装备仓库空间不足，请先合成或整理装备');
  item.quality=targetQuality;Object.assign(result,{quality:targetQuality,level:gearEffectiveLevel(item,next.levels[gearConfig(item).equipType]),slotLevel:next.levels[gearConfig(item).equipType],returnedGear,returnedFodder});
 }else if(operation==='merge'){
  const option=gearMergeOptions(next,uid);if(!Array.isArray(materialIds))return fail('合成材料格式异常');const ids=[...new Set(materialIds)],tokenCount=int(tokens);
  if(!option.required)return fail('已达最高品质');if(ids.length!==materialIds.length||ids.some(id=>!option.candidates.includes(id))||tokenCount>option.tokens||ids.length+tokenCount!==option.required)return fail('请选择符合要求的合成材料');
  next.fodder[option.tokenKey]=(next.fodder[option.tokenKey]||0)-tokenCount;next.items=next.items.filter(i=>!ids.includes(i.uid));result.fromQuality=item.quality;item.quality=option.nextQuality;result.toQuality=item.quality;
 }else if(operation==='batch'){
  const steps=[];
  for(const quality of[10,20,30])for(const id of [...next.items].sort((a,b)=>Number(equipped(next,b.uid))-Number(equipped(next,a.uid))).map(i=>i.uid)){
   const target=next.items.find(i=>i.uid===id);if(!target||target.quality!==quality||target.locked)continue;
   const option=gearMergeOptions(next,id);if(!option.available)continue;
   const planned=planGearAction(next,{operation:'merge',uid:id,materialIds:option.defaultIds,tokens:option.defaultTokens,revision:next.revision,wallet});if(!planned.ok)continue;
   Object.assign(next,planned.state);steps.push({uid:id,from:quality,to:option.nextQuality});
  }
  if(!steps.length)return fail('暂无可一键合成的装备');result.steps=steps;
 }else if(operation==='claimBasicReward'){
  const available=Math.floor(next.draws/20)-next.basicRewardClaims;if(available<1)return fail('尚未达到领取次数');next.basicRewardClaims++;next.keys.advanced++;result.keyReward=1;
 }else if(operation==='supply'){
  if(!['basic','advanced'].includes(pool))return fail('未知装备宝箱');
  if(![1,10].includes(count))return fail('请选择补给次数');if(next.items.length+count>GEAR_INVENTORY_CAPACITY)return fail('装备仓库已满');
  const keyPayment=(next.keys?.[pool]||0)>=count,price=(pool==='basic'?60:300)*count;
  if(!keyPayment&&!wallet.unlimited&&wallet.diamonds<price)return fail('钻石或补给券不足');
  if(keyPayment)next.keys[pool]-=count;else if(!wallet.unlimited)walletDelta.diamonds=-price;
  result.drawn=[];result.weaponDrops=[];result.pool=pool;
  const tables=shopReference.boxRates.filter(r=>pool==='basic'?[411,412].includes(r.ID):r.ID>=311&&r.ID<=315).flatMap(r=>r.items),total=tables.reduce((s,r)=>s+r[2],0);
  for(let i=0;i<count;i++){
   let cursor=Math.max(0,Math.min(.999999999,Number(rng())||0))*total;
   const [id]=tables.find(r=>(cursor-=r[2])<0)||tables.at(-1);
   if(id===902){result.weaponDrops.push(Math.floor(Math.max(0,Math.min(.999999999,Number(rng())||0))*11));continue;}
   const row=rows.get(id);result.drawn.push(clone(addGear(next,row.ID-row.quality,row.quality)));
  }
  if(pool==='basic')next.draws+=count;
 }else return fail('未知装备操作');
 next.revision=state.revision+1;
 return {ok:true,state:next,walletDelta,message:operation==='upgradeAll'?`强化至 Lv.${result.toLevel}`:{equip:'已装配',unequip:'已卸下',lock:item?.locked?'已锁定':'已解锁',upgrade:'强化成功',downgrade:'降阶完成',merge:'合成成功',batch:'一键合成完成',supply:'补给已送达',claimBasicReward:'高级补给券已领取'}[operation],...result};
}
// This game's clear receipt adapts the reference's wave drops. The quantities
// below are project balance, not an assertion about the APK's combat drop rates.
export function grantGearSortie(state,{won=false,rng=Math.random}={}){
 const next=clone(state),rewards=[],type=1+Math.floor(Math.max(0,Math.min(.999999999,Number(rng())||0))*5),blueprints=won?10:3;
 next.blueprints[type]=(next.blueprints[type]||0)+blueprints;rewards.push({type:'gearBlueprint',gearType:type,name:`${GEAR_PARTS[type-1].name}图纸`,amount:blueprints,image:equipmentBlueprintArtPath(GEAR_PARTS[type-1].id)});
 if(won){const candidates=reference.equip.filter(row=>row.rank===0&&row.quality===10),row=candidates[Math.floor(Math.max(0,Math.min(.999999999,Number(rng())||0))*candidates.length)],item=addGear(next,row.ID-row.quality,10);rewards.push({type:'gear',id:item.uid,name:gearName(item),amount:1,image:`art/project-flight-gear-v1/${equipmentArtKey(row)}.webp`,qualityRank:0});}
 next.revision++;return {state:next,rewards};
}
