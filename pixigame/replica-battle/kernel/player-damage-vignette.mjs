// Screen-space feedback after world bloom and before the native HUD (depth 50).
// One refreshed overlay uses the existing real-damage timer; hits never stack.
export const PLAYER_DAMAGE_VIGNETTE_DEPTH=49.95;
export const PLAYER_DAMAGE_VIGNETTE_SECONDS=.2;

export function drawPlayerDamageVignette(graphics,age,width,height){
  if(!Number.isFinite(age)||age<0||age>=PLAYER_DAMAGE_VIGNETTE_SECONDS||!(width>0&&height>0))return 0;
  // A short bright onset and a smooth fade leave the centre fully transparent.
  const t=Math.max(0,Math.min(1,(age-.02)/.18));
  const alpha=.32*(1-t*t*(3-2*t)),red=0xff2838;
  const side=width*.18,cap=height*.14;
  graphics.fillGradientStyle(red,red,red,red,alpha,0,alpha,0);
  graphics.fillRect(0,0,side,height);
  graphics.fillGradientStyle(red,red,red,red,0,alpha,0,alpha);
  graphics.fillRect(width-side,0,side,height);
  graphics.fillGradientStyle(red,red,red,red,alpha,alpha,0,0);
  graphics.fillRect(0,0,width,cap);
  graphics.fillGradientStyle(red,red,red,red,0,0,alpha,alpha);
  graphics.fillRect(0,height-cap,width,cap);
  return alpha;
}
