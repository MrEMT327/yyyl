import {area,box,clamp,words} from './menu-art.js';
import {outerFrame,groupMotion,label,heading,submit,inset,glyph,countUp,reveal} from './feedback-art.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {equipmentArtPath} from '../../replica/equipment-art.js';
import {mergeFeedbackFeatures} from '../../ui/process-feedback-model.js';

export function mergeItem(item){
  return {type:'gear',id:item.nativeId??item.family+item.quality,name:item.name,image:'/'+equipmentArtPath(item.art),
    qualityRank:Math.max(0,Math.floor(item.quality/10)-1),showQuantity:false,amount:1};
}
function gear(a,t,item,b,w,quantity=false){
  paintRewardItemSlot(a,{...mergeItem(item),showQuantity:quantity},{x:b.x,y:b.y,size:b.w},t.image);
  if(!quantity&&Number.isFinite(item.level))label(a,'Lv.'+item.level,b.x+b.w/2,b.y+b.h*.98-.021*w,.035*w,{color:'#eef6fb',shadow:{color:'#243b4f',y:1,blur:2}});
}
export function mergeFeedback(data,w,h,t){
  const record=data.record,batch=record.type==='mergeBatch'&&record.results.length>1,pair=record.results[0],features=mergeFeedbackFeatures(pair);
  const pw=w*.90,bw=pw-w*.14,gap=.03*w,tile=(bw-2*gap)/3,fs=clamp(.034*w,12,16),th=tile+.015*w+2.8*fs;
  const maxCols=3,rows=Math.ceil(record.results.length/maxCols);
  const gridH=rows*th+(rows-1)*.04*w;
  const featureH=features.length?Math.max(.09*w,.04*w+features.length*.05*w)+.02*w:0;
  const bodyH=batch?gridH:.36*w+.01*w+.0611*w+.04*w+.10*w+featureH;
  const header=w*(batch ? .15 : .14),footer=.10*w+48;
  const ph=Math.min(h*.86,header+Math.min(bodyH,batch?h*.57:bodyH)+footer),p=box((w-pw)/2,(h-ph)/2,pw,ph);
  const paper=t.layer('merge-paper').art,zone='base',a=t.layer('merge-body',zone).art,buttons=t.layer('merge-confirm').art;
  const part=(b,draw,tr)=>groupMotion(t,a,p,data,b,draw,tr),x=p.x+.07*w,top=p.y+header,bh=ph-header-footer;
  area(t,'paper','',p,'none');groupMotion(t,paper,p,data,p,()=>{outerFrame(paper,t,p,w,'merge');heading(paper,t,p,w,'合成成功');});
  t.region(zone,box(x-.01*w,top,bw+.02*w,bh),bodyH);
  if(batch){
    record.results.forEach(({after},i)=>{
      const tx=x+(i%3)*(tile+gap),ty=top+Math.floor(i/3)*(th+.04*w),b=box(tx,ty,tile,th);
      part(b,()=>{gear(a,t,after,box(tx,ty,tile,tile),w,true);
        words(a,after.name,tx+tile/2,ty+tile+.015*w+.7*fs,fs,{weight:700,color:'#17364e',maxWidth:tile,wrap:true,lineHeight:1.4*fs});
      },{delay:.16+i*.075,duration:.34,curve:[.2,.7,.25,1],frames:[{at:0,y:16,scale:.8,opacity:0},{at:1}]});
      area(t,'merge-item-'+i,'查看'+after.name,box(tx,ty,tile,tile),'inspect',{index:i},zone);
    });
  }else{
    const cy=top+.18*w,slot=box(w/2-.14*w,cy-.14*w,.28*w,.28*w),materials=record.materials?.slice(0,3)||[];
    if(!data.reduced)materials.forEach((item,i)=>{
      const b=box(w/2-.07*w,cy-.07*w,.14*w,.14*w),dx=materials.length===1?0:(i/(materials.length-1)-.5)*.48*w;
      part(b,()=>gear(a,t,item,b,w),{delay:.06+i*.045,duration:.42,frames:[
        {at:0,x:dx,y:.06*w,scale:.9,opacity:0},{at:.18,x:.82*dx,y:.0492*w,scale:.855,opacity:.9},
        {at:.7,x:.3*dx,y:.018*w,scale:.725,opacity:.8},{at:1,scale:.65,opacity:0}]});
    });
    part(slot,()=>gear(a,t,pair.after,slot,w),{delay:.38,duration:.38,frames:[{at:0,scale:.92,opacity:0},{at:.65,scale:1.035},{at:1}]});
    area(t,'merge-item-0','查看'+pair.after.name,slot,'inspect',{index:0},zone);
    const name=box(x,top+.37*w,bw,.0611*w);
    part(name,()=>label(a,pair.after.name,w/2,name.y+name.h/2,.047*w,{weight:700,color:'#17364e'}),{delay:.5,duration:.28,frames:reveal(w)});
    const b=box(x,name.y+name.h+.04*w,bw,.10*w),ry=b.y+b.h/2,rx=b.x+bw-.04*w;
    part(b,()=>{inset(a,t,b,w);label(a,pair.after.attributeName,b.x+.04*w-2,ry,.033*w,{align:'left'});
      label(a,'+'+pair.before.attribute,rx-.22*w,ry,.033*w,{align:'right',color:'#e6f0f5'});
      glyph(a,t,'equipment-upgrade',box(rx-.195*w,ry-.02*w,.04*w,.04*w)).rotation.z=Math.PI/2;
      countUp(t,data,pair.before.attribute,pair.after.attribute,.60,.45,v=>label(a,(v>=0?'+':'')+v,rx+2,ry,.04*w,{weight:700,align:'right',color:'#82edbc'}));
    },{delay:.6,duration:.45,frames:reveal(w)});
    if(features.length){
      const fb=box(x,b.y+b.h+.02*w,bw,featureH-.02*w);
      part(fb,()=>{inset(a,t,fb,w);features.forEach((s,i)=>{const y=fb.y+fb.h/2+(i-(features.length-1)/2)*.05*w;
        glyph(a,t,'check',box(x+.04*w,y-.02*w,.04*w,.04*w));label(a,s,x+.10*w-2,y,.035*w,{align:'left',maxWidth:bw-.14*w,color:'#fff0c5'});});
      },{delay:.6,duration:.45,frames:reveal(w)});
    }
  }
  const b=box(w*.32,p.y+ph-.05*w-48,w*.36,48);groupMotion(t,buttons,p,data,b,()=>submit(buttons,t,b,w,'确定','close'));
}
