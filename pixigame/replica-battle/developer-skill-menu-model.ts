import type { Simulation } from './kernel/simulation';

export const developerSkillTabs={all:'全部',weapon:'武器',passive:'强化',pilot:'驾驶员',plane:'飞机'};
export const canOpenDeveloperSkills=(sim:Simulation)=>sim.developerSkillCatalog.length>0&&['playing','paused','upgrade'].includes(sim.phase)&&sim.player.hp>0;

export function developerSkillPage(sim:Simulation,tab:string,query:string,limit:number){
  const needle=query.trim();
  const matches=sim.developerSkillCatalog.filter(item=>(tab==='all'||item.category===tab)&&[item.name,item.label,item.description].join(' ').includes(needle));
  const counts=new Map<number,number>();
  for(const id of [...(sim.content.combat.studyLoadout?.battleSkillIds||[]),...sim.learned.map(item=>item.id)])counts.set(id,(counts.get(id)||0)+1);
  const rows=matches.slice(0,limit).map(item=>{
    const count=counts.get(item.id)||0,max=Math.max(1,Number(sim.content.combat.skillRows[item.id]?.MaxCount||1));
    const unavailable=Boolean(item.unavailable),owned=count>=max;
    return {id:item.id,name:item.name,label:item.label+(count?' · 已选 '+count+'/'+max:''),
      description:item.description+(unavailable?'（战斗行为待接入）':''),disabled:owned||unavailable,status:unavailable?'待接入':owned?'已选':'选择'};
  });
  return {rows,total:matches.length,more:matches.length>limit};
}
