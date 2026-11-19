import {nativeCollectionAccess,nativeCollectionRows} from '../../replica/native-collection-access.js';
import {nativeWeaponCatalogRows,nativeWeaponGroupId} from '../../replica/native-weapon-groups.js';
import {nativeCollectionArt,nativeSkillArt} from '../../replica/native-collection-art.js';
import {nativeWeaponSkillArt} from '../../replica/native-weapon-skill-art.js';
import {nativeWeaponDisplayText} from '../../replica/native-weapon-display.js';
import {nativePilotAppearance} from '../../replica/native-pilot-presentation.js';
import {NATIVE_AIRCRAFT_SKINS} from '../../replica/native-aircraft-skins.js';
import {collectionQualityRank} from '../../replica/native-quality.js';

const groups={weapon:'guns',aircraft:'skins',pilot:'pilots'};
export const isCatalog=page=>Object.hasOwn(groups,page);
export const plain=value=>nativeWeaponDisplayText(String(value??'').replace(/<[^>]*>/g,''));
export function catalogModel(data){
  const {tab:kind,catalog:ui,snapshot:s}=data,group=groups[kind],collection=s.replicaCollection;
  if(!group||!collection)return null;
  const weapons=kind==='weapon',raw=nativeCollectionRows(group,s),list=weapons?nativeWeaponCatalogRows(raw):raw;
  const decorate=row=>{const access=nativeCollectionAccess(group,s,row),skills=row.stage?.skills||[],source=skills[0];
    return {row,id:row.id,actualId:row.catalogSelectionId??row.id,name:row.name,skillName:skills.map(k=>plain(k.name)).join('、')||row.name,
      description:skills.map(k=>plain(k.description)).join('\n'),image:nativeCollectionArt(row),skillIcon:weapons?nativeWeaponSkillArt(row):source&&nativeSkillArt(source),
      skillLabel:source&&plain(source.name),activated:access.activated,access,rank:collectionQualityRank(row.quality),stars:Math.max(1,...row.stages.map(v=>v.star))};};
  const items=list.map(decorate),requested=raw.find(r=>String(r.id)===String(ui.id)),family=weapons&&requested?nativeWeaponGroupId(requested):ui.id;
  const selected=items.find(i=>String(i.id)===String(family))||items.find(i=>i.access.using)||items[0];
  if(!selected)return null;
  const displayed=ui.skillTab&&!weapons?items.find(i=>i.access.using)||selected:selected;
  const deployed=weapons&&raw.find(i=>i.id===collection.useWeaponMap[0]);
  const skillWeapon=weapons&&(requested||deployed||raw[0]),type=skillWeapon?.weaponType;
  const slots=weapons?collection.weaponSkillMap[type]||[0,0]:kind==='aircraft'?collection.slots:collection.pilotSlots||[0,0,0];
  const slot=Number.isInteger(ui.selectedSkillSlot)&&ui.selectedSkillSlot>=0&&ui.selectedSkillSlot<slots.length?ui.selectedSkillSlot:null;
  const bank=!weapons?items.filter(i=>i.activated&&i.row.stage.skills.length):[];
  const choice=bank.find(i=>String(i.id)===ui.selectedSkillId)||(slot!==null?bank.find(i=>i.id===slots[slot]):null);
  const appearance=kind==='pilot'?nativePilotAppearance(displayed.id):null,plane=kind==='aircraft'&&(displayed.row.baseAppearanceId||NATIVE_AIRCRAFT_SKINS[displayed.id]);
  return {kind,group,items,raw,skillWeapon,deployed,selected,displayed,slot,slots,choice,bank,plane,appearance,ui,s,collection};
}
export function catalogBounds(w,h,safe=0){
  const top=Math.max(12,w*.03),content=h-top,hero=content/2+.03148148*w,head=Math.max(44,.14266667*w),divider=top+hero;
  const slot=Math.max(44,.15*w),btn=Math.max(44,.137*w),slotY=divider-.06*w-slot,controls=slotY+(slot-btn)/2;
  const footer=Math.max(54,182*w/1080)+safe;
  return {top,content,hero,divider,head,slot,slotY,controls,btn,list:divider+head,end:h-footer,footer};
}
export function catalogAircraftRect(w,h){const v=catalogBounds(w,h);return {x:.02*w,y:v.top+v.content/2-.8823*w,w:.96*w,h:.70*w};}

