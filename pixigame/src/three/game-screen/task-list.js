import {area,box,pic,slice,words,clamp,bodyFont,titleFont} from './menu-art.js';
import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {taskReward} from './task-model.js';
import {createTextureCanvas,surfaceFontFamily} from '../../ui/three-surface.js';

let measureContext;
export const taskMedal='/art/project-task-icons-v1/activity-medal.png';
const disabledSkin=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
  '#include <map_fragment>\nfloat gray=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722)); diffuseColor.rgb=vec3(gray)*.38;');};

export function taskTab(a,t,b,label,selected,size,locked){
  const plate=slice(a,t,'/art/project-tabs-v1/tab-'+(selected?'active':'inactive')+'.png',b,Math.min(9,b.h*.3),36);
  let color=selected?'#163650':'#d1dce8';
  if(locked!==undefined){
    const shade=locked?[.225,.335]:[.006,.026];
    plate.material.onBeforeCompile=shader=>{
      shader.uniforms.dateTabShade={value:shade};
      shader.fragmentShader='uniform vec2 dateTabShade;\n'+shader.fragmentShader.replace('#include <map_fragment>',
        `#include <map_fragment>
        float shade = dot(diffuseColor.rgb, vec3(.2126,.7152,.0722));
        float corner = smoothstep(.10,.35,diffuseColor.r-diffuseColor.b);
        float face = mix(dateTabShade.x,dateTabShade.y,shade);
        diffuseColor.rgb = vec3(mix(face,.56,corner));`);
    };
    color=locked?'#171717':'#f5f5f5';
  }
  words(a,label,b.x+b.w/2,b.y+b.h/2,size,{family:titleFont,color,maxWidth:b.w-8});
}
export function taskPlate(a,b,ready,claimed){
  a.quad(b.x,b.y,b.w,b.h,ready?'#69a5bb':'#91adbf');
  a.quad(b.x+1,b.y+1,b.w-2,b.h-2,claimed?'#b6cad8':ready?'#e0f0f6':'#cbdde9');
}
export function taskButton(a,t,w,b,row){
  const first=a.group.children.length;
  const file=row.label==='前往'?'/art/psd-equipment-v1/button-gold.png':row.label==='领取'&&row.payload?.operation!=='weeklyTask'?'/art/project-action-buttons-v1/task-claim.png':'/art/psd-buttons-v1/button-blue.png';
  const m=slice(a,t,file,box(b.x,b.y+3,b.w,b.h-6),10);
  if(row.disabled)m.material.onBeforeCompile=disabledSkin;
  words(a,row.label,b.x+b.w/2,b.y+b.h/2,clamp(w*.036,13,16),{family:titleFont,weight:700,color:row.disabled?'#bac8d2':'#edf4f7',shadow:{color:'#233744',y:1,blur:2}});
  if(!row.disabled)t.buttonFace?.('action-'+row.id,b,a,first);
}
export function taskProgress(a,b,w,row){
  a.quad(b.x,b.y,b.w,b.h,'#6e8ca4');a.quad(b.x+1,b.y+1,b.w-2,b.h-2,'#9eb6c9');
  const f=clamp(row.progress/Math.max(1,row.target),0,1);
  if(f)a.quad(b.x+1,b.y+1,(b.w-2)*f,b.h-2,'#53b7db');
  words(a,row.progress+' / '+row.target,b.x+b.w/2,b.y+b.h/2,clamp(w*.03,11,15),{weight:500,color:'#17334d',maxWidth:Math.max(1,b.w-4)});
}
export function rewardSlot(t,a,s,row,b,id,zone,draw=true,claimed=false,signIn=false){
  const item=taskReward(row,s,signIn);
  if(draw){
    const start=a.group.children.length;
    paintRewardItemSlot(a,item,{x:b.x,y:b.y,size:b.w},t.image);
    if(claimed){
      const art=a.group.children[start+1];if(art)art.material.opacity=.45;
      pic(a,t,'/art/project-signin-icons-v2/claimed.png',b,true);
    }
  }
  area(t,id,item.name,b,'inspect',item,zone);
}
// Build hit regions for the whole ledger. Only the visible rows allocate meshes or text textures.
export function taskPageFade(a,t,switched){
  if(!switched||performance.now()/1000-switched>=.17)return;
  const painted=a.group.children.map(m=>[m,m.material.opacity]);
  t.animate(now=>{const p=clamp((now-switched)/.17,0,1);for(const [m,opacity] of painted)m.material.opacity=opacity*(.45+.55*p);return p<1;});
}
export function taskList(s,rows,w,t,clip,zone,achievements=false,switched=0,initial=0){
  const pad=(achievements?.025:.02)*w+1,gap=.02*w,x=clip.x+.006*w,bw=clip.w-.012*w;
  const fs=achievements?Math.max(16,clamp(w*.039,14,20)):clamp(w*.039,14,20);
  const buttonW=clamp(bw/3,44,80),buttonH=44,trackH=Math.max(15,.04*w),side=.095*w;
  const actionCol=Math.max(64,w*.19),badgeW=.08*w;
  const innerW=bw-2*pad,labelW=achievements?innerW:Math.max(1,innerW-badgeW-buttonW-2*gap);
  const ctx=measureContext??=createTextureCanvas({measurement:true}).getContext('2d');
  ctx.font='400 '+fs+'px '+titleFont;
  const wrap=name=>{let line='',count=1;for(const ch of String(name)){if(line&&ctx.measureText(line+ch).width>labelW){line='';count++;}line+=ch;}return count;};
  let y=clip.y+(achievements?.01*w:0);
  const positions=rows.map(row=>{
    const titleH=wrap(row.name)*fs*1.5,extra=!achievements&&row.rewards.length?w*.04+gap:0;
    const content=titleH+gap+trackH+extra;
    const slots=Math.max(1,Math.floor((innerW-actionCol-gap+.01*w)/(side+.01*w))),slotRows=Math.ceil(row.rewards.length/slots);
    const foot=Math.max(buttonH,slotRows*side+Math.max(0,slotRows-1)*.01*w);
    const height=achievements?Math.max(.29*w,2*pad+content+gap+foot):Math.max(.185*w,2*pad+Math.max(content,buttonH,badgeW+clamp(.03*w,11,15)*1.2+.005*w));
    const top=y;y+=height+gap;return {row,top,height,titleH,content,foot,slots};
  });
  t.region(zone,clip,Math.max(0,y-clip.y-gap),'y',{parent:'base',redrawStep:40,initial});
  const a=t.layer('task-list',zone).art,offset=t.offset(zone);
  for(const {row,top,height,titleH,content,foot,slots} of positions){
    const draw=top+height>=clip.y+offset-45&&top<=clip.y+offset+clip.h+45;
    const by=achievements?top+pad+content+gap+(foot-buttonH)/2:top+(height-buttonH)/2;
    const b=box(achievements?x+bw-pad-actionCol:x+bw-pad-buttonW,by,buttonW,buttonH);
    const tx=achievements?x+pad:x+pad+badgeW+gap,ty=achievements?top+pad:top+(height-content)/2;
    if(draw){
      taskPlate(a,box(x,top,bw,height),row.ready,row.claimed);
      if(!achievements){
        const fsBadge=clamp(.03*w,11,15),badgeH=badgeW+.005*w+fsBadge*1.2,badgeY=top+(height-badgeH)/2;
        const mesh=pic(a,t,taskMedal,box(x+pad,badgeY,badgeW,badgeW),true);if(row.claimed)mesh.material.opacity=.6;
        words(a,'+'+(row.points||0),x+pad+badgeW/2,badgeY+badgeH-fsBadge*.6,fsBadge,{color:'#2f5872'});
      }
      words(a,row.name,tx,ty+titleH/2,fs,{family:titleFont,color:'#1b354d',align:'left',wrap:true,maxWidth:labelW,lineHeight:1.5*fs});
      taskProgress(a,box(tx,ty+content-trackH,labelW,trackH),w,row);
      if(row.action)taskButton(a,t,w,b,row);
    }
    row.rewards.forEach((r,i)=>{
      if(achievements){
        const cell=box(x+pad+(i%slots)*(side+.01*w),top+pad+content+gap+Math.max(0,(foot-side)/2)*(row.rewards.length<=slots?1:0)+Math.floor(i/slots)*(side+.01*w),side,side);
        rewardSlot(t,a,s,r,cell,'prize-'+row.id+'-'+i,zone,draw);
      }else if(draw){const item=taskReward(r,s),cx=tx+i*.12*w;pic(a,t,item.image,box(cx,ty+titleH+.005*w,.04*w,.04*w),true);words(a,'×'+item.amount,cx+.043*w,ty+titleH+.026*w,.028*w,{align:'left',color:'#284c65'});}
    });
    if(row.action)area(t,'action-'+row.id,row.label+'，'+row.name,b,row.action,row.payload,zone,Boolean(row.disabled));
  }
  taskPageFade(a,t,switched);
}


