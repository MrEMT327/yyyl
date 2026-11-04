import {Container} from '../three/display.js';
import {upgradeOfferKey} from './upgrade-transition-motion.js';
// The outgoing card and incoming offer share a presentation clock; simulation
// commit remains owned by the native Interface.
export function createUpgradeSelectionLayer(parent){
  const mount=new Container({label:'upgrade-selection-handoff'});mount.zIndex=20001;mount.eventMode='none';parent.addChild(mount);
  let active=null,disposed=false;
  const release=card=>{if(active?.card===card)active=null;if(card.parent===mount&&!card.destroyed)card.destroy({children:true});};
  const cancel=()=>{const previous=active;active=null;previous?.cancel();};
  return {mount,get disposed(){return disposed;},
    claim(card,onCancel,presentation={}){
      if(disposed||card.destroyed)return null;const point=card.toGlobal();cancel();const local=mount.toLocal(point);
      mount.addChild(card);card.position.copyFrom(local);card.eventMode='none';card.interactiveChildren=false;
      active={card,cancel:onCancel,...presentation};return local;
    },
    getChoiceRevealAt(offer){return active&&offer?.runId===active.runId&&upgradeOfferKey(offer)!==active.offerKey?active.revealAt||0:0;},
    release,cancel,destroy(){if(disposed)return;disposed=true;cancel();mount.destroy({children:true});},
  };
}
