export const navEdges=[0,139,279.5,467.5,608,750];
export const navBodyEnd=139/151,navFillStart=.79;
export const carnivalEntryBox=[6,338,101,99];
export const affectionY=carnival=>carnival?445:338;
export const profileFrame=[13.5,19.5,87.7,87.7];
export const profileHit=[0,27,221,100];
export const walletTop=46;
export function leftOfMenuCenterY(view,rightEdge){
  const menu=view?.menuButton;
  if(!menu||menu.left<(view.left||0)+rightEdge+8)return null;
  return (menu.top+menu.bottom)/2;
}
export function bottomNavigation(width,height,safeBottom=0,native=false){
  const rail=151*width/750;
  // Settle the artwork into the bottom padding, keeping at least 44 px of
  // each tab above the gesture area on supported screen widths.
  const offset=native?Math.min(safeBottom*.75,Math.max(0,rail-44)):0;
  return {top:height-safeBottom-rail+offset,height:rail,inset:safeBottom-offset,hitHeight:rail-offset};
}
export function navArtwork(top,height,inset){
  const body=height*navBodyEnd,trim=height-body;
  return {body,fillY:top+body,fillHeight:inset,trimY:top+body+inset,trim};
}
export function homeInsets(view){
  const unitY=1624/view.height,native=view.safeTop!==undefined;
  const safeBottom=view.safeBottom||0,floor=1624-safeBottom*unitY;
  const footer=native?bottomNavigation(view.width,view.height,safeBottom,true):null;
  const height=footer?footer.height*unitY:151,nav=footer?footer.top*unitY:floor-height;
  const inset=(footer?.inset??safeBottom)*unitY,top=(view.safeTop||0)*unitY;
  const profileRight=(profileHit[0]+profileHit[2])*view.width/750;
  const center=native?leftOfMenuCenterY(view,profileRight):null;
  const frameTop=center===null?null:Math.max((view.safeContentTop??view.menuButton.top)+2,center-profileFrame[3]/(2*unitY));
  const profile=frameTop===null?top:frameTop*unitY-profileFrame[1];
  const wallet=frameTop===null?top:top+6*unitY-walletTop;
  return {native,top,profile,wallet,nav,height,floor,inset,dock:native?nav-1473:0};
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
  return [x,layout.nav,navEdges[index+1]-x,(layout.native?layout.floor:1624)-layout.nav];
}
