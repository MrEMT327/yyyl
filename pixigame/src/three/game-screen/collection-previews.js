import {bodyFont,box,clamp,pic,qualityFrame,slice,words} from './menu-art.js';
import {normalFit,skill,stars} from './catalog-art.js';
import {detailSheet} from './detail-sheet.js';
import {nativeSkillArt} from '../../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../../replica/native-weapon-skill-art.js';
import {nativeWeaponGroupId} from '../../replica/native-weapon-groups.js';
import {compactStarSkillDescription} from '../../ui/star-skill-description.js';
import {plain} from './catalog-model.js';
import {projectIconUrl} from '../../ui/project-ui-art.js';
import preview from '../../replica/native-weapon-preview-index.json' with {type:'json'};

function richLines(source,base,width,size,context){
  // Weapon descriptions carry Unity color tags. Keep the actual highlighted
  // names and values together across CJK line breaks.
  const style=[base],lines=[[]];let used=0;
  const groups=String(source).split(/(<color=[^>]+>|<\/color>|\n)/gi);
  for(const part of groups){
    const open=part.match(/^<color=([^>]+)>$/i);
    if(open){style.push(open[1].toLowerCase()==='#0e7311'?'#196343':'#805019');continue;}
    if(/^<\/color>$/i.test(part)){if(style.length>1)style.pop();continue;}
    if(part==='\n'){lines.push([]);used=0;continue;}
    const color=style.at(-1),weight=style.length>1?700:400;context.font=weight+' '+size+'px '+bodyFont;
    for(const c of part){const cw=context.measureText(c).width;
      if(used>0&&used+cw>width){lines.push([]);used=0;}
      const line=lines.at(-1),prev=line.at(-1);
      if(prev?.color===color&&prev.weight===weight)prev.text+=c;else line.push({text:c,color,weight,dx:used});used+=cw;
    }
  }
  return lines;
}
function statRows(rows,names){
  return (rows||[]).map(value=>{const [key,amount]=value.split('=');return (names[key]||key)+'   '+(Number(amount)>=0?'+':'')+amount+(key.endsWith('%')?'%':'');}).join('\n');
}
export function skillPreview(data,w,h,t,row){
  const g=data.modal.kind,gun=g==='guns',sz=clamp(.032*w,11,14),lineH=sz*1.5;
  const common=new Set(row.stage.skills.filter(s=>row.stages.every(st=>st.skills.some(v=>v.id===s.id))).map(v=>v.id));
  function effects(st){const specific=st.skills.filter(sk=>!common.has(sk.id));return gun&&specific.length?specific:st.skills;}
  const stage=row.stages.find(st=>st.star===(row.star||row.defaultStar))||row.stage,active=effects(stage);
  const title=gun?plain(active[0]?.name||row.name):active.map(v=>plain(v.name)).join('、')||'星级效果';
  const icon=gun?nativeWeaponSkillArt(row):active[0]&&nativeSkillArt(active[0]);
  detailSheet(t,data,w,h,{title:!gun&&!row.stages.some(st=>st.skills.length||st.attributes.length)?row.name:'技能预览',bottom:.07*w,build:r=>{
    if(!gun&&!row.stages.some(st=>st.skills.length||st.attributes.length)){r.text('暂无星级效果。');return;}
    const size=Math.min(76,.18*w);r.custom(size,(a,b)=>{const x=(w-size)/2; slice(a,t,qualityFrame(2),box(x,b.y,size,size),5);
      skill(a,t,icon||projectIconUrl(gun?'nav-skill':'skill-tab'),box(x+size*.11,b.y+size*.11,size*.78,size*.78));});r.gap(.015*w);
    r.custom(24,(a,b)=>{const cy=b.y+12,m=words(a,title,w/2,cy,Math.max(16,.04*w),{weight:700,color:'#243f59',maxWidth:b.w*.68});
      const gap=.02*w+m.scale.x/2,len=Math.min(.17*w,b.w/2-gap);if(len>0){a.quad(w/2-gap-len,cy,len,1,'#839eaf');a.quad(w/2+gap,cy,len,1,'#839eaf');}});r.gap(.03*w);
    row.stages.forEach((st,i)=>{
      const on=row.owned&&row.star>=st.star,text=gun?effects(st).map(v=>v.description).join('\n'):st.skills.map(compactStarSkillDescription).join('\n');
      const copy=text||(st.attributes.length&&!gun?statRows(st.attributes,data.snapshot.replicaCollection.attributeNames):'该星级无技能效果。');
      const left=.02*w,sw=.16*w,gap=.015*w,ix=left+sw+gap;
      const lines=richLines(copy,'#203b50',r.width-ix-left,sz,data.sheetMetrics.context),rh=Math.max(.10*w,lines.length*lineH+.032*w);
      r.custom(rh,(a,b)=>{
        a.quad(b.x,b.y,b.w,b.h,on?'#d5eadf':'#cfdeea');
        const edge=slice(a,t,qualityFrame(0),b,3);edge.geometry.setIndex(Array.from({length:54},(_,i)=>i).filter(i=>i<24||i>=30));
        const cy=b.y+b.h/2;stars(a,t,box(b.x+left,cy-.016*w,sw,.032*w),st.star,on?st.star:0);
        const y=cy-(lines.length-1)*lineH/2;
        lines.forEach((line,n)=>line.forEach(run=>words(a,run.text,b.x+ix+run.dx-2,y+n*lineH,sz,{align:'left',color:run.color,weight:run.weight})));
      });if(i<row.stages.length-1)r.gap(.015*w);
    });
  }});
}
export function weaponPreview(data,w,h,t,row){
  const coll=data.snapshot.replicaCollection,base=coll.guns.find(v=>v.id===nativeWeaponGroupId(row))||row;
  const family=base.stage.skills.map(skill=>preview.families[skill.id]).find(Boolean),growth=data.modal.mode!=='base',title=growth?'局内成长':'基础攻击',icon=nativeWeaponSkillArt(growth?row:base);
  detailSheet(t,data,w,h,{title,secondary:true,width:.92*w,build:r=>{
    r.gap(4);r.custom(66,(a,b)=>{const iconBox=box(b.x+5,b.y,66,66);slice(a,t,qualityFrame(2),iconBox,5);if(icon)skill(a,t,icon,box(iconBox.x+4,b.y+4,58,58));
      words(a,row.name,b.x+81,b.y+(growth?24:33),18,{align:'left',color:'#213e52',weight:700,maxWidth:b.w-82});
      if(growth)words(a,'局内升级效果',b.x+81,b.y+49,12,{align:'left',color:'#526b7d'});});r.gap(12);
    if(!growth){r.indent(5);r.text(plain(family?.description||row.stage.skills[0]?.description||row.description),{size:16,lineHeight:24.8});r.indent(-5);r.gap(7);return;}
    const stages=family?.stages.filter(v=>v.star>1)||[];if(!stages.length)r.text('暂无成长效果');
    for(const st of stages){
      const name=st.label||(st.kind==='breakthrough'?'突破':st.kind==='minor'?'强化':'升级');
      r.custom(36,(a,b)=>{a.quad(b.x,b.y,b.w,b.h,'#38566d');a.quad(b.x,b.y+b.h-2,b.w,2,st.kind==='breakthrough'?'#d9b65f':'#70bad4');stars(a,t,box(b.x+9,b.y+9,18,18),1,1);
        words(a,st.star+' 星',b.x+29,b.y+18,15,{align:'left',color:'#ffe29a'});words(a,name,b.x+74,b.y+18,16,{align:'left'});});
      for(const opt of st.options?.length?st.options:[{description:st.description}])r.block(v=>{
        if(opt.name&&plain(opt.name)!==row.name)v.text(plain(opt.name),{weight:700,size:16,color:'#173b52'});
        v.text(plain(opt.description),{size:14,lineHeight:21,color:'#355267'});if(opt.note)v.text(plain(opt.note),{size:12,color:'#597182'});
      },{pad:10,color:'#dce8ef',alpha:1,radius:0});r.gap(12);
    }
    r.text('候选效果 · 选取后仅本局生效',{align:'center',size:12,color:'#536b80'});
  }});
}

