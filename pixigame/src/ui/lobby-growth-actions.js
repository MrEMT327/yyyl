const actions = new Set(['upgradeAircraft', 'upgradeWeapon', 'synthesizeWeapon', 'synthesizeAll']);
export const hasLobbyGrowthFeedback = action => actions.has(action);
