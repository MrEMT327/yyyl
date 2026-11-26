import {area,box,clamp,pic,slice,titleFont,words} from './menu-art.js';
import {atlas,bottomNav,catalogGrid,normalFit,psdAction,skill,stars} from './catalog-art.js';
import {catalogAircraftRect,catalogBounds} from './catalog-model.js';
import {fleetSkills,skillSlots,weaponSkills} from './catalog-skills.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
import {NATIVE_AIRCRAFT_SKINS} from '../../replica/native-aircraft-skins.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';
import {leftOfMenuCenterY} from './home-navigation.js';

function titleTop(t,x,width,height,fallback){
  const center=leftOfMenuCenterY(t.viewport,x+width);
  return center===null?fallback:center-t.topBleed-height/2;
}

function weaponHero(d,a,t,w,v){
  const tech=d.ui.skillTab,item=d.selected,row=tech?d.skillWeapon:item.row,face=tech?nativeCollectionArt(row,'default'):item.image;
  const title=box(.03*w,v.top+.023*w,tech?.287*w:.26*w,Math.max(30,88.6*w/1080));
  title.y=titleTop(t,title.x,title.w,title.h,title.y);
  pic(a,t,atlas[tech?'weapon-skill-title':'weapon-list-title'],title);
  const b=box(w*.295,v.top+v.hero*.25,.36*w,v.hero*.42);normalFit(a,t,face,b);
  area(t,'hero',tech?'查看'+row.name+'技能':'查看'+row.name+'详情',b,tech?'nativeWeaponPreview':'nativeCollectionDetail',
    {id:tech?row.id:item.actualId,kind:'guns',mode:'base'});
  if(tech){skillSlots(a,t,d,w,v);return;}
  if(!d.deployed){
    const y=v.top+v.hero*.92-Math.max(44,.141*w),bw=.162*w,bh=Math.max(44,.141*w);
    for(const [i,mode] of ['base','growth'].entries())psdAction(a,t,box(w/2+(i-1)*bw+(i?1:-1)*.0225*w,y,bw,bh),
      {id:'preview-'+mode,label:i?'成长':'基础',cmd:'nativeWeaponPreview',data:{id:item.actualId,mode}});
  }
}
// The catalog thumbnails have clear margins around the airframe. Use the
// silhouette envelope of the eight card images for compact material slots.
const aircraftCostCrop={x:.14,y:.10,width:.72,height:.78};
function fleetCostIcon(a,t,id,b){
  return normalFit(a,t,nativeItemArt(id),b,false,NATIVE_AIRCRAFT_SKINS[id]?aircraftCostCrop:null);
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
  const tx=.03*w,ht=Math.max(30,88.6*w/1080),fs=clamp(60*w/1080,17,30);
  const title=t.layer('catalog-identity').art;
  const text=words(title,p.name,tx+10,0,fs,{family:titleFont,maxWidth:.88*w-24,align:'left'});
  const bw=Math.max(76,.26*w,text.scale.x+20),ty=titleTop(t,tx,bw,ht,v.top+.023*w);
  text.position.y=ty+ht/2;
  const plate=slice(title,t,'/art/psd-page-chrome-v1/chapter-face.png',box(tx,ty,bw,ht),5,18);plate.renderOrder=-1;
  stars(title,t,box(tx+12,ty+ht+.002*w,.31*w,.055*w),p.stars,p.activated?p.row.star:0);
  if(plane&&!p.access.basicOnly){
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
  if(selected.access.available)ops.push('select');
  if(!row.baseOnly&&(!selected.access.basicOnly||plane))ops.push(selected.activated?'star':'unlock');
  const total=.82*w,space=.07*total,bwBtn=total*(.465),bh=Math.max(44,85*w/750),start=(w-(ops.length*bwBtn+(ops.length-1)*space))/2;
  ops.forEach((op,i)=>{const opBox=box(start+i*(bwBtn+space),v.controls+(v.btn-bh)/2,bwBtn,bh),select=op==='select',
    title=select?(selected.access.using?'使用中':'使用'):row.maxed?'已满星':op==='star'?'升星':selected.access.basicOnly?'激活收藏':'激活',costs=select?[]:row.costs||[],
    payload={kind:d.group,operation:op,id:select?selected.access.selectionId:selected.id,revision:d.collection.revision,shortage:costs.some(c=>c.available<c.count)};
    const disabled=select?!selected.access.available||selected.access.using:row.maxed||d.s.rewardPending||d.s.rewardBusy;
    if(!costs.length){psdAction(a,t,opBox,{id:op,label:title,cmd:'nativeOperation',data:payload,disabled,gold:plane&&!select});return;}
    const first=t.buttonFace&&a.group.children.length;
    const skin=slice(a,t,plane?'/art/psd-equipment-v1/button-gold.png':'/art/psd-buttons-v1/button-blue.png',opBox,10);
    if(disabled)skin.material.color.set(0x87939e);
    if(costs.length===1){
      const c=costs[0],cy=opBox.y+bh/2,padding=Math.min(10,bwBtn*.07),labelWidth=bwBtn*.40;
      const costLeft=opBox.x+padding+labelWidth,costWidth=bwBtn-labelWidth-2*padding,gap=4;
      const iconSize=Math.min(bh*.73,costWidth*.45);
      words(a,title,opBox.x+padding+labelWidth/2,cy,clamp(w*.036,12,17),{family:titleFont,maxWidth:labelWidth-4});
      const amount=words(a,`${c.available}/${c.count}`,costLeft,cy,clamp(w*.033,10,15),{
        color:payload.shortage?'#ffafa2':'#f2f8fb',maxWidth:costWidth-iconSize-gap-4,
      });
      const iconX=costLeft+(costWidth-iconSize-gap-amount.scale.x)/2;
      fleetCostIcon(a,t,c.id,box(iconX,cy-iconSize/2,iconSize,iconSize));
      amount.position.x=iconX+iconSize+gap+amount.scale.x/2;
      area(t,op,title,opBox,'nativeOperation',payload,null,disabled);
      if(!disabled)t.buttonFace?.(op,opBox,a,first);
      return;
    }
    words(a,title,opBox.x+bwBtn/2,opBox.y+bh*.30,clamp(w*.038,13,19),{family:titleFont});area(t,op,title,opBox,'nativeOperation',payload,null,disabled);
    const budget=bwBtn*.89/costs.length;
    costs.forEach((c,index)=>{const ix=opBox.x+(bwBtn-budget*costs.length)/2+(index+.5)*budget,cy=opBox.y+.71*bh,isz=Math.min(.059*w,budget*.47);
      const value=words(a,c.available+'/'+c.count,ix+isz/2,cy,clamp(.029*w,10,14),{weight:700,maxWidth:budget-isz,color:c.available<c.count?'#ffafa2':'#f2f8fb'});
      const b=box(value.position.x-value.scale.x/2-isz,cy-isz/2,isz,isz);
      if(fleetCostIcon(a,t,c.id,b))area(t,'cost-'+c.id,c.name,b,'inspect',{itemId:c.id});
    });
    if(!disabled)t.buttonFace?.(op,opBox,a,first);
  });
}
export function catalogMenu(data,w,h,t){
  const d=data.catalogView,v=catalogBounds(w,h,data.safeBottom,data.native),kind=data.tab,a=t.layer('catalog-room').art,tech=d?.ui.skillTab;
  const bleed=t.topBleed||0;
  a.quad(0,-bleed,w,h+bleed,'#20202a');pic(a,t,atlas[kind+'-wall'],bleed?box(0,-bleed,w,h+bleed):box(0,v.top,w,v.content));
  if(!d){words(a,'暂无内容',w/2,h/2,15);area(t,'back','返回装备',box(0,v.end,64,v.footer.hitHeight),'catalogBack');return;}
  const areaGrid=tech&&d.kind!=='weapon';pic(a,t,'/art/psd-equipment-v1/inventory-grid.webp',areaGrid?box(0,v.top,w,v.content):box(0,v.list,w,v.end-v.list));
  normalFit(a,t,atlas[kind+'-hero'],box(0,-bleed,w,v.divider+bleed),true);
  if(kind==='weapon')weaponHero(d,a,t,w,v);else fleetHero(data,d,a,t,w,h,v);
  const edge=t.layer('catalog-section').art;pic(edge,t,'/art/psd-equipment-v1/hangar-divider.png',box(0,v.divider-.08*w,w,.08*w));
  pic(edge,t,atlas[kind+'-'+(tech?'skill':'list')+'-heading'],box(0,v.divider,w,v.head));
  if(!tech)catalogGrid(d,t,w,v,data.windowedCatalog);else if(kind==='weapon')weaponSkills(d,t,w,v);else fleetSkills(d,t,w,v);
  const foot=t.layer('catalog-navigation');
  if(data.navigation)foot.drawInstead=renderer=>{
    const {pose,homeArtwork}=data.navigation;
    if(pose.dockMoving&&pose.dock>0)homeArtwork?.dock(renderer,pose);
  };
  bottomNav(foot.art,t,d,w,v.footer,data.progressive);
}
