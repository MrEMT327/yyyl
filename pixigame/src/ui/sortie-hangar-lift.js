import {HANGAR_RISE_SECONDS,hangarPose} from './sortie-hangar-motion.js';
const duration=HANGAR_RISE_SECONDS*1000;
// x(t)=t, y(t)=3t²-2t³: the same smoothstep as hangarPose, on the compositor.
const timing={duration,easing:'cubic-bezier(0.333333333333,0,0.666666666667,1)',fill:'forwards'};
export function createHangarLift(host,elevator){
  let animations=[],height=0,started=false,paused=false,reduced=false,current=0;
  const cancel=()=>{for(const animation of animations)animation.cancel();animations=[];};
  const apply=()=>{
    const distance=height*.325*hangarPose(current/1000,reduced).lift;
    for(const node of [host,elevator])node.style.transform=`translate3d(0,${-distance}px,0)`;
  };
  const rebuild=()=>{
    current=Number(animations[0]?.currentTime??current);cancel();
    if(!started||reduced||typeof host.animate!=='function'||typeof elevator.animate!=='function'){apply();return;}
    for(const node of [host,elevator]){
      const animation=node.animate([{transform:'translate3d(0,0,0)'},{transform:`translate3d(0,${-height*.325}px,0)`}],timing);
      animation.currentTime=Math.min(duration,current);
      if(paused||current>=duration)animation.pause();
      animations.push(animation);
    }
  };
  return {
    resize(nextHeight){if(nextHeight>0&&nextHeight!==height){height=nextHeight;rebuild();}},
    start(isReduced=false){started=true;paused=false;reduced=isReduced;current=0;rebuild();},
    pause(){paused=true;for(const a of animations)a.pause();},
    resume(){if(!started||!paused)return;paused=false;for(const a of animations)if(Number(a.currentTime)<duration)a.play();},
    reduce(value){reduced=value;rebuild();},
    // For older WebViews without Element.animate, retain the exact same pose.
    update(seconds){if(!animations.length){current=seconds*1000;apply();}},
    dispose(){cancel();host.style.removeProperty('transform');elevator.style.removeProperty('transform');},
  };
}
