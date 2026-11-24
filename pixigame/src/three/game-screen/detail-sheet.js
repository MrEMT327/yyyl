import {area,bodyFont,box,button,pic,slice,words} from './menu-art.js';
import {paintLobbyPaper,paintSecondaryPaper} from './panel-paper.js';
import {createTextureCanvas} from '../../ui/three-surface.js';

function lineCount(cache,text,width,font,tracking){
  const key=[width,font,tracking,text].join('|');
  if(cache.counts.has(key))return cache.counts.get(key);
  const ctx=cache.context;ctx.font=font;let count=0;
  for(const paragraph of String(text).split('\n')){
    let part='';count++;
    for(const ch of paragraph){
      if(part&&ctx.measureText(part+ch).width+part.length*tracking>width){count++;part='';}
      part+=ch;
    }
  }
  cache.counts.set(key,count);return count;
}
export function sheetMetrics(){
  const canvas=createTextureCanvas({measurement:true});
  return {context:canvas.getContext('2d'),counts:new Map()};
}

// Retain a Three text mesh for each paragraph. Its actual wrapped lines determine
// the height of the next control and of the scrollable page.
export function detailSheet(t,data,w,h,{title,secondary=false,width=w*(secondary?.88:.92),header=secondary?112*w/750:w/6,
  maxHeight=h*.86,minHeight=0,bottom=52*w/750,build}){
  const background=t.layer('detail-paper').art,body=t.layer('detail-body','base').art;
  const left=(w-width)/2+40*w/750,bw=width-80*w/750,targets=[];
  const scroll=t.offset('base'),metrics=data.sheetMetrics;
  const shown=(top,height)=>!metrics||top+height>=scroll-150&&top<=scroll+maxHeight+150;
  let y=0,inset=0;
  const row={
    a:body,t,w,bw,left,get x(){return left+inset;},get width(){return bw-2*inset;},get y(){return y;},
    gap(n){y+=n;},indent(n){inset+=n;},
    custom(height,render){if(shown(y,height))render(body,box(this.x,y,this.width,height));y+=height;},
    text(value,{size=14,lineHeight=size*1.65,color='#243f59',align='left',family,weight=400,pad=0,tracking=0}={}){
      if(metrics){
        const height=lineCount(metrics,value,this.width,weight+' '+size+'px '+(family||bodyFont),tracking)*lineHeight+pad*2;
        if(!shown(y,height)){y+=height;return null;}
      }
      const x=align==='center'?w/2:align==='right'?this.x+this.width+2:this.x-2;
      const mesh=words(body,value,x,0,size,{color,align,family,weight,tracking,wrap:true,maxWidth:this.width,lineHeight});
      const len=mesh.userData.uiTextLines.length*lineHeight;mesh.position.y=y+pad+len/2;y+=2*pad+len;return mesh;
    },
    line(color='#7793a8',alpha=.4){if(shown(y,1))body.quad(this.x,y,this.width,1,color,alpha);y++;},
    art(src,width,height,{frame=null,fit=true,edge=10,scale=1}={}){
      if(!shown(y,height)){y+=height;return;}
      const r=box((w-width)/2,y,width,height);if(frame)slice(body,t,frame,r,edge);
      if(src)pic(body,t,src,box(r.x+(1-scale)*width/2,y+(1-scale)*height/2,width*scale,height*scale),fit);
      y+=height;
    },
    action(id,label,command,payload={},opts={}){
      const {height=48,gold=false,disabled=false,side=0,titleSize=17}=opts;
      const b=box(this.x+side,y,this.width-2*side,height);
      if(shown(y,height))button(body,t,b,{title:label,titleSize,gold,disabled});
      targets.push([id,label,b,command,payload,disabled]);y+=height;
    },
    grid(items,columns,render,{height=44,gap=8}={}){
      const cell=(this.width-(columns-1)*gap)/columns,rh=typeof height==='function'?height(cell):height,start=y;
      for(const [i,item] of items.entries()){
        const b=box(this.x+(i%columns)*(cell+gap),start+Math.floor(i/columns)*(rh+gap),cell,rh);
        const hit=render(body,b,item,shown(b.y,b.h));
        if(hit)targets.push([hit.id,hit.label,b,hit.cmd,hit.data||{},hit.disabled]);
      }
      if(items.length)y=start+Math.ceil(items.length/columns)*(rh+gap)-gap;
    },
    fold(id,label,expanded,{size=15}={}){
      const at=y,depth=this.x;
      this.indent(9);const m=this.text((expanded?'▾ ':'▸ ')+label,{size,color:'#284862',lineHeight:size*1.5,weight:600,pad:8});this.indent(-9);
      const height=Math.max(40,y-at);if(m)m.position.y+=Math.max(0,40-(y-at))/2;
      targets.push(['fold-'+id,label,box(depth,at,this.width,height),'fold',{id}]);y=at+height;
    },
    block(draw,{pad=12,color='#b5c9d7',alpha=.35,radius=5}={}){
      const start=y,x=this.x,width=this.width;
      const bg=body.panel(x,start,width,1,{fill:color,stroke:null,radius:0,cut:0,opacity:alpha});
      this.indent(pad);y+=pad;draw(this);y+=pad;this.indent(-pad);
      // Geometry uses absolute coordinates. Recreate the background only after wrapping.
      const full=body.panel(x,start,width,y-start,{fill:color,stroke:null,radius,cut:0,opacity:alpha});
      bg.geometry.dispose();bg.geometry=full.geometry;full.material.dispose();body.group.remove(full);
    },
  };
  build(row);
  const ph=Math.min(maxHeight,Math.max(minHeight,header+y+bottom)),paper=secondary?
    paintSecondaryPaper(t,w,h,width,ph,title,{header,alpha:data.backdropAlpha??.6,a:background}):
    paintLobbyPaper(t,data,w,h,width,ph,header,title,background);
  for(const m of body.group.children)m.position.y+=paper.top;
  for(const [id,label,b,cmd,payload,disabled] of targets)area(t,id,label,box(b.x,b.y+paper.top,b.w,b.h),cmd,payload,'base',disabled);
  const lower=40*w/750;t.region('base',box(left-12*w/750,paper.top,bw+24*w/750,Math.max(1,ph-header-lower)),y+bottom-lower,'y',{redrawStep:metrics?90:0});
  return paper;
}