function carnivalTitleLines(name,width,ctx){
  return name.split('\n').flatMap(paragraph=>{
    const lines=[];
    let line='';
    for(const part of paragraph.match(/\d+(?:[.,]\d+)*[次级点章关件天个波星架枚万亿]?|./gu)??[]){
      if(line&&ctx.measureText(line+part).width>width){lines.push(line.trimEnd());line='';}
      if(line||part.trim())line+=part;
    }
    lines.push(line.trimEnd());
    return lines;
  });
}

export function carnivalTaskList(snapshot,rows,taskPrize,w,t,clip,zone){
  const x=clip.x+.006*w,width=clip.w-.012*w,pad=.02*w+1,innerX=x+pad,right=x+width-pad,innerWidth=right-innerX;
  const gap=clamp(w*.016,5,8),rowGap=.02*w,buttonW=clamp(width/3,44,80),buttonH=44;
  const headingSize=clamp(w*.039,13,16),minHeadingSize=clamp(w*.033,11.5,13.5),counterSize=clamp(w*.03,11,14);
  const rewardSize=clamp(w*.03,11,14),side=clamp(w*.048,14,20),reward=taskReward(taskPrize,snapshot);
  const ctx=measureContext??=createTextureCanvas({measurement:true}).getContext('2d');
  const headingFamily=surfaceFontFamily(titleFont);
  let y=clip.y;
  const positions=rows.map(row=>{
    const counter=row.progress+' / '+row.target;
    ctx.font='700 '+counterSize+'px '+bodyFont;
    const counterW=Math.min(innerWidth*.37,Math.ceil(ctx.measureText(counter).width)+3);
    ctx.font='400 '+headingSize+'px '+headingFamily;
    const natural=ctx.measureText(row.name).width,inlineW=innerWidth-counterW-gap;
    const inline=natural*minHeadingSize/headingSize<=inlineW;
    const titleW=inline?inlineW:innerWidth;
    const size=clamp(headingSize*titleW/Math.max(1,natural),minHeadingSize,headingSize);
    ctx.font='400 '+size+'px '+headingFamily;
    const lines=carnivalTitleLines(row.name,titleW,ctx),lineH=size*1.38;
    const titleH=size*1.65+(lines.length-1)*lineH,headH=titleH+(inline?0:counterSize*1.45);
    const counterY=y+pad+(inline?size*.825:titleH+counterSize*.725);
    const footerY=y+pad+headH+gap,height=2*pad+headH+gap+buttonH;
    const top=y;
    y+=height+rowGap;
    return {row,top,height,lines,size,lineH,titleW,counter,counterW,counterY,footerY};
  });
  t.region(zone,clip,Math.max(0,y-clip.y-rowGap),'y',{parent:'base',redrawStep:40});
  const a=t.layer('task-list',zone).art,offset=t.offset(zone);
  for(const {row,top,height,lines,size,lineH,titleW,counter,counterW,counterY,footerY} of positions){
    const button=box(right-buttonW,footerY,buttonW,buttonH),midY=footerY+buttonH/2;
    if(top+height>=clip.y+offset-45&&top<=clip.y+offset+clip.h+45){
      taskPlate(a,box(x,top,width,height),row.ready,row.claimed);
      for(const [i,line] of lines.entries())
        words(a,line,innerX,top+pad+size*.825+i*lineH,size,{family:titleFont,color:'#1b354d',align:'left',maxWidth:titleW});
      words(a,counter,right,counterY,counterSize,{align:'right',color:row.ready?'#236481':'#294c66',weight:700,maxWidth:counterW});
      const pointsX=innerX+side+3,prizeX=innerX+(button.x-innerX-gap)*.5;
      const opacity=row.claimed ? .6 : 1;
      const medal=pic(a,t,taskMedal,box(innerX,midY-side/2,side,side),true);medal.material.opacity=opacity;
      words(a,'+'+row.points,pointsX,midY,rewardSize,{align:'left',color:'#2f5872',maxWidth:prizeX-pointsX-2});
      const item=pic(a,t,reward.image,box(prizeX,midY-side/2,side,side),true);item.material.opacity=opacity;
      words(a,'×'+reward.amount,prizeX+side+3,midY,rewardSize,
        {align:'left',color:'#284c65',maxWidth:button.x-prizeX-side-gap});
      if(row.action)taskButton(a,t,w,button,row);
    }
    if(row.action)area(t,'action-'+row.id,row.label+'，'+row.name,button,row.action,row.payload,zone,Boolean(row.disabled));
  }
}
