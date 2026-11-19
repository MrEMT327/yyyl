import {nineSliceGeometry} from '../../ui/nine-slice-geometry.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import art from './menu-art.json';

export {art};
export const box=(x,y,w,h)=>({x,y,w,h});
export const bodyFont='"Microsoft YaHei","PingFang SC",sans-serif',titleFont='PsdPopup,"Microsoft YaHei",sans-serif';
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const fmt=n=>n==null?'—':Number(n).toLocaleString('zh-CN',{useGrouping:false,maximumFractionDigits:1}),compact=n=>n>=1e8?+(n/1e8).toFixed(1)+'亿':n>=1e4?+(n/1e4).toFixed(1)+'万':fmt(n);
export function words(a,value,x,y,size,opts={}){
  return a.text(String(value??''),x,y,{size,weight:opts.family===titleFont?400:600,align:'center',family:bodyFont,...opts});
}
export function pic(a,t,url,b,contain=false){return t.image(a,url,b.x,b.y,b.w,b.h,contain);}
export function slice(a,t,url,b,edge=10,cut=18){
  const m=pic(a,t,url,b),im=m.material.map?.image;
  m.geometry.dispose();m.geometry=nineSliceGeometry(b.w,b.h,im?.width||219,im?.height||85,cut,edge);return m;
}
export function button(a,t,b,{title,price,icon,gold=false,short=false,disabled=false,skin,titleColor='#fff',shortColor='#ffb59a',family=titleFont,titleSize=clamp(b.w*.092,12,17),priceSize=Math.min(14,b.w*.10),priceColor='#fff'}){
  const plate=skin?pic(a,t,skin,b):slice(a,t,gold?'/art/psd-equipment-v1/button-gold.png':'/art/psd-buttons-v1/button-blue.png',b,Math.min(12,b.h*.24));
  if(disabled&&!short&&!skin)plate.material.color.set(0xb5b5b5);
  const cx=b.x+b.w/2;
  words(a,title,cx,b.y+b.h*(price==null ? .50 : .34),titleSize,{family,color:titleColor,maxWidth:b.w-8});
  if(price!=null){
    const size=priceSize,y=b.y+b.h*.70,iconSize=icon?size+3:0;
    const m=words(a,price,cx+iconSize/2,y,size,{color:short?shortColor:priceColor,maxWidth:b.w-iconSize-6,weight:800});
    if(icon)pic(a,t,icon,box(cx-m.scale.x/2-iconSize/2,y-iconSize/2,iconSize,iconSize),true);
  }
}
export const qualityFrame=rank=>'/art/psd-equipment-v1/frame-'+(['gray','green','blue','purple','gold','red'][rank]||'gray')+'.png';
export function area(t,id,label,b,action,data={},zone=null,disabled=false){
  t.control(id,label,b,{type:action,data},{zone,disabled});
}
export function chrome(data,w,h,t){
  const tab=data.tab,s=data.snapshot,u=w/369.453,root=t.layer('room').art;
  pic(root,t,art[tab+'-background'],box(0,0,w,h));
  const railH=w*151/750+(data.safeBottom||0),navY=h-railH;
  const title=t.layer('heading').art;
  const heading=box(w*.02,4*u,w*.33,44*u);
  if(tab==='supply'&&data.fleetReturnKind){
    const label='← 返回'+(data.fleetReturnKind==='aircraft'?'战机':'驾驶员');
    words(title,label,heading.x+4*u,heading.y+heading.h/2,13*u,{align:'left',color:'#e9f5ff'});
    area(t,'fleet-return',label,heading,'fleetSupplyBack');
  }else pic(title,t,art[tab+'-heading'],heading);
  resourceBar(t,title,s,w);
  return {top:tab==='assembly'?w*.125:Math.max(12,w*.0325)+w*(tab==='supply' ? .125 : .1805),navY,
    footer(){
      const front=t.layer('footer').art;pic(front,t,art[tab+'-footer'],box(0,navY,w,railH));
      let x=0;for(const [key,label] of [['shop','商城'],['assembly','装备'],['battle','战役'],['research','天赋'],['supply','招募']]){
        const width=w*(key===tab ? .2506 : .18735);
        area(t,'nav-'+key,label,box(x,navY,width,railH),'tab',{tab:key});x+=width;
      }
    }};
}
export function resourceBar(t,title,s,w){
  for(const [i,id] of ['stamina','coins','diamonds'].entries()){
    const x=(234+i*170)*w/750,y=46*w/750,b=box(x,y,163*w/750,46*w/750);
    const icons=[[253,47,30,44],[422,48,34,42],[601,50,20,39]],p=icons[i].map(n=>n*w/750);
    pic(title,t,'/art/psd-main-v1/resources/'+id+'-background.png',b);
    pic(title,t,RESOURCE_ICONS[id].url,box(...p));
    pic(title,t,'/art/psd-main-v1/resources/'+id+'-plus.png',box(x+138*w/750,64*w/750,13*w/750,12*w/750));
    const text=s.wallet?.unlimited?'9999':compact(s.wallet?.[id]);
    words(title,text,(327+i*170)*w/750,69.5*w/750,(text.length>4?19.1:22.5)*w/750,{weight:800,maxWidth:b.w*.55});
    area(t,id,['体力','金币','钻石'][i],box(x,y,b.w,Math.max(b.h,44)),i?'shopSection':'stamina',i?{section:i===1?'resources':'supply'}:{});
  }
}

