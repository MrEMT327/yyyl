import {art,box,button,area,pic,slice,words,titleFont,bodyFont,qualityFrame,fmt,clamp} from './menu-art.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {availabilityMessage,isResourceShortage} from '../../ui/resource-availability.js';
import {boxChestArt,boxShowcaseItems,advancedParticles} from '../../ui/shop-box-presentation.js';
import {shopItemId,shopCardName} from '../../ui/shop-page.js';
import {formatPatrolDuration} from '../../ui/patrol-clock.js';

const names={coins:'金币',diamonds:'钻石',stamina:'体力',weaponParts:'武器零件'};
const source=(id)=>RESOURCE_ICONS[id]?.url||'/art/project-ui-icons-v1/ad-play.png';
function glint(mesh,tools){
  const mat=mesh.material;mat.userData.phase={value:0};
  mat.onBeforeCompile=shader=>{
    shader.uniforms.shopPhase=mat.userData.phase;
    shader.fragmentShader='uniform float shopPhase;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n'+
      'float t=shopPhase, envelope=smoothstep(0.,.05,t)*(1.-smoothstep(.24,.32,t));'+
      'float r=(vMapUv.x+vMapUv.y*.49)-mix(-.6,1.7,clamp(t/.32,0.,1.));'+
      'float band=exp(-r*r*135.)*smoothstep(.03,.32,vMapUv.y)*(1.-smoothstep(.8,1.,vMapUv.y));'+
      'diffuseColor.rgb=mix(diffuseColor.rgb,vec3(1.,.91,.68),band*envelope*.80);');
  };
  tools.animate(t=>{mat.userData.phase.value=(t%4)/4;});
}
function chest(data,w,t,rows,y,pool){
  const s=data.snapshot,u=w/369.453,advanced=pool==='advanced',state=s.nativeAcquisition?.equipmentBoxes?.find(i=>i.id===(advanced?3:4));
  const r=(x,dy,sw,sh)=>box(x*u,y+dy*u,sw*u,sh*u),text=(value,x,dy,size,opts={})=>words(rows,value,x*u,y+dy*u,size*u,opts);
  const cmd=(id,label,b,action,payload,disabled=false)=>area(t,id,label,b,action,payload,'base',disabled);
  const economy=state?.compatibility||{},gear=s.equipment||{},busy=s.rewardPending||s.rewardBusy;
  pic(rows,t,art[pool+'-tray'],r(16.5,-4,336.4,advanced?210.5:207));
  text(advanced?'高级装备箱':'普通装备箱',30,20,18,{align:'left',color:advanced?'#ffdb89':'#e8f8ff',family:titleFont,maxWidth:w*.48});
  const promises=[[economy.qualityRemaining,advanced?'史诗':'优秀',advanced?'#d6a1ff':'#80f0ac'],...(advanced?[[economy.sRemaining,'圣环','#d6a1ff']]:[])];
  promises.filter(([count])=>Number.isSafeInteger(count)&&count>0).forEach(([count,level,color],i)=>{
    const cy=46+i*20,num=text(count,30,cy,12,{weight:800,align:'left',color:'#ffdf93'});
    const mid=text('件内必得',30+num.scale.x/u-2,cy,11.25,{align:'left'});
    const end=text(level,30+(num.scale.x+mid.scale.x)/u-4,cy,11.25,{align:'left',color});
    text('装备',30+(num.scale.x+mid.scale.x+end.scale.x)/u-6,cy,11.25,{align:'left'});
  });
  const info=r(313.8,-2,44,44);pic(rows,t,'/art/project-ui-icons-v1/info.png',r(328,12,16,16),true);
  cmd('rates-'+pool,'装备宝箱详情',info,'shopBoxRates',{pool});
  if(!data.reduced){
    const particles=advanced?advancedParticles:Array.from({length:6},(_,i)=>['basic',6+i*21,65+i%3*15,8,0,84,4.8,-i*.8]);
    for(const [kind,px,py,size,drift,lift,duration,delay] of particles){
      const side=size*w/1080,b=r(109.5+px*1.78,28+py*1.01,side/u,side/u);
      const m=pic(rows,t,art['spark-'+(kind==='basic'?'glint':kind)],b),ox=m.position.x,oy=m.position.y;
      t.animate(now=>{const p=((now-delay)%duration)/duration,peak=kind==='glint'?.29:.22;
        m.position.set(ox+drift*w/1080*p,oy-lift*w/1080*p,0);
        m.scale.x=side*(.55+.35*p);m.scale.y=-m.scale.x;m.rotation.z=(p*.7-.28);
        m.material.opacity=Math.max(0,Math.min(1,p/peak,(.9-p)/.32))*.9;
      });
    }
  }
  const chestArt=state?boxChestArt(state):'/art/'+(advanced?'project-equipment-boxes-v1/advanced.png':'shop-comic-v1/weapon-crate-v2.webp');
  const chestRect=r(w<350?142:130,32,137,98),crate=pic(rows,t,chestArt,chestRect,true);
  if(advanced&&!data.reduced)glint(crate,t);
  const points=advanced?[[53,75,47],[255,36,47],[276,93,40]]:[[53,73,47],[240,34,47],[276,92,40]];
  (data.showcases[pool]||[]).forEach((item,i)=>{
    const [x,dy,side]=points[i],b=r(x,dy,side,side),orb=pic(rows,t,art[pool+'-orb'],b),img=pic(rows,t,item.image,r(x+4,dy+4,side-8,side-8),true);
    const rank=item.gear.rank===1?text('S',x+side-5,dy+side-5,15,{family:titleFont,color:'#ffda74'}):null;
    if(!data.reduced){const nodes=[orb,img,rank].filter(Boolean).map(m=>[m,m.position.y]);t.animate(now=>{
      const p=(1-Math.cos((now+i*.7)*Math.PI*2/(3.5+i*.3)))*.5;
      for(const [m,oy] of nodes){m.position.y=oy-side*u*.058*p;m.rotation.z=(-3+6*p)*Math.PI/180;}
    });}
    cmd(pool+'-gear-'+i,item.name,b,'inspect',{itemId:item.id});
  });
  if(!advanced){
    const progress=gear.basicRewardAvailable?20:(gear.draws||0)%20,claim=gear.basicRewardAvailable>0&&!busy,b=r(302,33,43,43);
    slice(rows,t,qualityFrame(3),b,5*u);
    pic(rows,t,nativeItemArt(112),r(308,39,32,30),true);text('×1',335,69,9.5);
    rows.quad(304*u,y+76*u,40*u,13*u,'#102536');text(claim?'领取':s.rewardPending?'待保存':s.rewardBusy?'处理中':progress+'/20',324,82,11);
    cmd('milestone',claim?'领取高级装备箱券':'高级装备箱券',r(295,31,53,59),claim?'shopClaimBoxReward':'inspect',claim?{}:{itemId:112});
  }
  if(economy.freeRemainingMs>0&&!economy.clockBlocked){
    const remaining=data.time&&economy.nextFreeAt?Math.max(0,economy.nextFreeAt-data.time):economy.freeRemainingMs;
    text(formatPatrolDuration(Math.ceil(remaining/1000))+'后免费',185,129,10);
  }
  for(const [i,count] of [1,10].entries()){
    const q=state?.quotes?.find(row=>row.count===count),keys=gear.keys?.[pool]||0;
    const short=q?.payment==='diamond'&&!s.wallet.unlimited&&s.wallet.diamonds<q.amount||q?.payment==='key'&&keys<q.amount;
    const price=q?.payment==='free'?'免费开启':q?.amount==null?'—':q.payment==='key'?fmt(keys)+'/'+fmt(q.amount):fmt(q.amount);
    const b=r(69+i*120,135.5,112,48);
    const ico=q?.payment==='key'?nativeItemArt(q.itemId):q?.payment==='diamond'?source('diamonds'):null;
    button(rows,t,b,{title:'开启'+count+'次',price,icon:ico,gold:i===1,short,disabled:busy||!q?.canDraw,
      family:bodyFont,titleSize:12*u,priceSize:10.8*u,priceColor:q?.payment==='free'?'#9ff6ff':'#fff'});
    if(count===1&&['free','key'].includes(q?.payment)&&!busy)rows.panel(b.x+b.w-8,b.y,7,7,{fill:'#ff586c',stroke:'#401c2b',radius:3.5});
    cmd('open-'+pool+'-'+count,'开启'+count+'次',b,'shopBoxConfirm',{pool,count,payment:q?.payment,resourceShort:short?(q.payment==='key'?'箱券':'钻石'):null},busy||!short&&!q?.canDraw);
  }
}
export function shopProductImage(type,amount){
  if(type==='coins')return amount>=10000?'/art/shop-coin-tiers-v2/'+(amount>=50000?'coins-safe.png':'coins-canister.png'):'/art/project-resource-icons-v2/credits-stack.png';
  if(RESOURCE_ICONS[type])return RESOURCE_ICONS[type].url;
  const id=Number(shopItemId(type));return Number.isFinite(id)?nativeItemArt(id):source(type);
}
export function shopData(s){return Object.fromEntries(['advanced','basic'].map((key,i)=>[key,boxShowcaseItems(s.nativeAcquisition?.equipmentBoxes?.find(b=>b.id===i+3))]));}
export function shopMenu(data,w,h,t,chrome){
  const s=data.snapshot,u=w/369.453,top=chrome.top,bar=Math.max(44,w*.11),bottom=chrome.navY-bar;
  const rows=t.layer('store-items','base').art,blocked=s.rewardBusy||s.rewardPending;
  let cursor=top+8*u;
  if(blocked||s.shop?.clockBlocked){
    const msg=s.rewardPending?'奖励待保存':s.rewardBusy?'奖励正在处理':'设备日期异常';
    words(rows,msg,w/2,cursor+14,14);if(s.rewardPending){area(t,'recovery','重试保存',box(w*.58,cursor,w*.35,30),'recoverDailyRewards',{},'base',s.rewardBusy);words(rows,'重试保存',w*.77,cursor+14,13);}
    cursor+=34;
  }
  function heading(id,title){
    t.anchor(id,cursor-top-8*u);
    const b=box(w*.302,cursor,144*u,36*u);
    pic(rows,t,'/art/psd-page-chrome-v1/chapter-idle.png',b);words(rows,title,w/2,cursor+18*u,17*u,{family:titleFont});
    cursor+=54*u;
  }
  heading('boxes','装备宝箱');chest(data,w,t,rows,cursor,'advanced');cursor+=198.3*u;
  chest(data,w,t,rows,cursor,'basic');cursor+=219.7*u;heading('daily','每日商店');
  const reset=s.shop?.resetAt,minutes=Number.isFinite(data.time)&&Number.isFinite(reset)?Math.ceil(Math.max(0,reset-data.time)/60000):s.shop?.remainingMinutes||0;
  words(rows,Math.floor(minutes/60)+':'+String(minutes%60).padStart(2,'0')+' 后刷新',w*.04,cursor+19*u,11*u,{align:'left'});
  const refresh=box(w*.668,cursor,107*u,36*u),free=s.shop?.refresh?.freeRemaining||0;
  button(rows,t,refresh,{title:free?'免费刷新×'+fmt(free):'刷新',gold:true});
  area(t,'refresh','刷新商店',refresh,'shopRefreshPreview',{},'base',blocked||!(free?s.shop?.refresh?.available:s.shop?.refresh?.adAvailable));cursor+=45*u;
  function offer(o,i,label,actual=o){
    const [type,amount]=Object.entries(o.reward)[0],id=shopItemId(type),x=(14.8+i%3*116.8)*u,y=cursor+Math.floor(i/3)*165*u,b=box(x,y,108.4*u,157.7*u);
    const short=!blocked&&isResourceShortage(actual.reason),cost=actual.cost,reason=blocked?(s.rewardPending?'奖励待保存':'奖励处理中'):availabilityMessage(actual.reason);
    slice(rows,t,'/art/weapon-catalog-psd-v1/frame-blue.png',b,10*u);
    words(rows,label,x+5*u,y+15*u,12*u,{align:'left',maxWidth:102*u});
    const path=shopProductImage(type,amount);
    const preview=box(x+5*u,y+31*u,98*u,77*u);pic(rows,t,path,box(preview.x+8*u,preview.y+7*u,82*u,63*u),true);
    words(rows,'×'+fmt(amount),x+b.w/2,y+116*u,13*u);
    if(o.discount){slice(rows,t,'/art/psd-equipment-v1/button-gold-native.png',box(x+b.w-34*u,y+2*u,32*u,21*u),5*u);words(rows,o.discount+'折',x+b.w-18*u,y+12*u,11*u);}
    const sold=!actual.unlimited&&actual.remaining===0||actual.reason==='今日已领取';
    const price=sold&&!blocked?'已售罄':cost.amount?fmt(cost.amount):reason||(cost.type==='ad'?'广告领取':'免费领取');
    pic(rows,t,'/art/psd-main-v1/resources/diamonds-background.png',box(x+5*u,y+127*u,b.w-10*u,26*u));
    if(cost.amount&&!sold)pic(rows,t,source(cost.type),box(x+24*u,y+132*u,15*u,15*u),true);
    words(rows,price,x+b.w/2+(cost.amount&&!sold?8*u:0),y+140*u,12*u,{color:short?'#ffb59a':'#fff'});
    area(t,'offer-'+o.id,label,b,'shopOffer',{id:actual.id,resourceShort:short?(names[cost.type]||'资源'):null},'base',blocked||!short&&!actual.available);
    area(t,'inspect-'+o.id,label,preview,'inspect',{itemId:id,image:path},'base');
  }
  const offers=s.shop?.items||[],daily=offers.filter(o=>o.section==='daily');
  daily.forEach((o,i)=>offer(o,i,shopCardName(o)));cursor+=Math.ceil(daily.length/3)*165*u+21*u;
  heading('coins','金币');
  ['exchange-coins','exchange-coins-medium','exchange-coins-large'].forEach((id,i)=>{
    const o=offers.find(row=>row.id===id);if(!o)return;
    const free=i===0&&offers.find(row=>row.id==='coin-free');
    offer(o,i,['少量金币','一袋金币','一箱金币'][i],free&&(free.unlimited||free.remaining==null||free.remaining>0)?free:o);
  });
  cursor+=175*u;t.region('base',box(0,top,w,bottom-top),cursor-top);
  const tabs=t.layer('category-tabs').art;pic(tabs,t,'/art/project-navigation-v2/background.png',box(0,bottom,w,bar));
  for(const [i,[id,label]] of [['boxes','宝箱'],['daily','每日商店'],['coins','金币']].entries()){
    const b=box((3.5+121.8*i)*u,bottom,119*u,bar),active=id===(data.shopSection==='stamina'?'coins':data.shopSection);
    pic(tabs,t,'/art/psd-page-chrome-v1/'+(active?'chapter-face.png':'chapter-idle.png'),box(b.x,b.y+bar*.23,b.w,bar*.74));
    words(tabs,label,b.x+b.w/2,b.y+bar*.6,14*u,{family:titleFont});
    if(id==='daily'&&s.shop?.hasFree)tabs.panel(b.x+b.w*.71,b.y+bar*.54,6,6,{fill:'#ff586c',stroke:'#381f2d',radius:3});
    area(t,'section-'+id,label,b,'shopSection',{section:id});
  }
}

