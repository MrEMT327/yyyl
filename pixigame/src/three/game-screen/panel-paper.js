import {area,box,pic,words,clamp,titleFont} from './menu-art.js';
import {paintPsdPopup,preparePsdPopupArt} from '../../ui/psd-popup-art.js';
import {slicedFrameGeometry} from '../../ui/nine-slice-geometry.js';

export function paintSecondaryPaper(t,w,h,width,height,title,{header=112*w/750,inkY,alpha=.55,motion,a=t.layer('secondary-paper').art}={}){
  const x=(w-width)/2,y=(h-height)/2;
  t.backdrop(a,alpha,undefined,motion);area(t,'outside','返回',t.frameRect,'close');area(t,'paper','',box(x,y,width,height),'none');
  if(!preparePsdPopupArt('secondary'))t.waitForArt();paintPsdPopup(a,'secondary',x,y,width,height,w/750);
  const font=clamp(32*w/750,16,22);words(a,title,x+38*w/750,y+(inkY??39*w/750+font*.575),font,{align:'left',color:'#1c334c',family:titleFont});
  const side=Math.max(44,85*w/750),close=box(x+width+16*w/750-side,y-21*w/750,side,side);
  closeButton(a,t,close,motion);return {x,y,top:y+header,a};
}

function closeButton(a,t,b,motion){
  const first=motion&&t.buttonFace?a.group.children.length:0;
  pic(a,t,'/art/psd-popup-v1/close.png',b,true);
  if(motion)t.buttonFace?.('close',b,a,first);
  area(t,'close','关闭',b,'close');
}

export function paintLobbyPaper(t,data,w,h,width,height,header,title,a=t.layer('paper').art){
  const u=w/369.453,x=(w-width)/2,y=(h-height)/2;
  t.backdrop(a,data.backdropAlpha??.6,undefined,data.popupMotion);
  area(t,'outside','返回',t.frameRect,'close');area(t,'paper','',box(x,y,width,height),'none');
  const paintImage=t.stagedArtwork?t.image:undefined;
  if(!paintImage&&!preparePsdPopupArt('primary'))t.waitForArt();
  paintPsdPopup(a,'primary',x,y,width,height,w/750,paintImage);
  if(data.paperFace){
    const face=pic(a,t,data.paperFace,box(x,y,width,height));
    face.geometry.dispose();face.geometry=slicedFrameGeometry(width,height,567,714,[110,44,55,255],w/750);
  }
  const cy=y+header*.55,size=clamp(19.7*u,16,26);
  for(const [dy,color] of [[2,'#55677e'],[0,'#fff']])
    words(a,title,x+28.5*u,cy+dy,size,{align:'left',family:titleFont,color,maxWidth:width-96*u});
  const side=Math.max(44,41*u),close=box(x+width+8*u-side,y+3*u,side,side);
  closeButton(a,t,close,data.popupMotion);
  return {x,y,a,top:y+header};
}
