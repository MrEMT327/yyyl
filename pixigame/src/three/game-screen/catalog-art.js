import {area,box,clamp,pic,slice,titleFont,words} from './menu-art.js';
import atlas from './catalog-art.json';
import {projectIconUrl} from '../../ui/project-ui-art.js';
import {skillIconBackgroundArt} from '../../replica/skill-element-background-art.js';
export {atlas};
export function symbol(a,t,id,b){return pic(a,t,projectIconUrl(id),b,true);}
export function normalFit(a,t,url,b,cover=false,crop=null){
  if(!url)return null;
  const texture=t.texture(url),im=texture.image;
  if(!im?.width)return a.image(texture,b.x,b.y,b.w,b.h);
  const cut=crop||{x:0,y:0,width:1,height:1},width=im.width*cut.width,height=im.height*cut.height;
  const k=(cover?Math.max:Math.min)(b.w/width,b.h/height),sw=width*k,sh=height*k;
  if(!cover)return a.image(texture,b.x+(b.w-sw)/2,b.y+(b.h-sh)/2,sw,sh,crop);
  const fx=b.w/sw,fy=b.h/sh;return a.image(texture,b.x,b.y,b.w,b.h,{x:cut.x+cut.width*(1-fx)/2,y:cut.y+cut.height*(1-fy)/2,width:cut.width*fx,height:cut.height*fy});
}
export function skill(a,t,url,b){
  if(!url){const side=Math.min(b.w,b.h)*.32;words(a,'+',b.x+b.w/2,b.y+b.h/2,side*1.5,{color:'#b8cfdb',weight:600});return;}
  const back=skillIconBackgroundArt(url);if(back)pic(a,t,back,b);normalFit(a,t,url,b);
}
export function stars(a,t,b,count,filled,{align='left'}={}){
  const size=Math.min(b.h,b.w/Math.max(1,count)),all=size*count,x=align==='center'?b.x+(b.w-all)/2:b.x;
  for(let i=0;i<count;i++){const m=symbol(a,t,'star',box(x+i*size,b.y+(b.h-size)/2,size,size));
    if(i>=filled){m.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat v=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=vec3(v*.48);');};m.material.opacity=.78;}}
}
export function selection(a,t,b){
  const edge=slice(a,t,'/art/psd-equipment-v1/frame-empty.png',box(b.x-2,b.y-2,b.w+4,b.h+4),8,18);
  edge.geometry.setIndex(Array.from({length:54},(_,i)=>i).filter(i=>i<24||i>=30));
}
export function psdAction(a,t,b,{id,label,cmd,data={},zone=null,disabled=false,gold=false,price,icon,short=false,size=14}){
  const m=slice(a,t,gold?'/art/psd-equipment-v1/button-gold.png':'/art/psd-buttons-v1/button-blue.png',b,10);
  if(disabled)m.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec3 rgb=sRGBTransferOETF(diffuseColor).rgb;float gray=dot(rgb,vec3(.2126,.7152,.0722))*.65;diffuseColor.rgb=sRGBTransferEOTF(vec4(vec3(gray),1.)).rgb;');};
  words(a,label,b.x+b.w/2,b.y+b.h*(price==null?.5:.33),size,{family:titleFont,maxWidth:b.w-6,color:disabled?'#bac8d2':'#fff'});
  if(price!=null){
    const fs=clamp(b.h*.235,10,15),imageW=icon?b.h*.46:0,cy=b.y+b.h*.72;
    const text=words(a,price,b.x+b.w/2+imageW/2,cy,fs,{color:short?'#ffbba6':'#f5f9ff',maxWidth:b.w-imageW-4,weight:700});
    if(icon)normalFit(a,t,icon,box(text.position.x-text.scale.x/2-imageW,cy-imageW/2,imageW,imageW));}
  area(t,id,label,b,cmd,data,zone,disabled);
}
export function catalogGrid(d,t,w,bounds,context){
  const {kind,items,selected,group}=d,gun=kind==='weapon',pilot=kind==='pilot';
  const size=gun?.223*w:pilot?.238*w:.2225*w,sideY=gun?size*1.145:pilot?size*316/276:size*1.215;
  const left=w*(gun?.022:pilot?.012:.025),stepX=gun?w*.2442:pilot?w*.246:w*.2403,stepY=gun?sideY+24+4.3:pilot?sideY+.008*w:sideY+.016*w;
  const pad=w*(gun?.03:pilot?.005:.021),zone=kind+'-list';
  const rect=box(0,bounds.list,w,bounds.end-bounds.list);t.region(zone,rect,pad+Math.ceil(items.length/4)*stepY+.02*w);
  const a=t.layer('catalog-grid',zone).art;
  items.forEach((it,i)=>{const x=left+i%4*stepX,y=bounds.list+pad+Math.floor(i/4)*stepY,b=box(x,y,size,sideY),chosen=it.id===selected.id;
    pic(a,t,atlas['card-frame-'+it.rank],b);
    const face=gun?box(x+.09*size,y+.08*sideY,.82*size,.67*sideY):pilot?box(x+.08*size,y+.07*sideY,.84*size,.70*sideY):box(x+.04*size,y+.07*sideY,.92*size,.73*sideY);
    const m=normalFit(a,t,it.image,face,pilot,d.kind==='aircraft'?{x:.18,y:.12,width:.64,height:.76}:null);
    if(m&&!it.activated&&!it.row.baseOnly){m.material.color.set(gun&&chosen?'#e7e7e7':pilot?'#c8c5c6':'#c0c0c0');}
    if(pilot)skill(a,t,it.skillIcon||projectIconUrl('skill-tab'),box(x+.07*size,y+.06*sideY,.213*size,.213*size));
    if(it.access.collectionUsing)symbol(a,t,'check',box(x+size*.07,y+sideY*.05,size*.22,size*.22));
    if(!it.activated&&!it.row.baseOnly){const lock=symbol(a,t,'lock',box(x+size*.79,y+sideY*.075,size*.13,size*.15));lock.material.color.set('#b3c5cd');}
    stars(a,t,box(x+size*.065,y+sideY*.80,size*.87,sideY*.145),it.stars,it.row.star,{align:'center'});
    if(chosen)selection(a,t,b);
    area(t,'select-'+it.id,it.name,b,'catalogSelect',{id:String(it.id),kind},zone);
    if(gun){
      if(chosen){const btn=box(x+3,y+sideY-20,size-6,44);pic(a,t,atlas['card-action'],btn);
        const label=it.activated?'改造':'获取';words(a,label,x+size/2,btn.y+btn.h*.76,clamp(w*.032,10,16),{family:titleFont});
        area(t,'detail-'+it.id,label,btn,'nativeCollectionDetail',{id:it.actualId,kind:group},zone);
      }else words(a,it.name,x+size/2,y+sideY+11,clamp(w*.035,11,16),{family:titleFont,maxWidth:size});}
  });
}
export function bottomNav(a,t,d,w,h,rect){
  pic(a,t,atlas[d.kind+'-'+(d.ui.skillTab?'skill':'list')+'-footer'],rect);
  const button=Math.max(44,166*w/1080),gap=6*w/1080,pad=10*w/1080,theBack=d.kind==='weapon'&&d.ui.skillTab&&d.slot!=null;
  area(t,'back',theBack?'返回技能列表':'返回装备',box(pad,rect.y,Math.max(48,.13*w),rect.h),theBack?'nativeWeaponSkillBrowse':'catalogBack',theBack?{id:d.skillWeapon.id}:{});
  area(t,'mode-list',{weapon:'武器',aircraft:'战机',pilot:'驾驶员'}[d.kind],box(w-pad-2*button-gap,rect.y,button,rect.h),'catalogMode',{mode:'list'});
  area(t,'mode-skills','技能',box(w-pad-button,rect.y,button,rect.h),'catalogMode',{mode:'skills'});
}
