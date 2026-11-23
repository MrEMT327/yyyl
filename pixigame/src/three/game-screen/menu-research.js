import {art,box,pic,slice,words,area,titleFont,qualityFrame,button,compact,clamp} from './menu-art.js';
import {researchArt,researchCardQuality} from '../../ui/research-art.js';
import {researchUnlockMessage} from '../../ui/research-tabs.js';
import {nativeLabArt} from '../../replica/native-collection-art.js';
import {nativeLabView} from '../../replica/native-client-rules.js';
import labOrder from '../../replica/native-lab-presentation.json';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';

const cardArtwork = {updateInPlace:true};

function shadeLockedLabIcon(shader) {
  shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\nfloat labGray = dot(diffuseColor.rgb, vec3(.2126, .7152, .0722));\ndiffuseColor.rgb = vec3(labGray * .36);');
}

function paintLabCard(grid,t,card,campaign,b) {
  const {x,y,w,h}=b,locked=Boolean(researchUnlockMessage(campaign,card));
  const view=nativeLabView(card,campaign),statusY=y+h*.87;
  const faceSize=h*.52;
  const face=pic(grid,t,nativeLabArt(card),box(x+(w-faceSize)/2,y+h*.05,faceSize,faceSize),true,cardArtwork);
  words(grid,card.name,x+w/2,y+h*.676,clamp(w*.12,9,13),{maxWidth:w*.88,outline:'#253745'});

  if(locked||!card.active){
    face.material.onBeforeCompile=shadeLockedLabIcon;
    const lockSize=w*.19;
    pic(grid,t,projectIconUrl('lock'),box(x+w*.73,y+h*.08,lockSize,lockSize),true,cardArtwork);
    words(grid,locked?'未开启':'尚未解锁',x+w/2,statusY,clamp(w*.14,10,14),{maxWidth:w*.88,color:'#e0e8ee',outline:'#253745'});
    return;
  }

  const badgeSize=w*.265,badge=box(x+w*.05,statusY-badgeSize/2,badgeSize,badgeSize);
  pic(grid,t,'/art/project-supplement-icons-v1/grade.png',badge,true,cardArtwork);
  words(grid,card.level,badge.x+badge.w/2,statusY,clamp(badgeSize*.54,10,16),{weight:800,maxWidth:badge.w*.68});

  const barHeight=h*.14,bar=box(x+w*.35,statusY-barHeight/2,w*.59,barHeight);
  const material=view.currentCosts.find(cost=>cost.id>=801&&cost.id<=811);
  const ratio=view.maxed?1:Math.min(1,(material?.available||0)/Math.max(1,material?.count||0));
  grid.panel(bar.x,bar.y,bar.w,bar.h,{fill:'#424747',stroke:'#17222b',opacity:1,radius:3});
  if(ratio>0)grid.panel(bar.x+1,bar.y+1,(bar.w-2)*ratio,bar.h-2,{fill:'#7bba37',stroke:null,opacity:1,radius:2});
  const label=card.needActive?'待激活':view.maxed?'MAX':compact(material?.available||0)+'/'+(material?.count||0);
  words(grid,label,bar.x+bar.w/2,statusY,clamp(w*.125,9,14),{maxWidth:bar.w-4,outline:'#24313b'});

  if(view.canActivate||view.canUpgrade){
    const dot=Math.max(5,w*.075);
    grid.panel(x+w*.94-dot,y+h*.06,dot,dot,{fill:'#ff586c',stroke:'#401c2b',radius:dot/2});
  }
}

