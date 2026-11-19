import {Vector2,Vector4} from 'three';
import {area,box,clamp,pic,slice,titleFont,words} from './menu-art.js';
import {createLobbyPanel} from './lobby-panel.js';
import {paintItemDetail} from './item-details.js';
import {recruitResultsModel} from './recruit-model.js';
import {recruitCard} from './recruit-card.js';
import {animateMeshes} from './ui-motion.js';
import {drawPresentationPlan,initialDrawPresentation,advanceDrawPresentation} from '../../ui/draw-presentation-plan.js';
import {DRAW_GATE_ART,DRAW_GATE_DURATION_MS} from '../../ui/draw-gate.js';

function room(a,t,w,h,variant){
  const direct=variant==='grid',stage=variant==='stage',url='/art/project-scene-backgrounds-v3/'+(direct?'recruit-result':stage?'draw-receiver':'logistics-bay')+'.png';
  const m=pic(a,t,url,box(0,0,w,h)),im=m.material.map.image,k=im?Math.max(w/im.width,h/im.height):1;
  const sx=im?w/(k*im.width):1,sy=im?h/(k*im.height):1;
  const weave=t.texture('/art/project-workshop-background-v2/psd-scanlines.png');
  m.material.onBeforeCompile=s=>{
    s.uniforms.sceneCrop={value:new Vector4(sx,sy,.5*(1-sx),.5*(1-sy))};s.uniforms.sceneSize={value:new Vector2(w,h)};
    s.uniforms.stripes={value:weave};s.uniforms.drawRoom={value:direct?0:stage?1:2};
    s.fragmentShader='uniform vec4 sceneCrop;uniform vec2 sceneSize;uniform sampler2D stripes;uniform int drawRoom;\n'+s.fragmentShader.replace('#include <map_fragment>',`
      vec2 uv=vMapUv*sceneCrop.xy+sceneCrop.zw;
      vec3 c=sRGBTransferOETF(texture2D(map,uv)).rgb;float y=1.-vMapUv.y;
      if(drawRoom==0)c=mix(c,vec3(.0431,.1098,.1725),mix(.2,.4,y));
      else if(drawRoom==1)c=mix(c,vec3(.0314,.0627,.1176),mix(.2,.3333,y));
      else{float r=clamp(length((vec2(vMapUv.x,y)-vec2(.5,.32))*vec2(1.6,1.))/ .85,0.,1.);c=mix(c,mix(vec3(.0627,.1529,.2314),vec3(.0431,.098,.1686),r),mix(.72,.92,r));}
      vec2 st=vec2((vMapUv.x+.008)/1.02,1.-(y*sceneSize.y/sceneSize.x+.036)/(1.02*2142./765.));
      vec4 pat=texture2D(stripes,st);vec3 col=sRGBTransferOETF(pat).rgb;
      vec3 blend=mix(2.*c*col,1.-2.*(1.-c)*(1.-col),step(vec3(.5),c));
      diffuseColor*=sRGBTransferEOTF(vec4(mix(c,blend,pat.a*step(0.,st.y)*step(st.y,1.)),1.));`);};
  m.material.customProgramCacheKey=()=> 'recruit-room';
}
function action(a,t,b,title,id,cmd,opts={}){
  const {original=false,zone=null,data={}}=opts;
  slice(a,t,original?'/art/psd-choice-v1/reroll.png':'/art/psd-buttons-v1/button-blue.png',b,10,original?17:18);
  words(a,title,b.x+b.w/2,b.y+b.h/2,original?18:14,{family:titleFont,color:'#f4fbff',shadow:{color:'#153650',y:2,blur:0}});
  area(t,id,title,b,cmd,data,zone);
}
function staged(data,w,h,t){
  const a=t.layer('reveal-stage').art,{plan,flow}=data;room(a,t,w,h,'stage');
  const opening=flow.phase==='opening',count=plan.entries.length,order=flow.review?plan.entries.map(e=>e.index):plan.featured;
  const i=order[flow.cursor],row=data.entries[i],header=76;
  if(opening){
    const tex=t.texture(DRAW_GATE_ART);
    if(tex.image?.width||tex.userData.failed){
      const entered=data.startGate();for(let side=0;side<2;side++){const b=box(side*w/2,0,w/2,h);
        const m=a.image(tex,b.x,b.y,b.w,b.h,{x:side/2,y:0,width:.5,height:1});
        animateMeshes(t,[m],b.x+b.w/2,h/2,{entered,reduced:false,duration:DRAW_GATE_DURATION_MS/1000,curve:[.55,0,.3,1],frames:[{at:0},{at:.22},{at:1,x:(side?1:-1)*w/2}]});}
    }
  }else if(row){
    const cw=Math.min(w*.55,285,(h-220)/1.8),ch=cw*1.80,b=box((w-cw)/2,(h-ch)/2,cw,ch);
    recruitCard(a,t,b,row,{small:false,index:i,zone:null,data:{...data,reduced:flow.instant||data.reduced}});
    if(plan.entries[i].isNew)words(a,'首次获得',w/2,b.y-22,16,{family:titleFont,color:'#ffe59d'});
    const end=flow.cursor+1>=order.length? '查看结果':'继续',bw=Math.min(w-60,340);
    action(a,t,box((w-bw)/2,h-data.safeBottom-76,bw,52),end,'next','next');
  }
  words(a,plan.title,17,header/2,22,{align:'left',family:titleFont});
  action(a,t,box(w-79,15,64,44),'跳过','skip','skip');
  if(!opening&&count>1)words(a,(flow.review?flow.cursor+1:i+1)+' / '+count,w-105,37,12,{color:'#b4cbd6'});
}
function summary(data,w,h,t){
  const a=t.layer('recruit-receipt-room').art,{plan,entries}=data,grid=plan.grid,count=entries.length,single=count===1;
  room(a,t,w,h,grid?'grid':'summary');
  const footerH=grid?56+clamp(.08*window.innerHeight,28,68)+data.safeBottom:78+data.safeBottom,header=grid?0:76;
  const by=h-footerH,bw=160,b=box((w-bw)/2,by+(grid?8:14),bw,48);
  if(!grid){
    a.quad(0,0,w,header,'#0b1b2d',.60);words(a,data.modal.title||'招募结果',16,header/2,clamp(.062*w,23,32),{align:'left',family:titleFont});
    action(a,t,box(w-142,16,85,44),'逐张回看','review','review');
    area(t,'close-top','关闭',box(w-54,16,44,44),'close');words(a,'×',w-32,38,32,{color:'#d2e5f4'});
    a.quad(0,by,w,footerH,'#0c1c2e',.90);
  }
  action(a,t,b,'确定','confirm','close',{original:true});
  const pad=grid?clamp(.032*w,10,16):18,iw=w-2*pad,availableH=by-header;
  const gap=grid?clamp(.01*iw,3,8):14,cols=single?1:grid?5:count===10?4:2;
  const gridWidth=Math.min(iw,grid?540:650);
  const cardW=single?(grid?Math.min(.54*iw,230):Math.min(.82*iw,(availableH-110)*.5556,360)):(gridWidth-(cols-1)*gap)/cols;
  const cardH=cardW*(grid?2.2:single?1.8:1.4),rowGap=grid&&count===10?clamp(.03*iw,8,14):grid?gap:22;
  const firstX=single?(w-cardW)/2:(w-gridWidth)/2,sectionH=cardH+(grid?0:40),rows=Math.ceil(count/cols),height=rows*sectionH+Math.max(0,rows-1)*rowGap;
  const va=box(0,header,w,availableH),zone='base',top=header+Math.max(pad,(availableH-height)/2);
  t.region(zone,va,Math.max(availableH,height+2*pad));const cards=t.layer('recruit-result-cards',zone).art;
  entries.forEach((row,i)=>{const r=box(firstX+(i%cols)*(cardW+gap),top+Math.floor(i/cols)*(sectionH+rowGap),cardW,cardH);
    recruitCard(cards,t,r,row,{small:!single,index:i,zone,data});
    if(!grid)action(cards,t,box(r.x,r.y+r.h+3,r.w,33),'查看','review-'+i,'review-card',{zone,data:{index:i}});
  });
}
export function openRecruitResults(screen,host,send,sound){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  let latest,receipt,flow,inspect=null,timer=0,gateEpoch=null,entered=0,revision=0;
  const panel=createLobbyPanel(screen,host,'招募结果', (data,w,h,t)=>{
    if(data.flow.phase==='summary')summary(data,w,h,t);else staged(data,w,h,t);
    if(data.inspect){paintItemDetail(data,w,h,t);return 'inspect';}return 'base';
  },c=>{
    if(c.type==='holo'||c.type==='none')return;
    if(c.type==='inspect'){inspect=latest.entries[c.data.index]?.item;refresh();return;}
    if(c.type==='close'&&inspect){inspect=null;refresh();return;}
    if(c.type==='close'&&flow.phase==='summary'){send('close',{},host);return;}
    if(c.type==='review-card'){flow={phase:'spotlight',cursor:c.data.index,review:true};transition();return;}
    const cmd=c.type==='close'?'skip':c.type;
    flow=advanceDrawPresentation(flow,cmd,latest.plan);transition();
  },{overlay:true});
  const cues=new Set();
  function transition(){
    clearTimeout(timer);gateEpoch=null;entered=performance.now()/1000;
    const key=flow.phase==='summary'?'summary':flow.phase+flow.cursor;
    if(!flow.review&&flow.phase!=='opening'&&!cues.has(key)){
      cues.add(key);const index=latest.plan.featured[flow.cursor];sound?.(flow.phase==='summary'?'reward':latest.plan.entries[index]?.rank>=3?'rareReveal':'boxReveal');
    }
    refresh();
  }
  function startGate(){if(gateEpoch==null){gateEpoch=performance.now()/1000;if(!cues.has('opening')){cues.add('opening');sound?.('drawCharge');}
    timer=setTimeout(()=>{flow=advanceDrawPresentation(flow,'next',latest.plan);transition();},DRAW_GATE_DURATION_MS);}
    return gateEpoch;}
  function refresh(){panel.update({...latest,flow,inspect,entered,startGate,reduced,safeBottom:screen.menuView?.safeBottom||0},++revision,'recruit-'+flow.phase);}
  return {host,close(){clearTimeout(timer);panel.close();},update(snapshot,modal){
    if(receipt===modal)return;
    receipt=modal;cues.clear();
    const plan=drawPresentationPlan(modal,snapshot);
    latest={snapshot,modal,plan,entries:recruitResultsModel(snapshot,modal)};
    inspect=null;flow=initialDrawPresentation(plan,reduced);transition();
  }};
}
