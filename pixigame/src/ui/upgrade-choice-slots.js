const frames = [
  {art:'card-red',x:26,y:479},
  {art:'card-blue',x:264,y:479},
  {art:'card-prismatic',x:502,y:475},
];

// Preserve the existing art sequence and dimensions; move the second card
// and its hit box to the right slot only for two-choice breakthroughs.
export function upgradeChoiceSlot(index,count) {
  const frame=frames[index];
  return {...frame,x:count===2&&index===1?frames[2].x:frame.x};
}
