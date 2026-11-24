import {area,box,fmt,pic,slice,words} from './menu-art.js';
import {normalFit,stars} from './catalog-art.js';
import {animateMeshes} from './ui-motion.js';
import {plain} from './catalog-model.js';
import {nativeCollectionArt,nativeSkillArt} from '../../replica/native-collection-art.js';

export function activation(d,w,h,t,row){
  const a=t.layer('activation-shade').art,shade=t.backdrop(a,.85,'#030a16');
  animateMeshes(t,[shade],w/2,h/2,{...d,duration:.25,frames:[{at:0,opacity:0},{at:1}]});
  area(t,'outside','关闭',t.frameRect,'close');
  const body=t.layer('activation','base').art,rec=d.modal.receipt||{},base=w*.05;
  const tracks=[];let y=base;
  function group(duration,start,delay,paint,curve){const first=body.group.children.length,top=y;paint();
    tracks.push({meshes:body.group.children.slice(first),cy:(y+top)/2,duration,delay,frames:[{at:0,...start},{at:1}],curve});}
  group(.38,{opacity:0,x:-.1*w},0,()=>{
    const r=box(0,y,w,w*.138);body.image(t.texture('/art/aircraft-activation-v1/activation-header.png'),r.x,r.y,r.w,r.h,{x:0,y:.32,width:1,height:.36});
    words(body,'激活成功',w/2,y+r.h/2,w*.065,{color:'#fff6d2',weight:700,shadow:{color:'#30230b',y:2,blur:2}});y+=r.h;});
  const top=y+.005*w,display=box(.03*w,top,.94*w,.79*w),cy=top+display.h/2;
  const light=normalFit(body,t,'/art/aircraft-activation-v1/activation-stage.png',display);
  tracks.push({meshes:[light],cy,duration:.7,frames:[{at:0,opacity:0,scaleY:.65},{at:1}]});
  const pb=box(display.x+.04*display.w,top+.09*display.h,.92*display.w,.75*display.h);
  const plane=normalFit(body,t,nativeCollectionArt(row,'default'),pb,false,{x:.18,y:.12,width:.64,height:.76});
  if(plane)tracks.push({meshes:[plane],cy:pb.y+pb.h/2,duration:.65,curve:[.18,.8,.3,1],frames:[{at:0,opacity:0,y:w*.06,scale:.78},{at:1}]});
  if(Number.isFinite(rec.power)){
    const r=box(display.x+.22*display.w,top+display.h*.87-.1*w,.56*display.w,.10*w);
    slice(body,t,'/art/equipment-controls-v1/menu-panel.png',r,10,24);const yy=r.y+r.h/2;
    const chunks=[['战力',.035,'#eaf5ff'],[fmt(rec.power),.05,'#ffe38b'],...(rec.powerDelta>0?[['↑ '+fmt(rec.powerDelta),.045,'#9aefb8']]:[])].map(([v,sz,c])=>words(body,v,0,yy,sz*w,{color:c}));
    let ix=w/2-(chunks.reduce((n,m)=>n+m.scale.x,0)+.017*w*(chunks.length-1))/2;for(const m of chunks){m.position.x=ix+m.scale.x/2;ix+=m.scale.x+.017*w;}
  }
  y=top+display.h+.015*w;words(body,row.name,w/2,y+.034*w,.05*w,{weight:700});y+=.0825*w;
  stars(body,t,box(.30*w,y,.4*w,.05*w),Math.max(5,...row.stages.map(st=>st.star)),row.star,{align:'center'});y+=.065*w;
  if(row.stage.attributes?.length){
    const values=row.stage.attributes.map(v=>{const [k,n]=v.split('=');return (d.snapshot.replicaCollection.attributeNames[k]||k)+' '+(Number(n)>=0?'+':'')+n+(k.endsWith('%')?'%':'');});
    const rh=Math.max(.10*w,Math.ceil(values.length/2)*.065*w+.03*w);slice(body,t,'/art/equipment-controls-v1/menu-panel.png',box(.05*w,y,.9*w,rh),10,24);
    values.forEach((v,i)=>words(body,v,w*(values.length===1?.5:i%2?.69:.31),y+.048*w+Math.floor(i/2)*.065*w,.04*w,{color:'#9aefb8',maxWidth:.38*w}));
    y+=rh+.015*w;
  }
  y+=.015*w;group(.35,{opacity:0,y:.02*w},.3,()=>{
    if(!row.stage.skills.length){words(body,'无战机技能',w/2,y+.025*w,.035*w,{color:'#d4e5ef'});y+=.05*w;}
    for(const sk of row.stage.skills){
      const desc=words(body,plain(sk.description),w*.22,y+.058*w,.035*w,{align:'left',color:'#d4e5ef',wrap:true,maxWidth:w*.69,lineHeight:.0525*w,weight:400});
      desc.position.y+=desc.userData.uiTextLines.length*.02625*w;
      words(body,plain(sk.name),w*.22,y+.022*w,.036*w,{align:'left',weight:700});
      const rh=Math.max(.12*w,.058*w+desc.userData.uiTextLines.length*.0525*w),b=box(w*.07,y+(rh-w*.12)/2,.12*w,.12*w);
      slice(body,t,'/art/psd-equipment-v1/frame-blue.png',b,5);normalFit(body,t,nativeSkillArt(sk),b);y+=rh+.015*w;
    }
  });y+=.025*w;
  const buttonY=y;words(body,'点击空白处关闭',w/2,y+22,.035*w,{color:'#c5d6e3',weight:400});y+=44+w*.03;
  const dy=Math.max(0,(h-y)/2);for(const m of body.group.children)m.position.y+=dy;
  for(const tr of tracks)animateMeshes(t,tr.meshes,w/2,tr.cy+dy,{...d,...tr});
  area(t,'close','点击空白处关闭',box(.1*w,buttonY+dy,.8*w,44),'close',{},'base');t.region('base',box(0,0,w,h),y);
}

