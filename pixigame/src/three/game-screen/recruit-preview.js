import {box,clamp,pic,words,titleFont} from './menu-art.js';
import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {recruitPreviewModel} from './recruit-model.js';

function layout(data,w,h,t){
  const {direct,sections,title}=data.preview,pw=.90*w,u=w/750,header=w/6;
  const font=direct?clamp(.03*w,11,13):clamp(.03*w,10,14),detailFont=direct?clamp(.033*w,12,14):clamp(.04*w,13,18);
  const icon=direct?clamp(.11*w,36,48):clamp(.10*w,28,44),cols=direct?4:3,gx=direct ? .01*w : 8,gy=direct ? .02*w : 4;
  const pad=direct ? .02*w : 0,edge=40*u+pad,ix=(w-pw)/2+edge,bw=pw-2*edge,cell=(bw-(cols-1)*gx)/cols,inner=direct ? .01*w : 8;
  const nameH=(direct?2.6:1.3)*font,dh=1.2*detailFont,tile=2*inner+icon+4+nameH+4+dh,hs=clamp(32*u,16,22);
  const topPad=pad,bottom=40*u,headH=1.5*hs+.015*w,sectionGap=.04*w+1;
  const contentH=2*pad+sections.reduce((sum,s,i)=>{
    const rows=Math.ceil(s.rows.length/cols);return sum+(s.heading?headH:0)+(i?sectionGap:0)+rows*tile+Math.max(0,rows-1)*gy;
  },0)+12*u;
  const ph=Math.min(h*.88,header+contentH+bottom),p=paintLobbyPaper(t,{safeBottom:data.safeBottom,backdropAlpha:.78},w,h,pw,ph,header,title);
  if(direct){
    const ledge=p.a.quad(p.x+.025*w,p.y+.12*w,pw-.05*w,ph-.15*w,'#cfdeea');
    const size=ledge.scale;
    ledge.material.onBeforeCompile=s=>{s.vertexShader='varying vec2 previewUv;\n'+s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\npreviewUv=uv;');
      s.fragmentShader='varying vec2 previewUv;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',
        '#include <color_fragment>\nfloat side=clamp(min(previewUv.x,1.-previewUv.x)*'+(size.x/(.02*w)).toFixed(5)+',0.,1.);float top=clamp((1.-previewUv.y)*'+(Math.abs(size.y)/(.05*w)).toFixed(5)+',0.,1.);float bottom=clamp(previewUv.y*'+(Math.abs(size.y)/(.02*w)).toFixed(5)+',0.,1.);diffuseColor.a*=side*min(top,bottom);');};
  }
  const vh=ph-header-bottom;t.region('base',box(ix-pad-6,p.top,bw+2*pad+12,Math.max(1,vh)),contentH);
  const a=t.layer('recruit-possibilities','base').art;let y=p.top+topPad;
  sections.forEach((s,k)=>{
    if(k){y+=.02*w;a.quad(ix,y,bw,1,'#91aabd');y+=1+.02*w;}
    if(s.heading){words(a,s.heading,ix-2,y+.75*hs,hs,{family:titleFont,align:'left',color:'#18384e'});y+=headH;}
    s.rows.forEach((row,i)=>{
      const cx=ix+(i%cols)*(cell+gx)+cell/2,sy=y+Math.floor(i/cols)*(tile+gy)+inner;
      pic(a,t,row.image,box(cx-icon/2,sy,icon,icon),true);
      const ly=sy+icon+4;words(a,row.name,cx,ly+nameH/2,font,{color:'#142f45',weight:600,wrap:true,maxWidth:cell,lineHeight:1.3*font});
      if(row.detail)words(a,row.detail,cx,ly+nameH+4+dh/2,detailFont,{weight:700,color:'#254b66'});
    });
    const rows=Math.ceil(s.rows.length/cols);y+=rows*tile+Math.max(0,rows-1)*gy;
  });
  return 'base';
}
export function openRecruitPreview(screen,host,send){
  const panel=createLobbyPanel(screen,host,'招募奖励',layout,c=>{if(c.type==='close')send('close',{},host);});
  return {host,close:panel.close,update(snapshot,_modal,signature){const preview=recruitPreviewModel(snapshot);
    panel.update({preview,safeBottom:screen.menuView?.safeBottom||0},signature,'recruit-preview');}};
}
