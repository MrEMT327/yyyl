import { nativeItemArt } from '../replica/native-item-presentation.js';
import { resultRewardStatus } from './result-reward-status.js';
import { projectIconUrl } from './project-ui-art.js';
import { RESOURCE_ICONS } from './resource-icons.js';
import { weaponIconUrl } from './weapon-icon-source.js';
import correspondence from '../../replica-battle/weapon-skin-correspondence.json' with {type:'json'};

export function defeatRewardArt(row) {
  const itemArt = nativeItemArt(row.nativeItemId ?? row.id);
  if (itemArt) return itemArt;
  const resource = row.type;
  if (RESOURCE_ICONS[resource]) return RESOURCE_ICONS[resource].url;
  return projectIconUrl('task-log');
}

export function defeatRecommendationArt(row) {
  if (row.functionId) return projectIconUrl(row.functionId === 2 ? 'nav-equipment' : 'nav-research');
  const itemId = correspondence.families[row.familyId]?.itemId;
  if (itemId) return weaponIconUrl(itemId);
  const symbol = ({10000201:'skill-toxin',10000601:'skill-blades',10000901:'skill-gravity',
    10001101:'skill-blades',10001601:'skill-freeze',10001701:'skill-beam'})[row.familyId];
  return projectIconUrl(symbol || 'skill-tab');
}

export function defeatResultModel(bridge, page = 0) {
  const game = bridge.game, result = bridge.presentation?.result;
  const rows = result ? result.rows || [] : Object.entries(game.defeatReward || {})
    .filter(([type, amount]) => ['aircraftShards','weaponParts'].includes(type) && amount > 0)
    .map(([type, amount]) => ({type, label:type === 'weaponParts' ? '通用零件' : '飞机碎片', amount:'+'+amount}));
  const pageCount = Math.max(1, Math.ceil(rows.length / 8));
  const selectedPage = Math.max(0, Math.min(pageCount - 1, Math.floor(page) || 0));
  return {
    chapter: result?.chapterId ?? (game.stageIndex || 0) + 1,
    wave: result?.wave ?? game.waveIndex ?? 1,
    stars: result?.stars ?? 0,
    kills: result?.kills ?? game.kills ?? 0,
    rewards: rows.slice(selectedPage * 8, selectedPage * 8 + 8).map(row => ({...row, image:defeatRewardArt(row)})),
    recommendations: (result?.recommendations || []).map(row => ({...row, image:defeatRecommendationArt(row)})),
    recommendationTitle: result?.recommendations?.some(row => row.functionId) ? '提升建议' : '推荐技能',
    page: selectedPage, pageCount, total: rows.length,
    note: result?.note || '本局战斗数据已记录',
    ...resultRewardStatus(result, game.completionSummary?.debugRun),
  };
}
