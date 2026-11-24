import {createLobbyPanel} from './lobby-panel.js';
import {area,box,pic,words,slice,clamp,titleFont,fmt} from './menu-art.js';
import {paintLobbyPaper,paintSecondaryPaper} from './panel-paper.js';
import {shopRates} from './shop-rates.js';
import {paintItemDetail} from './item-details.js';
import {pendingNotice} from './chapter-rewards.js';
import {shopProductImage} from './menu-shop.js';
import {shopOfferName,shopItemId,shopPurchaseMax,equipmentBox} from '../../ui/shop-offer-model.js';
import {STAMINA_RECOVERY_DESCRIPTION} from '../../peripheral/config.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {availabilityMessage} from '../../ui/resource-availability.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';

const ink='#243f54',actions={stamina:'体力补给',shopConfirm:'确认兑换',shopBoxRates:'概率详情',shopBoxConfirm:'装备宝箱'};
const busy=s=>Boolean(s.rewardPending||s.rewardBusy);
export const supportsShopPanel=type=>Object.hasOwn(actions,type);
const resource=id=>RESOURCE_ICONS[id]?.url;
function action(a,t,b,id,text,cmd,data={},opts={}){
  const {gold=false,disabled=false,icon,iw=0,ih=iw,gap=0,size=14,corner=9,aria=text}=opts;
  const m=slice(a,t,gold?'/art/psd-equipment-v1/button-gold.png':'/art/psd-buttons-v1/button-blue.png',b,corner);
  if(disabled)m.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\nvec3 c=sRGBTransferOETF(diffuseColor).rgb;float gray=dot(c,vec3(.2126,.7152,.0722))*.65;diffuseColor.rgb=sRGBTransferEOTF(vec4(vec3(gray),1.)).rgb;');};
  const label=words(a,text,b.x+b.w/2+(iw+gap)/2,b.y+b.h/2,size,{weight:600,color:disabled?'#bac8d2':'#edf4f7',maxWidth:Math.max(10,b.w-iw-gap-3)});
  if(icon)pic(a,t,icon,box(label.position.x-label.scale.x/2+2-gap-iw,b.y+(b.h-ih)/2,iw,ih),true);
  area(t,id,aria,b,cmd,data,'base',disabled);
}
function wrapText(a,text,width,size,opts={}){
  const lineHeight=opts.lineHeight||1.5*size;
  const m=words(a,text,0,0,size,{color:ink,weight:400,align:'left',maxWidth:width,wrap:true,lineHeight,...opts});
  return {m,height:m.userData.uiTextLines.length*lineHeight,place(x,y){m.position.x+=x-2;m.position.y=y+this.height/2;}};
}
function column(t,pw,w,h,header,extent,kind,title,data){
  const u=w/750,exchange=kind==='shopConfirm',bottom=(exchange?22:40)*u,padding=(exchange?6:12)*u;
  const ph=Math.min((h-.1*w)*.86,header+bottom+extent+padding);
  const paper=paintSecondaryPaper(t,w,h,pw,ph,title,{header,inkY:(header+(exchange?10:14)*u)/2,alpha:.6,a:data.paper});
  const x=paper.x+40*u,bw=pw-80*u;
  t.region('base',box(x-12*u,paper.top,bw+24*u,Math.max(1,ph-header-bottom)),extent+padding,'y',{parent:'shop-room'});
  return {x,bw,y:paper.top,visibleBody:ph-header-bottom-padding};
}
function stamina(data,w,h,t){
  const s=data.snapshot,u=w/750,pw=w*.88,header=112*u,bw=pw-80*u-16,offers=s.shop?.items?.filter(o=>o.section==='stamina')||[];
  const measure=t.layer('stamina-copy','base').art,desc=wrapText(measure,STAMINA_RECOVERY_DESCRIPTION,bw,13);
  const buttonH=Math.max(44,85*u),rowH=25+Math.max(buttonH,45.5),notice=busy(s)?42:0;
  const rows=offers.map(o=>({o,hint:!o.available?wrapText(measure,availabilityMessage(o.reason),bw,11,{color:'#526d7d'}):null}));
  const extent=notice+10+45+14+desc.height+9+rows.reduce((n,{hint})=>n+rowH+(hint?18+hint.height:0),0)+12;
  const {x:ox,y}=column(t,pw,w,h,header,extent,'stamina',actions.stamina,data);
  const a=t.layer('stamina-offers','base').art,x=ox+8,half=(bw-12)/2;
  let sy=y+pendingNotice(s,a,t,w,ox,y,bw+16,'base')+10;
  const label=words(a,fmt(s.wallet.stamina)+' / '+fmt(s.wallet.maxStamina??s.wallet.staminaMax),w/2+22,sy+22.5,23,{family:titleFont,color:'#303039'});
  const icon=box(label.position.x-label.scale.x/2+2-44,sy,32,45);
  pic(a,t,resource('stamina'),icon,true);area(t,'stamina-item','查看体力详情',icon,'inspect',{itemId:4},'base');
  sy+=59;desc.place(x,sy);sy+=desc.height+9;
  for(const {o,hint} of rows){
    a.quad(x,sy,bw,1,'#7e9cad');const cy=sy+1+(rowH-1)/2,ad=o.cost.type==='ad';
    words(a,'体力 ×'+fmt(o.reward.stamina),x-2,cy-10.75,16,{align:'left',weight:700,color:ink});
    words(a,o.unlimited?'不限次数':'剩余 '+fmt(o.remaining)+'/'+fmt(o.limit),x-2,cy+14.5,11,{align:'left',weight:400,color:'#526d7d'});
    const b=box(x+half+12,cy-buttonH/2,half,buttonH);
    action(a,t,b,'offer-'+o.id,ad?'广告领取':fmt(o.cost.amount),'shopOffer',{id:o.id},{gold:true,disabled:busy(s)||!o.available,
      icon:ad?'/art/project-advertising-v2/ad-video.png':resource('diamonds'),iw:15,ih:ad?15:19,gap:3,size:clamp(.034*w,12,17),aria:ad?'广告领取体力':'消耗'+fmt(o.cost.amount)+'钻石兑换体力'});
    sy+=rowH;if(hint){hint.place(x,sy+9);sy+=18+hint.height;}
  }
}
function exchange(data,w,h,t){
  const s=data.snapshot,m=data.modal,u=w/750,pw=Math.min(.9*w,Math.max(.84*w,230),520),o=s.shop?.items?.find(r=>r.id===m.id);
  const bw=pw-80*u,header=92*u,notice=busy(s)?42:0;
  if(!o){const {x,y}=column(t,pw,w,h,header,notice+23,'shopConfirm','商品已更新',data),a=t.layer('updated','base').art;
    const dy=pendingNotice(s,a,t,w,x,y,bw,'base');words(a,'请关闭后重新选择。',x,y+dy+12,14,{align:'left',color:ink});return;}
  const max=shopPurchaseMax(o,s.wallet),count=clamp(m.quantity||1,1,Math.max(1,max)),withQuantity=o.maxQuantity>1;
  const [type,amount]=Object.entries(o.reward)[0],cost=o.cost.amount*count,pad=clamp(.02*w,8,14),iw=bw-2*pad,side=iw*.29;
  const a=t.layer('exchange-product','base').art,body=t.layer('exchange-text','base').art;
  const font=clamp(.041*w,17,22),qFont=clamp(.035*w,14,18);
  const name=wrapText(body,shopOfferName(o),iw*.67,font,{family:titleFont,color:'#303039'}),copyH=name.height+4+qFont*1.25;
  const line=Math.max(side,copyH),buttonH=Math.max(44,85*u),primaryH=Math.max(48,92*u),gap=clamp(.02*w,10,16);
  const tileH=Math.max(withQuantity?pw*.42:0,2*pad+line+(withQuantity?pad+buttonH:0)),bodyH=3+tileH+gap+primaryH+5;
  const extent=notice+Math.max(bodyH,withQuantity?pw*.818-header-28*u:0);
  const {x,y,visibleBody}=column(t,pw,w,h,header,extent,'shopConfirm',actions.shopConfirm,data);
  const sy=y+pendingNotice(s,a,t,w,x,y,bw,'base')+3;
  a.quad(x,sy,bw,tileH,'#d9e3ed',.72);
  const bx=x+pad,by=sy+pad+(line-side)/2,cx=bx+side+iw*.04,ty=sy+pad+(line-copyH)/2;
  slice(a,t,'/art/psd-equipment-v1/frame-blue.png',box(bx,by,side,side),clamp(pw*.035,8,16));
  const product=shopProductImage(type,amount);pic(a,t,product,box(bx+side*.1,by+side*.1,side*.8,side*.8),true);
  area(t,'product','查看'+shopOfferName(o)+'详情',box(bx,by,side,side),'inspect',{itemId:shopItemId(type),image:product},'base');
  name.place(cx,ty);words(body,'×'+fmt(amount*count),cx-2,ty+name.height+4+qFont*.625,qFont,{align:'left',weight:700,color:'#294b66'});
  if(withQuantity){
    const qw=w<=340?iw:iw*.76,qGap=w<=340?2:clamp(.008*w,2,6),maxW=48,outW=Math.max(w<=340?16:24,qw-2*buttonH-maxW-3*qGap);
    const sx=bx+iw-qw,top=sy+tileH-pad-buttonH;
    action(a,t,box(sx,top,buttonH,buttonH),'less','−','shopQuantity',{step:'-1'},{size:24,disabled:count<=1,aria:'减少数量'});
    const ox=sx+buttonH+qGap;a.quad(ox,top,outW,buttonH,'#b8c8d6');words(a,count,ox+outW/2,top+buttonH/2,clamp(.037*w,15,19),{color:'#203c50',weight:600});
    action(a,t,box(ox+outW+qGap,top,buttonH,buttonH),'more','＋','shopQuantity',{step:'1'},{size:24,disabled:count>=max,aria:'增加数量'});
    action(a,t,box(ox+outW+2*qGap+buttonH,top,maxW,buttonH),'max','MAX','shopQuantity',{step:'max'},{size:clamp(.03*w,12,15),disabled:count>=max,aria:'最大数量'});
  }
  const width=Math.min(bw,Math.max(160,.38*w)),fy=Math.max(sy+tileH+gap,y+visibleBody-primaryH-5);
  action(a,t,box((w-width)/2,fy,width,primaryH),'pay',fmt(cost),'shopConfirm',{id:o.id},{gold:true,icon:resource(o.cost.type),
    iw:clamp(.04*w,19,25),ih:clamp(.05*w,24,31),gap:8,size:clamp(.038*w,16,20),aria:'确认兑换，消耗'+fmt(cost)+(o.cost.type==='diamonds'?'钻石':'金币'),
    disabled:busy(s)||m.token!=null&&m.token!==s.shop.token||!o.available||count>max});
}
function boxConfirm(data,w,h,t){
  const s=data.snapshot,m=data.modal,chest=data.equipmentBox,q=chest?.quotes?.find(r=>r.count===(m.count===10?10:1));
  const u=w/750,pw=.9*w,bw=pw-80*u,head=125*u,title=q?'开启'+chest.name:'装备宝箱';
  const stale=q&&(m.revision!==s.equipment.revision||m.inventoryRevision!==s.nativeAcquisition.revision),msg=stale?'库存已更新，请关闭后重新确认':m.error;
  const a=t.layer('box-order','base').art,surface=t.layer('box-copy','base').art,unavailable=chest&&!chest.canDraw?wrapText(surface,chest.unavailableReason,bw-16,13):null;
  const error=msg?wrapText(surface,msg,bw-32,13,{color:'#8d303c'}):null;
  const bH=Math.max(48,92*u),notice=busy(s)?42:0;
  const extent=notice+(q?15+20+(unavailable?9+unavailable.height:0)+(error?21+error.height:0)+16+bH+12:23);
  const ph=Math.min((h-.1*w)*.86,head+extent+52*u),p=paintLobbyPaper(t,{...data,backdropAlpha:.55},w,h,pw,ph,head,title,data.paper);
  const x=p.x+40*u,y=p.top;
  t.region('base',box(x-12*u,y,bw+24*u,ph-head-40*u),extent+12*u,'y',{parent:'shop-room'});
  let sy=y+pendingNotice(s,a,t,w,x,y,bw,'base');
  if(!q){words(a,'价格暂未同步，请稍后重试。',x,sy+12,13,{align:'left',weight:400,color:ink});return;}
  const ix=x+8,iw=bw-16;sy+=15;
  if(q.payment==='free')words(a,'免费开启',w/2,sy+10,13,{weight:400,color:ink});
  else{
    const ico=q.payment==='key'?nativeItemArt(q.itemId):resource('diamonds'),left=words(a,'是否消耗 ',0,sy+10,13,{color:ink,weight:400});
    const price=words(a,q.amount==null?'—':fmt(q.amount),0,sy+10,13,{color:ink,weight:700}),right=words(a,' 开启'+q.count+'次？',0,sy+10,13,{color:ink,weight:400});
    let cx=(w-(left.scale.x+price.scale.x+right.scale.x-12+15+3))/2;
    for(const m of [left,price,right]){if(m===price){pic(a,t,ico,box(cx,sy,15,19),true);cx+=18;}m.position.x=cx+(m.scale.x-4)/2;cx+=m.scale.x-4;}
  }
  sy+=20;if(unavailable){unavailable.place(ix,sy+9);sy+=unavailable.height+9;}
  if(error){sy+=9;a.quad(ix,sy,iw,error.height+12,'#e0c6c7');error.place(ix+8,sy+6);sy+=error.height+12;}
  const gap=8,side=(iw-gap)/2;sy+=16;
  action(a,t,box(ix,sy,side,bH),'cancel','取消','close',{},{});action(a,t,box(ix+side+gap,sy,side,bH),'open-box','确认开启','shopBoxOpen',{},
    {gold:true,disabled:busy(s)||stale||!q.canDraw});
}

