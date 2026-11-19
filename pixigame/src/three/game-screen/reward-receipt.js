import {createLobbyPanel} from './lobby-panel.js';
import {paintItemDetail} from './item-details.js';
import {area,box,pic,words,titleFont,clamp} from './menu-art.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';
import {paintRewardItemSlot} from '../../ui/reward-item-slot.js';
import {rewardItemModel} from '../../ui/reward-item-model.js';
import {shopBoxRewards} from '../../ui/shop-box-result-cards.js';
import {boxActions,paintBoxActions} from './box-result-actions.js';
import {animateMeshes} from './ui-motion.js';
import art from './receipt-art.json';

function gridFor(w,count,available){
  const short=count<=3,gap=w*(short ? .03 : .02);
  const cols=short?Math.max(1,count):count===6?3:[4,7,8].includes(count)?4:5;
  const cell=short?(count===1?Math.min(available,w*.52):clamp(w*.25,64,112)):(available-4*gap)/5;
  return {cols,cell,gap,side:short?Math.min(cell,clamp(w*.22,64,96)):cell,
    rowGap:w*(short ? .03 : .04),font:short?clamp(w*.038,15,17):clamp(w*.032,12,15)};
}

function receipt(data,w,h,t){
  const paper=t.layer('receipt-paper').art,items=t.layer('receipt-items','base').art;
  const pw=.94*w,x=(w-pw)/2,bw=pw-.12*w,header=w/6,g=gridFor(w,data.items.length,bw);
  const live=data.liveBox;
  if(live){g.font=.03*w;if(data.items.length===10)g.rowGap=.05*w;}
  const textGap=w*(live ? .012 : .015),lineHeight=g.font*(live?1.45:1.3);
  const rows=[];
  for(let i=0;i<data.items.length;i+=g.cols){
    const batch=data.items.slice(i,i+g.cols),left=(w-batch.length*g.cell-(batch.length-1)*g.gap)/2;
    const cells=batch.map((item,j)=>{
      const cx=left+j*(g.cell+g.gap)+g.cell/2;
      const label=words(items,item.name,cx,0,g.font,{color:'#203c52',maxWidth:g.cell,wrap:true,lineHeight});
      const labelTextH=label.userData.uiTextLines.length*lineHeight,labelH=Math.max((live?1.3:2.6)*g.font,labelTextH);
      const status=!live&&item.receiptStatus?words(items,item.receiptStatus,cx,0,11,{color:'#203c52',weight:500,maxWidth:g.cell,wrap:true,lineHeight:14.3}):null;
      const statusH=status?status.userData.uiTextLines.length*14.3:0;
      return {item,index:i+j,cx,label,labelTextH,labelH,status,statusH,height:g.side+textGap+labelH+(status?textGap+statusH:0)};
    });
    rows.push({cells,height:Math.max(...cells.map(c=>c.height))});
  }
  const actionsH=data.actions.length ? .07*w+Math.max(48,.12*w) : 0;
  const gridH=rows.reduce((sum,row,j)=>sum+row.height+(j?g.rowGap:0),0);
  const contentH=(live ? .07 : .03)*w+gridH+actionsH;
  const ph=Math.max(live ? .58*w : 0,Math.min((h-.10*w)*(live ? .82 : .76),header+contentH+.07*w)),y=(h-ph)/2;
  paper.quad(0,0,w,h,'#030c16',.5);
  area(t,'outside','关闭',box(0,0,w,h),'close');area(t,'paper','',box(x,y,pw,ph),'none');
  const frame=pic(paper,t,art.paper,box(x,y,pw,ph));frame.geometry.dispose();
  frame.geometry=slicedFrameGeometry(pw,ph,567,714,[110,44,55,255],w/750);
  const font=clamp(40*w/750,16,26);
  for(const [dy,color] of [[2,'#55677e'],[0,'#fff']])
    words(paper,data.title,x+58*w/750,y+header*.55+dy,font,{align:'left',family:titleFont,color,maxWidth:pw-.15*w});
  t.region('base',box(x+.06*w,y+header,bw,Math.max(1,ph-header-.07*w)),contentH);
  let top=y+header+(live ? .05 : .03)*w;
  for(const row of rows){
    for(const {item,index,cx,label,labelH,labelTextH,status,statusH,height} of row.cells){
      const sx=cx-g.side/2,start=items.group.children.length;
      paintRewardItemSlot(items,item,{x:sx,y:top,size:g.side},t.image);
      label.position.y=top+g.side+textGap+labelTextH/2;
      if(status)status.position.y=top+g.side+2*textGap+labelH+statusH/2;
      if(live)animateMeshes(t,[label,...items.group.children.slice(start)],cx,top+height/2,{entered:data.entered,reduced:data.reduced,
        delay:.16+.075*index,duration:.34,curve:[.2,.7,.25,1],frames:[{at:0,opacity:0,y:16,scale:.8},{at:1}]});
      if(item.gearUid)area(t,'gear-'+index,'查看当前装备',box(cx-g.cell/2,top,g.cell,height),'gearDetail',{id:item.gearUid},'base');
      area(t,'receipt-item-'+index,item.name,box(sx,top,g.side,g.side),'inspect',{index},'base');
    }
    top+=row.height+g.rowGap;
  }
  if(data.actions.length)paintBoxActions(items,t,w,x+.06*w,y+header+.07*w+gridH+.07*w,bw,data.pool,data.actions);
  const foot=box(x,y+ph+12,pw,44);
  words(paper,'点击空白处关闭',w/2,foot.y+22,14,{weight:500,color:'#d8e7ef',shadow:{color:'#07121c',y:1,blur:2}});
  area(t,'close','点击空白处关闭',foot,'close');
  if(data.inspect){paintItemDetail(data,w,h,t);return 'inspect';}
  return 'base';
}

export function openRewardReceipt(screen,host,send,sound){
  let latest,inspectIndex=null,identity,entered;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const panel=createLobbyPanel(screen,host,'获得奖励',receipt,command=>{
    if(command.type==='inspect'){inspectIndex=command.data.index;refresh();return;}
    if(command.type==='close'&&inspectIndex!=null){inspectIndex=null;refresh();return;}
    if(command.type!=='none')send(command.type,command.data||{},host);
  },{overlay:true});
  function refresh(){
    const inspect=latest.items[inspectIndex];
    panel.update({...latest,inspect},JSON.stringify([identity,latest.signature,latest.title,latest.items,latest.actions,inspectIndex]),'receipt-'+identity);
  }
  return {host,close:panel.close,update(snapshot,modal,signature){
    const isBox=modal.type==='shopBoxResult',liveBox=isBox&&!modal.history;
    const next=modal.id??modal.receipt?.id??modal.type;
    if(next!==identity){identity=next;inspectIndex=null;entered=performance.now()/1000;if(liveBox&&!reduced)sound?.('upgrade');}
    const rewards=isBox?shopBoxRewards(modal,snapshot).rewards:modal.rewards||[];
    latest={snapshot,signature,liveBox,pool:modal.pool,actions:isBox?boxActions(modal,snapshot):[],reduced,entered,
      title:isBox&&modal.history?'上次开箱结果':modal.title||'获得奖励',items:rewards.map(r=>rewardItemModel(r,snapshot))};
    refresh();
  }};
}
