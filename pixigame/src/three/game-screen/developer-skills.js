import {createLobbyPanel} from './lobby-panel.js';
import {createTextField} from './text-field.js';
import {developerSkillTabs,developerSkillPage,canOpenDeveloperSkills} from '../../../replica-battle/developer-skill-menu-model';
import {area,box,pic,slice,words} from './menu-art.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';

const family='"Microsoft YaHei",sans-serif',ink='#123345';
const help='武器、升级、驾驶员与飞机技能均可选。仅本局生效。';
function launcher(w,h){return box(w-86,h*.18,76,36);}
function control(a,t,b,id,text,command,data,size=14,selected=false){
  const m=slice(a,t,'/art/psd-buttons-v1/button-blue.png',b,12);
  if(selected)m.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',
    '#include <map_fragment>\ndiffuseColor.rgb=sRGBTransferEOTF(vec4(clamp(sRGBTransferOETF(diffuseColor).rgb*1.45,0.,1.),1.)).rgb;');};
  words(a,text,b.x+b.w/2,b.y+b.h/2,size,{weight:400,family,color:'#edf4f7'});
  if(t.keyFocus===id)a.line([[b.x+2,b.y+2],[b.x+b.w-2,b.y+2],[b.x+b.w-2,b.y+b.h-2],[b.x+2,b.y+b.h-2],[b.x+2,b.y+2]],'#f1f7ff');
  area(t,id,text,b,command,data);
}
function wrap(ctx,text,width,size,bold=false){
  ctx.font=(bold?'700 ':'400 ')+size+'px '+family;
  const lines=[];
  for(const paragraph of String(text).split('\n')){
    let line='';for(const ch of paragraph){if(line&&ctx.measureText(line+ch).width>width){lines.push(line);line='';}line+=ch;}lines.push(line);
  }
  return lines;
}
function lines(a,content,x,y,size,weight,color,maxWidth){
  for(const [i,s] of content.entries())if(s)words(a,s,x-2,y+(i+.5)*size*1.45,size,{family,weight,align:'left',color,maxWidth});
}
function layoutMenu(model,w,h,t){
  const {page,ctx,field}=model,a=t.layer('developer-skills').art;
  if(!model.open){control(a,t,launcher(w,h),'launch','全部技能','open',{},13);return;}
  const x=22,width=w-44,leftWidth=width-18,more=page.more,labels=wrap(ctx,help,width,12);
  const error=model.error?wrap(ctx,model.error,width,12):[],helpH=labels.length*17.4,errorH=error.length*17.4;
  const rows=page.rows.map(row=>{
    ctx.font='700 12px '+family;const copy=Math.max(14,leftWidth-10-ctx.measureText(row.status).width);
    const name=wrap(ctx,row.name,copy,14,true),label=wrap(ctx,row.label,copy,11),desc=row.description?wrap(ctx,row.description,copy,12):[];
    const height=22+name.length*20.3+label.length*15.95+desc.length*17.4+4;
    return {...row,copy,name,label,desc,height};
  });
  const natural=rows.reduce((sum,r,i)=>sum+r.height+(i?6:0),0),fixed=40+40+8+helpH+8+40+8+38+8+(errorH?errorH+8:0)+(more?48:0);
  const ph=Math.min((h-16)*.92,fixed+Math.max(100,natural)),y=(h-ph)/2,top=y+20;
  a.quad(0,0,w,h,'#020d18',184/255);
  const frame=pic(a,t,'/art/weapon-catalog-psd-v1/frame-blue.png',box(8,y,w-16,ph));
  frame.geometry.dispose();frame.geometry=slicedFrameGeometry(w-16,ph,224,562,[24,24,40,24],[12,12,18,12]);
  a.quad(18,y+10,w-36,ph-20,'#afc2d1');
  words(a,'全部技能',x-2,top+20,20,{align:'left',color:ink,weight:700,family});
  control(a,t,box(x+width-52,top,52,40),'close','返回','close',{});
  let sy=top+48;lines(a,labels,x,sy,12,400,ink,width);sy+=helpH+8;
  const tabWidth=(width-16)/5;
  for(const [i,[id,title]] of Object.entries(developerSkillTabs).entries())
    control(a,t,box(x+i*(tabWidth+4),sy,tabWidth,40),'tab-'+id,title,'category',{id},12,model.tab===id);
  sy+=48;const count=page.total+' 项';ctx.font='12px '+family;const countW=ctx.measureText(count).width;
  const search=box(x,sy,width-8-countW,38);
  words(a,count,x+width+2,sy+19,12,{family,align:'right',color:ink,weight:400});
  area(t,'search','搜索技能',search,'search');field.draw(a,t,search,false,'搜索技能或驾驶员、飞机');
  sy+=46;if(errorH){lines(a,error,x,sy,12,400,'#a4232a',width);sy+=errorH+8;}
  const listH=Math.max(0,ph-fixed),clip=box(x,sy,width,listH);t.region('base',clip,natural,'y',{redrawStep:36});
  const body=t.layer('skill-list','base').art,offset=t.offset('base');
  if(!rows.length)lines(body,['没有找到匹配的技能'],x,sy,12,400,ink,width);
  for(const row of rows){
    const b=box(x,sy,width,row.height),id='skill-'+row.id;
    if(sy+row.height>=clip.y+offset-40&&sy<=clip.y+offset+clip.h+40){
      body.quad(x,sy,width,row.height,row.disabled?'#8ca3b2':'#6f8a99');
      body.quad(x+1,sy+1,width-2,row.height-2,row.disabled?'#cddae3':'#e5eef2');
      let textY=sy+11;const color=row.disabled?'#597382':ink;
      lines(body,row.name,x+9,textY,14,700,color,row.copy);textY+=row.name.length*20.3+2;
      lines(body,row.label,x+9,textY,11,400,row.disabled?'#78909f':'#4c6877',row.copy);textY+=row.label.length*15.95+2;
      lines(body,row.desc,x+9,textY,12,400,color,row.copy);
      words(body,row.status,x+width-7,sy+row.height/2,12,{align:'right',family,weight:700,color});
      if(t.keyFocus===id)body.line([[x+1,sy+1],[x+width-1,sy+1],[x+width-1,sy+row.height-1],[x+1,sy+row.height-1],[x+1,sy+1]],'#2d81a6',1,2);
    }
    area(t,id,row.name[0]+'，'+row.status,b,'skill',{id:row.id},'base',row.disabled);sy+=row.height+6;
  }
  if(more)control(a,t,box(x,y+ph-60,width,40),'more','显示更多','more',{});
}

