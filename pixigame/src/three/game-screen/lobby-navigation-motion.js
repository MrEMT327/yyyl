import {navEdges,navTabs} from './home-navigation.js';

// Keep the last *presented* pose. A cold page may take longer to prepare than
// the entire animation, and another tap can arrive before its first frame.
export function createLobbyNavigationMotion(report){
  const weights=[0,0,1,0,0],from=weights.slice(),edges=navEdges.slice();
  const pose={weights,edges,dock:0,navMoving:false,dockMoving:false};
  let selected=2,showDock=false,fromDock=0,navStart=null,dockStart=null;
  let timing;
  function layout(){
    let x=0;
    for(let i=0;i<weights.length-1;i++){
      x+=140.5+47.5*weights[i];
      // The battle PSD has slightly asymmetric dividers.
      const battleEdge=(i+1)*140.5+(i>=2?47.5:0);
      edges[i+1]=x+(navEdges[i+1]-battleEdge)*weights[2];
    }
  }
  const ease=t=>t*t*(3-2*t);
  function finishNav(){
    for(let i=0;i<weights.length;i++)weights[i]=Number(i===selected);
    pose.navMoving=false;layout();
  }
  return {pose,resetTiming(){timing=null;},
    select(tab,home,animate=true,now){
      const index=navTabs.indexOf(tab);
      if(!animate)timing=null;
      else if(report&&Number.isFinite(now)&&(index>=0&&index!==selected||showDock!==home)){
        timing??={start:now,changes:0,frames:0,first:null,last:null,worst:0,over40:0};
        timing.changes++;
      }
      if(index>=0&&index!==selected){
        selected=index;
        for(let i=0;i<weights.length;i++)from[i]=weights[i];
        navStart=null;pose.navMoving=weights[index]<1;
      }
      if(showDock!==home){
        showDock=home;fromDock=pose.dock;
        dockStart=null;pose.dockMoving=fromDock!==Number(home);
      }
      if(!animate){finishNav();pose.dock=Number(showDock);pose.dockMoving=false;}
    },
    frame(now){
      if(pose.navMoving){
        navStart??=now;
        const t=Math.min(1,Math.max(0,(now-navStart)/200));
        if(t===1)finishNav();
        else{
          const k=ease(t);
          for(let i=0;i<weights.length;i++)weights[i]=from[i]+(Number(i===selected)-from[i])*k;
          layout();
        }
      }
      if(pose.dockMoving){
        dockStart??=now;
        const t=Math.min(1,Math.max(0,(now-dockStart)/(showDock?467:333)));
        pose.dock=fromDock+(Number(showDock)-fromDock)*ease(t);
        pose.dockMoving=t<1;
      }
      if(timing){
        if(timing.last!==null){
          const gap=now-timing.last;
          timing.worst=Math.max(timing.worst,gap);
          if(gap>=40)timing.over40++;
        }
        timing.first??=now;timing.last=now;timing.frames++;
        if(!pose.navMoving&&!pose.dockMoving){
          const firstPaintMs=Math.round(timing.first-timing.start);
          if(timing.over40||firstPaintMs>=40||timing.changes>1)report({tab:navTabs[selected],changes:timing.changes,
            frames:timing.frames,firstPaintMs,maxFrameGapMs:Math.round(timing.worst),framesOver40Ms:timing.over40});
          timing=null;
        }
      }
      return pose;
    },
  };
}
