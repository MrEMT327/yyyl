// Shared 600 × 1300 battle coordinates. Keep the repair illustration below
// the authored PSD title tab, with controls fully inside the bottom rim.
export const REVIVE_PANEL=Object.freeze({
  frame:Object.freeze({x:26,y:410,width:548,height:480}),
  close:Object.freeze({x:494,y:420,width:68,height:68}),
  diamond:Object.freeze({x:54,y:790,width:222,height:74}),
  free:Object.freeze({x:324,y:790,width:222,height:74}),
});
export function revivePanelState(bridge){
  const game=bridge.game,presentation=bridge.presentation||{};
  const pending=Boolean(game.reviveAdPending||game.reviveDiamondPending);
  const cost=Number(presentation.reviveDiamondCost??50);
  const countdown=Number(game.reviveCountdown);
  return {visible:game.state==='revive-prompt',pending,
    diamondEnabled:!pending&&presentation.canDiamondRevive!==false,
    freeEnabled:!pending&&presentation.canAdRevive!==false,
    cost:Number.isFinite(cost)?cost:50,
    countdown:Number.isFinite(countdown)?Math.max(0,Math.ceil(countdown)):5};
}
export function reviveTouchBounds(rect,canvasWidth=600){
  const minimum=44*600/Math.max(1,canvasWidth);
  const width=Math.max(rect.width,minimum),height=Math.max(rect.height,minimum);
  return {x:(rect.width-width)/2,y:(rect.height-height)/2,width,height};
}
