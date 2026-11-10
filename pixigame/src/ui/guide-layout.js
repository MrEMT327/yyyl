const clamp=(value,min,max)=>Math.max(min,Math.min(Math.max(min,max),value));

export function guidePanelWidth(rootWidth) {
  return Math.min(360,Math.max(0,rootWidth-24));
}

// Viewport coordinates: the guide lives outside the lobby's scrolling content.
export function guidePlacement({target,bounds,viewport,panel,pointerHeight=32,gap=8}) {
  const left=Math.max(8,bounds.left+8),right=Math.min(viewport.width-8,bounds.right-8);
  const top=Math.max(8,bounds.top+8),bottom=Math.min(viewport.height-8,bounds.bottom-8);
  const center=clamp(target.left+target.width/2,left+12,right-12);
  const above=Math.max(0,target.top-top),below=Math.max(0,bottom-target.bottom);
  const required=panel.height+pointerHeight+gap*2;
  const side=above>=required?'above':below>=required?'below':above>=below?'above':'below';
  const space=side==='above'?above:below;
  const maxHeight=Math.max(0,space-pointerHeight-gap*2);
  const height=Math.min(panel.height,maxHeight);
  const pointerTop=side==='above'?target.top-gap-pointerHeight:target.bottom+gap;
  const y=side==='above'?pointerTop-gap-height:pointerTop+pointerHeight+gap;
  return {side,x:clamp(center-panel.width/2,left,right-panel.width),y,
    pointerX:center,pointerY:pointerTop,maxHeight};
}
