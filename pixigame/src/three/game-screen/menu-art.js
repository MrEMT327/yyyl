import {nineSliceGeometry} from '../../ui/nine-slice-geometry.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {leftOfMenuTop,navArtwork,navBodyEnd,navFillStart,walletTop} from './home-navigation.js';
import {artworkSize} from './image-loading.js';
import {equipmentLayout} from './equipment-layout.js';
import art from './menu-art.json';

export {art};
export const primaryArtwork={priority:2};
export const box=(x,y,w,h)=>({x,y,w,h});
export const bodyFont='"Microsoft YaHei","PingFang SC",sans-serif',titleFont='PsdPopup,"Microsoft YaHei",sans-serif';
export const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
export const fmt=n=>n==null?'—':Number(n).toLocaleString('zh-CN',{useGrouping:false,maximumFractionDigits:1}),compact=n=>n>=1e8?+(n/1e8).toFixed(1)+'亿':n>=1e4?+(n/1e4).toFixed(1)+'万':fmt(n);
export function words(a,value,x,y,size,opts={}){
  return a.text(String(value??''),x,y,{size,weight:opts.family===titleFont?400:600,align:'center',family:bodyFont,...opts});
}
export function pic(a,t,url,b,contain=false,options){return t.image(a,url,b.x,b.y,b.w,b.h,contain,options);}
function fitSlice(mesh,b,edge,cut){
  const [iw,ih]=artworkSize(mesh.material.map?.image);
  mesh.geometry.dispose();
  mesh.geometry=nineSliceGeometry(b.w,b.h,iw||219,ih||85,cut,edge);
}
export function slice(a,t,url,b,edge=10,cut=18,{updateInPlace=false}={}){
  const options=updateInPlace?{updateInPlace,onImage:mesh=>fitSlice(mesh,b,edge,cut)}:undefined;
  const mesh=pic(a,t,url,b,false,options);
  if(!updateInPlace||!mesh.visible)fitSlice(mesh,b,edge,cut);
  return mesh;
}
export function button(a,t,b,{title,price,icon,gold=false,short=false,disabled=false,skin,titleColor='#fff',shortColor='#ffb59a',family=titleFont,titleSize=clamp(b.w*.092,12,17),priceSize=Math.min(14,b.w*.10),priceColor='#fff',artwork}){
  const plate=skin?pic(a,t,skin,b,false,artwork):slice(a,t,gold?'/art/psd-equipment-v1/button-gold.png':'/art/psd-buttons-v1/button-blue.png',b,Math.min(12,b.h*.24),18,artwork);
  if(disabled&&!short&&!skin)plate.material.color.set(0xb5b5b5);
  const cx=b.x+b.w/2;
  words(a,title,cx,b.y+b.h*(price==null ? .50 : .34),titleSize,{family,color:titleColor,maxWidth:b.w-8});
  if(price!=null){
    const size=priceSize,y=b.y+b.h*.70,iconSize=icon?size+3:0;
    const m=words(a,price,cx+iconSize/2,y,size,{color:short?shortColor:priceColor,maxWidth:b.w-iconSize-6,weight:800});
    if(icon)pic(a,t,icon,box(cx-m.scale.x/2-iconSize/2,y-iconSize/2,iconSize,iconSize),true,artwork);
  }
}
export const qualityFrame=rank=>'/art/psd-equipment-v1/frame-'+(['gray','green','blue','purple','gold','red'][rank]||'gray')+'.png';
export function area(t,id,label,b,action,data={},zone=null,disabled=false){
  t.control(id,label,b,{type:action,data},{zone,disabled});
}
function equipmentRoom(root,t,w,h,bleed,layout,primary){
  // Keep the divider at the toolbar boundary, preserving the shape of the
  // 750 × 1624 PSD's angled edge when the native hangar is shortened.
  const url='/art/psd-equipment-v1/equipment-background.webp',height=w*1624/750;
  root.quad(0,-bleed,w,h+bleed,'#293b51');
  if(bleed){
    // Extend only above the content origin to fill the capsule area, without
    // shifting the PSD's divider. Mirror the top strip so its edge joins.
    const uv=pic(root,t,url,box(0,-bleed,w,bleed),false,primary).geometry.attributes.uv;
    for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i)*Math.min(1,bleed/height));
  }
  if(!layout.compacted){pic(root,t,url,box(0,0,w,height),false,primary);return;}
  const {top,bottom,originalEnd,u}=layout,divider=32*u;
  const band=(dst,dy,src,sy)=>verticalSlice(root,t,url,box(0,dst,w,dy),src/height,(src+sy)/height,primary);
  band(0,top,0,top);
  band(top,bottom-top-divider,top,originalEnd-top-divider);
  band(bottom-divider,divider,originalEnd-divider,divider);
  band(bottom,height-originalEnd,originalEnd,height-originalEnd);
}
function verticalSlice(front,t,url,b,top,bottom,options){
  const {uv}=pic(front,t,url,b,false,options).geometry.attributes;
  for(let i=0;i<uv.count;i++)uv.setY(i,1-bottom+uv.getY(i)*(bottom-top));
}
const railHeight=w=>w*151/750;
export const menuNavY=(w,h,safeBottom=0)=>h-railHeight(w)-safeBottom;
export function chrome(data,w,h,t){
  const tab=data.tab,s=data.snapshot,u=w/369.453,root=t.layer('room').art;
  const railH=railHeight(w),navY=menuNavY(w,h,data.safeBottom);
  const bleed=t.topBleed||0,equipment=tab==='assembly'?equipmentLayout(w,navY,data.adaptiveEquipment):null;
  const artwork=data.prioritizedArtwork?{updateInPlace:true}:undefined;
  const primary=artwork?{...primaryArtwork,...artwork}:primaryArtwork;
  if(equipment)equipmentRoom(root,t,w,h,bleed,equipment,primary);
  else{
    if(data.progressive)root.quad(0,-bleed,w,h+bleed,'#203247');
    pic(root,t,art[tab+'-background'],box(0,-bleed,w,h+bleed),false,artwork?primary:{...primaryArtwork,updateInPlace:tab==='research'});
  }
  const title=t.layer('heading').art;
  const heading=box(w*.02,4*u,w*.33,44*u);
  const titleTop=leftOfMenuTop(t.viewport,heading.x+heading.w,heading.h);
  const defaultWalletY=walletTop*w/750,walletY=titleTop===null?defaultWalletY:6;
  if(titleTop!==null)heading.y=titleTop-bleed;
  const footerUrl=art[tab+'-footer'];
  // Request navigation artwork with the heading, before the scroll content.
  const footerReady=!data.progressive||Boolean(t.texture(footerUrl,!artwork,2).image);
  if(tab==='supply'&&data.fleetReturnKind){
    const label='← 返回'+(data.fleetReturnKind==='aircraft'?'战机':'驾驶员');
    words(title,label,heading.x+4*u,heading.y+heading.h/2,13*u,{align:'left',color:'#e9f5ff'});
    const hit=titleTop===null?heading:{...heading,w:Math.min(heading.w,w*234/750-heading.x-4)};
    area(t,'fleet-return',label,hit,'fleetSupplyBack');
  }else{
    let fallback;
    const options=artwork&&data.progressive?{...primary,onImage:()=>{if(fallback)fallback.visible=false;}}:primary;
    const plate=pic(title,t,art[tab+'-heading'],heading,false,options);
    if(data.progressive&&!plate.visible)fallback=words(title,tab==='shop'?'商城':'装备',heading.x+6*u,heading.y+heading.h/2,18*u,{align:'left',family:titleFont});
  }
  resourceBar(t,title,s,w,walletY,artwork);
  const defaultTop=tab==='assembly'?w*.125:Math.max(12,w*.0325)+w*(tab==='supply' ? .125 : .1805);
  const top=tab==='assembly'||titleTop===null?defaultTop:
    Math.max(walletY+Math.max(44,46*w/750)+8,defaultTop+walletY-defaultWalletY);
  return {top,navY,equipment,artwork,primary,
    footer(){
      const front=t.layer('footer').art,inset=data.safeBottom||0;
      const url=footerUrl,fallback=[];
      const options=footerReady?primary:{...primary,onImage:()=>{for(const mesh of fallback)mesh.visible=false;}};
      if(!footerReady)fallback.push(front.quad(0,navY,w,railH+inset,'#172735'));
      if(inset){
        const skin=navArtwork(navY,railH,inset),background='/art/project-navigation-v2/background.png';
        verticalSlice(front,t,url,box(0,navY,w,skin.body),0,navBodyEnd,options);
        verticalSlice(front,t,background,box(0,skin.fillY,w,skin.fillHeight),navFillStart,navBodyEnd,artwork);
        verticalSlice(front,t,background,box(0,skin.trimY,w,skin.trim),navBodyEnd,1,artwork);
      }else pic(front,t,url,box(0,navY,w,railH),false,options);
      let x=0;for(const [key,label] of [['shop','商城'],['assembly','装备'],['battle','战役'],['research','天赋'],['supply','招募']]){
        const width=w*(key===tab ? .2506 : .18735);
        if(!footerReady)fallback.push(words(front,label,x+width/2,navY+railH/2,14*u,{color:key===tab?'#ffd28a':'#e0effb'}));
        area(t,'nav-'+key,label,box(x,navY,width,railH),'tab',{tab:key});x+=width;
      }
    }};
}
export function resourceBar(t,title,s,w,y=walletTop*w/750,artwork){
  const scale=w/750,dy=y-walletTop*scale;
  for(const [i,id] of ['stamina','coins','diamonds'].entries()){
    const x=(234+i*170)*scale,b=box(x,y,163*scale,46*scale);
    const icons=[[253,47,30,44],[422,48,34,42],[601,50,20,39]],p=icons[i].map(n=>n*scale);
    p[1]+=dy;
    pic(title,t,'/art/psd-main-v1/resources/'+id+'-background.png',b,false,artwork);
    pic(title,t,RESOURCE_ICONS[id].url,box(...p),false,artwork);
    pic(title,t,'/art/psd-main-v1/resources/'+id+'-plus.png',box(x+138*scale,64*scale+dy,13*scale,12*scale),false,artwork);
    const text=s.wallet?.unlimited?'9999':compact(s.wallet?.[id]);
    words(title,text,(327+i*170)*scale,69.5*scale+dy,(text.length>4?19.1:22.5)*scale,{weight:800,maxWidth:b.w*.55});
    area(t,id,['体力','金币','钻石'][i],box(x,y,b.w,Math.max(b.h,44)),i?'shopSection':'stamina',i?{section:i===1?'resources':'supply'}:{});
  }
}
