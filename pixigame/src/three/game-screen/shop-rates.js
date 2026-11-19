import {area,box,clamp,titleFont,words} from './menu-art.js';
import {paintLobbyPaper} from './panel-paper.js';
import {paintRewardItemSlot} from '../../ui/reward-item-slot.js';
import {boxRewardGroups,percent} from '../../ui/shop-box-presentation.js';
import {pendingNotice} from './chapter-rewards.js';

export function shopRates(data,w,h,t){
  const u=w/750,pw=.90*w,x=(w-pw)/2+40*u,bw=pw-80*u,gap=w<=350?4:6,rowGap=w<=350?8:9;
  const side=(bw-10-gap*4)/5,font=clamp(.033*w,11,15),rowH=side+3+font*1.2;
  const heading=clamp(.04*w,16,20),headH=18+heading*1.5;
  const groups=boxRewardGroups(data.equipmentBox).map(g=>{
    const rows=Math.ceil(g.items.length/5);return {...g,height:headH+18+rows*rowH+Math.max(0,rows-1)*rowGap};
  });
  const noticeH=data.snapshot.rewardPending||data.snapshot.rewardBusy?42:0;
  const missing=!data.equipmentBox,extent=noticeH+(missing?24:groups.reduce((n,g)=>n+g.height+10,0));
  const header=125*u,ph=Math.min((h-.10*w)*.88,header+52*u+extent);
  const paper=paintLobbyPaper(t,{...data,backdropAlpha:.55},w,h,pw,ph,header,missing?'装备宝箱':'概率详情',data.paper);
  const clip=box(x-12*u,paper.top,bw+24*u,ph-header-40*u);
  t.region('base',clip,extent+12*u,'y',{parent:'shop-room',redrawStep:36});
  const a=t.layer('box-loot','base').art,visibleTop=paper.top+t.offset('base')-70,visibleBottom=visibleTop+clip.h+140;
  let y=paper.top+pendingNotice(data.snapshot,a,t,w,x,paper.top,bw,'base');
  if(missing){words(a,'价格暂未同步，请稍后重试。',x,y+12,13,{align:'left',color:'#172c40'});return;}
  a.quad(x,y,bw,Math.max(1,extent-noticeH-10),'#b6c8d9');
  for(const [groupIndex,g] of groups.entries()){
    if(y+g.height>=visibleTop&&y<=visibleBottom){
      a.quad(x,y,bw,g.height,'#d6e3ec');a.quad(x,y,bw,headH,'#203d56');a.quad(x,y,3,headH,'#65b3d3');
      words(a,g.name,x+8,y+headH/2,heading,{align:'left',family:titleFont,color:'#f1f6fc',maxWidth:bw-105});
      const label=words(a,percent(g.weight,g.denominator),x+bw-5,y+headH/2,clamp(.033*w,12,15),{align:'right',color:'#d9f1ff',weight:700});
      words(a,'基础概率 ',x+bw-4-label.scale.x,y+headH/2+1,clamp(.033*w,12,15)*.85,{align:'right',color:'#d9f1ff',weight:500});
    }
    for(const [i,item] of g.items.entries()){
      const left=x+5+(i%5)*(side+gap),top=y+headH+10+Math.floor(i/5)*(rowH+rowGap);
      const chance=percent(item.weight,g.denominator);
      if(top+rowH>=visibleTop&&top<=visibleBottom){
        paintRewardItemSlot(a,{...item,amount:item.count},{x:left,y:top,size:side},t.image);
        words(a,chance,left+side/2,top+side+3+font*.6,font,{color:'#16364d',weight:800});
      }
      area(t,'rate-'+groupIndex+'-'+item.id,item.name+'，基础掉落概率 '+chance,box(left,top,side,side),'inspect',{itemId:item.id},'base');
    }
    y+=g.height+10;
  }
}

