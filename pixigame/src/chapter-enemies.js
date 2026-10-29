import {ADVANCED_CHAPTERS} from './advanced-chapters.js';
import {libraryBossName} from './render/enemy-library-lineup.js';
// Chapter identity is shared by the renderer, encounter planner and review tools.
// Save IDs, rewards and the 15-wave director intentionally remain unchanged.
export const CHAPTER_ENEMIES = Object.freeze([
  { id:'coast', faction:'海防舰队', regular:'巡航机 / 鱼雷艇', elite:'双体护卫舰', boss:'潮汐航空母舰', silhouette:'carrier',
    attack:'定向齐射 · 双舷火力 · 留隙封锁' },
  { id:'city', faction:'废墟工械', regular:'巡检飞械 / 哨戒翼机', elite:'重装翼卫', boss:'废墟空中堡垒', silhouette:'flying-fortress',
    attack:'锁定点射 · 双炮校准 · 定点轰击' },
  { id:'forge', faction:'熔炉构装', regular:'熔渣轮 / 钻锥', elite:'熔核钳兽', boss:'地狱铸造炉', silhouette:'furnace',
    attack:'熔渣扇射 · 钳口夹击 · 炉心热流' },
  { id:'sewer', faction:'暗渠清淤', regular:'巡渠潜航器 / 压力哨兵', elite:'重型清障机', boss:'深渠移动泵站', silhouette:'pump-station',
    attack:'水压点射 · 排水波纹 · 高压落点' },
  { id:'space', faction:'异星飞碟', regular:'侦察飞碟 / 警戒碟', elite:'三瓣歼灭碟', boss:'天幕母舰', silhouette:'mothership',
    attack:'离子散射 · 卫星交叉 · 留隙光环与光束' },
  ...ADVANCED_CHAPTERS.map((c,index)=>({id:c.id,faction:c.faction,
    regular:c.regular || ['极地巡航机 / 极地重机','空域哨机 / 巡航机','船坞无人机 / 装甲机','赤潮翼机 / 赤潮重机','天穹巡航机 / 天穹禁卫'][index],
    elite:`${c.faction}精英`,boss:c.boss,silhouette:c.id,
    attack:c.attack || ['定向齐射 · 双舷火力','锁定点射 · 交错齐射','扇形散射 · 双翼齐射','交替点射 · 留隙环弹','离子散射 · 交叉齐射'][index]})),
].map(profile => Object.freeze({...profile,boss:libraryBossName(profile.id)})));

export function chapterEnemyProfile(index=0) {
  return CHAPTER_ENEMIES[Math.max(0,Math.min(CHAPTER_ENEMIES.length-1,Math.floor(Number(index)||0)))];
}

// The regular collision core remains forgiving; elites have a distinct 90px body,
// not the old heavy-plane x1.08. Boss appendages are decorative outside the core.
export function enemyTierMetrics(kind,elite=false) {
  return elite ? {scale:1,radius:36} : {
    scale:({scout:.65,dart:.62,turret:.66,heavy:.52,relay:.6}[kind]??.62),radius:20,
  };
}

export function chapterBossPosition(chapter,time,_legacyPhase,width) {
  const center=width/2;
  const motions=[
    [Math.sin(time*.45)*70,Math.sin(time*.6)*12],
    [Math.sin(time*.22)*30,Math.sin(time*.4)*5],
    [Math.sin(time*.32)*42,Math.sin(time*.65)*10],
    [Math.sin(time*.55)*65,Math.cos(time*.8)*20],
    [Math.sin(time*.38)*52,Math.sin(time*.76)*18],
    [Math.sin(time*.3)*35,Math.sin(time*.5)*8],
    [Math.sin(time*.5)*65,Math.cos(time*.6)*10],
    [Math.sin(time*.25)*32,Math.sin(time*.4)*7],
    [Math.sin(time*.4)*55,Math.sin(time*.65)*15],
    [Math.sin(time*.35)*48,Math.cos(time*.7)*12],
    [Math.sin(time*.32)*52,Math.sin(time*.5)*8],
    [Math.sin(time*.42)*55,Math.cos(time*.65)*12],
    [Math.sin(time*.48)*60,Math.sin(time*.72)*10],
    [Math.sin(time*.3)*62,Math.cos(time*.55)*10],
    [Math.sin(time*.36)*48,Math.sin(time*.6)*12],
    [Math.sin(time*.4)*54,Math.cos(time*.58)*10],
    [Math.sin(time*.28)*42,Math.sin(time*.46)*8],
    [Math.sin(time*.46)*64,Math.cos(time*.68)*14],
    [Math.sin(time*.34)*50,Math.sin(time*.52)*9],
    [Math.sin(time*.38)*56,Math.cos(time*.62)*11],
    [Math.sin(time*.33)*58,Math.sin(time*.54)*9],
    [Math.sin(time*.44)*55,Math.cos(time*.66)*13],
    [Math.sin(time*.29)*44,Math.sin(time*.48)*8],
    [Math.sin(time*.31)*48,Math.cos(time*.56)*10],
    [Math.sin(time*.43)*60,Math.sin(time*.7)*14],
    [Math.sin(time*.35)*58,Math.cos(time*.58)*10],
    [Math.sin(time*.42)*54,Math.sin(time*.64)*12],
    [Math.sin(time*.28)*44,Math.cos(time*.48)*8],
    [Math.sin(time*.4)*56,Math.sin(time*.62)*11],
    [Math.sin(time*.37)*60,Math.cos(time*.68)*14],
    [Math.sin(time*.34)*56,Math.sin(time*.56)*10],
    [Math.sin(time*.3)*46,Math.cos(time*.5)*8],
    [Math.sin(time*.41)*58,Math.sin(time*.64)*12],
    [Math.sin(time*.45)*60,Math.cos(time*.6)*10],
    [Math.sin(time*.38)*58,Math.sin(time*.7)*13],
    [Math.sin(time*.36)*56,Math.cos(time*.58)*10],
    [Math.sin(time*.44)*60,Math.sin(time*.66)*12],
    [Math.sin(time*.3)*46,Math.cos(time*.52)*8],
    [Math.sin(time*.32)*50,Math.sin(time*.56)*10],
    [Math.sin(time*.4)*58,Math.cos(time*.68)*13],
    [Math.sin(time*.31)*48,Math.sin(time*.54)*9],
    [Math.sin(time*.43)*58,Math.cos(time*.64)*12],
    [Math.sin(time*.29)*46,Math.sin(time*.5)*8],
    [Math.sin(time*.37)*54,Math.cos(time*.6)*10],
    [Math.sin(time*.41)*60,Math.sin(time*.68)*13],
    [Math.sin(time*.36)*54,Math.cos(time*.58)*10],
    [Math.sin(time*.3)*46,Math.sin(time*.52)*8],
    [Math.sin(time*.44)*60,Math.cos(time*.66)*12],
    [Math.sin(time*.39)*56,Math.sin(time*.62)*11],
    [Math.sin(time*.33)*50,Math.cos(time*.56)*9],
  ];
  const [x,y]=motions[CHAPTER_ENEMIES.indexOf(chapterEnemyProfile(chapter))];
  return {x:Math.max(110,Math.min(width-110,center+x)),y:185+y};
}