export function mountThreeDeveloperSkills(screen,stage,sim,audio,ui){
  const doc=stage.ownerDocument,win=doc.defaultView,host=doc.createElement('div'),abort=new AbortController(),ctx=doc.createElement('canvas').getContext('2d');
  host.style.cssText='position:fixed;z-index:1;pointer-events:none';host.hidden=true;stage.after(host);
  let open=false,available=false,resume=false,suppressed=false,tab='all',query='',error='',limit=45,field=null,revision=0,closed=false,page;
  const panel=createLobbyPanel(screen,host,'全部技能',layoutMenu,action,{battle:true,interactive:()=>available,handlesKey:k=>open||k==='Enter'||k===' '});
  const surface=panel.surface;
  function cover(){
    const rect=stage.getBoundingClientRect();Object.assign(host.style,{left:rect.x+'px',top:rect.y+'px',width:rect.width+'px',height:rect.height+'px'});
    const b=launcher(rect.width,rect.height);
    surface.style.clipPath=open?'none':'inset('+b.y+'px 10px '+Math.max(0,rect.height-b.y-b.h)+'px '+Math.max(0,b.x)+'px)';
    surface.setAttribute('role',open?'dialog':'button');if(open)surface.setAttribute('aria-modal','true');else surface.removeAttribute('aria-modal');
    surface.setAttribute('aria-label',open?'全部技能':'打开全部技能');
  }
  function refresh(relist=false){
    if(closed)return;
    if(open&&(relist||!page))page=developerSkillPage(sim,tab,query,limit);
    panel.update({open,page,tab,query,error,field,ctx},++revision,open?'skill-menu':'skill-launch');
  }
  function enter(){
    if(open||!canOpenDeveloperSkills(sim))return;
    resume=sim.phase==='playing';if(resume)sim.pause();audio.pause();open=true;error='';
    field=createTextField(surface,query,value=>{
      if(value!==query){query=value;limit=45;panel.scroll('base',0);refresh(true);}else panel.invalidate();
    },()=>surface.focus({preventScroll:true}),leave,()=>{}, {label:'搜索技能',placeholder:'搜索技能或驾驶员、飞机',size:12,autoFocus:false,search:true});
    cover();refresh(true);surface.focus({preventScroll:true});
  }
  function leave(){
    if(!open)return;open=false;suppressed=sim.phase==='upgrade';field?.close();field=null;
    if(resume&&sim.phase==='paused')sim.resume();if(sim.phase==='playing')audio.resume();resume=false;
    cover();refresh();surface.focus({preventScroll:true});
  }
  function action(cmd){
    if(cmd.type==='open')return enter();if(cmd.type==='close')return leave();if(!open)return;
    if(cmd.type==='search'){field.focus();return;}
    if(cmd.type==='category'){tab=cmd.data.id;limit=45;panel.scroll('base',0);refresh(true);return;}
    if(cmd.type==='more'){limit+=45;refresh(true);return;}
    if(cmd.type==='skill'){
      try{if(!sim.learnDeveloperSkill(cmd.data.id))return;audio.feedback('upgrade');leave();ui.update();}
      catch(reason){error=reason instanceof Error?reason.message:String(reason);refresh(true);}
    }
  }
  surface.addEventListener('keydown',e=>{if(open||e.key==='Enter'||e.key===' ')e.stopPropagation();},{signal:abort.signal});
  const resize=new ResizeObserver(cover);resize.observe(stage);win.addEventListener('resize',cover,{signal:abort.signal});
  win.addEventListener('scroll',cover,{capture:true,passive:true,signal:abort.signal});cover();refresh();
  const previous=ui.update.bind(ui);
  ui.update=()=>{
    previous();const next=canOpenDeveloperSkills(sim);
    if(next!==available){available=next;host.hidden=!next;
      if(!next&&open){open=false;resume=false;field?.close();field=null;cover();}refresh();}
    if(sim.phase!=='upgrade')suppressed=false;
    if(available&&sim.phase==='upgrade'&&!open&&!suppressed)enter();
  };
  return {draw(){if(available&&!closed)panel.draw(screen.three);},destroy(){
    closed=true;ui.update=previous;abort.abort();resize.disconnect();field?.close();panel.close();host.remove();
  }};
}
