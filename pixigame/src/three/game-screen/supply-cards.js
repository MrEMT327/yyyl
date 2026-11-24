import {box,button,fmt,words} from './menu-art.js';
import {normalFit} from './catalog-art.js';
import {nativeItemArt,nativeItemPresentation} from '../../replica/native-item-presentation.js';
export const label=(r,s)=>r.text(s,{size:16,lineHeight:24,weight:700,color:'#20394d',pad:4});
export function actions(r,entries,columns=entries.length){
  if(!entries.length)return;
  r.grid(entries,columns,(a,b,entry,show)=>{if(show)button(a,r.t,b,{title:entry.label,titleSize:14,gold:entry.gold,disabled:entry.disabled,titleColor:entry.disabled?'#bac8d2':'#edf5fa'});
    return entry;},{height:44});r.gap(6);
}
export const hit=(id,label,cmd,data={},disabled=false,gold=false)=>({id,label,cmd,data,disabled,gold});
export function meter(r,n,total=100){
  r.custom(15,(a,b)=>{const ratio=Math.max(0,Math.min(1,total>0?n/total:0));a.quad(b.x,b.y+4,b.w,7,'#6f8a9e');a.quad(b.x+1,b.y+5,b.w-2,5,'#afc4d1');if(ratio)a.quad(b.x+1,b.y+5,(b.w-2)*ratio,5,'#377893');});
}
export function rewards(r,rows,group){
  if(!rows?.length)return;
  r.grid(rows,Math.min(3,rows.length),(a,b,row,visible)=>{
    const item=row.id??row.itemId,n=row.count??row.amount??1,name=row.name||nativeItemPresentation(item).name;
    if(visible){normalFit(a,r.t,row.image||nativeItemArt(item),box(b.x,b.y+2,34,34));words(a,'×'+fmt(n),b.x+35,b.y+16,14,{align:'left',color:'#233e51',maxWidth:b.w-32});if(row.label)words(a,row.label,b.x+34,b.y+32,10,{align:'left',color:'#526d7e',maxWidth:b.w-32});}
    return hit(group+'-'+item,name,'inspect',{itemId:item});},{height:39,gap:5});r.gap(5);
}
export function notice(r,s){
  if(s.rewardPending||s.rewardBusy){r.text(s.rewardPending?'已有奖励待保存':'奖励正在处理，请稍候',{weight:700,color:'#895a2e',pad:4});
    if(s.rewardPending)actions(r,[hit('save','重试保存','recoverDailyRewards',{},s.rewardBusy)]);}
}
export function headingValue(r,title,value){
  r.custom(36,(a,b)=>{words(a,title,b.x,b.y+18,16,{align:'left',weight:700,color:'#20394e',maxWidth:b.w*.7});
    words(a,value,b.x+b.w,b.y+18,14,{align:'right',weight:700,color:'#385d76',maxWidth:b.w*.45});});
}

