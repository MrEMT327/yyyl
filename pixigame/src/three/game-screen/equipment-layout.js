const designWidth=369.453,head=46.2,deckEnd=443.3,toolbarEnd=496;
const center=designWidth/2;

export function equipmentLayout(w,navY,adaptive=false){
  const u=w/designWidth,top=head*u,originalEnd=deckEnd*u,toolbarH=Math.max(adaptive?44:0,(toolbarEnd-deckEnd)*u);
  const side=w*.163,gap=w*.016,pad=7*u,end=navY-4*u,span=originalEnd-top;
  const rowsHeight=n=>n>0?2*pad+n*side+(n-1)*gap:0;
  let bottom=originalEnd;
  if(adaptive){
    // Preserve the five-column grid and footer. Trade hangar height for
    // three complete rows when the native screen has room for them.
    const available=Math.max(0,end-top-toolbarH);
    const minDeck=Math.min(span*.63,Math.max(span*.44,available-rowsHeight(2)));
    bottom=top+Math.min(span,Math.max(minDeck,available-rowsHeight(3)));
  }
  const compacted=bottom<originalEnd-1e-6,scale=compacted?u*(bottom-top)/span:u;
  const x=(v,anchor=center)=>compacted?anchor*u+(v-anchor)*scale:v*u,y=v=>compacted?top+(v-head)*scale:v*u;
  const rect=(left,upper,width,height,anchor)=>({x:x(left,anchor),y:y(upper),w:width*scale,h:height*scale});
  const warehouseTop=adaptive?bottom+toolbarH:toolbarEnd*u;
  return {adaptive,u,scale,top,bottom,originalEnd,toolbarH,side,gap,pad,rowsHeight,compacted,
    x,y,rect,preview:rect(18.5,138.5,339.9,236.4),
    warehouse:{x:0,y:warehouseTop,w,h:Math.max(0,end-warehouseTop)}};
}
