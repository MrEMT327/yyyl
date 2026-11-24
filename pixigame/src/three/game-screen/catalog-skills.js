import {area,box,clamp,pic,qualityFrame,slice,titleFont,words} from './menu-art.js';
import {normalFit,psdAction,selection,skill} from './catalog-art.js';
import {nativeWeaponSkillArt} from '../../replica/native-weapon-skill-art.js';
import {nativeWeaponGroupId} from '../../replica/native-weapon-groups.js';
import {plain} from './catalog-model.js';

export function skillSlots(a,t,d,w,v){
  const gun=d.kind==='weapon',gap=w*(gun?.05:.045),length=d.slots.length,start=(w-length*v.slot-(length-1)*gap)/2;
  d.slots.forEach((id,i)=>{const b=box(start+i*(v.slot+gap),v.slotY,v.slot,v.slot),row=d.raw.find(r=>r.id===id),so=d.items.find(it=>it.id===id);
    slice(a,t,gun?qualityFrame(2):'/art/weapon-catalog-psd-v1/frame-blue.png',b,6,gun?18:24);
    const r=box(b.x+v.slot*.065,b.y+v.slot*.065,v.slot*.87,v.slot*.87);
    skill(a,t,row?(gun?nativeWeaponSkillArt(row):so?.skillIcon):null,r);
    if(d.slot===i)selection(a,t,b);
    words(a,i+1,b.x+4,b.y+7,9,{align:'left',weight:700,color:'#fff'});
    area(t,'slot-'+i,'技能位置'+(i+1)+'，'+(row?.name||'空闲'),b,gun?'nativeWeaponSkillSlot':'nativeSlotPick',gun?{slot:i,id:d.skillWeapon.id}:{slot:i,kind:d.group});});
}
export function weaponSkills(d,t,w,v){
  const row=d.skillWeapon,zone='weapon-skills-'+row.weaponType+'-'+d.slot,a=t.layer('weapon-skills',zone).art;
  const rect=box(0,v.list,w,v.end-v.list),margin=.022*w,pad=.03*w;
  if(d.slot===null){
    const bases=d.raw.filter(i=>nativeWeaponGroupId(i)===i.id),sw=(w-2*margin-3*.021*w)/4,cellH=sw+20;
    t.region(zone,rect,2*pad+Math.ceil(bases.length/4)*cellH);
    bases.forEach((r,i)=>{const x=margin+(i%4)*(sw+.021*w),y=v.list+pad+Math.floor(i/4)*cellH,b=box(x,y,sw,sw);
      slice(a,t,qualityFrame(2),b,6);skill(a,t,nativeWeaponSkillArt(r),b);if(r.weaponType===row.weaponType)selection(a,t,b);
      words(a,r.name,x+sw/2,y+sw+9,12,{family:titleFont,maxWidth:sw});area(t,'skill-type-'+r.id,r.name,box(x,y,sw,cellH),'nativeWeaponSkillBrowse',{id:r.id},zone);});return;
  }
  const sources=d.raw.filter(r=>r.weaponType===row.weaponType&&r.owned&&r.stage.skills.length),ih=.17*w,rh=ih+2*pad;
  t.region(zone,rect,2*pad+sources.length*(rh+6));
  if(!sources.length){words(a,'暂无可携带的技能',w/2,v.list+43,14,{color:'#bfd5e2'});return;}
  sources.forEach((r,i)=>{const y=v.list+pad+i*(rh+6),b=box(margin,y,w-2*margin,rh);
    slice(a,t,'/art/weapon-catalog-psd-v1/frame-blue.png',b,6,24);
    const icon=box(margin+pad,y+pad,ih,ih),fitted=d.slots.indexOf(r.id);
    skill(a,t,nativeWeaponSkillArt(r),icon);if(fitted>=0)words(a,fitted+1,icon.x+5,icon.y+7,9,{align:'left'});
    area(t,'preview-'+r.id,'查看'+r.name+'技能详情',icon,'nativeSkillPreview',{kind:'guns',id:r.id},zone);
    const info=r.stage.skills.at(-1),x=icon.x+ih+.025*w,bw=.19*w,copyW=b.w-ih-2*pad-bw-.05*w;
    words(a,plain(info.name)||r.name,x-2,y+rh*.37,16,{family:titleFont,align:'left',maxWidth:copyW});
    words(a,plain(info.description),x-2,y+rh*.66,clamp(.03*w,11,14),{align:'left',maxWidth:copyW,wrap:true,maxLines:2,weight:400,lineHeight:16.5});
    psdAction(a,t,box(b.x+b.w-bw-pad,y+(rh-44)/2,bw,44),{id:'equip-'+r.id,label:fitted>=0?'卸下':'装备',cmd:'nativeWeaponSkillEquip',zone,
      data:{id:fitted>=0?0:r.id,slot:fitted>=0?fitted:d.slot,weaponType:row.weaponType,revision:d.collection.revision}});
  });
}
export function fleetSkills(d,t,w,v){
  const withButton=!!d.bank.length,lower=withButton?Math.max(68,.17*w):0,zone=d.kind+'-skills',a=t.layer('fleet-skills',zone).art;
  const space=box(0,v.list,w,v.end-lower-v.list),side=.15*w;
  let y=v.list;
  if(!withButton){const caption=d.kind==='pilot'?'暂无技能':d.raw.some(r=>r.owned)?'暂无可携带技能，可在战机详情查看。':'激活战机后可携带技能。';
    words(a,caption,w/2,y+43,13,{color:'#c5d9e7',weight:400});}
  for(const it of d.bank){
    y+=.02*w;const b=box(.03*w,y,.94*w,side),pad=.03*w,x=b.x+pad+side+.03*w,tw=b.w-2*pad-side-.03*w;
    // Lay out the copy first so multi-line skills determine this row's height.
    const description=words(a,it.description,x-2,0,clamp(.035*w,12,16),{color:'#c9dfec',weight:400,align:'left',maxWidth:tw,wrap:true,lineHeight:20});
    b.h=2*pad+Math.max(side,22+20*description.userData.uiTextLines.length);
    const back=slice(a,t,d.choice?.id===it.id?'/art/equipment-controls-v1/option-selected.png':'/art/equipment-controls-v1/menu-panel.png',b,8,24);
    back.renderOrder=-1;
    const icon=box(b.x+pad,y+(b.h-side)/2,side,side);skill(a,t,it.skillIcon,icon);
    const first=y+(b.h-22-20*description.userData.uiTextLines.length)/2;
    words(a,it.skillName,x-2,first+9,16,{family:titleFont,align:'left',color:d.choice?.id===it.id?'#fff':'#b6ccda',maxWidth:tw});
    if(d.slots.includes(it.id))words(a,'已装备',b.x+b.w-pad,first+8,10,{align:'right',color:'#88e5bb'});
    description.position.y=first+22+description.userData.uiTextLines.length*10;
    area(t,'preview-'+it.id,it.skillName,icon,'nativeSkillPreview',{kind:d.group,id:it.id},zone);
    area(t,'choose-'+it.id,'选择'+it.skillName,box(x,y,b.x+b.w-x,b.h),'fleetSkillChoose',{kind:d.kind,id:it.id},zone);
    y+=b.h+.02*w;
  }
  t.region(zone,space,y-v.list+.02*w);
  if(withButton){const f=t.layer('fleet-skill-submit').art,bw=Math.min(.49*w,220),bh=48,b=box((w-bw)/2,v.end-(lower+bh)/2,bw,bh);
    const remove=d.slot!==null&&d.choice&&d.slots[d.slot]===d.choice.id;
    psdAction(f,t,b,{id:'apply-slot',label:remove?'卸下':'装备',cmd:'nativeOperation',disabled:d.slot===null||!d.choice,
      data:{kind:d.group,operation:'slot',id:remove?0:d.choice?.id,slot:d.slot,revision:d.collection.revision}});}
}
