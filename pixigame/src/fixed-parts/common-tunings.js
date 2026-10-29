// Keep node keys stable for run snapshots; specialize their actual effect per weapon.
export function commonTuning(mechanic,key){
  if(key==='power')return {label:'聚能',stat:'基础伤害',field:'damage',unit:'',bonus:'基础伤害 +18%',description:'增强本件武器每次命中的伤害'};
  if(key==='cadence')return mechanic==='drone'
    ? {label:'速射',stat:'无人机射击间隔',field:'droneInterval',unit:'秒',bonus:'射击间隔缩短 8%',description:'加快现存与新生无人机射击，不增加召唤数量'}
    : {label:'疾速',stat:['beam','freeze'].includes(mechanic)?'伤害间隔':'开火间隔',field:'interval',unit:'秒',bonus:'间隔缩短 8%',description:['beam','freeze'].includes(mechanic)?'让持续光束更频繁地造成伤害':'加快本件武器的攻击节奏'};
  const special={
    orb:{label:'滞留',stat:'球体范围',field:'width',unit:'倍',bonus:'基础球体范围 +15%、存续时间 +8%',description:'扩大接触范围并延长飞行时间，让能量球更容易抵达敌群并持续碾压'},
    drone:{label:'续航',stat:'无人机持续时间',field:'durationMultiplier',unit:'倍',bonus:'基础存活时间 +15%',description:'延长小无人机、裂殖无人机与母机的存活时间，不增加数量上限'},
    beam:{label:'速锁',stat:'锁定时间',field:'lockMultiplier',unit:'倍',bonus:'锁定速度 +15%',description:'缩短首次锁敌和切换目标的等待时间'},
    freeze:{label:'凝霜',stat:'冻结积累效率',field:'freezeMultiplier',unit:'倍',bonus:'基础冻结效率 +15%',description:'更快积累冻结，提高冰冻控制效率'},
    lightning:{label:'传导',stat:'连锁距离',field:'chainMultiplier',unit:'倍',bonus:'基础连锁距离 +15%',description:'让闪电连锁和分叉能击中更远的敌人'},
    lightmine:{label:'持久',stat:'光阵持续时间',field:'durationMultiplier',unit:'倍',bonus:'基础光阵持续时间 +15%',description:'延长四向光阵驻留时间，不增加投射距离'},
  };
  const explosion=['rocket','grenade','mine','pyro'].includes(mechanic);
  const projectile=['cannon','rail','scatter','sidegun','tail'].includes(mechanic);
  return special[mechanic]||{label:'扩域',stat:explosion?'爆炸范围':projectile?'子弹宽度':'攻击范围',field:'width',unit:'倍',bonus:projectile?'基础子弹宽度 +15%':explosion?'基础爆炸范围 +15%':'基础攻击范围 +15%',description:projectile?'子弹变宽，更容易命中敌人':explosion?'扩大爆炸范围，波及更远的敌人':'扩大武器的攻击范围'};
}
