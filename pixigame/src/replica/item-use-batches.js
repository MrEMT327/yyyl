// Local UI batch bound; probabilities, per-item costs and pity stay unchanged.
// Deterministic fragment/material exchanges retain their existing all-at-once path.
export const ITEM_USE_BATCH_LIMIT = 100;
export const isItemUseBatchCount = count => Number.isSafeInteger(count) && count >= 1 && count <= ITEM_USE_BATCH_LIMIT;
