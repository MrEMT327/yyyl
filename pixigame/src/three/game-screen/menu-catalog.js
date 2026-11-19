import {area,box,clamp,pic,slice,titleFont,words} from './menu-art.js';
import {atlas,bottomNav,catalogGrid,normalFit,psdAction,skill,stars} from './catalog-art.js';
import {catalogAircraftRect,catalogBounds} from './catalog-model.js';
import {fleetSkills,skillSlots,weaponSkills} from './catalog-skills.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';

function weaponHero(d,a,t,w,v){
  const tech=d.ui.skillTab,item=d.selected,row=tech?d.skillWeapon:item.row,face=tech?nativeCollectionArt(row,'default'):item.image;
  const title=box(.03*w,v.top+.023*w,tech?.287*w:.26*w,Math.max(30,88.6*w/1080));pic(a,t,atlas[tech?'weapon-skill-title':'weapon-list-title'],title);
  const b=box(w*.295,v.top+v.hero*.25,.36*w,v.hero*.42);normalFit(a,t,face,b);
  area(t,'hero',tech?'查看'+row.name+'技能':'查看'+row.name+'详情',b,tech?'nativeWeaponPreview':'nativeCollectionDetail',
    {id:tech?row.id:item.actualId,kind:'guns',mode:'base'});
  if(tech){skillSlots(a,t,d,w,v);return;}
  if(d.deployed){const cy=v.top+v.hero*.882,ww=Math.min(w*.94,32+14*(4+d.deployed.name.length));
    const band=a.quad((w-ww)/2,cy-15,ww,30,'#152a3b',.93);
    band.material.onBeforeCompile=s=>{s.vertexShader='varying vec2 stripe;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\nstripe=uv;');
      s.fragmentShader='varying vec2 stripe;\n'+s.fragmentShader.replace('#include <alphamap_fragment>','#include <alphamap_fragment>\ndiffuseColor.a*=smoothstep(0.,.15,min(stripe.x,1.-stripe.x));');};
    const c1=words(a,'出战武器',0,cy,clamp(w*.035,12,15),{color:'#bbd4e1',weight:600});
    const c2=words(a,d.deployed.name,0,cy,clamp(w*.04,14,18),{color:'#f1f8ff',weight:700});
    c1.position.x=w/2-(c2.scale.x+5)/2;c2.position.x=w/2+(c1.scale.x+5)/2;
  }else{
    const y=v.top+v.hero*.92-Math.max(44,.141*w),bw=.162*w,bh=Math.max(44,.141*w);
    for(const [i,mode] of ['base','growth'].entries())psdAction(a,t,box(w/2+(i-1)*bw+(i?1:-1)*.0225*w,y,bw,bh),
      {id:'preview-'+mode,label:i?'成长':'基础',cmd:'nativeWeaponPreview',data:{id:item.actualId,mode}});
  }
}
function fleetHero(data,d,a,t,w,h,v){
  const p=d.displayed,selected=d.selected,plane=d.kind==='aircraft',y=v.top+v.content/2;
  const deck=plane?box(.05*w,y-.552*w,.9*w,.34*w):box(.2685*w,v.controls-.106556*w,.463*w,.19*w);
  normalFit(a,t,'/art/project-fleet-stage-v2/platform.png',deck);
  if(plane){
    const b=catalogAircraftRect(w,h),preview=data.preview;
    if(preview?.ready){const k=Math.min(b.w/preview.target.width,b.h/preview.target.height),sw=preview.target.width*k,sh=preview.target.height*k;preview.paint(a,b.x+(b.w-sw)/2,b.y+(b.h-sh)/2,sw,sh);}
    else normalFit(a,t,nativeCollectionArt(p.row,'preview'),b);
    area(t,'aircraft',p.name,b,'orbit');
  }else if(d.appearance)data.portrait?.draw(a,t,w,h,p);
  else normalFit(a,t,nativeCollectionArt(p.row,'default'),box(.19*w,v.controls-.712556*w,.62*w,.695*w));
  const tx=.03*w,ty=v.top+.023*w,ht=Math.max(30,88.6*w/1080),fs=clamp(60*w/1080,17,30);
  const title=t.layer('catalog-identity').art;
  const text=words(title,p.name,tx+10,ty+ht/2,fs,{family:titleFont,maxWidth:.88*w-24,align:'left'});
  const bw=Math.max(76,.26*w,text.scale.x+20);
  const plate=slice(title,t,'/art/psd-page-chrome-v1/chapter-face.png',box(tx,ty,bw,ht),5,18);plate.renderOrder=-1;
  stars(title,t,box(tx+12,ty+ht+.002*w,.31*w,.055*w),p.stars,p.activated?p.row.star:0);
  if(plane){
    const stage=p.activated?p.row.stage:p.row.stages.find(s=>s.star===p.row.defaultStar)||p.row.stage;
    let x=tx+12,cy=ty+ht+.057*w+.01*w+.022*w;
    for(const line of stage.attributes||[]){const [key,n]=line.split('='),label=d.collection.attributeNames[key]||key,
      value=(Number(n)>=0?'+':'')+n+(key.endsWith('%')?'%':'');
      const l=words(title,label,x-2,cy,.034*w,{align:'left',color:'#e9f5ff'});x+=l.scale.x-4;
      const r=words(title,value,x-2,cy,.034*w,{align:'left',color:'#b7f39a',weight:700});x+=r.scale.x-4+.03*w;}
  }
  if(d.ui.skillTab){skillSlots(a,t,d,w,v);return;}
  if(selected.skillLabel){const b=box(plane?.04*w:0,y-w*(plane?.35:.3251),w*(plane?.20:.178),Math.max(50,.1496*w)),iw=.111*w;
    skill(a,t,selected.skillIcon,box(b.x+(b.w-iw)/2,b.y,iw,iw));words(a,selected.skillLabel,b.x+b.w/2,b.y+iw+7,.0255*w,{maxWidth:b.w});
    area(t,'preview-skill',selected.skillLabel,b,'nativeSkillPreview',{kind:d.group,id:selected.id});}
  const row=selected.row,ops=[];
  if(selected.activated||row.baseOnly)ops.push('select');
  if(!row.baseOnly)ops.push(selected.activated?'star':'unlock');
  const total=.82*w,space=.07*total,bwBtn=total*(.465),bh=Math.max(44,85*w/750),start=(w-(ops.length*bwBtn+(ops.length-1)*space))/2;
  ops.forEach((op,i)=>{const opBox=box(start+i*(bwBtn+space),v.controls+(v.btn-bh)/2,bwBtn,bh),select=op==='select',
    title=select?(selected.access.using?'使用中':'使用'):row.maxed?'已满星':op==='star'?'升星':'激活',costs=select?[]:row.costs||[],
    payload={kind:d.group,operation:op,id:select?selected.access.selectionId:selected.id,revision:d.collection.revision,shortage:costs.some(c=>c.available<c.count)};
    const disabled=select?!selected.access.available||selected.access.using:row.maxed||d.s.rewardPending||d.s.rewardBusy;
    if(!costs.length){psdAction(a,t,opBox,{id:op,label:title,cmd:'nativeOperation',data:payload,disabled,gold:plane&&!select});return;}
    slice(a,t,plane?'/art/psd-equipment-v1/button-gold.png':'/art/psd-buttons-v1/button-blue.png',opBox,10);
    words(a,title,opBox.x+bwBtn/2,opBox.y+bh*.30,clamp(w*.038,13,19),{family:titleFont});area(t,op,title,opBox,'nativeOperation',payload,null,disabled);
    const budget=bwBtn*.89/costs.length;
    costs.forEach((c,index)=>{const ix=opBox.x+(bwBtn-budget*costs.length)/2+(index+.5)*budget,cy=opBox.y+.71*bh,isz=Math.min(.059*w,budget*.47);
      const value=words(a,c.available+'/'+c.count,ix+isz/2,cy,clamp(.029*w,10,14),{weight:700,maxWidth:budget-isz,color:c.available<c.count?'#ffafa2':'#f2f8fb'});
      const img=nativeItemArt(c.id),b=box(value.position.x-value.scale.x/2-isz,cy-isz/2,isz,isz);
      if(img){normalFit(a,t,img,b);area(t,'cost-'+c.id,c.name,b,'inspect',{itemId:c.id});}
    });});
}
export function catalogMenu(data,w,h,t){
  const d=data.catalogView,v=catalogBounds(w,h,data.safeBottom),kind=data.tab,a=t.layer('catalog-room').art,tech=d?.ui.skillTab;
  a.quad(0,0,w,h,'#20202a');pic(a,t,atlas[kind+'-wall'],box(0,v.top,w,v.content));
  if(!d){words(a,'暂无内容',w/2,h/2,15);area(t,'back','返回装备',box(0,h-60,64,60),'catalogBack');return;}
  const areaGrid=tech&&d.kind!=='weapon';pic(a,t,'/art/psd-equipment-v1/inventory-grid.webp',areaGrid?box(0,v.top,w,v.content):box(0,v.list,w,v.end-v.list));
  pic(a,t,atlas[kind+'-hero'],box(0,v.top,w,v.hero));
  if(kind==='weapon')weaponHero(d,a,t,w,v);else fleetHero(data,d,a,t,w,h,v);
  const edge=t.layer('catalog-section').art;pic(edge,t,'/art/psd-equipment-v1/hangar-divider.png',box(0,v.divider-.08*w,w,.08*w));
  pic(edge,t,atlas[kind+'-'+(tech?'skill':'list')+'-heading'],box(0,v.divider,w,v.head));
  if(!tech)catalogGrid(d,t,w,v);else if(kind==='weapon')weaponSkills(d,t,w,v);else fleetSkills(d,t,w,v);
  bottomNav(t.layer('catalog-navigation').art,t,d,w,h,box(0,v.end,w,v.footer));
}
