import * as T from 'three';
import baked from './home-art.json';
import {guidePlacement} from '../../ui/guide-layout.js';
import {carnivalMedal} from './carnival-art.js';

const files={heart:'/art/psd-combat-v1/heart.png',chest:'/art/psd-main-v1/buttons/star-rewards-chest.png',
  navBackground:'/art/project-navigation-v2/background.png',navFrame:'/art/psd-main-v1/navigation/horizontal-frame.png',
  divider:'/art/psd-main-v1/navigation/divider.png',developer:'/art/psd-buttons-v1/button-blue.png',
  gold:'/art/psd-equipment-v1/frame-gold.png',caption:'/art/onboarding-dialogue-v2/panel.webp',
  mascot:'/art/onboarding-assistant-v1/expressions.png',pointer:baked.pointer,carnival:carnivalMedal};
import {homeInsets,navEdges,navArtwork,navBodyEnd,navFillStart,carnivalEntryBox,affectionY,profileFrame} from './home-navigation.js';
const tabs=[['shop',28.75,1507,84,84],['assembly',176.25,1510,69,86],['battle',320,1483,114,99],['research',491.25,1507,92,96],['supply',642.75,1512,80,91]];
const vert=`precision highp float;attribute vec3 position;attribute vec2 uv;uniform mat4 modelViewMatrix,projectionMatrix;varying vec2 coords;void main(){coords=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const frag=`precision highp float;uniform sampler2D art;uniform vec4 region,splice;uniform vec2 pixels,box;uniform vec3 tint;uniform float alpha,octagon;varying vec2 coords;
float cut(float q,float src,float dst){float d=min(splice.y,dst*.5),s=min(splice.x,src*.5),p=q*dst;
 if(p<d)return s*(p/max(d,.01))/src;if(p>dst-d)return 1.-s*((dst-p)/max(d,.01))/src;
 return (s+(p-d)*(src-2.*s)/max(.01,dst-2.*d))/src;}
