import { ARSENAL } from '../fixed-parts/airframe-arsenal.js';
import { Shape } from 'three';

// Project-authored pictograms: regular silhouettes, shared weight and padding.
// External icon paths are not used. The label, not a badge, identifies upgrades.
export function drawUpgradeWeaponIcon(ui,itemId,x,y,size) {
  const a=ARSENAL[itemId]||{};
  const aliases={twin:'cannon',cross:'cannon',helix:'cannon',missile:'rocket',
    prism:'beam',tesla:'lightning',gatling:'sidegun',siege:'grenade',
    plasma:'orb',blade:'blades',orbit:'shield',swarm:'drone',chain:'lightning',
    pulse:'laser',ring:'orb',slug:'rail'};
  const kind=a.mechanic||aliases[itemId]||aliases[a.pattern]||a.pattern;
  const p=ps=>ps.map(([u,v])=>[x+u*size,y+v*size]);
  const fill=ps=>ui.polygon(p(ps),'#edf3f7');
  const cut=ps=>ui.polygon(p(ps),'#0a1724');
  const curve=commands=>{
    const s=new Shape();
    for(const [op,...v] of commands)s[op](...v);
    fill(s.getPoints(18).map(v=>[v.x,v.y]));
  };
  const line=ps=>ui.line(p(ps),'#edf3f7',1,size*.07);
  const rect=(u,v,w,h)=>fill([[u,v],[u+w,v],[u+w,v+h],[u,v+h]]);
  const ring=(u,v,r)=>line(Array.from({length:33},(_,i)=>[u+Math.cos(i*Math.PI/16)*r,v+Math.sin(i*Math.PI/16)*r]));
  const pellet=(u,v)=>fill([[u,v],[u+.07,v+.1],[u+.07,v+.29],[u-.07,v+.29],[u-.07,v+.1]]);
  switch(kind) {
    case 'cannon':
      // Oblique autocannon: broad receiver, long barrel jacket, short mount.
      fill([[.13,.6],[.31,.39],[.41,.45],[.72,.11],[.85,.23],[.54,.58],
        [.61,.66],[.39,.88],[.27,.78],[.16,.87],[.08,.79],[.22,.66]]);
      cut([[.42,.51],[.71,.19],[.75,.23],[.46,.55]]);
      cut([[.49,.57],[.78,.25],[.81,.29],[.53,.61]]);
      cut([[.19,.61],[.31,.49],[.36,.54],[.24,.66]]);
      cut([[.3,.7],[.42,.58],[.47,.63],[.35,.75]]);break;
    case 'rail':
      rect(.23,.18,.12,.65);rect(.65,.18,.12,.65);
      fill([[.5,.08],[.59,.3],[.54,.3],[.54,.71],[.46,.71],[.46,.3],[.41,.3]]);break;
    case 'rocket':
      fill([[.5,.07],[.66,.29],[.66,.65],[.34,.65],[.34,.29]]);
      fill([[.3,.47],[.15,.76],[.3,.71]]);fill([[.7,.47],[.85,.76],[.7,.71]]);
      fill([[.41,.73],[.59,.73],[.5,.94]]);break;
    case 'laser':
      fill([[.14,.64],[.28,.5],[.49,.71],[.35,.85]]);
      line([[.43,.55],[.8,.18]]);line([[.53,.65],[.9,.28]]);break;
    case 'scatter':
      pellet(.22,.15);pellet(.5,.07);pellet(.78,.15);
      line([[.29,.61],[.5,.86],[.71,.61]]);break;
    case 'sidegun':
      rect(.4,.28,.2,.52);rect(.13,.37,.21,.12);rect(.66,.37,.21,.12);
      fill([[.04,.43],[.14,.32],[.14,.54]]);fill([[.96,.43],[.86,.32],[.86,.54]]);break;
    case 'grenade':
      curve([['moveTo',.35,.33],['lineTo',.65,.33],['bezierCurveTo',.86,.49,.79,.87,.5,.9],
        ['bezierCurveTo',.21,.87,.14,.49,.35,.33]]);
      rect(.39,.15,.22,.12);line([[.59,.18],[.75,.23],[.83,.49]]);
      cut([[.46,.42],[.54,.42],[.54,.8],[.46,.8]]);break;
    case 'mine':
      ring(.5,.5,.25);rect(.45,.4,.1,.2);
      for(let i=0;i<6;i++){const t=i*Math.PI/3;line([[.5+.32*Math.cos(t),.5+.32*Math.sin(t)],[.5+.43*Math.cos(t),.5+.43*Math.sin(t)]]);}break;
    case 'beam':
      rect(.26,.7,.48,.14);rect(.32,.13,.09,.47);rect(.59,.13,.09,.47);rect(.465,.06,.07,.54);break;
    case 'lightning':
      fill([[.59,.06],[.2,.54],[.46,.54],[.39,.94],[.81,.39],[.55,.39]]);break;
    case 'freeze':
      for(let i=0;i<3;i++){const t=i*Math.PI/3;line([[.5-.38*Math.cos(t),.5-.38*Math.sin(t)],[.5+.38*Math.cos(t),.5+.38*Math.sin(t)]]);}
      ring(.5,.5,.2);break;
    case 'orb':ring(.5,.5,.31);fill([[.5,.29],[.69,.5],[.5,.71],[.31,.5]]);break;
    case 'toxin':
      curve([['moveTo',.5,.08],['bezierCurveTo',.52,.31,.84,.49,.8,.68],
        ['bezierCurveTo',.74,.97,.26,.97,.2,.68],['bezierCurveTo',.16,.49,.48,.31,.5,.08]]);
      cut([[.34,.59],[.45,.63],[.41,.72],[.31,.68]]);
      cut([[.66,.59],[.55,.63],[.59,.72],[.69,.68]]);
      break;
    case 'blades':
      // Curved paired sabres with separate guards and deliberate negative space.
      for(const mirrored of [false,true]) {
        const s=new Shape();s.moveTo(.15,.12);
        s.bezierCurveTo(.3,.26,.49,.44,.69,.7);
        s.lineTo(.6,.77);s.bezierCurveTo(.34,.56,.17,.35,.15,.12);
        const transform=ps=>ps.map(([u,v])=>[mirrored?1-u:u,v]);
        const blade=transform(s.getPoints(18).map(v=>[v.x,v.y]));
        if(mirrored)ui.line(p([blade[0],...blade]),'#0a1724',1,size*.1);
        fill(blade);
        fill(transform([[.54,.75],[.72,.6],[.77,.66],[.59,.81]]));
        fill(transform([[.65,.78],[.72,.72],[.85,.87],[.78,.93]]));
      }break;
    case 'gravity':
      ring(.5,.5,.12);
      for(let i=0;i<3;i++){const t=i*2*Math.PI/3;line(Array.from({length:15},(_,j)=>{
        const v=t+j/14*1.55,r=.4-j/14*.18;return [.5+Math.cos(v)*r,.5+Math.sin(v)*r];}));}break;
    case 'lightmine':
      fill([[.5,.22],[.68,.5],[.5,.78],[.32,.5]]);
      line([[.1,.5],[.22,.5]]);line([[.78,.5],[.9,.5]]);line([[.5,.04],[.5,.15]]);break;
    case 'pyro':
      fill([[.52,.07],[.59,.39],[.73,.28],[.83,.61],[.73,.83],[.5,.91],[.26,.82],[.17,.63],[.31,.35],[.35,.58]]);
      break;
    case 'shield':
      line([[.5,.09],[.82,.23],[.76,.65],[.5,.89],[.24,.65],[.18,.23],[.5,.09]]);
      rect(.44,.31,.12,.34);break;
    case 'tail':
      rect(.27,.14,.46,.15);
      for(const u of [.26,.5,.74])fill([[u-.055,.4],[u+.055,.4],[u+.055,.67],[u+.12,.67],[u,.86],[u-.12,.67],[u-.055,.67]]);
      break;
    case 'drone':
      fill([[.5,.24],[.68,.5],[.5,.76],[.32,.5]]);
      for(const u of [.17,.83]){ring(u,.5,.11);line([[u,.29],[u,.71]]);}
      break;
    default:
      fill([[.5,.1],[.62,.4],[.85,.7],[.58,.62],[.5,.87],[.42,.62],[.15,.7],[.38,.4]]);
  }
}
