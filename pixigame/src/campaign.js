import { getStageBalance } from './balance.js';
import { chapterEnemyProfile } from './chapter-enemies.js';
import { ADVANCED_CHAPTERS } from './advanced-chapters.js';
import { chapterPresentationForStage } from './replica/chapter-presentation.js';

// The workbook supplies legacy/fallback fields. Live 15-wave mainline numeric
// overrides are applied by tuneMainlineCampaign; IDs/content remain here.
export const COMBAT_WAVE_TIME_SCALE = 0.78;

export function stageWaveTime(stage) {
  return Math.max(30, Math.round((Number(stage?.waveTime) || 180) * COMBAT_WAVE_TIME_SCALE));
}

const CAMPAIGN_DATA = [
  { id: 'aries', arc: '黄道十二宫', name: '白羊座', title: '金羊冲锋', color: 0xff715c, accent: 0xffd071, pattern: 'charge', hp: 0.78, waveTime: 390 },
  { id: 'taurus', arc: '黄道十二宫', name: '金牛座', title: '迷宫铁壁', color: 0xd98b56, accent: 0xffe3a1, pattern: 'walls', hp: 0.88, waveTime: 30 },
  { id: 'gemini', arc: '黄道十二宫', name: '双子座', title: '镜像双生', color: 0xb379ff, accent: 0x78efff, pattern: 'twins', hp: 0.94, waveTime: 31 },
  { id: 'cancer', arc: '黄道十二宫', name: '巨蟹座', title: '潮汐清缴者', color: 0x63b9dc, accent: 0xb9f8ff, pattern: 'claws', hp: 1.02, waveTime: 31, purge: 1 },
  { id: 'leo', arc: '黄道十二宫', name: '狮子座', title: '日耀王冠', color: 0xff9a42, accent: 0xfff09b, pattern: 'solar', hp: 1.08, waveTime: 32 },
  { id: 'virgo', arc: '黄道十二宫', name: '处女座', title: '星穗审判', color: 0x7de0b0, accent: 0xe5fff0, pattern: 'lances', hp: 1.12, waveTime: 32 },
  { id: 'libra', arc: '黄道十二宫', name: '天秤座', title: '平衡剥离者', color: 0x82d9ff, accent: 0xffd278, pattern: 'balance', hp: 1.2, waveTime: 33, purge: 1 },
  { id: 'scorpio', arc: '黄道十二宫', name: '天蝎座', title: '深红毒尾', color: 0xc74771, accent: 0xff8baf, pattern: 'venom', hp: 1.28, waveTime: 33 },
  { id: 'sagittarius', arc: '黄道十二宫', name: '射手座', title: '穿星长矢', color: 0xd9a05f, accent: 0xffec9a, pattern: 'arrows', hp: 1.34, waveTime: 34 },
  { id: 'capricorn', arc: '黄道十二宫', name: '摩羯座', title: '天峰捷径', color: 0x7c91a9, accent: 0xd9f2ff, pattern: 'mountain', hp: 1.42, waveTime: 34 },
  { id: 'aquarius', arc: '黄道十二宫', name: '水瓶座', title: '天穹洪流', color: 0x51d4df, accent: 0xc4ffff, pattern: 'streams', hp: 1.5, waveTime: 35, purge: 1 },
  { id: 'pisces', arc: '黄道十二宫', name: '双鱼座', title: '无限回游', color: 0x7288ff, accent: 0xd4dbff, pattern: 'spiral', hp: 1.6, waveTime: 35, purge: 2 },
  { id: 'ares', arc: '奥林匹斯神战', name: '阿瑞斯', title: '战神红海', color: 0xe7443f, accent: 0xffc269, pattern: 'war', hp: 1.78, waveTime: 36 },
  { id: 'athena', arc: '奥林匹斯神战', name: '雅典娜', title: '神盾反射', color: 0xd6bd72, accent: 0xf8f1cf, pattern: 'aegis', hp: 1.92, waveTime: 36, purge: 1 },
  { id: 'hades', arc: '奥林匹斯神战', name: '哈迪斯', title: '冥界清算', color: 0x7355a3, accent: 0xd1a5ff, pattern: 'underworld', hp: 2.08, waveTime: 38, purge: 2 },
  { id: 'poseidon', arc: '奥林匹斯神战', name: '波塞冬', title: '三叉海啸', color: 0x2ca6c7, accent: 0xb6fbff, pattern: 'tsunami', hp: 2.28, waveTime: 39 },
  { id: 'zeus', arc: '奥林匹斯神战', name: '宙斯', title: '万雷神庭', color: 0xf0c95b, accent: 0xffffff, pattern: 'thunder', hp: 2.65, waveTime: 42, purge: 2, final: true },
];

// One chapter is one complete 15-wave sortie. Legacy IDs remain balance/save keys.
const CHAPTERS = [
  { source: 0, name: '蔚蓝海岸', scene: 'coast', environment: 'coast', title: '海岸指挥旗舰', color: 0x367a99, accent: 0x57cbef },
  { source: 5, name: '失落都市', scene: 'ruins', environment: 'city', title: '都市中枢巨机', color: 0x756148, accent: 0xed5947 },
  { source: 10, name: '熔火禁区', scene: 'volcano', environment: 'forge', title: '禁区铸造核心', color: 0x67352a, accent: 0xff771f },
  { source: 15, name: '地下暗渠', scene: 'sewer', environment: 'sewer', title: '暗渠净化主机', color: 0x446b50, accent: 0xa9ef65 },
  { source: 16, name: '星际深空', scene: 'space', environment: 'space', title: '星环歼灭旗舰', color: 0x534b8c, accent: 0xb394ff },
  ...ADVANCED_CHAPTERS.map(chapter=>({...chapter,source:16})),
];
export const CAMPAIGN = CHAPTERS.map((definition, index) => {
  const stage = CAMPAIGN_DATA[definition.source];
  const configured = getStageBalance(stage.id);
  const chapter = index + 1;
  const presentation = chapterPresentationForStage(index);
  return {
    ...stage,
    ...configured,
    id:definition.id || stage.id,
    terrainId:definition.id ? ({coast:'cancer',space:'aquarius',ruins:'virgo',sewer:'poseidon'})[definition.scene] : stage.id,
    ...(definition.id ? {recommendedPower:definition.recommendedPower,enemyHp:definition.enemyHp,bossHp:definition.bossHp,purge:0,waveTime:180} : {}),
    index,
    balanceIndex: definition.source,
    // Keep legacy IDs solely as save/balance keys, never as route names.
    ...presentation,
    arc: presentation.chapterName,
    chapter: `第 ${chapter} 章`,
    scene: definition.scene,
    environment: definition.environment,
    title: chapterEnemyProfile(index).boss,
    color: definition.color,
    accent: definition.accent,
    waveCount: 15,
    final: index === CHAPTERS.length - 1,
  };
});

export const TOTAL_STAGES = CAMPAIGN.length;

export function stageLabel(index) {
  const stage = CAMPAIGN[Math.max(0, Math.min(CAMPAIGN.length - 1, index))];
  return `${String(index + 1).padStart(2, '0')}/${CAMPAIGN.length} · ${stage.name}`;
}
