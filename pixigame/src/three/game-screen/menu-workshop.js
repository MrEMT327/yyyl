import {area,art,box,clamp,pic,slice,titleFont,words} from './menu-art.js';
import {atlas,psdAction,symbol} from './catalog-art.js';
import {gearWorkshop} from './workshop-gear.js';
import {weaponWorkshop} from './workshop-weapon.js';

function mascot(t,a,b,reduced){
  const tex=t.texture('/art/onboarding-assistant-v1/expressions.png'),sprite=a.image(tex,b.x,b.y,b.w,b.h);
  const y=sprite.position.y,uv=sprite.geometry.attributes.uv,original=Array.from(uv.array);let last=-1;
  const animate=now=>{
    const phase=now/4.8%1,frame=reduced?0:(phase>=.14&&phase<.2||phase>=.28&&phase<.34)?3:(phase>=.62&&phase<.64||phase>=.67&&phase<.69)?1:phase>=.64&&phase<.67?2:0;
    if(frame!==last){for(let i=0;i<uv.count;i++)uv.setX(i,(frame+1-original[i*2])/4);uv.needsUpdate=true;last=frame;}
    sprite.position.y=y-(reduced?0:1-Math.cos(now*Math.PI*2/3))*1.5;
  };
  animate(0);if(!reduced)t.animate(animate);
}
export function workshopMenu(data,w,h,t){
  const a=t.layer('workshop').art,gear=data.workshop.kind==='gear',top=Math.max(12,w*.0325),stageH=(gear?.80:.704)*w;
  const barY=top+stageH,barH=gear?Math.max(50,w*117.9/1080):Math.max(44,w*.105),gridY=barY+barH;
  const footH=(gear?Math.max(56,w*.15):Math.max(54,.16*w))+(data.safeBottom||0),footY=h-footH;
  const bleed=t.topBleed||0;
  pic(a,t,atlas['workshop-wall'],bleed?box(0,-bleed,w,h+bleed):box(0,top,w,h-top));
  pic(a,t,atlas['workshop-stage'],box(0,top,w,stageH));
  pic(a,t,atlas['workshop-header'],box(w*.03,top+.023*w,.94*w,w*.082));
  pic(a,t,atlas['workshop-warehouse'],box(0,barY,w,barH));words(a,'仓库',w/2,barY+barH/2,clamp(.048*w,16,22),{family:titleFont});
  pic(a,t,art['gear-grid'],box(0,gridY,w,Math.max(1,footY-gridY)));
  const foot=t.layer('workshop-footer').art,safe=data.safeBottom||0;
  if(safe)foot.quad(0,h-safe,w,safe,'#101c23');
  pic(foot,t,atlas['workshop-footer'],box(0,footY,w,footH-safe));
  const dockY=footY+(footH-(data.safeBottom||0))/2;
  const back=box(10,dockY-22,48,44);slice(foot,t,'/art/project-return-button-v1/face.png',box(back.x,dockY-19,48,38),8);
  const arrow=symbol(foot,t,'chevron-right',box(back.x+11,dockY-13,26,26));arrow.rotation.z=Math.PI;
  area(t,'back',data.workshop.backLabel,back,'catalogBack');
  function button(id,label,cmd,place,disabled=false,payload={},opts={}){
    const confirm=place==='confirm',width=confirm?(gear?Math.min(160,w*.46):w*.70):Math.min(100,Math.max(80,.215*w));
    const b=confirm?box(gear?(w-width)/2:w-width-.02*w,dockY-24,width,48):box(place==='left'?w*.025:w*.975-width,barY+(barH-44)/2,width,44);
    psdAction(confirm?foot:a,t,b,{id,label,cmd,data:payload,disabled,gold:confirm,size:confirm?clamp(w*.042,14,20):clamp(w*.034,12,16),...opts});
  }
  function assistant(rows,hasTarget){
    const size=Math.min(w*(gear?.34:.32),gear?148:144),by=top+stageH-(gear?.08*w:.03*w)-size;
    mascot(t,a,box(w-size-(gear?.005:.05)*w,by,size,size),data.reduced);
    const x=w*(gear?.34:.35),y=top+stageH*(gear?.22:.18),bw=gear&&!hasTarget?Math.min(w*.63,26+9*clamp(.0355*w,13,16)):w*(gear?.63:.61);
    const maxH=Math.max(42,by-.0125*w-y),font=clamp(gear?.0355*w:.032*w,gear?13:11,gear?16:15);
    const layer=t.layer('assistant-text','message').art;let py=y+10;
    for(const [i,row] of rows.entries()){
      if(Array.isArray(row)){
        const cy=py+font*.7;words(layer,row[0],x+13,cy,font,{align:'left',maxWidth:bw*.4});words(layer,row[1],x+bw*(row[2]?.65:.9),cy,font,{align:'right'});
        if(row[2]){const mark=symbol(layer,t,'equipment-upgrade',box(x+bw*.68,cy-font*.58,font*1.16,font*1.16));mark.rotation.z=-Math.PI/2;
          words(layer,row[2],x+bw-13,cy,font,{align:'right',color:'#a7f69b'});}py+=font*1.4+4;
      }else{const fs=!gear&&i===0?Math.max(16,font):font,lh=fs*1.4;
        const m=words(layer,row,x+11,py,fs,{align:'left',maxWidth:bw-24,weight:gear||i===0?600:400,wrap:true,lineHeight:lh,color:!gear&&i>1?'#b5d2df':'#edf7ff'});
        const rh=m.userData.uiTextLines.length*lh;m.position.y+=rh/2;py+=rh+4;}
    }
    const natural=py-y+6,height=Math.min(maxH,Math.max(gear?44:w*.18,natural));
    a.quad(x+2,y+2,bw-4,height-4,'#384e60',.92);slice(a,t,gear?'/art/psd-page-chrome-v1/chapter-face.png':'/art/equipment-controls-v1/menu-panel.png',box(x,y,bw,height),8,24);
    if(natural<height)for(const m of layer.group.children)m.position.y+=(height-natural)/2;
    t.region('message',box(x,y,bw,height),natural);
  }
  const layout={a,top,stageH,gridY,footY,button,assistant};
  (gear?gearWorkshop:weaponWorkshop)(data,w,h,t,layout);
}
