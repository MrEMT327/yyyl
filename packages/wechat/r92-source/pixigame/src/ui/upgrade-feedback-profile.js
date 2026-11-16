export function upgradeFeedbackProfile(skill={}){
  const stage=Number(String(skill.key||'').match(/^evolve-([123])$/)?.[1]||0);
  const terminal=stage===3||Boolean(skill.terminal);
  return {stage,terminal,color:terminal?0xffb85c:stage?0xffdc2d:0x69d9ff,
    label:terminal?'终局解放':stage===2?'核心增幅':stage===1?'形态改装':'强化成功',
    duration:terminal?680:stage?480:280,lifetime:terminal?1500:stage?1100:700};
}
