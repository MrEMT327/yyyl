export const PLAYER_DAMAGE_VIGNETTE_DEPTH: number;
export const PLAYER_DAMAGE_VIGNETTE_SECONDS: number;
interface GradientGraphics {
  fillGradientStyle(topLeft:number,topRight:number,bottomLeft:number,bottomRight:number,alphaTopLeft:number,alphaTopRight:number,alphaBottomLeft:number,alphaBottomRight:number):unknown;
  fillRect(x:number,y:number,width:number,height:number):unknown;
}
export function drawPlayerDamageVignette(graphics:GradientGraphics,age:number,width:number,height:number):number;
