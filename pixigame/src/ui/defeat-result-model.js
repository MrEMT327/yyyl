import { nativeRewardPresentation } from '../replica/native-item-presentation.js';
import { resultRewardStatus } from './result-reward-status.js';
import { projectIconUrl } from './project-ui-art.js';
import { RESOURCE_ICONS } from './resource-icons.js';
import { battleCardIconUrl } from '../replica/battle-card-art.js';
import correspondence from '../../replica-battle/weapon-skin-correspondence.json' with {type:'json'};
import {rewardDisplayQuality} from '../replica/item-display-quality.js';

export function defeatRewardArt(row) {
  const itemArt = nativeRewardPresentation(row).image;
  if (itemArt) return itemArt;
  const resource = row.type;
  if (RESOURCE_ICONS[resource]) return RESOURCE_ICONS[resource].url;
  return projectIconUrl('task-log');
}

export function defeatRecommendationArt(row) {
  if (row.functionId) return projectIconUrl(row.functionId === 2 ? 'nav-equipment' : 'nav-research');
  const familyId = row.familyId || correspondence.stages[row.skillId]?.familyId || correspondence.branches[row.skillId]?.familyId;
  return battleCardIconUrl({id:row.skillId,group:familyId,icon:correspondence.families[familyId]?.icon});
}

export function defeatResultModel(bridge, page = 0) {
  const game = bridge.game, result = bridge.presentation?.result;
  const rows = result ? result.rows || [] : Object.entries(game.defeatReward || {})
    .filter(([type, amount]) => ['aircraftShards','weaponParts'].includes(type) && amount > 0)
    .map(([type, amount]) => ({type, label:type === 'weaponParts' ? '通用零件' : '飞机碎片', amount:'+'+amount}));
  const pageCount = Math.max(1, Math.ceil(rows.length / 10));
  const selectedPage = Math.max(0, Math.min(pageCount - 1, Math.floor(page) || 0));
  return {
    chapter: result?.chapterId ?? (game.stageIndex || 0) + 1,
    wave: result?.wave ?? game.waveIndex ?? 1,
    stars: result?.stars ?? 0,
    kills: result?.kills ?? game.kills ?? 0,
    rewards: rows.slice(selectedPage * 10, selectedPage * 10 + 10).map(row => ({...row, ...rewardDisplayQuality(row), image:defeatRewardArt(row)})),
    aircraftImage:result?.aircraftImage,
    recommendations: (result?.recommendations || []).map(row => ({...row, image:defeatRecommendationArt(row)})),
    recommendationTitle: result?.recommendations?.some(row => row.functionId) ? '提升建议' : '推荐技能',
    page: selectedPage, pageCount, total: rows.length,
    note: result?.note || '本局战斗数据已记录',
    ...resultRewardStatus(result, game.completionSummary?.debugRun),
  };
}
