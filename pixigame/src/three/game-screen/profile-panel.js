import {createLobbyPanel} from './lobby-panel.js';
import {paintLobbyPaper} from './panel-paper.js';
import {paintItemDetail} from './item-details.js';
import {createNameField} from './profile-name-field.js';
import {area,box,button,clamp,fmt,pic,qualityFrame,slice,words} from './menu-art.js';
import {playerInfoModel} from '../../ui/player-info-model.js';
import {playerRenameQuote} from '../../ui/player-info.js';
import {playerAvatarArt} from '../../ui/player-avatar.js';
import {aircraftUiImage} from '../../aircraft-ui-images.js';
import {weaponIconUrl} from '../../ui/weapon-icon-source.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {rewardDisplayQuality} from '../../replica/item-display-quality.js';
import {equipmentArtPath} from '../../replica/equipment-art.js';
import {GEAR_PARTS} from '../../peripheral/equipment-system.js';

const emptyFrame='/art/psd-equipment-v1/frame-empty.png';
function fit(a,t,url,b,cover=false,alignY=.5){
  const m=pic(a,t,url,b),im=m.material.map?.image;
  if(!im?.height)return m;
  const k=(cover?Math.max:Math.min)(b.w/im.width,b.h/im.height);
  if(!cover){m.scale.set(im.width*k,-im.height*k,1);return m;}
  const fx=b.w/(im.width*k),fy=b.h/(im.height*k),uv=m.geometry.attributes.uv;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(1-fx)*.5+uv.getX(i)*fx,(1-fy)*(1-alignY)+uv.getY(i)*fy);
  return m;
}
function equip(a,t,item,b,w,part){
  const quality=rewardDisplayQuality({...item,type:item?.nativeRow?'weapon':'gear'}),id=item?.nativeId??item?.nativeRow?.id;
  slice(a,t,item&&quality.qualityKnown?qualityFrame(quality.qualityRank):emptyFrame,b,clamp(.024*w,8,11));
  const size=clamp(w*.026,8,11),levelHeight=part?size*1.2:0;
  const inner=box(b.x+3,b.y+3,b.w-6,Math.max(1,b.h-6-levelHeight));
  if(item){
    const source=part?'/'+equipmentArtPath(item.art):item.nativeRow?nativeCollectionArt(item.nativeRow):weaponIconUrl(item.id)||aircraftUiImage(item.id,'thumbnail');
    if(source)fit(a,t,source,inner);
  }else{
    const side=clamp(.036*w,13,18),mark=pic(a,t,'/art/psd-main-v1/resources/diamonds-plus.png',box(b.x+(b.w-side)/2,inner.y+(inner.h-side)/2,side,side),true);
    // The original plus acts as an alpha mask on a muted blue-grey swatch.
    mark.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',
      '#ifdef USE_MAP\n diffuseColor.a *= texture2D(map,vMapUv).a;\n#endif');};
    mark.material.color.set('#a8c3d0');mark.material.opacity=.85;
  }
  if(part){
    words(a,item?'Lv.'+fmt(item.level||1):'未装配',b.x+b.w/2,b.y+b.h-3-levelHeight/2,size,
      {color:item?'#fff':'#203d55',weight:700,maxWidth:b.w-3,shadow:item?{color:'#172b38',y:1,blur:2}:null});
    const badge=box(b.x-3,b.y-3,17,17);
    slice(a,t,emptyFrame,badge,4).rotation.z=Math.PI/4;
    const base=GEAR_PARTS.find(p=>p.type===part.type);
    if(base){
      const icon=fit(a,t,'/'+equipmentArtPath(base.id),box(badge.x+1,badge.y+1,15,15));
      icon.material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <colorspace_fragment>',
        '#include <colorspace_fragment>\n gl_FragColor.rgb=vec3(min(1.,dot(gl_FragColor.rgb,vec3(.2126,.7152,.0722))*1.5));');};
    }
  }
  if(id!=null)area(t,part?'gear-'+part.type:'main-weapon',item.name,b,'inspect',{itemId:id,name:item.name},'showcase');
}

