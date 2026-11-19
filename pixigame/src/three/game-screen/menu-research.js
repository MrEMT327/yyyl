import {art,box,pic,slice,words,area,titleFont,qualityFrame,button,compact,clamp} from './menu-art.js';
import {researchArt,researchCardQuality} from '../../ui/research-art.js';
import {researchUnlockMessage} from '../../ui/research-tabs.js';
import {nativeLabArt} from '../../replica/native-collection-art.js';
import {nativeLabView} from '../../replica/native-client-rules.js';
import labOrder from '../../replica/native-lab-presentation.json';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';

export function researchMenu(data,w,h,t,chrome){
  const s=data.snapshot,r=s.research,lab=data.section==='lab',u=w/369.453,banner=Math.max(44,w*.11),top=chrome.top;
  const controls=t.layer('talent-tabs').art;
  for(const [i,[id,label]] of (researchUnlockMessage(s.replicaCampaign)?[['talent','天赋']]:[['talent','天赋'],['lab','科研']]).entries()){
    const b=box(w*.02+i*w*.29,top,w*.28,banner),active=id===(lab?'lab':'talent');
    pic(controls,t,'/art/psd-page-chrome-v1/'+(active?'chapter-face.png':'chapter-idle.png'),box(b.x,b.y+banner*.125,b.w,banner*.72));
    words(controls,label,b.x+b.w/2,b.y+b.h/2,15*u,{family:titleFont});
    area(t,'research-'+id,label,b,'researchSection',{section:id});
  }
  const right=box(w*.76,top,w*.22,banner);
  words(controls,lab?'出击属性':'总加成 '+(r?.owned||0)+'/'+(r?.cards.length||0),right.x+right.w/2,top+banner/2,10*u,{weight:700});
  area(t,'summary',lab?'出击属性':'总加成',right,lab?'nativeStats':'researchSummary');
  if(!r&&!lab){words(controls,'科技暂不可用',w/2,top+banner+30,14);return;}
  const progress=!lab&&!r.native&&!r.allFinished&&!r.aceFinished&&r.refining,foot=48+2*w*.02+(progress?24:0)+(s.storageWarning?18:0);
  const gy=top+banner,gyEnd=chrome.navY-4*u-(lab?0:foot),margin=w*.02,gap=w*.015,gapY=w*.02;
  const width=(w-margin*2-gap*3)/4,height=width*4/3;
  const items=lab?[...(s.replicaCollection?.labs||[])].sort((a,b)=>Number(b.active)-Number(a.active)||labOrder[b.id].sort-labOrder[a.id].sort):[...r.cards].sort((a,b)=>Number(b.owned)-Number(a.owned));
  const zone=lab?'labs':'talents',grid=t.layer(zone,zone).art,rect=box(0,gy,w,gyEnd-gy);
  t.region(zone,rect,margin*2+Math.ceil(items.length/4)*(height+gapY)-gapY);
  items.forEach((c,i)=>{
    const x=margin+(i%4)*(width+gap),y=gy+margin+Math.floor(i/4)*(height+gapY),b=box(x,y,width,height);
    if(!lab&&!c.owned){pic(grid,t,art['unknown-talent'],b);return;}
    const rank=lab?0:researchCardQuality(c.quality);
    slice(grid,t,qualityFrame(rank),b,clamp(w*.028,9,13));
    if(lab){
      const level=c.levels.find(v=>v.level===c.level)||c.levels[0],m=level.costs.find(cost=>cost.id>=801&&cost.id<=811);
      const locked=Boolean(researchUnlockMessage(s.replicaCampaign,c)),v=nativeLabView(c,s.replicaCampaign);
      const face=pic(grid,t,nativeLabArt(c),box(x+width*.05,y+height*.08,width*.9,height*.67),true);
      if(locked||!c.active)face.material.color.set(0x919ba1);
      words(grid,c.name,x+width/2,y+height*.16,clamp(w*.028,10,13),{maxWidth:width-6});
      if(!locked&&c.active){
        const maxed=!level.nextId,bar=box(x+width*.08,y+height*.78,width*.84,height*.13);
        grid.quad(bar.x,bar.y,bar.w,bar.h,'#122533');
        grid.quad(bar.x,bar.y,bar.w*(m?Math.min(1,m.available/Math.max(1,m.count)):Number(maxed)),bar.h,'#427f80');
        words(grid,c.needActive?'待激活':maxed?'MAX':compact(m?.available||0)+'/'+(m?.count||0),x+width/2,bar.y+bar.h/2,11*u);
        words(grid,c.level,x+10*u,y+height-11*u,12*u);
      }else words(grid,locked?'未开启':'尚未解锁',x+width/2,y+height*.80,12*u);
      if(v.canActivate||v.canUpgrade)grid.panel(x+width-8,y+1,7,7,{fill:'#ff586c',stroke:'#401c2b',radius:3});
      area(t,'lab-'+c.id,c.name,b,'nativeLab',{id:c.id},zone);
    }else{
      pic(grid,t,researchArt(c.icon),box(x+width*.04,y+height*.05,width*.92,height*.70),true);
      words(grid,c.name,x+width/2,y+height*.77,clamp(w*.0265,9,12),{maxWidth:width*.9});
      words(grid,c.maxed?'MAX':'Lv.'+c.level,x+width/2,y+height*.884,clamp(w*.032,11,15),{color:'#ffe58a',maxWidth:width*.9});
      area(t,'talent-'+c.id,c.name,b,'researchCard',{id:c.id},zone);
    }
  });
  if(lab)return;
  const footArt=t.layer('awaken').art,y=gyEnd+w*.02+(progress?24:0),gapX=w*.025;
  if(progress)words(footArt,'研制 '+r.refineProgress+'/'+r.refineSteps,w/2,gyEnd+12,11);
  const widthBtn=(w*.94-gapX)/2;
  for(const [i,pool] of ['normal','ace'].entries()){
    const normal=i===0,b=box(w*.03+(widthBtn+gapX)*i,y,widthBtn,48);
    const title=normal?(r.allFinished?'全部满级':r.coresSufficient?'星核已充足':r.refineReady?'领取星核':r.refining?'推进研制':'常规觉醒'):(r.aceFinished?'王牌已满级':'王牌觉醒');
    const blocked=normal?r.allFinished||r.coresSufficient:r.aceFinished;
    const short=!blocked&&(normal?!r.refineReady&&s.wallet.coins<r.normalCost:r.cores<1);
    const cost=blocked?'—':normal?(r.refineReady?'+1':compact(s.wallet.coins)+'/'+compact(r.normalCost)):r.cores+'/1';
    const icon=blocked?null:normal&&!r.refineReady?RESOURCE_ICONS.coins.url:researchArt('technology-core'),can=normal?r.canNormal:r.canAce;
    button(footArt,t,b,{title,price:cost,icon,gold:!normal,short,disabled:!can});
    area(t,'draw-'+pool,title,b,'researchDraw',{pool,revision:r.revision,resourceShort:short?(normal?'金币':'星核'):null},null,!can&&!short);
  }
  if(s.storageWarning)words(footArt,s.storageWarning,w/2,y+59,11,{color:'#ffd4b7'});
}

