import { ZBBY_ARSENAL } from './zbby-arsenal.js';
import { COMMON_WEAPONS } from './common-weapons.js';
// Combat identities are independent of the retained legacy connector catalog.
export const EXCLUSIVE_ARSENAL = Object.freeze({
  twin: { name:'剪翼双星', color:0x79e5ff, pattern:'cross', interval:.66, damage:16, stages:['双星点射','交叉双轨','四翼齐射','穿云剪刀','星芒织网','双星天幕'], changes:['双轨交叉，弹道穿透一敌','展开四条交错火线','弹道加宽，穿透两敌','六线编织，命中绽放星芒','八轨天幕，交叉点形成爆破'] },
  missile: { name:'青萤蜂群', color:0x92ffc4, pattern:'swarm', interval:1.1, damage:23, stages:['萤火追踪','双蜂出巢','四蜂巡猎','翡翠蜂雨','六蜂包抄','万萤归巢'], changes:['两枚导弹弧线追敌','四蜂扇形出巢','追踪弹命中炸出光环','六蜂包抄，爆破范围扩大','八蜂追猎，爆破形成翡翠花冠'] },
  plasma: { name:'熔心日珥', color:0xff9471, pattern:'nova', interval:1.25, damage:34, stages:['熔心弹','双重日珥','三曜熔核','恒星膨胀','日冕喷发','超新星'], changes:['熔核双发，命中爆破','三核展开，爆破半径增加','熔核穿敌，爆破增大','五核日冕覆盖前方','七核超新星，层叠爆破'] },
  rail: { name:'沧海脉环', color:0x6cdfff, pattern:'ring', interval:1.2, damage:22, stages:['潮汐脉冲','双环共振','三重潮汐','深蓝涟漪','潮汐涡轮','沧海之眼'], changes:['双环向外扩张','三重脉环穿过敌群','脉环加宽，覆盖更远','五重潮汐持续扩散','七环依次展开，铺满前方'] },
  blade: { name:'幽月回镰', color:0xc7abff, pattern:'blade', interval:1, damage:25, stages:['月牙双刃','三月回旋','四刃月轮','满月切割','六芒月阵','永夜月蚀'], changes:['三刃展开再回旋','四刃穿透切割','回旋刃加宽，轨道延长','六刃回旋，覆盖两翼','八刃月蚀，环绕切割'] },
  gatling: { name:'赤线螺旋', color:0xff678b, pattern:'helix', interval:.32, damage:9, stages:['赤线双螺旋','三股绞线','四重螺旋','灼红光带','六重绯流','赤色银河'], changes:['三股子弹盘旋前进','四重螺旋，弹速提高','加宽光带，穿透敌人','六股弹链编织前方','八股螺旋，形成连续银河'] },
  tesla: { name:'森罗雷枝', color:0xb4f77d, pattern:'chain', interval:.85, damage:26, stages:['雷枝初生','双向雷枝','三枝连锁','电光树冠','雷暴森林','世界树'], changes:['雷电连锁两个敌人','连锁三个敌人','跳跃距离提高，电弧加粗','最多五目标连锁','七目标雷网，照亮整片敌群'] },
  prism: { name:'万花棱镜', color:0xdfa4ff, pattern:'beam', interval:1.15, damage:30, stages:['棱镜光束','双面折射','三棱开花','晶虹长廊','五彩光扇','万花穹顶'], changes:['双束贯穿敌阵','三束光扇展开','光束加宽，射程增长','五束折射形成扇面','七束长虹贯穿前方'] },
  siege: { name:'天阙重锤', color:0xffd18c, pattern:'siege', interval:1.65, damage:58, stages:['重锤落点','双锤轰击','三连重击','震荡地平线','五锤阵列','天阙崩落'], changes:['双枚重炮定向发射','三炮齐射，命中震荡','重炮穿敌，冲击圈扩大','五炮落点覆盖前方','七炮齐鸣，金色冲击波连爆'] },
  drone: { name:'曜金星座', color:0xffe79b, pattern:'orbit', interval:1.1, damage:21, stages:['双星伴航','三星阵列','四星环轨','星轨巡航','六曜天宫','黄道十二宫'], changes:['三星随行，自动狙击近敌','四星环绕，同时开火','星轨半径加大，激光加宽','六星同时索敌','十二星巡弋，金色星轨齐射'] },
});
// Public sidearms have separate identities, attacks and growth. They never alias
// an aircraft's innate weapon, even when reusing a mechanical model silhouette.
export const LEGACY_PUBLIC_ARSENAL = Object.freeze({
  aux_cannon: { name:'速射机炮',modelId:'twin',color:0xffd487,pattern:'cannon',interval:.42,damage:11,counts:[1,2,3,3,5,7],stages:['标准点射','双发供弹','三联弹幕','穿甲弹链','五列齐射','金色火线'],changes:['每轮双发直射','三列弹幕覆盖前方','弹体加宽并穿透两敌','五列机炮齐射','七列穿甲火线'] },
  aux_rail: { name:'穿甲磁轨炮',modelId:'rail',color:0x8ed6ff,pattern:'slug',interval:1.45,damage:39,counts:[1,1,2,2,3,4],stages:['穿甲磁钉','加长磁轨','双轨并进','宽轨贯穿','三轨封锁','四轨轰鸣'],changes:['磁钉加宽，穿过四敌','双轨高速贯穿','宽轨加粗，穿透更多敌人','三列磁轨穿透敌阵','四列长钉贯穿前方'] },
  aux_rocket: { name:'集束火箭舱',modelId:'missile',color:0xffb37b,pattern:'rocket',interval:1.4,damage:30,counts:[1,2,3,3,5,7],stages:['直飞火箭','双管齐发','三联爆破','扩域装药','五连轰炸','集束弹幕'],changes:['双火箭直飞爆破','三联火箭扇形出舱','弹体与冲击圈加大','五枚火箭连续爆破','七联火箭与多层冲击环'] },
  aux_laser: { name:'脉冲激光炮',modelId:'prism',color:0x70f2da,pattern:'pulse',interval:1.2,damage:23,counts:[1,2,3,3,5,7],stages:['单线脉冲','双线并行','三线切割','宽束脉冲','五线光栅','七线光幕'],changes:['两道平行激光贯穿','三道光线形成切割带','光束加宽，扩大命中范围','五道平行光栅','七道翠色脉冲光幕'] },
  aux_scatter: { name:'电磁散射器',modelId:'tesla',color:0xa4afff,pattern:'scatter',interval:.72,damage:15,counts:[3,4,5,5,7,9],stages:['三叉电弹','四叉散射','五叉电幕','宽幅电流','七叉电网','九叉雷幕'],changes:['四发电弹扇形散射','五发电弹覆盖前方','电弹加宽并穿透两敌','七叉短程电网','九叉电幕覆盖近处敌群'] },
  ...ZBBY_ARSENAL,
});
export const PUBLIC_ARSENAL = COMMON_WEAPONS;
export const ARSENAL = Object.freeze({...EXCLUSIVE_ARSENAL,...LEGACY_PUBLIC_ARSENAL,...COMMON_WEAPONS});
const identities = [
  ['twin','回声机芯','每第三轮攻击，追加一轮半伤回声。','echo'],
  ['missile','猎隼导航','所有弹体自动追向最近敌人。','hunt'],
  ['plasma','熔核共振','每轮首次命中，追加一圈35%伤害爆破。','nova'],
  ['rail','潮汐增幅','所有攻击的宽度和爆破范围扩大30%。','tide'],
  ['blade','幽相穿行','所有弹体额外穿透两个敌人。','phase'],
  ['gatling','赤线超频','全武器开火间隔缩短20%。','rapid'],
  ['tesla','雷枝接力','每轮首次命中，向另一敌人跳电40%伤害。','chain'],
  ['prism','棱镜复制','每轮追加一条偏转光路，造成35%伤害。','prism'],
  ['siege','重锤共鸣','每第四轮攻击伤害提高80%，范围提高50%。','siege'],
  ['drone','星座伴航','每轮开火时，伴星向最近敌人补射25%伤害。','star'],
];
export const AIRFRAME_IDENTITIES = Object.freeze(Object.fromEntries(identities.map(([weapon,traitName,traitDescription,trait],i)=>[
  `pilot-${String(i+1).padStart(2,'0')}`,Object.freeze({weapon:'aux_cannon',traitName:'通用武装',traitDescription:'20种通用武器自由装配；品质由武器碎片提升。',trait:'common',ownerPilotId:`pilot-${String(i+1).padStart(2,'0')}`}),
])));
export const airframeIdentity = id => AIRFRAME_IDENTITIES[id] || AIRFRAME_IDENTITIES['pilot-01'];
export function normalizeAirframePlacements(pilotId, placements = {}) {
  const chosen=Object.entries(placements).find(([id,slots])=>COMMON_WEAPONS[id]&&Array.isArray(slots)&&slots.includes('W1'));
  const main=chosen?.[0]||airframeIdentity(pilotId).weapon, result={[main]:['W1','W2']}, used=new Set(['W1','W2']);
  for(const [id,slots] of Object.entries(placements)) {
    if(id===main)continue;
    if(!Object.hasOwn(PUBLIC_ARSENAL,id)||!Array.isArray(slots)||slots.length<1||slots.length>2||new Set(slots).size!==slots.length)continue;
    if(slots.length===2&&!([['W1','W2'],['W3','W4'],['W5','W6']].some(pair=>slots.every(s=>pair.includes(s)))))continue;
    let target=slots.filter(s=>/^W[3-6]$/.test(s)&&!used.has(s));
    if(target.length!==slots.length)target=[['W3','W4'],['W5','W6']].find(pair=>pair.every(s=>!used.has(s)))?.slice(0,slots.length)||[];
    if(!target.length)continue;
    result[id]=target;target.forEach(s=>used.add(s));
  }
  return result;
}
export function compileAirframeLoadout(pilotId, placements = {}) {
  if(!AIRFRAME_IDENTITIES[pilotId])throw Error('未知机型');
  const normalized=normalizeAirframePlacements(pilotId,placements), identity=airframeIdentity(pilotId);
  const weapons=Object.entries(normalized).map(([itemId,slots])=>({id:`${pilotId}/${itemId}`,itemId,slots,kind:'weapon',innate:slots.includes('W1'),qualityRank:0,level:1}));
  return {version:3,common:true,pilotId,identity:{...identity,weapon:weapons[0].itemId},placements:normalized,weapons,connectors:[],graph:{}};
}
