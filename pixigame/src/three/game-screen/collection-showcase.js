import {area,box,clamp,pic,words} from './menu-art.js';
import {atlas,normalFit,psdAction,selection,skill,stars,symbol} from './catalog-art.js';
import {paintSecondaryPaper} from './panel-paper.js';
import detailArt from './detail-art.json';
import {collectionDetailModel} from '../../ui/collection-detail-model.js';
import {nativeCollectionAccess} from '../../replica/native-collection-access.js';
import {nativeCollectionArt} from '../../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../../replica/native-weapon-skill-art.js';
import {nativeWeaponVariants} from '../../replica/native-weapon-groups.js';
import {collectionQualityRank} from '../../replica/native-quality.js';

export function weaponShowcase(data,w,h,t,row){
  const s=data.snapshot,collection=s.replicaCollection,model=collectionDetailModel(row,collection.attributeNames);
  const access=nativeCollectionAccess('guns',s,row),pw=.9*w,ph=Math.min(h*.84,1.4*w);
  const p=paintSecondaryPaper(t,w,h,pw,ph,row.name,{alpha:.60});
  const x=p.x+40*w/750,bw=pw-80*w/750,top=p.top,vh=Math.max(90,.27*w),gap=w*.025,sh=Math.max(1,ph-(top-p.y)-.07*w-vh-gap);
  const a=t.layer('weapon-stage').art,b=box(x,top,bw,sh),attrs={kind:'guns',id:row.id,revision:collection.revision};
  pic(a,t,detailArt['weapon-stage'],b);const inset=w*.0325,sx=x+inset,sy=top+inset;
  stars(a,t,box(sx,sy,model.maxStar*.054*w,.054*w),model.maxStar,row.owned?row.star:0);
  const fs=clamp(w*.036,12,17);
  for(const [i,attr] of model.attributes.entries()){const cy=sy+.07*w+(i+.5)*fs*1.5;
    const m=words(a,attr.label,sx,cy,fs,{align:'left',weight:700,shadow:{color:'#041523',y:1,blur:2}});
    words(a,attr.amount,m.position.x+m.scale.x/2+w*.01,cy,fs,{align:'left',weight:700,color:'#8de4e9'});}
  normalFit(a,t,'/art/project-fleet-stage-v2/platform.png',box(x+.08*bw,top+sh*.57,bw*.84,sh*.29));
  const weapon=box(x+bw*.165,top+sh*.265,bw*.67,sh*.47);normalFit(a,t,nativeCollectionArt(row),weapon);
  area(t,'attack','查看'+row.name+'基础攻击',weapon,'nativeWeaponPreview',{id:row.id,mode:'base'});
  const skillW=Math.max(64,.19*w),skillH=Math.max(44,.14*w),skillBox=box(x+bw-.028*w-skillW,top+.028*w,skillW,skillH+.01*w+24);
  const url=nativeWeaponSkillArt(row),sb=box(skillBox.x+(skillW-skillH)/2,skillBox.y,skillH,skillH);
  if(url)skill(a,t,url,sb);else symbol(a,t,'nav-skill',sb);
  const label=row.owned?'已获得技能':'技能预览';pic(a,t,'/art/project-navigation-v2/background.png',box(skillBox.x,sb.y+sb.h+.01*w,skillW,24));
  words(a,label,skillBox.x+skillW/2,sb.y+sb.h+.01*w+12,clamp(w*.03,12,14));area(t,'skills',label,skillBox,'nativeSkillPreview',attrs);
  const costs=row.maxed?[]:row.costs,costH=costs.length?16:0,cy=top+sh-.022*w-costH-48;
  const equip=access.available&&!access.using,aw=equip?(bw*.84-6)/2:Math.min(160,bw*.84),ay=box(equip?x+bw*.5+3:x+(bw-aw)/2,cy,aw,48);
  if(equip)psdAction(a,t,box(x+.08*bw,cy,aw,48),{id:'equip',label:'替换出战',cmd:'nativeOperation',data:{...attrs,id:access.selectionId,operation:'select'}});
  psdAction(a,t,ay,{id:'grow',label:row.maxed?'已满星':row.owned?'升星':'激活',cmd:'nativeOperation',data:{...attrs,operation:row.owned?'star':'unlock'},disabled:!row.canPurchase||row.maxed,size:15});
  const costNodes=costs.map(it=>{const m=words(a,it.name+' '+it.available+'/'+it.count,0,cy+57.5,10,{weight:700,color:it.available<it.count?'#ffae9d':'#edf9ff'});return {m,it};});
  let cx=x+(bw-costNodes.reduce((sum,{m})=>sum+m.scale.x,0)-Math.max(0,costNodes.length-1)*5)/2;
  for(const {m,it} of costNodes){m.position.x=cx+m.scale.x/2;area(t,'cost-'+it.id,it.name,box(cx,cy+48,m.scale.x,18),'inspect',{itemId:it.id});cx+=m.scale.x+5;}
  const vy=top+sh+gap,variants=nativeWeaponVariants(collection.guns,row),side=Math.min(vh-.02*w,.25*w),vy0=vy+(vh-side)/2;
  pic(a,t,detailArt['weapon-variants'],box(x,vy,bw,vh));
  const zone='variants-'+(row.familyId??variants[0]?.id??row.id);t.region(zone,box(x,vy,bw,vh),w*.04+variants.length*(side+.03*w),'x');
  const cards=t.layer('weapon-variants',zone).art;
  for(const [i,it] of variants.entries()){
    const left=x+.02*w+i*(side+.03*w),b=box(left,vy0,side,side);pic(cards,t,atlas['card-frame-'+collectionQualityRank(it.quality)],b);
    const m=normalFit(cards,t,nativeCollectionArt(it),box(left+side*.08,vy0+side*.18,side*.84,side*.64));if(m&&!it.owned)m.material.color.set('#bcc1c4');
    if(it.equipped||!it.owned)symbol(cards,t,it.equipped?'check':'lock',box(left+side*(it.equipped?.06:.78),vy0+side*.055,side*(it.equipped?.20:.16),side*(it.equipped?.20:.16)));
    const count=Math.max(it.star,...it.stages.map(st=>st.star));stars(cards,t,box(left+side*.08,vy0+side*.81,side*.84,side*.128),count,it.owned?it.star:0,{align:'center'});
    if(it.id===row.id)selection(cards,t,b);area(t,'variant-'+it.id,it.name,b,'nativeWeaponSkinSelect',{id:it.id},zone);
  }
}

