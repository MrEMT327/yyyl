const frames = [
  {art:'card-red',x:26,y:479},
  {art:'card-blue',x:264,y:479},
  {art:'card-prismatic',x:502,y:479},
];

// Keep reduced offers centered with the same card width and 14px spacing.
// Visuals and hit boxes use the same positions.
export function upgradeChoiceSlot(index,count) {
  const frame=frames[index];
  return {...frame,x:count<3?(750-count*224-(count-1)*14)/2+index*238:frame.x};
}