function showcase(p,w,t,b){
  if(b.h<1)return;
  t.region('showcase',b,b.h);
  const a=t.layer('showcase','showcase').art;
  const rect=(x,y,rw,rh)=>box(b.x+x*b.w,b.y+y*b.h,rw*b.w,rh*b.h);
  fit(a,t,'/art/project-scene-backgrounds-v3/aircraft-hangar.png',b,true);
  fit(a,t,'/art/project-fleet-stage-v2/platform.png',rect(.06,.42,.88,.39));
  const plane=aircraftUiImage(p.aircraft?.id,'equipment');if(plane)fit(a,t,plane,rect(-.13,.14,1.30,.65));
  words(a,p.aircraft?.aircraftName||p.aircraft?.name||'未选择战机',b.x+b.w-10,b.y+22.4,12,
    {align:'right',weight:700,maxWidth:b.w*.62,color:'#eef7ff',shadow:{color:'#102536',y:1,blur:2}});
  const side=b.w*.2;equip(a,t,p.main,box(b.x+b.w*.03,b.y+b.h*.03,side,side),w);
  const gearSide=(b.w*.94-20)/5;
  p.gear.forEach((part,i)=>equip(a,t,part.item,box(b.x+b.w*.03+i*(gearSide+5),b.y+b.h-10-gearSide,gearSide,gearSide),w,part));
}

function page(data,w,h,t,field){
  const {snapshot:s,profile:p,modal}=data,editing=modal.editingName,header=w/6;
  const ph=Math.min(h*.92,Math.max(w*1.54,h*.82)),page=paintLobbyPaper(t,data,w,h,.94*w,ph,header,'名片');
  const left=page.x+40*w/750,top=page.top,bw=w-2*left,bottom=page.y+ph-40*w/750;
  const body=t.layer('identity-paper').art,ink=t.layer('identity').art,pad=6;
  const side=(bw-pad*2)*(editing ? .22 : .25),ix=left+pad+side+8,iw=left+bw-pad-ix;
  const copyTop=top+pad,rowY=copyTop+13.2+4;
  const leftText=(str,x,y,font,style={})=>words(ink,str,x-2,y,font,{align:'left',...style});
  leftText('指挥官'+(p.native?' · Lv.'+fmt(p.accountLevel):''),ix,copyTop+6.6,11,{weight:400,color:'#d1e4f1'});
  let nameH=44;
  if(editing){
    leftText('玩家名字',ix,rowY+8.7,12,{weight:400,color:'#f1f9ff'});
    const {renameHint,renameLabel,renameReady}=data.quote;
    const edit=box(ix,rowY+22.4,iw,40),hint=modal.nameError||('2–12 个字符。'+renameHint);
    const note=leftText(hint,ix,0,11,{weight:400,color:'#d1e4f1',wrap:true,maxWidth:iw,lineHeight:15.95});
    const hintH=note.userData.uiTextLines.length*15.95;
    note.position.y=edit.y+edit.h+5+hintH/2;
    field?.draw(ink,t,edit,modal.nameError,hint);
    area(t,'name-input','玩家名字',edit,'editName');
    const x=ix,bY=edit.y+edit.h+10+hintH,btnW=(iw-6)/2;
    const saveDisabled=!renameReady||!s.playerRename.canRename;
    for(const [j,id,title,disabled] of [[0,'cancel','取消',false],[1,'save',renameLabel,saveDisabled]]){
      const b=box(x+j*(btnW+6),bY,btnW,44);button(ink,t,b,{title,titleSize:13,disabled});
      area(t,id,title,b,j?'playerRenameSave':'playerRenameCancel',j?data.renameData:{},null,disabled);
    }
    nameH=bY+44-rowY;
  }else{
    const textSize=clamp(w*.046,16,21);
    const name=leftText(p.name,ix,0,textSize,{color:'#eff7ff',weight:700,maxWidth:iw-54,wrap:true,maxLines:2,lineHeight:textSize*1.3});
    nameH=Math.max(44,name.userData.uiTextLines.length*textSize*1.3);
    name.position.y=rowY+nameH/2;
    const b=box(ix+iw-48,rowY+(nameH-44)/2,48,44);button(ink,t,b,{title:'改名',titleSize:12});
    area(t,'rename','修改玩家名字',b,'playerRename');
  }
  const summary=rowY+nameH+4,identityH=summary+47.3+pad-top;
  slice(body,t,'/art/psd-page-chrome-v1/chapter-idle.png',box(left,top,bw,identityH),8);
  const ax=left+pad,ay=top+(identityH-side)/2,avatar=data.avatar;
  fit(ink,t,avatar.source.src,box(ax+.14*side,ay+.14*side,.72*side,.72*side),true,.2);
  pic(ink,t,avatar.frameArt,box(ax,ay,side,side));
  leftText('战力',ix,summary+10,10,{color:'#c4dce9',weight:400});
  leftText(Number.isFinite(p.power)?fmt(p.power):'—',ix,summary+30.7,23,{color:'#ffe5a1',weight:700});
  if(!editing){
    const px=ix+(iw+8)/2;leftText('最高通关',px,summary+14.2,10,{color:'#c4dce9',weight:400});
    leftText(p.progress,px,summary+30.7,13,{color:'#f1f9ff',weight:700,maxWidth:(iw-8)/2});
  }
  const y=top+identityH+4;showcase(p,w,t,box(left,y,bw,Math.max(0,bottom-y)));
  if(data.inspect){paintItemDetail(data,w,h,t);return 'inspect';}
  return 'base';
}

