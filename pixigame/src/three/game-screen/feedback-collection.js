import {area,box,pic,words} from './menu-art.js';
import {feedbackArt,hologram,frameBox,label,glyph,pulse,pop,reveal,groupMotion,portion,outerFrame,inset,dismiss,countUp} from './feedback-art.js';
import {feedbackKindLabel,feedbackAttributes,feedbackSkills,cleanFeedbackText} from '../../ui/process-feedback-model.js';
import {nativeCollectionArt,nativeSkillArt} from '../../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../../replica/native-weapon-skill-art.js';
import {skillIconBackgroundArt} from '../../replica/skill-element-background-art.js';
import bounds from '../../ui/process-feedback-art-bounds.json';
import {artworkSize} from './image-loading.js';

function portrait(a,t,row,b,w){
  const url=nativeCollectionArt(row,'default');if(!url)return;
  const trim=bounds.assets[new URL(url,globalThis.document?.baseURI||'https://localhost/').pathname];
  if(!trim){pic(a,t,url,b,true);return;}
  const [x,y,iw,ih]=trim.viewBox,k=Math.min(b.w/iw,b.h/ih),nw=iw*k,nh=ih*k,pad=.025*w;
  const r=box(b.x+(b.w-nw)/2-pad,b.y+(b.h-nh)/2-pad,nw+2*pad,nh+2*pad);
  const m=portion(a,t,url,r,[x-pad/k,y-pad/k,iw+2*pad/k,ih+2*pad/k],trim.size);
  // Blur the original alpha on this material so the hero casts its soft shadow onto the stage.
  const dx=.009*w/k/trim.size[0],dy=.009*w/k/trim.size[1];
  m.material.onBeforeCompile=s=>{s.uniforms.feedbackShadow={value:[dx,dy]};
    s.fragmentShader='uniform vec2 feedbackShadow;\n'+s.fragmentShader;
    s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
      vec2 uv=vMapUv+vec2(0.,feedbackShadow.y);
      float shadow=0.;
      for(int j=-1;j<=1;j++)for(int i=-1;i<=1;i++)
        shadow+=texture2D(map,uv+vec2(float(i),float(j))*feedbackShadow).a*float((i==0?2:1)*(j==0?2:1));
      float coverage=diffuseColor.a+(1.-diffuseColor.a)*shadow*.0353;
      diffuseColor.rgb=mix(vec3(.0034,.013,.037),diffuseColor.rgb,diffuseColor.a/max(.0001,coverage));
      diffuseColor.a=coverage;`);};
}
function compareStars(a,t,b,w,row,before,up,pilot){
  const side=w*(pilot ? .033 : .047),gap=.008*w,font=w*(pilot ? .030 : .036),cy=b.y+b.h/2;
  function segment(count,capacity,withText){
    const n=Math.max(count,capacity),pre=withText?label(a,count+'星',0,cy,font):null;
    const tw=pre?pre.scale.x-4:0,preW=pre?tw+.015*w:0;
    return {width:preW+n*side+Math.max(0,n-1)*gap,paint(x){
      if(pre)pre.position.x=x+tw/2;
      for(let i=0;i<n;i++){
        const m=glyph(a,t,'star',box(x+preW+i*(side+gap),cy-side/2,side,side));
        if(i>=count){m.material.opacity=.68;m.material.onBeforeCompile=s=>{s.fragmentShader=s.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\nvec3 col=sRGBTransferOETF(diffuseColor).rgb;diffuseColor.rgb=sRGBTransferEOTF(vec4(vec3(.58*dot(col,vec3(.2126,.7152,.0722))),1.)).rgb;');};}
      }
    }};
  }
  const next=segment(row.star,up?(pilot?5:row.star):5,up),prior=up&&segment(before.star,pilot?5:before.star,true);
  let x=b.x+(b.w-next.width-(prior?prior.width+.10*w:0))/2;
  if(prior){prior.paint(x);x+=prior.width+.03*w;glyph(a,t,'chevron-right',box(x,cy-.02*w,.04*w,.04*w));x+=.07*w;}
  next.paint(x);
}
export function collectionFeedback(data,w,h,t){
  const rec=data.record,row=rec.after,pilot=rec.kind==='pilots',gun=rec.kind==='guns',up=rec.operation==='star';
  const pw=(pilot ? .96 : .9)*w,ph=Math.min(w*(pilot?1.44:1.24),h*(pilot ? .89 : .86));
  const p=box((w-pw)/2,(h-ph)/2,pw,ph),a=t.layer('collection-unlock').art;
  const r=(...args)=>frameBox(p,...args),part=(b,paint,track,outer)=>groupMotion(t,a,p,data,b,paint,track,outer);
  area(t,'paper','',p,'none');
  if(!pilot)part(p,()=>outerFrame(a,t,p,w,'collection'));
  const banner=pilot?r(.04,.01,.92,.07):r(.05,.055,.9,.08);
  part(banner,()=>{const iw=banner.w*1.06,cy=banner.y+banner.h/2;
    pic(a,t,feedbackArt+'success-banner.png',box((w-iw)/2,cy-iw/6,iw,iw/3));
    label(a,up?'升星成功':'获得'+feedbackKindLabel(rec.kind),w/2,cy,.06*w,{color:'#fff3c9',tracking:.002*w,shadow:{color:'#402912',y:1,blur:3}});
  },{delay:.12,duration:.55,frames:[{at:0,opacity:0,scaleX:.7},{at:.7,scaleX:1.03},{at:1}]});
  const st=pilot?r(.17,.34,.66,.25):gun?r(.08,.06,.84,.48):r(.06,.17,.88,.36);
  const stage={cx:w/2,cy:st.y+st.h/2,duration:.8,delay:.18,frames:[{at:0,opacity:0,scale:.7},{at:1}]};
  part(st,()=>{const url=gun?hologram:'/art/aircraft-activation-v1/activation-stage.png';
    if(gun){pic(a,t,url,st,true);return;}
    const [sw,sh]=artworkSize(t.texture(url).image);
    if(!sw||!sh)return;
    const iw=st.w*(pilot?1:.9),ih=iw*sh/sw;
    pic(a,t,url,box((w-iw)/2,st.y+st.h-ih,iw,ih));
  },stage);
  part(st,()=>{const m=pic(a,t,hologram,st,true);if(data.reduced)m.material.opacity=.4;},{delay:1,duration:2.8,frames:pulse,loop:true},[stage]);
  const hero=pilot?r(.18,.08,.64,.48):gun?r(.18,.17,.64,.32):r(.14,.15,.72,.37);
  part(hero,()=>portrait(a,t,row,hero,w),{delay:.18,duration:.7,frames:[{at:0,y:.04*w,scale:.84,opacity:0},{at:.65,y:-.005*w,scale:1.025},{at:1}]});
  if(!data.reduced){
    const particles=r(.08,.15,.84,.4);
    for(let i=0;i<8;i++){
      const x=particles.x+particles.w*(.09+i*.11),y=particles.y+particles.h*(.96-i*.03)-.02*w,b=box(x,y,.02*w,.02*w);
      part(b,()=>pic(a,t,hologram,b),{duration:2.7,delay:-i*.34,loop:true,frames:[{at:0,opacity:0,y:.02*w},{at:.2,opacity:.8,y:-.032*w},{at:.8,opacity:.3,y:-.188*w},{at:1,opacity:0,y:-.24*w}]});
    }
  }
  const name=pilot?r(.14,.57,.72,.06):r(.11,.53,.78,.07);
  part(name,()=>{inset(a,t,name,w);label(a,row.name,w/2,name.y+name.h/2,.048*w,{color:'#f3f7fa',shadow:{color:'#102438',y:1,blur:2},maxWidth:name.w});},{duration:.4,delay:.55,frames:reveal(w)});
  const stars=pilot?r(.10,.64,.80,.04):r(.10,.61,.80,.05);
  part(stars,()=>compareStars(a,t,stars,w,row,rec.before,up,pilot),{delay:.8,duration:.5,frames:pop});
  const attrs=feedbackAttributes(rec,data.snapshot.replicaCollection?.attributeNames);
  if(attrs.length){
    const b=pilot?r(.07,.70,.86,.09):r(.07,.67,.86,.11),step=.064*w;
    part(b,()=>{inset(a,t,b,w);
      attrs.forEach((attr,i)=>{
        const y=b.y+b.h/2+(i-(attrs.length-1)/2)*step,right=b.x+b.w-.04*w;
        label(a,attr.label,b.x+.04*w-2,y,.033*w,{align:'left'});
        if(up&&Number.isFinite(attr.from)){
          glyph(a,t,'chevron-right',box(right-.197*w,y-.0175*w,.035*w,.035*w));
          label(a,(attr.from>=0?'+':'')+attr.from+attr.suffix,right-.22*w,y,.033*w,{align:'right',color:'#e6f0f5'});
        }
        countUp(t,data,up?attr.from??0:0,attr.to,.85,.65,v=>label(a,(v>=0?'+':'')+v+attr.suffix,right+2,y,.04*w,{weight:700,align:'right',color:'#82edbc'}));
      });
    },{delay:.75,duration:.45,frames:reveal(w)});
  }
  const skills=feedbackSkills(rec);
  if(skills.length){
    const b=pilot?r(.05,.82,.90,.13):r(.07,.81,.86,.14),x=b.x+.034*w,iw=.11*w,sx=x+iw+.03*w,sw=b.x+b.w-.034*w-sx;
    const tr={delay:.75,duration:.45,frames:reveal(w)};
    part(b,()=>{inset(a,t,b,w);if(up)label(a,'技能提升',b.x+.03*w-2,b.y+.003*w,.030*w,{align:'left'});},tr);
    const content=skills.map(s=>{const desc=cleanFeedbackText(s.description).replace(up?/^初始携带[^，,]+[，,]/:/^获得[^，,]+[，,]/,'');
      return {s,desc};});
    const rows=content.map(({s,desc},i)=>{
      const id='skill-copy-'+i,ink=t.layer(id,id).art;
      const body=words(ink,desc,sx-2,0,.029*w,{align:'left',color:'#e1edf5',weight:400,maxWidth:sw,wrap:true,lineHeight:.0406*w});
      const textH=body.userData.uiTextLines.length*.0406*w,visible=Math.min(textH,.1624*w);
      return {s,id,ink,body,textH,visible,height:Math.max(iw,.0494*w+.01*w+visible)};
    });
    const total=rows.reduce((n,v)=>n+v.height,0)+(rows.length-1)*.01*w,fit=Math.min(1,b.h/Math.max(1,total));
    let y=b.y+(b.h-total*fit)/2;
    for(const {s,id,ink,body,textH,visible,height} of rows){
      const hh=height*fit,cy=y+hh/2,icon=gun?nativeWeaponSkillArt(row)||nativeSkillArt(s):nativeSkillArt(s);
      const th=Math.min(visible,Math.max(.0406*w,hh-.0594*w)),ty=cy-(.0594*w+th)/2;
      part(b,()=>{const rect=box(x,cy-iw/2,iw,iw),element=skillIconBackgroundArt(icon);
        if(element)pic(a,t,element,rect);pic(a,t,icon,rect,true);
        label(a,s.name,sx-2,ty+.0247*w,.038*w,{align:'left',weight:700,color:'#fff2cb',maxWidth:sw});},tr);
      const top=ty+.0594*w;body.position.y=top+textH/2;t.region(id,box(sx-2,top,sw+4,th),textH);
      ink.group.remove(body);groupMotion(t,ink,p,data,b,()=>ink.group.add(body),tr);
      y+=hh+.01*w*fit;
    }
  }
  part(p,()=>dismiss(a,t,p,w,pilot?p.y+.97*p.h:undefined));
}
