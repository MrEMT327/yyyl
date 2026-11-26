import {paintRewardItemSlot} from '../../ui/reward-item-art.js';
import {preparePsdPopupArt,paintPsdPopup} from '../../ui/psd-popup-art.js';
import {nineSliceGeometry} from '../../ui/nine-slice-geometry.js';
import {createLobbyPanel} from './lobby-panel.js';
import {backpackOptions} from './backpack-actions.js';
import {RESOURCE_ICONS} from '../../ui/resource-icons.js';
import {weaponIconUrl} from '../../ui/weapon-icon-source.js';

const titleFont='PsdPopup,"Microsoft YaHei",sans-serif',bodyFont='"Microsoft YaHei",sans-serif';
const rect=(x,y,w,h)=>({x,y,w,h});
const ink='#263e58',closeArt='/art/psd-popup-v1/close.png';
function itemSlot(surface,item,x,y,side,image,quantity=true){
  const art={...item,amount:item.count,showQuantity:quantity};
  paintRewardItemSlot(surface,art,{x,y,size:side},image);
  if(!item.image)surface.text(item.name,x+side/2,y+side/2,{size:Math.max(10,side*.2),maxWidth:side*.78,align:'center',color:ink});
  if(item.pilotFragment){
    surface.panel(x+3,y+3,28,15,{fill:'#224b6d',stroke:'#122b41',radius:3});
    surface.text('碎片',x+17,y+10,{size:11,weight:800,align:'center',family:bodyFont});
  }
}
function paper(art,kind,r,unit,tools){
  if(!preparePsdPopupArt(kind))tools.waitForArt();
  paintPsdPopup(art,kind,r.x,r.y,r.w,r.h,unit);
}
function label(art,text,x,y,size,color,maxWidth,align='left',weight=400,family=bodyFont){
  return art.text(text,x,y,{size,color,maxWidth,align,weight,family});
}
function closeButton(art,tools,scope,r,text){
  const first=art.group.children.length;
  tools.image(art,closeArt,r.x,r.y,r.w,r.h);
  tools.buttonFace?.('close',r,art,first,scope);
  tools.control('close',text,r,{type:'close'},{scope});
}
function button(art,tools,r,command){
  const plate=tools.image(art,'/art/psd-buttons-v1/button-blue.png',r.x,r.y,r.w,r.h,false);
  plate.geometry.dispose();plate.geometry=nineSliceGeometry(r.w,r.h,219,85,18,10);
  if(command.disabled)plate.material.color.setHex(0x87939e);
  label(art,command.label,r.x+r.w/2,r.y+r.h/2,13,'#fff',r.w-10,'center',700);
}
function backdrop(art,tools,panel,scope,alpha){
  tools.backdrop(art,alpha,undefined,{style:scope==='base'?'large':'small',scope,cx:panel.x+panel.w/2,cy:panel.y+panel.h/2});
  tools.control('outside','返回',tools.frameRect,{type:'close'},{scope});
  tools.control('paper','',panel,{type:'none'},{scope});
}
function grid(data,w,h,tools){
  const unit=w/1080,psd=w/750,pw=994*unit,ph=Math.min(1443.230957*unit,h*.88);
  const p=rect((w-pw)/2,(h-ph)/2-50.324402*unit,pw,ph);
  const art=tools.layer('bag').art;
  backdrop(art,tools,p,'base',.6);paper(art,'primary',p,psd,tools);
  const tx=p.x+58*psd,ty=p.y+69.5*psd;
  label(art,'背包',tx,ty+2,40*psd,'#57677a',pw-158*psd,'left',400,titleFont);
  label(art,'背包',tx,ty,40*psd,'#fff',pw-158*psd,'left',400,titleFont);
  const closeSize=Math.max(44,100*unit);
  closeButton(art,tools,'base',rect(p.x+pw-12*unit-closeSize,p.y+9.0155*unit,closeSize,closeSize),'关闭背包');
  const g=rect(p.x+20*psd,p.y+(126.11548+32.01)*unit,pw-48*psd,ph-(126.11548+32.01+60)*unit);
  const side=170*unit,gap=13*unit,rowH=190*unit,x0=g.x+(g.w-5*side-4*gap)/2,y0=g.y+6*unit;
  const items=tools.layer('items','base').art;
  const height=data.items.length?6*unit+Math.ceil(data.items.length/5)*rowH-20*unit:1000*unit;
  tools.region('base',g,height);
  if(!data.items.length)label(items,'背包里还没有道具',g.x+g.w/2,y0+500*unit,14,'#3e5d74',g.w,'center');
  data.items.forEach((item,i)=>{
    const r=rect(x0+i%5*(side+gap),y0+Math.floor(i/5)*rowH,side,side),id='item:'+item.id;
    itemSlot(items,item,r.x,r.y,side,tools.image);
    if(tools.keyFocus===id)items.line([[r.x,r.y],[r.x+r.w,r.y],[r.x+r.w,r.y+r.h],[r.x,r.y+r.h],[r.x,r.y]],'#245c80',1,2);
    tools.control(id,item.name+'，数量 '+item.count,r,{type:'select',id:item.id},{zone:'base'});
  });
  return psd;
}
function detail(data,w,h,psd,tools){
  const item=data.item,pw=w*796.4/1080,innerW=pw-76*psd,innerX=(w-pw)/2+38*psd;
  const frame=tools.layer('detail-frame').art,content=tools.layer('detail-content','detail').art;
  let cursor=10;const hits=[];
  function paragraph(text){
    const mesh=content.text(text,innerX,0,{size:14,weight:400,color:ink,maxWidth:innerW,lineHeight:24,wrap:true,family:bodyFont});
    const height=mesh.userData.uiTextLines.length*24;mesh.position.y=cursor+height/2;cursor+=height;
  }
  function choiceButton(x,width,row){
    const r=rect(x,cursor,width,44),kind=row.action||row.type;
    if(kind==='editNumber'){
      content.panel(x,cursor,width,44,{fill:'#fff9e9',stroke:'#617681',radius:3,opacity:1});
      label(content,String(row.value),x+width/2,cursor+22,14,ink,width-4,'center',700);
    }else button(content,tools,r,row);
    hits.push({id:row.id,label:row.label,r,action:{...row,type:kind},disabled:Boolean(row.disabled)});
  }
  paragraph(item.description||'');
  let chosen=null;
  if(data.options.length)cursor+=12;
  for(const row of data.options){
    if(row.kind==='text')paragraph(row.text);
    else if(row.kind==='buttons'){
      const size=(innerW-8*(row.options.length-1))/row.options.length;
      row.options.forEach((o,i)=>{choiceButton(innerX+i*(size+8),size,o);
        if(o.hint)label(content,o.hint,innerX+i*(size+8)+size/2,cursor+59,14,ink,size,'center');
      });cursor+=row.options.some(o=>o.hint)?69:44;
    }else if(row.kind==='quantity'){
      label(content,row.label,innerX,cursor+9,14,ink,innerW,'left',700);cursor+=26;
      const quick=Math.min(44,(innerW-15)*.21),maxWidth=Math.min(56,(innerW-15)*.25);
      const inputWidth=innerW-quick*2-maxWidth-15,value=Number(row.value);
      choiceButton(innerX,quick,{id:'less',label:'−',type:'quantity',value:Math.max(1,(row.valid?value:1)-1),disabled:row.disabled||row.valid&&value<=1});
      choiceButton(innerX+quick+5,inputWidth,{id:'number',label:row.label,type:'editNumber',value:row.value,disabled:row.disabled});
      choiceButton(innerX+quick+inputWidth+10,quick,{id:'more',label:'+',type:'quantity',value:Math.min(row.max,(row.valid?value:1)+1),disabled:row.disabled||row.valid&&value>=row.max});
      choiceButton(innerX+innerW-maxWidth,maxWidth,{id:'max',label:'最大',type:'quantity',value:row.max,disabled:row.disabled||row.valid&&value===row.max});cursor+=44;
    }else if(row.kind==='choice'){
      chosen=row;label(content,row.label,innerX,cursor+10,14,ink,innerW,'left',700);cursor+=25;
      choiceButton(innerX,innerW,{id:'choice',type:'openChoices',label:row.selected.label+' ▾'});cursor+=44;
    }
    cursor+=10;
  }
  const bodyLength=cursor+(data.options.length?0:10),topInset=112*psd+55+12,bottomInset=35*psd;
  const ph=Math.min(h*.85,topInset+bodyLength+bottomInset),p=rect((w-pw)/2,(h-ph)/2,pw,ph);
  const bodyY=p.y+topInset,bodyH=Math.max(1,ph-topInset-bottomInset);
  // The backdrop is registered first so dialog controls and list rows win hit tests.
  backdrop(frame,tools,p,'detail',.6);paper(frame,'secondary',p,psd,tools);
  const font=Math.max(16,Math.min(22,32*psd));
  label(frame,item.name,innerX,p.y+39*psd+font*1.15/2,font,'#1c334c',pw-154*psd,'left',400,titleFont);
  itemSlot(frame,item,innerX,p.y+112*psd,55,tools.image,false);
  label(frame,'数量：'+item.count,innerX+65,p.y+112*psd+27.5,14,'#172c40',innerW-65);
  closeButton(frame,tools,'detail',rect(p.x+pw+16*psd-44,p.y-21*psd,44,44),'关闭道具详情');
  tools.region('detail',rect(innerX,bodyY,innerW,bodyH),bodyLength);
  for(const mesh of content.group.children)mesh.position.y+=bodyY;
  for(const hit of hits){hit.r.y+=bodyY;tools.control(hit.id,hit.label,hit.r,hit.action,{scope:'detail',zone:'detail',disabled:hit.disabled});}
  if(!data.openChoices||!chosen)return 'detail';
  const options=tools.layer('choice-frame').art,rows=tools.layer('choices','choice').art;
  const rowH=44,listH=Math.min(h*.64,chosen.options.length*rowH),list=rect(innerX,(h-listH)/2,innerW,listH);
  backdrop(options,tools,list,'choice',.4);options.quad(list.x,list.y,list.w,list.h,'#d9e3ed');
  tools.region('choice',list,chosen.options.length*rowH);
  chosen.options.forEach((o,i)=>{const r=rect(list.x,list.y+i*rowH,list.w,rowH);
    if(o.id===chosen.selected.id)rows.quad(r.x,r.y,r.w,r.h,'#b2d6eb');
    label(rows,o.label,r.x+10,r.y+r.h/2,14,ink,r.w-20);
    tools.control('choose:'+o.id,o.label,r,{type:'choose',id:o.id},{scope:'choice',zone:'choice'});
  });return 'choice';
}
export function openBackpack(screen,host,action){
  preparePsdPopupArt('primary');preparePsdPopupArt('secondary');
  const panel=createLobbyPanel(screen,host,'背包',(data,w,h,tools)=>{
    const psd=grid(data,w,h,tools);return data.item?detail(data,w,h,psd,tools):'base';
  },action);
  return {close:panel.close,update(rows,snapshot,state){
    const items=rows.map(row=>({...row,image:row.image||(row.weaponId?weaponIconUrl(row.weaponId):RESOURCE_ICONS[row.id]?.url)}));
    const item=items.find(row=>row.id===state.bagItem),options=item?backpackOptions(item,snapshot,state):[];
    const data={items,item,options,openChoices:Boolean(state.bagSelectOpen)};
    const key=JSON.stringify([items.map(i=>[i.id,i.name,i.count,i.image,i.qualityRank,i.qualityKnown]),item?.id,item?.description,options,data.openChoices]);
    panel.update(data,key,item?.id||'');
  }};
}
