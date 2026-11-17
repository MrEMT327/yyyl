import {normalizeStarRecord} from '../campaign-stars.js';
import {DEFAULT_PLAYER_NAME,playerName} from '../player-identity.js';
export const PROFILE_STORAGE_KEY='thunder-profile-v1';
export const CAMPAIGN_STORAGE_KEY='thunder-campaign-v1';

export function loadCampaignState(localStorage, CAMPAIGN, DIFFICULTIES) {
  const fallback = {
    version: 4,
    highestUnlocked: CAMPAIGN.length - 1,
    highestCleared: -1,
    selected: 0,
    selectedDifficulty: 'easy',
    results: {},
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(CAMPAIGN_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const rawResults = parsed.results && typeof parsed.results === 'object' ? parsed.results : {};
    const retiredResults = { ...(parsed.retiredResults || {}) };
    // Retain every former sub-stage record without treating unfinished chapters
    // as completed. Only the old final sub-stage carries chapter completion.
    if ((Number(parsed.version) || 0) < 4) {
      Object.assign(retiredResults, rawResults);
      for (const [chapterId, finalStageId] of [['aries','leo'],['virgo','capricorn'],['aquarius','hades']]) {
        for (const difficulty of DIFFICULTIES) {
          const key = `${chapterId}:${difficulty.id}`;
          const completed = rawResults[`${finalStageId}:${difficulty.id}`];
          if (completed) rawResults[key] = completed;
          else delete rawResults[key];
        }
      }
      // Previously retired god stages are not clears of the two new themes.
      for (const key of Object.keys(rawResults)) if (key.startsWith('poseidon:') || key.startsWith('zeus:')) delete rawResults[key];
    }
    for (const [key, value] of Object.entries(rawResults)) {
      if (key.startsWith('poseidon:') || key.startsWith('zeus:')) retiredResults[key] = value;
    }
    const results = {};
    for (const stage of CAMPAIGN) {
      for (const difficulty of DIFFICULTIES) {
        const key = `${stage.id}:${difficulty.id}`;
        const raw = rawResults[key];
        if (!raw || typeof raw !== 'object') continue;
        const {stars,starMask} = normalizeStarRecord(raw);
        results[key] = {
          cleared: Boolean(raw.cleared) || stars > 0,
          stars,
          starMask,
          bestTime: Math.max(0, Math.floor(Number(raw.bestTime) || 0)),
          bestScore: Math.max(0, Math.floor(Number(raw.bestScore) || 0)),
        };
      }
    }
    let highestCleared = -1;
    for (let index = 0; index < CAMPAIGN.length; index += 1) {
      if (!results[`${CAMPAIGN[index].id}:easy`]?.cleared) break;
      highestCleared = index;
    }
    const highestUnlocked = CAMPAIGN.length - 1;
    const savedSelection = Math.max(0, Math.floor(Number(parsed.selected) || 0));
    const selected = Math.min(highestUnlocked, Number(parsed.version) >= 4 ? savedSelection : Math.min(2, Math.floor(savedSelection / 5)));
    return {
      version: 4,
      highestUnlocked,
      highestCleared,
      selected,
      selectedDifficulty: 'easy',
      results,
      retiredResults,
    };
  } catch {
    return fallback;
  }
}

export function loadProfileState(localStorage) {
  const fallback = {
    playerName: DEFAULT_PLAYER_NAME,
    coins: 600,
    diamonds: 0,
    fighterLevel: 1,
    gearLevel: 1,
    techLevel: 1,
    supplyOpened: 0,
    lastFreeSupply: '',
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(PROFILE_STORAGE_KEY) || 'null');
    if (!parsed || typeof parsed !== 'object') return fallback;
    const coins = Number(parsed.coins);
    const diamonds = Number(parsed.diamonds);
    return {
      playerName: playerName(parsed.playerName),
      coins: Math.max(0, Math.floor(Number.isFinite(coins) ? coins : fallback.coins)),
      diamonds: Math.max(0, Math.floor(Number.isFinite(diamonds) ? diamonds : fallback.diamonds)),
      fighterLevel: Math.max(1, Math.min(50, Math.floor(Number(parsed.fighterLevel) || 1))),
      gearLevel: Math.max(1, Math.min(50, Math.floor(Number(parsed.gearLevel) || 1))),
      techLevel: Math.max(1, Math.min(50, Math.floor(Number(parsed.techLevel) || 1))),
      supplyOpened: Math.max(0, Math.floor(Number(parsed.supplyOpened) || 0)),
      lastFreeSupply: String(parsed.lastFreeSupply || ''),
    };
  } catch {
    return fallback;
  }
}