void main(){vec2 t=coords;
 if(octagon>0.&&min(t.x,1.-t.x)+min(t.y,1.-t.y)<.08)discard;
 if(splice.x>0.){if(splice.z>0.&&min(t.x,1.-t.x)*box.x>splice.y&&min(t.y,1.-t.y)*box.y>splice.y)discard;t=vec2(cut(t.x,pixels.x,box.x),cut(t.y,pixels.y,box.y));}
 vec4 c=texture2D(art,region.xy+t*region.zw);gl_FragColor=vec4(c.rgb*tint,c.a)*alpha;}`;
const quad=new Float32Array([0,0,0,1,0,0,1,1,0,0,0,0,1,1,0,0,1,0]),quadUv=new Float32Array([0,0,1,0,1,1,0,0,1,1,0,1]);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mixKeys=(p,keys)=>{const j=keys.findIndex(row=>row[0]>=p);if(j<=0)return keys[0][1];const [x,a]=keys[j-1],[y,b]=keys[j];
  const t=(p-x)/(y-x),e=t*t*(3-2*t);return a+(b-a)*e;};
const walletValue=(value,unlimited)=>unlimited?'9999':value>=1e8?(+(value/1e8).toFixed(1))+'亿':value>=1e4?(+(value/1e4).toFixed(1))+'万':Number(value??0).toLocaleString('zh-CN');
function chapterNumber(value){const d='零一二三四五六七八九';return value<10?d[value]:value<20?'十'+(d[value%10]&&value%10?d[value%10]:''):value<100?d[Math.floor(value/10)]+'十'+(value%10?d[value%10]:''):String(value);}

export async function createHomeHud(load,model,redraw){
  const scene=new T.Scene(),camera=new T.OrthographicCamera(0,750,0,1624,-1,1),maps=new Map(),sprites=new Map(),labels=new Map(),pending=new Map();
  const rect=new T.BufferGeometry();rect.setAttribute('position',new T.BufferAttribute(quad,3));rect.setAttribute('uv',new T.BufferAttribute(quadUv,2));
  const pressScales=new Map();
  let disposed=false,state=model,lastGuide=null,focusBox=null,view=null,revision=0;
  function own(url){
    if(maps.has(url))return Promise.resolve(maps.get(url));
    if(pending.has(url))return pending.get(url);
    const entry=load(url).then(image=>{
      if(disposed)return null;const map=new T.Texture(image);map.flipY=false;map.premultiplyAlpha=true;
      map.colorSpace=T.NoColorSpace;map.minFilter=T.LinearMipmapLinearFilter;map.magFilter=T.LinearFilter;map.needsUpdate=true;
      const b={map,w:image.naturalWidth||image.width,h:image.naturalHeight||image.height};maps.set(url,b);return b;
    }).finally(()=>pending.delete(url));
    pending.set(url,entry);return entry;
  }
  const textures={};
  const routes=[...Object.entries(files),...Object.entries(baked.nav).map(([id,url])=>['nav-'+id,url]),...Object.entries(baked.fonts).map(([id,f])=>['font-'+id,f.image])];
  if(model.avatar)routes.push(['avatar',model.avatar]);if(model.frame)routes.push(['frame',model.frame]);
  await Promise.all(routes.map(async([key,url])=>{
    try{textures[key]=await own(url);}catch(error){if(key!=='carnival')throw error;}
  }));
  textures.carnival??=textures.chest;
  const solid=new T.DataTexture(new Uint8Array([255,255,255,255]),1,1);solid.needsUpdate=true;
  textures.solid={map:solid,w:1,h:1};
  function material(b){return new T.RawShaderMaterial({vertexShader:vert,fragmentShader:frag,transparent:true,depthTest:false,depthWrite:false,side:T.DoubleSide,forceSinglePass:true,
    blending:T.CustomBlending,blendSrc:T.OneFactor,blendDst:T.OneMinusSrcAlphaFactor,
    uniforms:{art:{value:b.map},region:{value:new T.Vector4(0,0,1,1)},splice:{value:new T.Vector4()},pixels:{value:new T.Vector2(b.w,b.h)},box:{value:new T.Vector2(1,1)},alpha:{value:1},octagon:{value:0},tint:{value:new T.Vector3(1,1,1)}}});}
  function sprite(id,key,order){
    const b=textures[key];if(!b)return null;
    const m=new T.Mesh(rect,material(b));m.frustumCulled=false;m.renderOrder=order;scene.add(m);sprites.set(id,m);return m;
  }
  function place(m,x,y,w,h){
    if(!m)return;m.position.set(x,y,0);m.scale.set(w,h,1);m.material.uniforms.box.value.set(w,h);m.visible=true;
  }
  function solidColor(u,v){u.set((v>>16&255)/255,(v>>8&255)/255,(v&255)/255);}
  const avatar=sprite('avatar','avatar',1);if(avatar)avatar.material.uniforms.octagon.value=1;
  const frame=sprite('frame','frame',2),heart=sprite('heart','heart',3),chest=sprite('chest','chest',4),dev=sprite('dev','developer',5);
  const carnival=sprite('carnival','carnival',4),carnivalReady=sprite('carnival-ready','solid',17);
  solidColor(carnivalReady.material.uniforms.tint.value,0xfa5d67);carnivalReady.material.uniforms.octagon.value=1;
  const shade=sprite('footer','navBackground',10),rail=sprite('rail','navFrame',11);
  const floor=sprite('footer-floor','navBackground',10);
  const trim=sprite('footer-trim','navBackground',10);
  floor.material.uniforms.region.value.set(0,navFillStart,1,navBodyEnd-navFillStart);
  trim.material.uniforms.region.value.set(0,navBodyEnd,1,1-navBodyEnd);
  const dividers=Array.from({length:4},(_,i)=>sprite('gap'+i,'divider',12));
  for(const [name] of tabs)sprite(name,'nav-'+name,13);
  const ring=sprite('guide-ring','gold',30),bubble=sprite('guide-panel','caption',31),mascot=sprite('guide-bot','mascot',32);
  const arrows=[0,1].map(i=>sprite('guide-arrow'+i,'pointer',33));
  const dim=Array.from({length:4},(_,i)=>sprite('guide-shade'+i,'solid',29));
  for(const m of dim){solidColor(m.material.uniforms.tint.value,0x020b13);m.material.uniforms.alpha.value=.6;}
  const outline=Array.from({length:4},(_,i)=>sprite('focus-edge'+i,'solid',27));
  for(const m of outline)solidColor(m.material.uniforms.tint.value,0xe8fb93);
  const hideGuide=()=>{for(const m of [ring,bubble,mascot,...arrows,...dim])m.visible=false;for(const m of labels.get('guide')?.nodes||[])m.visible=false;};
  hideGuide();
  function label(id,text,x,center,size,{font='system',color=0xffffff,align='center',order=18,maxWidth=Infinity,shadow=0,shadeY=1.5}={}){
    const value=String(text??''),f=baked.fonts[font],s=size/f.size;
    const key=JSON.stringify([value,size,font,maxWidth,color,shadow,shadeY]);let l=labels.get(id);
    if(!l||l.key!==key){
      if(l)for(const m of l.nodes){m.removeFromParent();m.material.dispose();}if(l)l.geometry.dispose();
      const t=textures['font-'+font],p=[],uv=[];let width=0;
      const all=Array.from(value,c=>f.glyphs[c]||f.glyphs['?']);
      const measure=r=>r[6]*s;
      const shown=[];
      for(let i=0;i<all.length;i++){
        if(width+measure(all[i])>maxWidth){
          const ellipsis=f.glyphs['…']||f.glyphs['?'];while(shown.length&&width+measure(ellipsis)>maxWidth)width-=measure(shown.pop());
          shown.push(ellipsis);width+=measure(ellipsis);break;
        }
        shown.push(all[i]);width+=measure(all[i]);
      }
      let cursor=0;for(const r of shown){
        const [tx,ty,w,h,dx,dy,advance]=r,ox=cursor+dx*s,oy=dy*s,ex=ox+w*s,ey=oy+h*s;
        p.push(ox,oy,0,ex,oy,0,ex,ey,0,ox,oy,0,ex,ey,0,ox,ey,0);
        const a=tx/t.w,b=ty/t.h,c=(tx+w)/t.w,d=(ty+h)/t.h;uv.push(a,b,c,b,c,d,a,b,c,d,a,d);
        cursor+=advance*s;
      }
      const geom=new T.BufferGeometry();geom.setAttribute('position',new T.Float32BufferAttribute(p,3));geom.setAttribute('uv',new T.Float32BufferAttribute(uv,2));
      const nodes=[];for(const [idx,ink] of (shadow?[shadow,color]:[color]).entries()){
        const m=new T.Mesh(geom,material(t));solidColor(m.material.uniforms.tint.value,ink);
        m.frustumCulled=false;m.renderOrder=order+idx*.001;m.userData.offset=shadow&&idx===0?shadeY:0;scene.add(m);nodes.push(m);
      }
      labels.set(id,l={key,geometry:geom,nodes,width});
    }
    const left=x-(align==='center'?l.width/2:0);
    for(const m of l.nodes){m.position.set(left,center+f.anchor*s+m.userData.offset,0);m.visible=!!value;}
    return l.width;
  }
  function updateModel(m){
    const changed=state.avatar!==m.avatar||state.frame!==m.frame;state=m;
    if(changed){
      const token=++revision;
      for(const [key,node] of [['avatar',avatar],['frame',frame]])if(m[key]&&node)own(m[key]).then(b=>{
        if(!b||disposed||token!==revision)return;node.material.uniforms.art.value=b.map;redraw();
      }).catch(()=>{});
    }
  }
  function guide(g,now,unit){
    if(!g||!g.text||!g.target){hideGuide();return;}
    const unitPx=1/unit,r=g.target, bounds={left:0,top:0,right:750*unitPx,bottom:1624*unitPx,width:750*unitPx,height:1624*unitPx};
    const target={left:r[0]*unitPx,top:r[1]*unitPx,width:r[2]*unitPx,height:r[3]*unitPx};target.bottom=target.top+target.height;
    const bot=clamp(bounds.width*.34,116,144),textWidth=Array.from(g.text,c=>(baked.fonts.system.glyphs[c]||baked.fonts.system.glyphs['?'])[6]*(14/54)).reduce((a,v)=>a+v,0);
    const textInset=bot*.3,panelW=Math.min(bounds.width-24,360,bot*.66+textInset+18+textWidth),panelH=bot+12,bubbleW=panelW-bot*.66;
    const placement=guidePlacement({target,bounds,viewport:{width:bounds.width,height:bounds.height},panel:{width:panelW,height:panelH}});
    const px=placement.x*unit,py=placement.y*unit,ax=placement.pointerX*unit,ay=placement.pointerY*unit;
    const eased=(t)=>.5-.5*Math.cos(t*Math.PI*2);
    const float=g.reduced?0:-3*unit*eased(now/3),moving=g.reduced?0:3*unit*eased(now/1.2);
    place(ring,r[0]-4*unit,r[1]-4*unit,r[2]+8*unit,r[3]+8*unit);ring.material.uniforms.splice.value.set(18,6*unit,1,0);
    const x=r[0]-4*unit,y=r[1]-4*unit,w=r[2]+8*unit,h=r[3]+8*unit;
    const walls=[[0,0,750,y],[0,y,x,h],[x+w,y,750-x-w,h],[0,y+h,750,1624-y-h]];
    dim.forEach((m,i)=>{place(m,...walls[i]);m.visible=!!g.strong&&walls[i][2]>0&&walls[i][3]>0;});
    const botY=py+6*unit;place(mascot,px,botY+float,bot*unit,bot*unit);
    const t=now/4.8%1;const frame=g.reduced?0:t>=.14&&t<.20||t>=.28&&t<.34?3:t>=.62&&t<.64||t>=.67&&t<.69?1:t>=.64&&t<.67?2:0;
    mascot.material.uniforms.region.value.set(frame/4,0,.25,1);
    const bx=px+bot*.66*unit,by=py+(panelH-76)*.5*unit;
    place(bubble,bx,by,bubbleW*unit,76*unit);bubble.material.uniforms.splice.value.set(64,18*unit,0,0);
    label('guide',g.text,bx+textInset*unit,by+(18+21.7/2)*unit,14*unit,{align:'left',color:0x233b53,order:34});
    for(const [i,a] of arrows.entries()){
      const down=placement.side==='above';
      place(a,ax-20*unit,ay+(i*16+(down?0:16))*unit+(down?moving:-moving),40*unit,(down?1:-1)*16*unit);
      const b=textures.pointer,visible=16/40*b.w/b.h;
      a.material.uniforms.region.value.set(0,(1-visible)/2,1,visible);
    }
  }
  function paint(renderer,now){
    if(!view||disposed)return;
    const s=state,unit=750/view.width,l=homeInsets(view),top=l.top,ny=y=>l.nav+(y-1473)*l.height/151;
    const aff=affectionY(s.carnival),eventY=carnivalEntryBox[1]+top;
    const [frameX,frameY,frameW,frameH]=profileFrame;
    place(avatar,25.8,31.8+l.profile,63.2,63.2);place(frame,frameX,frameY+l.profile,frameW,frameH);place(heart,35.1,aff+12.6+top,42.75,42.75);
    if(s.carnival){
      const iconH=50*textures.carnival.h/textures.carnival.w;
      place(carnival,31.5,eventY+36-iconH/2,50,iconH);
      if(s.carnivalReady)place(carnivalReady,76,eventY+11,14,14);else carnivalReady.visible=false;
    }else carnival.visible=carnivalReady.visible=false;
    const p=s.reduced?0:(now%4.8)/4.8,angle=mixKeys(p,[[0,0],[.04,0],[.07,-11],[.11,10],[.15,-6],[.19,4],[.24,0],[1,0]])*Math.PI/180;
    const shift=mixKeys(p,[[0,0],[.04,0],[.07,-.05],[.11,.05],[.15,-.03],[.19,.02],[.24,0],[1,0]])*61;
    const ox=30.5,oy=43*.85;place(chest,264+shift+ox-ox*Math.cos(angle)+oy*Math.sin(angle),239+top+oy-ox*Math.sin(angle)-oy*Math.cos(angle),61,43);chest.rotation.z=angle;
    const {inset}=l,skin=navArtwork(l.nav,l.height,inset);
    shade.material.uniforms.region.value.w=inset?navBodyEnd:1;
    place(shade,0,l.nav,750,inset?skin.body:l.height);
    if(inset){
      place(floor,0,skin.fillY,750,skin.fillHeight);
      place(trim,0,skin.trimY,750,skin.trim);
      const railHeight=l.height*148/151,crop=Math.min(1,skin.body/railHeight);
      rail.material.uniforms.region.value.w=crop;
      place(rail,0,l.nav,750,railHeight*crop);
    }else{
      floor.visible=trim.visible=false;rail.material.uniforms.region.value.w=1;
      place(rail,0,l.nav,750,l.height*148/151);
    }
    for(let i=0;i<dividers.length;i++)place(dividers[i],navEdges[i+1],l.nav,3,l.height*148/151);
    let paintedGuide=lastGuide;
    for(const [name,x,y,w,h] of tabs){
      place(sprites.get(name),x-30,ny(y-30),w+60,(h+60)*l.height/151);
      if(lastGuide?.id==='nav-'+name){
        // The tap area ends above the system gesture inset. The guide follows
        // the icon's placement in the full rail, with room for its glow.
        const padding=6*unit;
        paintedGuide={...lastGuide,target:[x-padding,ny(y)-padding,w+2*padding,h*l.height/151+2*padding]};
      }
    }
    label('nav','战役',375,ny(1594),28,{order:15,shadow:0x111111,shadeY:2*unit});
    for(const m of labels.get('nav').nodes)m.userData.navScale=l.height/151;
    const heading=s.stage?.chapterName?.replace(/^(?:第\s*[\d零一二三四五六七八九十百]+\s*章)\s*·?\s*/,'')||'蔚蓝海岸';
    label('chapter','第'+chapterNumber(s.chapter+1)+'章·'+heading,376,161.5+top,30,{font:'title',shadow:0x102132});
    label('waves',(s.stage?.waveCount||15)+'波·'+(s.stage?.bestCleared?'已通关':s.stage?.unlocked===false?'未解锁':'待挑战'),375,197.5+top,24,{color:0x81efff,shadow:0x102132});
    label('stars','累计'+s.total+'/'+s.maximum,386,261.5+top,clamp(23.6,11*unit,19*unit),{color:0x142d43});
    label('profile',s.name,105,49.5+l.profile,22.875,{align:'left',maxWidth:108,shadow:0x0a1824});
    const powerTitle=label('power-title','战力',105,89+l.profile,Math.max(15.75,10*unit),{align:'left',color:0xffde43});
    label('power',s.power,108+powerTitle,90.4+l.profile,17.25,{align:'left',color:0xffde43,shadow:0x0a1824});
    for(const [i,k] of ['stamina','coins','diamonds'].entries()){
      const str=walletValue(s.wallet?.[k],s.wallet?.unlimited);
      label(k,str,327+i*170,69.5+l.wallet,str.length>4?19.1:22.5,{font:'system'});
    }
    label('carnival',s.carnival?'七日活动':'',56.5,eventY+73.8,clamp(20,9*unit,16*unit),{shadow:0x172b40,maxWidth:101});
    label('affection','好感度',56.5,aff+73.8+top,clamp(21.75,10*unit,18*unit),{shadow:0x172b40});
    const dh=Math.max(67.5,38*unit),dw=Math.max(105,44*unit);
    if(s.developer){place(dev,736.5-dw,470.96+top,dw,dh);dev.material.uniforms.splice.value.set(18,21,0,0);}
    else dev.visible=false;
    label('developer',s.developer?'开发':'',736.5-dw/2,470.96+dh/2+top,clamp(25.5,12*unit,17*unit),{font:'title',color:0xedf4f7,shadow:0x07131f});
    label('patrol',s.patrol||'',117,1343+l.dock,17.25,{shadow:0x101923});
    const groups=[
      ['profile',['avatar','frame'],['profile','power-title','power']],
      ['chapter-title',[],['chapter','waves']],['star-rewards',['chest'],['stars']],
      ['carnival',['carnival','carnival-ready'],['carnival']],['affection',['heart'],['affection']],
      ['developer',['dev'],['developer']],['patrol',[],['patrol']],
      ...['stamina','coins','diamonds'].map(id=>[id,[],[id]]),
      ...tabs.map(([id])=>['nav-'+id,[id],id==='battle'?['nav']:[]])
    ];
    for(const [id,artIds,textIds] of groups){
      const p=pressScales.get(id);
      function apply(mesh,isText){
        if(!mesh)return;
        if(isText)mesh.scale.set(1,mesh.userData.navScale||1,1);
        if(!p)return;
        mesh.position.x=p.x+(mesh.position.x-p.x)*p.k;mesh.position.y=p.y+(mesh.position.y-p.y)*p.k;
        mesh.scale.x*=p.k;mesh.scale.y*=p.k;
      }
      for(const a of artIds)apply(sprites.get(a),false);
      for(const a of textIds)for(const m of labels.get(a)?.nodes||[])apply(m,true);
    }
    for(const m of outline)m.visible=false;
    if(focusBox){
      const [x,y,w,h]=focusBox,t=2*unit;
      const edges=[[x,y,w,t],[x,y+h-t,w,t],[x,y,t,h],[x+w-t,y,t,h]];
      outline.forEach((m,i)=>place(m,...edges[i]));
    }
    guide(paintedGuide,now,unit);renderer.render(scene,camera);
  }
  return {updateModel,setGuide(g){lastGuide=g;},setFocus(box){focusBox=box;},setPress(id,k,[x,y,w,h]){
    if(k===1)pressScales.delete(id);else pressScales.set(id,{k,x:x+w/2,y:y+h/2});
  },layout(v){view=v;},paint,
    paintGuide(renderer,now,g,width){
      for(const node of scene.children)node.visible=false;
      if(g){guide(g,now,750/width);renderer.render(scene,camera);}
    },
    dispose(){disposed=true;for(const l of labels.values()){for(const m of l.nodes)m.material.dispose();l.geometry.dispose();}
      for(const mesh of sprites.values())mesh.material.dispose();for(const b of maps.values())b.map.dispose();solid.dispose();rect.dispose();scene.clear();}};
}
