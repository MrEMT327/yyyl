/** Only attributes with a confirmed out-of-battle consumer belong here.
 * Keep displayed percentage points and full source contributions unchanged.
 * Native CardHangUpRewardsID = [55010]; native-patrol consumes this key once.
 * Hidden/inherited attribute metadata alone does not imply economy scope.
 */
const economyOnly = new Set(['HangUpRewards%']);

export function splitNativeEconomyAttributes(contributions) {
  const economyAttributes = {}, battleContributions = [];
  for (const source of contributions) {
    const attributes = {};
    for (const [key, value] of Object.entries(source.attributes)) {
      if (economyOnly.has(key)) economyAttributes[key] = (economyAttributes[key] || 0) + value;
      else attributes[key] = value;
    }
    if (Object.keys(attributes).length) battleContributions.push({...source, attributes});
  }
  return {economyAttributes, battleContributions};
}
