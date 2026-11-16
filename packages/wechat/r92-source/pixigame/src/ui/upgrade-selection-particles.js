import {Container,Graphics} from '../three/display.js';

// Brief points of light escape from behind the selected card. Geometry is
// created once per accepted selection; only positions and opacity change.
export function createUpgradeSelectionParticles(card,width,height,color){
  const parent=card.parent,layer=new Container({label:'upgrade-selection-particles'});
  layer.eventMode='none';layer.interactiveChildren=false;
  parent.addChildAt(layer,parent.getChildIndex(card));
  const seeds=[[0,.18],[1,.27],[2,.53],[0,.47],[1,.62],[3,.28],
    [2,.2],[0,.77],[1,.85],[3,.68],[2,.84],[3,.9]];
  const motes=seeds.map(([side,along],i)=>{
    const size=1.5+(i%4)*.25,node=new Graphics();node.eventMode='none';
    node.circle(0,0,size*2.8).fill({color,alpha:.09});
    node.circle(0,0,size*1.65).fill({color,alpha:.25});
    node.circle(0,0,size).fill({color:0xfffbec,alpha:.96});
    if(i%3===0){
      node.moveTo(-size*2,0).lineTo(size*2,0).moveTo(0,-size*2).lineTo(0,size*2).stroke({color:0xfffbec,width:.7,alpha:.65});
    }
    layer.addChild(node);
    const nx=side===0?-1:side===1?1:0,ny=side===2?-1:side===3?1:0;
    return {node,nx,ny,x:side<2?(side===0?2:width-2):width*along,
      y:side<2?height*along:(side===2?2:height-2),delay:32+(i%3)*14,
      life:250+(i%4)*12,distance:24+(i%5)*4,drift:(i%2?1:-1)*(3+i%4)};
  });
  return {
    update(elapsed){
      if(layer.destroyed||card.destroyed)return;
      layer.position.copyFrom(card.position);layer.scale.copyFrom(card.scale);layer.alpha=card.alpha;
      for(const p of motes){
        const t=(elapsed-p.delay)/p.life;p.node.visible=t>0&&t<1;
        if(!p.node.visible)continue;
        const travel=p.distance*(1-(1-t)*(1-t)),drift=p.drift*t;
        p.node.position.set(p.x+p.nx*travel-p.ny*drift,p.y+p.ny*travel+p.nx*drift-t*4);
        p.node.alpha=Math.sin(Math.PI*t)*(.85+(p.life-250)/240);
        p.node.scale.set(1-.55*t);
      }
    },
    destroy(){if(!layer.destroyed)layer.destroy({children:true});},
  };
}
