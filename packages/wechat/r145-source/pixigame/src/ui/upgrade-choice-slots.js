const frames = [
  {art:'card-red',x:26,y:479},
  {art:'card-blue',x:264,y:479},
  {art:'card-prismatic',x:502,y:479},
];

// The native two-choice gap is 140.91 / 393 of its card width (~36%).
// Keep card dimensions, one/three-choice layouts and hit boxes aligned.
export function upgradeChoiceSlot(index,count) {
  const frame=frames[index],gap=count===2?80:14;
  return {...frame,x:count<3?(750-count*224-(count-1)*gap)/2+index*(224+gap):frame.x};
}