export function openProfilePanel(screen,host,send){
  let latest,inspect=null,field=null;
  const panel=createLobbyPanel(screen,host,'名片',(data,w,h,t)=>page(data,w,h,t,field),cmd=>{
    if(cmd.type==='inspect'){inspect=cmd.data;field?.visible(false);refresh();return;}
    if(cmd.type==='close'&&inspect){inspect=null;field?.visible(true);refresh();return;}
    if(cmd.type==='editName'){field?.focus();return;}
    const cancel=cmd.type==='close'&&cmd.via==='keyboard'&&latest.modal.editingName;
    if(cmd.type!=='none')send(cancel?'playerRenameCancel':cmd.type,cmd.data||{},host);
  });
  function save(){if(latest.quote.renameReady&&latest.snapshot.playerRename.canRename)send('playerRenameSave',latest.renameData,host);}
  function refresh(){
    panel.update({...latest,inspect,coverNavigation:true,backdropAlpha:.55},
      JSON.stringify([latest.signature,latest.profile.name,latest.modal.editingName,latest.modal.nameError,latest.snapshot.playerRename,inspect]),'profile');
  }
  return {host,update(snapshot,modal,signature){
    const profile=playerInfoModel(snapshot,snapshot.playerName),quote=playerRenameQuote(snapshot.playerRename,fmt),r=snapshot.playerRename;
    latest={snapshot,modal:{...modal},signature,profile,quote,avatar:playerAvatarArt(snapshot),
      renameData:{renameRevision:quote.renameReady?r.revision:'',renameCost:quote.renameReady?r.cost:'',renameName:snapshot.playerName||profile.name}};
    if(modal.editingName&&!field)field=createNameField(panel.surface,modal.nameDraft??profile.name,panel.invalidate,save,
      ()=>send('playerRenameCancel',{},host),()=>screen.repaintHome?.());
    if(!modal.editingName&&field){field.close(true);field=null;}
    refresh();
  },close(){field?.close();field=null;panel.close();}};
}
