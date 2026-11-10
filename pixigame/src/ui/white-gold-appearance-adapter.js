// Preserve the authored UVs, geometry and animation. A small warm multiply on
// the blonde hair separates it from the similarly bright skin underneath.
const HAIR = new Map([[29,'ArtMesh38'],[30,'ArtMesh39'],[31,'ArtMesh40'],
 [32,'ArtMesh41'],[33,'ArtMesh42'],[34,'ArtMesh43'],[62,'ArtMesh92']]);
const TINT = [.97,.91,.81];

export function createWhiteGoldAppearanceAdapter(model) {
 const ids=model.getModel().drawables.ids;
 for(const [index,id] of HAIR)if(ids[index]!==id)throw Error('白金角色发丝图层不匹配');
 const owned=Object.hasOwn(model,'getMultiplyColor'),original=model.getMultiplyColor;
 let detached=false;
 model.getMultiplyColor=function(index){
  const color=original.call(this,index);
  return HAIR.has(index)?{...color,r:color.r*TINT[0],g:color.g*TINT[1],b:color.b*TINT[2]}:color;
 };
 return {
  begin(){},prepare(){},
  state:()=>({revision:'white-gold-face-separation-v2'}),
  detach(){if(detached)return;if(owned)model.getMultiplyColor=original;else delete model.getMultiplyColor;detached=true;},
 };
}
