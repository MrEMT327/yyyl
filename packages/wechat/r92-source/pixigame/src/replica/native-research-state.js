import source from './native-research-source.json' with {type:'json'};
const cards=new Map(source.cards.map(row=>[String(row.ID),row]));
/** Separate from legacy cloud levels: no implicit conversion or free cores. */
export function nativeResearchState(value) {
  if(value===undefined)return {version:1,levels:{}};
  if(!value||value.version!==1||!value.levels||typeof value.levels!=='object'||Array.isArray(value.levels))throw Error('原版科技记录无效');
  const levels={};
  for(const [id,level]of Object.entries(value.levels)){
    const row=cards.get(id);
    if(!row||!Number.isSafeInteger(level)||level<0||level>row.maxLv)throw Error('原版科技等级无效');
    if(level)levels[id]=level;
  }
  return {version:1,levels};
}
export function nativeResearchContributions(value) {
  const state=nativeResearchState(value);
  return Object.entries(state.levels).map(([id,level])=>{
    const row=source.levels.find(row=>row.CardID===Number(id)&&row.CardLevel===level);
    if(!row)throw Error('原版科技属性配置缺失');
    return {name:`${cards.get(id).name}科技 · Lv.${level}`,attributes:row.Attribute,feature:row.FeatureJson};
  });
}
