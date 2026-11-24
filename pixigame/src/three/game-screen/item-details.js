import {box,pic,words,titleFont,clamp} from './menu-art.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {itemDescriptionModel} from '../../ui/item-description-model.js';
import {paintPsdPopup,preparePsdPopupArt} from '../../ui/psd-popup-art.js';

export function paintItemDetail(data,w,h,t){
  const model=itemDescriptionModel(data.inspect,data.snapshot),pw=w*.88,x=(w-pw)/2,ix=x+.05*w,bw=pw-.1*w;
  const art=t.layer('inspection-frame').art,content=t.layer('inspection-body','inspect').art;
  const size=clamp(w*.038,13,18),lineH=size*1.65;
  const desc=words(content,model.description,ix,0,size,{align:'left',color:'#20394f',weight:400,maxWidth:bw,wrap:true,lineHeight:lineH});
  const textH=desc.userData.uiTextLines.length*lineH,bodyH=Math.max(.26*w,Math.min(h*.4,.04*w+textH));
  const header=112*w/750,ph=Math.min(h*.86,header+.24*w+bodyH+.06*w),y=(h-ph)/2,slotY=y+header,divider=slotY+.24*w;
  t.backdrop(art,.533,'#030b15');
  t.control('inspect-outside','返回',t.frameRect,{type:'close'},{scope:'inspect'});
  t.control('inspect-paper','',box(x,y,pw,ph),{type:'none'},{scope:'inspect'});
  if(!preparePsdPopupArt('secondary'))t.waitForArt();
  paintPsdPopup(art,'secondary',x,y,pw,ph,w/750);
  const f=clamp(32*w/750,16,22);
  words(art,model.name,x+38*w/750,y+39*w/750+f*.575,f,{align:'left',family:titleFont,color:'#1c334c',maxWidth:pw-154*w/750});
  paintRewardItemSlot(art,{...model,showQuantity:false},{x:ix,y:slotY,size:.2*w},t.image);
  const amount=words(art,'持有数量：',ix+.24*w,slotY+.1*w,clamp(.035*w,12,17),{align:'left',color:'#29465c',weight:400});
  words(art,model.count??'—',amount.position.x+amount.scale.x/2-4,slotY+.1*w,clamp(.035*w,12,17),{align:'left',color:'#29465c',weight:700});
  art.quad(ix,divider,bw,1,'#8aa2b5');
  desc.position.y=divider+.04*w+textH/2;
  t.region('inspect',box(ix,divider+1,bw,Math.max(1,ph-(divider-y)-.06*w)),textH+.04*w);
  const sz=Math.max(44,95*w/750),close=box(x+pw+16*w/750-sz,y-21*w/750,sz,sz);
  pic(art,t,'/art/psd-popup-v1/close.png',close,true);t.control('inspect-close','关闭道具详情',close,{type:'close'},{scope:'inspect'});
}
