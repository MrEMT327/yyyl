// Same left title slots as 弹窗.psd; coordinates follow the frame's corner scale.
const titles={
  primary:{width:567,cornerHeight:165,left:58,top:39,right:100,size:40,color:'#fff'},
  secondary:{width:487,cornerHeight:86,left:38,top:39,right:116,size:32,color:'#1c334c'},
};
export function psdPopupTitleLayout(kind,x,y,width,height){
  const title=titles[kind]||titles.primary;
  const scale=Math.min(width/title.width,height/title.cornerHeight);
  return {x:x+title.left*scale,y:y+(title.top+title.size/2)*scale,
    size:title.size*scale,maxWidth:Math.max(0,width-(title.left+title.right)*scale),color:title.color};
}
export function paintPsdPopupTitle(surface,kind,title,x,y,width,height){
  const {x:tx,y:ty,...style}=psdPopupTitleLayout(kind,x,y,width,height);
  return surface.text(title,tx,ty,{...style,align:'left',weight:400,
    family:'PsdPopup,"Microsoft YaHei",sans-serif'});
}
