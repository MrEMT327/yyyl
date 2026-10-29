import design from './common-weapon-design.json' with { type: 'json' };
import { commonWeaponVisual } from './common-weapon-visuals.js';
import { weaponLevelGrowth } from './weapon-progression-config.js';

export const WEAPON_QUALITIES = Object.freeze(['普通','优秀','稀有','史诗','传说','神话']);
export const QUALITY_COLORS = Object.freeze([0xe9f5ff,0x79ef9d,0x65b9ff,0xbc79ff,0xffd46a,0xff668e]);
// Flight-game baseline values. The workbook's original-game numbers are
// references only; all specified percentages/timers below remain exact.
const bases = [
  ['cannon','twin',4,.1,1100,1.3,3], ['rail','rail',70,2.5,1600,1.7,5],
  ['rocket','missile',65,1.7,510,3,7], ['laser','prism',38,1,0,.12,7],
  ['scatter','tesla',5,.9,1000,.65,3], ['sidegun','gatling',4,.12,1400,.65,3],
  ['grenade','siege',85,2.5,400,1.5,9], ['mine','siege',60,2,0,5,12],
  ['beam','prism',4,.1,0,.12,6], ['lightning','tesla',9,.28,0,.2,3],
  ['freeze','prism',1.5,.1,0,.12,5], ['orb','plasma',16,3.5,120,7,42],
  ['toxin','plasma',5,.5,0,3.75,59.375], ['blades','blade',32,.6,0,.3,110],
  ['gravity','siege',90,3,0,.35,170], ['lightmine','prism',4,3,380,1.5,6],
  ['pyro','plasma',5,4.5,180,6,30], ['shield','blade',32,3.2,340,4,30],
  ['tail','gatling',6,1.2,1050,.7,3], ['drone','drone',8,2.5,300,10,12],
];
export const COMMON_WEAPONS = Object.freeze(Object.fromEntries(design.weapons.map((d,i)=>{
  const [mechanic,modelId,damage,interval,speed,life,radius]=bases[i];
  return [d.id,Object.freeze({...d,common:true,mechanic,pattern:'common',modelId,damage,interval,speed,life,radius,
    color:commonWeaponVisual(d.id).color,stages:WEAPON_QUALITIES,changes:[d.good,d.rare,d.epic,d.legendary,d.mythic],
    qualityRules:[d.normal,d.good,d.rare,d.epic,d.legendary,d.mythic],
    qualityVisuals:commonWeaponVisual(d.id).qualities.map(q=>q.visual),visual:commonWeaponVisual(d.id),
    ...Object.fromEntries(['normal','good','rare','epic','legendary','mythic'].map((key,rank)=>[`${key}Visual`,commonWeaponVisual(d.id).qualities[rank].visual])),signature:d.role})];
})));
export function commonWeaponStats(weapon,nodes=[]){
  const a=COMMON_WEAPONS[weapon.itemId];
  const qualityRank=Math.max(0,Math.min(5,Number(weapon.qualityRank)||0));
  const evolution=['evolve-1','evolve-2','evolve-3'].filter(key=>nodes.some(n=>n.endsWith(`-${key}`))).length;
  // Collection quality is a modest permanent scalar. The old quality-gated
  // combat mechanics now unlock only through this sortie's evolution cards.
  const rank=[0,3,4,5][evolution];
  const evolutionDamage=evolution ? (['rail','gravity'].includes(a.mechanic)?1.15:1.12) : 1;
  const count=k=>nodes.filter(n=>n.endsWith(`-${k}`)).length;
  const power=count('power')+Math.max(0,count('cadence')-13)+Math.max(0,count('coverage')-10);
  const coverage=1+.15*Math.min(10,count('coverage')),cadence=Math.max(.35,.92**count('cadence'));
  const specialized=['drone','beam','freeze','lightning','lightmine'].includes(a.mechanic);
  const durationMultiplier=['drone','lightmine'].includes(a.mechanic)?coverage:a.mechanic==='orb'?1+.08*Math.min(10,count('coverage')):1;
  return {...a,rank,qualityRank,count:a.mechanic==='scatter'?10+(rank>=2?2:0):a.mechanic==='tail'?10+(rank>=2?3:0):1,
    damage:a.damage*(1+.025*qualityRank)*weaponLevelGrowth(weapon.level)*evolutionDamage*(1+.18*power),
    interval:a.interval*(a.mechanic==='drone'?1:cadence),width:specialized?1:coverage,
    durationMultiplier,life:a.life*durationMultiplier,droneInterval:.55*cadence,
    lockMultiplier:a.mechanic==='beam'?1/coverage:1,
    freezeMultiplier:a.mechanic==='freeze'?coverage:1,chainMultiplier:a.mechanic==='lightning'?coverage:1,
    color:a.visual.color,highlight:a.visual.highlightColor,shadow:a.visual.shadowColor};
}
