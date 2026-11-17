import {choiceRevealPose,UPGRADE_TRANSITION} from './upgrade-transition-motion.js';
export const stealthOpacity=remaining=>remaining>0?.16+.84*(1-Math.min(1,remaining)):1;
export const barrierOpacity=remaining=>.2+.8*Math.max(0,Math.min(1,remaining));
export function revealChoiceCards(root,start=performance.now()){
  const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const cards=[],walk=n=>{if(n.__fixedCardId)cards.push(n);else n.children?.forEach(walk);};walk(root);
  const extras=[];
  const remember=node=>node.__choiceEntranceBase??={x:node.x,y:node.y,alpha:node.alpha,scaleX:node.scale.x,scaleY:node.scale.y};
  for(const [index,card]of cards.entries()){
    remember(card);const born=card.__choiceRevealAt||start,handoff=Boolean(card.__choiceRevealAt);
    card.__choiceReadyAt=!reduced&&handoff?born+UPGRADE_TRANSITION.revealDuration+index*UPGRADE_TRANSITION.revealStagger:0;
  }
  const parents=new Set(cards.filter(c=>c.__choiceRevealAt).map(c=>c.parent));
  for(const parent of parents){const siblings=cards.filter(c=>c.parent===parent),born=siblings[0].__choiceRevealAt;
    for(const node of parent.children)if(!node.__fixedCardId){extras.push({node,base:remember(node),born});if(node.__pixiUiAction)node.__choiceReadyAt=reduced?0:born+UPGRADE_TRANSITION.revealDuration+(siblings.length-1)*UPGRADE_TRANSITION.revealStagger;}
  }
  const frame=now=>{
    let running=false;
    cards.forEach((card,index)=>{
      if(card.destroyed||!card.parent||card.__entryCancelled)return;
      const base=remember(card),pose=choiceRevealPose(now-(card.__choiceRevealAt||start),index,Boolean(card.__choiceRevealAt),reduced);
      card.alpha=base.alpha*pose.alpha;card.scale.set(base.scaleX*pose.scale,base.scaleY*pose.scale);card.position.set(base.x,base.y+pose.offsetY);running||=!pose.done;
    });
    for(const {node,base,born}of extras){if(node.destroyed||!node.parent||node.__entryCancelled)continue;const pose=choiceRevealPose(now-born+20,0,true,reduced);node.alpha=base.alpha*pose.alpha;running||=!pose.done;}
    if(running)requestAnimationFrame(frame);
  };
  frame(performance.now());
}
