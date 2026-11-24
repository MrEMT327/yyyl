export const battleWidth=540,battleHeight=960;
export const authoredBattleFrame=Object.freeze({left:0,top:0,width:battleWidth,height:battleHeight,scale:1});

// Reveal more terrain as needed. The authored playfield remains centred and
// uniformly scaled; a tall phone does not stretch aircraft or crop the map.
export function fullBattleFrame({width,height}){
  if(!(width>0&&height>0))return authoredBattleFrame;
  const scale=Math.min(width/battleWidth,height/battleHeight);
  const w=Math.round(width/scale),h=Math.round(height/scale);
  return {left:(battleWidth-w)/2,top:(battleHeight-h)/2,width:w,height:h,scale};
}
