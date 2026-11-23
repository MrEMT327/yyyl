export const navEdges=[0,139,279.5,467.5,608,750];
export const navBodyEnd=139/151,navFillStart=.79;
export const carnivalEntryBox=[6,338,101,99];
export const affectionY=carnival=>carnival?445:338;
export function navArtwork(top,height,inset){
  const body=height*navBodyEnd,trim=height-body;
  return {body,fillY:top+body,fillHeight:inset,trimY:top+body+inset,trim};
}
export function homeInsets(view){
  const unitY=1624/view.height,native=view.safeTop!==undefined;
  const floor=1624-(view.safeBottom||0)*unitY;
  const height=native?151*view.width/750*unitY:151;
  const nav=floor-height;
  return {native,top:(view.safeTop||0)*unitY,nav,height,floor,dock:native?nav-1473:0};
}
export function homeArtOffset(id,layout){
  if(['start','patrol','backpack','switch-pilot'].includes(id))return layout.dock;
  if(id==='background'||id==='shade')return 0;
  return layout.top;
}
export function navBounds(index,layout){
  const x=navEdges[index];
  return [x,layout.nav,navEdges[index+1]-x,layout.native?layout.height:1624-layout.nav];
}
