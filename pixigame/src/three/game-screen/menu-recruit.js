import {art,box,area,pic,words,titleFont,button,clamp,fmt} from './menu-art.js';
import {cloudNativeRecruitSnapshot} from '../../replica/cloud-native-pages.js';
import {recruitFeatured} from '../../ui/recruit-page.js';
import {recruitPortraitPresentation} from '../../ui/character-portraits.js';
import {PORTRAIT_FRAMING} from '../../ui/portrait-framing.js';
import {pilotCardQuality} from '../../ui/pilot-card-quality.js';
import {supplyPool} from '../../ui/supply-pools.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {recruitCardLight} from './recruit-card-light.js';

const focusX={'pilot-01':.70,'pilot-04':.53,'pilot-05':.54,'pilot-07':.60,'pilot-08':.43,'pilot-10':.61};
export function recruitMenu(data,w,h,t,chrome){
  const s=cloudNativeRecruitSnapshot(data.snapshot),pool=supplyPool(s,'pilot'),pilot=recruitFeatured(s,data.selected);
  const u=w/369.453,foot=48+15+(s.storageWarning?18:0)+(s.rewardPending?32:0),fy=chrome.navY-foot;
  const side=w*.2455,gap=8,stripH=side+17,sy=fy-stripH,vTop=chrome.top,vh=sy-vTop;
  t.region('portrait-stage',box(0,vTop,w,vh),vh);
  const stage=t.layer('featured-pilot','portrait-stage').art,ink='#10283b';
  if(pilot){
    const id=pilot.id,f=PORTRAIT_FRAMING[id],p=recruitPortraitPresentation(pilot);
    const scale=id==='pilot-01' ? .525 : id==='pilot-08' ? .50 : .6;
    const span=f?vh*(id==='pilot-08'?1.65:1.95)*scale*f.displayScale/(f.bounds[3]-f.headY):w;
    const x=w*(w<=360 ? .76 : .68)-(focusX[id]||.5)*span,y=vTop+vh*(id==='pilot-01' ? .22 : .12)-(f?.headY||0)*span;
    pic(stage,t,p.image,box(x,y,span,span),true);
    const left=w*.04,top=vTop+(['pilot-01','pilot-10'].includes(id)?w*.04:vh*.17);
    const style=pilotCardQuality(pilot.rarity,pilot.qualityRank,pilot.qualityKnown);
    stage.quad(left,top,3,18,style.color);
    words(stage,pilot.rarity||'R',left+10,top+9,13,{align:'left',color:ink,family:'Georgia,serif',weight:700});
    words(stage,pilot.name,left,top+37,clamp(w*.056,18,25),{family:titleFont,align:'left',color:ink,maxWidth:w*.42});
    words(stage,pilot.title||'驾驶员',left,top+62,clamp(w*.03,11,14),{align:'left',color:'#385165',maxWidth:w*.42});
    let detailBottom=top+81;
    if(!['pilot-01','pilot-02'].includes(id)){
      const b=box(left,top+69,w*.265,35);words(stage,'查看详情 ›',b.x+b.w/2,b.y+b.h/2,12,{color:ink});
      area(t,'pilot-detail','查看详情',b,pilot.nativeId?'nativeSkillPreview':'pilotInfo',pilot.nativeId?{kind:'pilots',id:String(pilot.nativeId)}:{id});
      detailBottom=b.y+b.h+5;
    }
    stage.quad(left,detailBottom,w*.39,1,'#8396a5',.4);
    const skill=pilot.skillName||pilot.passive?.name,desc=pilot.passive?.description||pilot.description;
    if(skill)words(stage,skill,left+2,detailBottom+15,12,{align:'left',color:ink,maxWidth:w*.39,weight:700});
    if(desc)words(stage,desc,left+2,detailBottom+(skill?38:15),11,{align:'left',color:ink,maxWidth:w*.38,wrap:true,lineHeight:14});
  }else words(stage,'暂无可展示驾驶员',w/2,sy/2,15,{color:ink});
  const stripBase=t.layer('roster-background').art;stripBase.quad(0,sy,w,stripH+foot,'#102535');
  const info=t.layer('recruit-info').art,iy=vTop+Math.max(0,w*.061333+44-w*.125);
  pic(info,t,'/art/project-ui-icons-v1/info.png',box(w-61*u,iy+12*u,17*u,18*u),true);words(info,'奖励',w-28*u,iy+22,12,{color:ink});
  area(t,'rewards','奖励预览',box(w-68*u,iy,58*u,44),'recruitRewards');
  const zone=box(w*.03,sy+5,w*.94,side+6),cards=t.layer('roster','roster').art;
  t.region('roster',zone,Math.max(0,s.pilots.length*(side+gap)-gap),'x');
  s.pilots.forEach((row,i)=>{
    const selected=pilot?.id===row.id,b=box(zone.x+i*(side+gap),zone.y+3,side,side),tex=art[(selected?'roster-active-':'roster-')+row.id];
    if(tex)pic(cards,t,tex,b);
    else{
      const grade=pilotCardQuality(row.rarity,row.qualityRank,row.qualityKnown);
      pic(cards,t,'/art/psd-choice-v1/'+grade.choiceFrame,b);pic(cards,t,row.avatar,box(b.x+side*.06,b.y+side*.06,side*.88,side*.88),true);
      words(cards,row.rarity||'',b.x+side*.16,b.y+side*.1,12,{color:grade.light});
    }
    t.anchor('roster-'+row.id,i*(side+gap));
    area(t,'pilot-'+row.id,row.name,b,'recruitPreview',{id:row.id},'roster');
  });
  if(!data.reduced)recruitCardLight(cards,t,s.pilots,zone,side,gap);
  const footArt=t.layer('recruit-draws').art,bw=(w*.94-w*.024)/2;
  [1,10].forEach((count,i)=>{
    const cost=i?pool.tenCost:pool.singleCost??pool.cost;if(pool.unavailable||cost==null)return;
    const b=box(w*.03+i*(bw+w*.024),fy+5,bw,48),short=s.wallet.diamonds<cost;
    const title=i?(pool.rookieAvailable?'新手十连':'十次招募'):'单次招募';
    const locked=s.rewardPending||s.rewardBusy,ink=i?'#172e40':'#f3f6f8';
    const skin=art['recruit-button-'+(locked?'off-':'')+(i?'ten':'single')];
    button(footArt,t,b,{title,price:'×'+fmt(cost),icon:RESOURCE_ICONS.diamonds.url,skin,titleColor:ink,priceColor:ink,shortColor:'#ff9b91',gold:i===1,short,disabled:locked});
    area(t,'draw-'+count,title,b,'recruit',{count,resourceShort:short?'钻石':null},null,s.rewardPending||s.rewardBusy);
  });
  if(s.rewardPending){words(footArt,'已有奖励待保存',w*.3,fy+68,12);words(footArt,'重试保存',w*.72,fy+68,12);
    area(t,'retry','重试保存',box(w*.5,fy+54,w*.45,28),'recoverDailyRewards',{},null,s.rewardBusy);}
  if(s.storageWarning)words(footArt,s.storageWarning,w/2,chrome.navY-9,11,{color:'#f4d698'});
}

