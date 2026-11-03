// Original vector marks shared by the actual canvas UI and its DOM controls.
// They draw immediately and do not wait for another icon texture to load.
const glyphs = {
  physical:{polygons:[[[.28,.82],[.28,.33],[.5,.1],[.72,.33],[.72,.82]]],lines:[[[.28,.64],[.72,.64]]]},
  fire:{polygons:[[[.53,.07],[.76,.36],[.85,.59],[.74,.83],[.5,.93],[.25,.8],[.15,.57],[.31,.29],[.34,.56],[.5,.42]]],lines:[]},
  acid:{polygons:[[[.5,.07],[.8,.53],[.79,.72],[.67,.88],[.46,.93],[.25,.8],[.18,.62],[.22,.48]]],lines:[]},
  ice:{polygons:[],lines:[[[.5,.06],[.5,.94]],[[.12,.28],[.88,.72]],[[.12,.72],[.88,.28]],[[.34,.15],[.5,.28],[.66,.15]],[[.34,.85],[.5,.72],[.66,.85]],[[.15,.45],[.3,.39],[.28,.22]],[[.72,.78],[.7,.61],[.85,.55]],[[.15,.55],[.3,.61],[.28,.78]],[[.72,.22],[.7,.39],[.85,.45]]]},
  energy:{polygons:[[[.16,.82],[.67,.18],[.87,.37],[.35,.89]]],lines:[[[.58,.08],[.92,.41]],[[.15,.52],[.33,.32]]]},
  electromagnetic:{polygons:[[[.58,.04],[.18,.57],[.46,.57],[.39,.96],[.84,.38],[.56,.38]]],lines:[]},
};
export const BATTLE_ELEMENT_BADGE_SIZE = Object.freeze({width:88,height:28});

export function drawBattleElementBadge(surface, element, x, y) {
  const glyph=glyphs[element?.key];if(!glyph)return null;
  const {width,height}=BATTLE_ELEMENT_BADGE_SIZE;
  surface.panel(x,y,width,height,{fill:'#10202c',stroke:element.color,opacity:.94,cut:4});
  const points=shape=>shape.map(([a,b])=>[x+5+a*19,y+4+b*19]);
  for(const shape of glyph.polygons)surface.polygon(points(shape),element.color);
  for(const shape of glyph.lines)surface.line(points(shape),element.color,1,1.65);
  surface.text(element.label,x+54,y+height/2,{size:17,weight:800,color:'#eff7fc',align:'center',maxWidth:44});
  return {x,y,width,height};
}

export function battleElementBadgeMarkup(element) {
  const glyph=glyphs[element?.key];if(!glyph)return '';
  const points=shape=>shape.map(([a,b])=>`${(a*24).toFixed(2)},${(b*24).toFixed(2)}`).join(' ');
  const paths=glyph.polygons.map(shape=>`<polygon points="${points(shape)}" fill="currentColor"/>`).join('')
    +glyph.lines.map(shape=>`<polyline points="${points(shape)}" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" stroke-linecap="round"/>`).join('');
  return `<span class="card-tag battle-element-badge" data-element="${element.key}" style="--element-color:${element.color}" aria-label="伤害属性：${element.label}"><svg viewBox="0 0 24 24" aria-hidden="true">${paths}</svg><span>${element.label}</span></span>`;
}
