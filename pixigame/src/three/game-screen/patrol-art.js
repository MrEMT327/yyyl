import {area,box,pic,slice,words,clamp,titleFont} from './menu-art.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';
export {paintSecondaryPaper as quickPaper} from './panel-paper.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {nativeItemArt} from '../../replica/native-item-presentation.js';
export const patrolSceneHeight=w=>clamp(w*.26,90,132);
export const patrolAircraftRect=(w,h)=>box(0,0,(w*(696-80)/750)*.74,patrolSceneHeight(w)*.70);
export function paintPatrolScene(a,t,data,w,x,y,bw){
  const s=data.snapshot,p=s.patrol,bh=patrolSceneHeight(w),sky=pic(a,t,'/art/project-patrol-v5/airway-soft.png',box(x,y,bw,bh));
  const phase={value:0},weave=t.texture('/art/project-workshop-background-v2/psd-scanlines.png');
  sky.material.onBeforeCompile=sh=>{
    sh.uniforms.drift=phase;sh.uniforms.patrolWeave={value:weave};
    const weaveW=w*1.02,weaveH=weaveW*2142/765;
    sh.fragmentShader='uniform float drift;uniform sampler2D patrolWeave;\n'+sh.fragmentShader.replace('#include <map_fragment>',`
      float pos=fract(vMapUv.x+.07+drift);
      vec4 front=texture2D(map,vec2(pos/1.14,vMapUv.y));
      vec4 prev=texture2D(map,vec2(min(1.,(pos+1.)/1.14),vMapUv.y));
      vec4 sky=mix(prev,front,clamp(pos/.14022,0.,1.));
      vec2 weaveUv=vec2((vMapUv.x*${bw.toFixed(5)}+${(w*.008).toFixed(5)})/${weaveW.toFixed(5)},1.-((1.-vMapUv.y)*${bh.toFixed(5)}+${(w*.036).toFixed(5)})/${weaveH.toFixed(5)});
      vec4 pattern=texture2D(patrolWeave,weaveUv);
      vec3 base=sRGBTransferOETF(sky).rgb,over=sRGBTransferOETF(pattern).rgb;
      vec3 blend=mix(2.*base*over,1.-2.*(1.-base)*(1.-over),step(vec3(.5),base));
      diffuseColor*=sRGBTransferEOTF(vec4(mix(base,blend,pattern.a),1.));`);};
  sky.material.customProgramCacheKey=()=>[w,bw,bh].join(',');
  if(!data.reduced&&p.unlocked)t.animate(now=>{phase.value=((now-data.entered)/26)%1;});
  const cell=patrolAircraftRect(w),modelX=x+bw*.14,modelY=y+bh*.25;
  if(data.preview.ready){
    const fit=Math.min(cell.w,cell.h*2.5);
    data.preview.paint(a,modelX+(cell.w-fit)/2,modelY,fit,cell.h);
  }else pic(a,t,data.aircraftStill,box(modelX,modelY,cell.w,cell.h),true);
  const font=clamp(w*.034,12,16),rh=font*1.3+8;
  a.quad(x,y,bw,rh,'#214c6c',.59);a.quad(x,y+rh,bw,1,'#d8efff',.17);
  words(a,data.route,x+bw/2,y+rh/2,font,{family:titleFont,shadow:{color:'#183248',y:1,blur:0},maxWidth:bw-12});
}
export function clockDigits(a,right,y,size,clock){
  const glyphs=new Map();
  for(const c of '0123456789:—'){
    const m=words(a,c,0,0,size,{weight:650,color:'#303039'});m.visible=false;glyphs.set(c,m);
  }
  const cells=Array.from({length:8},()=>a.quad(0,0,1,1,'#fff'));let last=null;
  function update(text){if(text===last)return;last=text;let end=right;
    for(let i=0;i<cells.length;i++){
      const m=cells[i],g=glyphs.get(text[text.length-i-1]);m.visible=!!g;if(!g)continue;
      m.material.map=g.material.map;m.material.needsUpdate=true;m.scale.copy(g.scale);m.position.set(end-g.scale.x/2+2,y,0);end-=g.scale.x-4;
    }
  }
  update(clock.time);return update;
}
export const patrolNumbers=v=>Number(v||0).toLocaleString('zh-CN',{useGrouping:false,maximumFractionDigits:2});
const resources={coins:'金币',weaponParts:'强化零件',aircraftShards:'飞机碎片'};
export function patrolItems(rows,values={}){
  if(rows)return rows.map(r=>({...r,itemId:r.nativeItemId??r.id,image:nativeItemArt(r.artId||r.nativeItemId||r.id)||r.image,amount:r.amount??r.count}));
  return Object.entries(resources).filter(([id])=>values[id]>0).map(([id,name])=>({itemId:id,name,amount:values[id],image:RESOURCE_ICONS[id]?.url}));
}
export function gridLayout(items,width,cols,gap){
  const side=(width-(cols-1)*gap)/cols;let column=0,line=0;
  const cells=items.map(item=>{
    const span=String(patrolNumbers(item.amount)).length>5?2:1;if(column+span>cols){line++;column=0;}
    const b=box(column*(side+gap),line*(side+gap),side*span+(span-1)*gap,side);column+=span;if(column===cols){column=0;line++;}return b;
  });
  return {cells,height:items.length?Math.max(...cells.map(c=>c.y+c.h)):0};
}
export function patrolGrid(a,t,items,w,x,y,layout,quick,zone='base'){
  items.forEach((item,i)=>{
    const cell=layout.cells[i],b=box(x+cell.x,y+cell.y,cell.w,cell.h),font=quick?14:clamp(.027*w,9,13);
    pic(a,t,'/art/weapon-catalog-psd-v1/plate-blue-clean.png',b);
    const frame=pic(a,t,'/art/weapon-catalog-psd-v1/frame-blue.png',b);
    frame.geometry.dispose();frame.geometry=slicedFrameGeometry(b.w,b.h,224,562,[24,24,40,24],.25);
    frame.geometry.setIndex(Array.from({length:54},(_,j)=>j).filter(j=>j<24||j>=30));
    const label=item.amount==null?item.name:'×'+patrolNumbers(item.amount),labelH=font*1.1,iy=b.y+.014*w;
    pic(a,t,item.image,box(b.x+.006*w,iy,b.w-.012*w,Math.max(1,b.h-.032*w-labelH)),true);
    words(a,label,b.x+b.w/2,b.y+b.h-.014*w-labelH/2,font,{color:'#e8f6ff',weight:700,maxWidth:b.w-3,shadow:{color:'#051528',y:1,blur:1}});
    area(t,'patrol-item-'+i,item.name,b,'inspect',item,zone);
  });
}
export function patrolButton(a,t,w,b,id,label,action,data,disabled=false,{icon,short,zone=null,size=17}={}){
  const plate=slice(a,t,'/art/psd-buttons-v1/button-blue.png',b,9);
  if(disabled)plate.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\nvec3 v=sRGBTransferOETF(diffuseColor).rgb;float gray=dot(v,vec3(.2126,.7152,.0722))*.65;diffuseColor.rgb=sRGBTransferEOTF(vec4(vec3(gray),1.)).rgb;');};
  const iconSize=icon?Math.max(16,w*.05):0,space=icon?w*.01:0;
  const labelMesh=words(a,label,b.x+b.w/2+(space+iconSize)/2,b.y+b.h/2,size,{family:titleFont,color:short?'#ffac95':disabled?'#bac8d2':'#edf4f7',maxWidth:b.w-iconSize-10,shadow:{color:'#07131f',y:1,blur:2}});
  if(icon)pic(a,t,icon,box(labelMesh.position.x-labelMesh.scale.x/2-space-iconSize,b.y+(b.h-iconSize)/2,iconSize,iconSize),true);
  area(t,id,label,b,action,data,zone,disabled);
}