export function researchMenu(data,w,h,t,chrome){
  const s=data.snapshot,r=s.research,lab=data.section==='lab',u=w/369.453,banner=Math.max(44,w*.11),top=chrome.top;
  const controls=t.layer('talent-tabs').art;
  for(const [i,[id,label]] of (researchUnlockMessage(s.replicaCampaign)?[['talent','天赋']]:[['talent','天赋'],['lab','科研']]).entries()){
    const b=box(w*.02+i*w*.29,top,w*.28,banner),active=id===(lab?'lab':'talent');
    pic(controls,t,'/art/psd-page-chrome-v1/'+(active?'chapter-face.png':'chapter-idle.png'),box(b.x,b.y+banner*.125,b.w,banner*.72),false,chrome.artwork);
    words(controls,label,b.x+b.w/2,b.y+b.h/2,15*u,{family:titleFont});
    area(t,'research-'+id,label,b,'researchSection',{section:id});
  }
  const right=box(w*.76,top,w*.22,banner);
  if(lab)button(controls,t,box(right.x,top+banner*.125,right.w,banner*.75),{title:'出击属性',titleSize:clamp(w*.03,10,15)});
  else words(controls,'总加成 '+(r?.owned||0)+'/'+(r?.cards.length||0),right.x+right.w/2,top+banner/2,10*u,{weight:700});
  area(t,'summary',lab?'出击属性':'总加成',right,lab?'nativeStats':'researchSummary');
  if(!r&&!lab){words(controls,'科技暂不可用',w/2,top+banner+30,14);return;}
  const progress=!lab&&!r.native&&!r.allFinished&&!r.aceFinished&&r.refining,foot=48+2*w*.02+(progress?24:0)+(s.storageWarning?18:0);
  const gy=top+banner,gyEnd=chrome.navY-4*u-(lab?0:foot),margin=w*.02,gap=w*.015,gapY=w*.02;
  const width=(w-margin*2-gap*3)/4,height=width*(lab?296/216:4/3);
  const items=lab?[...(s.replicaCollection?.labs||[])].sort((a,b)=>Number(b.active)-Number(a.active)||labOrder[b.id].sort-labOrder[a.id].sort):[...r.cards].sort((a,b)=>Number(b.owned)-Number(a.owned));
  const zone=lab?'labs':'talents',grid=t.layer(zone,zone).art,rect=box(0,gy,w,gyEnd-gy);
  const step=height+gapY,windowed=data.prioritizedArtwork&&!lab;
  t.region(zone,rect,margin*2+Math.ceil(items.length/4)*step-gapY,'y',{redrawStep:windowed?step:0});
  const visibleCards=windowed?t.scrollWindow(zone):null;
  items.forEach((c,i)=>{
    const x=margin+(i%4)*(width+gap),y=gy+margin+Math.floor(i/4)*step,b=box(x,y,width,height);
    if(!lab&&c.owned)area(t,'talent-'+c.id,c.name,b,'researchCard',{id:c.id},zone);
    if(visibleCards&&(b.y+b.h<=visibleCards.top||b.y>=visibleCards.bottom))return;
    if(!lab&&!c.owned){pic(grid,t,art['unknown-talent'],b,false,cardArtwork);return;}
    const rank=lab?0:researchCardQuality(c.quality);
    slice(grid,t,qualityFrame(rank),b,clamp(w*.028,9,13),18,cardArtwork);
    if(lab){
      paintLabCard(grid,t,c,s.replicaCampaign,b);
      area(t,'lab-'+c.id,c.name,b,'nativeLab',{id:c.id},zone);
    }else{
      pic(grid,t,researchArt(c.icon),box(x+width*.04,y+height*.05,width*.92,height*.70),true,cardArtwork);
      words(grid,c.name,x+width/2,y+height*.77,clamp(w*.0265,9,12),{maxWidth:width*.9});
      words(grid,c.maxed?'MAX':'Lv.'+c.level,x+width/2,y+height*.884,clamp(w*.032,11,15),{color:'#ffe58a',maxWidth:width*.9});
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
    button(footArt,t,b,{title,price:cost,icon,gold:!normal,short,disabled:!can,artwork:chrome.artwork});
    area(t,'draw-'+pool,title,b,'researchDraw',{pool,revision:r.revision,resourceShort:short?(normal?'金币':'星核'):null},null,!can&&!short);
  }
  if(s.storageWarning)words(footArt,s.storageWarning,w/2,y+59,11,{color:'#ffd4b7'});
}

