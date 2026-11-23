// Fill the battle viewport while keeping the authored 600 x 1300 UI centred
// at its existing scale. Warning backdrops can then reach both renderer edges.
export function resizeCloudCombatViewport(stage,canvas,renderer,scene,displayPixelRatio) {
  const width=stage.clientWidth,height=stage.clientHeight;
  if(!resizeCombatViewport(width,height,renderer,scene,displayPixelRatio))return false;
  canvas.style.width='100%';canvas.style.height='100%';
  return true;
}

export function resizeCombatViewport(width,height,renderer,scene,displayPixelRatio,{top=0,bottom=0}={}){
  if(!(width>0&&height>0))return false;
  const scale=Math.min(width/600,Math.max(1,height-top-bottom)/1300);
  const screenWidth=width/scale,screenHeight=height/scale;
  // Native composition scales these logical coordinates back to CSS pixels.
  const resolution=displayPixelRatio===undefined?renderer.resolution:scale*displayPixelRatio;
  if(Math.abs(renderer.screen.width-screenWidth)>.001||Math.abs(renderer.screen.height-screenHeight)>.001||
      resolution!==renderer.resolution)
    renderer.resize(screenWidth,screenHeight,resolution);
  scene.position.set((screenWidth-600)/2,(screenHeight-1300+(top-bottom)/scale)/2);
  return true;
}
