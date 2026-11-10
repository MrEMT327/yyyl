// Display-only wording. Values and conditions come from runtime descriptions.
export function pilotSkillSummary(skill, text) {
  const id=Number(skill.id);
  if(id<10800000||id>=10900000)return text;
  if(id===10807011)text=text.replace(
    /^开局生成([\d.]+)枚蜂巢导弹；导弹数量减少后，间隔([\d.]+)秒补充一批$/,
    '开局$1枚；减少后每$2秒补一批');
  const subjects=[
    ['蜂巢导弹伤害','导弹伤害'],['棱镜激光伤害','激光伤害'],
    ['强力酸液弹伤害','强力酸弹伤害'],['小冰刃弹伤害','冰刃伤害'],
    ['次元斩伤害','次元斩伤害'],['飞锯盘伤害','锯盘伤害'],
    ['次级电弧伤害','电弧伤害'],['小型黑洞及黑洞粒子伤害','黑洞/粒子伤害'],
  ];
  for(const [from,to] of subjects)if(text.startsWith(from))text=to+text.slice(from.length);
  return text.replaceAll('->','→').replace(/\s*→\s*/g,'→')
    .replace(/(伤害|范围|间隔|数量)\s+(?=[\d.])/g,'$1')
    .replace(/([\d.])\s+(枚|颗|次)/g,'$1$2')
    .replaceAll('发射数量','数量');
}
