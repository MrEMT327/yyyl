// Interior section borders are layout geometry; the outer popup, controls and
// item slots use their existing PSD nine-slice renderers.
export function paintDefeatSection(surface,rect,{cut=0,header=0,fill='#354d61'}={}) {
  const {x,y,width:w,height:h}=rect,border=3;
  const outline=[[x+cut,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y+cut],[x+cut,y]];
  surface.polygon(outline,'#0b1823');
  const inset=border,innerCut=Math.max(0,cut-inset);
  const points=[[x+inset+innerCut,y+inset],[x+w-inset,y+inset],[x+w-inset,y+h-inset],
    [x+inset,y+h-inset],[x+inset,y+inset+innerCut],[x+inset+innerCut,y+inset]];
  surface.polygon(points,fill);
  surface.line(points,'#718a9d',.65,1);
  if(header){
    surface.quad(x+inset,y+inset,w-2*inset,header-inset,'#132535');
    surface.quad(x+inset,y+header,w-2*inset,3,'#0b1823');
  }
}
