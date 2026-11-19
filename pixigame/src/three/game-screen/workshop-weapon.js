import {area,box,clamp,pic,qualityFrame,slice,words,titleFont} from './menu-art.js';
import {normalFit,psdAction,selection,stars,symbol} from './catalog-art.js';
import {WEAPON_QUALITIES} from '../../fixed-parts/common-weapons.js';
import {weaponThemeArt} from '../../ui/weapon-theme-art.js';
import {weaponIconUrl} from '../../ui/weapon-icon-source.js';
import {availabilityMessage} from '../../ui/resource-availability.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';

const image=weapon=>weaponThemeArt(weapon.id)||weaponIconUrl(weapon.id)||weaponIconUrl(weapon.appearance);
const number=n=>Number(n||0).toLocaleString('zh-CN',{useGrouping:false,maximumFractionDigits:3});
export function workshopFilterChoices(mode,gear){
  if(mode==='gear')return [['all','全部'],...gear.blueprints.map(p=>[String(p.type),p.name])];
  return [['all','全部'],['ready',mode==='level'?'可强化':'可升星'],['equipped','已装备'],...WEAPON_QUALITIES.map((q,i)=>['q'+i,q])];
}
export function weaponWorkshop(data,w,h,t,layout){
  const {a,top,stageH,gridY,footY,button,assistant}=layout,s=data.snapshot,ui=data.workshop,leveling=ui.mode==='level';
  const all=(s.workshop?.items||[]).map(item=>({...item,growth:s.weapons.find(v=>v.id===item.id)})).filter(i=>i.owned&&i.growth);
  const items=all.filter(i=>ui.filter==='ready'?(leveling?i.growth.canUpgrade:i.canSynthesize):ui.filter==='equipped'?(i.equipped||s.innateWeapon===i.id):ui.filter.startsWith('q')?i.qualityRank===Number(ui.filter.slice(1)):true);
  const item=all.find(i=>i.id===ui.id),g=item?.growth,ready=item&&(leveling?g.canUpgrade:item.canSynthesize);
  const capped=item&&leveling&&!g.cost,canChange=capped&&item.qualityRank<5,rank=item?.qualityRank;
  for(const [i,[mode,label]] of [['level','强化'],['quality','升星']].entries()){
    const b=box(w*.97-(2-i)*Math.max(48,w*.16)-(1-i)*w*.012,top+w*.02,Math.max(48,w*.16),44);
    psdAction(a,t,b,{id:'mode-'+mode,label,cmd:'workshopMode',data:{mode},size:13});
    if(mode===ui.mode)selection(a,t,b);
  }
  const sy=top+stageH*.18,sh=(stageH*.78-.09*w)/2,bw=.22*w;
  for(const result of [true,false]){
    const b=box(.085*w,sy+(result?0:sh+.09*w),bw,sh);
    slice(a,t,item?qualityFrame(result&&!leveling?(item.nextQualityRank??rank):rank):'/art/weapon-catalog-psd-v1/plate-blue-clean.png',b,8);
    const label=!result?'当前':capped?'等级上限':!leveling&&rank>=5?'最高品质':'提升后';
    words(a,label,b.x+b.w/2,b.y+13,10);if(item){
      normalFit(a,t,image(g),box(b.x+6,b.y+20,b.w-12,Math.max(1,b.h-39)));
      const value=leveling?'Lv.'+(result?(g.cost?g.level+1:g.maxLevel??g.level):g.level):((result?item.nextQualityRank:null)??rank)+'星';
      words(a,value,b.x+b.w/2,b.y+b.h-12,11);
    }else words(a,'＋',b.x+b.w/2,b.y+b.h/2,16,{color:'#afc7d4'});
    area(t,result?'result':'input',item?item.name+'，'+label:'选择武器',b,'workshopChoose');
  }
  const arrow=symbol(a,t,'equipment-upgrade',box(.165*w,sy+sh+.01*w,.06*w,.07*w));if(capped||!leveling&&rank>=5)arrow.material.opacity=.5;
  let reason='';
  if(item&&!ready){
    if(capped)reason=canChange?'升星可提高等级上限':'已满级';
    else if(leveling){const costs=[[s.wallet.coins,g.cost.coins,'金币'],[s.wallet.weaponParts,g.cost.weaponParts,'零件']];reason=costs.filter(([n,c])=>n<c).map(([, ,label])=>label).join('与');reason=(reason||'材料')+'不足';}
    else reason=rank>=5?'已满星':s.workshop.universalFragments<item.universalCost?'通用零件不足':item.reason||'材料不足';
  }
  const effect=!item?'':leveling?'基础伤害 '+number(g.damage)+(g.cost?' → '+number(g.nextDamage??g.damage):''):(item.nextEffect||item.currentEffect||'').replace('；等级上限 ',' · 上限 ');
  assistant([item?.name||'选择武器',effect,availabilityMessage(reason)].filter(Boolean),!!item);
  const choice=workshopFilterChoices(ui.mode,s.equipment).find(([key])=>key===ui.filter);
  button('filter',ui.filter==='all'?'筛选':choice?.[1]||'全部','workshopFilter','left');
  if(!leveling)button('batch','一键升星','workshopBatch','right',!s.workshop?.batch?.steps.length);
  const label=leveling?(capped?(canChange?'去升星':'已满级'):'强化'):(rank>=5?'已满星':'升星');
  const cost=item?(leveling?g.cost?[[1,g.cost.coins,s.wallet.coins],[null,g.cost.weaponParts,s.wallet.weaponParts]]:[]:
    item.cost?[[null,item.universalCost,s.workshop.universalFragments],[null,item.specificCost,item.fragments]]:[]):[];
  const prices=cost.filter(([,c])=>c>0).map(([,c,n])=>number(n)+'/'+number(c)).join('   ');
  button('compose',label,canChange?'workshopMode':leveling?'upgrade':'workshopSynthesize','confirm',!ready&&!canChange,
    {kind:'weapon',id:item?.id||'',rank:item?.qualityRank??'',...(canChange?{mode:'quality'}:{})},{price:prices||undefined,icon:prices&&cost[0][0]?nativeItemArt(cost[0][0]):undefined});
  const cols=5,gap=.02*w,pad=.045*w,side=(w-2*pad-(cols-1)*gap)/cols,zone='workshop-'+ui.mode+'-'+ui.filter,grid=t.layer('weapon-inventory',zone).art;
  items.forEach((it,i)=>{const b=box(pad+i%cols*(side+gap),gridY+gap+Math.floor(i/cols)*(side+gap),side,side);
    slice(grid,t,qualityFrame(it.qualityRank),b,8);
    normalFit(grid,t,image(it.growth),box(b.x+4,b.y+2,b.w-8,b.h-23));stars(grid,t,box(b.x+5,b.y+b.h-22,b.w-10,8),5,it.qualityRank,{align:'center'});
    words(grid,'Lv.'+(it.growth.level||1),b.x+b.w/2,b.y+b.h-7,10);
    if(it.equipped||it.id===s.innateWeapon)words(grid,it.id===s.innateWeapon?'专属':'已装备',b.x+4,b.y+7,9,{align:'left',color:'#fff4b2'});
    if(item?.id===it.id){selection(grid,t,b);t.anchor('selected-weapon',Math.max(0,Math.floor(i/cols)*(side+gap)-(footY-gridY-side)/2));}
    area(t,'weapon-'+it.id,it.name,b,'workshopSelect',{id:it.id},zone);});
  if(!items.length)words(grid,'暂无符合条件的武器',w/2,gridY+w*.07,12,{color:'#a2b9c7'});
  t.region(zone,box(0,gridY,w,Math.max(1,footY-gridY)),gap+Math.ceil(items.length/cols)*(side+gap));
}

