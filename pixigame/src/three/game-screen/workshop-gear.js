import {art,area,box,clamp} from './menu-art.js';
import {pic,qualityFrame,slice,words} from './menu-art.js';
import {psdAction,symbol} from './catalog-art.js';
import {equipmentArtPath} from '../../replica/equipment-art.js';
import {gearMergeDraft} from '../../ui/gear-merge-selection.js';
import {gearDetailSkills} from '../../ui/gear-detail-model.js';
import {gearAttributes,GEAR_PARTS} from '../../peripheral/equipment-system.js';

const gearArt=id=>'/'+equipmentArtPath(id);
function emptyMark(a,t,b){
  const side=clamp(b.w*.23,13,18);
  const m=pic(a,t,'/art/psd-main-v1/resources/diamonds-plus.png',box(b.x+(b.w-side)/2,b.y+(b.h-side)/2,side,side),true);
  m.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\ndiffuseColor.rgb=vec3(.39,.55,.63);');};m.material.opacity=.85;
}
export function gearTile(a,t,b,item,{action,zone,idPrefix='gear-',selected=false,disabled=false,draw=true}={}){
  if(action)area(t,idPrefix+item.uid,item.name+'，'+item.qualityName+'，等级'+item.level,b,action,{id:item.uid},zone,disabled);
  if(!draw)return;
  const {x,y,w}=b,first=a.group.children.length;
  slice(a,t,qualityFrame(item.qualityRank),b,8);
  pic(a,t,gearArt(item.art),box(x+w*.08,y+w*.155,w*.84,w*.69),true);
  if(selected)symbol(a,t,'check',box(x+w*.05,y+w*.05,w*.24,w*.24));
  else pic(a,t,art['slot-badge-'+item.type],box(x,y,w*.34,w*.34));
  if(item.equipped){
    a.panel(x+w*.09,y+w*.47,w*.82,12,{fill:'#0a141d',stroke:null,cut:0,radius:3,opacity:.96});
    words(a,'已装备',x+w/2,y+w*.47+6,10,{weight:700,color:'#f3fcff'});
  }
  words(a,'Lv.'+item.level,x+w/2,y+w*.85,clamp(w*.145,11,15),{weight:700,outline:'#102538'});
  if(item.quality%10)words(a,'+'+item.quality%10,x+w*.84,y+w*.14,11,{color:'#ffe48a'});
  if(item.locked)words(a,'锁',x+w*.81,y+w*.23,10);
  if(disabled)for(const m of a.group.children.slice(first))m.material.opacity*=.4;
}
function recipeSlot(a,t,b,item,{index,ghost=false,choose=false,quality,logicalSize}={}){
  if(item){
    const frame=slice(a,t,qualityFrame(quality??item.qualityRank),b,8);
    const pad=logicalSize*.015,m=pic(a,t,gearArt(item.art),box(b.x+pad,b.y+pad,b.w-2*pad,b.h-2*pad),true);
    if(ghost){frame.material.color.set('#737373');m.material.color.set('#808080');}
  }else{
    const plate=pic(a,t,'/art/weapon-catalog-psd-v1/plate-blue-clean.png',b);
    const edge=slice(a,t,'/art/weapon-catalog-psd-v1/frame-blue.png',b,6,24);
    edge.geometry.setIndex(Array.from({length:54},(_,i)=>i).filter(i=>i<24||i>=30));
    if(index===undefined)for(const m of [edge,plate])m.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nfloat v=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));diffuseColor.rgb=mix(vec3(v),diffuseColor.rgb,.22)*.72;');};
    const markSize=clamp(logicalSize*.036,13,18);emptyMark(a,t,box(b.x+(b.w-markSize)/2,b.y+(b.h-markSize)/2,markSize,markSize));
  }
  if(index>=0&&!ghost)area(t,'ingredient-'+index,index===0?'主装备':'材料'+index,b,choose?'workshopChoose':'workshopGearRemove',{index:String(index)});
}
export function gearWorkshop(data,w,h,t,layout){
  const {a,top,stageH,gridY,footY,button,assistant}=layout,g=data.snapshot.equipment,ui=data.workshop;
  const {target,option,materialIds,tokens,ready,stale}=gearMergeDraft(g,ui.draft);
  const result=target&&option?.nextQuality?{...target,quality:option.nextQuality,qualityRank:Math.floor(option.nextQuality/10)-1}:null;
  const y=top+stageH*.22;
  recipeSlot(a,t,box(.08*w,y,.21*w,.21*w),result,{logicalSize:w});
  symbol(a,t,'equipment-upgrade',box(.155*w,y+.22*w,.06*w,.07*w));
  const total=1+(option?.required||0),slot=Math.min(.16*w,(.62*w-(total>1?.06*w:0)-Math.max(0,total-1)*.02*w)/total);
  let x=.095*w;const sy=top+stageH*.85-.16*w;
  for(let i=0;i<total;i++){
    if(i===1){emptyMark(a,t,box(x,sy,.04*w,.16*w));x+=.06*w;}
    const picked=i===0?target:i<=materialIds.length?g.items.find(it=>it.uid===materialIds[i-1]):null;
    const ghost=!picked&&i>materialIds.length+tokens,it=picked||target;
    recipeSlot(a,t,box(x,sy,slot,.16*w),it,{index:i,ghost,choose:!target,quality:i>0&&!picked?Math.floor(option.quality/10)-1:it?.qualityRank,logicalSize:w});
    x+=slot+.02*w;
  }
  const part=GEAR_PARTS.find(p=>p.type===target?.type),next=result&&part?gearAttributes(result).value?.[part.attribute]:null;
  const features=result?gearDetailSkills(result).filter(s=>s.unlocked&&s.quality>target.quality):[];
  const rows=target?[[target.attributeName||part?.attributeName||'属性','+'+(target.attribute??0),Number.isFinite(next)?'+'+next:''],...features.map(f=>f.text)]:['请选择要合成的装备'];
  assistant(rows,Boolean(target));
  const remaining=Math.max(0,(option?.required||0)-materialIds.length-tokens);
  const notice=stale?'装备已变化，请重新选择':!target?'':!option?.required?'已达最高品质':option.any&&materialIds.some(id=>option.protectedIds?.includes(id))?'将消耗同名保留件；降阶仅返通用材料':remaining?'还需要 '+remaining+' 件'+(option.any?'同部位材料':'相同装备'):'材料已齐全';
  if(notice){const ny=top+stageH-.075*w;pic(a,t,'/art/psd-main-v1/navigation/background-clean.png',box(0,ny,w,.075*w));
    words(a,notice,w/2,ny+.0375*w,clamp(.032*w,11,15),{maxWidth:.94*w});}
  button('filter',ui.filter==='all'?'筛选':g.blueprints.find(p=>String(p.type)===ui.filter)?.name||'全部','workshopFilter','left');
  button('batch','一键合成','workshopGearBatch','right',!g.items.some(i=>i.quality<40&&!i.locked&&i.merge.available));
  button('compose','合成','workshopGearCompose','confirm',!ready);
  const cols=4,pad=.045*w,gap=.02*w,side=(w-2*pad-(cols-1)*gap)/cols,step=side+gap,zone='workshop-'+ui.filter;
  const items=g.items.filter(i=>ui.filter==='all'||String(i.type)===ui.filter).sort((a,b)=>b.quality-a.quality||a.type-b.type||a.uid.localeCompare(b.uid));
  const fy=gridY+gap+Math.ceil(items.length/cols)*step+w*.01,bw=(w-2*pad-gap)/2,rh=Math.max(46,w*.125);
  const fodder=Object.entries(g.fodder||{}).filter(([key,n])=>n>0&&(ui.filter==='all'||key.split(':')[0]===ui.filter));
  t.region(zone,box(0,gridY,w,Math.max(1,footY-gridY)),fy-gridY+Math.ceil(fodder.length/2)*(rh+gap),'y',{redrawStep:data.progressive?step:0});
  const window=t.scrollWindow(zone),inWindow=b=>!window||b.y+b.h>window.top&&b.y<window.bottom;
  const grid=t.layer('gear-inventory',zone).art;
  items.forEach((it,i)=>{const selected=it.uid===target?.uid||materialIds.includes(it.uid);
    const b=box(pad+i%cols*step,gridY+gap+Math.floor(i/cols)*step,side,side);
    gearTile(grid,t,b,it,{action:'workshopGearPick',zone,selected,draw:inWindow(b),disabled:!!target&&!stale&&!selected&&!option?.candidates.includes(it.uid)});});
  fodder.forEach(([key,n],i)=>{const [type,q]=key.split(':').map(Number),bp=g.blueprints.find(b=>b.type===type),b=box(pad+i%2*(bw+gap),fy+Math.floor(i/2)*(rh+gap),bw,rh);
    const allowed=!stale&&key===option?.tokenKey&&tokens+materialIds.length<option.required,selected=key===option?.tokenKey?tokens:0;
    if(!inWindow(b)){area(t,'token-'+key,'',b,'workshopGearToken',{key},zone,!allowed);return;}
    psdAction(grid,t,b,{id:'token-'+key,label:'',cmd:'workshopGearToken',data:{key},zone,disabled:!allowed});
    const sb=box(b.x+5,b.y+(rh-w*.09)/2,w*.09,w*.09);slice(grid,t,qualityFrame(Math.floor(q/10)-1),sb,5);pic(grid,t,gearArt(bp.id),sb,true);
    words(grid,bp.name+'材料 '+selected+'/'+n,b.x+b.w*.60,b.y+b.h/2,12,{maxWidth:b.w*.72});
  });
}

