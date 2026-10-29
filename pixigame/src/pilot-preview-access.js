// Temporary portrait review access. These ids are session permissions only;
// they must never be merged into the saved roster or aircraft inventory.
// Clear this list to return to the saved roster and character selection.
export const TEMPORARY_PILOT_IDS = Object.freeze(['pilot-08', 'pilot-06', 'pilot-10', 'pilot-02', 'pilot-05', 'pilot-09', 'pilot-04']);
export const DEFAULT_PREVIEW_PILOT_ID = TEMPORARY_PILOT_IDS[0] || null;
