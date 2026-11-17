const palettes=['yellow','red','multicolor'];
const positive=(value,fallback)=>Number.isSafeInteger(Number(value))&&Number(value)>0?Number(value):fallback;

// SkillStar is the offered next level, not collection rarity. Native weapon
// levels form three groups: 1..3 yellow, 4..6 red, 7..9 multicolor.
export function battleChoiceProgress(card,family){
  const instant=Number(card.raw?.SkillType)===99,star=positive(card.star,1),weapon=Boolean(family);
  const tier=weapon?Math.min(2,Math.floor((star-1)/3)):0,palette=palettes[tier];
  const pending=weapon?(star-1)%3:star-1;
  const count=instant?0:weapon?3:Math.max(star,positive(card.raw?.MaxStar,2));
  return {palette,frameArt:palette==='multicolor'?'card-prismatic':'card-red',tier,star,weapon,
    pips:Array.from({length:count},(_,i)=>({state:i<pending?'acquired':i===pending?'pending':'empty',large:weapon&&i===2})),
  };
}

const shades={
  yellow:['#ffd24c','#fff1a6','#bb8526'],red:['#ee675a','#ffb49a','#a32e35'],
  multicolor:['#a6bdf9','#f0bcff','#6862bb'],
  pending:['#f4f7fa','#ffffff','#b8c6d0'],empty:['#59636d','#8d979e','#343e48'],
};

/** Faceted diamonds use the current UI's restrained metal edging. No icon
 * atlas, collection-quality stars or external media are needed. */
export function drawBattleChoicePips(surface,progress,width){
  const count=progress.pips.length;if(!count)return;
  const gap=10,unit=16,total=count*unit+(count-1)*gap+2;
  const scale=Math.min(1,(width-28)/total);
  progress.pips.forEach((pip,i)=>{
    const size=(pip.large?18:16)*scale,r=size/2,x=(i-(count-1)/2)*(unit+gap)*scale;
    const [fill,light,shade]=shades[pip.state==='acquired'?progress.palette:pip.state];
    const diamond=[[x,-r],[x+r,0],[x,r],[x-r,0]];
    surface.polygon([[x,-r-2],[x+r+2,0],[x,r+2],[x-r-2,0]],'#091017');
    surface.polygon(diamond,fill);
    surface.polygon([[x,-r],[x+r,0],[x,1],[x-r,0]],light);
    surface.polygon([[x-r,0],[x,1],[x,r]],shade);
    surface.line([...diamond,diamond[0]],'#a4afba',.40,1);
  });
}
