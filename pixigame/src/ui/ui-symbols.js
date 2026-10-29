import { resourceIconType } from './resource-icons.js';
// Shared, resolution-independent pictograms. Control labels stay descriptive;
// only the painted label is replaced, so hit regions and input do not change.
export function drawUiSymbol(ui, key, x, y, size = 24, color = '#d3e5ef') {
  if(resourceIconType(key) && ui.resourceIcon) return ui.resourceIcon(key,x,y,size);
  const p = points => points.map(([a,b]) => [x+a*size,y+b*size]);
  const line = points => ui.line(p(points),color,1,Math.max(1.6,size*.075));
  const poly = points => ui.polygon(p(points),color);
  const ring = (cx=.5,cy=.5,r=.34) => line(Array.from({length:25},(_,i)=>[cx+Math.cos(i/24*Math.PI*2)*r,cy+Math.sin(i/24*Math.PI*2)*r]));
  switch(key) {
    case 'stats': poly([[.13,.9],[.13,.5],[.29,.5],[.29,.9]]);poly([[.42,.9],[.42,.12],[.58,.12],[.58,.9]]);poly([[.71,.9],[.71,.33],[.87,.33],[.87,.9]]);break;
    case 'home': line([[.08,.45],[.5,.09],[.92,.45]]);line([[.2,.39],[.2,.88],[.4,.88],[.4,.62],[.6,.62],[.6,.88],[.8,.88],[.8,.39]]);break;
    case 'settings': line(Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*2,r=i%4<2?.43:.33;return [.5+Math.cos(a)*r,.5+Math.sin(a)*r];}));ring(.5,.5,.14);break;
    case 'check': line([[.16,.51],[.4,.75],[.85,.22]]); break;
    case 'close': line([[.23,.23],[.77,.77]]);line([[.77,.23],[.23,.77]]);break;
    case 'lock': line([[.3,.42],[.3,.25],[.4,.13],[.6,.13],[.7,.25],[.7,.42]]);line([[.2,.42],[.8,.42],[.8,.9],[.2,.9],[.2,.42]]);line([[.5,.58],[.5,.73]]);break;
    case 'heart': poly([[.5,.9],[.1,.49],[.1,.25],[.25,.15],[.4,.15],[.5,.29],[.6,.15],[.75,.15],[.9,.25],[.9,.49]]);break;
    case 'coin': ring(.5,.5,.41);ring(.5,.5,.28);line([[.5,.28],[.5,.72]]);break;
    case 'shield': line([[.5,.08],[.86,.22],[.8,.65],[.5,.92],[.2,.65],[.14,.22],[.5,.08]]);break;
    case 'power': poly([[.55,.03],[.16,.57],[.45,.57],[.38,.97],[.86,.37],[.55,.37]]);break;
    case 'speed': line([[.17,.2],[.5,.5],[.17,.8]]);line([[.5,.2],[.83,.5],[.5,.8]]);break;
    case 'cadence': line([[.18,.8],[.18,.42],[.28,.25],[.38,.42],[.38,.8]]);line([[.6,.6],[.6,.22],[.7,.05],[.8,.22],[.8,.6]]);break;
    case 'coverage': line([[.1,.34],[.1,.1],[.34,.1]]);line([[.66,.1],[.9,.1],[.9,.34]]);line([[.9,.66],[.9,.9],[.66,.9]]);line([[.34,.9],[.1,.9],[.1,.66]]);ring(.5,.5,.12);break;
    case 'target': case 'crit': ring();line([[.5,.03],[.5,.28]]);line([[.5,.72],[.5,.97]]);line([[.03,.5],[.28,.5]]);line([[.72,.5],[.97,.5]]);ring(.5,.5,.1);break;
    case 'xp': poly([[.5,.05],[.86,.28],[.86,.72],[.5,.95],[.14,.72],[.14,.28]]);break;
    case 'rotate': case 'refresh': line(Array.from({length:20},(_,i)=>{const a=-.25+i/19*Math.PI*1.6;return [.5+Math.cos(a)*.33,.5+Math.sin(a)*.33];}));poly([[.86,.12],[.9,.48],[.59,.31]]);break;
    case 'top': line([[.14,.3],[.5,.08],[.86,.3],[.5,.52],[.14,.3]]);line([[.14,.51],[.5,.73],[.86,.51]]);line([[.14,.72],[.5,.94],[.86,.72]]);break;
    case 'plane': poly([[.5,.06],[.62,.44],[.91,.69],[.91,.8],[.59,.69],[.59,.84],[.7,.93],[.3,.93],[.41,.84],[.41,.69],[.09,.8],[.09,.69],[.38,.44]]);break;
    case 'link': line([[.45,.28],[.3,.13],[.12,.3],[.36,.56],[.52,.4]]);line([[.56,.7],[.72,.87],[.9,.7],[.66,.44],[.5,.6]]);line([[.35,.35],[.66,.66]]);break;
    case 'image': line([[.12,.13],[.88,.13],[.88,.87],[.12,.87],[.12,.13]]);line([[.15,.72],[.36,.45],[.52,.64],[.67,.47],[.87,.75]]);ring(.65,.31,.07);break;
    case 'video': line([[.08,.16],[.92,.16],[.92,.84],[.08,.84],[.08,.16]]);poly([[.39,.32],[.71,.5],[.39,.68]]);break;
    case 'info': ring(.5,.5,.42);line([[.5,.45],[.5,.74]]);ring(.5,.28,.025);break;
    case 'grid': for(let i=0;i<4;i++){const a=.12+(i%2)*.44,b=.12+Math.floor(i/2)*.44;line([[a,b],[a+.3,b],[a+.3,b+.3],[a,b+.3],[a,b]]);}break;
    case 'exit': line([[.46,.12],[.15,.12],[.15,.88],[.46,.88]]);line([[.38,.5],[.93,.5],[.72,.28]]);line([[.93,.5],[.72,.72]]);break;
    case 'pause': line([[.32,.16],[.32,.84]]);line([[.68,.16],[.68,.84]]);break;
    case 'up': line([[.18,.52],[.5,.2],[.82,.52]]);line([[.5,.2],[.5,.88]]);break;
    case 'arrow': line([[.13,.5],[.87,.5],[.61,.24]]);line([[.87,.5],[.61,.76]]);break;
    case 'star': poly(Array.from({length:10},(_,i)=>{const a=i*Math.PI/5-Math.PI/2,r=i%2?.2:.46;return [.5+Math.cos(a)*r,.5+Math.sin(a)*r];}));break;
    default: ring();
  }
}

export function drawRank(ui, rank, x, y, {color='#e2bb73',width=104,total=6}={}) {
  for(let i=0;i<total;i++)ui.panel(x+i*width/total,y,width/total-4,5,{fill:i<rank?color:'#718696',stroke:null,opacity:i<rank?1:.32,cut:0,radius:2});
}
