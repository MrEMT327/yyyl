import {area,box,fmt,pic,slice,titleFont,words} from './menu-art.js';
import {equipmentBox} from '../../ui/shop-page.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';

export function boxActions(modal,snapshot){
  if(modal.history||!modal.pool)return [];
  const box=equipmentBox(snapshot,modal.pool);
  if(!box)return [];
  return (modal.count===10?[0,10]:[1,10]).flatMap(count=>{
    if(!count)return [{count,title:'确定'}];
    const q=box.quotes?.find(row=>row.count===count);
    if(!q)return [];
    const price=q.payment==='free'?'免费开启':fmt(q.amount);
    const icon=q.payment==='free'?null:q.payment==='key'?nativeItemArt(q.itemId):RESOURCE_ICONS.diamonds.url;
    return [{count,title:(modal.count===10?'再开':'开启')+count+'次',price,icon,disabled:!q.canDraw||Boolean(snapshot.rewardBusy||snapshot.rewardPending)}];
  });
}
export function paintBoxActions(a,t,w,x,y,bw,pool,actions){
  const gap=w*.04,h=Math.max(48,.12*w),width=(bw-(actions.length-1)*gap)/actions.length;
  actions.forEach(({title,count,price,icon,disabled},i)=>{
    const b=box(x+i*(width+gap),y,width,h),cx=b.x+width/2,sz=w*.044,small=w*.033,ih=w*.034;
    const plate=slice(a,t,count===10?'/art/psd-equipment-v1/button-gold.png':'/art/psd-buttons-v1/button-blue.png',b,w*.025);
    if(disabled)plate.material.color.setRGB(.38,.38,.38);
    const color=disabled?'#bac8d2':'#edf4f7',line=price==null?0:1.2*small+w*.005,mid=y+h/2;
    words(a,title,cx,mid-line/2,sz,{family:titleFont,color,maxWidth:width-8});
    if(price!=null){
      const offset=icon?(ih+.01*w)/2:0,py=mid+(1.2*sz+.005*w)/2;
      const label=words(a,price,cx+offset,py,small,{family:titleFont,color,maxWidth:width-2*offset-8});
      if(icon)pic(a,t,icon,box(label.position.x-label.scale.x/2+2-ih-.01*w,py-ih/2,ih,ih),true);
    }
    area(t,count?'again-'+count:'confirm',title,b,count?'processBoxAgain':'close',count?{pool,count}:{},'base',disabled);
  });
}
