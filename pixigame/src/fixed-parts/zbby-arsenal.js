// Original (non-Dunhuang skin) weapon signatures from zbby. Distances are in
// its 4600-unit reference viewport; conversion happens once in the runtime.
export const ZBBY_VIEW_HEIGHT = 4600;
const definitions = [
  ['gun','曳光速射枪','twin',0xffd180,.105,6.5,3000,1.5,13,{spread:12}],
  ['assault_rifle','三连突击炮','twin',0xffbd72,1.3,35,4500,.9,13,{burst:3,gap:.06,spread:2,damageRarity:.15,fixedCadence:true}],
  ['machine_gun','预热机枪','gatling',0xff8d67,.04,9,4500,.9,13,{spread:20,variance:300,damageRarity:.2,warmup:.9}],
  ['sniper','反弹狙击炮','rail',0xb0e4ff,2.5,140,6000,1.7,48,{bounces:1,restitution:0}],
  ['cannon','重型实心炮','siege',0xffda9f,1.5,95,2000,3,49.0102,{}],
  ['shotgun','扇面霰弹炮','twin',0xf4cc87,.9,8,3500,1.2,13,{pellets:10,fan:60,drag:.7,damageRarity:.25,fixedCadence:true}],
  ['shotgun_close','近距震荡炮','siege',0xff9a70,1.5,19,9000,.45,17.029387,{pellets:5,spread:25,drag:4.5,variance:400,bounces:2,damageRarity:.25,fixedCadence:true}],
  ['sidegun','双侧扫射炮','gatling',0x9df3da,.09,13,9000,.4,19.5,{side:true,spread:20,drag:4.5,variance:400}],
  ['grenade_launcher','高爆榴弹炮','siege',0xffbc65,2.5,250,6000,1.5,69.115845,{spread:15,drag:2.5,variance:1000,blast:450}],
  ['mine_launcher','浮游布雷器','drone',0xf6a898,2,180,100,5,101.17806,{spread:10}],
  ['orb_gun','滞留黏液球','plasma',0x9febae,3.5,40,200,4,413.01938,{spread:5,tick:.6,pierces:10000}],
  ['staurolobber','十字光雷','prism',0xb9adff,3,1,6000,1,69.115845,{spread:8,drag:3.5,variance:1000,crossLaser:true}],
  ['continuous_laser','持续切割激光','prism',0x7ef4df,.1,8,0,.12,22.5,{beam:true,range:10000}],
  ['freeze_ray','低温凝结射线','prism',0xa5e5ff,.1,2.5,0,.12,30,{beam:true,range:2080,freeze:true}],
  ['flamethrower','灼流喷射器','plasma',0xff865b,.03,1.5,2000,.5,20.025,{spread:15,pierces:10000,burn:true}],
  ['harpoon','贯穿锚枪','rail',0xbcd7e5,2,100,4000,1.7,48,{harpoon:true}],
  ['electric_harpoon','电弧锚枪','tesla',0xadefd4,1.5,60,4000,1.7,48,{harpoon:true,electric:true}],
  ['plasma_whip','等离子链鞭','tesla',0xeb9eff,.02,4,3000,.5,13,{spread:4,drag:.5,whip:true}],
  ['pyrocyst','焚星火球','plasma',0xffb34f,12,25,1400,6,375,{drag:.2,pyro:true,tick:.1,fixedCadence:true}],
  ['chromatophore_gland','虹膜聚焦炮','prism',0xc7b0ff,12,80,0,2,150,{beam:true,range:10000,channel:true,fixedCadence:true}],
];
export const ZBBY_ARSENAL = Object.fromEntries(definitions.map(([sourceId,name,modelId,color,interval,damage,speed,life,radius,rules])=>{
  const signature = {
    gun:'单发直射，曳光弹寿命 1.5 秒',assault_rifle:'三连点射，每发间隔 0.06 秒',machine_gun:'预热后高速连射，弹速带正态离散',sniper:'高速重弹，接触后消耗一次反弹',cannon:'低速重弹，单次接触伤害',
    shotgun:'10 枚弹丸均布 60° 扇面，逐渐减速',shotgun_close:'5 枚近距弹丸，强减速与两次反弹',sidegun:'向左右 ±78.26° 扫射',grenade_launcher:'触敌或引信到时爆炸，爆破半径随品质增加',mine_launcher:'低速漂移的接触雷，留场 5 秒',orb_gun:'慢速大球，每个目标每 0.6 秒受击',staurolobber:'1 秒后展开四向激光，持续 1.5 秒，每 0.1 秒结算',
    continuous_laser:'持续光束，每 0.1 秒结算，缓慢跟随瞄准',freeze_ray:'连续照射累积冻结，脱离射线后积累衰减',flamethrower:'穿透火流，首个命中叠加灼烧，灼烧每秒衰减一半',harpoon:'穿透并连接连续命中的两个目标，牵制持续 8 秒',electric_harpoon:'贯穿目标并连接，受击沿电链传导且不递归',plasma_whip:'相邻弹节连接牵引，断射 0.25 秒后断链',pyrocyst:'持续施加灼烧与少量接触伤害，到期爆破',chromatophore_gland:'预热后持续宽光束，品质提升伤害和持续时间',
  }[sourceId];
  return [`zb_${sourceId}`,{name,modelId,color,interval,damage,pattern:'zbby',sourceId,speed,life,radius,...rules,signature,
    stages:['标准','改良','精工','卓越','史诗','神话'],
    changes:Array.from({length:5},(_,i)=>`品质 ${i+1}：${signature}`)}];
}));

export function zbbyWeaponStats(a,rank){
  const damage=a.pyro?25+10*rank:a.channel?80+24*rank:a.damage*(1+(a.damageRarity??.4)*rank);
  const count=a.sourceId==='assault_rifle'?3+rank:a.sourceId==='shotgun'?10+3*rank:a.sourceId==='shotgun_close'?5+rank:a.side?2:1;
  return {count,damage,interval:a.interval*(a.fixedCadence||a.beam?1:Math.max(.1,1-.1*rank)),
    life:a.pyro?6+2*rank:a.channel?2+rank:a.life,
    radius:a.radius*(a.pyro?1+.2*rank:1),pierces:a.harpoon?1+rank:(a.pierces||0),
    range:(a.range||0)*(a.freeze?1+.5*rank:1),blast:(a.blast||0)*(1+rank/6)};
}

for(const a of Object.values(ZBBY_ARSENAL))a.changes=Array.from({length:5},(_,i)=>{
  const s=zbbyWeaponStats(a,i+1),r=i+1;
  const shape=a.burst?`${s.count} 连点射，发间隔 0.06 秒`:a.pellets?`${s.count} 枚弹丸`:
    a.harpoon?`穿透 ${s.pierces} 次后终止`:a.freeze?`射程 ${Math.round(s.range/2080*100)}%，冻结 ${(.2+.4*r).toFixed(1)} 秒`:
    a.channel?`持续 ${s.life} 秒`:a.pyro?`燃烧 ${s.life} 秒，终爆 ${400+200*r}`:
    a.blast?`爆破半径 ${Math.round(s.blast/450*100)}%`:a.side?'保留左右扫射':a.crossLaser?'保留四向持续光束':a.whip?'保留弹节牵引':a.tick?'保留每 0.6 秒重复命中':'保留原弹道';
  return `${shape}；伤害 ${Number(s.damage.toFixed(1))}，开火间隔 ${Number(s.interval.toFixed(3))} 秒`;
});
