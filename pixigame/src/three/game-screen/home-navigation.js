export const navEdges=[0,139,279.5,467.5,608,750];
export const navBodyEnd=139/151,navFillStart=.79;
export const carnivalEntryBox=[6,338,101,99];
export const affectionY=carnival=>carnival?445:338;
export const profileFrame=[13.5,19.5,87.7,87.7];
export const profileHit=[0,27,221,100];
export const walletTop=46;
export function leftOfMenuTop(view,rightEdge,height){
  const menu=view?.menuButton;
  if(!menu||menu.left<(view.left||0)+rightEdge+8)return null;
  return Math.max((view.safeContentTop??menu.top)+2,(menu.top+menu.bottom-height)/2);
}
export function navArtwork(top,height,inset){
  const body=height*navBodyEnd,trim=height-body;
  return {body,fillY:top+body,fillHeight:inset,trimY:top+body+inset,trim};
}
export function homeInsets(view){
  const unitY=1624/view.height,native=view.safeTop!==undefined;
  const floor=1624-(view.safeBottom||0)*unitY;
  const height=native?151*view.width/750*unitY:151;
  const nav=floor-height,top=(view.safeTop||0)*unitY;
  const profileRight=(profileHit[0]+profileHit[2])*view.width/750;
  const frameTop=native?leftOfMenuTop(view,profileRight,profileFrame[3]/unitY):null;
  const profile=frameTop===null?top:frameTop*unitY-profileFrame[1];
  const wallet=frameTop===null?top:top+6*unitY-walletTop;
  return {native,top,profile,wallet,nav,height,floor,dock:native?nav-1473:0};
}
export function homeArtOffset(id,layout){
  if(['start','patrol','backpack','switch-pilot'].includes(id))return layout.dock;
  if(id==='background'||id==='shade')return 0;
  if(id==='profile')return layout.profile;
  if(/^(stamina|coins|diamonds)(-|$)/.test(id))return layout.wallet;
  return layout.top;
}
export function navBounds(index,layout){
  const x=navEdges[index];
  return [x,layout.nav,navEdges[index+1]-x,layout.native?layout.height:1624-layout.nav];
}