export function openShopPanel(screen,host,send,kind){
  let latest,inspect=null;
  const panel=createLobbyPanel(screen,host,actions[kind],(d,w,h,t)=>{
    const contentHeight=Math.max(0,h-w*151/750-d.safeBottom);t.region('shop-room',box(0,0,w,contentHeight),contentHeight);
    const data={...d,paper:t.layer('shop-paper','shop-room').art};
    if(kind==='stamina')stamina(data,w,h,t);else if(kind==='shopConfirm')exchange(data,w,h,t);
    else if(kind==='shopBoxRates')shopRates(data,w,h,t);else boxConfirm(data,w,h,t);
    if(inspect){paintItemDetail({...data,inspect},w,h,t);return 'inspect';}return 'base';
  },cmd=>{
    if(cmd.type==='inspect'){inspect=cmd.data;panel.scroll('inspect',0);refresh();return;}
    if(inspect&&cmd.type==='close'){inspect=null;refresh();return;}
    if(cmd.type!=='none')send(cmd.type,cmd.data||{},host);
  });
  function refresh(){panel.update(latest,[latest.signature,latest.modal.id,latest.modal.pool,latest.modal.count,latest.modal.quantity,latest.modal.error,inspect?.itemId].join('|'),kind);}
  return {host,close:panel.close,update(snapshot,modal,signature){
    latest={snapshot,modal:{...modal},signature,equipmentBox:equipmentBox(snapshot,modal.pool),safeBottom:screen.menuView?.safeBottom||0};
    refresh();
  }};
}

