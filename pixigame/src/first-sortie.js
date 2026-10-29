export const FIRST_SORTIE_STORAGE_KEY = 'thunder-first-sortie-started-v1';

export function shouldAutoStartFirstSortie({
  alreadyStarted = false,
  bossTestMode = false,
  previewLobbyTab = null,
  campaignState,
} = {}) {
  if (alreadyStarted || bossTestMode || previewLobbyTab) return false;
  const results = campaignState?.results;
  const hasResults = results && typeof results === 'object' && Object.keys(results).length > 0;
  return Number(campaignState?.highestCleared ?? -1) < 0 && !hasResults;
}
